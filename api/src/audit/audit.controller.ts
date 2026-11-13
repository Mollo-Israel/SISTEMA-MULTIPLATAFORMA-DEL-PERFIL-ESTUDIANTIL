import { Controller, Get, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiQuery, ApiTags } from '@nestjs/swagger';
import { RolNombre } from '@perfil/shared';
import { Roles } from '../auth/decorators/roles.decorator';
import { AuditService } from './audit.service';

/** Los filtros de la auditoría legible, tal como llegan en la URL. */
interface FiltrosDeAuditoria {
  modulo?: string;
  eventType?: string;
  actor?: string;
  desde?: string;
  hasta?: string;
  resultado?: string;
  limit?: string;
  offset?: string;
}

/**
 * Consulta de la bitacora. Solo el administrador: la auditoria contiene el
 * rastro de acciones de terceros y no es informacion de trabajo ordinaria.
 */
@ApiTags('audit')
@ApiBearerAuth()
@Controller('audit')
export class AuditController {
  constructor(private readonly audit: AuditService) {}

  @Get('log')
  @Roles(RolNombre.ADMIN)
  @ApiOperation({
    summary: 'Auditoría legible: actor, módulo, acción, fecha y resultado, con filtros y páginas (V3.2 §59).',
  })
  @ApiQuery({ name: 'modulo', required: false })
  @ApiQuery({ name: 'eventType', required: false })
  @ApiQuery({ name: 'actor', required: false })
  @ApiQuery({ name: 'desde', required: false })
  @ApiQuery({ name: 'hasta', required: false })
  @ApiQuery({ name: 'resultado', required: false })
  @ApiQuery({ name: 'limit', required: false })
  @ApiQuery({ name: 'offset', required: false })
  log(@Query() f: FiltrosDeAuditoria) {
    const { modulo, eventType, actor, desde, hasta, resultado, limit, offset } = f;
    return this.audit.listHuman({
      modulo, eventType, actor: actor?.slice(0, 80), desde, hasta, resultado,
      limit: limit ? Number(limit) : undefined, offset: offset ? Number(offset) : undefined,
    });
  }

  @Get('log/catalog')
  @Roles(RolNombre.ADMIN)
  @ApiOperation({ summary: 'Módulos, acciones y resultados para filtrar la auditoría.' })
  catalogo() {
    return this.audit.catalogoHumano();
  }

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
