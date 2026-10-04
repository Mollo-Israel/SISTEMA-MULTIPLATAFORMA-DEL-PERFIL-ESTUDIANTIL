import { Body, Controller, Get, Param, ParseUUIDPipe, Patch, Post, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { RolNombre } from '@perfil/shared';
import { Roles } from '../auth/decorators/roles.decorator';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { AuthenticatedUser } from '../auth/types/authenticated-user';
import { CatalogsService } from './catalogs.service';
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

@ApiTags('catalogs')
@ApiBearerAuth()
@Controller()
export class CatalogsController {
  constructor(private readonly catalogsService: CatalogsService) {}

  // ---------------- Categorias de actividad (RF4) ----------------

  @Get('activity-categories')
  @ApiOperation({
    summary: 'Categorías de actividad vigentes. El administrador ve también las dadas de baja.',
  })
  findActivityCategories(@CurrentUser() user: AuthenticatedUser) {
    return this.catalogsService.findActivityCategories(user.role === RolNombre.ADMIN);
  }

  @Post('activity-categories')
  @Roles(RolNombre.ADMIN)
  @ApiOperation({ summary: 'Registrar una categoría de actividad.' })
  createActivityCategory(@Body() dto: CreateActivityCategoryDto) {
    return this.catalogsService.createActivityCategory(dto);
  }

  @Patch('activity-categories/:id')
  @Roles(RolNombre.ADMIN)
  @ApiOperation({ summary: 'Editar una categoría de actividad o cambiar su estado.' })
  updateActivityCategory(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateActivityCategoryDto,
  ) {
    return this.catalogsService.updateActivityCategory(id, dto);
  }

  @Get('activity-categories/:id/usage')
  @Roles(RolNombre.ADMIN)
  @ApiOperation({ summary: 'Cuántas actividades usan la categoría.' })
  async activityCategoryUsage(@Param('id', ParseUUIDPipe) id: string) {
    return { activities: await this.catalogsService.countActivitiesByCategory(id) };
  }

  // ---------------- Areas academicas ----------------

  @Get('academic-areas')
  @ApiOperation({ summary: 'Áreas académicas vigentes. El administrador ve también las inactivas.' })
  findAreas(@CurrentUser() user: AuthenticatedUser) {
    return this.catalogsService.findAreas(user.role === RolNombre.ADMIN);
  }

  @Post('academic-areas')
  @ApiOperation({ summary: 'Crea un área académica (nombre único normalizado).' })
  @Roles(RolNombre.ADMIN)
  createArea(@Body() dto: CreateAcademicAreaDto) {
    return this.catalogsService.createArea(dto);
  }

  @Patch('academic-areas/:id')
  @Roles(RolNombre.ADMIN)
  @ApiOperation({ summary: 'Editar un área académica o cambiar su estado.' })
  updateArea(@Param('id', ParseUUIDPipe) id: string, @Body() dto: UpdateAcademicAreaDto) {
    return this.catalogsService.updateArea(id, dto);
  }

  // ---------------- Habilidades ----------------

  @Get('skills')
  @ApiOperation({ summary: 'Habilidades vigentes. El administrador ve también las inactivas.' })
  findSkills(@CurrentUser() user: AuthenticatedUser) {
    return this.catalogsService.findSkills(user.role === RolNombre.ADMIN);
  }

  @Get('skills/classify')
  @Roles(RolNombre.ADMIN)
  @ApiOperation({
    summary: 'Área sugerida para una tecnología (V2 §23.3).',
    description: 'Regla canónica, sugerencia por etiquetas o ninguna. No guarda nada.',
  })
  classifySkill(@Query('name') name = '', @Query('aliases') aliases = '') {
    return this.catalogsService.classify(
      String(name).slice(0, 120),
      String(aliases).split(',').map((a) => a.trim()).filter(Boolean).slice(0, 10),
    );
  }

  @Post('skills')
  @ApiOperation({ summary: 'Crea una habilidad con alias; valida el área por reglas canónicas (V2 §23.3).' })
  @Roles(RolNombre.ADMIN)
  createSkill(@Body() dto: CreateSkillDto, @CurrentUser() user: AuthenticatedUser) {
    return this.catalogsService.createSkill(dto, user.userId);
  }

  @Patch('skills/:id')
  @Roles(RolNombre.ADMIN)
  @ApiOperation({ summary: 'Editar una habilidad o cambiar su estado.' })
  updateSkill(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateSkillDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.catalogsService.updateSkill(id, dto, user.userId);
  }

  // ---------------- Catalogo de recursos y cursos externos (§61) ----------------

  /**
   * §61 pide un catalogo **controlado**: nada de URLs recogidas
   * automaticamente de Internet. Por eso escribir aqui es cosa de la direccion
   * de carrera, y el estudiante solo lee lo vigente.
   */
  @Get('learning-resources')
  @ApiOperation({
    summary: 'Recursos y cursos externos del catálogo controlado (§61).',
    description:
      'El estudiante ve los vigentes. La dirección puede pedir también los retirados, '
      + 'que se conservan históricamente aunque ya no se recomienden.',
  })
  findLearningResources(
    @CurrentUser() user: AuthenticatedUser,
    @Query('includeInactive') includeInactive?: string,
    @Query('academicAreaId') academicAreaId?: string,
  ) {
    const administra =
      user.role === RolNombre.ADMIN || user.role === RolNombre.CAREER_DIRECTOR;
    return this.catalogsService.findLearningResources({
      includeInactive: administra && includeInactive === 'true',
      academicAreaId,
    });
  }

  @Post('learning-resources')
  @Roles(RolNombre.CAREER_DIRECTOR, RolNombre.ADMIN)
  @ApiOperation({ summary: 'Incorporar un recurso al catálogo controlado (§61).' })
  createLearningResource(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: CreateLearningResourceDto,
  ) {
    return this.catalogsService.createLearningResource(dto, user.userId);
  }

  @Patch('learning-resources/:id')
  @Roles(RolNombre.CAREER_DIRECTOR, RolNombre.ADMIN)
  @ApiOperation({
    summary: 'Editar un recurso o retirarlo del catálogo.',
    description:
      'No hay borrado: retirar es pasar el estado a «inactive». §61 exige conservarlo '
      + 'históricamente, porque una recomendación anterior debe poder explicar a qué apuntaba.',
  })
  updateLearningResource(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateLearningResourceDto,
  ) {
    return this.catalogsService.updateLearningResource(id, dto);
  }

  // ---------------- Criterios de gamificacion ----------------

  @Get('gamification-criteria')
  @Roles(RolNombre.ADMIN)
  @ApiOperation({
    summary:
      'Criterios de gamificación administrados. Ningún módulo los consume todavía: el motor pertenece a una fase posterior.',
  })
  findCriteria(@Query('includeInactive') includeInactive?: string) {
    return this.catalogsService.findCriteria(includeInactive !== 'false');
  }

  @Post('gamification-criteria')
  @ApiOperation({ summary: 'Crea un criterio global de puntos.' })
  @Roles(RolNombre.ADMIN)
  createCriterion(@Body() dto: CreateGamificationCriterionDto) {
    return this.catalogsService.createCriterion(dto);
  }

  @Patch('gamification-criteria/:id')
  @ApiOperation({ summary: 'Actualiza un criterio global de puntos.' })
  @Roles(RolNombre.ADMIN)
  updateCriterion(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateGamificationCriterionDto,
  ) {
    return this.catalogsService.updateCriterion(id, dto);
  }
}
