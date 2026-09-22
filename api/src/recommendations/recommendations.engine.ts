import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, In, MoreThan, Repository } from 'typeorm';
import {
  ActivityModality,
  ActivityStatus,
  AffinityLevel,
  AvailabilityStatus,
  CollaborationMode,
  LearningResourceStatus,
  LearningResourceType,
  RecommendationReasonCode,
  RecommendationStatus,
  RecommendationType,
  RegistrationStatus,
  UserStatus,
} from '@perfil/shared';
import { StudentProfile } from '../entities/student-profile.entity';
import { AffinityResult } from '../entities/affinity-result.entity';
import { StudentInterest } from '../entities/student-interest.entity';
import { StudentFreeInterest } from '../entities/student-free-interest.entity';
import { StudentSkill } from '../entities/student-skill.entity';
import { AcademicArea } from '../entities/academic-area.entity';
import { Activity } from '../entities/activity.entity';
import { ActivityRegistration } from '../entities/activity-registration.entity';
import { LearningResource } from '../entities/learning-resource.entity';
import { Project } from '../entities/project.entity';
import { ProjectMember } from '../entities/project-member.entity';
import { Recommendation, RecommendationReason } from '../entities/recommendation.entity';
import {
  CATALOGUED_AS_RESOURCE_CATEGORIES,
  LEVEL_LABEL,
  RULES,
  RULES_VERSION,
  RecommendationRegime,
  SUPPORT_LABEL,
  fitsRegime,
  matchesDeclaredTerm,
  normalize,
  typeForCategory,
  typeForResource,
} from './recommendation.rules';

/** Estados de actividad que admiten inscripcion, igual que en ActivitiesService. */
const REGISTRABLE_STATUSES = [ActivityStatus.PUBLISHED, ActivityStatus.OPEN];

/** Una recomendacion calculada, antes de guardarse. */
interface Produced {
  type: RecommendationType;
  targetId: string;
  academicAreaId: string | null;
  title: string;
  description: string | null;
  targetLink: string | null;
  reasons: RecommendationReason[];
  score: number;
  /** Solo para desempatar el orden; no se guarda. */
  sortKey: string;
}

export interface GenerationResult {
  /** Falso cuando el perfil no tiene con que comparar (Tabla 2.27, flujo 2a). */
  profileSufficient: boolean;
  generatedAt: Date;
  rulesVersion: string;
  produced: number;
}

/**
 * Lo que el motor de afinidad V2 dice de un area (§49).
 *
 * Los dos puntajes viajan juntos porque §59 necesita los dos a la vez: la misma
 * afinidad pide cosas opuestas segun se pueda o no demostrar.
 */
interface AffinityInfo {
  level: AffinityLevel;
  score: number;
  supportScore: number;
  supportLevel: AffinityLevel;
}

/** Lo que el motor necesita saber del estudiante para comparar (§58). */
interface Contexto {
  profile: StudentProfile;
  affinityByArea: Map<string, AffinityInfo>;
  /** Areas donde el estudiante se inclina, en orden (§52). */
  strongAreas: string[];
  regimeByArea: Map<string, RecommendationRegime>;
  preferredByArea: Map<string, number>;
  improvementIds: Set<string>;
  areaName: Map<string, string>;
  freeInterestNames: string[];
  skillNames: string[];
  skillIds: Set<string>;
  now: Date;
}

/**
 * Motor de recomendaciones academicas (§58 a §62, RF18, RN-16).
 *
 * §58 es explicito en que **no debe operar como motor aislado**: consume la
 * afinidad, el nivel de respaldo, los intereses, las areas de mejora, las
 * actividades abiertas, el catalogo de recursos y la disponibilidad declarada.
 *
 * Sigue el flujo de la Tabla 2.27 -obtener el perfil, compararlo con lo
 * disponible, identificar lo relacionado y organizarlo por tipo- y cada
 * recomendacion responde las cuatro preguntas de §92: que se recomienda, por
 * que, que area se relaciona y que senal la origino.
 *
 * Lo que el estudiante decidio (guardar o descartar) se conserva entre
 * calculos: el motor actualiza el contenido de una recomendacion existente,
 * nunca su estado (RN-16).
 */
@Injectable()
export class RecommendationsEngine {
  constructor(
    private readonly dataSource: DataSource,
    @InjectRepository(StudentProfile) private readonly profiles: Repository<StudentProfile>,
    @InjectRepository(AffinityResult) private readonly affinities: Repository<AffinityResult>,
    @InjectRepository(StudentInterest) private readonly preferred: Repository<StudentInterest>,
    @InjectRepository(StudentFreeInterest)
    private readonly freeInterests: Repository<StudentFreeInterest>,
    @InjectRepository(StudentSkill) private readonly studentSkills: Repository<StudentSkill>,
    @InjectRepository(AcademicArea) private readonly areas: Repository<AcademicArea>,
    @InjectRepository(Activity) private readonly activities: Repository<Activity>,
    @InjectRepository(ActivityRegistration)
    private readonly registrations: Repository<ActivityRegistration>,
    @InjectRepository(LearningResource)
    private readonly resources: Repository<LearningResource>,
    @InjectRepository(Project) private readonly projects: Repository<Project>,
    @InjectRepository(ProjectMember) private readonly members: Repository<ProjectMember>,
  ) {}

  async generate(profileId: string): Promise<GenerationResult> {
    const profile = await this.profiles.findOne({ where: { id: profileId } });
    if (!profile) {
      throw new NotFoundException('Perfil no encontrado.');
    }

    // --- 2. Informacion del perfil y afinidades --------------------------
    const [affinityRows, preferredRows, freeRows, skillRows, areaRows] = await Promise.all([
      this.affinities.find({ where: { studentProfileId: profileId } }),
      this.preferred.find({ where: { studentProfileId: profileId } }),
      this.freeInterests.find({ where: { studentProfileId: profileId } }),
      this.studentSkills.find({
        where: { studentProfileId: profileId },
        relations: { skill: true },
      }),
      this.areas.find(),
    ]);
    const improvementIds = new Set(profile.improvementAreaIds ?? []);

    const sufficient =
      affinityRows.length + preferredRows.length + freeRows.length + skillRows.length +
        improvementIds.size >
      0;

    const generatedAt = new Date();

    // Tabla 2.27, flujo 2a: sin informacion no se recomienda nada. Las
    // recomendaciones anteriores dejan de estar vigentes: ya no hay perfil que
    // las respalde.
    if (!sufficient) {
      await this.persist(profileId, [], generatedAt);
      return { profileSufficient: false, generatedAt, rulesVersion: RULES_VERSION, produced: 0 };
    }

    const areaName = new Map(
      areaRows
        .filter((a) => (a as { isActive?: boolean }).isActive !== false)
        .map((a) => [a.id, a.name]),
    );

    const affinityByArea = new Map<string, AffinityInfo>(
      affinityRows.map((r) => [
        r.academicAreaId,
        {
          level: r.level,
          score: Number(r.score),
          supportScore: Number(r.supportScore ?? 0),
          supportLevel: r.supportLevel ?? AffinityLevel.LOW,
        },
      ]),
    );

    /*
     * §59 necesita saber donde se inclina el estudiante, y eso es una lectura
     * relativa. El nivel de afinidad de V2 es absoluto -y tiene que serlo, §52
     * lo exige para poder comparar en el tiempo-, pero como selector no sirve:
     * casi nadie en primeros semestres supera 25 sobre 100, y entonces ningun
     * regimen se activaria nunca para quien mas lo necesita.
     */
    const strongAreas = [...affinityByArea.entries()]
      .filter(([, a]) => a.score > 0)
      .sort(([, x], [, y]) => y.score - x.score)
      .slice(0, RULES.regime.topAreas)
      .map(([id]) => id);

    const regimeByArea = new Map<string, RecommendationRegime>();
    for (const areaId of strongAreas) {
      const info = affinityByArea.get(areaId)!;
      regimeByArea.set(
        areaId,
        info.supportLevel === AffinityLevel.LOW
          ? RecommendationRegime.BUILD_EXPERIENCE
          : RecommendationRegime.ADVANCE,
      );
    }

    const ctx: Contexto = {
      profile,
      affinityByArea,
      strongAreas,
      regimeByArea,
      preferredByArea: new Map(preferredRows.map((p) => [p.academicAreaId, p.priority])),
      improvementIds,
      areaName,
      freeInterestNames: freeRows.map((f) => f.name),
      skillNames: skillRows.filter((s) => s.skill).map((s) => s.skill.name),
      skillIds: new Set(skillRows.map((s) => s.skillId)),
      now: generatedAt,
    };

    // --- 3 y 4. Comparar con los elementos disponibles --------------------
    const { elements, availableByArea } = await this.activityCandidates(profileId, ctx);
    const resources = await this.resourceCandidates(ctx);

    for (const r of resources) {
      if (!r.academicAreaId) continue;
      availableByArea.set(r.academicAreaId, (availableByArea.get(r.academicAreaId) ?? 0) + 1);
    }

    const strengthening = this.strengtheningCandidates(ctx, availableByArea);
    const teammates = await this.teammateCandidates(ctx);

    // --- 5. Organizar por tipo, con su limite ----------------------------
    const produced = this.limitByType([
      ...elements,
      ...resources,
      ...strengthening,
      ...teammates,
    ]);
    await this.persist(profileId, produced, generatedAt);

    return {
      profileSufficient: true,
      generatedAt,
      rulesVersion: RULES_VERSION,
      produced: produced.length,
    };
  }

  // =========================================================================
  // §60 · El reparto del ranking
  // =========================================================================

  /**
   * Puntua un elemento segun el reparto de §60, sobre 100.
   *
   * Cada componente devuelve ademas su motivo legible, porque §60 cierra con
   * «mostrar siempre la razon» y §92 exige que la recomendacion diga que senal
   * la origino. Un elemento sin ningun motivo no se recomienda: seria un enlace
   * puesto ahi porque si.
   */
  private scoreElement(
    ctx: Contexto,
    areaId: string | null,
    haystack: string,
    contexto: { factor: number; label: string | null },
  ): { score: number; reasons: RecommendationReason[] } {
    const reasons: RecommendationReason[] = [];
    const name = areaId ? ctx.areaName.get(areaId) : undefined;

    // ---------------------------------------------------- 50 % afinidad
    let affinity = 0;
    if (areaId && name) {
      const info = ctx.affinityByArea.get(areaId);
      if (info && info.score > 0) {
        affinity = RULES.ranking.affinity * (info.score / 100);
        reasons.push({
          code: RecommendationReasonCode.AFFINITY_AREA,
          label:
            `Tu afinidad con ${name} es ${LEVEL_LABEL[info.level]} `
            + `(${info.score}/100)`,
          points: this.redondear(affinity),
        });
      }
    }

    // -------------------------------------------- 20 % interes explicito
    let interest = 0;

    /*
     * El interes puede llegar por varios caminos -el area declarada, un
     * interes escrito a mano, una habilidad- y todos son interes explicito del
     * estudiante, asi que comparten el mismo 20 % de §60 en vez de sumarse por
     * encima de el. Cada uno aporta lo que quepa en lo que queda, y por eso su
     * motivo lleva lo que aporto **de verdad** y no lo que la regla le
     * concederia en el vacio: de otro modo, la suma de los motivos no daria el
     * puntaje y la explicacion seria falsa.
     */
    const anadirInteres = (
      code: RecommendationReasonCode,
      label: string,
      factor: number,
    ): void => {
      const espacio = RULES.ranking.explicitInterest - interest;
      if (espacio <= 0) return;
      const aporte = Math.min(RULES.ranking.explicitInterest * factor, espacio);
      if (aporte <= 0) return;
      interest = this.redondear(interest + aporte);
      reasons.push({ code, label, points: this.redondear(aporte) });
    };

    if (areaId && name) {
      const priority = ctx.preferredByArea.get(areaId);
      if (priority) {
        anadirInteres(
          RecommendationReasonCode.PREFERRED_AREA,
          `${name} es un área de tu preferencia (prioridad ${priority})`,
          RULES.interestByPriority[Math.min(Math.max(priority, 1), 5) - 1],
        );
      }
    }

    const libre = ctx.freeInterestNames.find((n) => matchesDeclaredTerm(haystack, n, 4));
    if (libre) {
      anadirInteres(
        RecommendationReasonCode.FREE_INTEREST_MATCH,
        `Coincide con tu interés «${libre}»`,
        RULES.freeInterestFactor,
      );
    }

    const skill = ctx.skillNames.find((n) => matchesDeclaredTerm(haystack, n, 3));
    if (skill) {
      anadirInteres(
        RecommendationReasonCode.SKILL_MATCH,
        `Relacionado con tu habilidad ${skill}`,
        RULES.skillMatchFactor,
      );
    }

    // ------------------------------------------- 20 % area de mejora
    let improvement = 0;
    if (areaId && name && ctx.improvementIds.has(areaId)) {
      improvement = RULES.ranking.improvementArea;
      reasons.push({
        code: RecommendationReasonCode.IMPROVEMENT_AREA,
        label: `Quieres fortalecerte en ${name}`,
        points: improvement,
      });
    }

    // Sin un motivo de relevancia no hay recomendacion. El contexto solo
    // refuerza algo que ya encaja con el perfil.
    if (reasons.length === 0) return { score: 0, reasons: [] };

    // ------------------------------------- 10 % disponibilidad y contexto
    const context = RULES.ranking.context * contexto.factor;
    if (context > 0 && contexto.label) {
      reasons.push({
        code: RecommendationReasonCode.CONTEXT_MATCH,
        label: contexto.label,
        points: this.redondear(context),
      });
    }

    return {
      score: this.redondear(affinity + interest + improvement + context),
      reasons,
    };
  }

  /**
   * §59 · Refuerzo por regimen, y su explicacion.
   *
   * El refuerzo no penaliza: un elemento que no encaja simplemente no lo
   * recibe. Nada desaparece de la lista por esto, solo cambia el orden.
   */
  private applyRegime(
    ctx: Contexto,
    areaId: string | null,
    categoryCode: string | null,
    resourceType: LearningResourceType | null,
    type: RecommendationType,
    reasons: RecommendationReason[],
    score: number,
  ): number {
    if (!areaId) return score;
    const regime = ctx.regimeByArea.get(areaId) ?? RecommendationRegime.NONE;
    if (!fitsRegime(regime, categoryCode, resourceType, type)) return score;

    const name = ctx.areaName.get(areaId) ?? 'esta área';
    const info = ctx.affinityByArea.get(areaId);

    if (regime === RecommendationRegime.BUILD_EXPERIENCE) {
      reasons.push({
        code: RecommendationReasonCode.BUILD_EXPERIENCE,
        label:
          `Tu respaldo en ${name} todavía es ${SUPPORT_LABEL[info?.supportLevel ?? AffinityLevel.LOW]}`
          + ': esto te deja algo que puedas demostrar',
        points: RULES.regime.bonus,
      });
    } else {
      reasons.push({
        code: RecommendationReasonCode.ADVANCE_LEVEL,
        label:
          `Tu trayectoria en ${name} ya está respaldada `
          + `(${info?.supportScore ?? 0}/100): esto te lleva más lejos`,
        points: RULES.regime.bonus,
      });
    }
    return Math.min(100, this.redondear(score + RULES.regime.bonus));
  }

  // =========================================================================
  // Actividades y oportunidades
  // =========================================================================

  private async activityCandidates(
    profileId: string,
    ctx: Contexto,
  ): Promise<{ elements: Produced[]; availableByArea: Map<string, number> }> {
    const candidates = await this.activities.find({
      where: { status: In(REGISTRABLE_STATUSES) },
      relations: { category: true },
    });

    // §61: los cursos y recursos ya no son actividades. Se excluyen aqui para
    // no recomendar lo mismo dos veces por dos caminos distintos.
    const actividades = candidates.filter(
      (a) => !CATALOGUED_AS_RESOURCE_CATEGORIES.includes(a.category?.code ?? ''),
    );

    // Una actividad cuya fecha ya paso no admite inscripcion (mismo criterio
    // que ActivitiesService.registrationBlockReason).
    const open = actividades.filter(
      (a) => !a.eventDate || a.eventDate.getTime() >= ctx.now.getTime(),
    );

    // El estudiante ya conoce aquello en lo que se inscribio, marco interes o
    // participo: no se le recomienda otra vez.
    const mine = await this.registrations.find({ where: { studentProfileId: profileId } });
    const alreadyInvolved = new Set(mine.map((r) => r.activityId));

    // Sin plazas confirmables no tiene sentido recomendarla. La API cuenta el
    // cupo sobre participaciones confirmadas, y aqui se usa el mismo criterio.
    const confirmedByActivity = await this.confirmedCounts(open.map((a) => a.id));

    const available = open.filter((a) => {
      if (alreadyInvolved.has(a.id)) return false;
      if (a.capacity && (confirmedByActivity.get(a.id) ?? 0) >= a.capacity) return false;
      return true;
    });

    const availableByArea = new Map<string, number>();
    for (const a of available) {
      if (a.academicAreaId) {
        availableByArea.set(a.academicAreaId, (availableByArea.get(a.academicAreaId) ?? 0) + 1);
      }
    }

    const elements: Produced[] = [];
    for (const a of available) {
      const haystack = normalize(
        [a.title, a.description, (a.tags ?? []).join(' '), a.category?.name].join(' '),
      );
      const contexto = this.activityContext(ctx, a);
      const { score, reasons } = this.scoreElement(ctx, a.academicAreaId, haystack, contexto);
      if (reasons.length === 0) continue;

      const type = typeForCategory(a.category?.code);
      const final = this.applyRegime(
        ctx,
        a.academicAreaId,
        a.category?.code ?? null,
        null,
        type,
        reasons,
        score,
      );
      if (final < RULES.minElementScore) continue;

      elements.push({
        type,
        targetId: a.id,
        academicAreaId: a.academicAreaId ?? null,
        title: a.title,
        description: a.description ? a.description.slice(0, 500) : null,
        targetLink: a.externalUrl,
        reasons,
        score: final,
        sortKey: `${a.eventDate ? a.eventDate.toISOString() : '9999'}|${a.title}`,
      });
    }

    return { elements, availableByArea };
  }

  /**
   * §60 · El 10 % de disponibilidad y contexto, para una actividad.
   *
   * Todo lo que entra aqui es comprobable: si ocurre pronto, si va dirigida a
   * su semestre, si la modalidad coincide con como dijo que prefiere colaborar
   * y si declaro estar disponible. Nada de suposiciones sobre la persona.
   */
  private activityContext(
    ctx: Contexto,
    a: Activity,
  ): { factor: number; label: string | null } {
    const partes: string[] = [];
    let factor = 0;

    const windowEnd = ctx.now.getTime() + RULES.upcomingWindowDays * 24 * 60 * 60 * 1000;
    if (a.eventDate && a.eventDate.getTime() <= windowEnd) {
      factor += RULES.context.upcomingDate;
      partes.push(`se realiza pronto (${this.formatDate(a.eventDate)})`);
    }

    const alcance = a.semesterScope ?? [];
    if (ctx.profile.semester && alcance.length > 0 && alcance.includes(ctx.profile.semester)) {
      factor += RULES.context.semesterScope;
      partes.push(`va dirigida a ${ctx.profile.semester}.º semestre`);
    }

    const modos = ctx.profile.collaborationPreferences?.modes ?? [];
    if (a.modality && modos.length > 0 && this.modalityMatches(a.modality, modos)) {
      factor += RULES.context.modality;
      partes.push('la modalidad coincide con cómo prefieres participar');
    }

    if (
      ctx.profile.availability === AvailabilityStatus.LOOKING
      || ctx.profile.availability === AvailabilityStatus.OPEN
    ) {
      factor += RULES.context.availability;
      partes.push('declaraste estar disponible');
    }

    return {
      factor: Math.min(1, factor),
      label: partes.length ? `Encaja con tu contexto: ${partes.join(', ')}` : null,
    };
  }

  /** La modalidad hibrida encaja con cualquiera; el resto, con la suya. */
  private modalityMatches(modality: ActivityModality, modos: CollaborationMode[]): boolean {
    if (modality === ActivityModality.HIBRIDA) return true;
    if (modos.includes(CollaborationMode.HYBRID)) return true;
    if (modality === ActivityModality.VIRTUAL) return modos.includes(CollaborationMode.REMOTE);
    return modos.includes(CollaborationMode.IN_PERSON);
  }

  // =========================================================================
  // §61 · Catalogo controlado de recursos y cursos externos
  // =========================================================================

  /**
   * Recursos del catalogo que encajan con el perfil.
   *
   * Todos salen de `learning_resources`, que es el catalogo que §61 exige. No
   * se consulta Internet ni se construye ninguna URL: lo que se recomienda es
   * lo que alguien de la carrera decidio incluir, y los retirados no entran.
   */
  private async resourceCandidates(ctx: Contexto): Promise<Produced[]> {
    const vigentes = await this.resources.find({
      where: { status: LearningResourceStatus.ACTIVE },
      relations: { resourceSkills: true },
    });

    const elements: Produced[] = [];
    for (const r of vigentes) {
      const haystack = normalize([r.title, r.description, r.provider].join(' '));

      // Una habilidad que el recurso declara y el estudiante tambien tiene es
      // una coincidencia mas firme que cualquier parecido de texto.
      const porHabilidad = (r.resourceSkills ?? []).some((s) => ctx.skillIds.has(s.skillId));

      const contexto = {
        factor: this.resourceContextFactor(ctx, r, porHabilidad),
        label: porHabilidad
          ? 'Trabaja una habilidad que ya declaraste'
          : ctx.profile.availability === AvailabilityStatus.LOOKING
            ? 'Puedes avanzarlo a tu ritmo'
            : null,
      };

      const { score, reasons } = this.scoreElement(ctx, r.academicAreaId, haystack, contexto);
      if (reasons.length === 0) continue;

      const type = typeForResource(r.resourceType);
      const final = this.applyRegime(
        ctx,
        r.academicAreaId,
        null,
        r.resourceType,
        type,
        reasons,
        score,
      );
      if (final < RULES.minElementScore) continue;

      elements.push({
        type,
        targetId: r.id,
        academicAreaId: r.academicAreaId,
        title: r.title,
        description: r.description
          ? `${r.provider} · ${r.description}`.slice(0, 500)
          : r.provider,
        targetLink: r.url,
        reasons,
        score: final,
        sortKey: r.title,
      });
    }

    return elements;
  }

  /**
   * Un recurso no tiene fecha ni semestre, asi que su contexto es mas simple:
   * pesa la coincidencia de habilidad y, si acaso, la disponibilidad declarada.
   */
  private resourceContextFactor(
    ctx: Contexto,
    _resource: LearningResource,
    porHabilidad: boolean,
  ): number {
    let factor = porHabilidad ? RULES.context.modality + RULES.context.semesterScope : 0;
    if (ctx.profile.availability === AvailabilityStatus.LOOKING) {
      factor += RULES.context.availability;
    }
    return Math.min(1, factor);
  }

  // =========================================================================
  // Areas de fortalecimiento
  // =========================================================================

  /**
   * Un area se recomienda para fortalecer cuando al estudiante le importa -la
   * declaro como area de mejora o de preferencia- y todavia no tiene
   * trayectoria en ella, o la tiene sin respaldo.
   *
   * §59 lo pide expresamente para las areas de mejora, y anade la condicion que
   * faltaba: un area con afinidad pero respaldo bajo tambien hay que
   * fortalecerla, aunque el puntaje de afinidad se vea bien.
   */
  private strengtheningCandidates(
    ctx: Contexto,
    availableByArea: Map<string, number>,
  ): Produced[] {
    const candidateAreas = new Set([...ctx.improvementIds, ...ctx.preferredByArea.keys()]);
    const result: Produced[] = [];

    for (const areaId of candidateAreas) {
      const name = ctx.areaName.get(areaId);
      if (!name) continue;

      const info = ctx.affinityByArea.get(areaId);
      const respaldoBajo = !info || info.supportLevel === AffinityLevel.LOW;
      // Si ya tiene afinidad alta Y respaldo, no hay nada que fortalecer.
      if (info && info.level !== AffinityLevel.LOW && !respaldoBajo) continue;

      const reasons: RecommendationReason[] = [];
      if (ctx.improvementIds.has(areaId)) {
        reasons.push({
          code: RecommendationReasonCode.IMPROVEMENT_AREA,
          label: `Declaraste que quieres mejorar en ${name}`,
          points: RULES.strengthening.improvementPoints,
        });
      }
      const priority = ctx.preferredByArea.get(areaId);
      if (priority) {
        reasons.push({
          code: RecommendationReasonCode.PREFERRED_AREA,
          label: `${name} es un área de tu preferencia`,
          points: priority,
        });
      }

      if (!info) {
        reasons.push({
          code: RecommendationReasonCode.LOW_TRAJECTORY,
          label: `Todavía no tienes trayectoria registrada en ${name}`,
          points: RULES.strengthening.noTrajectoryPoints,
        });
      } else if (info.level === AffinityLevel.LOW) {
        reasons.push({
          code: RecommendationReasonCode.LOW_TRAJECTORY,
          label: `Tu afinidad con ${name} todavía es baja (${info.score}/100)`,
          points: RULES.strengthening.lowTrajectoryPoints,
        });
      }

      // §59: el respaldo bajo es una razon por si sola, aunque la afinidad se
      // vea bien. Es la diferencia entre decir que algo te interesa y poder
      // demostrar que lo hiciste.
      if (info && respaldoBajo) {
        reasons.push({
          code: RecommendationReasonCode.LOW_SUPPORT,
          label:
            `Tu respaldo en ${name} es ${SUPPORT_LABEL[info.supportLevel]} `
            + `(${info.supportScore}/100): falta con qué demostrarlo`,
          points: RULES.strengthening.lowSupportPoints,
        });
      }

      if (reasons.length === 0) continue;

      const count = availableByArea.get(areaId) ?? 0;
      result.push({
        type: RecommendationType.STRENGTHENING_AREA,
        targetId: areaId,
        academicAreaId: areaId,
        title: name,
        description:
          count > 0
            ? `Hay ${count} ${count === 1 ? 'actividad, curso o recurso disponible' : 'actividades, cursos o recursos disponibles'} en esta área.`
            : 'Por ahora no hay actividades publicadas en esta área.',
        targetLink: null,
        reasons,
        score: this.sum(reasons),
        sortKey: name,
      });
    }

    return result;
  }

  // =========================================================================
  // §62 · Posibles companeros de equipo
  // =========================================================================

  /**
   * Companeros que pueden aportar lo que al estudiante le falta.
   *
   * §62 fija el orden de prioridad y este metodo lo respeta: primero las
   * habilidades faltantes, despues el respaldo relacionado, luego la afinidad
   * contextual y la disponibilidad. Un equipo se forma por lo que le falta, no
   * por lo que ya tiene repetido.
   *
   * Privacidad: solo participan estudiantes con cuenta activa que aceptaron
   * aparecer en sugerencias. De cada companero se guarda su nombre, su semestre
   * y las areas que justifican la sugerencia; nunca su correo, sus puntajes ni
   * sus proyectos.
   */
  private async teammateCandidates(ctx: Contexto): Promise<Produced[]> {
    const strongAreas = new Set(ctx.strongAreas);
    const miPuntaje = new Map(
      ctx.strongAreas.map((id) => [id, ctx.affinityByArea.get(id)?.score ?? 0]),
    );
    const wantsToGrow = new Set(
      [...ctx.improvementIds, ...ctx.preferredByArea.keys()].filter(
        (id) => !strongAreas.has(id),
      ),
    );
    if (strongAreas.size === 0 && wantsToGrow.size === 0) return [];

    const peers = await this.profiles
      .createQueryBuilder('p')
      .innerJoin('p.user', 'u')
      .select('p.id', 'profileId')
      .addSelect('p.semester', 'semester')
      .addSelect('p.availability', 'availability')
      .addSelect('u.id', 'userId')
      .addSelect("CONCAT(u.first_name, ' ', u.last_name)", 'name')
      .where('p.id <> :me', { me: ctx.profile.id })
      .andWhere('p.peer_discoverable = true')
      .andWhere('u.status = :active', { active: UserStatus.ACTIVE })
      .getRawMany<{
        profileId: string;
        semester: number | null;
        availability: AvailabilityStatus;
        userId: string;
        name: string;
      }>();
    if (peers.length === 0) return [];

    const alreadyTeam = await this.currentTeammates(ctx.profile);
    const peerIds = peers.map((p) => p.profileId);

    const peerAffinities = await this.affinities.find({
      where: { studentProfileId: In(peerIds), score: MoreThan(0) },
    });
    const byPeer = new Map<string, AffinityResult[]>();
    for (const row of peerAffinities) {
      const list = byPeer.get(row.studentProfileId) ?? [];
      list.push(row);
      byPeer.set(row.studentProfileId, list);
    }
    // De cada companero se miran solo sus areas mas fuertes, por el mismo
    // motivo que del propio estudiante: un umbral absoluto excluiria a casi
    // todos.
    for (const [id, filas] of byPeer) {
      byPeer.set(
        id,
        [...filas]
          .sort((a, b) => Number(b.score) - Number(a.score))
          .slice(0, RULES.teammate.topAreas),
      );
    }

    // §62, primera prioridad: habilidades faltantes. Solo cuentan las de las
    // areas que al estudiante le importan; que alguien sepa algo ajeno a su
    // trayectoria no lo convierte en buen companero para el.
    const areasQueImportan = new Set([...strongAreas, ...wantsToGrow]);
    // El descarte de las habilidades que el estudiante ya declara se hace abajo
    // y no en el WHERE: con un perfil sin habilidades, la lista a excluir
    // quedaria vacia y `NOT IN ()` no es SQL valido.
    const peerSkills = await this.studentSkills.find({
      where: { studentProfileId: In(peerIds) },
      relations: { skill: true },
    });
    const skillsByPeer = new Map<string, StudentSkill[]>();
    for (const s of peerSkills) {
      if (!s.skill?.academicAreaId || !areasQueImportan.has(s.skill.academicAreaId)) continue;
      if (ctx.skillIds.has(s.skillId)) continue;
      const list = skillsByPeer.get(s.studentProfileId) ?? [];
      list.push(s);
      skillsByPeer.set(s.studentProfileId, list);
    }

    const result: Produced[] = [];
    for (const peer of peers) {
      if (alreadyTeam.has(peer.userId)) continue;
      const rows = byPeer.get(peer.profileId) ?? [];
      const reasons: RecommendationReason[] = [];

      // 1. Habilidades faltantes.
      const faltantes = (skillsByPeer.get(peer.profileId) ?? []).slice(
        0,
        RULES.teammate.maxMissingSkills,
      );
      for (const s of faltantes) {
        reasons.push({
          code: RecommendationReasonCode.MISSING_SKILL,
          label: `Declara ${s.skill.name}, que tú todavía no declaras`,
          points: RULES.teammate.missingSkillPoints,
        });
      }

      // 2. Respaldo relacionado y 3. afinidad contextual.
      const shared = rows
        .filter((r) => strongAreas.has(r.academicAreaId) && ctx.areaName.has(r.academicAreaId))
        .slice(0, RULES.teammate.maxSharedAreas);
      for (const r of shared) {
        const nombre = ctx.areaName.get(r.academicAreaId);
        if (Number(r.supportScore ?? 0) > 0) {
          reasons.push({
            code: RecommendationReasonCode.SUPPORT_BACKED,
            label: `Tiene trayectoria respaldada en ${nombre}`,
            points: RULES.teammate.supportBackedPoints,
          });
        } else {
          reasons.push({
            code: RecommendationReasonCode.SHARED_AFFINITY,
            label: `Comparten trayectoria en ${nombre}`,
            points: RULES.teammate.sharedAreaPoints,
          });
        }
      }

      const complementary = rows
        .filter(
          (r) =>
            wantsToGrow.has(r.academicAreaId) &&
            ctx.areaName.has(r.academicAreaId) &&
            Number(r.score) > (miPuntaje.get(r.academicAreaId) ?? 0),
        )
        .slice(0, RULES.teammate.maxComplementaryAreas);
      for (const r of complementary) {
        reasons.push({
          code: RecommendationReasonCode.COMPLEMENTARY_PROFILE,
          label: `Puede aportar en ${ctx.areaName.get(r.academicAreaId)}, donde quieres fortalecerte`,
          points: RULES.teammate.complementaryPoints,
        });
      }

      // Sin ninguna de las tres primeras prioridades no hay sugerencia: la
      // disponibilidad sola no hace a nadie buen companero.
      if (reasons.length === 0) continue;

      // 4. Disponibilidad declarada.
      if (
        peer.availability === AvailabilityStatus.LOOKING
        || peer.availability === AvailabilityStatus.OPEN
      ) {
        reasons.push({
          code: RecommendationReasonCode.AVAILABILITY,
          label:
            peer.availability === AvailabilityStatus.LOOKING
              ? 'Declaró que busca sumarse a algo'
              : 'Declaró que escucha propuestas',
          points: RULES.teammate.availabilityPoints,
        });
      }

      const score = this.sum(reasons);
      if (score < RULES.teammate.minScore) continue;

      const semester = peer.semester === null ? null : Number(peer.semester);
      const distance =
        semester && ctx.profile.semester ? Math.abs(semester - ctx.profile.semester) : 9;
      result.push({
        type: RecommendationType.TEAMMATE,
        targetId: peer.profileId,
        academicAreaId:
          (complementary[0] ?? shared[0])?.academicAreaId
          ?? faltantes[0]?.skill?.academicAreaId
          ?? null,
        title: peer.name,
        description: semester ? `Estudiante de ${semester}.º semestre` : 'Estudiante de la carrera',
        targetLink: null,
        reasons,
        score,
        sortKey: `${distance}|${peer.name}`,
      });
    }

    return result;
  }

  /** Usuarios que ya comparten un proyecto con el estudiante. */
  private async currentTeammates(profile: StudentProfile): Promise<Set<string>> {
    const owned = await this.projects.find({
      where: { createdByProfileId: profile.id },
      select: { id: true },
    });
    const memberships = await this.members.find({ where: { userId: profile.userId } });
    const projectIds = [
      ...new Set([...owned.map((p) => p.id), ...memberships.map((m) => m.projectId)]),
    ];
    if (projectIds.length === 0) return new Set();

    const [teamMembers, teamProjects] = await Promise.all([
      this.members.find({ where: { projectId: In(projectIds) } }),
      this.projects.find({
        where: { id: In(projectIds) },
        relations: { createdByProfile: true },
      }),
    ]);

    const users = new Set<string>(teamMembers.map((m) => m.userId));
    for (const p of teamProjects) {
      if (p.createdByProfile?.userId) users.add(p.createdByProfile.userId);
    }
    users.delete(profile.userId);
    return users;
  }

  // =========================================================================
  // Organizacion y persistencia
  // =========================================================================

  private limitByType(items: Produced[]): Produced[] {
    const byType = new Map<RecommendationType, Produced[]>();
    for (const item of items) {
      const list = byType.get(item.type) ?? [];
      list.push(item);
      byType.set(item.type, list);
    }
    const result: Produced[] = [];
    for (const [type, list] of byType) {
      list.sort((a, b) => b.score - a.score || a.sortKey.localeCompare(b.sortKey));
      result.push(...list.slice(0, RULES.limits[type]));
    }
    return result;
  }

  /**
   * Guarda el calculo en una transaccion.
   *
   *  - Lo producido se inserta o actualiza. En una recomendacion existente se
   *    actualiza el contenido, NUNCA el estado: guardar o descartar es decision
   *    del estudiante y sobrevive a cualquier recalculo.
   *  - Lo que ya no se produce deja de estar vigente, sin perder su estado.
   *  - Una recomendacion que deja de estar vigente sin que el estudiante la
   *    haya abierto ni decidido nada se elimina: no hay nada que conservar.
   */
  private async persist(profileId: string, produced: Produced[], generatedAt: Date): Promise<void> {
    await this.dataSource.transaction(async (manager) => {
      if (produced.length > 0) {
        await manager
          .createQueryBuilder()
          .insert()
          .into(Recommendation)
          .values(
            produced.map((p) => ({
              studentProfileId: profileId,
              type: p.type,
              targetId: p.targetId,
              academicAreaId: p.academicAreaId,
              title: p.title,
              description: p.description,
              targetLink: p.targetLink,
              score: p.score,
              reasons: p.reasons,
              isCurrent: true,
              rulesVersion: RULES_VERSION,
              generatedAt,
            })),
          )
          .orUpdate(
            [
              'academic_area_id',
              'title',
              'description',
              'target_link',
              'score',
              'reasons',
              'is_current',
              'rules_version',
              'generated_at',
            ],
            ['student_profile_id', 'type', 'target_id'],
          )
          .execute();
      }

      await manager
        .createQueryBuilder()
        .update(Recommendation)
        .set({ isCurrent: false })
        .where('student_profile_id = :profileId', { profileId })
        .andWhere('is_current = true')
        .andWhere('generated_at < :generatedAt', { generatedAt })
        .execute();

      await manager
        .createQueryBuilder()
        .delete()
        .from(Recommendation)
        .where('student_profile_id = :profileId', { profileId })
        .andWhere('is_current = false')
        .andWhere('status = :status', { status: RecommendationStatus.NEW })
        .execute();
    });
  }

  private async confirmedCounts(activityIds: string[]): Promise<Map<string, number>> {
    if (activityIds.length === 0) return new Map();
    const rows = await this.registrations
      .createQueryBuilder('r')
      .select('r.activity_id', 'activityId')
      .addSelect('COUNT(*)', 'total')
      .where('r.activity_id IN (:...ids)', { ids: activityIds })
      .andWhere('r.status = :confirmed', { confirmed: RegistrationStatus.CONFIRMED })
      .groupBy('r.activity_id')
      .getRawMany<{ activityId: string; total: string }>();
    return new Map(rows.map((r) => [r.activityId, Number(r.total)]));
  }

  private sum(reasons: RecommendationReason[]): number {
    return this.redondear(reasons.reduce((acc, r) => acc + r.points, 0));
  }

  private redondear(n: number): number {
    return Math.round(n * 100) / 100;
  }

  private formatDate(date: Date): string {
    return date.toLocaleDateString('es-BO', { day: 'numeric', month: 'long', year: 'numeric' });
  }
}
