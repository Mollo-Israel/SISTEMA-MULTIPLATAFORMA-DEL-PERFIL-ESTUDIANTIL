import { Global, Injectable, Logger, Module } from '@nestjs/common';
import { NOTIFICATION_EMITTER, NotificationEmitter, NotificationEvent } from './notification.port';

/**
 * Implementación provisional: registra el evento y no hace nada más.
 *
 * Se mantiene la deduplicación en memoria para que, mientras tanto, el
 * registro no se llene con el mismo hecho repetido.
 */
@Injectable()
export class LoggingNotificationEmitter implements NotificationEmitter {
  private readonly logger = new Logger('Notificaciones');
  private readonly vistas = new Set<string>();

  async emit(event: NotificationEvent): Promise<void> {
    if (this.vistas.has(event.dedupeKey)) return;
    this.vistas.add(event.dedupeKey);
    if (this.vistas.size > 5000) this.vistas.clear();
    this.logger.log(`${event.kind} → ${event.userId}: ${event.title}`);
  }
}

@Global()
@Module({
  providers: [{ provide: NOTIFICATION_EMITTER, useClass: LoggingNotificationEmitter }],
  exports: [NOTIFICATION_EMITTER],
})
export class NotificationsModule {}
