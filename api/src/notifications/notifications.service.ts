import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { IsNull, Repository } from 'typeorm';
import { Notification } from '../entities/notification.entity';
import { NotificationEmitter, NotificationEvent } from './notification.port';

/**
 * Implementación persistente del punto de emisión (V3 §33.1).
 *
 * `INSERT … ON CONFLICT DO NOTHING` sobre (destinatario, dedupe_key): la
 * misma alerta no se repite aunque el evento se emita varias veces, y dos
 * emisiones simultáneas no pueden duplicarla.
 */
@Injectable()
export class PersistentNotificationEmitter implements NotificationEmitter {
  private readonly logger = new Logger('Notificaciones');

  constructor(@InjectRepository(Notification) private readonly repo: Repository<Notification>) {}

  async emit(e: NotificationEvent): Promise<void> {
    try {
      await this.repo
        .createQueryBuilder()
        .insert()
        .into(Notification)
        .values({
          recipientUserId: e.userId,
          type: e.kind.slice(0, 60),
          entityType: e.entityType ?? null,
          entityId: e.entityId ?? null,
          title: e.title.slice(0, 160),
          body: e.body.slice(0, 500),
          link: e.link ? e.link.slice(0, 300) : null,
          dedupeKey: e.dedupeKey.slice(0, 200),
        })
        .orIgnore()
        .execute();
    } catch (error) {
      // Nunca deshace la operación que la originó.
      this.logger.warn(`No se pudo guardar la notificación ${e.kind}: ${String(error)}`);
    }
  }
}

export interface NotificationView {
  id: string;
  type: string;
  title: string;
  body: string;
  link: string | null;
  entityType: string | null;
  entityId: string | null;
  createdAt: Date;
  readAt: Date | null;
}

/** Bandeja del usuario: solo las suyas (§33). */
@Injectable()
export class NotificationsService {
  constructor(@InjectRepository(Notification) private readonly repo: Repository<Notification>) {}

  async list(userId: string, opts: { unread?: boolean; limit?: number }): Promise<NotificationView[]> {
    const filas = await this.repo.find({
      where: { recipientUserId: userId, ...(opts.unread ? { readAt: IsNull() } : {}) },
      order: { createdAt: 'DESC' },
      take: Math.min(Math.max(opts.limit ?? 30, 1), 100),
    });
    // Mostrarlas cuenta como entregadas.
    const sinEntregar = filas.filter((f) => !f.deliveredAt).map((f) => f.id);
    if (sinEntregar.length) {
      await this.repo.createQueryBuilder().update(Notification).set({ deliveredAt: () => 'now()' })
        .whereInIds(sinEntregar).execute();
    }
    return filas.map((f) => this.view(f));
  }

  async unreadCount(userId: string): Promise<{ unread: number }> {
    return { unread: await this.repo.count({ where: { recipientUserId: userId, readAt: IsNull() } }) };
  }

  async markRead(userId: string, id: string): Promise<NotificationView> {
    const n = await this.repo.findOne({ where: { id, recipientUserId: userId } });
    // De otra persona: 404, sin revelar que existe.
    if (!n) throw new NotFoundException('Notificación no encontrada.');
    if (!n.readAt) {
      n.readAt = new Date();
      await this.repo.save(n);
    }
    return this.view(n);
  }

  async markAllRead(userId: string): Promise<{ marked: number }> {
    const r = await this.repo.createQueryBuilder().update(Notification).set({ readAt: () => 'now()' })
      .where('recipient_user_id = :u AND read_at IS NULL', { u: userId }).execute();
    return { marked: r.affected ?? 0 };
  }

  private view(n: Notification): NotificationView {
    return {
      id: n.id, type: n.type, title: n.title, body: n.body, link: n.link,
      entityType: n.entityType, entityId: n.entityId, createdAt: n.createdAt, readAt: n.readAt,
    };
  }
}
