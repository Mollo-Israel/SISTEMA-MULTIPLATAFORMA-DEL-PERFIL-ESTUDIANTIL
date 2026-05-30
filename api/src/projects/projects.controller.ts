import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
} from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { RolNombre } from '@perfil/shared';
import { Roles } from '../auth/decorators/roles.decorator';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { AuthenticatedUser } from '../auth/types/authenticated-user';
import { ProjectsService } from './projects.service';
import { CreateProjectDto } from './dto/create-project.dto';
import { UpdateProjectDto } from './dto/update-project.dto';
import { AddMemberDto } from './dto/add-member.dto';
import { AddEvidenceDto } from './dto/add-evidence.dto';

@ApiTags('projects')
@ApiBearerAuth()
@Controller('projects')
export class ProjectsController {
  constructor(private readonly projectsService: ProjectsService) {}

  @Post()
  @Roles(RolNombre.STUDENT)
  create(@CurrentUser() user: AuthenticatedUser, @Body() dto: CreateProjectDto) {
    return this.projectsService.create(user.userId, dto);
  }

  @Get('my')
  @Roles(RolNombre.STUDENT)
  findMine(@CurrentUser() user: AuthenticatedUser) {
    return this.projectsService.findMine(user.userId);
  }

  @Get(':id')
  @Roles(RolNombre.STUDENT, RolNombre.TEACHER, RolNombre.CAREER_DIRECTOR, RolNombre.ADMIN)
  findOne(@CurrentUser() user: AuthenticatedUser, @Param('id', ParseUUIDPipe) id: string) {
    return this.projectsService.findOneForUser(user, id);
  }

  @Patch(':id')
  @Roles(RolNombre.STUDENT, RolNombre.ADMIN)
  update(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateProjectDto,
  ) {
    return this.projectsService.update(user, id, dto);
  }

  @Post(':id/members')
  @Roles(RolNombre.STUDENT, RolNombre.ADMIN)
  addMember(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: AddMemberDto,
  ) {
    return this.projectsService.addMember(user, id, dto);
  }

  @Post(':id/evidences')
  @Roles(RolNombre.STUDENT, RolNombre.ADMIN)
  addEvidence(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: AddEvidenceDto,
  ) {
    return this.projectsService.addEvidence(user, id, dto);
  }

  @Delete(':id/evidences/:evidenceId')
  @Roles(RolNombre.STUDENT, RolNombre.ADMIN)
  @HttpCode(204)
  removeEvidence(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Param('evidenceId', ParseUUIDPipe) evidenceId: string,
  ) {
    return this.projectsService.removeEvidence(user, id, evidenceId);
  }
}
