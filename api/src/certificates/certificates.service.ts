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
import { ExternalCredentialSource } from '@perfil/shared';
import { normalizarTexto } from '../validation/document-comparison.rules';
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

/** Lo que se guarda como identidad y clasificación de la credencial. */
interface DatosDeCredencial {
  certificateName: string;
  issuer: string;
  areaIds: string[];
  skillIds: string[];
  contextos: { skillId: string; areaId: string | null }[];
}

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

    // V3 §15/§16 y V7.1 §5.2: el origen lo decide el servidor. En una
    // vinculada, nombre, emisor, áreas y tecnologías salen de la oportunidad;
    // lo que traiga el cuerpo para esos campos se ignora.
    const datos = dto.activityId
      ? await this.datosDeVinculada(profile.id, dto as CreateExternalCertificateDto & { activityId: string })
      : await this.datosDeHistorica(dto);

    // §27: solo se adjunta un archivo propio, y sus metadatos los resuelve
    // el servidor a partir del registro.
    const archivo = dto.storedFileId
      ? await this.uploads.requireOwned(userId, dto.storedFileId)
      : null;
    await this.assertNoDuplicada(profile.id, {
      certificateName: datos.certificateName, issuer: datos.issuer, issueDate: dto.issueDate ?? null,
      sha256: archivo?.sha256 ?? null, vinculada: !!dto.activityId,
    });

    const certificate = this.certificates.create({
      studentProfileId: profile.id,
      certificateName: datos.certificateName,
      issuer: datos.issuer,
      certificateUrl: dto.certificateUrl ?? null,
      issueDate: dto.issueDate ?? null,
      credentialId: dto.credentialId ?? null,
      description: dto.description ?? null,
      academicAreaId: datos.areaIds[0] ?? null,
      storedFileId: archivo?.id ?? null,
      fileUrl: archivo ? `${FILES_ROUTE}/${archivo.storageKey}` : null,
      fileName: archivo?.originalFilename ?? null,
      mimeType: archivo?.mimeTypeDetected ?? null,
      fileSize: archivo?.sizeBytes ?? null,
      activityId: dto.activityId ?? null,
      source: dto.activityId ? ExternalCredentialSource.OPPORTUNITY : ExternalCredentialSource.HISTORICAL_EXTERNAL,
    });
    const saved = await this.certificates.save(certificate);
    await this.replaceAreas(saved.id, datos.areaIds);
    if (datos.skillIds.length) await this.replaceSkills(saved.id, datos.skillIds, datos.contextos);

    await this.audit.record({
      actorUserId: userId,
      eventType: AuditEventType.EXTERNAL_CREDENTIAL_CREATED,
      entityType: 'external_certificate',
      entityId: saved.id,
      metadata: { source: saved.source, activityId: saved.activityId, derivadaDeLaOportunidad: !!dto.activityId },
    });

    // §26 y V7.1 §5.2–§5.3: el certificado existe desde ya. Según su origen,
    // se comprueba aparte (sin hacer esperar a nadie) o va directo a Dirección.
    await this.validation.encaminarCredencial(saved, userId, null);

    await this.trajectory.requestRecalculation(profile.id);
    return saved;
  }

  /**
   * V7.1 §5.2 · Vinculada: lo que la credencial hereda de la oportunidad.
   * Solo si de verdad es elegible para este estudiante; el archivo es
   * obligatorio en las nuevas.
   */
  private async datosDeVinculada(profileId: string, dto: CreateExternalCertificateDto & { activityId: string }): Promise<DatosDeCredencial> {
    if (await this.eligibility.alreadyAttached(profileId, dto.activityId)) {
      const m = 'Ya adjuntaste la credencial de esta oportunidad.';
      throw new ConflictException({ code: 'CREDENTIAL_ALREADY_ATTACHED', message: m, fields: { activityId: [m] } });
    }
    const oportunidad = await this.eligibility.oportunidadPara(profileId, dto.activityId);
    if (!oportunidad) {
      const m = 'Esta oportunidad no admite todavía tu credencial: debe haber terminado y el responsable '
        + 'debe haber registrado tu aceptación (o tu participación, si es interna).';
      throw new BadRequestException({ code: 'CREDENTIAL_OPPORTUNITY_NOT_ELIGIBLE', message: m, fields: { activityId: [m] } });
    }
    if (!dto.storedFileId) {
      const m = 'Adjunta el archivo del certificado: es obligatorio en una credencial de una oportunidad.';
      throw new BadRequestException({ code: 'CREDENTIAL_FILE_REQUIRED', message: m, fields: { storedFileId: [m] } });
    }
    const issuer = oportunidad.expectedIssuer ?? dto.issuer?.trim() ?? '';
    if (!issuer) {
      const m = 'La oportunidad no indica el emisor: escribe quién emitió el certificado.';
      throw new BadRequestException({ code: 'CREDENTIAL_ISSUER_REQUIRED', message: m, fields: { issuer: [m] } });
    }
    return {
      certificateName: oportunidad.expectedName.slice(0, 200),
      issuer: issuer.slice(0, 160),
      areaIds: oportunidad.areas.map((a) => a.id),
      skillIds: oportunidad.skills.map((s) => s.id),
      contextos: oportunidad.skills.map((s) => ({ skillId: s.id, areaId: s.areaId })),
    };
  }

  /** Histórica: lo declara el estudiante, con las validaciones del catálogo de siempre. */
  private async datosDeHistorica(dto: CreateExternalCertificateDto): Promise<DatosDeCredencial> {
    await this.assertAreaExists(dto.academicAreaId);
    await this.assertSkillsExist(dto.skillIds);
    const areasCert = await this.areasDeCredencial(dto.academicAreaId ?? null, dto.areaIds);
    if (dto.areaIds !== undefined) {
      await assertSkillsBelongToAreas(this.certificates.manager, dto.skillIds, areasCert);
    }
    const contextos = await resolveSkillContexts(this.certificates.manager, dto.skillIds ?? [], areasCert, dto.skillContexts);
    return {
      certificateName: dto.certificateName!,
      issuer: dto.issuer!,
      areaIds: areasCert,
      skillIds: dto.skillIds ?? [],
      contextos,
    };
  }

  /**
   * V7.1 §5.2: evita duplicados por reintento sin prohibir certificados
   * legítimos distintos que solo comparten el título. Es el mismo certificado
   * si coinciden el nombre, el emisor y la fecha, o si es el mismo archivo
   * (SHA-256) del mismo estudiante. El hash dice que el archivo es idéntico;
   * no dice nada de su autenticidad, y nunca se compara entre estudiantes aquí.
   */
  private async assertNoDuplicada(
    studentProfileId: string,
    c: { certificateName: string; issuer: string; issueDate: string | null; sha256: string | null; vinculada: boolean; excepto?: string },
  ): Promise<void> {
    const propias = await this.certificates.find({
      where: { studentProfileId },
      relations: { storedFile: true },
      select: { id: true, activityId: true, certificateName: true, issuer: true, issueDate: true, storedFileId: true, storedFile: { id: true, sha256: true } },
    });
    const n = normalizarTexto;
    const fecha = (d: string | Date | null) => (d ? new Date(d).toISOString().slice(0, 10) : null);
    // En una vinculada, la identidad es la oportunidad (una por estudiante, ya
    // controlada): dos oportunidades distintas pueden esperar el mismo nombre.
    const mismo = propias.find((p) => p.id !== c.excepto && (
      (!c.vinculada && !p.activityId && n(p.certificateName) === n(c.certificateName) && n(p.issuer) === n(c.issuer)
        && fecha(p.issueDate) === fecha(c.issueDate))
      || (!!c.sha256 && p.storedFile?.sha256 === c.sha256)
    ));
    if (mismo) {
      throw new ConflictException({
        code: 'CREDENTIAL_DUPLICATE',
        message: `Ya registraste esta credencial («${mismo.certificateName}»): mismo nombre, emisor y fecha, o el mismo archivo.`,
      });
    }
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
    const vinculada = certificate.source === ExternalCredentialSource.OPPORTUNITY;
    if (vinculada) {
      // V7.1 §5.2: nombre, áreas y tecnologías son de la oportunidad (copia
      // fija tomada al enviarla); el emisor también, si la oportunidad lo
      // define. Aquí no se editan: se ignoran. Y el archivo no se quita.
      if (dto.storedFileId === null) {
        const m = 'Una credencial de una oportunidad necesita su archivo: puedes reemplazarlo, no quitarlo.';
        throw new BadRequestException({ code: 'CREDENTIAL_FILE_REQUIRED', message: m, fields: { storedFileId: [m] } });
      }
      const oportunidad = certificate.activityId ? await this.eligibility.descripcionDe(certificate.activityId) : null;
      if (dto.issuer !== undefined && !oportunidad?.expectedIssuer) certificate.issuer = dto.issuer;
    } else {
      if (dto.certificateName !== undefined) certificate.certificateName = dto.certificateName;
      if (dto.issuer !== undefined) certificate.issuer = dto.issuer;
      if (dto.academicAreaId !== undefined) {
        await this.assertAreaExists(dto.academicAreaId);
        certificate.academicAreaId = dto.academicAreaId ?? null;
      }
      await this.actualizarAreasYTecnologias(certificate, dto);
    }
    if (dto.certificateUrl !== undefined) certificate.certificateUrl = dto.certificateUrl ?? null;
    if (dto.issueDate !== undefined) certificate.issueDate = dto.issueDate ?? null;
    if (dto.description !== undefined) certificate.description = dto.description ?? null;
    if (dto.credentialId !== undefined) certificate.credentialId = dto.credentialId ?? null;
    const anterior = certificate.storedFileId;
    const reemplazado = dto.storedFileId === undefined ? null : await this.cambiarArchivo(userId, certificate, dto.storedFileId);
    const nuevo = certificate.storedFileId && certificate.storedFileId !== anterior
      ? await this.uploads.requireOwned(userId, certificate.storedFileId)
      : null;
    await this.assertNoDuplicada(certificate.studentProfileId, {
      certificateName: certificate.certificateName, issuer: certificate.issuer, issueDate: certificate.issueDate,
      sha256: nuevo?.sha256 ?? null, vinculada, excepto: certificate.id,
    });

    const saved = await this.certificates.save(certificate);

    // El archivo anterior se borra despues de guardar: si el guardado fallara,
    // el certificado se habria quedado sin archivo y sin vuelta atras.
    if (reemplazado) await this.uploads.remove(reemplazado);

    // V7.1 §5.2–§5.3: lo declarado cambió. Se vuelve a encaminar (reenvío a
    // Dirección); el resultado y la decisión anteriores quedan archivados.
    await this.validation.encaminarCredencial(saved, userId, reemplazado || nuevo ? 'file_replaced' : 'resubmitted');

    await this.trajectory.requestRecalculation(certificate.studentProfileId);
    return saved;
  }

  /** Áreas (si vienen) y, si cambia algo de eso, las tecnologías con su contexto. */
  private async actualizarAreasYTecnologias(certificate: ExternalCertificate, dto: UpdateExternalCertificateDto): Promise<void> {
    if (dto.areaIds !== undefined) {
      const areasCert = await this.areasDeCredencial(dto.academicAreaId ?? certificate.academicAreaId, dto.areaIds);
      certificate.academicAreaId = areasCert[0] ?? null;
      await this.replaceAreas(certificate.id, areasCert);
    }
    if (dto.skillIds === undefined && dto.areaIds === undefined && dto.skillContexts === undefined) return;
    const skillIds = dto.skillIds ?? (await this.certificateSkills.find({ where: { certificateId: certificate.id } })).map((x) => x.skillId);
    await this.assertSkillsExist(skillIds);
    const areasFinales = (await this.areasCert.find({ where: { certificateId: certificate.id } })).map((x) => x.academicAreaId);
    const areas = areasFinales.length ? areasFinales : [certificate.academicAreaId].filter((x): x is string => !!x);
    if (dto.areaIds !== undefined) await assertSkillsBelongToAreas(this.certificates.manager, skillIds, areas);
    const contextos = await resolveSkillContexts(this.certificates.manager, skillIds, areas, dto.skillContexts);
    await this.replaceSkills(certificate.id, skillIds, contextos);
  }

  /** Pone el archivo nuevo (o ninguno) y devuelve el anterior si hay que borrarlo. */
  private async cambiarArchivo(userId: string, certificate: ExternalCertificate, storedFileId: string | null): Promise<string | null> {
    const anterior = certificate.storedFileId;
    const archivo = storedFileId ? await this.uploads.requireOwned(userId, storedFileId) : null;
    certificate.storedFileId = archivo?.id ?? null;
    certificate.fileUrl = archivo ? `${FILES_ROUTE}/${archivo.storageKey}` : null;
    certificate.fileName = archivo?.originalFilename ?? null;
    certificate.mimeType = archivo?.mimeTypeDetected ?? null;
    certificate.fileSize = archivo?.sizeBytes ?? null;
    return anterior && anterior !== certificate.storedFileId ? anterior : null;
  }

  /**
   * V7.1 §5.3 · «Comprobar información»: vuelve a pasar la vinculada por las
   * fases 1 y 2 con su archivo actual. El envío a Dirección no depende de esto.
   */
  async check(userId: string, id: string) {
    const certificate = await this.requireOwned(userId, id);
    const r = await this.validation.recomprobarPorEstudiante(userId, certificate);
    return { certificateId: id, status: r.status, previousAttempts: r.previousResults?.length ?? 0 };
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
