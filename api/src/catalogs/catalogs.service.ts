import { TeacherScopeService } from '../access/teacher-scope.service';
import { AuthenticatedUser } from '../auth/types/authenticated-user';
import { BadRequestException, ConflictException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { FindOptionsWhere, ILike, In, Not, Repository } from 'typeorm';
import { GamificationTrigger, LearningResourceStatus, RolNombre, SYSTEM_GAMIFICATION_TRIGGERS } from '@perfil/shared';
import { AcademicArea } from '../entities/academic-area.entity';
import { Skill } from '../entities/skill.entity';
import { SkillAreaRelation } from '../entities/skill-area-relation.entity';
import { LearningResourceArea } from '../entities/learning-resource-library.entity';
import { StoredFileRecord } from '../entities/stored-file.entity';
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
import { analyzeAreaTags, AreaTagAnalysis, classifySkill, Classification, normalizeTerm } from './skill-classification';

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
    @InjectRepository(SkillAreaRelation) private readonly skillAreas: Repository<SkillAreaRelation>,
    @InjectRepository(LearningResourceArea) private readonly resourceAreas: Repository<LearningResourceArea>,
    private readonly audit: AuditService,
    private readonly teacherScope: TeacherScopeService,
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

  /** Riesgos de unas etiquetas antes de guardarlas (V3 §9.4). */
  async analyzeTags(tags: string[], exceptId?: string): Promise<AreaTagAnalysis> {
    const [areas, skills] = await Promise.all([this.areas.find(), this.skills.find({ where: { isActive: true } })]);
    return analyzeAreaTags(tags ?? [], areas, exceptId, skills);
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
    // Las etiquetas pueden cambiarse, no vaciarse: sin ellas el sugeridor no
    // puede proponer el área (V3.2 §10.3: no puntúan). El DTO exige al menos una.
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

  async findSkills(includeInactive = false): Promise<Skill[]> {
    const lista = await this.skills.find({
      where: includeInactive ? {} : { isActive: true },
      relations: { academicArea: true },
      order: { name: 'ASC' },
    });
    return this.withSecondaryAreas(lista);
  }

  /** V3.2 §11: completa las áreas secundarias de cada habilidad (una consulta). */
  async withSecondaryAreas(lista: Skill[]): Promise<Skill[]> {
    if (lista.length === 0) return lista;
    const relaciones = await this.skillAreas.find({ where: { skillId: In(lista.map((s) => s.id)) } });
    const porSkill = new Map<string, string[]>();
    for (const r of relaciones) porSkill.set(r.skillId, [...(porSkill.get(r.skillId) ?? []), r.academicAreaId]);
    for (const s of lista) s.secondaryAreaIds = porSkill.get(s.id) ?? [];
    return lista;
  }

  /**
   * V3.2 §11: valida y deja las áreas secundarias de una habilidad. Ninguna
   * repite la principal ni se repite; todas existen.
   */
  private async limpiarSecundarias(ids: string[] | undefined, principal: string | null): Promise<string[] | undefined> {
    if (ids === undefined) return undefined;
    const unicas = [...new Set(ids)].filter((id) => id !== principal);
    if (unicas.length === 0) return [];
    const existen = await this.areas.count({ where: { id: In(unicas) } });
    if (existen !== unicas.length) {
      throw conflicto('secondaryAreaIds', 'Alguna de las áreas secundarias no existe en el catálogo.');
    }
    return unicas;
  }

  private async guardarSecundarias(skillId: string, ids: string[] | undefined): Promise<void> {
    if (ids === undefined) return;
    await this.skillAreas.delete({ skillId });
    if (ids.length > 0) {
      await this.skillAreas.insert(ids.map((academicAreaId) => ({ skillId, academicAreaId, relationType: 'SECONDARY' as const })));
    }
  }

  /** Clasificación sugerida para una tecnología (V2 §23.3), sin guardar nada. */
  async classify(name: string, aliases: string[], exceptSkillId?: string): Promise<Classification> {
    const [areas, catalogo] = await Promise.all([
      this.areas.find(),
      // La propia habilidad (al editar) no puede sugerirse a sí misma.
      this.skills.find({ where: exceptSkillId ? { isActive: true, id: Not(exceptSkillId) } : { isActive: true } }),
    ]);
    return classifySkill(name, aliases, areas, await this.withSecondaryAreas(catalogo));
  }

  /**
   * Aplica la validación semántica (V3.2 §10.5, §10.6) antes de guardar.
   *
   * No hay reglas duras en el código: el catálogo es el conocimiento y el
   * administrador decide. Una sugerencia de confianza alta o media que no
   * incluya ninguna de las áreas elegidas (principal o secundarias) pide un
   * motivo, que se audita. Una sugerencia débil solo orienta.
   */
  private async assertClassification(
    name: string,
    aliases: string[],
    areaIds: string[],
    overrideReason: string | undefined,
    actorUserId: string | null,
    skillId: string | null,
  ): Promise<void> {
    const c = await this.classify(name, aliases, skillId ?? undefined);
    if (c.rule === 'none' || c.confidence === 'low' || c.areaIds.some((id) => areaIds.includes(id))) return;
    const areaId = areaIds[0];
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

  /** V3.2 §10.4: un nombre que ya es alias de otra habilidad es la misma habilidad. */
  private async assertNameNotAlias(name: string, exceptId?: string): Promise<void> {
    const norm = normalizeTerm(name);
    const otras = await this.skills.find(exceptId ? { where: { id: Not(exceptId) } } : {});
    const duena = otras.find((o) => (o.aliases ?? []).some((a) => normalizeTerm(a) === norm));
    if (duena) {
      throw conflicto('name', `«${name}» ya es otro nombre de la habilidad «${duena.name}»: no se crea dos veces.`);
    }
  }

  async createSkill(dto: CreateSkillDto, actorUserId: string | null = null): Promise<Skill> {
    const exists = await this.skills.findOne({ where: { name: ILike(dto.name) } });
    if (exists) {
      throw conflicto('name', 'La habilidad ya existe en el catálogo.');
    }
    await this.assertNameNotAlias(dto.name);
    await this.assertAreaExists(dto.academicAreaId, 'academicAreaId');
    const aliases = await this.assertAliasesFree(dto.aliases ?? []);
    const secundarias = (await this.limpiarSecundarias(dto.secondaryAreaIds, dto.academicAreaId)) ?? [];
    await this.assertClassification(
      dto.name, aliases, [dto.academicAreaId, ...secundarias], dto.overrideReason, actorUserId, null,
    );
    const code = dto.code
      ? await this.assertCodeFree(this.skills, dto.code, 'habilidad')
      : await this.freeCode(this.skills, slugCode(dto.name));
    const creada = await this.skills.save(
      this.skills.create({
        name: dto.name,
        code,
        aliases,
        academicAreaId: dto.academicAreaId,
        isActive: true,
      }),
    );
    await this.guardarSecundarias(creada.id, secundarias);
    creada.secondaryAreaIds = secundarias;
    return creada;
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
      await this.assertNameNotAlias(dto.name, id);
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
    const secundarias = await this.limpiarSecundarias(dto.secondaryAreaIds, skill.academicAreaId);
    const vigentes = secundarias
      ?? (await this.skillAreas.find({ where: { skillId: id } }))
        .map((r) => r.academicAreaId)
        .filter((a) => a !== skill.academicAreaId);
    // Se revalida si cambió algo de lo que decide la clasificación.
    if (dto.name !== undefined || dto.aliases !== undefined || dto.academicAreaId !== undefined || secundarias !== undefined) {
      await this.assertClassification(
        skill.name, skill.aliases ?? [], [skill.academicAreaId as string, ...vigentes], dto.overrideReason, actorUserId, skill.id,
      );
    }
    if (dto.isActive !== undefined) skill.isActive = dto.isActive;
    const guardada = await this.skills.save(skill);
    // Si la principal pasó a ser una de las secundarias, deja de serlo.
    await this.guardarSecundarias(id, secundarias ?? (dto.academicAreaId !== undefined ? vigentes : undefined));
    guardada.secondaryAreaIds = vigentes;
    return guardada;
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
    viewer?: AuthenticatedUser;
  } = {}): Promise<LearningResource[]> {
    const where: Record<string, unknown> = {};
    if (!opciones.includeInactive) where.status = LearningResourceStatus.ACTIVE;
    if (opciones.academicAreaId) where.academicAreaId = opciones.academicAreaId;

    const lista = await this.learningResources.find({
      where,
      relations: { academicArea: true, resourceSkills: { skill: true } },
      order: { title: 'ASC' },
    });
    // V4.1 A41-014: lo que espera revisión lo ven Dirección, Administración y
    // quien lo propuso; el resto, solo lo publicado.
    const rol = opciones.viewer?.role;
    const autoridad = rol === RolNombre.ADMIN || rol === RolNombre.CAREER_DIRECTOR;
    const visibles = lista.filter((r) => r.reviewStatus === 'not_required' || r.reviewStatus === 'approved'
      || autoridad || (opciones.viewer && r.createdBy === opciones.viewer.userId));
    return this.conAreasEImagen(visibles);
  }

  /** V4.1 A41-014 (§9.4): bandeja de Dirección para recursos propuestos. */
  async pendingLearningResources(): Promise<LearningResource[]> {
    const lista = await this.learningResources.find({
      where: { reviewStatus: 'pending' },
      relations: { academicArea: true, resourceSkills: { skill: true } },
      order: { createdAt: 'ASC' } as never,
    });
    return this.conAreasEImagen(lista);
  }

  async reviewLearningResource(
    user: AuthenticatedUser,
    id: string,
    decision: 'approve' | 'observe' | 'reject',
    comment?: string,
  ): Promise<LearningResource> {
    const recurso = await this.learningResources.findOne({ where: { id } });
    if (!recurso) throw new NotFoundException('Recurso no encontrado.');
    if (recurso.reviewStatus !== 'pending') {
      throw new ConflictException('Solo se revisa un recurso propuesto que está pendiente.');
    }
    if (decision !== 'approve' && !comment?.trim()) {
      const m = 'Explica qué hay que corregir o por qué se rechaza.';
      throw new BadRequestException({ message: m, fields: { comment: [m] } });
    }
    recurso.reviewStatus = decision === 'approve' ? 'approved' : decision === 'observe' ? 'observed' : 'rejected';
    recurso.reviewComment = comment?.trim() || null;
    recurso.reviewedBy = user.userId;
    recurso.reviewedAt = new Date();
    await this.learningResources.save(recurso);
    await this.audit.record({
      actorUserId: user.userId,
      eventType: AuditEventType.RESOURCE_REVIEWED,
      entityType: 'learning_resource',
      entityId: recurso.id,
      metadata: { decision, comment: recurso.reviewComment },
    });
    return this.findLearningResourceOrFail(recurso.id);
  }

  /**
   * V4.1 A41-014: semestres de un recurso. Un docente solo dentro de los suyos
   * (vacío = todos los suyos); Dirección y Administración, cualquiera.
   */
  private async semestresDelRecurso(user: AuthenticatedUser | undefined, pedidos: number[] | undefined): Promise<number[]> {
    const unicos = [...new Set(pedidos ?? [])].sort((a, b) => a - b);
    if (!user || user.role !== RolNombre.TEACHER) return unicos;
    const suyos = await this.teacherScope.allowedSemesters(user.userId);
    if (unicos.length === 0) return suyos;
    const fuera = unicos.filter((s) => !suyos.includes(s));
    if (fuera.length) {
      const m = `Solo puedes proponer recursos para tus semestres (${suyos.map((s) => `${s}.º`).join(', ') || 'ninguno habilitado'}).`;
      throw new BadRequestException({ message: m, fields: { semesterScope: [m] } });
    }
    return unicos;
  }

  /** V3.2 §35: áreas del recurso (la principal primero) y su imagen. */
  private async conAreasEImagen(lista: LearningResource[]): Promise<LearningResource[]> {
    if (lista.length === 0) return lista;
    const ids = lista.map((r) => r.id);
    const [areas, imagenes] = await Promise.all([
      this.resourceAreas.find({ where: { learningResourceId: In(ids) } }),
      this.learningResources.manager.query(
        `SELECT r.id, f.storage_key FROM learning_resources r JOIN stored_files f ON f.id = r.image_file_id WHERE r.id = ANY($1::uuid[])`,
        [ids],
      ),
    ]);
    const clave = new Map((imagenes as { id: string; storage_key: string }[]).map((i) => [i.id, i.storage_key]));
    return lista.map((r) => Object.assign(r, {
      areaIds: [r.academicAreaId, ...areas.filter((a) => a.learningResourceId === r.id && a.academicAreaId !== r.academicAreaId).map((a) => a.academicAreaId)],
      imageUrl: clave.has(r.id) ? `/api/files/${clave.get(r.id)}` : null,
    }));
  }

  async createLearningResource(
    dto: CreateLearningResourceDto,
    createdBy: string,
    user?: AuthenticatedUser,
  ): Promise<LearningResource> {
    const esDocente = user?.role === RolNombre.TEACHER;
    const semestres = await this.semestresDelRecurso(user, dto.semesterScope);
    await this.assertAreaExists(dto.academicAreaId);
    await this.assertSkillsExist(dto.skillIds);
    const areas = await this.areasDelRecurso(dto.academicAreaId, dto.areaIds);
    await this.assertResourceImage(dto.imageFileId, createdBy);

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
        imageFileId: dto.imageFileId ?? null,
        // V4.1 A41-014 (§7): la propuesta de un docente espera a Dirección.
        reviewStatus: esDocente ? 'pending' : 'not_required',
        semesterScope: semestres,
      }),
    );
    await this.replaceResourceSkills(recurso.id, dto.skillIds);
    await this.replaceResourceAreas(recurso.id, areas);
    if (esDocente) {
      await this.audit.record({
        actorUserId: createdBy,
        eventType: AuditEventType.RESOURCE_PROPOSED,
        entityType: 'learning_resource',
        entityId: recurso.id,
        metadata: { semesterScope: semestres },
      });
    }
    return this.findLearningResourceOrFail(recurso.id);
  }

  async updateLearningResource(
    id: string,
    dto: UpdateLearningResourceDto,
    user?: AuthenticatedUser,
  ): Promise<LearningResource> {
    const recurso = await this.learningResources.findOne({ where: { id } });
    if (!recurso) {
      throw new NotFoundException('Recurso no encontrado.');
    }
    // V4.1 A41-014: un docente edita solo su propuesta mientras está pendiente u
    // observada; corregir una observada la vuelve a enviar a Dirección.
    if (user && user.role === RolNombre.TEACHER) {
      if (recurso.createdBy !== user.userId) throw new NotFoundException('Recurso no encontrado.');
      if (recurso.reviewStatus !== 'pending' && recurso.reviewStatus !== 'observed') {
        throw new ConflictException('Ya fue revisado por Dirección: los ajustes los hace Dirección.');
      }
      if (dto.status !== undefined) throw new ForbiddenException('Retirar o reponer recursos lo decide Dirección.');
      recurso.reviewStatus = 'pending';
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
    if (dto.imageFileId !== undefined) {
      await this.assertResourceImage(dto.imageFileId, null);
      recurso.imageFileId = dto.imageFileId ?? null;
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
    if (dto.areaIds !== undefined || dto.academicAreaId !== undefined) {
      const actuales = dto.areaIds ?? (await this.resourceAreas.find({ where: { learningResourceId: id } })).map((x) => x.academicAreaId);
      await this.replaceResourceAreas(id, await this.areasDelRecurso(recurso.academicAreaId, actuales));
    }
    return this.findLearningResourceOrFail(id);
  }

  /** V3.2 §35: la principal primero, sin repetir; todas existen. */
  private async areasDelRecurso(principal: string, otras: string[] | undefined): Promise<string[]> {
    const ids = [...new Set([principal, ...(otras ?? [])].filter(Boolean))];
    for (const a of ids) await this.assertAreaExists(a);
    return ids;
  }

  private async replaceResourceAreas(learningResourceId: string, areaIds: string[]): Promise<void> {
    await this.resourceAreas.delete({ learningResourceId });
    if (areaIds.length) await this.resourceAreas.insert(areaIds.map((academicAreaId) => ({ learningResourceId, academicAreaId })));
  }

  /** V3.2 §35: la imagen de un recurso es un PNG, JPG o WEBP subido por quien lo carga. */
  private async assertResourceImage(imageFileId: string | null | undefined, uploader: string | null): Promise<void> {
    if (!imageFileId) return;
    const archivo = await this.learningResources.manager.getRepository(StoredFileRecord).findOne({ where: { id: imageFileId } });
    const valido = !!archivo && /^image\/(png|jpeg|webp)$/.test(archivo.mimeTypeDetected ?? '')
      && (uploader === null || archivo.uploadedByUserId === uploader);
    if (!valido) {
      throw new BadRequestException({
        message: 'La imagen tiene que ser un PNG, JPG o WEBP subido por ti.',
        fields: { imageFileId: ['La imagen tiene que ser un PNG, JPG o WEBP subido por ti.'] },
      });
    }
  }

  private async findLearningResourceOrFail(id: string): Promise<LearningResource> {
    const recurso = await this.learningResources.findOne({
      where: { id },
      relations: { academicArea: true, resourceSkills: { skill: true } },
    });
    if (!recurso) {
      throw new NotFoundException('Recurso no encontrado.');
    }
    return (await this.conAreasEImagen([recurso]))[0];
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
