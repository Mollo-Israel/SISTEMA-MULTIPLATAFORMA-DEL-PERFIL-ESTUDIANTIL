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
import { ExternalCertificate } from '../entities/external-certificate.entity';
import { AcademicArea } from '../entities/academic-area.entity';
import { STORAGE_PORT, StoragePort } from '../storage/storage.port';
import { StudentProfile } from '../entities/student-profile.entity';
import { CreateExternalCertificateDto } from './dto/create-external-certificate.dto';
import { UpdateExternalCertificateDto } from './dto/update-external-certificate.dto';
import {
  AFFINITY_RECALCULATION,
  AffinityRecalculationPort,
} from '../affinity-recalc/affinity-recalculation.port';

@Injectable()
export class CertificatesService {
  constructor(
    @InjectRepository(ExternalCertificate)
    private readonly certificates: Repository<ExternalCertificate>,
    @InjectRepository(StudentProfile) private readonly profiles: Repository<StudentProfile>,
    @InjectRepository(AcademicArea) private readonly areas: Repository<AcademicArea>,
    @Inject(STORAGE_PORT) private readonly storage: StoragePort,
    @Inject(AFFINITY_RECALCULATION)
    private readonly affinityRecalculation: AffinityRecalculationPort,
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
    const certificate = this.certificates.create({
      studentProfileId: profile.id,
      certificateName: dto.certificateName,
      issuer: dto.issuer,
      certificateUrl: dto.certificateUrl ?? null,
      issueDate: dto.issueDate ?? null,
      description: dto.description ?? null,
      academicAreaId: dto.academicAreaId ?? null,
      fileUrl: dto.fileUrl ?? null,
      fileName: dto.fileName ?? null,
      mimeType: dto.mimeType ?? null,
      fileSize: dto.fileSize ?? null,
    });
    const saved = await this.certificates.save(certificate);
    await this.affinityRecalculation.requestRecalculation(profile.id);
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
    if (dto.fileUrl !== undefined) {
      // Al reemplazar el archivo se elimina el anterior del almacenamiento.
      if (certificate.fileUrl && certificate.fileUrl !== dto.fileUrl) {
        await this.storage.remove(certificate.fileUrl);
      }
      certificate.fileUrl = dto.fileUrl ?? null;
      certificate.fileName = dto.fileName ?? null;
      certificate.mimeType = dto.mimeType ?? null;
      certificate.fileSize = dto.fileSize ?? null;
    }
    const saved = await this.certificates.save(certificate);
    await this.affinityRecalculation.requestRecalculation(certificate.studentProfileId);
    return saved;
  }

  async remove(userId: string, id: string): Promise<void> {
    const certificate = await this.requireOwned(userId, id);
    await this.certificates.delete(certificate.id);
    if (certificate.fileUrl) {
      await this.storage.remove(certificate.fileUrl);
    }
    await this.affinityRecalculation.requestRecalculation(certificate.studentProfileId);
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
