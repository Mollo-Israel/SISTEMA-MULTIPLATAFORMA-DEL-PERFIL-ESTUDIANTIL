import { Body, Controller, Get, HttpCode, Param, ParseUUIDPipe, Post, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { IsIn, IsString, IsUUID, MaxLength } from 'class-validator';
import { RolNombre } from '@perfil/shared';
import { Roles } from '../auth/decorators/roles.decorator';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { AuthenticatedUser } from '../auth/types/authenticated-user';
import { ApprovalPoliciesService } from './approval-policies.service';

class GrantPolicyDto {
  @IsUUID('4', { message: 'Docente no válido.' }) teacherUserId: string;
  @IsIn(['RESOURCE', 'GAMIFICATION', 'ACTIVITY'], { message: 'Módulo no válido.' }) module: string;
  @IsString() @MaxLength(500) justification: string;
}

class RevokePolicyDto {
  @IsString() @MaxLength(500) reason: string;
}

/** V5 §9.2: autonomía docente (excepciones de revisión por módulo). */
@ApiTags('approval-policies')
@ApiBearerAuth()
@Controller('approval-policies')
export class ApprovalPoliciesController {
  constructor(private readonly policies: ApprovalPoliciesService) {}

  @Get('me')
  @Roles(RolNombre.TEACHER)
  @ApiOperation({ summary: 'Qué publico u otorgo sin revisión (REQUIRE_REVIEW por defecto).' })
  mine(@CurrentUser() user: AuthenticatedUser) {
    return this.policies.mias(user);
  }

  @Get()
  @Roles(RolNombre.CAREER_DIRECTOR, RolNombre.ADMIN)
  @ApiOperation({ summary: 'Excepciones concedidas por Dirección.' })
  list(@CurrentUser() user: AuthenticatedUser, @Query('includeRevoked') includeRevoked?: string) {
    return this.policies.list(user, includeRevoked === 'true');
  }

  @Get('teachers')
  @Roles(RolNombre.CAREER_DIRECTOR, RolNombre.ADMIN)
  @ApiOperation({ summary: 'Docentes activos y sus semestres, para conceder una excepción.' })
  teachers(@CurrentUser() user: AuthenticatedUser) {
    return this.policies.docentes(user);
  }

  @Get('direct-actions')
  @Roles(RolNombre.CAREER_DIRECTOR, RolNombre.ADMIN)
  @ApiOperation({ summary: 'Historial de lo publicado u otorgado con una excepción.' })
  directActions(@CurrentUser() user: AuthenticatedUser, @Query('teacherUserId') teacherUserId?: string) {
    return this.policies.historialDirecto(user, teacherUserId && /^[0-9a-f-]{36}$/i.test(teacherUserId) ? teacherUserId : undefined);
  }

  @Post()
  @Roles(RolNombre.CAREER_DIRECTOR)
  @ApiOperation({ summary: 'Conceder a un docente publicar recursos u otorgar puntos sin revisión.' })
  grant(@CurrentUser() user: AuthenticatedUser, @Body() dto: GrantPolicyDto) {
    return this.policies.grant(user, dto);
  }

  @Post(':id/revoke')
  @HttpCode(200)
  @Roles(RolNombre.CAREER_DIRECTOR)
  @ApiOperation({ summary: 'Revocar una excepción: afecta lo que venga, no lo ya hecho.' })
  revoke(@CurrentUser() user: AuthenticatedUser, @Param('id', ParseUUIDPipe) id: string, @Body() dto: RevokePolicyDto) {
    return this.policies.revoke(user, id, dto.reason);
  }
}
