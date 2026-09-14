import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { StudentProfile } from '../entities/student-profile.entity';
import { AffinityResult } from '../entities/affinity-result.entity';
import { StudentInterest } from '../entities/student-interest.entity';
import { StudentFreeInterest } from '../entities/student-free-interest.entity';
import { StudentSkill } from '../entities/student-skill.entity';
import { AcademicArea } from '../entities/academic-area.entity';
import { Activity } from '../entities/activity.entity';
import { ActivityRegistration } from '../entities/activity-registration.entity';
import { Project } from '../entities/project.entity';
import { ProjectMember } from '../entities/project-member.entity';
import { Recommendation } from '../entities/recommendation.entity';
import { RecommendationsEngine } from './recommendations.engine';
import { RecommendationsService } from './recommendations.service';
import { RecommendationsController } from './recommendations.controller';

/**
 * Modulo de recomendaciones academicas (Objetivo 7, RF18).
 *
 * El diagrama de componentes del documento agrupa "Afinidad y
 * Recomendaciones" en un solo modulo. Aqui son dos modulos de Nest porque
 * tienen ciclos de vida distintos: la afinidad se recalcula cuando cambia el
 * perfil, y las recomendaciones cuando el estudiante las consulta. Las
 * recomendaciones leen los resultados de la afinidad; la afinidad no sabe nada
 * de las recomendaciones.
 */
@Module({
  imports: [
    TypeOrmModule.forFeature([
      StudentProfile,
      AffinityResult,
      StudentInterest,
      StudentFreeInterest,
      StudentSkill,
      AcademicArea,
      Activity,
      ActivityRegistration,
      Project,
      ProjectMember,
      Recommendation,
    ]),
  ],
  controllers: [RecommendationsController],
  providers: [RecommendationsEngine, RecommendationsService],
  exports: [RecommendationsService],
})
export class RecommendationsModule {}
