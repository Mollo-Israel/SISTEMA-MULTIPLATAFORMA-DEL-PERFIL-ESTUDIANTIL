import { Controller, Get, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { RolNombre } from '@perfil/shared';
import { Roles } from '../auth/decorators/roles.decorator';
import { AuditService } from './audit.service';

/**
 * Consulta de la bitacora. Solo el administrador: la auditoria contiene el
 * rastro de acciones de terceros y no es informacion de trabajo ordinaria.
 */
@ApiTags('audit')
@ApiBearerAuth()
@Controller('audit')
export class AuditController {
  constructor(private readonly audit: AuditService) {}

  @Get('events')
  @Roles(RolNombre.ADMIN)
  @ApiOperation({ summary: 'Eventos de auditoría, filtrables por entidad, actor o tipo.' })
  list(
    @Query('entityType') entityType?: string,
    @Query('entityId') entityId?: string,
    @Query('actorUserId') actorUserId?: string,
    @Query('eventType') eventType?: string,
    @Query('limit') limit?: string,
  ) {
    return this.audit.list({
      entityType,
      entityId,
      actorUserId,
      eventType,
      limit: limit ? Number(limit) : undefined,
    });
  }
}
