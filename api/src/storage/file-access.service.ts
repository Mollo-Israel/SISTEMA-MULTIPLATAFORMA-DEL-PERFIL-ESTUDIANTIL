import { ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ProjectVisibility, RolNombre } from '@perfil/shared';
import { ProjectEvidence } from '../entities/project-evidence.entity';
import { ExternalCertificate } from '../entities/external-certificate.entity';
import { Project } from '../entities/project.entity';
import { ProjectMember } from '../entities/project-member.entity';
import { StudentProfile } from '../entities/student-profile.entity';
import { AuthenticatedUser } from '../auth/types/authenticated-user';
import { TeacherScopeService, inTeacherScope } from '../access/teacher-scope.service';

export interface ResolvedFile {
  /** Nombre en disco. Ya validado: no contiene separadores ni rutas relativas. */
  storageKey: string;
  downloadName: string;
  ownerProfileId: string;
}

/**
 * Autorización de descarga de archivos (especificación §27.1 y §83).
 *
 * Antes los archivos se servían como estáticos: conocer la URL bastaba para
 * bajarse el certificado de cualquiera. Ahora toda descarga pasa por aquí y
 * responde la misma pregunta que responder ver la entidad que lo contiene.
 *
 *   JWT → rol → propiedad / alcance / visibilidad → stream
 */
@Injectable()
export class FileAccessService {
  constructor(
    @InjectRepository(ProjectEvidence)
    private readonly evidences: Repository<ProjectEvidence>,
    @InjectRepository(ExternalCertificate)
    private readonly certificates: Repository<ExternalCertificate>,
    @InjectRepository(Project) private readonly projects: Repository<Project>,
    @InjectRepository(ProjectMember) private readonly members: Repository<ProjectMember>,
    @InjectRepository(StudentProfile) private readonly profiles: Repository<StudentProfile>,
    private readonly teacherScope: TeacherScopeService,
  ) {}

  /**
   * Determina si el usuario puede descargar el archivo y devuelve dónde está.
   *
   * Un archivo que no está referenciado por ninguna entidad es inalcanzable:
   * no se sirve aunque exista en disco. Así un archivo huérfano deja de ser
   * accesible en cuanto se borra su fila.
   */
  async authorize(user: AuthenticatedUser, key: string): Promise<ResolvedFile> {
    const storageKey = this.sanitizeKey(key);
    const fileUrl = `/api/files/${storageKey}`;

    const evidence = await this.evidences.findOne({ where: { fileUrl } });
    if (evidence) {
      await this.assertCanReachProfile(user, evidence.studentProfileId, evidence.projectId);
      return {
        storageKey,
        downloadName: evidence.fileName ?? storageKey,
        ownerProfileId: evidence.studentProfileId,
      };
    }

    const certificate = await this.certificates.findOne({ where: { fileUrl } });
    if (certificate) {
      // §105: el archivo del certificado es privado por defecto. Solo su
      // titular y el administrador lo descargan; un docente ve la metadata y
      // el nivel de respaldo, no el PDF.
      await this.assertOwnerOrAdmin(user, certificate.studentProfileId);
      return {
        storageKey,
        downloadName: certificate.certificateName ?? storageKey,
        ownerProfileId: certificate.studentProfileId,
      };
    }

    // Mismo error para "no existe" y "no autorizado": distinguirlos permitiría
    // averiguar qué archivos hay probando claves.
    throw new NotFoundException('Archivo no encontrado.');
  }

  /**
   * Quien puede alcanzar una evidencia: su dueño, un integrante aceptado del
   * proyecto, el administrador, o un docente con el proyecto visible y dentro
   * de su alcance académico.
   */
  private async assertCanReachProfile(
    user: AuthenticatedUser,
    ownerProfileId: string,
    projectId: string | null,
  ): Promise<void> {
    if (user.role === RolNombre.ADMIN) return;

    if (user.role === RolNombre.STUDENT) {
      const profile = await this.profiles.findOne({ where: { userId: user.userId } });
      if (profile && profile.id === ownerProfileId) return;

      if (projectId && profile) {
        const membership = await this.members.findOne({
          where: { projectId, userId: user.userId },
        });
        if (membership) return;
      }
      throw new NotFoundException('Archivo no encontrado.');
    }

    if (user.role === RolNombre.TEACHER) {
      if (!projectId) throw new NotFoundException('Archivo no encontrado.');

      const project = await this.projects.findOne({ where: { id: projectId } });
      if (!project || project.visibility !== ProjectVisibility.TEACHERS) {
        throw new NotFoundException('Archivo no encontrado.');
      }

      const owner = await this.profiles.findOne({ where: { id: ownerProfileId } });
      const allowed = await this.teacherScope.allowedSemesters(user.userId);
      if (!owner || !inTeacherScope(owner, allowed)) {
        throw new ForbiddenException('El estudiante no pertenece a sus semestres habilitados.');
      }
      return;
    }

    throw new NotFoundException('Archivo no encontrado.');
  }

  private async assertOwnerOrAdmin(
    user: AuthenticatedUser,
    ownerProfileId: string,
  ): Promise<void> {
    if (user.role === RolNombre.ADMIN) return;
    if (user.role === RolNombre.STUDENT) {
      const profile = await this.profiles.findOne({ where: { userId: user.userId } });
      if (profile && profile.id === ownerProfileId) return;
    }
    throw new NotFoundException('Archivo no encontrado.');
  }

  /**
   * Acepta solo un nombre de archivo plano. Cualquier separador o recorrido de
   * rutas se rechaza antes de tocar el disco.
   */
  private sanitizeKey(key: string): string {
    const trimmed = (key ?? '').trim();
    if (
      !trimmed
      || trimmed.includes('/')
      || trimmed.includes('\\')
      || trimmed.includes('..')
      || trimmed.startsWith('.')
      || !/^[A-Za-z0-9._-]+$/.test(trimmed)
    ) {
      throw new NotFoundException('Archivo no encontrado.');
    }
    return trimmed;
  }
}
