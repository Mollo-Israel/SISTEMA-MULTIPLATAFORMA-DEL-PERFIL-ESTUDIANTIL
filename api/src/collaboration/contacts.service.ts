import { NOTIFICATION_EMITTER, NotificationEmitter } from '../notifications/notification.port';
import {
  BadRequestException,
  Inject,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, In, Repository } from 'typeorm';
import {
  CONTACT_CHANNEL_LABEL,
  ContactChannelType,
  ContactRequestStatus,
  ContactSource,
} from '@perfil/shared';
import { StudentProfile } from '../entities/student-profile.entity';
import { AuditEventType, AuditService } from '../audit/audit.service';
import { Contact, ContactRequest } from '../entities/collaboration.entity';
import { ContactNote, StudentContactChannel } from '../entities/contact-channel.entity';
import { channelHref, checkContactChannel } from './contact-channel.rules';
import { ContactChannelDto, ContactNoteDto } from './dto/collaboration.dto';

/** Un canal tal como lo ve otra persona: etiqueta y enlace seguro. */
export interface ChannelView {
  channel: ContactChannelType;
  label: string;
  value: string;
  href: string | null;
  isPublic: boolean;
}

export function channelView(c: StudentContactChannel): ChannelView {
  return {
    channel: c.channel,
    label: CONTACT_CHANNEL_LABEL[c.channel] ?? c.channel,
    value: c.value,
    href: channelHref(c.channel, c.value),
    isPublic: c.isPublic,
  };
}

/**
 * Contactos entre estudiantes (§45).
 *
 * §45 describe el flujo y lo cierra con la frase que manda sobre todo lo demás:
 * *«El QR no establece contacto automáticamente»*. Escanear lleva al perfil
 * compartible; el contacto nace de una solicitud que la otra persona responde.
 *
 * El contacto se guarda en **una** fila por pareja, con los identificadores
 * ordenados. Guardar dos filas simétricas obligaría a mantenerlas de acuerdo, y
 * basta con que una se borre a medias para que A vea a B entre sus contactos y
 * B no vea a A.
 */
@Injectable()
export class ContactsService {
  constructor(
    private readonly dataSource: DataSource,
    @InjectRepository(ContactRequest) private readonly requests: Repository<ContactRequest>,
    @InjectRepository(Contact) private readonly contacts: Repository<Contact>,
    @InjectRepository(StudentProfile) private readonly profiles: Repository<StudentProfile>,
    @InjectRepository(StudentContactChannel) private readonly channels: Repository<StudentContactChannel>,
    @InjectRepository(ContactNote) private readonly notes: Repository<ContactNote>,
    @Inject(NOTIFICATION_EMITTER) private readonly notifications: NotificationEmitter,
    private readonly audit: AuditService,
  ) {}

  /** Las notificaciones nunca deshacen una operación (V3 §33). */
  private async avisar(evento: Parameters<NotificationEmitter['emit']>[0]): Promise<void> {
    try {
      await this.notifications.emit(evento);
    } catch {
      // sin efecto sobre la operación
    }
  }

  // =========================================================================
  // V2 §59 · Canales de contacto
  // =========================================================================

  async myChannels(studentProfileId: string): Promise<ChannelView[]> {
    const filas = await this.channels.find({ where: { studentProfileId }, order: { channel: 'ASC' } });
    return filas.map(channelView);
  }

  /**
   * Reemplaza los canales del estudiante. Cada valor se valida y normaliza
   * según su canal; un canal que no viene, se quita.
   */
  async saveChannels(studentProfileId: string, entrada: ContactChannelDto[]): Promise<ChannelView[]> {
    const vistos = new Set<string>();
    const errores: Record<string, string[]> = {};
    const limpios: { channel: ContactChannelType; value: string; isPublic: boolean }[] = [];
    entrada.forEach((c, i) => {
      if (vistos.has(c.channel)) {
        errores[`channels.${i}.channel`] = ['Ese canal ya está en la lista.'];
        return;
      }
      vistos.add(c.channel);
      const r = checkContactChannel(c.channel, c.value);
      if (!r.ok) errores[`channels.${i}.value`] = [r.message];
      else limpios.push({ channel: c.channel, value: r.value, isPublic: !!c.isPublic });
    });
    if (Object.keys(errores).length) {
      throw new BadRequestException({
        message: Object.values(errores)[0][0],
        fields: errores,
      });
    }
    await this.dataSource.transaction(async (manager) => {
      await manager.delete(StudentContactChannel, { studentProfileId });
      if (limpios.length) {
        await manager.save(limpios.map((l) => manager.create(StudentContactChannel, { studentProfileId, ...l })));
      }
    });
    return this.myChannels(studentProfileId);
  }

  /** Canales que el estudiante marcó para su perfil público (§58). */
  async publicChannels(studentProfileId: string): Promise<ChannelView[]> {
    const filas = await this.channels.find({ where: { studentProfileId, isPublic: true }, order: { channel: 'ASC' } });
    return filas.map(channelView);
  }

  // =========================================================================
  // V2 §56 · Nota personal sobre un contacto
  // =========================================================================

  async saveNote(ownerProfileId: string, otherProfileId: string, dto: ContactNoteDto) {
    const [profileAId, profileBId] = this.pareja(ownerProfileId, otherProfileId);
    const contacto = await this.contacts.findOne({ where: { profileAId, profileBId } });
    if (!contacto) throw new NotFoundException('No existe ese contacto.');
    if (dto.preferredChannel) {
      const tiene = await this.channels.exists({
        where: { studentProfileId: otherProfileId, channel: dto.preferredChannel },
      });
      if (!tiene) {
        const m = 'Esa persona no comparte ese canal.';
        throw new BadRequestException({ message: m, fields: { preferredChannel: [m] } });
      }
    }
    const nota = (await this.notes.findOne({ where: { contactId: contacto.id, ownerProfileId } }))
      ?? this.notes.create({ contactId: contacto.id, ownerProfileId });
    if (dto.alias !== undefined) nota.alias = dto.alias?.trim() || null;
    if (dto.context !== undefined) nota.context = dto.context?.trim() || null;
    if (dto.preferredChannel !== undefined) nota.preferredChannel = dto.preferredChannel ?? null;
    const guardada = await this.notes.save(nota);
    return {
      alias: guardada.alias,
      context: guardada.context,
      preferredChannel: guardada.preferredChannel,
      updatedAt: guardada.updatedAt,
    };
  }

  /** Los dos identificadores en el orden canónico de la tabla. */
  private pareja(a: string, b: string): [string, string] {
    return a < b ? [a, b] : [b, a];
  }

  async areContacts(a: string, b: string): Promise<boolean> {
    const [profileAId, profileBId] = this.pareja(a, b);
    return this.contacts.exists({ where: { profileAId, profileBId } });
  }

  /**
   * Envía una solicitud (§45).
   *
   * Se identifica al destinatario por su **slug público**, no por su id
   * interno: es el único identificador que quien escanea un QR llega a tener, y
   * §43 pide que sea el único que circule.
   */
  async request(
    requesterProfileId: string,
    slug: string,
    datos: { message?: string; source?: ContactSource },
  ) {
    const destino = await this.profiles.findOne({
      where: { publicProfileSlug: slug },
    });
    // Mismo 404 que un perfil cerrado: decir «existe pero no está publicado»
    // ya es contar algo de alguien que decidió no contarlo.
    if (!destino || !destino.publicProfileEnabled) {
      throw new NotFoundException('No existe un perfil compartible con ese enlace.');
    }
    if (destino.id === requesterProfileId) {
      throw new BadRequestException('No puedes enviarte una solicitud a ti mismo.');
    }

    if (await this.areContacts(requesterProfileId, destino.id)) {
      throw new ConflictException('Ya son contactos.');
    }

    const pendientes = await this.requests.find({
      where: [
        {
          requesterProfileId,
          targetProfileId: destino.id,
          status: ContactRequestStatus.PENDING,
        },
        {
          requesterProfileId: destino.id,
          targetProfileId: requesterProfileId,
          status: ContactRequestStatus.PENDING,
        },
      ],
    });
    if (pendientes.length > 0) {
      // Puede ser la suya o la contraria. En los dos casos la respuesta es
      // esperar, no acumular solicitudes.
      throw new ConflictException('Ya hay una solicitud pendiente entre ustedes.');
    }

    const guardada = await this.requests.save(
      this.requests.create({
        requesterProfileId,
        targetProfileId: destino.id,
        message: datos.message ?? null,
        source: datos.source ?? ContactSource.DIRECTORY,
        status: ContactRequestStatus.PENDING,
      }),
    );
    // V3 §33: CONTACT_REQUEST. Se dice quién, no se expone nada más.
    const nombre = (await this.namesOf([requesterProfileId])).get(requesterProfileId) ?? 'Un estudiante';
    await this.avisar({
      userId: destino.userId,
      kind: 'CONTACT_REQUEST',
      title: 'Nueva solicitud de contacto',
      body: `${nombre} quiere agregarte como contacto.`,
      link: '/student/collaboration',
      entityType: 'contact_request',
      entityId: guardada.id,
      dedupeKey: `contact-request:${guardada.id}`,
    });
    return guardada;
  }

  /** Solicitudes que le llegaron, pendientes de responder. */
  async received(studentProfileId: string) {
    const filas = await this.requests.find({
      where: { targetProfileId: studentProfileId, status: ContactRequestStatus.PENDING },
      relations: { requester: { user: true } },
      order: { createdAt: 'DESC' },
    });
    return filas.map((r) => this.vistaSolicitud(r, 'requester'));
  }

  /** Solicitudes que envió y siguen sin respuesta. */
  async sent(studentProfileId: string) {
    const filas = await this.requests.find({
      where: { requesterProfileId: studentProfileId, status: ContactRequestStatus.PENDING },
      relations: { target: { user: true } },
      order: { createdAt: 'DESC' },
    });
    return filas.map((r) => this.vistaSolicitud(r, 'target'));
  }

  /**
   * Acepta o rechaza. Solo el destinatario decide.
   *
   * Aceptar crea el contacto en la misma transacción: si la solicitud quedara
   * aceptada sin contacto, las dos personas verían un estado que no existe.
   */
  async decide(
    studentProfileId: string,
    requestId: string,
    decision: 'accept' | 'reject',
  ) {
    const solicitud = await this.requests.findOne({ where: { id: requestId } });
    // 404 y no 403: quien no es el destinatario no tiene por qué enterarse de
    // que la solicitud existe.
    if (!solicitud || solicitud.targetProfileId !== studentProfileId) {
      throw new NotFoundException('Solicitud no encontrada.');
    }
    if (solicitud.status !== ContactRequestStatus.PENDING) {
      throw new ConflictException('Esa solicitud ya fue respondida.');
    }

    solicitud.status =
      decision === 'accept' ? ContactRequestStatus.ACCEPTED : ContactRequestStatus.REJECTED;
    solicitud.decidedAt = new Date();

    await this.dataSource.transaction(async (manager) => {
      await manager.save(ContactRequest, solicitud);
      if (decision !== 'accept') return;
      const [profileAId, profileBId] = this.pareja(
        solicitud.requesterProfileId,
        solicitud.targetProfileId,
      );
      await manager
        .createQueryBuilder()
        .insert()
        .into(Contact)
        .values({ profileAId, profileBId, source: solicitud.source })
        .orIgnore()
        .execute();
    });

    if (decision === 'accept') {
      const yo = await this.profiles.findOne({ where: { id: studentProfileId }, select: { id: true, userId: true } });
      await this.audit.record({
        actorUserId: yo?.userId ?? null,
        eventType: AuditEventType.CONTACT_ACCEPTED,
        entityType: 'contact_request',
        entityId: solicitud.id,
        metadata: { origen: solicitud.source },
      });
    }
    return { status: solicitud.status, decidedAt: solicitud.decidedAt };
  }

  /** Quien envió una solicitud puede retirarla mientras nadie la respondió. */
  async cancel(studentProfileId: string, requestId: string) {
    const solicitud = await this.requests.findOne({ where: { id: requestId } });
    if (!solicitud || solicitud.requesterProfileId !== studentProfileId) {
      throw new NotFoundException('Solicitud no encontrada.');
    }
    if (solicitud.status !== ContactRequestStatus.PENDING) {
      throw new ConflictException('Esa solicitud ya fue respondida.');
    }
    solicitud.status = ContactRequestStatus.CANCELLED;
    solicitud.decidedAt = new Date();
    await this.requests.save(solicitud);
    return { status: solicitud.status };
  }

  /** Los contactos del estudiante, mirando los dos extremos de la pareja. */
  async list(studentProfileId: string) {
    const filas = await this.contacts.find({
      where: [{ profileAId: studentProfileId }, { profileBId: studentProfileId }],
      relations: { profileA: { user: true }, profileB: { user: true } },
      order: { createdAt: 'DESC' },
    });

    const otros = filas.map((c) => (c.profileAId === studentProfileId ? c.profileBId : c.profileAId));
    const [canales, notas]: [StudentContactChannel[], ContactNote[]] = await Promise.all([
      otros.length
        ? this.channels.find({ where: { studentProfileId: In(otros) }, order: { channel: 'ASC' } })
        : Promise.resolve([]),
      filas.length
        ? this.notes.find({ where: { contactId: In(filas.map((c) => c.id)), ownerProfileId: studentProfileId } })
        : Promise.resolve([]),
    ]);

    return filas.map((c) => {
      const otro = c.profileAId === studentProfileId ? c.profileB : c.profileA;
      const nota = notas.find((n) => n.contactId === c.id);
      return {
        contactId: c.id,
        profileId: otro.id,
        name: otro.user ? `${otro.user.firstName} ${otro.user.lastName}` : 'Estudiante',
        semester: otro.semester,
        availability: otro.availability,
        source: c.source,
        since: c.createdAt,
        // §59: los contactos aceptados ven todos los canales que la otra
        // persona compartió; el correo institucional, nunca por omisión.
        channels: canales.filter((k) => k.studentProfileId === otro.id).map(channelView),
        // §56: la nota es de quien consulta, no de la pareja.
        note: nota
          ? { alias: nota.alias, context: nota.context, preferredChannel: nota.preferredChannel }
          : { alias: null, context: null, preferredChannel: null },
      };
    });
  }

  /** Perfiles con los que ya hay contacto. */
  async contactIdsOf(studentProfileId: string): Promise<Set<string>> {
    const filas = await this.contacts.find({
      where: [{ profileAId: studentProfileId }, { profileBId: studentProfileId }],
      select: { profileAId: true, profileBId: true },
    });
    return new Set(
      filas.map((c) => (c.profileAId === studentProfileId ? c.profileBId : c.profileAId)),
    );
  }

  /** Deshacer un contacto es cosa de cualquiera de los dos. */
  async remove(studentProfileId: string, otherProfileId: string) {
    const [profileAId, profileBId] = this.pareja(studentProfileId, otherProfileId);
    const contacto = await this.contacts.findOne({ where: { profileAId, profileBId } });
    if (!contacto) {
      throw new NotFoundException('No existe ese contacto.');
    }
    await this.contacts.delete({ id: contacto.id });
    return { removed: true };
  }

  /** Nombres de varios perfiles, para listar sin exponer el correo (§44). */
  async namesOf(profileIds: string[]): Promise<Map<string, string>> {
    if (profileIds.length === 0) return new Map();
    const filas = await this.profiles.find({
      where: { id: In(profileIds) },
      relations: { user: true },
    });
    return new Map(
      filas.map((p) => [
        p.id,
        p.user ? `${p.user.firstName} ${p.user.lastName}` : 'Estudiante',
      ]),
    );
  }

  private vistaSolicitud(r: ContactRequest, lado: 'requester' | 'target') {
    const otro = lado === 'requester' ? r.requester : r.target;
    return {
      id: r.id,
      status: r.status,
      message: r.message,
      source: r.source,
      createdAt: r.createdAt,
      student: {
        profileId: otro?.id ?? null,
        name: otro?.user ? `${otro.user.firstName} ${otro.user.lastName}` : 'Estudiante',
        semester: otro?.semester ?? null,
      },
    };
  }
}
