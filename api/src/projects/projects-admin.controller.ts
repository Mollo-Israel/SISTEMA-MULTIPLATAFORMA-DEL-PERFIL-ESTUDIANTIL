import { Body, Controller, Get, HttpCode, Param, ParseUUIDPipe, Post, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { ArrayMaxSize, IsArray, IsBoolean, IsIn, IsOptional, IsString, IsUUID, MaxLength, MinLength, ValidateNested } from 'class-validator';
import { RolNombre } from '@perfil/shared';
import { Roles } from '../auth/decorators/roles.decorator';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { AuthenticatedUser } from '../auth/types/authenticated-user';
import { AuditEventType, AuditService } from '../audit/audit.service';
import { ProjectsService } from './projects.service';
import { ProjectBackingService } from './project-backing.service';

/** V5-25: la tecnología nueva que se crea a partir de un pedido. */
class NewSkillFromRequestDto {
  @IsOptional() @IsString() @MinLength(1) @MaxLength(80) name?: string;
  @IsUUID('4', { message: 'Elige el área principal.' }) academicAreaId: string;
  @IsOptional() @IsArray() @ArrayMaxSize(10) @IsUUID('4', { each: true }) secondaryAreaIds?: string[];
  @IsOptional() @IsString() @MaxLength(300) overrideReason?: string;
}

class DecideSkillRequestDto {
  /**
   * V5-25: `alias` (otro nombre de una tecnología existente), `new_skill`
   * (tecnología distinta, con su área) o `rejected`. `added` se acepta por
   * compatibilidad y equivale al alias de antes.
   */
  @IsIn(['alias', 'new_skill', 'added', 'rejected'], { message: 'La decisión es alias, tecnología nueva o rechazo.' })
  decision: 'alias' | 'new_skill' | 'added' | 'rejected';
  @IsOptional() @IsUUID('4') skillId?: string;
  /** Confirmación explícita de que el nombre detectado es la MISMA tecnología. */
  @IsOptional() @IsBoolean() sameTechnology?: boolean;
  @IsOptional() @ValidateNested() @Type(() => NewSkillFromRequestDto) newSkill?: NewSkillFromRequestDto;
  @IsOptional() @IsString() @MaxLength(300) note?: string;
}

class RecalculateBackingDto {
  @IsOptional() @IsBoolean() apply?: boolean;
}

/**
 * V4.1 A41-020 / A41-021: lo que decide Administración sobre el catálogo
 * (pedidos de tecnologías no catalogadas) y el recálculo auditado del
 * respaldo de proyectos, con informe antes / después.
 */
@ApiTags('projects')
@ApiBearerAuth()
@Controller()
export class ProjectsAdminController {
  constructor(
    private readonly projects: ProjectsService,
    private readonly backing: ProjectBackingService,
    private readonly audit: AuditService,
  ) {}

  @Get('skill-requests')
  @Roles(RolNombre.ADMIN)
  @ApiOperation({ summary: 'Pedidos de tecnologías no catalogadas (V4.1 §11.4).' })
  list(@Query('status') status?: string) {
    return this.projects.listSkillRequests(status);
  }

  @Post('skill-requests/:id/decision')
  @Roles(RolNombre.ADMIN)
  @HttpCode(200)
  @ApiOperation({ summary: 'Resolver un pedido: alias de una tecnología existente, tecnología nueva con su área, o rechazo con motivo (V5-25).' })
  decide(@CurrentUser() user: AuthenticatedUser, @Param('id', ParseUUIDPipe) id: string, @Body() dto: DecideSkillRequestDto) {
    return this.projects.decideSkillRequest(user, id, dto);
  }

  @Post('project-backing/recalculate')
  @Roles(RolNombre.ADMIN)
  @HttpCode(200)
  @ApiOperation({ summary: 'Recalcula el respaldo de todos los proyectos. Sin `apply`, solo informa antes / después.' })
  async recalculate(@CurrentUser() user: AuthenticatedUser, @Body() dto: RecalculateBackingDto) {
    const r = await this.backing.recalculateAll(dto.apply === true, user.userId);
    await this.audit.record({
      actorUserId: user.userId,
      eventType: AuditEventType.PROJECT_BACKING_RECALCULATED,
      entityType: 'project',
      entityId: null,
      metadata: { applied: r.applied, total: r.total, changed: r.changed, before: r.before, after: r.after, transitions: r.transitions },
    });
    return r;
  }
}
