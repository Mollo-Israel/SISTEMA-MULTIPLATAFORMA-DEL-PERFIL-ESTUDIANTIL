import { Body, Controller, Get, Param, ParseUUIDPipe, Post, Query } from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { RolNombre } from '@perfil/shared';
import { Roles } from '../auth/decorators/roles.decorator';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { AuthenticatedUser } from '../auth/types/authenticated-user';
import { AiService } from './ai.service';
import { AiSuggestionDto } from './dto/ai-suggestion.dto';

/** Una llamada al modelo cuesta: tope por persona y minuto. */
const AI_RATE_LIMIT = { limit: Number(process.env.AI_RATE_LIMIT_PER_MINUTE ?? 20) || 20, ttl: 60_000 };

@ApiTags('ai')
@ApiBearerAuth()
@Controller('ai')
export class AiController {
  constructor(private readonly ai: AiService) {}

  @Get('status')
  @ApiOperation({ summary: 'Si hay asistente de IA y qué tareas puede pedir el usuario (V2 §43)' })
  status(@CurrentUser() user: AuthenticatedUser) {
    return this.ai.status(user);
  }

  @Post('suggestions')
  @Throttle({ default: AI_RATE_LIMIT })
  @ApiOperation({ summary: 'Pide una sugerencia. No cambia nada hasta que la persona la guarde.' })
  suggest(@CurrentUser() user: AuthenticatedUser, @Body() dto: AiSuggestionDto) {
    return this.ai.suggest(user, dto);
  }

  @Post('runs/:id/accept')
  @ApiOperation({ summary: 'Registra que la persona adoptó la sugerencia (§43.3)' })
  accept(@CurrentUser() user: AuthenticatedUser, @Param('id', ParseUUIDPipe) id: string) {
    return this.ai.accept(user, id);
  }

  @Get('runs')
  @Roles(RolNombre.ADMIN)
  @ApiOperation({ summary: 'Últimas ejecuciones, sin su contenido (soporte)' })
  recent(@Query('limit') limit?: string) {
    return this.ai.recent(Number(limit) || 50);
  }
}
