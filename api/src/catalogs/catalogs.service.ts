import { BadRequestException, ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { FindOptionsWhere, ILike, In, Not, Repository } from 'typeorm';
import { GamificationTrigger, LearningResourceStatus, SYSTEM_GAMIFICATION_TRIGGERS } from '@perfil/shared';
import { AcademicArea } from '../entities/academic-area.entity';
import { Skill } from '../entities/skill.entity';
import { GamificationCriterion } from '../entities/gamification-criterion.entity';
import { ActivityCategory } from '../entities/activity-category.entity';
import { Activity } from '../entities/activity.entity';
import {
  LearningResource,
  LearningResourceSkill,
} from '../entities/learning-resource.entity';
import { CreateAcademicAreaDto } from './dto/create-academic-area.dto';
import { UpdateAcademicAreaDto } from './dto/update-academic-area.dto';
import { CreateSkillDto } from './dto/create-skill.dto';
import { UpdateSkillDto } from './dto/update-skill.dto';
import {
  CreateGamificationCriterionDto,
  UpdateGamificationCriterionDto,
} from './dto/gamification-criterion.dto';
import {
  CreateActivityCategoryDto,
  UpdateActivityCategoryDto,
} from './dto/activity-category.dto';
import {
  CreateLearningResourceDto,
  UpdateLearningResourceDto,
} from './dto/learning-resource.dto';
import { slugCode } from '../common/validation';
import { AuditEventType, AuditService } from '../audit/audit.service';
import { classifySkill, Classification, normalizeTerm } from './skill-classification';

/**
 * Conflicto que señala el campo culpable, para que el formulario ponga el
 * mensaje debajo de esa casilla y no en un aviso general.
 */
function conflicto(campo: string, mensaje: string): ConflictException {
  return new ConflictException({ message: mensaje, fields: { [campo]: [mensaje] } });
}

@Injectable()
export class CatalogsService {
  constructor(
    @InjectRepository(AcademicArea) private readonly areas: Repository<AcademicArea>,
    @InjectRepository(Skill) private readonly skills: Repository<Skill>,
    private readonly audit: AuditService,
    @InjectRepository(GamificationCriterion)
    private readonly criteria: Repository<GamificationCriterion>,
    @InjectRepository(ActivityCategory)
    private readonly activityCategories: Repository<ActivityCategory>,
    @InjectRepository(Activity) private readonly activities: Repository<Activity>,
    @InjectRepository(LearningResource)
    private readonly learningResources: Repository<LearningResource>,
    @InjectRepository(LearningResourceSkill)
    private readonly resourceSkills: Repository<LearningResourceSkill>,
  ) {}

  // ------------------------------------------------------------------
  // Categorias de actividad (RF4)
  // ------------------------------------------------------------------

  /**
   * Solo el administrador ve las categorias dadas de baja; el resto trabaja con
   * el catalogo vigente, para no ofrecer opciones retiradas.
   */
  findActivityCategories(includeInactive = false): Promise<ActivityCategory[]> {
    return this.activityCategories.find({
      where: includeInactive ? {} : { isActive: true },
      order: { name: 'ASC' },
    });
  }

  async createActivityCategory(dto: CreateActivityCategoryDto): Promise<ActivityCategory> {
    await this.assertCategoryCodeFree(dto.code);
    await this.assertCategoryNameFree(dto.name);
    return this.activityCategories.save(
      this.activityCategories.create({
        code: dto.code,
        name: dto.name,
        description: dto.description ?? null,
        appliesTo: dto.appliesTo ?? null,
        isActive: dto.isActive ?? true,
      }),
    );
  }

  async updateActivityCategory(
    id: string,
    dto: UpdateActivityCategoryDto,
  ): Promise<ActivityCategory> {
    const category = await this.activityCategories.findOne({ where: { id } });
    if (!category) {
      throw new NotFoundException('Categoría de actividad no encontrada.');
    }
    if (dto.code !== undefined && dto.code.toLowerCase() !== category.code.toLowerCase()) {
      await this.assertCategoryCodeFree(dto.code, id);
      category.code = dto.code;
    }
    if (dto.name !== undefined && dto.name.toLowerCase() !== category.name.toLowerCase()) {
      await this.assertCategoryNameFree(dto.name, id);
      category.name = dto.name;
    }
    if (dto.description !== undefined) category.description = dto.description?.trim() || null;
    if (dto.appliesTo !== undefined) category.appliesTo = dto.appliesTo ?? null;

    if (dto.isActive !== undefined) {
      // Dar de baja una categoria no borra nada: las actividades que ya la usan
      // la conservan. Solo deja de ofrecerse para nuevas actividades.
      category.isActive = dto.isActive;
    }
    return this.activityCategories.save(category);
  }

  /** Cuantas actividades usan la categoria: la interfaz lo muestra al dar de baja. */
  async countActivitiesByCategory(id: string): Promise<number> {
    return this.activities.count({ where: { categoryId: id } });
  }

  private async assertCategoryCodeFree(code: string, exceptId?: string): Promise<void> {
    const where = exceptId ? { code: ILike(code), id: Not(exceptId) } : { code: ILike(code) };
    if (await this.activityCategories.findOne({ where })) {
      throw new ConflictException('Ya existe una categoría con ese código.');
    }
  }

  private async assertCategoryNameFree(name: string, exceptId?: string): Promise<void> {
    const where = exceptId ? { name: ILike(name), id: Not(exceptId) } : { name: ILike(name) };
    if (await this.activityCategories.findOne({ where })) {
      throw new ConflictException('Ya existe una categoría con ese nombre.');
    }
  }

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
      throw conflicto('name', 'Ya existe un área académica con ese nombre.');
    }
    const code = dto.code
      ? await this.assertCodeFree(this.areas, dto.code, 'área')
      : await this.freeCode(this.areas, slugCode(dto.name));
    return this.areas.save(
      this.areas.create({
        name: dto.name,
        code,
        description: dto.description ?? null,
        tags: dto.tags,
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
        throw conflicto('name', 'Ya existe otra área académica con ese nombre.');
      }
      area.name = dto.name;
    }
    if (dto.code !== undefined && dto.code !== area.code) {
      area.code = await this.assertCodeFree(this.areas, dto.code, 'área', id);
    }
    if (dto.description !== undefined) area.description = dto.description?.trim() || null;
    // Las etiquetas pueden cambiarse, no vaciarse: sin ellas el motor no
    // encuentra el área. El DTO ya exige al menos una si llegan.
    if (Array.isArray(dto.tags)) area.tags = dto.tags;
    if (dto.isActive !== undefined) area.isActive = dto.isActive;
    return this.areas.save(area);
  }

  /** Comprueba que un código esté libre; devuelve el código para encadenar. */
  private async assertCodeFree<T extends { id: string; code: string }>(
    repo: Repository<T>,
    code: string,
    que: string,
    exceptId?: string,
  ): Promise<string> {
    const where = (exceptId ? { code, id: Not(exceptId) } : { code }) as unknown as FindOptionsWhere<T>;
    if (await repo.findOne({ where })) {
      throw conflicto('code', `Ya existe otra ${que === 'área' ? 'área' : 'habilidad'} con el código «${code}».`);
    }
    return code;
  }

  /** El código sugerido, o el primero libre con sufijo: «redes», «redes_2»… */
  private async freeCode<T extends { id: string; code: string }>(
    repo: Repository<T>,
    base: string,
  ): Promise<string> {
    let candidato = base;
    for (let n = 2; await repo.findOne({ where: { code: candidato } as unknown as FindOptionsWhere<T> }); n++) {
      candidato = `${base}_${n}`;
    }
    return candidato;
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

  /** Clasificación sugerida para una tecnología (V2 §23.3), sin guardar nada. */
  async classify(name: string, aliases: string[]): Promise<Classification> {
    const areas = await this.areas.find();
    return classifySkill(name, aliases, areas);
  }

  /**
   * Aplica la validación semántica (V2 §23.3) antes de guardar.
   *
   * - Regla canónica y área distinta → 409 sin opción.
   * - Sugerencia distinta del área elegida → 409 salvo que venga un motivo,
   *   que se audita.
   */
  private async assertClassification(
    name: string,
    aliases: string[],
    areaId: string,
    overrideReason: string | undefined,
    actorUserId: string | null,
    skillId: string | null,
  ): Promise<void> {
    const c = await this.classify(name, aliases);
    if (c.rule === 'none' || c.areaIds.includes(areaId)) return;
    if (c.rule === 'canonical') {
      throw new ConflictException({
        code: 'CLASSIFICATION_BLOCKED',
        message: c.reason,
        fields: { academicAreaId: [`${c.reason} No se puede clasificar en otra área.`] },
        details: { suggestedAreaIds: c.areaIds, suggestedAreaNames: c.areaNames },
      });
    }
    if (!overrideReason) {
      throw new ConflictException({
        code: 'CLASSIFICATION_CONFIRMATION_REQUIRED',
        message: `${c.reason} Si de verdad pertenece al área elegida, indica el motivo.`,
        fields: { academicAreaId: [`${c.reason} Para guardarla en otra área, indica el motivo.`] },
        details: { suggestedAreaIds: c.areaIds, suggestedAreaNames: c.areaNames },
      });
    }
    await this.audit.record({
      actorUserId,
      eventType: AuditEventType.SKILL_CLASSIFICATION_OVERRIDE,
      entityType: 'skill',
      entityId: skillId ?? undefined,
      metadata: { name, chosenAreaId: areaId, suggestedAreaIds: c.areaIds, reason: overrideReason },
    });
  }

  /** Un alias no puede ser el nombre (o alias) de otra habilidad. */
  private async assertAliasesFree(aliases: string[], exceptId?: string): Promise<string[]> {
    const limpios = [...new Map(aliases.map((a) => [normalizeTerm(a), a])).values()];
    if (limpios.length === 0) return [];
    const otras = await this.skills.find(exceptId ? { where: { id: Not(exceptId) } } : {});
    const ocupados = new Map<string, string>();
    for (const o of otras) {
      ocupados.set(normalizeTerm(o.name), o.name);
      for (const al of o.aliases ?? []) ocupados.set(normalizeTerm(al), o.name);
    }
    const choque = limpios.find((a) => ocupados.has(normalizeTerm(a)));
    if (choque) {
      throw conflicto('aliases', `«${choque}» ya identifica a la habilidad «${ocupados.get(normalizeTerm(choque))}».`);
    }
    return limpios;
  }

  async createSkill(dto: CreateSkillDto, actorUserId: string | null = null): Promise<Skill> {
    const exists = await this.skills.findOne({ where: { name: ILike(dto.name) } });
    if (exists) {
      throw conflicto('name', 'La habilidad ya existe en el catálogo.');
    }
    await this.assertAreaExists(dto.academicAreaId, 'academicAreaId');
    const aliases = await this.assertAliasesFree(dto.aliases ?? []);
    await this.assertClassification(dto.name, aliases, dto.academicAreaId, dto.overrideReason, actorUserId, null);
    const code = dto.code
      ? await this.assertCodeFree(this.skills, dto.code, 'habilidad')
      : await this.freeCode(this.skills, slugCode(dto.name));
    return this.skills.save(
      this.skills.create({
        name: dto.name,
        code,
        aliases,
        academicAreaId: dto.academicAreaId,
        isActive: true,
      }),
    );
  }

  async updateSkill(id: string, dto: UpdateSkillDto, actorUserId: string | null = null): Promise<Skill> {
    const skill = await this.skills.findOne({ where: { id } });
    if (!skill) {
      throw new NotFoundException('Habilidad no encontrada.');
    }
    if (dto.name !== undefined && dto.name.toLowerCase() !== skill.name.toLowerCase()) {
      const duplicate = await this.skills.findOne({
        where: { name: ILike(dto.name), id: Not(id) },
      });
      if (duplicate) {
        throw conflicto('name', 'Ya existe otra habilidad con ese nombre.');
      }
      skill.name = dto.name;
    }
    if (dto.code !== undefined && dto.code !== skill.code) {
      skill.code = await this.assertCodeFree(this.skills, dto.code, 'habilidad', id);
    }
    if (dto.aliases !== undefined) {
      skill.aliases = await this.assertAliasesFree(dto.aliases, id);
    }
    if (dto.academicAreaId !== undefined) {
      await this.assertAreaExists(dto.academicAreaId, 'academicAreaId');
      skill.academicAreaId = dto.academicAreaId;
    }
    // Se revalida si cambió algo de lo que decide la clasificación.
    if (dto.name !== undefined || dto.aliases !== undefined || dto.academicAreaId !== undefined) {
      await this.assertClassification(
        skill.name, skill.aliases ?? [], skill.academicAreaId as string, dto.overrideReason, actorUserId, skill.id,
      );
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

  /**
   * Reglas de un criterio de gamificación (§66).
   *
   * - Los hechos que §66 excluye (intereses, autodeclaraciones, proyectos
   *   vacíos) no se pueden premiar: un criterio con ellos no se activa.
   * - Los retos docentes no van por criterios: cada reto lleva sus puntos.
   * - Cada hecho tiene un criterio general (código = hecho). Uno adicional
   *   solo tiene sentido limitado a un área: dos generales competirían.
   */
  private assertCriterionRules(
    trigger: GamificationTrigger,
    code: string,
    areaId: string | null | undefined,
    activo: boolean,
  ) {
    if (trigger === GamificationTrigger.RECONOCIMIENTO_DOCENTE) {
      throw conflicto('trigger', 'Los retos docentes no usan criterios: cada reto define sus propios puntos.');
    }
    if (activo && !SYSTEM_GAMIFICATION_TRIGGERS.includes(trigger)) {
      throw conflicto(
        'trigger',
        'Ese hecho no se puede premiar: §66 excluye intereses, autodeclaraciones, archivos y proyectos vacíos.',
      );
    }
    if (!areaId && code !== trigger) {
      throw conflicto(
        'academicAreaId',
        'Este hecho ya tiene su criterio general. Edítelo, o limite este nuevo criterio a un área.',
      );
    }
  }

  async createCriterion(dto: CreateGamificationCriterionDto): Promise<GamificationCriterion> {
    const exists = await this.criteria.findOne({ where: { code: ILike(dto.code) } });
    if (exists) {
      throw conflicto('code', 'Ya existe un criterio con ese código.');
    }
    this.assertCriterionRules(dto.trigger, dto.code, dto.academicAreaId, dto.isActive ?? true);
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
    this.assertCriterionRules(criterion.trigger, criterion.code, criterion.academicAreaId, criterion.isActive);
    return this.criteria.save(criterion);
  }

  // ================================================================== §61
  //  Catalogo controlado de recursos y cursos externos
  // ====================================================================

  /**
   * Recursos del catalogo.
   *
   * Por omision devuelve solo los vigentes: un recurso retirado no se
   * recomienda (§61). Quien administra el catalogo puede pedir tambien los
   * retirados, porque conservarlos es justamente el punto.
   */
  async findLearningResources(opciones: {
    includeInactive?: boolean;
    academicAreaId?: string;
  } = {}): Promise<LearningResource[]> {
    const where: Record<string, unknown> = {};
    if (!opciones.includeInactive) where.status = LearningResourceStatus.ACTIVE;
    if (opciones.academicAreaId) where.academicAreaId = opciones.academicAreaId;

    return this.learningResources.find({
      where,
      relations: { academicArea: true, resourceSkills: { skill: true } },
      order: { title: 'ASC' },
    });
  }

  async createLearningResource(
    dto: CreateLearningResourceDto,
    createdBy: string,
  ): Promise<LearningResource> {
    await this.assertAreaExists(dto.academicAreaId);
    await this.assertSkillsExist(dto.skillIds);

    // Un mismo enlace dos veces en el catalogo solo genera recomendaciones
    // duplicadas para la misma persona.
    const repetido = await this.learningResources.findOne({ where: { url: dto.url } });
    if (repetido) {
      throw new ConflictException('Ese enlace ya está en el catálogo.');
    }

    const recurso = await this.learningResources.save(
      this.learningResources.create({
        title: dto.title,
        provider: dto.provider,
        url: dto.url,
        description: dto.description ?? null,
        academicAreaId: dto.academicAreaId,
        resourceType: dto.resourceType,
        status: LearningResourceStatus.ACTIVE,
        createdBy,
      }),
    );
    await this.replaceResourceSkills(recurso.id, dto.skillIds);
    return this.findLearningResourceOrFail(recurso.id);
  }

  async updateLearningResource(
    id: string,
    dto: UpdateLearningResourceDto,
  ): Promise<LearningResource> {
    const recurso = await this.learningResources.findOne({ where: { id } });
    if (!recurso) {
      throw new NotFoundException('Recurso no encontrado.');
    }

    if (dto.url !== undefined && dto.url !== recurso.url) {
      const repetido = await this.learningResources.findOne({
        where: { url: dto.url, id: Not(id) },
      });
      if (repetido) {
        throw new ConflictException('Ese enlace ya está en el catálogo.');
      }
      recurso.url = dto.url;
    }
    if (dto.academicAreaId !== undefined) {
      await this.assertAreaExists(dto.academicAreaId);
      recurso.academicAreaId = dto.academicAreaId;
    }
    if (dto.title !== undefined) recurso.title = dto.title;
    if (dto.provider !== undefined) recurso.provider = dto.provider;
    if (dto.description !== undefined) recurso.description = dto.description ?? null;
    if (dto.resourceType !== undefined) recurso.resourceType = dto.resourceType;
    if (dto.status !== undefined) recurso.status = dto.status;

    await this.learningResources.save(recurso);
    if (dto.skillIds !== undefined) {
      await this.assertSkillsExist(dto.skillIds);
      await this.replaceResourceSkills(id, dto.skillIds);
    }
    return this.findLearningResourceOrFail(id);
  }

  private async findLearningResourceOrFail(id: string): Promise<LearningResource> {
    const recurso = await this.learningResources.findOne({
      where: { id },
      relations: { academicArea: true, resourceSkills: { skill: true } },
    });
    if (!recurso) {
      throw new NotFoundException('Recurso no encontrado.');
    }
    return recurso;
  }

  /** Reemplaza, no acumula: editar las habilidades es decir cuales son ahora. */
  private async replaceResourceSkills(
    learningResourceId: string,
    skillIds: string[] | undefined,
  ): Promise<void> {
    if (skillIds === undefined) return;
    await this.resourceSkills.delete({ learningResourceId });
    if (skillIds.length === 0) return;
    await this.resourceSkills.insert(
      skillIds.map((skillId) => ({ learningResourceId, skillId })),
    );
  }

  private async assertSkillsExist(skillIds?: string[]): Promise<void> {
    if (!skillIds || skillIds.length === 0) return;
    const encontradas = await this.skills.count({ where: { id: In(skillIds) } });
    if (encontradas !== skillIds.length) {
      throw new BadRequestException('Alguna de las habilidades indicadas no existe.');
    }
  }

  private async assertAreaExists(areaId?: string | null, campo?: string): Promise<void> {
    if (!areaId) return;
    const exists = await this.areas.exists({ where: { id: areaId } });
    if (!exists) {
      const mensaje = 'El área académica no existe.';
      throw new BadRequestException(campo ? { message: mensaje, fields: { [campo]: [mensaje] } } : mensaje);
    }
  }
}
