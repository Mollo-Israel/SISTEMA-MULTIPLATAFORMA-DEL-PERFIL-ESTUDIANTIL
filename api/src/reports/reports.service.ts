import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ProfileStatus, RegistrationStatus } from '@perfil/shared';
import { StudentProfile } from '../entities/student-profile.entity';
import { StudentInterest } from '../entities/student-interest.entity';
import { StudentSkill } from '../entities/student-skill.entity';
import { Project } from '../entities/project.entity';
import { Activity } from '../entities/activity.entity';
import { ActivityRegistration } from '../entities/activity-registration.entity';
import { AffinityEngineService } from '../affinity-recalc/affinity.engine';
import { TeacherScopeService } from '../access/teacher-scope.service';
import { AuthenticatedUser } from '../auth/types/authenticated-user';

const num = (value: unknown): number => Number(value ?? 0);

/**
 * Semestres a los que se limita un reporte.
 *
 * `null` significa sin restriccion, y lo producen el director y el
 * administrador. Un arreglo vacio significa "ningun semestre habilitado" y
 * debe devolver cero filas: es lo que le corresponde a un docente al que
 * todavia no se le asigno alcance.
 */
type Scope = number[] | null;

/** ¿Este alcance no puede ver absolutamente nada? */
const isEmptyScope = (scope: Scope): boolean => Array.isArray(scope) && scope.length === 0;

@Injectable()
export class ReportsService {
  constructor(
    @InjectRepository(StudentProfile) private readonly profiles: Repository<StudentProfile>,
    @InjectRepository(StudentInterest) private readonly interests: Repository<StudentInterest>,
    @InjectRepository(StudentSkill) private readonly skills: Repository<StudentSkill>,
    @InjectRepository(Project) private readonly projects: Repository<Project>,
    @InjectRepository(Activity) private readonly activities: Repository<Activity>,
    @InjectRepository(ActivityRegistration)
    private readonly registrations: Repository<ActivityRegistration>,
    private readonly affinityEngine: AffinityEngineService,
    private readonly teacherScope: TeacherScopeService,
  ) {}

  // ---------- Docente ----------

  /**
   * Panel del docente, restringido a sus semestres habilitados (§68).
   *
   * Proteger el endpoint por rol no basta: hay que restringir el contenido.
   * Antes este metodo contaba todos los perfiles de la carrera y devolvia los
   * nombres de los estudiantes incompletos a cualquier docente.
   */
  async teacherOverview(user: AuthenticatedUser) {
    const scope = await this.teacherScope.scopeFor(user);
    if (isEmptyScope(scope)) return this.emptyTeacherOverview();

    const [total, byStatus, incomplete, topInterests, topTechnologies, participation] =
      await Promise.all([
        this.countProfiles(scope),
        this.profileStatusCounts(scope),
        this.incompleteStudents(scope),
        this.topInterestAreas(10, scope),
        this.topTechnologies(10, scope),
        this.participationCounts(scope),
      ]);

    return {
      students: { total, byStatus },
      incompleteStudents: { count: incomplete.length, list: incomplete },
      topInterests,
      topTechnologies,
      participation,
      group: {
        label: scope ? `Semestres ${scope.join(', ')}` : 'Cohorte general',
        description: scope
          ? 'Solo incluye estudiantes de los semestres habilitados para usted.'
          : 'Incluye a todos los estudiantes de la carrera.',
        students: total,
        semesters: scope,
      },
    };
  }

  /** Respuesta de un docente sin semestres asignados: vacia, no de la carrera. */
  private emptyTeacherOverview() {
    return {
      students: {
        total: 0,
        byStatus: {
          [ProfileStatus.INCOMPLETE]: 0,
          [ProfileStatus.ACTIVE]: 0,
          [ProfileStatus.UPDATED]: 0,
        },
      },
      incompleteStudents: { count: 0, list: [] as unknown[] },
      topInterests: [] as unknown[],
      topTechnologies: [] as unknown[],
      participation: {
        total: 0,
        byStatus: {
          [RegistrationStatus.INTERESTED]: 0,
          [RegistrationStatus.REGISTERED]: 0,
          [RegistrationStatus.CONFIRMED]: 0,
          [RegistrationStatus.ABSENT]: 0,
        },
      },
      group: {
        label: 'Sin semestres habilitados',
        description:
          'El administrador todavía no le asignó semestres. Hasta entonces no puede '
          + 'consultar información de estudiantes.',
        students: 0,
        semesters: [] as number[],
      },
    };
  }

  async teacherAffinitySummary(user: AuthenticatedUser) {
    const scope = await this.teacherScope.scopeFor(user);
    if (isEmptyScope(scope)) return { groupAffinity: [], topInterests: [], semesters: [] };

    const [groupAffinity, topInterests] = await Promise.all([
      this.affinityEngine.basicMap(scope ?? undefined),
      this.topInterestAreas(10, scope),
    ]);
    return { groupAffinity, topInterests, semesters: scope };
  }

  async teacherProjectsSummary(user: AuthenticatedUser) {
    const scope = await this.teacherScope.scopeFor(user);
    if (isEmptyScope(scope)) {
      return { total: 0, byStatus: [], byArea: [], topTechnologies: [], recent: [], semesters: [] };
    }

    const [total, byStatus, byArea, topTechnologies, recent] = await Promise.all([
      this.countProjects(scope),
      this.projectStatusCounts(scope),
      this.projectsByArea(scope),
      this.topTechnologies(10, scope),
      this.recentProjects(10, scope),
    ]);
    return { total, byStatus, byArea, topTechnologies, recent, semesters: scope };
  }

  // ---------- Director ----------

  async directorOverview() {
    const [students, projects, activities, registrations, topActivities, topInterests, skillDistribution, trends] =
      await Promise.all([
        this.profiles.count(),
        this.projects.count(),
        this.activities.count(),
        this.registrations.count(),
        this.topActivitiesByRegistrations(10),
        this.topInterestAreas(10, null),
        this.skillDistribution(15),
        this.descriptiveTrends(),
      ]);

    return {
      totals: { students, projects, activities, registrations },
      topActivitiesByRegistrations: topActivities,
      topInterestAreas: topInterests,
      skillDistribution,
      trends,
    };
  }

  async directorParticipationBySemester() {
    const rows = await this.registrations
      .createQueryBuilder('r')
      .leftJoin('r.studentProfile', 'p')
      .select('p.semester', 'semester')
      .addSelect('r.status', 'status')
      .addSelect('COUNT(*)', 'count')
      .groupBy('p.semester')
      .addGroupBy('r.status')
      .orderBy('p.semester', 'ASC')
      .getRawMany();

    const bySemester = new Map<string, { semester: number | null; total: number; byStatus: Record<string, number> }>();
    for (const row of rows) {
      const key = row.semester === null ? 'sin_semestre' : String(row.semester);
      const entry =
        bySemester.get(key) ?? {
          semester: row.semester === null ? null : num(row.semester),
          total: 0,
          byStatus: {
            [RegistrationStatus.INTERESTED]: 0,
            [RegistrationStatus.REGISTERED]: 0,
            [RegistrationStatus.CONFIRMED]: 0,
            [RegistrationStatus.ABSENT]: 0,
          },
        };
      entry.byStatus[row.status] = num(row.count);
      entry.total += num(row.count);
      bySemester.set(key, entry);
    }
    return [...bySemester.values()];
  }

  directorAffinityMap() {
    return this.affinityEngine.basicMap();
  }

  async directorProjectsSummary() {
    const [total, byStatus, byArea] = await Promise.all([
      this.projects.count(),
      this.projectStatusCounts(null),
      this.projectsByArea(null),
    ]);
    return { total, byStatus, byArea };
  }

  // ---------- Helpers ----------

  /** Cuantos estudiantes entran en el alcance. */
  private async countProfiles(scope: Scope): Promise<number> {
    const qb = this.profiles.createQueryBuilder('p');
    if (scope) qb.andWhere('p.semester IN (:...scope)', { scope });
    return qb.getCount();
  }

  /** Proyectos cuyo responsable entra en el alcance. */
  private async countProjects(scope: Scope): Promise<number> {
    const qb = this.projects.createQueryBuilder('p');
    if (scope) {
      qb.innerJoin('p.createdByProfile', 'owner').andWhere(
        'owner.semester IN (:...scope)',
        { scope },
      );
    }
    return qb.getCount();
  }

  private async profileStatusCounts(scope: Scope) {
    const qb = this.profiles
      .createQueryBuilder('p')
      .select('p.status', 'status')
      .addSelect('COUNT(*)', 'count')
      .groupBy('p.status');
    if (scope) qb.andWhere('p.semester IN (:...scope)', { scope });
    const rows = await qb.getRawMany();
    const result = {
      [ProfileStatus.INCOMPLETE]: 0,
      [ProfileStatus.ACTIVE]: 0,
      [ProfileStatus.UPDATED]: 0,
    };
    rows.forEach((r) => (result[r.status] = num(r.count)));
    return result;
  }

  /**
   * Lista NOMINAL de estudiantes con el perfil incompleto.
   *
   * Es el dato mas sensible de este servicio: son nombres propios. Sin el
   * filtro de alcance, un docente de un semestre veia a los de toda la
   * carrera.
   */
  private async incompleteStudents(scope: Scope) {
    const qb = this.profiles
      .createQueryBuilder('p')
      .leftJoin('p.user', 'u')
      .where('p.status = :status', { status: ProfileStatus.INCOMPLETE })
      .select('p.id', 'profileId')
      .addSelect('p.completion_percentage', 'completionPercentage')
      .addSelect("CONCAT(u.first_name, ' ', u.last_name)", 'studentName')
      .orderBy('p.completion_percentage', 'ASC');
    if (scope) qb.andWhere('p.semester IN (:...scope)', { scope });
    const rows = await qb.getRawMany();
    return rows.map((r) => ({
      profileId: r.profileId,
      studentName: r.studentName,
      completionPercentage: num(r.completionPercentage),
    }));
  }

  private async topInterestAreas(limit: number, scope: Scope) {
    const qb = this.interests
      .createQueryBuilder('si')
      .leftJoin('si.academicArea', 'a')
      .select('a.name', 'area')
      .addSelect('COUNT(*)', 'count')
      .groupBy('a.name')
      .orderBy('count', 'DESC')
      .limit(limit);
    if (scope) {
      qb.innerJoin('si.studentProfile', 'sp').andWhere('sp.semester IN (:...scope)', { scope });
    }
    const rows = await qb.getRawMany();
    return rows.map((r) => ({ area: r.area, count: num(r.count) }));
  }

  private async topTechnologies(limit: number, scope: Scope) {
    const rows = scope
      ? await this.projects.query(
          `SELECT tech AS technology, COUNT(*)::int AS count
           FROM projects p
           JOIN student_profiles sp ON sp.id = p.created_by_profile_id,
                unnest(p.technologies) AS tech
           WHERE sp.semester = ANY($2::int[])
           GROUP BY tech
           ORDER BY count DESC
           LIMIT $1`,
          [limit, scope],
        )
      : await this.projects.query(
          `SELECT tech AS technology, COUNT(*)::int AS count
           FROM projects, unnest(technologies) AS tech
           GROUP BY tech
           ORDER BY count DESC
           LIMIT $1`,
          [limit],
        );
    return rows.map((r: { technology: string; count: number }) => ({
      technology: r.technology,
      count: num(r.count),
    }));
  }

  private async participationCounts(scope: Scope) {
    const qb = this.registrations
      .createQueryBuilder('r')
      .select('r.status', 'status')
      .addSelect('COUNT(*)', 'count')
      .groupBy('r.status');
    if (scope) {
      qb.innerJoin('r.studentProfile', 'sp').andWhere('sp.semester IN (:...scope)', { scope });
    }
    const rows = await qb.getRawMany();
    const byStatus = {
      [RegistrationStatus.INTERESTED]: 0,
      [RegistrationStatus.REGISTERED]: 0,
      [RegistrationStatus.CONFIRMED]: 0,
      [RegistrationStatus.ABSENT]: 0,
    };
    let total = 0;
    rows.forEach((r) => {
      byStatus[r.status] = num(r.count);
      total += num(r.count);
    });
    return { total, byStatus };
  }

  private async projectStatusCounts(scope: Scope) {
    const qb = this.projects
      .createQueryBuilder('p')
      .select('p.status', 'status')
      .addSelect('COUNT(*)', 'count')
      .groupBy('p.status');
    if (scope) {
      qb.innerJoin('p.createdByProfile', 'owner').andWhere('owner.semester IN (:...scope)', {
        scope,
      });
    }
    const rows = await qb.getRawMany();
    return rows.map((r) => ({ status: r.status, count: num(r.count) }));
  }

  private async projectsByArea(scope: Scope) {
    const qb = this.projects
      .createQueryBuilder('p')
      .leftJoin('p.academicArea', 'a')
      .select('a.name', 'area')
      .addSelect('COUNT(*)', 'count')
      .groupBy('a.name')
      .orderBy('count', 'DESC');
    if (scope) {
      qb.innerJoin('p.createdByProfile', 'owner').andWhere('owner.semester IN (:...scope)', {
        scope,
      });
    }
    const rows = await qb.getRawMany();
    return rows.map((r) => ({ area: r.area ?? 'Sin área', count: num(r.count) }));
  }

  private async recentProjects(limit: number, scope: Scope) {
    const qb = this.projects
      .createQueryBuilder('p')
      .leftJoinAndSelect('p.academicArea', 'academicArea')
      .orderBy('p.createdAt', 'DESC')
      .take(limit);
    if (scope) {
      qb.innerJoin('p.createdByProfile', 'owner').andWhere('owner.semester IN (:...scope)', {
        scope,
      });
    }
    const rows = await qb.getMany();
    return rows.map((p) => ({
      id: p.id,
      title: p.title,
      status: p.status,
      area: p.academicArea?.name ?? null,
      technologies: p.technologies ?? [],
    }));
  }

  private async topActivitiesByRegistrations(limit: number) {
    const rows = await this.registrations
      .createQueryBuilder('r')
      .leftJoin('r.activity', 'act')
      .select('act.title', 'activity')
      .addSelect('act.type', 'type')
      .addSelect('COUNT(*)', 'registrations')
      .groupBy('act.id')
      .addGroupBy('act.title')
      .addGroupBy('act.type')
      .orderBy('registrations', 'DESC')
      .limit(limit)
      .getRawMany();
    return rows.map((r) => ({ activity: r.activity, type: r.type, registrations: num(r.registrations) }));
  }

  private async skillDistribution(limit: number) {
    const rows = await this.skills
      .createQueryBuilder('ss')
      .leftJoin('ss.skill', 's')
      .leftJoin('s.academicArea', 'a')
      .select('s.name', 'skill')
      .addSelect('a.name', 'area')
      .addSelect('COUNT(*)', 'count')
      .groupBy('s.name')
      .addGroupBy('a.name')
      .orderBy('count', 'DESC')
      .limit(limit)
      .getRawMany();
    return rows.map((r) => ({ skill: r.skill, area: r.area ?? null, count: num(r.count) }));
  }

  private async descriptiveTrends() {
    const row = await this.profiles
      .createQueryBuilder('p')
      .select('AVG(p.completion_percentage)', 'avgCompletion')
      .addSelect('COUNT(*) FILTER (WHERE p.completion_percentage = 100)', 'complete')
      .addSelect('COUNT(*)', 'total')
      .getRawOne();
    const total = num(row?.total);
    const complete = num(row?.complete);
    return {
      averageProfileCompletion: Math.round(num(row?.avgCompletion)),
      profilesComplete: complete,
      profilesCompletePercentage: total ? Math.round((complete / total) * 100) : 0,
      note: 'Indicadores descriptivos; no representan rendimiento académico ni predicción.',
    };
  }
}
