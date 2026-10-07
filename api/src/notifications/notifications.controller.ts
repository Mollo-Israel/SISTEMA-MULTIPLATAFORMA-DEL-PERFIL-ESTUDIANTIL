import { Controller, Get, HttpCode, Param, ParseUUIDPipe, Patch, Post, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { RolNombre } from '@perfil/shared';
import { Roles } from '../auth/decorators/roles.decorator';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { AuthenticatedUser } from '../auth/types/authenticated-user';
import { NotificationsService } from './notifications.service';
import { ActivityRemindersService } from './activity-reminders.service';

const TODOS = [RolNombre.STUDENT, RolNombre.TEACHER, RolNombre.CAREER_DIRECTOR, RolNombre.SCIENTIFIC_SOCIETY, RolNombre.ADMIN];

@ApiTags('notifications')
@ApiBearerAuth()
@Controller('notifications')
export class NotificationsController {
  constructor(
    private readonly service: NotificationsService,
    private readonly reminders: ActivityRemindersService,
  ) {}

  @Get('me')
  @Roles(...TODOS)
  @ApiOperation({ summary: 'Mis notificaciones, de la más reciente a la más antigua (V3 §33).' })
  mine(@CurrentUser() user: AuthenticatedUser, @Query('unread') unread?: string, @Query('limit') limit?: string) {
    return this.service.list(user.userId, { unread: unread === 'true', limit: Number(limit) || undefined });
  }

  @Get('me/unread-count')
  @Roles(...TODOS)
  @ApiOperation({ summary: 'Cuántas me faltan por leer.' })
  unread(@CurrentUser() user: AuthenticatedUser) {
    return this.service.unreadCount(user.userId);
  }

  @Patch(':id/read')
  @Roles(...TODOS)
  @ApiOperation({ summary: 'Marca una notificación propia como leída.' })
  read(@CurrentUser() user: AuthenticatedUser, @Param('id', ParseUUIDPipe) id: string) {
    return this.service.markRead(user.userId, id);
  }

  @Post('me/read-all')
  @Roles(...TODOS)
  @HttpCode(200)
  @ApiOperation({ summary: 'Marca todas como leídas.' })
  readAll(@CurrentUser() user: AuthenticatedUser) {
    return this.service.markAllRead(user.userId);
  }

  @Post('admin/run-reminders')
  @Roles(RolNombre.ADMIN)
  @HttpCode(200)
  @ApiOperation({
    summary: 'Fuerza una vuelta de recordatorios de actividades (V3 §33.1).',
    description: 'Corre sola cada media hora; esto existe para diagnóstico y pruebas.',
  })
  runReminders() {
    return this.reminders.run();
  }
}
