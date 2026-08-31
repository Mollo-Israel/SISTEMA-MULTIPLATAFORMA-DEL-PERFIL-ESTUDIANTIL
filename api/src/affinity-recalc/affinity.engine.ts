import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { AffinityLevel, RegistrationStatus } from '@perfil/shared';
import { StudentProfile } from '../entities/student-profile.entity';
import { StudentInterest } from '../entities/student-interest.entity';
import { StudentSkill } from '../entities/student-skill.entity';
import { AcademicArea } from '../entities/academic-area.entity';
import { ActivityRegistration } from '../entities/activity-registration.entity';
import { Project } from '../entities/project.entity';
import { ProjectEvidence } from '../entities/project-evidence.entity';
import { ExternalCertificate } from '../entities/external-certificate.entity';
import { InternalConstancy } from '../entities/internal-constancy.entity';
import { AffinityResult } from '../entities/affinity-result.entity';
import { AffinityRecalculationPort } from './affinity-recalculation.port';

interface AreaInfo {
  id: string;
  name: string;
  tags: string[];
}

const POINTS = {
  INTEREST: 2,
  IMPROVEMENT_AREA: 1,
  ACTIVITY_INTEREST: 1,
  ACTIVITY_REGISTERED: 2,
  ACTIVITY_CONFIRMED: 3,
  PROJECT: 5,
  EVIDENCE: 2,
  CERTIFICATE: 4,
  CONSTANCY: 3,
};

@Injectable()
export class AffinityEngineService implements AffinityRecalculationPort {
  constructor(
    @InjectRepository(StudentProfile) private readonly profiles: Repository<StudentProfile>,
    @InjectRepository(StudentInterest) private readonly interests: Repository<StudentInterest>,
    @InjectRepository(StudentSkill) private readonly skills: Repository<StudentSkill>,
    @InjectRepository(AcademicArea) private readonly areas: Repository<AcademicArea>,
    @InjectRepository(ActivityRegistration)
    private readonly registrations: Repository<ActivityRegistration>,
    @InjectRepository(Project) private readonly projects: Repository<Project>,
    @InjectRepository(ProjectEvidence) private readonly evidences: Repository<ProjectEvidence>,
    @InjectRepository(ExternalCertificate)
    private readonly certificates: Repository<ExternalCertificate>,
    @InjectRepository(InternalConstancy)
    private readonly constancies: Repository<InternalConstancy>,
    @InjectRepository(AffinityResult) private readonly results: Repository<AffinityResult>,
  ) {}

  async requestRecalculation(studentProfileId: string): Promise<void> {
    await this.recalculate(studentProfileId);
  }

  async recalculate(studentProfileId: string): Promise<AffinityResult[]> {
    const profile = await this.profiles.findOne({ where: { id: studentProfileId } });
    if (!profile) {
      throw new NotFoundException('Perfil no encontrado.');
    }

    const areaList = await this.areas.find();
    const areas: AreaInfo[] = areaList.map((a) => ({
      id: a.id,
      name: a.name.toLowerCase(),
      tags: (a.tags ?? []).map((t) => t.toLowerCase()),
    }));
    const scores = new Map<string, number>();
    const add = (areaId: string | null | undefined, points: number) => {
      if (!areaId) return;
      scores.set(areaId, (scores.get(areaId) ?? 0) + points);
    };

    // 1. Intereses declarados
    const interests = await this.interests.find({ where: { studentProfileId } });
    interests.forEach((i) => add(i.academicAreaId, POINTS.INTEREST));

    // 2. Habilidades declaradas (segun nivel)
    const studentSkills = await this.skills.find({
      where: { studentProfileId },
      relations: { skill: true },
    });
    studentSkills.forEach((s) => {
      if (s.skill?.academicAreaId) {
        add(s.skill.academicAreaId, this.skillPoints(s.level));
      }
    });

    // 3. Areas donde desea mejorar
    (profile.improvementAreaIds ?? []).forEach((id) => add(id, POINTS.IMPROVEMENT_AREA));

    // 4-6. Actividades (interes / inscripcion / participacion confirmada)
    const registrations = await this.registrations.find({
      where: { studentProfileId },
      relations: { activity: true },
    });
    registrations.forEach((r) => {
      const areaId = r.activity?.academicAreaId;
      if (!areaId) return;
      if (r.status === RegistrationStatus.INTERESTED) add(areaId, POINTS.ACTIVITY_INTEREST);
      else if (r.status === RegistrationStatus.REGISTERED) add(areaId, POINTS.ACTIVITY_REGISTERED);
      else if (r.status === RegistrationStatus.CONFIRMED) add(areaId, POINTS.ACTIVITY_CONFIRMED);
    });

    // 7-9. Proyectos, tecnologias y evidencias
    const projects = await this.projects.find({ where: { createdByProfileId: studentProfileId } });
    const areasByProject = new Map<string, string[]>();
    for (const project of projects) {
      const projectAreas = project.academicAreaId
        ? [project.academicAreaId]
        : this.inferAreasByTech(project.technologies, areas);
      areasByProject.set(project.id, projectAreas);
      projectAreas.forEach((areaId) => add(areaId, POINTS.PROJECT));
    }

    // Todas las evidencias del estudiante en una sola consulta (antes se
    // consultaba una vez por proyecto). Una evidencia puntua en el area que
    // declara, o en la de la actividad, o en las del proyecto que respalda.
    const evidences = await this.evidences.find({
      where: { studentProfileId },
      relations: { activity: true },
    });
    for (const evidence of evidences) {
      if (evidence.academicAreaId) {
        add(evidence.academicAreaId, POINTS.EVIDENCE);
      } else if (evidence.activity?.academicAreaId) {
        add(evidence.activity.academicAreaId, POINTS.EVIDENCE);
      } else if (evidence.projectId) {
        (areasByProject.get(evidence.projectId) ?? []).forEach((areaId) =>
          add(areaId, POINTS.EVIDENCE),
        );
      }
    }

    // 10. Certificados externos: el area declarada manda; si no hay, se infiere
    // por coincidencia de texto con el nombre y las etiquetas del area.
    const certs = await this.certificates.find({ where: { studentProfileId } });
    certs.forEach((c) => {
      if (c.academicAreaId) {
        add(c.academicAreaId, POINTS.CERTIFICATE);
        return;
      }
      const matched = this.matchAreasByText(`${c.certificateName} ${c.issuer}`, areas);
      matched.forEach((areaId) => add(areaId, POINTS.CERTIFICATE));
    });

    // 11. Constancias internas (por actividad o coincidencia de texto)
    const constancies = await this.constancies.find({
      where: { studentProfileId },
      relations: { activity: true },
    });
    constancies.forEach((c) => {
      if (c.activity?.academicAreaId) {
        add(c.activity.academicAreaId, POINTS.CONSTANCY);
      } else {
        const matched = this.matchAreasByText(c.description, areas);
        matched.forEach((areaId) => add(areaId, POINTS.CONSTANCY));
      }
    });

    return this.persist(studentProfileId, scores);
  }

  async getForProfile(studentProfileId: string): Promise<AffinityResult[]> {
    return this.results.find({
      where: { studentProfileId },
      relations: { academicArea: true },
      order: { score: 'DESC' },
    });
  }

  async resolveProfileIdByUser(userId: string): Promise<string> {
    const profile = await this.profiles.findOne({ where: { userId } });
    if (!profile) {
      throw new NotFoundException('Aún no has creado tu perfil estudiantil.');
    }
    return profile.id;
  }

  async assertProfileExists(studentProfileId: string): Promise<void> {
    const exists = await this.profiles.exists({ where: { id: studentProfileId } });
    if (!exists) {
      throw new NotFoundException('Perfil no encontrado.');
    }
  }

  async basicMap() {
    const rows = await this.results.find({ relations: { academicArea: true } });
    const map = new Map<
      string,
      { areaId: string; area: string; students: number; totalScore: number; low: number; medium: number; high: number }
    >();
    for (const r of rows) {
      const key = r.academicAreaId;
      const entry =
        map.get(key) ??
        {
          areaId: key,
          area: r.academicArea?.name ?? '',
          students: 0,
          totalScore: 0,
          low: 0,
          medium: 0,
          high: 0,
        };
      entry.students += 1;
      entry.totalScore += Number(r.score);
      if (r.level === AffinityLevel.LOW) entry.low += 1;
      else if (r.level === AffinityLevel.MEDIUM) entry.medium += 1;
      else entry.high += 1;
      map.set(key, entry);
    }
    return [...map.values()]
      .map((e) => ({
        areaId: e.areaId,
        area: e.area,
        students: e.students,
        averageScore: e.students ? Number((e.totalScore / e.students).toFixed(2)) : 0,
        byLevel: { low: e.low, medium: e.medium, high: e.high },
      }))
      .sort((a, b) => b.students - a.students);
  }

  private async persist(
    studentProfileId: string,
    scores: Map<string, number>,
  ): Promise<AffinityResult[]> {
    await this.results.delete({ studentProfileId });
    const toSave: AffinityResult[] = [];
    for (const [academicAreaId, score] of scores.entries()) {
      if (score <= 0) continue;
      toSave.push(
        this.results.create({
          studentProfileId,
          academicAreaId,
          score,
          level: this.levelFor(score),
        }),
      );
    }
    if (toSave.length === 0) return [];
    await this.results.save(toSave);
    return this.getForProfile(studentProfileId);
  }

  private skillPoints(level: number): number {
    if (level <= 2) return 1;
    if (level === 3) return 2;
    return 3;
  }

  private levelFor(score: number): AffinityLevel {
    if (score <= 4) return AffinityLevel.LOW;
    if (score <= 10) return AffinityLevel.MEDIUM;
    return AffinityLevel.HIGH;
  }

  private inferAreasByTech(technologies: string[] | null, areas: AreaInfo[]): string[] {
    if (!technologies || technologies.length === 0) return [];
    const techs = technologies.map((t) => t.toLowerCase());
    const matched = new Set<string>();
    for (const area of areas) {
      const hit = techs.some((tech) =>
        area.tags.some((tag) => tech.includes(tag) || tag.includes(tech)),
      );
      if (hit) matched.add(area.id);
    }
    return [...matched];
  }

  private matchAreasByText(text: string, areas: AreaInfo[]): string[] {
    const normalized = text.toLowerCase();
    const matched = new Set<string>();
    for (const area of areas) {
      const hit =
        normalized.includes(area.name) || area.tags.some((tag) => normalized.includes(tag));
      if (hit) matched.add(area.id);
    }
    return [...matched];
  }
}
