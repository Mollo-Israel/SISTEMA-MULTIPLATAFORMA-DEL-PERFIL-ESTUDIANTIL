import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AcademicArea } from '../entities/academic-area.entity';
import { Skill } from '../entities/skill.entity';
import { CatalogsService } from './catalogs.service';
import { CatalogsController } from './catalogs.controller';

@Module({
  imports: [TypeOrmModule.forFeature([AcademicArea, Skill])],
  controllers: [CatalogsController],
  providers: [CatalogsService],
})
export class CatalogsModule {}
