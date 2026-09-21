import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { MulterModule } from '@nestjs/platform-express';
import { memoryStorage } from 'multer';
import { ImportBatch, ImportBatchRow } from '../entities/import-batch.entity';
import { User } from '../entities/user.entity';
import { StudentProfile } from '../entities/student-profile.entity';
import { Role } from '../entities/role.entity';
import { IdentityModule } from '../identity/identity.module';
import { ImportsService } from './imports.service';
import { ImportsController } from './imports.controller';

/** Importacion de padron (especificacion §10). */
@Module({
  imports: [
    TypeOrmModule.forFeature([ImportBatch, ImportBatchRow, User, StudentProfile, Role]),
    MulterModule.register({ storage: memoryStorage() }),
    IdentityModule,
  ],
  controllers: [ImportsController],
  providers: [ImportsService],
  exports: [ImportsService],
})
export class ImportsModule {}
