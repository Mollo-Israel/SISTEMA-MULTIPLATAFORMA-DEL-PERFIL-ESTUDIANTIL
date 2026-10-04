import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AcademicArea } from '../entities/academic-area.entity';
import { AffinityResult } from '../entities/affinity-result.entity';
import { AffinitySnapshot } from '../entities/affinity-snapshot.entity';
import { Project } from '../entities/project.entity';
import { StudentProfile } from '../entities/student-profile.entity';
import { StudentSkillInterest } from '../entities/student-skill-interest.entity';
import {
  Contact,
  ContactRequest,
  Team,
  TeamInvitation,
  TeamMember,
  TeamNeed,
  TeamNeedArea,
  TeamNeedSkill,
} from '../entities/collaboration.entity';
import { PublicProfileService } from './public-profile.service';
import { ContactsService } from './contacts.service';
import { TeamsService } from './teams.service';
import { ContactNote, StudentContactChannel } from '../entities/contact-channel.entity';
import { CollaborationController } from './collaboration.controller';
import { AiModule } from '../ai/ai.module';

/**
 * Colaboración entre estudiantes (§42 a §47, §133).
 *
 * Los cuatro servicios están juntos porque comparten la misma regla y se apoyan
 * unos en otros: la mensajería pregunta a contactos y a equipos si existe la
 * relación que justifica el canal (§42), y los equipos abren la conversación al
 * formarse. Separarlos obligaría a exportar esas comprobaciones, y una
 * comprobación de permiso que viaja entre módulos acaba duplicándose.
 */
@Module({
  imports: [
    TypeOrmModule.forFeature([
      StudentProfile,
      StudentSkillInterest,
      AcademicArea,
      AffinityResult,
      AffinitySnapshot,
      Project,
      Contact,
      ContactRequest,
      TeamNeed,
      TeamNeedSkill,
      TeamNeedArea,
      Team,
      TeamMember,
      TeamInvitation,
      StudentContactChannel,
      ContactNote,
    ]),
    // §44: la IA es la segunda barrera de los nombres de equipo, nunca la única.
    AiModule,
  ],
  controllers: [CollaborationController],
  providers: [PublicProfileService, ContactsService, TeamsService],
  exports: [ContactsService, TeamsService],
})
export class CollaborationModule {}
