import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { MulterModule } from '@nestjs/platform-express';
import { memoryStorage } from 'multer';
import { ImportBatch, ImportBatchRow } from '../entities/import-batch.entity';
import { User } from '../entities/user.entity';
import { StudentProfile } from '../entities/student-profile.entity';
import { Role } from '../entities/role.entity';
import { TeacherSemesterAccess } from '../entities/teacher-semester-access.entity';
import { IdentityModule } from '../identity/identity.module';
import { ImportsService } from './imports.service';
import { TeacherImportService } from './teacher-import.service';
import { ImportsController } from './imports.controller';

/** Importacion de padron de estudiantes y de docentes (especificacion §10, V3 §7.1). */
@Module({
  imports: [
    TypeOrmModule.forFeature([ImportBatch, ImportBatchRow, User, StudentProfile, Role, TeacherSemesterAccess]),
    MulterModule.register({ storage: memoryStorage() }),
    IdentityModule,
  ],
  controllers: [ImportsController],
  providers: [ImportsService, TeacherImportService],
  exports: [ImportsService, TeacherImportService],
})
export class ImportsModule {}
