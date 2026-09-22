import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { InternalConstancy } from '../entities/internal-constancy.entity';
import { StudentProfile } from '../entities/student-profile.entity';
import { Activity } from '../entities/activity.entity';
import { ActivityRegistration } from '../entities/activity-registration.entity';
import { TrajectoryModule } from '../trajectory/trajectory.module';
import { AccessModule } from '../access/access.module';
import { ConstanciesService } from './constancies.service';
import { ConstanciesController } from './constancies.controller';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      InternalConstancy,
      StudentProfile,
      Activity,
      ActivityRegistration,
    ]),
    TrajectoryModule,
    AccessModule,
  ],
  controllers: [ConstanciesController],
  providers: [ConstanciesService],
})
export class ConstanciesModule {}
