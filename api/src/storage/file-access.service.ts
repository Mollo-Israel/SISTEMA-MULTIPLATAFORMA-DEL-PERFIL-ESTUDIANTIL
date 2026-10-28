import { ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { IsNull, Not, Repository } from 'typeorm';
import { ProjectVisibility, RolNombre, ValidationResourceType } from '@perfil/shared';
import { ProjectEvidence } from '../entities/project-evidence.entity';
import { ExternalCertificate } from '../entities/external-certificate.entity';
import { ExternalOpportunityValidationReference } from '../entities/external-opportunity-validation-reference.entity';
import { ValidationRecord } from '../entities/validation-record.entity';
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
    @InjectRepository(ExternalOpportunityValidationReference)
    private readonly references: Repository<ExternalOpportunityValidationReference>,
    @InjectRepository(ValidationRecord) private readonly records: Repository<ValidationRecord>,
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
      // V3 §16: Dirección necesita ver el documento para decidir una
      // revisión manual excepcional, y solo mientras exista esa revisión.
      const enRevision = user.role === RolNombre.CAREER_DIRECTOR
        && await this.records.exists({
          where: {
            resourceType: ValidationResourceType.EXTERNAL_CERTIFICATE,
            resourceId: certificate.id,
            manualReviewStatus: Not(IsNull()),
          },
        });
      if (!enRevision) await this.assertOwnerOrAdmin(user, certificate.studentProfileId);
      return {
        storageKey,
        downloadName: certificate.certificateName ?? storageKey,
        ownerProfileId: certificate.studentProfileId,
      };
    }

    // V3 §17: certificado de ejemplo de una oportunidad externa. Lo ven
    // quienes responden por ella y Dirección; un estudiante nunca: es
    // material interno de validación, no una plantilla para imitar.
    const ref = await this.references
      .createQueryBuilder('r')
      .innerJoinAndSelect('r.sampleStoredFile', 'f')
      .innerJoinAndSelect('r.activity', 'a')
      .where('f.storage_key = :k', { k: storageKey })
      .getOne();
    if (ref?.sampleStoredFile) {
      const a = ref.activity;
      const puede = user.role === RolNombre.ADMIN
        || user.role === RolNombre.CAREER_DIRECTOR
        || a.creatorId === user.userId
        || a.responsibleUserId === user.userId
        || ref.sampleStoredFile.uploadedByUserId === user.userId;
      if (puede) {
        return {
          storageKey,
          downloadName: ref.sampleStoredFile.originalFilename ?? storageKey,
          ownerProfileId: '',
        };
      }
    }

    // V3.2 §35: imagen de un recurso de la Biblioteca: la ve cualquiera con sesión.
    const deRecurso = await this.records.manager.query(
      `SELECT 1 FROM "learning_resources" r JOIN "stored_files" f ON f."id" = r."image_file_id" WHERE f."storage_key" = $1 LIMIT 1`,
      [storageKey],
    );
    if (deRecurso.length) return { storageKey, downloadName: 'imagen-recurso', ownerProfileId: '' };

    // V5-13: el archivo de un recurso publicado (activo y aprobado o sin
    // revisión) lo abre cualquiera con sesión. El de una propuesta pendiente no.
    const materialRecurso = await this.records.manager.query(
      `SELECT f."original_filename" FROM "learning_resources" r JOIN "stored_files" f ON f."id" = r."file_id"
        WHERE f."storage_key" = $1 AND r."status" = 'active' AND r."review_status" IN ('approved', 'not_required') LIMIT 1`,
      [storageKey],
    );
    if (materialRecurso.length) {
      return { storageKey, downloadName: materialRecurso[0].original_filename ?? 'material', ownerProfileId: '' };
    }

    // V3.2 §28.3: certificado institucional entregado. Lo descargan su
    // titular, quien lo entregó, Dirección y Administración.
    const certificado = await this.records.manager.query(
      `SELECT c."student_profile_id", c."issued_by", p."user_id"
         FROM "internal_constancies" c
         JOIN "stored_files" f ON f."id" = c."stored_file_id"
         JOIN "student_profiles" p ON p."id" = c."student_profile_id"
        WHERE f."storage_key" = $1`,
      [storageKey],
    );
    if (certificado.length) {
      const puede = user.role === RolNombre.ADMIN || user.role === RolNombre.CAREER_DIRECTOR
        || certificado.some((c: { user_id: string; issued_by: string | null }) => c.user_id === user.userId || c.issued_by === user.userId);
      if (puede) {
        return { storageKey, downloadName: 'certificado', ownerProfileId: certificado[0].student_profile_id };
      }
    }

    // V3.2 §18.3: imagen ilustrativa de una actividad. Publicada, la ve
    // cualquiera con sesión; en borrador, solo quien la gestiona.
    // V4.1 A41-006: la portada o cualquiera de sus imágenes (`activity_images`).
    // Un archivo puede ilustrar varias actividades: se autoriza si ALGUNA de
    // ellas es visible para quien pide (publicada, o un borrador que gestiona).
    const conImagen = await this.records.manager.query(
      `SELECT a."status", a."creator_id", a."responsible_user_id", a."id"
         FROM "activities" a
         JOIN "stored_files" f ON f."storage_key" = $1
        WHERE f."id" = a."image_file_id"
           OR EXISTS (SELECT 1 FROM "activity_images" ai WHERE ai."activity_id" = a."id" AND ai."stored_file_id" = f."id")`,
      [storageKey],
    ) as { status: string; creator_id: string; responsible_user_id: string | null; id: string }[];
    if (conImagen.some((a) => a.status !== 'draft')) {
      return { storageKey, downloadName: 'imagen-actividad', ownerProfileId: '' };
    }
    for (const a of conImagen) {
      const gestiona = user.role === RolNombre.ADMIN
        || user.role === RolNombre.CAREER_DIRECTOR
        || a.creator_id === user.userId
        || a.responsible_user_id === user.userId
        || (await this.records.manager.query(
          `SELECT 1 FROM "activity_responsibles" WHERE "activity_id" = $1 AND "user_id" = $2`,
          [a.id, user.userId],
        )).length > 0;
      if (gestiona) return { storageKey, downloadName: 'imagen-actividad', ownerProfileId: '' };
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
