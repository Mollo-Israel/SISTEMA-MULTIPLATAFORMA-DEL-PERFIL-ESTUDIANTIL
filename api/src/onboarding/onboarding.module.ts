import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AcademicArea } from '../entities/academic-area.entity';
import { OnboardingAnswer, OnboardingRun } from '../entities/onboarding-run.entity';
import { StudentInterest } from '../entities/student-interest.entity';
import { StudentProfile } from '../entities/student-profile.entity';
import { OnboardingController } from './onboarding.controller';
import { OnboardingService } from './onboarding.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      OnboardingRun,
      OnboardingAnswer,
      StudentProfile,
      StudentInterest,
      AcademicArea,
    ]),
  ],
  controllers: [OnboardingController],
  providers: [OnboardingService],
  exports: [OnboardingService],
})
export class OnboardingModule {}
