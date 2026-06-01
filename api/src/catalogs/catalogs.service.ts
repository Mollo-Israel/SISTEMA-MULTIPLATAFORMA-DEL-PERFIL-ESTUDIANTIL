import { BadRequestException, ConflictException, Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { ILike, Repository } from 'typeorm';
import { AcademicArea } from '../entities/academic-area.entity';
import { Skill } from '../entities/skill.entity';
import { CreateAcademicAreaDto } from './dto/create-academic-area.dto';
import { CreateSkillDto } from './dto/create-skill.dto';

@Injectable()
export class CatalogsService {
  constructor(
    @InjectRepository(AcademicArea) private readonly areas: Repository<AcademicArea>,
    @InjectRepository(Skill) private readonly skills: Repository<Skill>,
  ) {}

  findAreas(): Promise<AcademicArea[]> {
    return this.areas.find({ order: { name: 'ASC' } });
  }

  async createArea(dto: CreateAcademicAreaDto): Promise<AcademicArea> {
    const exists = await this.areas.findOne({ where: { name: ILike(dto.name) } });
    if (exists) {
      throw new ConflictException('El área académica ya existe.');
    }
    return this.areas.save(
      this.areas.create({
        name: dto.name,
        description: dto.description ?? null,
        tags: dto.tags ?? null,
      }),
    );
  }

  findSkills(): Promise<Skill[]> {
    return this.skills.find({ relations: { academicArea: true }, order: { name: 'ASC' } });
  }

  async createSkill(dto: CreateSkillDto): Promise<Skill> {
    const exists = await this.skills.findOne({ where: { name: ILike(dto.name) } });
    if (exists) {
      throw new ConflictException('La habilidad ya existe en el catálogo.');
    }
    if (dto.academicAreaId) {
      const areaExists = await this.areas.exists({ where: { id: dto.academicAreaId } });
      if (!areaExists) {
        throw new BadRequestException('El área académica no existe.');
      }
    }
    return this.skills.save(
      this.skills.create({ name: dto.name, academicAreaId: dto.academicAreaId ?? null }),
    );
  }
}
