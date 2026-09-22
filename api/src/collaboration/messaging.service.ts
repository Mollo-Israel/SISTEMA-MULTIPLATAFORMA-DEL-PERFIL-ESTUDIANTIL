import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, In, Repository } from 'typeorm';
import { ConversationKind, MESSAGE_MAX_LENGTH } from '@perfil/shared';
import { StudentProfile } from '../entities/student-profile.entity';
import {
  Conversation,
  ConversationMember,
  Message,
} from '../entities/collaboration.entity';
import { ContactsService } from './contacts.service';
import { TeamsService } from './teams.service';

/** Cuántos mensajes devuelve una página. */
const PAGINA = 50;

/**
 * Mensajería contextual (§42).
 *
 * §42 la llama «apoyo contextual» y es exactamente eso: una conversación existe
 * **porque hay una relación detrás**, no al revés. Directa, entre contactos
 * aceptados (§42.1); grupal, entre integrantes aceptados de un equipo (§42.2).
 * No hay una tercera forma, porque sería un canal para escribirle a cualquiera.
 *
 * ## Lo que este servicio no hace, a propósito
 *
 * §42 fija cuatro prohibiciones y las cuatro se cumplen por ausencia, que es la
 * única forma de cumplirlas de verdad:
 *
 * - **no alimenta afinidad** — no llama al recálculo de trayectoria por ningún
 *   camino;
 * - **no puntúa por cantidad de mensajes** — no hay contadores por persona;
 * - **no se analiza el contenido para inferir competencia** — el texto se
 *   guarda y se devuelve, y nada más lo lee;
 * - **no sirve como prueba automática de contribución** — la bitácora
 *   estructurada del proyecto (§41) es la fuente de auditoría, y nada de aquí
 *   llega a ella.
 */
@Injectable()
export class MessagingService {
  constructor(
    private readonly dataSource: DataSource,
    private readonly contacts: ContactsService,
    private readonly teams: TeamsService,
    @InjectRepository(Conversation) private readonly conversations: Repository<Conversation>,
    @InjectRepository(ConversationMember)
    private readonly members: Repository<ConversationMember>,
    @InjectRepository(Message) private readonly messages: Repository<Message>,
    @InjectRepository(StudentProfile) private readonly profiles: Repository<StudentProfile>,
  ) {}

  /**
   * Política de §107: `canAccessConversation`.
   *
   * Pertenecer a la conversación no basta: la relación que la justifica tiene
   * que seguir existiendo. Si dos personas dejan de ser contactos, el canal se
   * cierra; que la fila de pertenencia siga ahí no es permiso.
   */
  async canAccess(conversationId: string, studentProfileId: string): Promise<boolean> {
    const conversacion = await this.conversations.findOne({ where: { id: conversationId } });
    if (!conversacion) return false;

    const pertenece = await this.members.exists({
      where: { conversationId, studentProfileId },
    });
    if (!pertenece) return false;

    if (conversacion.kind === ConversationKind.TEAM) {
      return conversacion.teamId
        ? this.teams.isMember(conversacion.teamId, studentProfileId)
        : false;
    }

    const otros = await this.members.find({
      where: { conversationId },
      select: { studentProfileId: true },
    });
    const otro = otros.find((m) => m.studentProfileId !== studentProfileId);
    return otro ? this.contacts.areContacts(studentProfileId, otro.studentProfileId) : false;
  }

  /**
   * Abre —o recupera— la conversación directa con un contacto (§42.1).
   *
   * Exige contacto aceptado. Sin esa comprobación, cualquiera podría abrir un
   * canal con cualquiera y la solicitud de contacto de §45 no serviría de nada.
   */
  async openDirect(studentProfileId: string, otherProfileId: string) {
    if (studentProfileId === otherProfileId) {
      throw new BadRequestException('No puedes abrir una conversación contigo mismo.');
    }
    if (!(await this.contacts.areContacts(studentProfileId, otherProfileId))) {
      throw new ForbiddenException(
        'Solo puedes escribir a tus contactos. Envía una solicitud primero.',
      );
    }

    const existente = await this.conversations
      .createQueryBuilder('c')
      .innerJoin('c.members', 'a', 'a.student_profile_id = :yo', { yo: studentProfileId })
      .innerJoin('c.members', 'b', 'b.student_profile_id = :otro', { otro: otherProfileId })
      .where('c.kind = :kind', { kind: ConversationKind.DIRECT })
      .getOne();
    if (existente) return this.vistaConversacion(existente, studentProfileId);

    const creada = await this.dataSource.transaction(async (manager) => {
      const conversacion = await manager.save(
        manager.create(Conversation, { kind: ConversationKind.DIRECT, teamId: null }),
      );
      await manager.save([
        manager.create(ConversationMember, {
          conversationId: conversacion.id,
          studentProfileId,
        }),
        manager.create(ConversationMember, {
          conversationId: conversacion.id,
          studentProfileId: otherProfileId,
        }),
      ]);
      return conversacion;
    });
    return this.vistaConversacion(creada, studentProfileId);
  }

  /** Las conversaciones del estudiante, la más reciente primero. */
  async list(studentProfileId: string) {
    const pertenencias = await this.members.find({ where: { studentProfileId } });
    if (pertenencias.length === 0) return [];

    const conversaciones = await this.conversations.find({
      where: { id: In(pertenencias.map((m) => m.conversationId)) },
      relations: { team: true },
      order: { lastMessageAt: 'DESC', createdAt: 'DESC' },
    });

    const salida: Awaited<ReturnType<typeof this.vistaConversacion>>[] = [];
    for (const c of conversaciones) {
      // La relación se vuelve a comprobar al listar: una conversación cuya
      // relación se deshizo deja de aparecer, en vez de quedar como un canal
      // abierto que nadie recuerda haber autorizado.
      if (!(await this.canAccess(c.id, studentProfileId))) continue;
      salida.push(await this.vistaConversacion(c, studentProfileId));
    }
    return salida;
  }

  /** Los mensajes de una conversación, del más antiguo al más reciente. */
  async messagesOf(studentProfileId: string, conversationId: string, before?: string) {
    await this.assertAcceso(conversationId, studentProfileId);

    const qb = this.messages
      .createQueryBuilder('m')
      .leftJoinAndSelect('m.sender', 'sender')
      .leftJoinAndSelect('sender.user', 'user')
      .where('m.conversationId = :conversationId', { conversationId })
      .orderBy('m.createdAt', 'DESC')
      .take(PAGINA);
    if (before) qb.andWhere('m.createdAt < :before', { before });

    const filas = await qb.getMany();
    await this.members.update(
      { conversationId, studentProfileId },
      { lastReadAt: new Date() },
    );

    return filas
      .map((m) => ({
        id: m.id,
        body: m.body,
        createdAt: m.createdAt,
        mine: m.senderProfileId === studentProfileId,
        sender: {
          profileId: m.senderProfileId,
          name: m.sender?.user
            ? `${m.sender.user.firstName} ${m.sender.user.lastName}`
            : 'Estudiante',
        },
      }))
      .reverse();
  }

  /**
   * Envía un mensaje.
   *
   * Lo único que ocurre además de guardarlo es actualizar la fecha del último
   * mensaje, que sirve para ordenar la lista. No se recalcula nada, no se
   * cuenta nada y no se deriva nada: §42 lo prohíbe expresamente.
   */
  async send(studentProfileId: string, conversationId: string, body: string) {
    await this.assertAcceso(conversationId, studentProfileId);

    const texto = body.trim();
    if (!texto) throw new BadRequestException('El mensaje no puede estar vacío.');
    if (texto.length > MESSAGE_MAX_LENGTH) {
      throw new BadRequestException(
        `El mensaje no puede superar ${MESSAGE_MAX_LENGTH} caracteres.`,
      );
    }

    const mensaje = await this.dataSource.transaction(async (manager) => {
      const guardado = await manager.save(
        manager.create(Message, { conversationId, senderProfileId: studentProfileId, body: texto }),
      );
      await manager.update(Conversation, { id: conversationId }, {
        lastMessageAt: guardado.createdAt,
      });
      await manager.update(
        ConversationMember,
        { conversationId, studentProfileId },
        { lastReadAt: guardado.createdAt },
      );
      return guardado;
    });

    return { id: mensaje.id, body: mensaje.body, createdAt: mensaje.createdAt, mine: true };
  }

  private async assertAcceso(conversationId: string, studentProfileId: string): Promise<void> {
    if (!(await this.canAccess(conversationId, studentProfileId))) {
      // 404 y no 403: quien no participa no tiene por qué saber que existe.
      throw new NotFoundException('Conversación no encontrada.');
    }
  }

  private async vistaConversacion(c: Conversation, studentProfileId: string) {
    const integrantes = await this.members.find({
      where: { conversationId: c.id },
      relations: { studentProfile: { user: true } },
    });
    const otros = integrantes.filter((m) => m.studentProfileId !== studentProfileId);

    return {
      id: c.id,
      kind: c.kind,
      teamId: c.teamId,
      title:
        c.kind === ConversationKind.TEAM
          ? (c.team?.name ?? 'Equipo')
          : otros[0]?.studentProfile?.user
            ? `${otros[0].studentProfile.user.firstName} ${otros[0].studentProfile.user.lastName}`
            : 'Estudiante',
      participants: integrantes.map((m) => ({
        profileId: m.studentProfileId,
        name: m.studentProfile?.user
          ? `${m.studentProfile.user.firstName} ${m.studentProfile.user.lastName}`
          : 'Estudiante',
      })),
      lastMessageAt: c.lastMessageAt,
    };
  }
}
