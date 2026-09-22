import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, In, Repository } from 'typeorm';
import { ContactRequestStatus, ContactSource } from '@perfil/shared';
import { StudentProfile } from '../entities/student-profile.entity';
import { Contact, ContactRequest } from '../entities/collaboration.entity';

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
  ) {}

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

    return this.requests.save(
      this.requests.create({
        requesterProfileId,
        targetProfileId: destino.id,
        message: datos.message ?? null,
        source: datos.source ?? ContactSource.DIRECTORY,
        status: ContactRequestStatus.PENDING,
      }),
    );
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

    return filas.map((c) => {
      const otro = c.profileAId === studentProfileId ? c.profileB : c.profileA;
      return {
        contactId: c.id,
        profileId: otro.id,
        name: otro.user ? `${otro.user.firstName} ${otro.user.lastName}` : 'Estudiante',
        semester: otro.semester,
        availability: otro.availability,
        source: c.source,
        since: c.createdAt,
      };
    });
  }

  /** Perfiles con los que ya hay contacto. Lo usa la mensajería (§42.1). */
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
