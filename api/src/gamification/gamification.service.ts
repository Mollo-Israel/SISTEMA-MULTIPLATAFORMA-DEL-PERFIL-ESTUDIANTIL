import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, In, Repository } from 'typeorm';
import {
  ActivityReviewStatus,
  GAMIFICATION_TRIGGER_LABEL,
  SYSTEM_GAMIFICATION_TRIGGERS,
  GamificationTrigger,
  PUBLISHABLE_REVIEW_STATUSES,
  RegistrationStatus,
} from '@perfil/shared';
import { ActivityRegistration } from '../entities/activity-registration.entity';
import { AffinityResult } from '../entities/affinity-result.entity';
import { Project } from '../entities/project.entity';
import { ProjectMember } from '../entities/project-member.entity';
import { StudentProfile } from '../entities/student-profile.entity';
import { Contact, TeamMember } from '../entities/collaboration.entity';
import { GamificationCriterion } from '../entities/gamification-criterion.entity';
import { ActivityGamificationRule } from '../entities/activity-review.entity';
import {
  Badge,
  GamificationEvent,
  StudentBadge,
  StudentPoints,
} from '../entities/gamification.entity';

/** Un hecho a reconocer, ya identificado. */
interface Hecho {
  trigger: GamificationTrigger;
  /** Identidad del hecho. Dos veces el mismo hecho es un solo evento. */
  dedupeKey: string;
  reason: string;
  sourceEntityType: string | null;
  sourceEntityId: string | null;
  /** Área del hecho, para aplicar un criterio limitado a esa área. */
  areaId?: string | null;
  /** Puntos fijados por una regla de la actividad (V2 §31.2); mandan sobre el criterio. */
  fixedPoints?: number;
  /** Insignia que la regla de la actividad otorga con el hecho. */
  badgeId?: string | null;
  /** V5 §10.3: criterio elegido por la actividad, si eligió uno. */
  criterionId?: string | null;
  /** V5 §10.3: quién hizo que el hecho ocurra (p. ej. quien confirmó la asistencia). */
  awardedBy?: string | null;
}

/**
 * Gamificación (§66).
 *
 * §66 abre con la frase que lo gobierna todo: **es independiente de la
 * afinidad**, y nunca `puntos → afinidad`. Este servicio *lee* la trayectoria
 * del estudiante para reconocer lo que hizo; el motor de afinidad no lee nada
 * de aquí, y no hay ninguna llamada en esa dirección.
 *
 * ## Cómo se garantiza la idempotencia
 *
 * §66 la exige. El sistema no lleva la cuenta de lo que ya procesó: **deriva**
 * los hechos del estado actual y los inserta con `ON CONFLICT DO NOTHING` sobre
 * `(perfil, clave)`. Correr esto una vez o cien da lo mismo, y eso vale también
 * cuando dos recálculos se solapan o cuando un despliegue repite una operación.
 *
 * La alternativa habitual —un contador que se incrementa al ocurrir el hecho—
 * es idempotente solo mientras nadie repita la llamada, que es justo lo que
 * §66 quiere descartar.
 */
@Injectable()
export class GamificationService {
  private readonly logger = new Logger(GamificationService.name);

  constructor(
    private readonly dataSource: DataSource,
    @InjectRepository(GamificationEvent)
    private readonly events: Repository<GamificationEvent>,
    @InjectRepository(StudentPoints) private readonly points: Repository<StudentPoints>,
    @InjectRepository(Badge) private readonly badges: Repository<Badge>,
    @InjectRepository(StudentBadge) private readonly studentBadges: Repository<StudentBadge>,
    @InjectRepository(ActivityGamificationRule)
    private readonly activityRules: Repository<ActivityGamificationRule>,
    @InjectRepository(StudentProfile) private readonly profiles: Repository<StudentProfile>,
    @InjectRepository(ActivityRegistration)
    private readonly registrations: Repository<ActivityRegistration>,
    @InjectRepository(Project) private readonly projects: Repository<Project>,
    @InjectRepository(ProjectMember) private readonly members: Repository<ProjectMember>,
    @InjectRepository(AffinityResult) private readonly affinities: Repository<AffinityResult>,
    @InjectRepository(Contact) private readonly contacts: Repository<Contact>,
    @InjectRepository(TeamMember) private readonly teamMembers: Repository<TeamMember>,
    @InjectRepository(GamificationCriterion)
    private readonly criteria: Repository<GamificationCriterion>,
  ) {}

  /**
   * Puntos de un hecho según los criterios que administra el administrador.
   *
   * Primero el criterio limitado al área del hecho, si hay uno activo; si no,
   * el criterio general del hecho (el de código igual al hecho). Sin ninguno
   * activo, el hecho no da puntos: desactivar un criterio es la forma de
   * dejar de premiar algo. Lo ya otorgado no cambia: los puntos se copian al
   * evento en el momento en que se reconoce.
   */
  async puntosPorHecho(): Promise<(trigger: GamificationTrigger, areaId?: string | null) => number> {
    const valor = await this.criterioPorHecho();
    return (trigger, areaId) => valor(trigger, areaId).points;
  }

  /** Lo mismo, con el criterio que fija los puntos (V5 §10.3: el historial lo guarda). */
  private async criterioPorHecho(): Promise<(trigger: GamificationTrigger, areaId?: string | null) => { points: number; criterionId: string | null }> {
    // V4.1 A41-016: los extras de temporada no reemplazan el valor del hecho.
    const activos = (await this.criteria.find({ where: { isActive: true } })).filter((c) => !c.isBonus);
    return (trigger, areaId) => {
      const delArea = areaId
        ? activos.filter((c) => c.trigger === trigger && c.academicAreaId === areaId)
        : [];
      if (delArea.length > 0) {
        const mayor = delArea.reduce((a, b) => (b.points > a.points ? b : a), delArea[0]);
        return { points: mayor.points, criterionId: mayor.id };
      }
      const general = activos.find((c) => c.trigger === trigger && !c.academicAreaId && c.code === trigger);
      return { points: general?.points ?? 0, criterionId: general?.id ?? null };
    };
  }

  /**
   * Registra un hecho reconocido por una persona (un reto docente) y pone al
   * día el total y las insignias. Idempotente por su clave.
   */
  async award(
    studentProfileId: string,
    hecho: { trigger: GamificationTrigger; dedupeKey: string; reason: string; points: number;
      sourceEntityType: string | null; sourceEntityId: string | null;
      criterionId?: string | null; awardedBy?: string | null; approvedBy?: string | null },
  ): Promise<boolean> {
    const insertado = await this.dataSource.transaction(async (manager) => {
      const r = await manager
        .createQueryBuilder()
        .insert()
        .into(GamificationEvent)
        .values({ studentProfileId, ...hecho, reason: hecho.reason.slice(0, 300) })
        .orIgnore()
        .execute();
      await this.recalcularTotal(manager, studentProfileId);
      return r.identifiers.filter(Boolean).length > 0;
    });
    await this.otorgarInsignias(studentProfileId);
    return insertado;
  }

  /**
   * Pone al día los puntos de un estudiante.
   *
   * Lo llama el coordinador de §109 cada vez que cambia una señal relevante. No
   * recibe qué cambió porque no le hace falta: mira el estado y reconoce lo que
   * encuentre sin reconocer, que es lo que lo hace idempotente.
   */
  async sync(studentProfileId: string): Promise<{ nuevos: number; total: number }> {
    const perfil = await this.profiles.findOne({ where: { id: studentProfileId } });
    if (!perfil) return { nuevos: 0, total: 0 };

    // V5 §10: el motor solo reconoce la participación confirmada. Los proyectos
    // (V4.1) y los recursos completados (V5) llegan por un docente que los
    // reconoce; colaboraciones e hitos quedaron retirados. Lo ya otorgado por
    // ellos se conserva en el historial.
    const hechos = await this.participacionesConfirmadas(studentProfileId);
    const valor = await this.criterioPorHecho();
    const valoradosBase = hechos
      .map((h) => {
        const v = valor(h.trigger, h.areaId);
        return { ...h, points: h.fixedPoints ?? v.points, criterionId: h.criterionId ?? v.criterionId };
      })
      .filter((h) => h.points > 0);
    // V4.1 A41-016 (§9.3, A.10): extras de temporada vigentes hoy (Bolivia), por
    // hecho y área; cada uno se reconoce una vez por hecho (clave propia).
    const hoy = new Date().toLocaleDateString('en-CA', { timeZone: 'America/La_Paz' });
    const bonos = (await this.criteria.find({ where: { isActive: true, isBonus: true } }))
      .filter((b) => (!b.validFrom || b.validFrom <= hoy) && (!b.validUntil || b.validUntil >= hoy));
    const extras = valoradosBase.flatMap((h) => bonos
      .filter((b) => b.trigger === h.trigger && (!b.academicAreaId || b.academicAreaId === h.areaId))
      .map((b) => ({
        ...h,
        dedupeKey: `bono:${b.id}:${h.dedupeKey}`.slice(0, 120),
        reason: `Bono de temporada «${b.name}»: ${h.reason}`,
        points: b.points,
        badgeId: null,
        criterionId: b.id,
      })));
    const valorados = [...valoradosBase, ...extras];
    // Insignias que otorgan las reglas de las actividades (idempotente).
    // V6 §10.3 (ADM-08): asistir no da insignia; los puntos sí siguen.
    const insigniasDeReglas = [...new Set(hechos
      .filter((h) => h.trigger !== GamificationTrigger.PARTICIPACION_CONFIRMADA)
      .map((h) => h.badgeId).filter((b): b is string => !!b))];
    if (insigniasDeReglas.length) {
      await this.studentBadges
        .createQueryBuilder()
        .insert()
        .into(StudentBadge)
        .values(insigniasDeReglas.map((badgeId) => ({ studentProfileId, badgeId })))
        .orIgnore()
        .execute();
    }
    if (valorados.length === 0) {
      return { nuevos: 0, total: (await this.totalDe(studentProfileId)).totalPoints };
    }

    const nuevos = await this.dataSource.transaction(async (manager) => {
      const insertado = await manager
        .createQueryBuilder()
        .insert()
        .into(GamificationEvent)
        .values(
          valorados.map((h) => ({
            studentProfileId,
            trigger: h.trigger,
            dedupeKey: h.dedupeKey,
            points: h.points,
            reason: h.reason.slice(0, 300),
            sourceEntityType: h.sourceEntityType,
            sourceEntityId: h.sourceEntityId,
            criterionId: h.criterionId ?? null,
            awardedBy: h.awardedBy ?? null,
          })),
        )
        .orIgnore()
        .execute();

      await this.recalcularTotal(manager, studentProfileId);
      return insertado.identifiers.filter(Boolean).length;
    });

    await this.otorgarInsignias(studentProfileId);
    return { nuevos, total: (await this.totalDe(studentProfileId)).totalPoints };
  }

  // =========================================================================
  // §66 · Los cinco hechos que se pueden premiar
  // =========================================================================

  /** Participación confirmada por el responsable de la actividad (§23). */
  private async participacionesConfirmadas(studentProfileId: string): Promise<Hecho[]> {
    const filas = await this.registrations.find({
      where: { studentProfileId, status: RegistrationStatus.CONFIRMED },
      relations: { activity: true },
    });
    // V2 §31.2: la actividad puede fijar sus propios puntos. Solo cuentan las
    // reglas de actividades aprobadas (o de Dirección): una regla que nadie
    // revisó no reparte puntos.
    const ids = [...new Set(filas.map((r) => r.activityId))];
    const reglas = ids.length
      ? await this.activityRules.find({
          where: { activityId: In(ids), trigger: GamificationTrigger.PARTICIPACION_CONFIRMADA },
          relations: { activity: true },
        })
      : [];
    const reglaDe = new Map(
      reglas
        .filter((r) => PUBLISHABLE_REVIEW_STATUSES.includes(r.activity?.reviewStatus as ActivityReviewStatus))
        .map((r) => [r.activityId, r]),
    );
    return filas.map((r) => {
      const regla = reglaDe.get(r.activityId);
      return {
        trigger: GamificationTrigger.PARTICIPACION_CONFIRMADA,
        dedupeKey: `participacion:${r.id}`,
        reason: `Participación confirmada en «${r.activity?.title ?? 'una actividad'}»`
          + (regla ? ' (puntos de la actividad)' : ''),
        sourceEntityType: 'activity_registration',
        sourceEntityId: r.id,
        areaId: r.activity?.academicAreaId ?? null,
        fixedPoints: regla?.points,
        badgeId: regla?.badgeId ?? null,
        criterionId: regla?.criterionId ?? null,
        // V5 §10.3: otorga quien confirmó la asistencia.
        awardedBy: r.confirmedById ?? null,
      };
    });
  }

  // =========================================================================
  // Puntos e insignias
  // =========================================================================

  /**
   * Recalcula el total sumando los eventos.
   *
   * Sumar y no incrementar. Un contador que se incrementa acaba desviándose de
   * lo que explica —basta un evento borrado o una transacción a medias— y
   * entonces el número que ve el estudiante deja de corresponder a su lista.
   */
  private async recalcularTotal(
    manager: DataSource['manager'],
    studentProfileId: string,
  ): Promise<void> {
    const fila = await manager
      .createQueryBuilder(GamificationEvent, 'e')
      .select('COALESCE(SUM(e.points), 0)', 'total')
      .addSelect('COUNT(*)', 'cantidad')
      .where('e.student_profile_id = :studentProfileId', { studentProfileId })
      .getRawOne<{ total: string; cantidad: string }>();

    await manager
      .createQueryBuilder()
      .insert()
      .into(StudentPoints)
      .values({
        studentProfileId,
        totalPoints: Number(fila?.total ?? 0),
        eventsCount: Number(fila?.cantidad ?? 0),
      })
      .orUpdate(['total_points', 'events_count', 'updated_at'], ['student_profile_id'])
      .execute();
  }

  /** Otorga las insignias cuyo umbral el estudiante ya alcanzó. */
  private async otorgarInsignias(studentProfileId: string): Promise<void> {
    const [catalogo, conteos] = await Promise.all([
      this.badges.find({ where: { isActive: true } }),
      this.conteoPorDisparador(studentProfileId),
    ]);

    // V6 §10.3 (ADM-08): ninguna insignia por asistir. Las ya obtenidas se conservan.
    const merecidas = catalogo.filter(
      (b) => b.trigger !== GamificationTrigger.PARTICIPACION_CONFIRMADA && (conteos.get(b.trigger) ?? 0) >= b.threshold,
    );
    if (merecidas.length === 0) return;

    await this.studentBadges
      .createQueryBuilder()
      .insert()
      .into(StudentBadge)
      .values(merecidas.map((b) => ({ studentProfileId, badgeId: b.id })))
      .orIgnore()
      .execute();
  }

  private async conteoPorDisparador(
    studentProfileId: string,
  ): Promise<Map<GamificationTrigger, number>> {
    const filas = await this.events
      .createQueryBuilder('e')
      .select('e.trigger', 'trigger')
      .addSelect('COUNT(*)', 'cantidad')
      .where('e.student_profile_id = :studentProfileId', { studentProfileId })
      .groupBy('e.trigger')
      .getRawMany<{ trigger: GamificationTrigger; cantidad: string }>();
    return new Map(filas.map((f) => [f.trigger, Number(f.cantidad)]));
  }

  private async totalDe(studentProfileId: string): Promise<StudentPoints> {
    const fila = await this.points.findOne({ where: { studentProfileId } });
    return (
      fila
      ?? ({ studentProfileId, totalPoints: 0, eventsCount: 0 } as StudentPoints)
    );
  }

  // =========================================================================
  // Consulta
  // =========================================================================

  /**
   * Lo que el estudiante ve de su propio progreso (§134).
   *
   * Se sincroniza antes de responder: así el progreso refleja lo que hizo
   * aunque ninguna señal haya disparado el coordinador desde la última vez.
   *
   * **No hay tabla de posiciones.** §66 dice que el ranking público no es
   * obligatorio, y publicar uno convertiría un reconocimiento en una
   * comparación entre compañeros, que es lo contrario de lo que RN-15 permite
   * hacer con estos datos.
   */
  async summary(studentProfileId: string) {
    await this.sync(studentProfileId);
    const valor = await this.puntosPorHecho();

    const [total, eventos, catalogo, obtenidas, conteos] = await Promise.all([
      this.totalDe(studentProfileId),
      this.events.find({
        where: { studentProfileId },
        order: { occurredAt: 'DESC' },
        take: 50,
      }),
      this.badges.find({ where: { isActive: true }, order: { threshold: 'ASC' } }),
      this.studentBadges.find({ where: { studentProfileId } }),
      this.conteoPorDisparador(studentProfileId),
    ]);

    const obtenidasPorBadge = new Map(obtenidas.map((b) => [b.badgeId, b.awardedAt]));

    return {
      totalPoints: total.totalPoints,
      eventsCount: total.eventsCount,
      /** §66: la gamificación es independiente de la afinidad. Se dice aquí. */
      note:
        'Los puntos reconocen lo que hiciste. No influyen en tu afinidad ni en tus '
        + 'recomendaciones, y no se comparan con los de nadie.',
      // V6 §10.3: las insignias por asistir ya no se ofrecen como meta; si
      // alguien ya la tenía, se sigue mostrando como parte de su historia.
      badges: catalogo.filter((b) => b.trigger !== GamificationTrigger.PARTICIPACION_CONFIRMADA || obtenidasPorBadge.has(b.id)).map((b) => {
        const conseguidas = conteos.get(b.trigger) ?? 0;
        return {
          code: b.code,
          name: b.name,
          description: b.description,
          trigger: b.trigger,
          triggerLabel: GAMIFICATION_TRIGGER_LABEL[b.trigger] ?? b.trigger,
          threshold: b.threshold,
          progress: Math.min(conseguidas, b.threshold),
          earned: obtenidasPorBadge.has(b.id),
          earnedAt: obtenidasPorBadge.get(b.id) ?? null,
        };
      }),
      events: eventos.map((e) => ({
        id: e.id,
        trigger: e.trigger,
        triggerLabel: GAMIFICATION_TRIGGER_LABEL[e.trigger] ?? e.trigger,
        points: e.points,
        reason: e.reason,
        occurredAt: e.occurredAt,
      })),
      /** Qué puede premiarse, para que nadie tenga que adivinarlo (§66). */
      rules: SYSTEM_GAMIFICATION_TRIGGERS.map((t) => ({
        trigger: t,
        label: GAMIFICATION_TRIGGER_LABEL[t] ?? t,
        points: valor(t),
      })).filter((r) => r.points > 0),
    };
  }
}
