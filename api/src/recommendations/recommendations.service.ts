import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, Not, Repository } from 'typeorm';
import {
  LearningResourceStatus,
  RecommendationOutcome,
  RecommendationStatus,
  RecommendationType,
} from '@perfil/shared';
import { StudentProfile } from '../entities/student-profile.entity';
import { Activity } from '../entities/activity.entity';
import { LearningResource } from '../entities/learning-resource.entity';
import { Recommendation } from '../entities/recommendation.entity';
import { RecommendationsEngine } from './recommendations.engine';
import {
  ACTIVITY_BACKED_TYPES,
  ELEMENT_TYPES,
  RULES,
  RULES_VERSION,
  TYPE_LABEL,
  TYPE_ORDER,
} from './recommendation.rules';

const MESSAGES = {
  [RecommendationOutcome.AVAILABLE]:
    'Recomendaciones orientativas según tu perfil y tus afinidades. Tú decides si te sirven.',
  [RecommendationOutcome.INSUFFICIENT_PROFILE]:
    'Todavía no se cuenta con datos suficientes para recomendarte. Declara tus áreas de ' +
    'preferencia, tus intereses o tus habilidades, o participa en actividades, y vuelve a consultar.',
  [RecommendationOutcome.NO_MATCHES]:
    'Actualmente no existen recomendaciones disponibles para tu perfil. Vuelve a consultar ' +
    'cuando se publiquen nuevas actividades, cursos o recursos.',
};

/**
 * Consulta de recomendaciones y decisiones del estudiante (RF18, RN-16).
 *
 * Solo el estudiante consulta sus recomendaciones: el actor de RF18 y de la
 * Tabla 2.27 es el Estudiante. Una recomendacion ajena responde 404, no 403,
 * para no revelar siquiera que existe.
 */
@Injectable()
export class RecommendationsService {
  constructor(
    private readonly engine: RecommendationsEngine,
    @InjectRepository(StudentProfile) private readonly profiles: Repository<StudentProfile>,
    @InjectRepository(Recommendation) private readonly recommendations: Repository<Recommendation>,
    @InjectRepository(Activity) private readonly activities: Repository<Activity>,
    @InjectRepository(LearningResource)
    private readonly resources: Repository<LearningResource>,
  ) {}

  /**
   * Tabla 2.27, flujo basico: al acceder a la pantalla el sistema obtiene el
   * perfil, lo compara con los elementos disponibles y muestra lo que coincide.
   * Por eso cada consulta genera de nuevo: una actividad en la que el
   * estudiante se acaba de inscribir no debe seguir recomendandose.
   */
  async getMine(userId: string) {
    const profileId = await this.resolveProfileId(userId);
    const generation = await this.engine.generate(profileId);

    const [saved, dismissed] = await Promise.all([
      this.recommendations.count({
        where: { studentProfileId: profileId, status: RecommendationStatus.SAVED },
      }),
      this.recommendations.count({
        where: { studentProfileId: profileId, status: RecommendationStatus.DISMISSED },
      }),
    ]);

    const base = {
      generatedAt: generation.generatedAt,
      rulesVersion: generation.rulesVersion,
      counts: { total: 0, saved, dismissed, byType: this.emptyByType() },
    };

    // Flujo 2a: el perfil no tiene con que comparar.
    if (!generation.profileSufficient) {
      return {
        outcome: RecommendationOutcome.INSUFFICIENT_PROFILE,
        message: MESSAGES[RecommendationOutcome.INSUFFICIENT_PROFILE],
        ...base,
        groups: [],
      };
    }

    const rows = await this.recommendations.find({
      where: {
        studentProfileId: profileId,
        isCurrent: true,
        status: Not(RecommendationStatus.DISMISSED),
      },
      relations: { academicArea: true },
      order: { score: 'DESC', title: 'ASC' },
    });

    // Flujo 3a: hay perfil, pero nada disponible coincide con el.
    if (rows.length === 0) {
      return {
        outcome: RecommendationOutcome.NO_MATCHES,
        message: MESSAGES[RecommendationOutcome.NO_MATCHES],
        ...base,
        groups: [],
      };
    }

    const byType = this.emptyByType();
    rows.forEach((r) => (byType[r.type] += 1));

    return {
      outcome: RecommendationOutcome.AVAILABLE,
      message: MESSAGES[RecommendationOutcome.AVAILABLE],
      ...base,
      counts: { total: rows.length, saved, dismissed, byType },
      groups: TYPE_ORDER.map(({ type, label }) => ({
        type,
        label,
        items: rows.filter((r) => r.type === type).map((r) => this.toView(r)),
      })).filter((g) => g.items.length > 0),
    };
  }

  /**
   * Tabla 2.27, paso 7: el estudiante accede al detalle del elemento que le
   * interesa. Abrir el detalle es lo que el diagrama de clases llama
   * markAsViewed().
   */
  async getOne(userId: string, id: string) {
    const profileId = await this.resolveProfileId(userId);
    const recommendation = await this.findOwn(profileId, id);

    if (recommendation.status === RecommendationStatus.NEW) {
      recommendation.status = RecommendationStatus.VIEWED;
      recommendation.viewedAt = new Date();
      await this.recommendations.save(recommendation);
    }

    return {
      ...this.toView(recommendation),
      detail: await this.detailFor(profileId, recommendation),
    };
  }

  /** RN-16: el estudiante conserva la decision sobre cada recomendacion. */
  async decide(userId: string, id: string, status: RecommendationStatus) {
    const profileId = await this.resolveProfileId(userId);
    const recommendation = await this.findOwn(profileId, id);

    const now = new Date();
    recommendation.status = status;
    recommendation.viewedAt = recommendation.viewedAt ?? now;
    recommendation.decidedAt = status === RecommendationStatus.VIEWED ? null : now;
    await this.recommendations.save(recommendation);

    return this.toView(recommendation);
  }

  /** Recomendaciones guardadas o descartadas, vigentes o no. */
  async history(userId: string, status: RecommendationStatus) {
    const profileId = await this.resolveProfileId(userId);
    const rows = await this.recommendations.find({
      where: { studentProfileId: profileId, status },
      relations: { academicArea: true },
      order: { decidedAt: 'DESC', title: 'ASC' },
    });
    return rows.map((r) => this.toView(r));
  }

  /**
   * Las reglas con que se genera cada recomendacion, de solo lectura.
   *
   * §60 reparte el ranking en porcentajes y §59 anade el refuerzo por regimen.
   * Se publican los dos: un estudiante que ve «43 de 100» tiene derecho a saber
   * de donde sale ese 43, igual que con la afinidad.
   */
  getRules() {
    return {
      rulesVersion: RULES_VERSION,
      /** V2 §54 · Reparto del ranking. Suma 100. */
      ranking: [
        {
          code: 'preferred_area',
          label: 'Interés explícito: áreas y tecnologías que te interesan',
          weight: RULES.ranking.explicitInterest,
          detail:
            'Entero con prioridad 1 y algo más de la mitad con prioridad 5. Una tecnología de '
            + 'interés que la actividad trabaja suma; si solo aparece en el texto, suma menos.',
        },
        {
          code: 'improvement_area',
          label: 'Área o tecnología que quieres fortalecer',
          weight: RULES.ranking.improvementArea,
          detail: 'El área marcada para fortalecer cuenta entera; una tecnología a mejorar, en parte.',
        },
        {
          code: 'orientation_confirmed',
          label: 'Orientación académica confirmada',
          weight: RULES.ranking.orientation,
          detail: 'Áreas que te sugirió el cuestionario y que tú decidiste sumar.',
        },
        {
          code: 'affinity_area',
          label: 'Afinidad y respaldo en esa área',
          weight: RULES.ranking.affinitySupport,
          detail: 'Ordena lo que ya encaja contigo: nunca recomienda algo por sí sola.',
        },
        {
          code: 'context_match',
          label: 'Disponibilidad y contexto',
          weight: RULES.ranking.context,
          detail:
            'Fecha próxima, modalidad compatible con cómo prefieres participar y disponibilidad '
            + 'que declaraste. Las actividades de otros semestres no se recomiendan.',
        },
      ],
      /** V2 §54 · Las oportunidades avanzadas suben si afinidad y respaldo son altos. */
      regimes: [
        {
          code: 'advance_level',
          label: 'Afinidad alta con respaldo alto',
          detail:
            'Se priorizan convocatorias, hackathones, retos e investigación: lo que lleva '
            + 'más lejos a quien ya demostró.',
          bonus: RULES.regime.bonus,
        },
      ],
      /** §62 · Prioridades para sugerir un compañero, en su orden. */
      teammate: [
        {
          code: 'missing_skill',
          label: 'Cubre una habilidad que no declaras',
          points: RULES.teammate.missingSkillPoints,
        },
        {
          code: 'support_backed',
          label: 'Tiene trayectoria respaldada en un área común',
          points: RULES.teammate.supportBackedPoints,
        },
        {
          code: 'shared_affinity',
          label: 'Comparten trayectoria en un área',
          points: RULES.teammate.sharedAreaPoints,
        },
        {
          code: 'complementary_profile',
          label: 'Puede aportar donde quieres fortalecerte',
          points: RULES.teammate.complementaryPoints,
        },
        {
          code: 'availability',
          label: 'Declaró disponibilidad para colaborar',
          points: RULES.teammate.availabilityPoints,
        },
      ],
      limits: RULES.limits,
      minimumScore: { element: RULES.minElementScore, teammate: RULES.teammate.minScore },
    };
  }

  // -------------------------------------------------------------------------

  private async detailFor(profileId: string, r: Recommendation) {
    if (ACTIVITY_BACKED_TYPES.includes(r.type)) {
      const activity = await this.activities.findOne({
        where: { id: r.targetId },
        relations: { category: true, academicArea: true },
      });
      if (!activity) return { available: false };
      return {
        available: r.isCurrent,
        activityId: activity.id,
        category: activity.category?.name ?? null,
        activityType: activity.type,
        modality: activity.modality,
        location: activity.location,
        eventDate: activity.eventDate,
        externalUrl: activity.externalUrl,
        capacity: activity.capacity,
      };
    }

    // §61: un recurso o un curso externo apunta al catalogo controlado, no a
    // una actividad. Se devuelve tambien quien lo incorporo, porque es lo que
    // distingue un catalogo curado de una lista de enlaces.
    if (
      r.type === RecommendationType.RESOURCE
      || r.type === RecommendationType.EXTERNAL_COURSE
    ) {
      const resource = await this.resources.findOne({
        where: { id: r.targetId },
        relations: { academicArea: true, resourceSkills: { skill: true } },
      });
      if (!resource) return { available: false };
      return {
        // Un recurso retirado del catalogo deja de estar disponible aunque la
        // recomendacion guardada siga existiendo (§61).
        available: r.isCurrent && resource.status === LearningResourceStatus.ACTIVE,
        resourceId: resource.id,
        provider: resource.provider,
        resourceType: resource.resourceType,
        status: resource.status,
        url: resource.url,
        skills: (resource.resourceSkills ?? [])
          .map((s) => s.skill?.name)
          .filter((n): n is string => !!n),
      };
    }

    if (r.type === RecommendationType.STRENGTHENING_AREA) {
      const related = await this.recommendations.find({
        where: {
          studentProfileId: profileId,
          academicAreaId: r.targetId,
          isCurrent: true,
          type: In(ELEMENT_TYPES),
          status: Not(RecommendationStatus.DISMISSED),
        },
        order: { score: 'DESC' },
      });
      return {
        available: r.isCurrent,
        areaId: r.targetId,
        relatedRecommendations: related.map((x) => ({ id: x.id, type: x.type, title: x.title })),
      };
    }

    // Companero: tarjeta minima. Nombre y semestre, nada mas.
    const peer = await this.profiles.findOne({ where: { id: r.targetId }, relations: { user: true } });
    return {
      available: r.isCurrent && !!peer,
      profileId: r.targetId,
      studentName: peer?.user ? `${peer.user.firstName} ${peer.user.lastName}` : r.title,
      semester: peer?.semester ?? null,
    };
  }

  private toView(r: Recommendation) {
    return {
      id: r.id,
      type: r.type,
      typeLabel: TYPE_LABEL[r.type],
      status: r.status,
      title: r.title,
      description: r.description,
      targetId: r.targetId,
      targetLink: r.targetLink,
      area: r.academicArea ? { id: r.academicArea.id, name: r.academicArea.name } : null,
      score: Number(r.score),
      reasons: r.reasons,
      isCurrent: r.isCurrent,
      generatedAt: r.generatedAt,
      viewedAt: r.viewedAt,
      decidedAt: r.decidedAt,
    };
  }

  private async findOwn(profileId: string, id: string): Promise<Recommendation> {
    const recommendation = await this.recommendations.findOne({
      where: { id, studentProfileId: profileId },
      relations: { academicArea: true },
    });
    if (!recommendation) {
      throw new NotFoundException('Recomendación no encontrada.');
    }
    return recommendation;
  }

  private async resolveProfileId(userId: string): Promise<string> {
    const profile = await this.profiles.findOne({ where: { userId }, select: { id: true } });
    if (!profile) {
      throw new NotFoundException('Aún no has creado tu perfil estudiantil.');
    }
    return profile.id;
  }

  private emptyByType(): Record<RecommendationType, number> {
    return Object.fromEntries(TYPE_ORDER.map((t) => [t.type, 0])) as Record<
      RecommendationType,
      number
    >;
  }
}
