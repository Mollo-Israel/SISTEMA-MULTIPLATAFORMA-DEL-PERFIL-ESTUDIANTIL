import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ExternalCertificate } from '../entities/external-certificate.entity';
import { StudentProfile } from '../entities/student-profile.entity';
import { AcademicArea } from '../entities/academic-area.entity';
import { StorageModule } from '../storage/storage.module';
import { TrajectoryModule } from '../trajectory/trajectory.module';
import { CertificatesService } from './certificates.service';
import { CertificatesController } from './certificates.controller';

@Module({
  imports: [
    TypeOrmModule.forFeature([ExternalCertificate, StudentProfile, AcademicArea]),
    TrajectoryModule,
    StorageModule,
  ],
  controllers: [CertificatesController],
  providers: [CertificatesService],
})
export class CertificatesModule {}
