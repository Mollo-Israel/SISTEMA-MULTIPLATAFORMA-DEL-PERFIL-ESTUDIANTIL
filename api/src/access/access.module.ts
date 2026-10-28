import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { TeacherSemesterAccess } from '../entities/teacher-semester-access.entity';
import { StudentProfile } from '../entities/student-profile.entity';
import { ApprovalPolicy } from '../entities/approval-policy.entity';
import { User } from '../entities/user.entity';
import { TeacherScopeService } from './teacher-scope.service';
import { ApprovalPoliciesService } from './approval-policies.service';
import { ApprovalPoliciesController } from './approval-policies.controller';

/**
 * Reglas de alcance transversales. Se exporta para que perfiles, afinidad y
 * constancias apliquen la misma restriccion por semestre sin duplicarla.
 */
@Module({
  imports: [TypeOrmModule.forFeature([TeacherSemesterAccess, StudentProfile, ApprovalPolicy, User])],
  controllers: [ApprovalPoliciesController],
  // V5 §9.2: la autonomía docente se consulta en cada endpoint que la usa.
  providers: [TeacherScopeService, ApprovalPoliciesService],
  exports: [TeacherScopeService, ApprovalPoliciesService],
})
export class AccessModule {}
