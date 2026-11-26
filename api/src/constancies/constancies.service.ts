import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, IsNull, Repository } from 'typeorm';
import {
  ActivityOutcomePolicy,
  ActivityReviewStatus,
  ActivityStatus,
  ConstancyStatus,
  PUBLISHABLE_REVIEW_STATUSES,
  RegistrationStatus,
  RolNombre,
} from '@perfil/shared';
import { InternalConstancy } from '../entities/internal-constancy.entity';
import { StudentProfile } from '../entities/student-profile.entity';
import { Activity } from '../entities/activity.entity';
import { ActivityRegistration } from '../entities/activity-registration.entity';
import { AuthenticatedUser } from '../auth/types/authenticated-user';
import { TeacherScopeService } from '../access/teacher-scope.service';
import { CreateInternalConstancyDto } from './dto/create-internal-constancy.dto';
import {
  TRAJECTORY_RECALCULATION,
  TrajectoryRecalculationPort,
} from '../trajectory/trajectory-recalculation.port';
import { AuditEventType, AuditService } from '../audit/audit.service';
import { NOTIFICATION_EMITTER, NotificationEmitter } from '../notifications/notification.port';
import { FILES_ROUTE } from '../storage/local-storage.driver';
import { CertificadoGeneralService } from './certificado-general.service';


@Injectable()
export class ConstanciesService {
  constructor(
    @InjectRepository(InternalConstancy)
    private readonly constancies: Repository<InternalConstancy>,
    @InjectRepository(StudentProfile) private readonly profiles: Repository<StudentProfile>,
    @InjectRepository(Activity) private readonly activities: Repository<Activity>,
    @InjectRepository(ActivityRegistration)
    private readonly registrations: Repository<ActivityRegistration>,
    private readonly teacherScope: TeacherScopeService,
    @Inject(TRAJECTORY_RECALCULATION)
    private readonly trajectory: TrajectoryRecalculationPort,
    private readonly audit: AuditService,
    @Inject(NOTIFICATION_EMITTER) private readonly notifications: NotificationEmitter,
    private readonly certificadoGeneral: CertificadoGeneralService,
  ) {}

  /**
   * Constancia interna (RF12), hoy solo de consulta.
   *
   * V5 §1.2 y §7.2: Afinia no emite documentos nuevos con apariencia oficial.
   * Se conservan las validaciones (quién puede pedirla, participación
   * confirmada) para que el motivo del rechazo sea claro, y una constancia
   * ya emitida se devuelve tal cual: es historia y no se borra.
   */
  async create(
    authorizer: AuthenticatedUser,
    dto: CreateInternalConstancyDto,
  ): Promise<InternalConstancy> {
    const profile = await this.profiles.findOne({ where: { id: dto.profileId } });
    if (!profile) {
      throw new BadRequestException('El perfil del estudiante no existe.');
    }

    const activity = await this.activities.findOne({
      where: { id: dto.activityId },
      relations: { creator: { role: true } },
    });
    if (!activity) {
      throw new BadRequestException('La actividad indicada no existe.');
    }
    // V2 §30: emite Dirección, o el responsable de la actividad cuando
    // Dirección la aprobó con constancias habilitadas. La administración es
    // técnica y no otorga constancias académicas (§6.5). Menor privilegio:
    // primero el permiso, después los detalles de la actividad.
    const esDireccion = authorizer.role === RolNombre.CAREER_DIRECTOR;
    const esResponsable = activity.creatorId === authorizer.userId || activity.responsibleUserId === authorizer.userId;
    if (!esDireccion && !esResponsable) {
      throw new ForbiddenException('Solo Dirección o el responsable de la actividad emiten su constancia.');
    }
    this.assertActivityAuthorized(activity);

    const registration = await this.registrations.findOne({
      where: { activityId: dto.activityId, studentProfileId: dto.profileId },
    });
    if (!registration) {
      throw new BadRequestException(
        'El estudiante no tiene participación registrada en esta actividad.',
      );
    }
    if (registration.status !== RegistrationStatus.CONFIRMED) {
      throw new BadRequestException(
        'Solo se emite constancia cuando la participación del estudiante está confirmada.',
      );
    }

    // Una constancia ya emitida es historia: se devuelve tal cual.
    const existente = await this.constancies.findOne({
      where: { studentProfileId: dto.profileId, activityId: dto.activityId },
    });
    if (existente?.status === ConstancyStatus.AUTHORIZED) return this.findOneOrFail(existente.id);

    // V5 §1.2, §7.2: Afinia registra la participación; no emite documentos
    // nuevos con apariencia oficial mientras Dirección no defina su política
    // (ND-01). Un documento que emita la institución se registra con su
    // emisor real («certificado emitido por la institución»).
    throw new ForbiddenException({
      code: 'CONSTANCY_ISSUANCE_DISABLED',
      message: 'Afinia ya no emite constancias: la asistencia confirmada queda registrada en la trayectoria del estudiante. '
        + 'Si la institución emite un documento, regístralo desde la actividad con su emisor real.',
    });
  }

  /**
   * "Actividad autorizada por la carrera" (RN-11, Tabla 2.21, Figura 2.24).
   *
   * El documento exige que la constancia solo se emita sobre una actividad
   * autorizada, pero no define un tramite de autorizacion aparte ni un actor que
   * la conceda. Para este proyecto una actividad esta autorizada cuando:
   *
   *   1. fue publicada, es decir salio de borrador y no esta cancelada; y
   *   2. la gestiona el actor institucional que corresponde a su tipo:
   *      academica -> director de carrera, extracurricular -> sociedad
   *      cientifica, o el administrador como soporte.
   *
   * Es una condicion derivada de datos que ya existen, no un modulo nuevo:
   * publicar una actividad siendo el responsable de su tipo ES el acto de
   * autorizacion dentro del alcance del sistema.
   */
  private assertActivityAuthorized(activity: Activity): void {
    if (activity.status === ActivityStatus.DRAFT) {
      throw new BadRequestException(
        'La actividad está en borrador: no está autorizada para emitir constancias.',
      );
    }
    if (activity.status === ActivityStatus.CANCELLED) {
      throw new BadRequestException(
        'La actividad fue cancelada: no está autorizada para emitir constancias.',
      );
    }
    // V2 §27.6 y §30: autorizada = publicada tras pasar (o no necesitar) la
    // revisión de Dirección, y con las constancias habilitadas en la actividad.
    if (!PUBLISHABLE_REVIEW_STATUSES.includes(activity.reviewStatus as ActivityReviewStatus)) {
      throw new BadRequestException('La actividad no fue aprobada por Dirección: no emite constancias.');
    }
    if (!activity.internalConstancyEnabled) {
      throw new BadRequestException({
        message: 'Esta actividad no tiene habilitadas las constancias internas.',
        fields: { activityId: ['Esta actividad no tiene habilitadas las constancias internas.'] },
      });
    }
  }

  /** Candidatos a constancia: participaciones confirmadas sin constancia previa. */
  /**
   * ¿Puede esta persona entregar documentos de esta actividad? Dirección, su
   * creador o uno de sus responsables (V3.2 §16). Cambiar el id en la URL no
   * alcanza: se comprueba siempre en el servidor.
   */
  private async gestiona(user: AuthenticatedUser, activity: Activity): Promise<boolean> {
    if (user.role === RolNombre.CAREER_DIRECTOR || user.role === RolNombre.ADMIN) return true;
    if (activity.creatorId === user.userId || activity.responsibleUserId === user.userId) return true;
    const filas = await this.activities.manager.query(
      `SELECT 1 FROM "activity_responsibles" WHERE "activity_id" = $1 AND "user_id" = $2`,
      [activity.id, user.userId],
    );
    return filas.length > 0;
  }

  async findEligible(activityId: string, user?: AuthenticatedUser) {
    const activity = await this.activities.findOne({
      where: { id: activityId },
      relations: { creator: { role: true } },
    });
    if (!activity) {
      throw new NotFoundException('Actividad no encontrada.');
    }
    // V3.2: antes cualquier docente listaba los confirmados de cualquier actividad.
    if (user && !(await this.gestiona(user, activity))) {
      throw new NotFoundException('Actividad no encontrada.');
    }
    if (activity.outcomePolicy === ActivityOutcomePolicy.INSTITUTION_ISSUED_CERTIFICATE) {
      return this.confirmadosConDocumento(activity);
    }
    // V5 §7.2: «Participaciones confirmadas» es una consulta de quién asistió,
    // en cualquier actividad que gestione: ya no es la lista de candidatos a
    // una constancia (Afinia no las emite), así que no exige tenerlas habilitadas.
    const confirmed = await this.registrations.find({
      where: { activityId, status: RegistrationStatus.CONFIRMED },
      relations: { studentProfile: { user: true } },
      order: { createdAt: 'ASC' },
    });
    const existing = await this.constancies.find({ where: { activityId } });
    const alreadyIssued = new Set(existing.map((c) => c.studentProfileId));

    return confirmed.map((r) => ({
      studentProfileId: r.studentProfileId,
      studentName: r.studentProfile?.user
        ? `${r.studentProfile.user.firstName} ${r.studentProfile.user.lastName}`
        : null,
      semester: r.studentProfile?.semester ?? null,
      registrationId: r.id,
      hasConstancy: alreadyIssued.has(r.studentProfileId),
    }));
  }

  /** Confirmados de una actividad, marcando quién ya recibió su documento. */
  private async confirmadosConDocumento(activity: Activity) {
    const confirmed = await this.registrations.find({
      where: { activityId: activity.id, status: RegistrationStatus.CONFIRMED },
      relations: { studentProfile: { user: true } },
      order: { createdAt: 'ASC' },
    });
    const existing = await this.constancies.find({ where: { activityId: activity.id } });
    const deEstudiante = new Map(existing.map((c) => [c.studentProfileId, c]));
    return confirmed.map((r) => {
      const doc = deEstudiante.get(r.studentProfileId);
      return {
        studentProfileId: r.studentProfileId,
        studentName: r.studentProfile?.user ? `${r.studentProfile.user.firstName} ${r.studentProfile.user.lastName}` : null,
        semester: r.studentProfile?.semester ?? null,
        registrationId: r.id,
        hasConstancy: !!doc,
        // V7.1 §6.3: «Entregado» con su fecha en lugar del botón de entregar.
        deliveredAt: doc ? doc.deliveredAt ?? doc.createdAt : null,
        version: doc?.version ?? null,
        hasFile: !!doc?.storedFileId,
      };
    });
  }

  /**
   * V3.2 §28.3: el responsable entrega el certificado que emitió la
   * institución a los confirmados que decida. Afinia lo registra con su
   * emisor real —no se atribuye la autoría— y el estudiante no lo vuelve a
   * subir. Un archivo común (plantilla) o ninguno; el código de verificación
   * es opcional. Volver a entregar actualiza el archivo o el código.
   */
  /** Quién entrega y en qué actividad se puede entregar un certificado institucional. */
  private assertEntregaPosible(user: AuthenticatedUser, activity: Activity): void {
    if (user.role === RolNombre.ADMIN) {
      throw new ForbiddenException('Administración no entrega documentos académicos: lo hace el responsable o Dirección.');
    }
    if (activity.outcomePolicy !== ActivityOutcomePolicy.INSTITUTION_ISSUED_CERTIFICATE) {
      throw new BadRequestException('Esta actividad no entrega un certificado institucional.');
    }
    // V7.1 §6.3 (DOC-03): el certificado se entrega cuando la actividad terminó.
    if (activity.status !== ActivityStatus.FINISHED) {
      throw new ConflictException({ code: 'CERTIFICATE_ACTIVITY_NOT_FINISHED', message: 'El certificado se entrega cuando la actividad terminó.' });
    }
    if (!activity.certificateIssuer?.trim()) {
      throw new BadRequestException({
        message: 'Indica primero quién emite el certificado.',
        fields: { certificateIssuer: ['Indica primero quién emite el certificado.'] },
      });
    }
  }

  /** El archivo del certificado tiene que haberlo subido quien lo entrega. */
  private async assertArchivoPropio(user: AuthenticatedUser, storedFileId: string): Promise<void> {
    const archivo = await this.activities.manager.query(
      `SELECT "uploaded_by_user_id", "mime_type_detected" FROM "stored_files" WHERE "id" = $1`,
      [storedFileId],
    );
    if (!archivo.length || archivo[0].uploaded_by_user_id !== user.userId) {
      const msg = 'El certificado tiene que ser un archivo que hayas subido tú.';
      throw new BadRequestException({ message: msg, fields: { storedFileId: [msg] } });
    }
  }

  /**
   * V3.2 §28.3 y V7.1 D05: el responsable entrega el certificado que emitió la
   * institución. Afinia lo registra con su emisor real (no se atribuye la
   * autoría) y el estudiante no lo vuelve a subir.
   *
   *  - GENERAL: no se elige a nadie ni se sube nada aquí. Se entrega el
   *    archivo común a todos los confirmados, si la actividad terminó y la
   *    lista está cerrada (lo mismo que hace solo el sistema).
   *  - INDIVIDUAL: un estudiante y su propio archivo por entrega. El mismo
   *    archivo no se entrega a dos personas.
   *  - Sin modo (anterior a V7.1): como antes, a los confirmados elegidos.
   *
   * Reintentar no duplica. Un certificado ya entregado no cambia en silencio:
   * reemplazarlo exige motivo y deja la versión anterior en el historial.
   */
  async deliverInstitutionCertificates(
    user: AuthenticatedUser,
    activityId: string,
    dto: { profileIds?: string[]; storedFileId?: string | null; certificateCode?: string | null; replaceReason?: string },
  ) {
    const activity = await this.activities.findOne({ where: { id: activityId } });
    if (!activity || !(await this.gestiona(user, activity))) throw new NotFoundException('Actividad no encontrada.');
    this.assertEntregaPosible(user, activity);

    if (activity.certificateMode === 'general') {
      const r = await this.certificadoGeneral.entregarSiCorresponde(activityId, user.userId);
      if (r.pendiente) throw new ConflictException({ code: 'GENERAL_CERTIFICATE_PENDING', message: r.mensaje, pending: r.pendiente });
      return { delivered: r.entregados, alreadyDelivered: r.yaTenian, items: [], message: r.mensaje };
    }

    if (dto.storedFileId) await this.assertArchivoPropio(user, dto.storedFileId);
    const ids = [...new Set(dto.profileIds ?? [])];
    if (ids.length === 0) throw new BadRequestException('Elige al menos un participante confirmado.');
    if (activity.certificateMode === 'individual') {
      if (ids.length !== 1 || !dto.storedFileId) {
        const m = 'En el modo individual se entrega a un estudiante por vez, con su propio archivo.';
        throw new BadRequestException({ code: 'INDIVIDUAL_ONE_BY_ONE', message: m, fields: { storedFileId: [m] } });
      }
      const deOtro = await this.constancies.findOne({ where: { activityId, storedFileId: dto.storedFileId } });
      if (deOtro && deOtro.studentProfileId !== ids[0]) {
        const m = 'Ese archivo ya se entregó a otro estudiante: en el modo individual cada uno recibe el suyo.';
        throw new ConflictException({ code: 'INDIVIDUAL_FILE_REUSED', message: m, fields: { storedFileId: [m] } });
      }
    }
    const confirmadas = await this.registrations.find({
      where: { activityId, status: RegistrationStatus.CONFIRMED, studentProfileId: In(ids) },
      relations: { studentProfile: true },
    });
    if (confirmadas.length !== ids.length) {
      throw new BadRequestException('Solo se entrega a participantes con la participación confirmada.');
    }

    const entregados: InternalConstancy[] = [];
    let sinCambios = 0;
    for (const reg of confirmadas) {
      const previo = await this.constancies.findOne({ where: { studentProfileId: reg.studentProfileId, activityId } });
      const archivoNuevo = dto.storedFileId !== undefined ? dto.storedFileId ?? null : previo?.storedFileId ?? null;
      const codigoNuevo = dto.certificateCode !== undefined ? dto.certificateCode?.trim() || null : previo?.certificateCode ?? null;
      if (previo && previo.storedFileId === archivoNuevo && (previo.certificateCode ?? null) === codigoNuevo) {
        // Reintento: ya está entregado y no cambia nada. Sin aviso repetido.
        sinCambios += 1;
        entregados.push(previo);
        continue;
      }
      if (previo && !dto.replaceReason?.trim()) {
        throw new ConflictException({
          code: 'CERTIFICATE_ALREADY_DELIVERED',
          message: 'Ese estudiante ya recibió su certificado. Reemplazarlo es excepcional: indica el motivo y quedará la versión anterior.',
          fields: { replaceReason: ['Indica el motivo del reemplazo.'] },
        });
      }
      const doc = previo ?? this.constancies.create({
        studentProfileId: reg.studentProfileId,
        activityId,
        activityRegistrationId: reg.id,
        kind: 'institution_certificate',
        status: ConstancyStatus.AUTHORIZED,
        issuedById: user.userId,
        authorizedById: user.role === RolNombre.CAREER_DIRECTOR ? user.userId : activity.reviewedById ?? null,
        version: 1,
        previousVersions: [],
      });
      if (previo) {
        doc.previousVersions = [...(previo.previousVersions ?? []), {
          version: previo.version ?? 1, storedFileId: previo.storedFileId, certificateCode: previo.certificateCode,
          deliveredAt: previo.deliveredAt?.toISOString() ?? previo.createdAt?.toISOString() ?? null,
          replacedAt: new Date().toISOString(), replacedById: user.userId, reason: dto.replaceReason!.trim().slice(0, 300),
        }];
        doc.version = (previo.version ?? 1) + 1;
      }
      doc.kind = 'institution_certificate';
      doc.description = `Certificado de «${activity.title}»`.slice(0, 300);
      doc.issuerName = activity.certificateIssuer;
      doc.storedFileId = archivoNuevo;
      doc.certificateCode = codigoNuevo;
      doc.deliveredAt = new Date();
      const guardado = await this.constancies.save(doc);
      entregados.push(guardado);
      await this.audit.record({
        actorUserId: user.userId,
        eventType: AuditEventType.CONSTANCY_ISSUED,
        entityType: 'internal_constancy',
        entityId: guardado.id,
        metadata: {
          kind: 'institution_certificate', modo: activity.certificateMode ?? 'anterior', activityId, issuer: activity.certificateIssuer,
          version: guardado.version, reemplazo: previo ? dto.replaceReason?.trim() : undefined,
        },
      });
      try {
        await this.notifications.emit({
          userId: reg.studentProfile.userId,
          kind: 'CERTIFICATE_DELIVERED',
          title: previo ? 'Se reemplazó tu certificado' : 'Recibiste un certificado',
          body: previo
            ? `${activity.certificateIssuer} reemplazó tu certificado de «${activity.title}»: ${dto.replaceReason?.trim()}`
            : `${activity.certificateIssuer} emitió tu certificado de «${activity.title}». Ya está en tu trayectoria.`,
          link: '/student/evidences?tab=constancias',
          entityType: 'internal_constancy',
          entityId: guardado.id,
          dedupeKey: `certificate:${guardado.id}:v${guardado.version}`,
        });
      } catch {
        // el aviso no frena la entrega
      }
      await this.trajectory.requestRecalculation(reg.studentProfileId);
    }
    return { delivered: entregados.length - sinCambios, alreadyDelivered: sinCambios, items: entregados };
  }

  /**
   * V7.1 D05: el archivo real común del modo GENERAL. Queda privado hasta la
   * entrega. Si la actividad ya terminó con la lista cerrada, se entrega en el
   * acto; si no, se entregará solo al cumplirse. Una vez entregado no se cambia
   * por aquí: cada certificado se reemplaza con su motivo.
   */
  async setGeneralCertificateFile(user: AuthenticatedUser, activityId: string, storedFileId: string) {
    const activity = await this.activities.findOne({ where: { id: activityId } });
    if (!activity || !(await this.gestiona(user, activity))) throw new NotFoundException('Actividad no encontrada.');
    if (user.role === RolNombre.ADMIN) {
      throw new ForbiddenException('Administración no entrega documentos académicos: lo hace el responsable o Dirección.');
    }
    if (activity.outcomePolicy !== ActivityOutcomePolicy.INSTITUTION_ISSUED_CERTIFICATE || activity.certificateMode !== 'general') {
      throw new BadRequestException({ code: 'NOT_GENERAL_CERTIFICATE', message: 'Esta actividad no entrega un certificado general.' });
    }
    await this.assertArchivoPropio(user, storedFileId);
    const yaEntregados = await this.constancies.count({ where: { activityId, kind: 'institution_certificate' } });
    if (yaEntregados > 0 && activity.generalCertificateFileId !== storedFileId) {
      throw new ConflictException({
        code: 'GENERAL_CERTIFICATE_ALREADY_DELIVERED',
        message: 'El certificado general ya se entregó: no se cambia en silencio. Reemplaza el de cada estudiante con su motivo.',
      });
    }
    await this.activities.update({ id: activityId }, { generalCertificateFileId: storedFileId });
    await this.audit.record({
      actorUserId: user.userId,
      eventType: AuditEventType.CONSTANCY_ISSUED,
      entityType: 'activity',
      entityId: activityId,
      metadata: { kind: 'institution_certificate', modo: 'general', archivoComun: storedFileId, accion: 'archivo_configurado' },
    });
    const r = await this.certificadoGeneral.entregarSiCorresponde(activityId, user.userId);
    return { ...(await this.estadoInstitucional(user, activityId)), delivered: r.entregados };
  }

  /** V7.1 D05: modo, si falta algo y cuántos ya lo recibieron, para la interfaz del responsable. */
  async estadoInstitucional(user: AuthenticatedUser, activityId: string) {
    const activity = await this.activities.findOne({ where: { id: activityId } });
    if (!activity || !(await this.gestiona(user, activity))) throw new NotFoundException('Actividad no encontrada.');
    const confirmados = await this.registrations.count({ where: { activityId, status: RegistrationStatus.CONFIRMED } });
    const entregados = await this.constancies.count({ where: { activityId, kind: 'institution_certificate' } });
    const general = activity.certificateMode === 'general' ? await this.certificadoGeneral.estado(activity) : null;
    return {
      mode: activity.certificateMode,
      issuer: activity.certificateIssuer,
      confirmed: confirmados,
      delivered: entregados,
      generalFileName: general?.archivo ?? null,
      pending: general?.pendiente ?? null,
      pendingMessage: general?.mensaje ?? null,
    };
  }

  async findMine(userId: string): Promise<InternalConstancy[]> {
    const profile = await this.profiles.findOne({ where: { userId } });
    if (!profile) {
      throw new BadRequestException('Aún no has creado tu perfil estudiantil.');
    }
    const lista = await this.constancies.find({
      where: { studentProfileId: profile.id },
      relations: { activity: true },
      order: { createdAt: 'DESC' },
    });
    return this.conArchivo(lista);
  }

  /** V3.2 §28.3: la ruta protegida del certificado entregado, si lo hay. */
  private async conArchivo(lista: InternalConstancy[]): Promise<InternalConstancy[]> {
    const ids = lista.map((c) => c.storedFileId).filter((x): x is string => !!x);
    if (!ids.length) return lista;
    const filas: { id: string; storage_key: string }[] = await this.constancies.manager.query(
      `SELECT "id", "storage_key" FROM "stored_files" WHERE "id" = ANY($1::uuid[])`,
      [ids],
    );
    const clave = new Map(filas.map((f) => [f.id, f.storage_key]));
    return lista.map((c) => Object.assign(c, {
      fileUrl: c.storedFileId && clave.get(c.storedFileId) ? `${FILES_ROUTE}/${clave.get(c.storedFileId)}` : null,
    }));
  }

  /** Constancias de un estudiante, respetando el alcance por semestre. */
  async findByStudent(user: AuthenticatedUser, profileId: string): Promise<InternalConstancy[]> {
    await this.teacherScope.assertCanAccessProfile(user, profileId);
    return this.constancies.find({
      where: { studentProfileId: profileId },
      relations: { activity: true },
      order: { createdAt: 'DESC' },
    });
  }

  /** Constancias emitidas para una actividad. */
  async findByActivity(activityId: string): Promise<InternalConstancy[]> {
    return this.constancies.find({
      where: { activityId },
      relations: { studentProfile: { user: true }, activity: true },
      order: { createdAt: 'DESC' },
    });
  }

  private async findOneOrFail(id: string): Promise<InternalConstancy> {
    const constancy = await this.constancies.findOne({
      where: { id },
      relations: { activity: true, studentProfile: { user: true } },
    });
    if (!constancy) {
      throw new NotFoundException('Constancia no encontrada.');
    }
    return constancy;
  }

  /** Constancias sin actividad asociada (no forman parte del flujo de RF12). */
  async findOrphans(): Promise<InternalConstancy[]> {
    return this.constancies.find({ where: { activityId: IsNull() } });
  }
}
