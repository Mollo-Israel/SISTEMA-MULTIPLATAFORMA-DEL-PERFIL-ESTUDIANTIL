import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, In, Repository } from 'typeorm';
import {
  ActivityStatus,
  AffinityLevel,
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
import { Project } from '../entities/project.entity';
import { ProjectMember } from '../entities/project-member.entity';
import { Recommendation, RecommendationReason } from '../entities/recommendation.entity';
import {
  LEVEL_LABEL,
  RULES,
  RULES_VERSION,
  matchesDeclaredTerm,
  normalize,
  typeForCategory,
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

interface AffinityInfo {
  level: AffinityLevel;
  score: number;
  share: number;
}

/**
 * Motor de recomendaciones academicas ligeras (RF18, RN-16).
 *
 * Sigue literalmente el flujo basico de la Tabla 2.27:
 *   2. obtiene la informacion del perfil y las afinidades identificadas;
 *   3. la compara con las actividades, oportunidades, recursos y demas
 *      elementos disponibles;
 *   4. identifica las sugerencias relacionadas con el perfil;
 *   5. las organiza por tipo.
 *
 * Cada recomendacion lleva sus motivos, y su puntaje es exactamente la suma de
 * esos motivos. Nada se recomienda sin al menos un motivo de relevancia.
 *
 * Lo que el estudiante decidio (guardar o descartar) se conserva entre
 * calculos: el motor actualiza el contenido de una recomendacion existente,
 * nunca su estado. Asi se cumple que "el estudiante conservara la decision
 * sobre su utilizacion" (RN-16).
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
      this.studentSkills.find({ where: { studentProfileId: profileId }, relations: { skill: true } }),
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

    const topAffinity = affinityRows.reduce((max, r) => Math.max(max, Number(r.score)), 0);
    const affinityByArea = new Map<string, AffinityInfo>(
      affinityRows.map((r) => [
        r.academicAreaId,
        {
          level: r.level,
          score: Number(r.score),
          share: topAffinity > 0 ? Number(r.score) / topAffinity : 0,
        },
      ]),
    );
    const preferredByArea = new Map(preferredRows.map((p) => [p.academicAreaId, p.priority]));

    // --- 3 y 4. Comparar con los elementos disponibles --------------------
    const { elements, availableByArea } = await this.elementCandidates(
      profileId,
      affinityByArea,
      preferredByArea,
      improvementIds,
      areaName,
      freeRows.map((f) => f.name),
      skillRows.filter((s) => s.skill).map((s) => s.skill.name),
      generatedAt,
    );

    const strengthening = this.strengtheningCandidates(
      affinityByArea,
      preferredByArea,
      improvementIds,
      areaName,
      availableByArea,
    );

    const teammates = await this.teammateCandidates(
      profile,
      affinityByArea,
      preferredByArea,
      improvementIds,
      areaName,
    );

    // --- 5. Organizar por tipo, con su limite ----------------------------
    const produced = this.limitByType([...elements, ...strengthening, ...teammates]);
    await this.persist(profileId, produced, generatedAt);

    return {
      profileSufficient: true,
      generatedAt,
      rulesVersion: RULES_VERSION,
      produced: produced.length,
    };
  }

  // =========================================================================
  // Actividades, oportunidades, cursos externos y recursos de apoyo
  // =========================================================================

  private async elementCandidates(
    profileId: string,
    affinityByArea: Map<string, AffinityInfo>,
    preferredByArea: Map<string, number>,
    improvementIds: Set<string>,
    areaName: Map<string, string>,
    freeInterestNames: string[],
    skillNames: string[],
    now: Date,
  ): Promise<{ elements: Produced[]; availableByArea: Map<string, number> }> {
    const candidates = await this.activities.find({
      where: { status: In(REGISTRABLE_STATUSES) },
      relations: { category: true },
    });

    // Una actividad cuya fecha ya paso no admite inscripcion (mismo criterio
    // que ActivitiesService.registrationBlockReason).
    const open = candidates.filter((a) => !a.eventDate || a.eventDate.getTime() >= now.getTime());

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

    const windowEnd = now.getTime() + RULES.upcomingWindowDays * 24 * 60 * 60 * 1000;
    const elements: Produced[] = [];

    for (const a of available) {
      const reasons: RecommendationReason[] = [];
      const area = a.academicAreaId;
      const name = area ? areaName.get(area) : undefined;

      if (area && name) {
        const affinity = affinityByArea.get(area);
        if (affinity) {
          reasons.push({
            code: RecommendationReasonCode.AFFINITY_AREA,
            label: `Tienes afinidad ${LEVEL_LABEL[affinity.level]} con ${name}`,
            points: RULES.affinityPoints[affinity.level],
          });
        }
        const priority = preferredByArea.get(area);
        if (priority) {
          reasons.push({
            code: RecommendationReasonCode.PREFERRED_AREA,
            label: `${name} es un área de tu preferencia`,
            points: RULES.preferredAreaBase + priority,
          });
        }
        if (improvementIds.has(area)) {
          reasons.push({
            code: RecommendationReasonCode.IMPROVEMENT_AREA,
            label: `Quieres fortalecerte en ${name}`,
            points: RULES.improvementAreaPoints,
          });
        }
      }

      const haystack = normalize(
        [a.title, a.description, (a.tags ?? []).join(' '), a.category?.name].join(' '),
      );

      const interest = freeInterestNames.find((n) => matchesDeclaredTerm(haystack, n, 4));
      if (interest) {
        reasons.push({
          code: RecommendationReasonCode.FREE_INTEREST_MATCH,
          label: `Coincide con tu interés «${interest}»`,
          points: RULES.freeInterestPoints,
        });
      }

      const skill = skillNames.find((n) => matchesDeclaredTerm(haystack, n, 3));
      if (skill) {
        reasons.push({
          code: RecommendationReasonCode.SKILL_MATCH,
          label: `Relacionado con tu habilidad ${skill}`,
          points: RULES.skillMatchPoints,
        });
      }

      // Sin un motivo de relevancia no hay recomendacion. La fecha proxima solo
      // refuerza algo que ya es relevante.
      if (reasons.length === 0) continue;

      if (a.eventDate && a.eventDate.getTime() <= windowEnd) {
        reasons.push({
          code: RecommendationReasonCode.UPCOMING_DATE,
          label: `Se realiza pronto: ${this.formatDate(a.eventDate)}`,
          points: RULES.upcomingDatePoints,
        });
      }

      const score = this.sum(reasons);
      if (score < RULES.minElementScore) continue;

      elements.push({
        type: typeForCategory(a.category?.code),
        targetId: a.id,
        academicAreaId: area ?? null,
        title: a.title,
        description: a.description ? a.description.slice(0, 500) : null,
        targetLink: a.externalUrl,
        reasons,
        score,
        sortKey: `${a.eventDate ? a.eventDate.toISOString() : '9999'}|${a.title}`,
      });
    }

    return { elements, availableByArea };
  }

  // =========================================================================
  // Areas de fortalecimiento
  // =========================================================================

  /**
   * Un area se recomienda para fortalecer cuando al estudiante le importa -la
   * declaro como area de mejora o de preferencia- y todavia no tiene trayectoria
   * en ella, o tiene poca. Si ya tiene afinidad media o alta, no hace falta
   * fortalecerla.
   */
  private strengtheningCandidates(
    affinityByArea: Map<string, AffinityInfo>,
    preferredByArea: Map<string, number>,
    improvementIds: Set<string>,
    areaName: Map<string, string>,
    availableByArea: Map<string, number>,
  ): Produced[] {
    const candidateAreas = new Set([...improvementIds, ...preferredByArea.keys()]);
    const result: Produced[] = [];

    for (const areaId of candidateAreas) {
      const name = areaName.get(areaId);
      if (!name) continue;

      const affinity = affinityByArea.get(areaId);
      if (affinity && affinity.level !== AffinityLevel.LOW) continue;

      const reasons: RecommendationReason[] = [];
      if (improvementIds.has(areaId)) {
        reasons.push({
          code: RecommendationReasonCode.IMPROVEMENT_AREA,
          label: `Declaraste que quieres mejorar en ${name}`,
          points: RULES.strengthening.improvementPoints,
        });
      }
      const priority = preferredByArea.get(areaId);
      if (priority) {
        reasons.push({
          code: RecommendationReasonCode.PREFERRED_AREA,
          label: `${name} es un área de tu preferencia`,
          points: priority,
        });
      }
      reasons.push(
        affinity
          ? {
              code: RecommendationReasonCode.LOW_TRAJECTORY,
              label: `Tu afinidad con ${name} todavía es baja`,
              points: RULES.strengthening.lowTrajectoryPoints,
            }
          : {
              code: RecommendationReasonCode.LOW_TRAJECTORY,
              label: `Todavía no tienes trayectoria registrada en ${name}`,
              points: RULES.strengthening.noTrajectoryPoints,
            },
      );

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
  // Posibles companeros de equipo
  // =========================================================================

  /**
   * Companeros con quienes el estudiante comparte trayectoria, o que pueden
   * aportar justo donde el quiere fortalecerse.
   *
   * Privacidad: solo participan estudiantes con cuenta activa que aceptaron
   * aparecer en sugerencias. De cada companero se guarda su nombre, su semestre
   * y las areas que justifican la sugerencia; nunca su correo, sus puntajes ni
   * sus proyectos.
   *
   * Quien ya trabaja con el estudiante en un proyecto no se sugiere: ya forman
   * equipo.
   */
  private async teammateCandidates(
    profile: StudentProfile,
    affinityByArea: Map<string, AffinityInfo>,
    preferredByArea: Map<string, number>,
    improvementIds: Set<string>,
    areaName: Map<string, string>,
  ): Promise<Produced[]> {
    const strongAreas = new Set(
      [...affinityByArea.entries()]
        .filter(([, a]) => a.level !== AffinityLevel.LOW)
        .map(([id]) => id),
    );
    const wantsToGrow = new Set(
      [...improvementIds, ...preferredByArea.keys()].filter((id) => {
        const a = affinityByArea.get(id);
        return !a || a.level === AffinityLevel.LOW;
      }),
    );
    if (strongAreas.size === 0 && wantsToGrow.size === 0) return [];

    const peers = await this.profiles
      .createQueryBuilder('p')
      .innerJoin('p.user', 'u')
      .select('p.id', 'profileId')
      .addSelect('p.semester', 'semester')
      .addSelect('u.id', 'userId')
      .addSelect("CONCAT(u.first_name, ' ', u.last_name)", 'name')
      .where('p.id <> :me', { me: profile.id })
      .andWhere('p.peer_discoverable = true')
      .andWhere('u.status = :active', { active: UserStatus.ACTIVE })
      .getRawMany<{ profileId: string; semester: number | null; userId: string; name: string }>();
    if (peers.length === 0) return [];

    const alreadyTeam = await this.currentTeammates(profile);

    const peerAffinities = await this.affinities.find({
      where: {
        studentProfileId: In(peers.map((p) => p.profileId)),
        level: In([AffinityLevel.MEDIUM, AffinityLevel.HIGH]),
      },
    });
    const byPeer = new Map<string, AffinityResult[]>();
    for (const row of peerAffinities) {
      const list = byPeer.get(row.studentProfileId) ?? [];
      list.push(row);
      byPeer.set(row.studentProfileId, list);
    }

    const result: Produced[] = [];
    for (const peer of peers) {
      if (alreadyTeam.has(peer.userId)) continue;
      const rows = (byPeer.get(peer.profileId) ?? []).sort((a, b) => Number(b.score) - Number(a.score));

      const reasons: RecommendationReason[] = [];
      const shared = rows
        .filter((r) => strongAreas.has(r.academicAreaId) && areaName.has(r.academicAreaId))
        .slice(0, RULES.teammate.maxSharedAreas);
      for (const r of shared) {
        reasons.push({
          code: RecommendationReasonCode.SHARED_AFFINITY,
          label: `Comparten trayectoria en ${areaName.get(r.academicAreaId)}`,
          points: RULES.teammate.sharedAreaPoints,
        });
      }

      const complementary = rows
        .filter(
          (r) =>
            r.level === AffinityLevel.HIGH &&
            wantsToGrow.has(r.academicAreaId) &&
            areaName.has(r.academicAreaId),
        )
        .slice(0, RULES.teammate.maxComplementaryAreas);
      for (const r of complementary) {
        reasons.push({
          code: RecommendationReasonCode.COMPLEMENTARY_PROFILE,
          label: `Puede aportar en ${areaName.get(r.academicAreaId)}, donde quieres fortalecerte`,
          points: RULES.teammate.complementaryPoints,
        });
      }

      const score = this.sum(reasons);
      if (score < RULES.teammate.minScore) continue;

      const semester = peer.semester === null ? null : Number(peer.semester);
      const distance = semester && profile.semester ? Math.abs(semester - profile.semester) : 9;
      result.push({
        type: RecommendationType.TEAMMATE,
        targetId: peer.profileId,
        academicAreaId: (complementary[0] ?? shared[0])?.academicAreaId ?? null,
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
    const projectIds = [...new Set([...owned.map((p) => p.id), ...memberships.map((m) => m.projectId)])];
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
    return Number(reasons.reduce((acc, r) => acc + r.points, 0).toFixed(2));
  }

  private formatDate(date: Date): string {
    return date.toLocaleDateString('es-BO', { day: 'numeric', month: 'long', year: 'numeric' });
  }
}
