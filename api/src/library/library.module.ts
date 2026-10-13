import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { LearningResource } from '../entities/learning-resource.entity';
import { LearningResourceFavorite } from '../entities/learning-resource-library.entity';
import { StudentProfile } from '../entities/student-profile.entity';
import { LibraryService } from './library.service';
import { LibraryController } from './library.controller';

@Module({
  imports: [TypeOrmModule.forFeature([LearningResource, LearningResourceFavorite, StudentProfile])],
  controllers: [LibraryController],
  providers: [LibraryService],
  exports: [LibraryService],
})
export class LibraryModule {}
