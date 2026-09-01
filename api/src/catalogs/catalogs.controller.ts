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

  @Post('skills')
  @Roles(RolNombre.ADMIN)
  createSkill(@Body() dto: CreateSkillDto) {
    return this.catalogsService.createSkill(dto);
  }

  @Patch('skills/:id')
  @Roles(RolNombre.ADMIN)
  @ApiOperation({ summary: 'Editar una habilidad o cambiar su estado.' })
  updateSkill(@Param('id', ParseUUIDPipe) id: string, @Body() dto: UpdateSkillDto) {
    return this.catalogsService.updateSkill(id, dto);
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
  @Roles(RolNombre.ADMIN)
  createCriterion(@Body() dto: CreateGamificationCriterionDto) {
    return this.catalogsService.createCriterion(dto);
  }

  @Patch('gamification-criteria/:id')
  @Roles(RolNombre.ADMIN)
  updateCriterion(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateGamificationCriterionDto,
  ) {
    return this.catalogsService.updateCriterion(id, dto);
  }
}
