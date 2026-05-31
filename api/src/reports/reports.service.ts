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

const num = (value: unknown): number => Number(value ?? 0);

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
  ) {}

  // ---------- Docente ----------

  async teacherOverview() {
    const [total, byStatus, incomplete, topInterests, topTechnologies, participation] =
      await Promise.all([
        this.profiles.count(),
        this.profileStatusCounts(),
        this.incompleteStudents(),
        this.topInterestAreas(10),
        this.topTechnologies(10),
        this.participationCounts(),
      ]);

    return {
      students: { total, byStatus },
      incompleteStudents: { count: incomplete.length, list: incomplete },
      topInterests,
      topTechnologies,
      participation,
      group: {
        label: 'Cohorte general',
        description: 'Agrupación por curso/grupo no disponible en el 30%; se reporta la cohorte completa.',
        students: total,
      },
    };
  }

  async teacherAffinitySummary() {
    const [groupAffinity, topInterests] = await Promise.all([
      this.affinityEngine.basicMap(),
      this.topInterestAreas(10),
    ]);
    return { groupAffinity, topInterests };
  }

  async teacherProjectsSummary() {
    const [total, byStatus, byArea, topTechnologies, recent] = await Promise.all([
      this.projects.count(),
      this.projectStatusCounts(),
      this.projectsByArea(),
      this.topTechnologies(10),
      this.recentProjects(10),
    ]);
    return { total, byStatus, byArea, topTechnologies, recent };
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
        this.topInterestAreas(10),
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
      this.projectStatusCounts(),
      this.projectsByArea(),
    ]);
    return { total, byStatus, byArea };
  }

  // ---------- Helpers ----------

  private async profileStatusCounts() {
    const rows = await this.profiles
      .createQueryBuilder('p')
      .select('p.status', 'status')
      .addSelect('COUNT(*)', 'count')
      .groupBy('p.status')
      .getRawMany();
    const result = {
      [ProfileStatus.INCOMPLETE]: 0,
      [ProfileStatus.ACTIVE]: 0,
      [ProfileStatus.UPDATED]: 0,
    };
    rows.forEach((r) => (result[r.status] = num(r.count)));
    return result;
  }

  private async incompleteStudents() {
    const rows = await this.profiles
      .createQueryBuilder('p')
      .leftJoin('p.user', 'u')
      .where('p.status = :status', { status: ProfileStatus.INCOMPLETE })
      .select('p.id', 'profileId')
      .addSelect('p.completion_percentage', 'completionPercentage')
      .addSelect("CONCAT(u.first_name, ' ', u.last_name)", 'studentName')
      .orderBy('p.completion_percentage', 'ASC')
      .getRawMany();
    return rows.map((r) => ({
      profileId: r.profileId,
      studentName: r.studentName,
      completionPercentage: num(r.completionPercentage),
    }));
  }

  private async topInterestAreas(limit: number) {
    const rows = await this.interests
      .createQueryBuilder('si')
      .leftJoin('si.academicArea', 'a')
      .select('a.name', 'area')
      .addSelect('COUNT(*)', 'count')
      .groupBy('a.name')
      .orderBy('count', 'DESC')
      .limit(limit)
      .getRawMany();
    return rows.map((r) => ({ area: r.area, count: num(r.count) }));
  }

  private async topTechnologies(limit: number) {
    const rows = await this.projects.query(
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

  private async participationCounts() {
    const rows = await this.registrations
      .createQueryBuilder('r')
      .select('r.status', 'status')
      .addSelect('COUNT(*)', 'count')
      .groupBy('r.status')
      .getRawMany();
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

  private async projectStatusCounts() {
    const rows = await this.projects
      .createQueryBuilder('p')
      .select('p.status', 'status')
      .addSelect('COUNT(*)', 'count')
      .groupBy('p.status')
      .getRawMany();
    return rows.map((r) => ({ status: r.status, count: num(r.count) }));
  }

  private async projectsByArea() {
    const rows = await this.projects
      .createQueryBuilder('p')
      .leftJoin('p.academicArea', 'a')
      .select('a.name', 'area')
      .addSelect('COUNT(*)', 'count')
      .groupBy('a.name')
      .orderBy('count', 'DESC')
      .getRawMany();
    return rows.map((r) => ({ area: r.area ?? 'Sin área', count: num(r.count) }));
  }

  private async recentProjects(limit: number) {
    const rows = await this.projects.find({
      relations: { academicArea: true },
      order: { createdAt: 'DESC' },
      take: limit,
    });
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
