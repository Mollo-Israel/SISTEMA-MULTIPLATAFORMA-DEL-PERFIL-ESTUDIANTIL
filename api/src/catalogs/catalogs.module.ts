import { AccessModule } from '../access/access.module';
import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AcademicArea } from '../entities/academic-area.entity';
import { Skill } from '../entities/skill.entity';
import { SkillAreaRelation } from '../entities/skill-area-relation.entity';
import { LearningResourceArea } from '../entities/learning-resource-library.entity';
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
  imports: [
    AccessModule,TypeOrmModule.forFeature([
      AcademicArea,
      Skill,
      SkillAreaRelation,
      LearningResourceArea,
      GamificationCriterion,
      ActivityCategory,
      Activity,
      LearningResource,
      LearningResourceSkill,
    ])],
  controllers: [CatalogsController],
  providers: [CatalogsService],
  // V5-25: Administración resuelve los pedidos de tecnologías con las mismas reglas del catálogo.
  exports: [CatalogsService],
})
export class CatalogsModule {}
