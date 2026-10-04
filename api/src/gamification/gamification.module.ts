import { ActivityGamificationRule } from '../entities/activity-review.entity';
import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ActivityRegistration } from '../entities/activity-registration.entity';
import { AffinityResult } from '../entities/affinity-result.entity';
import { ExternalCertificate } from '../entities/external-certificate.entity';
import { InternalConstancy } from '../entities/internal-constancy.entity';
import { Project } from '../entities/project.entity';
import { ProjectEvidence } from '../entities/project-evidence.entity';
import { ProjectMember } from '../entities/project-member.entity';
import { StudentProfile } from '../entities/student-profile.entity';
import { StudentSkill } from '../entities/student-skill.entity';
import { Contact, TeamMember } from '../entities/collaboration.entity';
import {
  Badge,
  GamificationEvent,
  StudentBadge,
  StudentPoints,
} from '../entities/gamification.entity';
import { GamificationCriterion } from '../entities/gamification-criterion.entity';
import {
  GamificationChallenge,
  GamificationReward,
  RewardRedemption,
} from '../entities/gamification-extra.entity';
import { AccessModule } from '../access/access.module';
import { StudentContactChannel } from '../entities/contact-channel.entity';
import { AiAssistanceRun } from '../entities/ai-assistance-run.entity';
import { GamificationExtrasService } from './gamification-extras.service';
import { TrajectorySummaryService } from '../trajectory/trajectory-summary.service';
import { GamificationService } from './gamification.service';
import { GamificationController } from './gamification.controller';
import { GamificationExtrasController } from './gamification-extras.controller';

/**
 * Gamificación y resumen de trayectoria (§66, §67, §134).
 *
 * El resumen vive aquí y no en `TrajectoryModule` a propósito: aquel coordina
 * recálculos —afinidad, recomendaciones, gamificación— y este produce lo que el
 * estudiante se lleva. Juntarlos haría que el coordinador arrastrase media base
 * de datos para algo que no necesita.
 *
 * `GamificationService` se exporta para que el coordinador de §109 lo llame.
 */
@Module({
  imports: [
    TypeOrmModule.forFeature([
      StudentProfile,
      StudentSkill,
      AffinityResult,
      ActivityRegistration,
      Project,
      ProjectMember,
      ProjectEvidence,
      ExternalCertificate,
      InternalConstancy,
      Contact,
      TeamMember,
      GamificationEvent,
      StudentPoints,
      Badge,
      StudentBadge,
      GamificationCriterion,
      GamificationChallenge,
      GamificationReward,
      RewardRedemption,
      ActivityGamificationRule,
      StudentContactChannel,
      AiAssistanceRun,
    ]),
    AccessModule,
  ],
  controllers: [GamificationController, GamificationExtrasController],
  providers: [GamificationService, GamificationExtrasService, TrajectorySummaryService],
  exports: [GamificationService],
})
export class GamificationModule {}
