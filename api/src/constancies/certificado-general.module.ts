import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Activity } from '../entities/activity.entity';
import { ActivityRegistration } from '../entities/activity-registration.entity';
import { InternalConstancy } from '../entities/internal-constancy.entity';
import { StoredFileRecord } from '../entities/stored-file.entity';
import { TrajectoryModule } from '../trajectory/trajectory.module';
import { CertificadoGeneralService } from './certificado-general.service';

/**
 * V7.1 D05: la entrega del certificado general la usan la gestión de
 * actividades (cierre de lista, fin) y la de constancias (entrega manual), sin
 * que esos módulos dependan uno del otro.
 */
@Module({
  imports: [TypeOrmModule.forFeature([Activity, ActivityRegistration, InternalConstancy, StoredFileRecord]), TrajectoryModule],
  providers: [CertificadoGeneralService],
  exports: [CertificadoGeneralService],
})
export class CertificadoGeneralModule {}
