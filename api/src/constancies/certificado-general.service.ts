import { Inject, Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ActivityOutcomePolicy, ActivityStatus, ConstancyStatus, RegistrationStatus, RolNombre } from '@perfil/shared';
import { Activity } from '../entities/activity.entity';
import { ActivityRegistration } from '../entities/activity-registration.entity';
import { InternalConstancy } from '../entities/internal-constancy.entity';
import { StoredFileRecord } from '../entities/stored-file.entity';
import { AuditEventType, AuditService } from '../audit/audit.service';
import { NOTIFICATION_EMITTER, NotificationEmitter } from '../notifications/notification.port';
import { TRAJECTORY_RECALCULATION, TrajectoryRecalculationPort } from '../trajectory/trajectory-recalculation.port';

/** Por qué todavía no se entregó el certificado general (§6.3). */
export type PendienteGeneral =
  | 'no_es_general'
  | 'falta_fin_o_cierre'
  | 'falta_archivo'
  | 'falta_emisor';

export interface ResultadoGeneral {
  entregados: number;
  yaTenian: number;
  pendiente: PendienteGeneral | null;
  mensaje: string;
}

const MENSAJE: Record<PendienteGeneral, string> = {
  no_es_general: 'La actividad no entrega un certificado general.',
  falta_fin_o_cierre: 'Se entrega solo cuando la actividad termina y su lista de asistencia está cerrada.',
  falta_archivo: 'Falta el archivo real del certificado general: no se fabrica ningún documento. Súbelo y se entregará.',
  falta_emisor: 'Falta indicar quién emite el certificado.',
};

/**
 * V7.1 D05 · Entrega del certificado institucional GENERAL.
 *
 * Al cumplirse las dos condiciones —la actividad FINISHED y la lista de
 * asistencia cerrada—, el archivo real común se entrega a cada asistente
 * CONFIRMED, sin otro clic. Lo disparan el cierre de la lista, el fin
 * (automático o manual) y la carga tardía del archivo. Es idempotente: quien
 * ya tiene su certificado no recibe otro ni cambia el suyo. Sin archivo, queda
 * pendiente y se dice por qué; nunca se fabrica un PDF. Los ausentes, los
 * no admitidos y los externos no reciben nada por este camino.
 */
@Injectable()
export class CertificadoGeneralService {
  private readonly logger = new Logger(CertificadoGeneralService.name);

  constructor(
    @InjectRepository(Activity) private readonly activities: Repository<Activity>,
    @InjectRepository(ActivityRegistration) private readonly registrations: Repository<ActivityRegistration>,
    @InjectRepository(InternalConstancy) private readonly constancies: Repository<InternalConstancy>,
    @InjectRepository(StoredFileRecord) private readonly files: Repository<StoredFileRecord>,
    private readonly audit: AuditService,
    @Inject(NOTIFICATION_EMITTER) private readonly notifications: NotificationEmitter,
    @Inject(TRAJECTORY_RECALCULATION) private readonly trajectory: TrajectoryRecalculationPort,
  ) {}

  /** ¿Qué falta para entregar? `null` si ya se puede. */
  pendienteDe(a: Activity, hayArchivo: boolean): PendienteGeneral | null {
    if (a.outcomePolicy !== ActivityOutcomePolicy.INSTITUTION_ISSUED_CERTIFICATE || a.certificateMode !== 'general') return 'no_es_general';
    if (a.status !== ActivityStatus.FINISHED || a.attendanceStatus !== 'locked') return 'falta_fin_o_cierre';
    if (!a.certificateIssuer?.trim()) return 'falta_emisor';
    if (!hayArchivo) return 'falta_archivo';
    return null;
  }

  /** Entrega a los confirmados que todavía no lo tienen, si ya corresponde. */
  async entregarSiCorresponde(activityId: string, actorUserId: string | null): Promise<ResultadoGeneral> {
    const a = await this.activities.findOne({ where: { id: activityId } });
    if (!a) return { entregados: 0, yaTenian: 0, pendiente: 'no_es_general', mensaje: MENSAJE.no_es_general };
    const archivo = a.generalCertificateFileId ? await this.files.findOne({ where: { id: a.generalCertificateFileId } }) : null;
    const pendiente = this.pendienteDe(a, !!archivo);
    if (pendiente) return { entregados: 0, yaTenian: 0, pendiente, mensaje: MENSAJE[pendiente] };

    const confirmadas = await this.registrations.find({
      where: { activityId, status: RegistrationStatus.CONFIRMED },
      relations: { studentProfile: true },
    });
    const emisor = actorUserId ?? a.attendanceClosedById ?? a.responsibleUserId ?? a.creatorId;
    let entregados = 0;
    let yaTenian = 0;
    for (const reg of confirmadas) {
      // Una por estudiante y actividad, aunque dos disparadores lleguen a la vez.
      const nuevo = await this.constancies.manager.transaction(async (em) => {
        await em.query(`SELECT 1 FROM "activity_registrations" WHERE "id" = $1 FOR UPDATE`, [reg.id]);
        const previo = await em.findOne(InternalConstancy, { where: { studentProfileId: reg.studentProfileId, activityId } });
        if (previo) return null;
        return em.save(em.create(InternalConstancy, {
          studentProfileId: reg.studentProfileId,
          activityId,
          activityRegistrationId: reg.id,
          kind: 'institution_certificate',
          status: ConstancyStatus.AUTHORIZED,
          description: `Certificado de «${a.title}»`.slice(0, 300),
          issuerName: a.certificateIssuer,
          storedFileId: archivo!.id,
          issuedById: emisor,
          authorizedById: a.reviewedById ?? emisor,
          deliveredAt: new Date(),
          version: 1,
          previousVersions: [],
        }));
      });
      if (!nuevo) { yaTenian += 1; continue; }
      entregados += 1;
      await this.audit.record({
        actorUserId,
        eventType: AuditEventType.CONSTANCY_ISSUED,
        entityType: 'internal_constancy',
        entityId: nuevo.id,
        metadata: { kind: 'institution_certificate', modo: 'general', automatico: actorUserId === null || undefined, activityId, issuer: a.certificateIssuer },
      });
      try {
        await this.notifications.emit({
          userId: reg.studentProfile.userId,
          kind: 'CERTIFICATE_DELIVERED',
          title: 'Recibiste un certificado',
          body: `${a.certificateIssuer} emitió tu certificado de «${a.title}». Ya está en tu trayectoria.`,
          link: '/student/evidences?tab=constancias',
          entityType: 'internal_constancy',
          entityId: nuevo.id,
          dedupeKey: `certificate:${nuevo.id}`,
        });
      } catch {
        // El aviso no frena la entrega.
      }
      await this.trajectory.requestRecalculation(reg.studentProfileId);
    }
    if (entregados) this.logger.log(`Certificado general de ${activityId}: ${entregados} entregado(s), ${yaTenian} ya lo tenían.`);
    return {
      entregados, yaTenian, pendiente: null,
      mensaje: entregados ? `Se entregó a ${entregados} asistente(s) confirmado(s).` : 'Todos los confirmados ya lo tenían.',
    };
  }

  /** Para la interfaz: estado del certificado general sin entregar nada. */
  async estado(a: Activity): Promise<{ pendiente: PendienteGeneral | null; mensaje: string | null; archivo: string | null }> {
    const archivo = a.generalCertificateFileId ? await this.files.findOne({ where: { id: a.generalCertificateFileId } }) : null;
    const pendiente = this.pendienteDe(a, !!archivo);
    return { pendiente, mensaje: pendiente ? MENSAJE[pendiente] : null, archivo: archivo?.originalFilename ?? null };
  }
}

/** Quién puede entregar o configurar un certificado institucional. */
export function puedeEntregar(role: string): boolean {
  return role !== RolNombre.ADMIN;
}
