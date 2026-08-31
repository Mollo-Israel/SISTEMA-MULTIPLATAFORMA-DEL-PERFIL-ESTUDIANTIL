import { BadRequestException, ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { ILike, Not, Repository } from 'typeorm';
import { AcademicArea } from '../entities/academic-area.entity';
import { Skill } from '../entities/skill.entity';
import { GamificationCriterion } from '../entities/gamification-criterion.entity';
import { CreateAcademicAreaDto } from './dto/create-academic-area.dto';
import { UpdateAcademicAreaDto } from './dto/update-academic-area.dto';
import { CreateSkillDto } from './dto/create-skill.dto';
import { UpdateSkillDto } from './dto/update-skill.dto';
import {
  CreateGamificationCriterionDto,
  UpdateGamificationCriterionDto,
} from './dto/gamification-criterion.dto';

@Injectable()
export class CatalogsService {
  constructor(
    @InjectRepository(AcademicArea) private readonly areas: Repository<AcademicArea>,
    @InjectRepository(Skill) private readonly skills: Repository<Skill>,
    @InjectRepository(GamificationCriterion)
    private readonly criteria: Repository<GamificationCriterion>,
  ) {}

  // ------------------------------------------------------------------
  // Areas academicas
  // ------------------------------------------------------------------

  /**
   * Solo el administrador ve las areas dadas de baja: el resto de los roles
   * trabaja con el catalogo vigente, para no ofrecer opciones retiradas.
   */
  findAreas(includeInactive = false): Promise<AcademicArea[]> {
    return this.areas.find({
      where: includeInactive ? {} : { isActive: true },
      order: { name: 'ASC' },
    });
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
        isActive: true,
      }),
    );
  }

  async updateArea(id: string, dto: UpdateAcademicAreaDto): Promise<AcademicArea> {
    const area = await this.areas.findOne({ where: { id } });
    if (!area) {
      throw new NotFoundException('Área académica no encontrada.');
    }
    if (dto.name !== undefined && dto.name.toLowerCase() !== area.name.toLowerCase()) {
      const duplicate = await this.areas.findOne({
        where: { name: ILike(dto.name), id: Not(id) },
      });
      if (duplicate) {
        throw new ConflictException('Ya existe otra área académica con ese nombre.');
      }
      area.name = dto.name;
    }
    if (dto.description !== undefined) area.description = dto.description ?? null;
    if (dto.tags !== undefined) area.tags = dto.tags ?? null;
    if (dto.isActive !== undefined) area.isActive = dto.isActive;
    return this.areas.save(area);
  }

  // ------------------------------------------------------------------
  // Habilidades
  // ------------------------------------------------------------------

  findSkills(includeInactive = false): Promise<Skill[]> {
    return this.skills.find({
      where: includeInactive ? {} : { isActive: true },
      relations: { academicArea: true },
      order: { name: 'ASC' },
    });
  }

  async createSkill(dto: CreateSkillDto): Promise<Skill> {
    const exists = await this.skills.findOne({ where: { name: ILike(dto.name) } });
    if (exists) {
      throw new ConflictException('La habilidad ya existe en el catálogo.');
    }
    await this.assertAreaExists(dto.academicAreaId);
    return this.skills.save(
      this.skills.create({
        name: dto.name,
        academicAreaId: dto.academicAreaId ?? null,
        isActive: true,
      }),
    );
  }

  async updateSkill(id: string, dto: UpdateSkillDto): Promise<Skill> {
    const skill = await this.skills.findOne({ where: { id } });
    if (!skill) {
      throw new NotFoundException('Habilidad no encontrada.');
    }
    if (dto.name !== undefined && dto.name.toLowerCase() !== skill.name.toLowerCase()) {
      const duplicate = await this.skills.findOne({
        where: { name: ILike(dto.name), id: Not(id) },
      });
      if (duplicate) {
        throw new ConflictException('Ya existe otra habilidad con ese nombre.');
      }
      skill.name = dto.name;
    }
    if (dto.academicAreaId !== undefined) {
      await this.assertAreaExists(dto.academicAreaId);
      skill.academicAreaId = dto.academicAreaId ?? null;
    }
    if (dto.isActive !== undefined) skill.isActive = dto.isActive;
    return this.skills.save(skill);
  }

  // ------------------------------------------------------------------
  // Criterios de gamificacion (administrables; aun sin motor que los consuma)
  // ------------------------------------------------------------------

  findCriteria(includeInactive = false): Promise<GamificationCriterion[]> {
    return this.criteria.find({
      where: includeInactive ? {} : { isActive: true },
      relations: { academicArea: true },
      order: { code: 'ASC' },
    });
  }

  async createCriterion(dto: CreateGamificationCriterionDto): Promise<GamificationCriterion> {
    const exists = await this.criteria.findOne({ where: { code: ILike(dto.code) } });
    if (exists) {
      throw new ConflictException('Ya existe un criterio con ese código.');
    }
    await this.assertAreaExists(dto.academicAreaId);
    return this.criteria.save(
      this.criteria.create({
        code: dto.code,
        name: dto.name,
        description: dto.description ?? null,
        trigger: dto.trigger,
        points: dto.points,
        academicAreaId: dto.academicAreaId ?? null,
        isActive: dto.isActive ?? true,
      }),
    );
  }

  async updateCriterion(
    id: string,
    dto: UpdateGamificationCriterionDto,
  ): Promise<GamificationCriterion> {
    const criterion = await this.criteria.findOne({ where: { id } });
    if (!criterion) {
      throw new NotFoundException('Criterio no encontrado.');
    }
    if (dto.code !== undefined && dto.code.toLowerCase() !== criterion.code.toLowerCase()) {
      const duplicate = await this.criteria.findOne({
        where: { code: ILike(dto.code), id: Not(id) },
      });
      if (duplicate) {
        throw new ConflictException('Ya existe otro criterio con ese código.');
      }
      criterion.code = dto.code;
    }
    if (dto.name !== undefined) criterion.name = dto.name;
    if (dto.description !== undefined) criterion.description = dto.description ?? null;
    if (dto.trigger !== undefined) criterion.trigger = dto.trigger;
    if (dto.points !== undefined) criterion.points = dto.points;
    if (dto.academicAreaId !== undefined) {
      await this.assertAreaExists(dto.academicAreaId);
      criterion.academicAreaId = dto.academicAreaId ?? null;
    }
    if (dto.isActive !== undefined) criterion.isActive = dto.isActive;
    return this.criteria.save(criterion);
  }

  private async assertAreaExists(areaId?: string | null): Promise<void> {
    if (!areaId) return;
    const exists = await this.areas.exists({ where: { id: areaId } });
    if (!exists) {
      throw new BadRequestException('El área académica no existe.');
    }
  }
}
