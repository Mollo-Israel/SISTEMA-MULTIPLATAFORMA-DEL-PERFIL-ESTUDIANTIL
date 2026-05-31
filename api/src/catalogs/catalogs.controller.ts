import { Body, Controller, Get, Post } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { RolNombre } from '@perfil/shared';
import { Roles } from '../auth/decorators/roles.decorator';
import { CatalogsService } from './catalogs.service';
import { CreateAcademicAreaDto } from './dto/create-academic-area.dto';
import { CreateSkillDto } from './dto/create-skill.dto';

@ApiTags('catalogs')
@ApiBearerAuth()
@Controller()
export class CatalogsController {
  constructor(private readonly catalogsService: CatalogsService) {}

  @Get('academic-areas')
  findAreas() {
    return this.catalogsService.findAreas();
  }

  @Post('academic-areas')
  @Roles(RolNombre.ADMIN)
  createArea(@Body() dto: CreateAcademicAreaDto) {
    return this.catalogsService.createArea(dto);
  }

  @Get('skills')
  findSkills() {
    return this.catalogsService.findSkills();
  }

  @Post('skills')
  @Roles(RolNombre.ADMIN)
  createSkill(@Body() dto: CreateSkillDto) {
    return this.catalogsService.createSkill(dto);
  }
}
