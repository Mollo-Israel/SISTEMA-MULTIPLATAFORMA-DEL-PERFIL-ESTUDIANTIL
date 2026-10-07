import { Inject, Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ActivityOrigin, ActivityOutcomePolicy, RegistrationStatus } from '@perfil/shared';
import { Activity } from '../entities/activity.entity';
import { ActivityRegistration } from '../entities/activity-registration.entity';
import { ExternalCertificate } from '../entities/external-certificate.entity';
import { ExternalOpportunityValidationReference } from '../entities/external-opportunity-validation-reference.entity';
import { StudentProfile } from '../entities/student-profile.entity';
import { AuditEventType, AuditService } from '../audit/audit.service';
import { NOTIFICATION_EMITTER, NotificationEmitter } from '../notifications/notification.port';
import { elegible, esperaCredencial, estadoQueHabilita, terminada } from './credential-eligibility.rules';

/** Oportunidad que ya admite que el estudiante adjunte su credencial (§15). */
export interface CredentialOpportunity {
  activityId: string;
  title: string;
  provider: string | null;
  endAt: Date | null;
  originType: ActivityOrigin;
  expectedCourseName: string | null;
}

/**
 * Elegibilidad para adjuntar una credencial de una oportunidad (V3 §15).
 *
 *   INTERESTED → REGISTERED → ACCEPTED → fecha finalizada → EVIDENCE_ELIGIBLE
 *
 * Una oportunidad entra en el selector «Adjuntar credencial» cuando:
 *   - es externa y el responsable registró que el proveedor lo aceptó, o
 *   - es interna, conduce a una credencial de un tercero (§14.2) y la
 *     participación está confirmada;
 *   - y ya terminó: `end_at` (o la fecha del evento, si no tiene fin) es
 *     pasada, o el responsable la dio por finalizada.
 *
 * Aceptado no es haber obtenido la credencial: por eso esto habilita
 * adjuntarla, no suma nada a la trayectoria.
 *
 * Se calcula al consultar, no con una tarea programada: la fecha de fin
 * puede pasar en cualquier momento y no hace falta nada que «se dispare»
 * para que el estado sea correcto.
 */
@Injectable()
export class CredentialEligibilityService {
  constructor(
    @InjectRepository(ActivityRegistration)
    private readonly registrations: Repository<ActivityRegistration>,
    @InjectRepository(ExternalCertificate)
    private readonly certificates: Repository<ExternalCertificate>,
    @InjectRepository(ExternalOpportunityValidationReference)
    private readonly references: Repository<ExternalOpportunityValidationReference>,
    @InjectRepository(StudentProfile) private readonly profiles: Repository<StudentProfile>,
    private readonly audit: AuditService,
    @Inject(NOTIFICATION_EMITTER) private readonly notifications: NotificationEmitter,
  ) {}

  static esperaCredencial = esperaCredencial;
  static estadoQueHabilita = estadoQueHabilita;
  static terminada = terminada;
  static elegible = elegible;

  /**
   * Oportunidades en las que este perfil puede adjuntar su credencial y
   * todavía no lo hizo.
   */
  async eligibleFor(studentProfileId: string): Promise<CredentialOpportunity[]> {
    const filas = await this.registrations
      .createQueryBuilder('r')
      .innerJoinAndSelect('r.activity', 'a')
      .where('r.student_profile_id = :p', { p: studentProfileId })
      .andWhere(`(
        (a.origin_type = :ext AND r.status = :acc)
        OR (a.outcome_policy = :pol AND r.status = :conf)
      )`, {
        ext: ActivityOrigin.EXTERNAL,
        acc: RegistrationStatus.ACCEPTED,
        pol: ActivityOutcomePolicy.EXTERNAL_CREDENTIAL_EXPECTED,
        conf: RegistrationStatus.CONFIRMED,
      })
      .andWhere(`NOT EXISTS (
        SELECT 1 FROM external_certificates c
         WHERE c.student_profile_id = r.student_profile_id AND c.activity_id = r.activity_id)`)
      .orderBy('COALESCE(a.end_at, a.event_date)', 'DESC', 'NULLS LAST')
      .getMany();

    const elegibles = filas.filter((r) => CredentialEligibilityService.elegible(r.activity, r.status));
    if (!elegibles.length) return [];

    const refs = await this.references.find({
      where: elegibles.map((r) => ({ activityId: r.activityId })),
    });
    const refDe = new Map(refs.map((x) => [x.activityId, x]));
    return elegibles.map((r) => ({
      activityId: r.activityId,
      title: r.activity.title,
      provider: r.activity.provider,
      endAt: r.activity.endAt ?? r.activity.eventDate,
      originType: r.activity.originType,
      expectedCourseName: refDe.get(r.activityId)?.expectedCourseName ?? null,
    }));
  }

  /** ¿Puede este perfil adjuntar ahora la credencial de esta oportunidad? */
  async assertEligible(studentProfileId: string, activityId: string): Promise<Activity | null> {
    const r = await this.registrations.findOne({
      where: { studentProfileId, activityId },
      relations: { activity: true },
    });
    if (!r || !CredentialEligibilityService.elegible(r.activity, r.status)) return null;
    return r.activity;
  }

  /**
   * Avisa que la credencial ya puede adjuntarse (§15, EXTERNAL_EVIDENCE_ENABLED).
   *
   * Se llama cuando el hecho ocurre por una acción de una persona —se
   * registra la aceptación de una oportunidad ya terminada, o el responsable
   * la da por finalizada—. Cuando simplemente pasa la fecha, la elegibilidad
   * se ve al consultar; la notificación de recordatorio la programa B16.
   */
  async announce(activity: Activity, registrations: ActivityRegistration[], actorUserId: string): Promise<void> {
    for (const r of registrations) {
      if (!CredentialEligibilityService.elegible(activity, r.status)) continue;
      const profile = r.studentProfile
        ?? await this.profiles.findOne({ where: { id: r.studentProfileId } });
      if (!profile) continue;
      await this.audit.record({
        actorUserId,
        eventType: AuditEventType.EXTERNAL_EVIDENCE_ENABLED,
        entityType: 'activity_registration',
        entityId: r.id,
        metadata: { activityId: activity.id, studentProfileId: r.studentProfileId },
      });
      try {
        await this.notifications.emit({
          userId: profile.userId,
          kind: 'EXTERNAL_EVIDENCE_AVAILABLE',
          title: 'Ya puedes adjuntar tu credencial',
          body: `Terminó «${activity.title}». Adjunta la credencial que emitió ${activity.provider ?? 'el proveedor'} para que se valide.`,
          link: '/student/evidences',
          dedupeKey: `external-evidence-enabled:${r.id}`,
        });
      } catch {
        // La notificación nunca deshace la operación de negocio.
      }
    }
  }

  /** Para el servicio de certificados: ¿ya adjuntó la de esta oportunidad? */
  async alreadyAttached(studentProfileId: string, activityId: string): Promise<boolean> {
    return this.certificates.exists({ where: { studentProfileId, activityId } });
  }
}
