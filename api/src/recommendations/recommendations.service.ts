import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, Not, Repository } from 'typeorm';
import {
  RecommendationOutcome,
  RecommendationStatus,
  RecommendationType,
} from '@perfil/shared';
import { StudentProfile } from '../entities/student-profile.entity';
import { Activity } from '../entities/activity.entity';
import { Recommendation } from '../entities/recommendation.entity';
import { RecommendationsEngine } from './recommendations.engine';
import {
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

  /** Las reglas con que se genera cada recomendacion, de solo lectura. */
  getRules() {
    return {
      rulesVersion: RULES_VERSION,
      rules: [
        { code: 'affinity_area', label: 'Área con afinidad alta', points: RULES.affinityPoints.high },
        { code: 'affinity_area', label: 'Área con afinidad media', points: RULES.affinityPoints.medium },
        { code: 'affinity_area', label: 'Área con afinidad baja', points: RULES.affinityPoints.low },
        { code: 'preferred_area', label: 'Área de preferencia (1 más su prioridad de 1 a 5)', points: RULES.preferredAreaBase },
        { code: 'improvement_area', label: 'Área en la que quieres mejorar', points: RULES.improvementAreaPoints },
        { code: 'free_interest_match', label: 'Coincide con un interés declarado', points: RULES.freeInterestPoints },
        { code: 'skill_match', label: 'Relacionado con una habilidad declarada', points: RULES.skillMatchPoints },
        { code: 'upcoming_date', label: `Fecha dentro de los próximos ${RULES.upcomingWindowDays} días (solo refuerza)`, points: RULES.upcomingDatePoints },
        { code: 'shared_affinity', label: 'Compañero con trayectoria en un área en común', points: RULES.teammate.sharedAreaPoints },
        { code: 'complementary_profile', label: 'Compañero que puede aportar donde quieres fortalecerte', points: RULES.teammate.complementaryPoints },
      ],
      limits: RULES.limits,
      minimumScore: { element: RULES.minElementScore, teammate: RULES.teammate.minScore },
    };
  }

  // -------------------------------------------------------------------------

  private async detailFor(profileId: string, r: Recommendation) {
    if (ELEMENT_TYPES.includes(r.type)) {
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
