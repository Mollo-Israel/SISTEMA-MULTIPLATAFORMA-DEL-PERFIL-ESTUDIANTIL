import { Inject, Injectable, Logger, OnApplicationBootstrap, OnApplicationShutdown } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ActivityStatus, RegistrationStatus } from '@perfil/shared';
import { ActivityRegistration } from '../entities/activity-registration.entity';
import { NOTIFICATION_EMITTER, NotificationEmitter } from './notification.port';

const HORA = 3_600_000;

/**
 * Recordatorios de actividades con frecuencia controlada (V3 §33.1).
 *
 *   inscrito o aceptado → un aviso el día antes y otro unas horas antes;
 *   interesado          → un solo aviso, el día antes, para que se inscriba.
 *
 * Cada aviso tiene su clave de deduplicación: correr esto cada media hora
 * no repite nada. Se agenda con `setTimeout` encadenado, como el resto de
 * tareas del sistema, para que una vuelta lenta no se solape con la siguiente.
 */
@Injectable()
export class ActivityRemindersService implements OnApplicationBootstrap, OnApplicationShutdown {
  private readonly logger = new Logger('Recordatorios');
  private readonly enabled: boolean;
  private readonly intervalMs: number;
  private timer: NodeJS.Timeout | null = null;
  private detenido = false;

  constructor(
    config: ConfigService,
    @InjectRepository(ActivityRegistration) private readonly registrations: Repository<ActivityRegistration>,
    @Inject(NOTIFICATION_EMITTER) private readonly notifications: NotificationEmitter,
  ) {
    this.enabled = config.get<string>('NOTIFICATION_REMINDERS_ENABLED', 'true') !== 'false';
    const min = Number(config.get<string>('NOTIFICATION_REMINDERS_INTERVAL_MINUTES'));
    this.intervalMs = (Number.isFinite(min) && min > 0 ? min : 30) * 60_000;
  }

  onApplicationBootstrap(): void {
    if (!this.enabled) return;
    const vuelta = async () => {
      if (this.detenido) return;
      try {
        await this.run();
      } catch (e) {
        this.logger.warn(`Vuelta de recordatorios fallida: ${String(e)}`);
      }
      if (!this.detenido) this.timer = setTimeout(vuelta, this.intervalMs);
    };
    this.timer = setTimeout(vuelta, 60_000);
  }

  onApplicationShutdown(): void {
    this.detenido = true;
    if (this.timer) clearTimeout(this.timer);
  }

  /** Una vuelta: devuelve cuántos avisos intentó emitir. */
  async run(ahora = new Date()): Promise<{ emitidos: number }> {
    const filas = await this.registrations
      .createQueryBuilder('r')
      .innerJoinAndSelect('r.activity', 'a')
      .innerJoinAndSelect('r.studentProfile', 'p')
      .where('r.status IN (:...estados)', {
        estados: [RegistrationStatus.REGISTERED, RegistrationStatus.ACCEPTED, RegistrationStatus.INTERESTED],
      })
      .andWhere('a.status IN (:...abiertas)', {
        abiertas: [ActivityStatus.PUBLISHED, ActivityStatus.OPEN, ActivityStatus.CLOSED],
      })
      .andWhere('a.event_date > :ahora AND a.event_date <= :limite', {
        ahora, limite: new Date(ahora.getTime() + 24 * HORA),
      })
      .getMany();

    let emitidos = 0;
    for (const r of filas) {
      const a = r.activity;
      const faltan = (a.eventDate!.getTime() - ahora.getTime()) / HORA;
      const cuando = a.eventDate!.toLocaleString('es-BO', { dateStyle: 'medium', timeStyle: 'short' });
      const base = { userId: r.studentProfile.userId, entityType: 'activity', entityId: a.id, link: '/student/activities' };
      if (r.status === RegistrationStatus.INTERESTED) {
        await this.notifications.emit({
          ...base,
          kind: 'ACTIVITY_INTEREST_REMINDER',
          title: 'Una actividad que te interesa es mañana',
          body: `«${a.title}» es el ${cuando}. Si quieres participar, solicita tu inscripción.`,
          dedupeKey: `activity-interest:${r.id}`,
        });
        emitidos += 1;
        continue;
      }
      await this.notifications.emit({
        ...base,
        kind: 'ACTIVITY_STARTING',
        title: 'Tu actividad es mañana',
        body: `«${a.title}» es el ${cuando}.`,
        dedupeKey: `activity-starting-24h:${r.id}`,
      });
      emitidos += 1;
      if (faltan <= 3) {
        await this.notifications.emit({
          ...base,
          kind: 'ACTIVITY_STARTING',
          title: 'Tu actividad empieza en unas horas',
          body: `«${a.title}» empieza ${a.location ? `en ${a.location} ` : ''}a las ${a.eventDate!.toLocaleTimeString('es-BO', { timeStyle: 'short' })}.`,
          dedupeKey: `activity-starting-3h:${r.id}`,
        });
        emitidos += 1;
      }
    }
    return { emitidos };
  }
}
