import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { ILike, In, Repository } from 'typeorm';
import { ExternalCredentialSource, ValidationResourceType } from '@perfil/shared';
import { AuditEventType, AuditService } from '../audit/audit.service';
import { CredentialEligibilityService } from '../activities/credential-eligibility.service';
import { ExternalCertificate, ExternalCertificateArea, ExternalCertificateSkill } from '../entities/external-certificate.entity';
import { assertSkillsBelongToAreas, resolveSkillContexts } from '../catalogs/area-skill.guard';
import { Skill } from '../entities/skill.entity';
import { AcademicArea } from '../entities/academic-area.entity';
import { FILES_ROUTE } from '../storage/local-storage.driver';
import { UploadsService } from '../storage/uploads.service';
import { ValidationService } from '../validation/validation.service';
import { StudentProfile } from '../entities/student-profile.entity';
import { CreateExternalCertificateDto } from './dto/create-external-certificate.dto';
import { UpdateExternalCertificateDto } from './dto/update-external-certificate.dto';
import {
  TRAJECTORY_RECALCULATION,
  TrajectoryRecalculationPort,
} from '../trajectory/trajectory-recalculation.port';

@Injectable()
export class CertificatesService {
  constructor(
    @InjectRepository(ExternalCertificate)
    private readonly certificates: Repository<ExternalCertificate>,
    @InjectRepository(StudentProfile) private readonly profiles: Repository<StudentProfile>,
    @InjectRepository(AcademicArea) private readonly areas: Repository<AcademicArea>,
    @InjectRepository(Skill) private readonly skillsRepo: Repository<Skill>,
    @InjectRepository(ExternalCertificateSkill)
    private readonly certificateSkills: Repository<ExternalCertificateSkill>,
    @InjectRepository(ExternalCertificateArea)
    private readonly areasCert: Repository<ExternalCertificateArea>,
    private readonly uploads: UploadsService,
    private readonly validation: ValidationService,
    @Inject(TRAJECTORY_RECALCULATION)
    private readonly trajectory: TrajectoryRecalculationPort,
    private readonly eligibility: CredentialEligibilityService,
    private readonly audit: AuditService,
  ) {}

  /** V3 §15: oportunidades en las que ya puede adjuntar su credencial. */
  async eligibleOpportunities(userId: string) {
    const profile = await this.requireProfile(userId);
    return this.eligibility.eligibleFor(profile.id);
  }

  async create(userId: string, dto: CreateExternalCertificateDto): Promise<ExternalCertificate> {
    const profile = await this.requireProfile(userId);
    const duplicate = await this.certificates.findOne({
      where: { studentProfileId: profile.id, certificateName: ILike(dto.certificateName) },
    });
    if (duplicate) {
      throw new ConflictException('Ya registraste un certificado con ese nombre.');
    }
    await this.assertAreaExists(dto.academicAreaId);
    await this.assertSkillsExist(dto.skillIds);
    const areasCert = await this.areasDeCredencial(dto.academicAreaId ?? null, dto.areaIds);
    if (dto.areaIds !== undefined) {
      await assertSkillsBelongToAreas(this.certificates.manager, dto.skillIds, areasCert);
    }
    const contextos = await resolveSkillContexts(this.certificates.manager, dto.skillIds ?? [], areasCert, dto.skillContexts);

    // V3 §15/§16: el origen lo decide el servidor. Con oportunidad, solo si
    // de verdad es elegible para este estudiante: no basta con conocer un id.
    if (dto.activityId) {
      if (await this.eligibility.alreadyAttached(profile.id, dto.activityId)) {
        const m = 'Ya adjuntaste la credencial de esta oportunidad.';
        throw new ConflictException({ code: 'CREDENTIAL_ALREADY_ATTACHED', message: m, fields: { activityId: [m] } });
      }
      if (!(await this.eligibility.assertEligible(profile.id, dto.activityId))) {
        const m = 'Esta oportunidad no admite todavía tu credencial: debe haber terminado y el responsable '
          + 'debe haber registrado tu aceptación (o tu participación, si es interna).';
        throw new BadRequestException({ code: 'CREDENTIAL_OPPORTUNITY_NOT_ELIGIBLE', message: m, fields: { activityId: [m] } });
      }
    }

    // §27: solo se adjunta un archivo propio, y sus metadatos los resuelve
    // el servidor a partir del registro.
    const archivo = dto.storedFileId
      ? await this.uploads.requireOwned(userId, dto.storedFileId)
      : null;

    const certificate = this.certificates.create({
      studentProfileId: profile.id,
      certificateName: dto.certificateName,
      issuer: dto.issuer,
      certificateUrl: dto.certificateUrl ?? null,
      issueDate: dto.issueDate ?? null,
      credentialId: dto.credentialId ?? null,
      description: dto.description ?? null,
      academicAreaId: areasCert[0] ?? null,
      storedFileId: archivo?.id ?? null,
      fileUrl: archivo ? `${FILES_ROUTE}/${archivo.storageKey}` : null,
      fileName: archivo?.originalFilename ?? null,
      mimeType: archivo?.mimeTypeDetected ?? null,
      fileSize: archivo?.sizeBytes ?? null,
      activityId: dto.activityId ?? null,
      source: dto.activityId ? ExternalCredentialSource.OPPORTUNITY : ExternalCredentialSource.HISTORICAL_EXTERNAL,
    });
    const saved = await this.certificates.save(certificate);
    await this.replaceAreas(saved.id, areasCert);
    if (dto.skillIds?.length) await this.replaceSkills(saved.id, dto.skillIds, contextos);

    await this.audit.record({
      actorUserId: userId,
      eventType: AuditEventType.EXTERNAL_CREDENTIAL_CREATED,
      entityType: 'external_certificate',
      entityId: saved.id,
      metadata: { source: saved.source, activityId: saved.activityId },
    });

    // §26: el certificado existe desde ya; lo que puede corroborarse se
    // averigua aparte y sin hacer esperar a nadie.
    await this.validation.enqueue({
      resourceType: ValidationResourceType.EXTERNAL_CERTIFICATE,
      resourceId: saved.id,
    });

    await this.trajectory.requestRecalculation(profile.id);
    return saved;
  }

  async findMine(userId: string) {
    const profile = await this.requireProfile(userId);
    const lista = await this.certificates.find({
      where: { studentProfileId: profile.id },
      relations: { academicArea: true, skills: { skill: true }, activity: true },
      order: { createdAt: 'DESC' },
    });
    // De la oportunidad solo hace falta lo que se muestra.
    return lista.map(({ activity, ...c }) => ({
      ...c,
      activity: activity ? { id: activity.id, title: activity.title, provider: activity.provider } : null,
    }));
  }

  async update(
    userId: string,
    id: string,
    dto: UpdateExternalCertificateDto,
  ): Promise<ExternalCertificate> {
    const certificate = await this.requireOwned(userId, id);
    if (dto.certificateName !== undefined) certificate.certificateName = dto.certificateName;
    if (dto.issuer !== undefined) certificate.issuer = dto.issuer;
    if (dto.certificateUrl !== undefined) certificate.certificateUrl = dto.certificateUrl ?? null;
    if (dto.issueDate !== undefined) certificate.issueDate = dto.issueDate ?? null;
    if (dto.description !== undefined) certificate.description = dto.description ?? null;
    if (dto.academicAreaId !== undefined) {
      await this.assertAreaExists(dto.academicAreaId);
      certificate.academicAreaId = dto.academicAreaId ?? null;
    }
    if (dto.credentialId !== undefined) certificate.credentialId = dto.credentialId ?? null;
    if (dto.areaIds !== undefined) {
      const areasCert = await this.areasDeCredencial(dto.academicAreaId ?? certificate.academicAreaId, dto.areaIds);
      certificate.academicAreaId = areasCert[0] ?? null;
      await this.replaceAreas(certificate.id, areasCert);
    }
    if (dto.skillIds !== undefined || dto.areaIds !== undefined || dto.skillContexts !== undefined) {
      const skillIds = dto.skillIds ?? (await this.certificateSkills.find({ where: { certificateId: certificate.id } })).map((x) => x.skillId);
      await this.assertSkillsExist(skillIds);
      const areasFinales = (await this.areasCert.find({ where: { certificateId: certificate.id } })).map((x) => x.academicAreaId);
      const areas = areasFinales.length ? areasFinales : [certificate.academicAreaId].filter((x): x is string => !!x);
      if (dto.areaIds !== undefined) await assertSkillsBelongToAreas(this.certificates.manager, skillIds, areas);
      const contextos = await resolveSkillContexts(this.certificates.manager, skillIds, areas, dto.skillContexts);
      await this.replaceSkills(certificate.id, skillIds, contextos);
    }

    let reemplazado: string | null = null;
    if (dto.storedFileId !== undefined) {
      const anterior = certificate.storedFileId;
      const archivo = dto.storedFileId
        ? await this.uploads.requireOwned(userId, dto.storedFileId)
        : null;
      certificate.storedFileId = archivo?.id ?? null;
      certificate.fileUrl = archivo ? `${FILES_ROUTE}/${archivo.storageKey}` : null;
      certificate.fileName = archivo?.originalFilename ?? null;
      certificate.mimeType = archivo?.mimeTypeDetected ?? null;
      certificate.fileSize = archivo?.sizeBytes ?? null;
      reemplazado = anterior && anterior !== certificate.storedFileId ? anterior : null;
    }

    const saved = await this.certificates.save(certificate);

    // El archivo anterior se borra despues de guardar: si el guardado fallara,
    // el certificado se habria quedado sin archivo y sin vuelta atras.
    if (reemplazado) await this.uploads.remove(reemplazado);

    // Lo declarado cambio, asi que el veredicto anterior ya no describe
    // este certificado: se vuelve a validar.
    await this.validation.enqueue({
      resourceType: ValidationResourceType.EXTERNAL_CERTIFICATE,
      resourceId: saved.id,
      force: true,
    });

    await this.trajectory.requestRecalculation(certificate.studentProfileId);
    return saved;
  }

  /** V3 §16: pide la revisión manual excepcional de una histórica. */
  async requestManualReview(userId: string, id: string, note: string | null) {
    const certificate = await this.requireOwned(userId, id);
    const r = await this.validation.requestManualReview(userId, certificate, note);
    return { certificateId: id, manualReview: { status: r.manualReviewStatus, requestedAt: r.manualReviewRequestedAt } };
  }

  async remove(userId: string, id: string): Promise<void> {
    const certificate = await this.requireOwned(userId, id);
    const storedFileId = certificate.storedFileId;
    await this.certificates.delete(certificate.id);
    if (storedFileId) {
      await this.uploads.remove(storedFileId);
    }
    await this.trajectory.requestRecalculation(certificate.studentProfileId);
  }

  /** Solo tecnologías activas del catálogo (§41, §23). */
  private async assertSkillsExist(skillIds?: string[] | null): Promise<void> {
    if (!skillIds?.length) return;
    const activas = await this.skillsRepo.count({ where: { id: In(skillIds), isActive: true } });
    if (activas !== skillIds.length) {
      const m = 'Alguna tecnología no está en el catálogo o fue dada de baja.';
      throw new BadRequestException({ message: m, fields: { skillIds: [m] } });
    }
  }

  private async replaceSkills(
    certificateId: string,
    skillIds: string[],
    contextos: { skillId: string; areaId: string | null }[] = [],
  ): Promise<void> {
    await this.certificateSkills.delete({ certificateId });
    const areaDe = new Map(contextos.map((c) => [c.skillId, c.areaId]));
    if (skillIds.length) {
      await this.certificateSkills.save(skillIds.map((skillId) =>
        this.certificateSkills.create({ certificateId, skillId, academicAreaId: areaDe.get(skillId) ?? null })));
    }
  }

  /** V3.2 §33: la principal primero, sin repetir; todas existen. */
  private async areasDeCredencial(principal: string | null, otras?: string[]): Promise<string[]> {
    const ids = [...new Set([...(otras?.length ? otras : []), ...(principal && !otras?.length ? [principal] : [])])];
    if (otras?.length && principal && !ids.includes(principal)) ids.unshift(principal);
    for (const a of ids) await this.assertAreaExists(a);
    return ids;
  }

  private async replaceAreas(certificateId: string, areaIds: string[]): Promise<void> {
    await this.areasCert.delete({ certificateId });
    if (areaIds.length) await this.areasCert.insert(areaIds.map((academicAreaId) => ({ certificateId, academicAreaId })));
  }

  private async assertAreaExists(areaId?: string | null): Promise<void> {
    if (!areaId) return;
    const exists = await this.areas.exists({ where: { id: areaId } });
    if (!exists) {
      throw new BadRequestException('El área académica no existe.');
    }
  }

  private async requireOwned(userId: string, id: string): Promise<ExternalCertificate> {
    const certificate = await this.certificates.findOne({
      where: { id },
      relations: { studentProfile: true },
    });
    if (!certificate) {
      throw new NotFoundException('Certificado no encontrado.');
    }
    if (certificate.studentProfile.userId !== userId) {
      throw new ForbiddenException('Solo el propietario puede gestionar este certificado.');
    }
    return certificate;
  }

  private async requireProfile(userId: string): Promise<StudentProfile> {
    const profile = await this.profiles.findOne({ where: { userId } });
    if (!profile) {
      throw new BadRequestException('Debe crear su perfil estudiantil antes de registrar certificados.');
    }
    return profile;
  }
}
