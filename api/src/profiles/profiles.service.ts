import {
  BadRequestException,
  ConflictException,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, Repository } from 'typeorm';
import { ProfileStatus } from '@perfil/shared';
import { StudentProfile } from '../entities/student-profile.entity';
import { StudentInterest } from '../entities/student-interest.entity';
import { StudentSkill } from '../entities/student-skill.entity';
import { AcademicArea } from '../entities/academic-area.entity';
import { Skill } from '../entities/skill.entity';
import { Project } from '../entities/project.entity';
import { ProjectMember } from '../entities/project-member.entity';
import { ProjectEvidence } from '../entities/project-evidence.entity';
import { ActivityRegistration } from '../entities/activity-registration.entity';
import { ExternalCertificate } from '../entities/external-certificate.entity';
import { InternalConstancy } from '../entities/internal-constancy.entity';
import { AffinityResult } from '../entities/affinity-result.entity';
import { CreateProfileDto } from './dto/create-profile.dto';
import { UpdateProfileDto } from './dto/update-profile.dto';
import { InterestItemDto } from './dto/set-interests.dto';
import { SkillItemDto } from './dto/set-skills.dto';
import {
  AFFINITY_RECALCULATION,
  AffinityRecalculationPort,
} from '../affinity-recalc/affinity-recalculation.port';

@Injectable()
export class ProfilesService {
  constructor(
    @InjectRepository(StudentProfile) private readonly profiles: Repository<StudentProfile>,
    @InjectRepository(StudentInterest) private readonly interests: Repository<StudentInterest>,
    @InjectRepository(StudentSkill) private readonly skills: Repository<StudentSkill>,
    @InjectRepository(AcademicArea) private readonly areas: Repository<AcademicArea>,
    @InjectRepository(Skill) private readonly skillCatalog: Repository<Skill>,
    @InjectRepository(Project) private readonly projects: Repository<Project>,
    @InjectRepository(ProjectMember) private readonly projectMembers: Repository<ProjectMember>,
    @InjectRepository(ProjectEvidence) private readonly evidences: Repository<ProjectEvidence>,
    @InjectRepository(ActivityRegistration)
    private readonly registrations: Repository<ActivityRegistration>,
    @InjectRepository(ExternalCertificate)
    private readonly certificates: Repository<ExternalCertificate>,
    @InjectRepository(InternalConstancy)
    private readonly constancies: Repository<InternalConstancy>,
    @InjectRepository(AffinityResult) private readonly affinities: Repository<AffinityResult>,
    @Inject(AFFINITY_RECALCULATION)
    private readonly affinityRecalculation: AffinityRecalculationPort,
  ) {}

  async createMyProfile(userId: string, dto: CreateProfileDto): Promise<StudentProfile> {
    const existing = await this.profiles.findOne({ where: { userId } });
    if (existing) {
      throw new ConflictException('El estudiante ya tiene un perfil creado.');
    }
    await this.assertAreasExist(dto.improvementAreaIds);

    const profile = this.profiles.create({
      userId,
      universityCode: dto.universityCode ?? null,
      semester: dto.semester ?? null,
      bio: dto.bio ?? null,
      improvementAreaIds: dto.improvementAreaIds ?? null,
      status: ProfileStatus.INCOMPLETE,
      completionPercentage: 0,
    });
    const saved = await this.profiles.save(profile);
    await this.refreshCompletion(saved.id);
    await this.requestAffinity(saved.id);
    return this.getOwnProfile(userId);
  }

  async getOwnProfile(userId: string): Promise<StudentProfile> {
    const profile = await this.profiles.findOne({ where: { userId } });
    if (!profile) {
      throw new NotFoundException('Aún no has creado tu perfil estudiantil.');
    }
    return profile;
  }

  async updateMyProfile(userId: string, dto: UpdateProfileDto): Promise<StudentProfile> {
    const profile = await this.getOwnProfile(userId);
    if (dto.improvementAreaIds !== undefined) {
      await this.assertAreasExist(dto.improvementAreaIds);
      profile.improvementAreaIds = dto.improvementAreaIds;
    }
    if (dto.semester !== undefined) profile.semester = dto.semester;
    if (dto.bio !== undefined) profile.bio = dto.bio;
    await this.profiles.save(profile);
    await this.refreshCompletion(profile.id);
    await this.requestAffinity(profile.id);
    return this.getOwnProfile(userId);
  }

  async addInterests(userId: string, items: InterestItemDto[]): Promise<StudentInterest[]> {
    const profile = await this.getOwnProfile(userId);
    await this.assertAreasExist(items.map((i) => i.academicAreaId));
    for (const item of items) {
      const existing = await this.interests.findOne({
        where: { studentProfileId: profile.id, academicAreaId: item.academicAreaId },
      });
      if (existing) {
        existing.priority = item.priority;
        await this.interests.save(existing);
      } else {
        await this.interests.save(
          this.interests.create({
            studentProfileId: profile.id,
            academicAreaId: item.academicAreaId,
            priority: item.priority,
          }),
        );
      }
    }
    await this.afterProfileChange(profile.id);
    return this.interests.find({
      where: { studentProfileId: profile.id },
      relations: { academicArea: true },
    });
  }

  async replaceInterests(userId: string, items: InterestItemDto[]): Promise<StudentInterest[]> {
    const profile = await this.getOwnProfile(userId);
    await this.assertAreasExist(items.map((i) => i.academicAreaId));
    await this.interests.delete({ studentProfileId: profile.id });
    if (items.length > 0) {
      await this.interests.save(
        items.map((item) =>
          this.interests.create({
            studentProfileId: profile.id,
            academicAreaId: item.academicAreaId,
            priority: item.priority,
          }),
        ),
      );
    }
    await this.afterProfileChange(profile.id);
    return this.interests.find({
      where: { studentProfileId: profile.id },
      relations: { academicArea: true },
    });
  }

  async addSkills(userId: string, items: SkillItemDto[]): Promise<StudentSkill[]> {
    const profile = await this.getOwnProfile(userId);
    await this.assertSkillsExist(items.map((i) => i.skillId));
    for (const item of items) {
      const existing = await this.skills.findOne({
        where: { studentProfileId: profile.id, skillId: item.skillId },
      });
      if (existing) {
        existing.level = item.level;
        await this.skills.save(existing);
      } else {
        await this.skills.save(
          this.skills.create({
            studentProfileId: profile.id,
            skillId: item.skillId,
            level: item.level,
          }),
        );
      }
    }
    await this.afterProfileChange(profile.id);
    return this.skills.find({
      where: { studentProfileId: profile.id },
      relations: { skill: true },
    });
  }

  async replaceSkills(userId: string, items: SkillItemDto[]): Promise<StudentSkill[]> {
    const profile = await this.getOwnProfile(userId);
    await this.assertSkillsExist(items.map((i) => i.skillId));
    await this.skills.delete({ studentProfileId: profile.id });
    if (items.length > 0) {
      await this.skills.save(
        items.map((item) =>
          this.skills.create({
            studentProfileId: profile.id,
            skillId: item.skillId,
            level: item.level,
          }),
        ),
      );
    }
    await this.afterProfileChange(profile.id);
    return this.skills.find({
      where: { studentProfileId: profile.id },
      relations: { skill: true },
    });
  }

  async getSummary(userId: string) {
    const profile = await this.getOwnProfile(userId);
    return this.buildSummary(profile, { includeInternal: true });
  }

  async getAllowedView(profileId: string) {
    const profile = await this.profiles.findOne({
      where: { id: profileId },
      relations: { user: true },
    });
    if (!profile) {
      throw new NotFoundException('Perfil no encontrado.');
    }
    const summary = await this.buildSummary(profile, { includeInternal: false });
    return {
      profileId: profile.id,
      studentName: profile.user ? `${profile.user.firstName} ${profile.user.lastName}` : null,
      semester: profile.semester,
      status: profile.status,
      bio: profile.bio,
      improvementAreas: summary.improvementAreas,
      interests: summary.interests,
      skills: summary.skills,
      projects: summary.projects.map((p) => ({
        title: p.title,
        status: p.status,
        technologies: p.technologies,
      })),
      activities: summary.activities.map((a) => ({
        title: a.title,
        type: a.type,
        status: a.status,
      })),
      externalCertificates: summary.externalCertificates.map((c) => ({
        title: c.title,
        issuer: c.issuer,
      })),
      affinities: summary.affinities,
    };
  }

  private async buildSummary(
    profile: StudentProfile,
    options: { includeInternal: boolean },
  ) {
    const [interests, skills, ownedProjects, memberships, certificates, affinities] =
      await Promise.all([
        this.interests.find({
          where: { studentProfileId: profile.id },
          relations: { academicArea: true },
          order: { priority: 'DESC' },
        }),
        this.skills.find({
          where: { studentProfileId: profile.id },
          relations: { skill: true },
          order: { level: 'DESC' },
        }),
        this.projects.find({ where: { ownerId: profile.userId } }),
        this.projectMembers.find({
          where: { userId: profile.userId },
          relations: { project: true },
        }),
        this.certificates.find({ where: { studentProfileId: profile.id } }),
        this.affinities.find({
          where: { studentProfileId: profile.id },
          relations: { academicArea: true },
          order: { score: 'DESC' },
        }),
      ]);

    const projectsMap = new Map<string, Project>();
    ownedProjects.forEach((p) => projectsMap.set(p.id, p));
    memberships.forEach((m) => {
      if (m.project) projectsMap.set(m.project.id, m.project);
    });
    const projects = [...projectsMap.values()];
    const projectIds = projects.map((p) => p.id);

    const [evidences, registrations] = await Promise.all([
      projectIds.length
        ? this.evidences.find({ where: { projectId: In(projectIds) } })
        : Promise.resolve([]),
      this.registrations.find({
        where: { studentProfileId: profile.id },
        relations: { activity: true },
      }),
    ]);

    const improvementAreas = await this.resolveAreas(profile.improvementAreaIds);

    const summary = {
      profile: {
        id: profile.id,
        universityCode: profile.universityCode,
        semester: profile.semester,
        bio: profile.bio,
        status: profile.status,
        completionPercentage: profile.completionPercentage,
      },
      improvementAreas,
      interests: interests.map((i) => ({
        academicAreaId: i.academicAreaId,
        area: i.academicArea?.name ?? null,
        priority: i.priority,
      })),
      skills: skills.map((s) => ({
        skillId: s.skillId,
        skill: s.skill?.name ?? null,
        level: s.level,
      })),
      projects: projects.map((p) => ({
        id: p.id,
        title: p.title,
        status: p.status,
        technologies: p.technologies,
      })),
      evidences: evidences.map((e) => ({
        id: e.id,
        title: e.title,
        type: e.type,
        url: e.url,
        projectId: e.projectId,
      })),
      activities: registrations.map((r) => ({
        registrationId: r.id,
        activityId: r.activityId,
        title: r.activity?.title ?? null,
        type: r.activity?.type ?? null,
        status: r.status,
      })),
      externalCertificates: certificates.map((c) => ({
        id: c.id,
        title: c.title,
        issuer: c.issuer,
        url: c.url,
      })),
      affinities: affinities.map((a) => ({
        academicAreaId: a.academicAreaId,
        area: a.academicArea?.name ?? null,
        score: Number(a.score),
        level: a.level,
      })),
      internalConstancies: [] as Array<{ id: string; title: string; type: string | null }>,
    };

    if (options.includeInternal) {
      const constancies = await this.constancies.find({
        where: { studentProfileId: profile.id },
      });
      summary.internalConstancies = constancies.map((c) => ({
        id: c.id,
        title: c.title,
        type: c.type,
      }));
    }

    return summary;
  }

  private async afterProfileChange(profileId: string): Promise<void> {
    await this.refreshCompletion(profileId);
    await this.requestAffinity(profileId);
  }

  private async refreshCompletion(profileId: string): Promise<void> {
    const profile = await this.profiles.findOne({ where: { id: profileId } });
    if (!profile) return;

    const [interestCount, skillCount] = await Promise.all([
      this.interests.count({ where: { studentProfileId: profileId } }),
      this.skills.count({ where: { studentProfileId: profileId } }),
    ]);

    let percentage = 0;
    if (profile.semester) percentage += 20;
    if (profile.bio && profile.bio.trim().length > 0) percentage += 20;
    if (interestCount > 0) percentage += 20;
    if (skillCount > 0) percentage += 20;
    if (profile.improvementAreaIds && profile.improvementAreaIds.length > 0) percentage += 20;

    profile.completionPercentage = percentage;
    if (percentage < 100) {
      profile.status = ProfileStatus.INCOMPLETE;
    } else if (profile.status === ProfileStatus.INCOMPLETE) {
      profile.status = ProfileStatus.ACTIVE;
    } else {
      profile.status = ProfileStatus.UPDATED;
    }
    await this.profiles.save(profile);
  }

  private async requestAffinity(profileId: string): Promise<void> {
    await this.affinityRecalculation.requestRecalculation(profileId);
  }

  private async resolveAreas(ids: string[] | null) {
    if (!ids || ids.length === 0) return [];
    const areas = await this.areas.find({ where: { id: In(ids) } });
    return areas.map((a) => ({ id: a.id, name: a.name }));
  }

  private async assertAreasExist(ids?: string[]): Promise<void> {
    if (!ids || ids.length === 0) return;
    const unique = [...new Set(ids)];
    const count = await this.areas.count({ where: { id: In(unique) } });
    if (count !== unique.length) {
      throw new BadRequestException('Una o más áreas académicas no existen.');
    }
  }

  private async assertSkillsExist(ids: string[]): Promise<void> {
    if (ids.length === 0) return;
    const unique = [...new Set(ids)];
    const count = await this.skillCatalog.count({ where: { id: In(unique) } });
    if (count !== unique.length) {
      throw new BadRequestException('Una o más habilidades no existen en el catálogo.');
    }
  }
}
