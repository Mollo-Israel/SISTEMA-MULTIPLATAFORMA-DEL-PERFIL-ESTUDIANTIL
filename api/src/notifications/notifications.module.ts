import { Global, Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Notification } from '../entities/notification.entity';
import { ActivityRegistration } from '../entities/activity-registration.entity';
import { StudentProfile } from '../entities/student-profile.entity';
import { NOTIFICATION_EMITTER } from './notification.port';
import { NotificationsService, PersistentNotificationEmitter } from './notifications.service';
import { ActivityRemindersService } from './activity-reminders.service';
import { NotificationsController } from './notifications.controller';

/**
 * Centro de notificaciones (V3 §33). Global: cualquier servicio de negocio
 * inyecta NOTIFICATION_EMITTER sin importar este módulo.
 */
@Global()
@Module({
  imports: [TypeOrmModule.forFeature([Notification, ActivityRegistration, StudentProfile])],
  controllers: [NotificationsController],
  providers: [
    NotificationsService,
    ActivityRemindersService,
    { provide: NOTIFICATION_EMITTER, useClass: PersistentNotificationEmitter },
  ],
  exports: [NOTIFICATION_EMITTER, NotificationsService],
})
export class NotificationsModule {}
