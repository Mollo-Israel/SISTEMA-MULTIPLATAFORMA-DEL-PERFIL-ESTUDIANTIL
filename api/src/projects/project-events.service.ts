import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ProjectEventType } from '@perfil/shared';
import { ProjectEvent } from '../entities/project-check.entity';
import { AuditEventType, AuditEventTypeValue, AuditService } from '../audit/audit.service';

/**
 * V3 §65: los hechos de un proyecto que además van a la auditoría. Se hace
 * aquí, en el único punto por donde pasan, para que ninguno se olvide.
 */
const A_AUDITORIA: Partial<Record<ProjectEventType, AuditEventTypeValue>> = {
  [ProjectEventType.PROJECT_CREATED]: AuditEventType.PROJECT_CREATED,
  [ProjectEventType.MEMBER_INVITED]: AuditEventType.MEMBER_INVITED,
  [ProjectEventType.MEMBER_ACCEPTED]: AuditEventType.MEMBER_ACCEPTED,
  [ProjectEventType.CONTRIBUTION_CONFIRMED]: AuditEventType.CONTRIBUTION_CONFIRMED,
  [ProjectEventType.EVIDENCE_ADDED]: AuditEventType.PROJECT_EVIDENCE_ADDED,
  [ProjectEventType.REPOSITORY_CHECKED]: AuditEventType.REPOSITORY_CHECKED,
  [ProjectEventType.DEMO_CHECKED]: AuditEventType.DEMO_CHECKED,
  [ProjectEventType.BACKING_TIER_CHANGED]: AuditEventType.PROJECT_BACKING_CHANGED,
  [ProjectEventType.FEEDBACK_ADDED]: AuditEventType.FEEDBACK_ADDED,
};

export interface ProjectEventInput {
  projectId: string;
  actorUserId: string | null;
  eventType: ProjectEventType;
  metadata?: Record<string, unknown>;
}

/** Claves que nunca deben acabar en la bitácora (§41). */
const PROHIBIDAS = ['password', 'token', 'secret', 'authorization', 'apikey', 'accesstoken'];

/**
 * Bitácora del proyecto (especificacion §41).
 *
 * «La auditoría funcional se realiza mediante eventos estructurados, no
 * analizando chats». Esto es esa bitácora: quién hizo qué y cuándo, en un
 * formato que se puede consultar y filtrar.
 *
 * Es distinta de `audit_events`, que registra decisiones administrativas sobre
 * personas y solo ve el administrador. Ésta cuenta la vida de un proyecto y la
 * ven sus integrantes: es su historia, no una vigilancia.
 */
@Injectable()
export class ProjectEventsService {
  private readonly logger = new Logger(ProjectEventsService.name);

  constructor(
    @InjectRepository(ProjectEvent) private readonly events: Repository<ProjectEvent>,
    private readonly audit: AuditService,
  ) {}

  /**
   * Registra un evento.
   *
   * Nunca lanza: una bitácora rota no puede tumbar la operación que intentaba
   * describir. Si falla, queda en el log de aplicación.
   */
  async record(input: ProjectEventInput): Promise<void> {
    try {
      await this.events.save(
        this.events.create({
          projectId: input.projectId,
          actorUserId: input.actorUserId,
          eventType: input.eventType,
          metadata: this.sanear(input.metadata ?? {}),
        }),
      );
    } catch (error) {
      this.logger.error(
        `No se pudo registrar ${input.eventType} del proyecto ${input.projectId}: ${String(error)}`,
      );
    }
    const auditable = A_AUDITORIA[input.eventType];
    if (auditable) {
      // `record` nunca lanza, y la metadata pasa por el mismo saneamiento.
      await this.audit.record({
        actorUserId: input.actorUserId,
        eventType: auditable,
        entityType: 'project',
        entityId: input.projectId,
        metadata: this.sanear(input.metadata ?? {}),
      });
    }
  }

  /** Bitácora de un proyecto, del evento más reciente al más antiguo. */
  async list(projectId: string, limit = 100) {
    const rows = await this.events.find({
      where: { projectId },
      relations: { actor: true },
      order: { createdAt: 'DESC' },
      take: Math.min(Math.max(limit, 1), 300),
    });
    return rows.map((e) => ({
      id: e.id,
      eventType: e.eventType,
      actor: e.actor ? `${e.actor.firstName} ${e.actor.lastName}` : null,
      actorUserId: e.actorUserId,
      metadata: e.metadata,
      createdAt: e.createdAt,
    }));
  }

  /**
   * Retira claves sensibles y recorta valores largos (§41).
   *
   * Red de seguridad: quien llama no debería enviarlas, pero un descuido no
   * puede convertirse en un secreto persistido.
   */
  private sanear(metadata: Record<string, unknown>): Record<string, unknown> {
    const salida: Record<string, unknown> = {};
    for (const [clave, valor] of Object.entries(metadata)) {
      if (PROHIBIDAS.includes(clave.toLowerCase().replace(/[_-]/g, ''))) continue;
      if (typeof valor === 'string') {
        salida[clave] = valor.length > 200 ? `${valor.slice(0, 200)}…` : valor;
      } else if (
        valor === null
        || typeof valor === 'number'
        || typeof valor === 'boolean'
        || Array.isArray(valor)
      ) {
        salida[clave] = valor;
      } else if (typeof valor === 'object') {
        salida[clave] = this.sanear(valor as Record<string, unknown>);
      }
    }
    return salida;
  }
}
