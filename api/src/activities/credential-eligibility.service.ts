import { Inject, Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, Repository } from 'typeorm';
import { ActivityOrigin, ActivityOutcomePolicy, RegistrationStatus } from '@perfil/shared';
import { Activity } from '../entities/activity.entity';
import { ActivityArea } from '../entities/activity-area.entity';
import { ActivitySkill } from '../entities/activity-skill.entity';
import { conModelo } from '../validation/reference-model';
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
  /**
   * V7.1 §5.2: lo que la credencial hereda de la oportunidad. El estudiante lo
   * ve en solo lectura y el servidor lo usa al guardar, sin confiar en el cuerpo.
   * Nombre esperado del certificado; si no hay, el título de la actividad.
   */
  expectedName: string;
  /** Proveedor o emisor esperado; `null` si la oportunidad no lo define. */
  expectedIssuer: string | null;
  areas: { id: string; name: string }[];
  skills: { id: string; name: string; areaId: string | null }[];
  /** V7.1 D03: con certificado modelo, la credencial se compara; sin él, va directo a Dirección. */
  hasModel: boolean;
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

  static readonly esperaCredencial = esperaCredencial;
  static readonly estadoQueHabilita = estadoQueHabilita;
  static readonly terminada = terminada;
  static readonly elegible = elegible;

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
    return this.describir(elegibles.map((r) => r.activity));
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
   * V7.1 §5.2: la oportunidad tal como la hereda la credencial, si este perfil
   * puede adjuntarla ahora. `null` si no es elegible (otra cuenta, no
   * aceptado, sin terminar): un id conocido no basta.
   */
  async oportunidadPara(studentProfileId: string, activityId: string): Promise<CredentialOpportunity | null> {
    const actividad = await this.assertEligible(studentProfileId, activityId);
    if (!actividad) return null;
    return (await this.describir([actividad]))[0] ?? null;
  }

  /** Lo que hereda una credencial de esa oportunidad, sin mirar la elegibilidad (para editar una ya enviada). */
  async descripcionDe(activityId: string): Promise<CredentialOpportunity | null> {
    const actividad = await this.registrations.manager.findOne(Activity, { where: { id: activityId } });
    return actividad ? (await this.describir([actividad]))[0] ?? null : null;
  }

  /** Nombre esperado, emisor, áreas, tecnologías y modelo de cada oportunidad. */
  private async describir(actividades: Activity[]): Promise<CredentialOpportunity[]> {
    const ids = actividades.map((a) => a.id);
    const em = this.registrations.manager;
    const [refs, areas, skills, modelos] = await Promise.all([
      this.references.find({ where: { activityId: In(ids) } }),
      em.find(ActivityArea, { where: { activityId: In(ids) }, relations: { academicArea: true } }),
      em.find(ActivitySkill, { where: { activityId: In(ids) }, relations: { skill: true }, order: { createdAt: 'ASC' } }),
      conModelo(em, ids),
    ]);
    const refDe = new Map(refs.map((x) => [x.activityId, x]));
    return actividades.map((a) => {
      const esperado = refDe.get(a.id)?.expectedCourseName?.trim() || null;
      // La principal primero, como en el resto del catálogo (V3 §12.1).
      const suyas = areas
        .filter((x) => x.activityId === a.id && x.academicArea)
        .sort((x, y) => Number(y.academicAreaId === a.academicAreaId) - Number(x.academicAreaId === a.academicAreaId))
        .map((x) => ({ id: x.academicAreaId, name: x.academicArea.name }));
      return {
        activityId: a.id,
        title: a.title,
        provider: a.provider,
        endAt: a.endAt ?? a.eventDate,
        originType: a.originType,
        expectedCourseName: esperado,
        expectedName: esperado ?? a.title,
        expectedIssuer: a.provider?.trim() || null,
        areas: suyas,
        skills: skills
          .filter((x) => x.activityId === a.id && x.skill)
          .map((x) => ({ id: x.skillId, name: x.skill.name, areaId: x.academicAreaId })),
        hasModel: modelos.has(a.id),
      };
    });
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
