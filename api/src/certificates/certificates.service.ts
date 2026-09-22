import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { ILike, Repository } from 'typeorm';
import { ValidationResourceType } from '@perfil/shared';
import { ExternalCertificate } from '../entities/external-certificate.entity';
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
    private readonly uploads: UploadsService,
    private readonly validation: ValidationService,
    @Inject(TRAJECTORY_RECALCULATION)
    private readonly trajectory: TrajectoryRecalculationPort,
  ) {}

  async create(userId: string, dto: CreateExternalCertificateDto): Promise<ExternalCertificate> {
    const profile = await this.requireProfile(userId);
    const duplicate = await this.certificates.findOne({
      where: { studentProfileId: profile.id, certificateName: ILike(dto.certificateName) },
    });
    if (duplicate) {
      throw new ConflictException('Ya registraste un certificado con ese nombre.');
    }
    await this.assertAreaExists(dto.academicAreaId);

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
      academicAreaId: dto.academicAreaId ?? null,
      storedFileId: archivo?.id ?? null,
      fileUrl: archivo ? `${FILES_ROUTE}/${archivo.storageKey}` : null,
      fileName: archivo?.originalFilename ?? null,
      mimeType: archivo?.mimeTypeDetected ?? null,
      fileSize: archivo?.sizeBytes ?? null,
    });
    const saved = await this.certificates.save(certificate);

    // §26: el certificado existe desde ya; lo que puede corroborarse se
    // averigua aparte y sin hacer esperar a nadie.
    await this.validation.enqueue({
      resourceType: ValidationResourceType.EXTERNAL_CERTIFICATE,
      resourceId: saved.id,
    });

    await this.trajectory.requestRecalculation(profile.id);
    return saved;
  }

  async findMine(userId: string): Promise<ExternalCertificate[]> {
    const profile = await this.requireProfile(userId);
    return this.certificates.find({
      where: { studentProfileId: profile.id },
      relations: { academicArea: true },
      order: { createdAt: 'DESC' },
    });
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

  async remove(userId: string, id: string): Promise<void> {
    const certificate = await this.requireOwned(userId, id);
    const storedFileId = certificate.storedFileId;
    await this.certificates.delete(certificate.id);
    if (storedFileId) {
      await this.uploads.remove(storedFileId);
    }
    await this.trajectory.requestRecalculation(certificate.studentProfileId);
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
