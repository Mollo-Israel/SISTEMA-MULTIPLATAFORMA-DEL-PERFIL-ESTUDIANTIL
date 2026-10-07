import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, In, Repository } from 'typeorm';
import {
  ActivityReviewStatus,
  AffinityLevel,
  GAMIFICATION_TRIGGER_LABEL,
  SYSTEM_GAMIFICATION_TRIGGERS,
  GamificationTrigger,
  ProjectBackingTier,
  ProjectStatus,
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
    const activos = await this.criteria.find({ where: { isActive: true } });
    return (trigger, areaId) => {
      const delArea = areaId
        ? activos.filter((c) => c.trigger === trigger && c.academicAreaId === areaId)
        : [];
      if (delArea.length > 0) return Math.max(...delArea.map((c) => c.points));
      const general = activos.find((c) => c.trigger === trigger && !c.academicAreaId && c.code === trigger);
      return general?.points ?? 0;
    };
  }

  /**
   * Registra un hecho reconocido por una persona (un reto docente) y pone al
   * día el total y las insignias. Idempotente por su clave.
   */
  async award(
    studentProfileId: string,
    hecho: { trigger: GamificationTrigger; dedupeKey: string; reason: string; points: number;
      sourceEntityType: string | null; sourceEntityId: string | null },
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

    const hechos = [
      ...(await this.participacionesConfirmadas(studentProfileId)),
      ...(await this.proyectosConRespaldo(studentProfileId, perfil.userId)),
      ...(await this.colaboracionesAceptadas(studentProfileId, perfil.userId)),
      ...(await this.hitosDeTrayectoria(studentProfileId)),
    ];
    const puntos = await this.puntosPorHecho();
    const valorados = hechos
      .map((h) => ({ ...h, points: h.fixedPoints ?? puntos(h.trigger, h.areaId) }))
      .filter((h) => h.points > 0);
    // Insignias que otorgan las reglas de las actividades (idempotente).
    const insigniasDeReglas = [...new Set(hechos.map((h) => h.badgeId).filter((b): b is string => !!b))];
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
      };
    });
  }

  /**
   * Proyectos con respaldo (§66).
   *
   * Dos hechos distintos: el **primero** que deja de ser una declaración, y
   * cada uno que llega a corroborado o revisado. §66 los nombra por separado
   * porque reconocen cosas distintas: empezar a poder demostrar, y demostrar.
   *
   * Un proyecto DECLARED no da nada: §66 excluye los proyectos vacíos.
   */
  private async proyectosConRespaldo(
    studentProfileId: string,
    userId: string,
  ): Promise<Hecho[]> {
    const propios = await this.projects.find({ where: { createdByProfileId: studentProfileId } });

    // Un integrante cuenta el proyecto solo si confirmó su contribución (§33):
    // lo mismo que exige la afinidad, por la misma razón.
    const pertenencias = await this.members.find({ where: { userId } });
    const confirmadas = pertenencias.filter((m) => m.contributionConfirmedAt);
    const ajenos = confirmadas.length
      ? await this.projects.find({
          where: { id: In(confirmadas.map((m) => m.projectId)) },
        })
      : [];

    // V3 §21 / §57: un borrador no da puntos aunque tenga evidencias o un
    // repositorio que corrobore. Si diera, subir una captura a un borrador
    // sería una forma de sumar, y §57 excluye puntos por subir archivos.
    const todos = [...propios, ...ajenos.filter((p) => p.createdByProfileId !== studentProfileId)]
      .filter((p) => p.status !== ProjectStatus.DRAFT);
    const conRespaldo = todos.filter(
      (p) =>
        p.backingTier === ProjectBackingTier.SUPPORTED
        || p.backingTier === ProjectBackingTier.CORROBORATED
        || p.backingTier === ProjectBackingTier.REVIEWED,
    );
    const corroborados = todos.filter(
      (p) =>
        p.backingTier === ProjectBackingTier.CORROBORATED
        || p.backingTier === ProjectBackingTier.REVIEWED,
    );

    const hechos: Hecho[] = [];

    /*
     * «Primer proyecto respaldado» es uno por estudiante, no uno por proyecto.
     * La clave no lleva el id del proyecto: si lo llevara, el segundo proyecto
     * respaldado volvería a dar el punto del primero, y «primero» dejaría de
     * significar nada.
     */
    if (conRespaldo.length > 0) {
      const primero = conRespaldo.sort(
        (a, b) => a.createdAt.getTime() - b.createdAt.getTime(),
      )[0];
      hechos.push({
        trigger: GamificationTrigger.PRIMER_PROYECTO_RESPALDADO,
        dedupeKey: 'primer_proyecto_respaldado',
        reason: `Tu primer proyecto con respaldo: «${primero.title}»`,
        sourceEntityType: 'project',
        sourceEntityId: primero.id,
        areaId: primero.academicAreaId ?? null,
      });
    }

    for (const p of corroborados) {
      hechos.push({
        trigger: GamificationTrigger.PROYECTO_CORROBORADO,
        dedupeKey: `proyecto_corroborado:${p.id}`,
        reason: `Proyecto corroborado: «${p.title}»`,
        sourceEntityType: 'project',
        sourceEntityId: p.id,
        areaId: p.academicAreaId ?? null,
      });
    }
    return hechos;
  }

  /**
   * Colaboraciones aceptadas (§66).
   *
   * Dos formas de la misma cosa: una pertenencia a un equipo y una
   * contribución a un proyecto ajeno confirmada por su autor. En las dos,
   * alguien más tuvo que decir que sí — que es lo que separa colaborar de
   * declarar que uno colabora.
   *
   * V3 §32 / §57: un contacto ya no suma. Dos compañeros podían aceptarse
   * mutuamente sin límite para acumular puntos (spam), y la cantidad de
   * contactos no indica nada. Los puntos ya otorgados por contactos se
   * conservan: no se destruyen datos.
   */
  private async colaboracionesAceptadas(
    studentProfileId: string,
    userId: string,
  ): Promise<Hecho[]> {
    const [equipos, contribuciones] = await Promise.all([
      this.teamMembers.find({ where: { studentProfileId }, relations: { team: true } }),
      this.members.find({ where: { userId }, relations: { project: true } }),
    ]);

    const hechos: Hecho[] = [];

    equipos.forEach((m) =>
      hechos.push({
        trigger: GamificationTrigger.COLABORACION_ACEPTADA,
        dedupeKey: `equipo:${m.id}`,
        reason: `Formas parte del equipo «${m.team?.name ?? 'sin nombre'}»`,
        sourceEntityType: 'team_member',
        sourceEntityId: m.id,
      }),
    );

    contribuciones
      // La fila del responsable no es una colaboración (V2 §31: nada por autodeclararse).
      .filter((m) => m.contributionConfirmedAt && !m.isOwner)
      .forEach((m) =>
        hechos.push({
          trigger: GamificationTrigger.COLABORACION_ACEPTADA,
          dedupeKey: `contribucion:${m.id}`,
          reason: `Contribución confirmada en «${m.project?.title ?? 'un proyecto'}»`,
          sourceEntityType: 'project_member',
          sourceEntityId: m.id,
        }),
      );

    return hechos;
  }

  /**
   * Hitos de trayectoria (§66).
   *
   * El hito es que el **respaldo** de un área cruce un umbral de §54, no que
   * suba la afinidad. Premiar la afinidad sería premiar lo que uno declara;
   * premiar el respaldo es reconocer que lo que declaró se puede comprobar.
   */
  private async hitosDeTrayectoria(studentProfileId: string): Promise<Hecho[]> {
    const filas = await this.affinities.find({
      where: { studentProfileId },
      relations: { academicArea: true },
    });

    return filas
      .filter((r) => r.supportLevel === AffinityLevel.MEDIUM || r.supportLevel === AffinityLevel.HIGH)
      .map((r) => ({
        trigger: GamificationTrigger.HITO_TRAYECTORIA,
        dedupeKey: `hito:${r.academicAreaId}:${r.supportLevel}`,
        reason:
          `Tu respaldo en ${r.academicArea?.name ?? 'un área'} alcanzó nivel `
          + `${r.supportLevel === AffinityLevel.HIGH ? 'alto' : 'medio'}`,
        sourceEntityType: 'academic_area',
        sourceEntityId: r.academicAreaId,
        areaId: r.academicAreaId,
      }));
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

    const merecidas = catalogo.filter(
      (b) => (conteos.get(b.trigger) ?? 0) >= b.threshold,
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
      badges: catalogo.map((b) => {
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
