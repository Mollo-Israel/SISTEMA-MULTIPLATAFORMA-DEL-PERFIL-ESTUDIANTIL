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
    const certificate = this.certificates.create({
      studentProfileId: profile.id,
      certificateName: dto.certificateName,
      issuer: dto.issuer,
      certificateUrl: dto.certificateUrl ?? null,
      issueDate: dto.issueDate ?? null,
    });
    const saved = await this.certificates.save(certificate);
    await this.affinityRecalculation.requestRecalculation(profile.id);
    return saved;
  }

  async findMine(userId: string): Promise<ExternalCertificate[]> {
    const profile = await this.requireProfile(userId);
    return this.certificates.find({
      where: { studentProfileId: profile.id },
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
    if (dto.certificateUrl !== undefined) certificate.certificateUrl = dto.certificateUrl;
    if (dto.issueDate !== undefined) certificate.issueDate = dto.issueDate;
    const saved = await this.certificates.save(certificate);
    await this.affinityRecalculation.requestRecalculation(certificate.studentProfileId);
    return saved;
  }

  async remove(userId: string, id: string): Promise<void> {
    const certificate = await this.requireOwned(userId, id);
    await this.certificates.delete(certificate.id);
    await this.affinityRecalculation.requestRecalculation(certificate.studentProfileId);
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
