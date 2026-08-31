import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { TeacherSemesterAccess } from '../entities/teacher-semester-access.entity';
import { StudentProfile } from '../entities/student-profile.entity';
import { TeacherScopeService } from './teacher-scope.service';

/**
 * Reglas de alcance transversales. Se exporta para que perfiles, afinidad y
 * constancias apliquen la misma restriccion por semestre sin duplicarla.
 */
@Module({
  imports: [TypeOrmModule.forFeature([TeacherSemesterAccess, StudentProfile])],
  providers: [TeacherScopeService],
  exports: [TeacherScopeService],
})
export class AccessModule {}
