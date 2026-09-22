import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AcademicArea } from '../entities/academic-area.entity';
import { Skill } from '../entities/skill.entity';
import { GamificationCriterion } from '../entities/gamification-criterion.entity';
import { ActivityCategory } from '../entities/activity-category.entity';
import { Activity } from '../entities/activity.entity';
import {
  LearningResource,
  LearningResourceSkill,
} from '../entities/learning-resource.entity';
import { CatalogsService } from './catalogs.service';
import { CatalogsController } from './catalogs.controller';

@Module({
  imports: [TypeOrmModule.forFeature([
      AcademicArea,
      Skill,
      GamificationCriterion,
      ActivityCategory,
      Activity,
      LearningResource,
      LearningResourceSkill,
    ])],
  controllers: [CatalogsController],
  providers: [CatalogsService],
})
export class CatalogsModule {}
