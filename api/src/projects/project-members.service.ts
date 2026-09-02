import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, Repository } from 'typeorm';
import { ProjectInvitationStatus, RolNombre, UserStatus } from '@perfil/shared';
import { Project } from '../entities/project.entity';
import { ProjectMember } from '../entities/project-member.entity';
import { ProjectInvitation } from '../entities/project-invitation.entity';
import { StudentProfile } from '../entities/student-profile.entity';
import { AuthenticatedUser } from '../auth/types/authenticated-user';
import { InviteMemberDto } from './dto/invite-member.dto';
import {
  AFFINITY_RECALCULATION,
  AffinityRecalculationPort,
} from '../affinity-recalc/affinity-recalculation.port';

/**
 * Integrantes e invitaciones de un proyecto (RF14).
 *
 * La regla central del documento: el estudiante invitado solo queda asociado al
 * proyecto DESPUES de aceptar. Una invitacion pendiente o rechazada no genera
 * pertenencia, no aparece en el portafolio del invitado y no alimenta su perfil.
 */
@Injectable()
export class ProjectMembersService {
  constructor(
    @InjectRepository(Project) private readonly projects: Repository<Project>,
    @InjectRepository(ProjectMember) private readonly members: Repository<ProjectMember>,
    @InjectRepository(ProjectInvitation)
    private readonly invitations: Repository<ProjectInvitation>,
    @InjectRepository(StudentProfile) private readonly profiles: Repository<StudentProfile>,
    @Inject(AFFINITY_RECALCULATION)
    private readonly affinityRecalculation: AffinityRecalculationPort,
  ) {}

  // ------------------------------------------------------------------
  // Envio de invitaciones (estudiante responsable)
  // ------------------------------------------------------------------

  async invite(
    user: AuthenticatedUser,
    projectId: string,
    dto: InviteMemberDto,
  ): Promise<ProjectInvitation> {
    const project = await this.requireOwnedProject(user, projectId);

    const invited = await this.profiles.findOne({
      where: { id: dto.invitedProfileId },
      relations: { user: { role: true } },
    });
    if (!invited) {
      throw new BadRequestException('El estudiante invitado no existe.');
    }
    // Solo se invita a estudiantes: el perfil estudiantil ya lo garantiza, pero
    // se verifica el rol por si la cuenta cambio de rol despues de crearse.
    if (invited.user?.role?.name !== RolNombre.STUDENT) {
      throw new BadRequestException('Solo se puede invitar a cuentas de estudiante.');
    }
    if (invited.user.status !== UserStatus.ACTIVE) {
      throw new BadRequestException('El estudiante invitado no tiene una cuenta activa.');
    }
    if (invited.id === project.createdByProfileId) {
      throw new BadRequestException(
        'No puede invitarse a sí mismo: ya es el responsable del proyecto.',
      );
    }

    const alreadyMember = await this.members.exists({
      where: { projectId: project.id, userId: invited.userId },
    });
    if (alreadyMember) {
      throw new ConflictException('El estudiante ya forma parte del proyecto.');
    }

    const pending = await this.invitations.findOne({
      where: {
        projectId: project.id,
        invitedProfileId: invited.id,
        status: ProjectInvitationStatus.PENDING,
      },
    });
    if (pending) {
      throw new ConflictException('Ya existe una invitación pendiente para este estudiante.');
    }

    const invitation = this.invitations.create({
      projectId: project.id,
      invitedProfileId: invited.id,
      proposedRole: dto.proposedRole,
      status: ProjectInvitationStatus.PENDING,
      invitedById: user.userId,
    });
    const saved = await this.invitations.save(invitation);
    return this.findInvitationOrFail(saved.id);
  }

  /** Invitaciones de un proyecto, para el responsable. */
  async listProjectInvitations(user: AuthenticatedUser, projectId: string) {
    const project = await this.requireOwnedProject(user, projectId);
    const rows = await this.invitations.find({
      where: { projectId: project.id },
      relations: { invitedProfile: { user: true } },
      order: { createdAt: 'DESC' },
    });
    return rows.map((i) => this.toInvitationView(i));
  }

  /** Integrantes aceptados de un proyecto, con su rol. */
  async listMembers(projectId: string) {
    const rows = await this.members.find({
      where: { projectId },
      relations: { user: true },
      order: { createdAt: 'ASC' },
    });
    return rows.map((m) => ({
      id: m.id,
      userId: m.userId,
      name: m.user ? `${m.user.firstName} ${m.user.lastName}` : null,
      role: m.role,
      contribution: m.contribution,
      joinedAt: m.createdAt,
    }));
  }

  /** El responsable retira a un integrante ya aceptado. */
  async removeMember(user: AuthenticatedUser, projectId: string, memberId: string): Promise<void> {
    const project = await this.requireOwnedProject(user, projectId);
    const member = await this.members.findOne({
      where: { id: memberId, projectId: project.id },
    });
    if (!member) {
      throw new NotFoundException('El integrante no pertenece a este proyecto.');
    }
    const profile = await this.profiles.findOne({ where: { userId: member.userId } });
    await this.members.delete(member.id);
    // El proyecto deja de contar en el portafolio y la afinidad del ex integrante.
    if (profile) {
      await this.affinityRecalculation.requestRecalculation(profile.id);
    }
  }

  /** El responsable cancela una invitación que todavía está pendiente. */
  async cancelInvitation(
    user: AuthenticatedUser,
    projectId: string,
    invitationId: string,
  ): Promise<ProjectInvitation> {
    const project = await this.requireOwnedProject(user, projectId);
    const invitation = await this.invitations.findOne({
      where: { id: invitationId, projectId: project.id },
    });
    if (!invitation) {
      throw new NotFoundException('Invitación no encontrada en este proyecto.');
    }
    if (invitation.status !== ProjectInvitationStatus.PENDING) {
      throw new BadRequestException('Solo se puede cancelar una invitación pendiente.');
    }
    invitation.status = ProjectInvitationStatus.CANCELLED;
    invitation.respondedAt = new Date();
    await this.invitations.save(invitation);
    return this.findInvitationOrFail(invitation.id);
  }

  // ------------------------------------------------------------------
  // Respuesta del estudiante invitado
  // ------------------------------------------------------------------

  /** Invitaciones dirigidas al estudiante que consulta. */
  async listMyInvitations(userId: string, onlyPending = false) {
    const profile = await this.requireProfile(userId);
    const rows = await this.invitations.find({
      where: onlyPending
        ? { invitedProfileId: profile.id, status: ProjectInvitationStatus.PENDING }
        : { invitedProfileId: profile.id },
      relations: {
        project: { academicArea: true, createdByProfile: { user: true } },
        invitedBy: true,
      },
      order: { createdAt: 'DESC' },
    });
    return rows.map((i) => ({
      id: i.id,
      status: i.status,
      proposedRole: i.proposedRole,
      createdAt: i.createdAt,
      respondedAt: i.respondedAt,
      invitedBy: i.invitedBy ? `${i.invitedBy.firstName} ${i.invitedBy.lastName}` : null,
      project: i.project
        ? {
            id: i.project.id,
            title: i.project.title,
            description: i.project.description,
            status: i.project.status,
            technologies: i.project.technologies,
            area: i.project.academicArea?.name ?? null,
            owner: i.project.createdByProfile?.user
              ? `${i.project.createdByProfile.user.firstName} ${i.project.createdByProfile.user.lastName}`
              : null,
          }
        : null,
    }));
  }

  /**
   * Aceptar o rechazar. Solo el estudiante invitado, y solo una vez: una
   * invitacion ya respondida no vuelve a procesarse.
   */
  async respond(
    userId: string,
    invitationId: string,
    decision: 'accept' | 'reject',
  ): Promise<ProjectInvitation> {
    const profile = await this.requireProfile(userId);
    const invitation = await this.invitations.findOne({
      where: { id: invitationId },
      relations: { project: true },
    });
    if (!invitation) {
      throw new NotFoundException('Invitación no encontrada.');
    }
    if (invitation.invitedProfileId !== profile.id) {
      throw new ForbiddenException('Esta invitación no está dirigida a usted.');
    }
    if (invitation.status !== ProjectInvitationStatus.PENDING) {
      throw new BadRequestException('Esta invitación ya fue respondida y no puede modificarse.');
    }
    if (!invitation.project) {
      throw new BadRequestException('El proyecto de la invitación ya no existe.');
    }

    invitation.respondedAt = new Date();

    if (decision === 'reject') {
      // Rechazar no crea pertenencia alguna.
      invitation.status = ProjectInvitationStatus.REJECTED;
      await this.invitations.save(invitation);
      return this.findInvitationOrFail(invitation.id);
    }

    invitation.status = ProjectInvitationStatus.ACCEPTED;
    await this.invitations.save(invitation);

    // La pertenencia nace aquí, no antes.
    const existing = await this.members.findOne({
      where: { projectId: invitation.projectId, userId },
    });
    if (existing) {
      existing.role = invitation.proposedRole;
      await this.members.save(existing);
    } else {
      await this.members.save(
        this.members.create({
          projectId: invitation.projectId,
          userId,
          role: invitation.proposedRole,
        }),
      );
    }

    // El proyecto pasa a formar parte del perfil del nuevo integrante.
    await this.affinityRecalculation.requestRecalculation(profile.id);
    return this.findInvitationOrFail(invitation.id);
  }

  // ------------------------------------------------------------------

  private toInvitationView(i: ProjectInvitation) {
    return {
      id: i.id,
      projectId: i.projectId,
      invitedProfileId: i.invitedProfileId,
      invitedName: i.invitedProfile?.user
        ? `${i.invitedProfile.user.firstName} ${i.invitedProfile.user.lastName}`
        : null,
      invitedSemester: i.invitedProfile?.semester ?? null,
      proposedRole: i.proposedRole,
      status: i.status,
      createdAt: i.createdAt,
      respondedAt: i.respondedAt,
    };
  }

  private async findInvitationOrFail(id: string): Promise<ProjectInvitation> {
    const invitation = await this.invitations.findOne({
      where: { id },
      relations: { invitedProfile: { user: true }, project: true },
    });
    if (!invitation) {
      throw new NotFoundException('Invitación no encontrada.');
    }
    return invitation;
  }

  /**
   * Solo el estudiante responsable gestiona integrantes. El administrador
   * conserva su rol de soporte, como en el resto del sistema.
   */
  private async requireOwnedProject(
    user: AuthenticatedUser,
    projectId: string,
  ): Promise<Project> {
    const project = await this.projects.findOne({
      where: { id: projectId },
      relations: { createdByProfile: true },
    });
    if (!project) {
      throw new NotFoundException('Proyecto no encontrado.');
    }
    if (user.role === RolNombre.ADMIN) return project;
    if (project.createdByProfile?.userId !== user.userId) {
      throw new ForbiddenException(
        'Solo el estudiante responsable del proyecto puede gestionar sus integrantes.',
      );
    }
    return project;
  }

  private async requireProfile(userId: string): Promise<StudentProfile> {
    const profile = await this.profiles.findOne({ where: { userId } });
    if (!profile) {
      throw new BadRequestException('Debe crear su perfil estudiantil antes de continuar.');
    }
    return profile;
  }

  /** Perfiles de los integrantes aceptados de un conjunto de proyectos. */
  async profileIdsByProjects(projectIds: string[]): Promise<Map<string, string[]>> {
    const map = new Map<string, string[]>();
    if (projectIds.length === 0) return map;
    const rows = await this.members.find({ where: { projectId: In(projectIds) } });
    for (const row of rows) {
      const list = map.get(row.projectId) ?? [];
      list.push(row.userId);
      map.set(row.projectId, list);
    }
    return map;
  }
}
