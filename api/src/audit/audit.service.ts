import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { EntityManager, Repository } from 'typeorm';
import { AuditEvent } from '../entities/audit-event.entity';

/**
 * Verbos de auditoria (especificacion §70).
 *
 * Se declaran como constantes para que el conjunto sea finito y consultable:
 * una cadena escrita a mano en cada llamada acaba produciendo variantes que
 * nadie puede filtrar despues.
 */
export const AuditEventType = {
  // Identidad
  USER_PROVISIONED: 'USER_PROVISIONED',
  USER_ROLE_CHANGED: 'USER_ROLE_CHANGED',
  USER_STATUS_CHANGED: 'USER_STATUS_CHANGED',
  TEACHER_SCOPE_CHANGED: 'TEACHER_SCOPE_CHANGED',
  ACCOUNT_ACTIVATED: 'ACCOUNT_ACTIVATED',
  ACTIVATION_REQUESTED: 'ACTIVATION_REQUESTED',
  PASSWORD_RESET_REQUESTED: 'PASSWORD_RESET_REQUESTED',
  PASSWORD_CHANGED: 'PASSWORD_CHANGED',
  SESSION_REVOKED: 'SESSION_REVOKED',
  ALL_SESSIONS_REVOKED: 'ALL_SESSIONS_REVOKED',
  // Padron
  IMPORT_PREVIEWED: 'IMPORT_PREVIEWED',
  IMPORT_APPLIED: 'IMPORT_APPLIED',
  // Perfil y onboarding
  ONBOARDING_COMPLETED: 'ONBOARDING_COMPLETED',
  ONBOARDING_CONFIRMED: 'ONBOARDING_CONFIRMED',
  INSTITUTIONAL_DATA_CHANGED: 'INSTITUTIONAL_DATA_CHANGED',
  // Actividades
  ACTIVITY_CREATED: 'ACTIVITY_CREATED',
  ACTIVITY_STATUS_CHANGED: 'ACTIVITY_STATUS_CHANGED',
  /** V2 §27, §69: revisión de Dirección. */
  ACTIVITY_SUBMITTED: 'ACTIVITY_SUBMITTED',
  ACTIVITY_APPROVED: 'ACTIVITY_APPROVED',
  ACTIVITY_OBSERVED: 'ACTIVITY_OBSERVED',
  ACTIVITY_REJECTED: 'ACTIVITY_REJECTED',
  // Trayectoria
  ACTIVITY_REGISTERED: 'ACTIVITY_REGISTERED',
  PARTICIPATION_CONFIRMED: 'PARTICIPATION_CONFIRMED',
  // V3 §15–§17: oportunidades externas y credenciales
  EXTERNAL_OPPORTUNITY_ACCEPTED: 'EXTERNAL_OPPORTUNITY_ACCEPTED',
  EXTERNAL_EVIDENCE_ENABLED: 'EXTERNAL_EVIDENCE_ENABLED',
  EXTERNAL_CREDENTIAL_CREATED: 'EXTERNAL_CREDENTIAL_CREATED',
  EXTERNAL_CREDENTIAL_CHECKED: 'EXTERNAL_CREDENTIAL_CHECKED',
  EXTERNAL_CREDENTIAL_MANUAL_REVIEW_REQUESTED: 'EXTERNAL_CREDENTIAL_MANUAL_REVIEW_REQUESTED',
  EXTERNAL_CREDENTIAL_MANUAL_REVIEWED: 'EXTERNAL_CREDENTIAL_MANUAL_REVIEWED',
  VALIDATION_REFERENCE_UPDATED: 'VALIDATION_REFERENCE_UPDATED',
  CONSTANCY_ISSUED: 'CONSTANCY_ISSUED',
  EVIDENCE_UPLOADED: 'EVIDENCE_UPLOADED',
  FILE_UPLOADED: 'FILE_UPLOADED',
  VALIDATION_COMPLETED: 'VALIDATION_COMPLETED',
  EVIDENCE_DELETED: 'EVIDENCE_DELETED',
  FEEDBACK_ADDED: 'FEEDBACK_ADDED',
  VISIBILITY_CHANGED: 'VISIBILITY_CHANGED',
  // Configuracion
  CONFIG_CHANGED: 'CONFIG_CHANGED',
  /** V2 §23.3: el administrador guardó una habilidad fuera del área sugerida. */
  SKILL_CLASSIFICATION_OVERRIDE: 'SKILL_CLASSIFICATION_OVERRIDE',
  /** V2 §43, §69: asistente de IA (sin el contenido). */
  AI_SUGGESTION_CREATED: 'AI_SUGGESTION_CREATED',
  AI_SUGGESTION_ACCEPTED: 'AI_SUGGESTION_ACCEPTED',
  /** V2 §44: nombre de equipo rechazado o marcado. */
  TEAM_NAME_MODERATED: 'TEAM_NAME_MODERATED',
} as const;

export type AuditEventTypeValue = (typeof AuditEventType)[keyof typeof AuditEventType];

export interface AuditInput {
  actorUserId: string | null;
  eventType: AuditEventTypeValue;
  entityType: string;
  entityId?: string | null;
  metadata?: Record<string, unknown>;
}

/** Claves que nunca deben acabar en la bitacora (§70). */
const FORBIDDEN_KEYS = [
  'password',
  'passwordhash',
  'token',
  'tokenhash',
  'secret',
  'accesstoken',
  'refreshtoken',
  'authorization',
];

@Injectable()
export class AuditService {
  private readonly logger = new Logger(AuditService.name);

  constructor(
    @InjectRepository(AuditEvent)
    private readonly events: Repository<AuditEvent>,
  ) {}

  /**
   * Registra un evento.
   *
   * Nunca lanza: una bitacora rota no puede tumbar la operacion que intentaba
   * describir. Si falla, deja constancia en el log de aplicacion.
   *
   * `manager` permite escribir dentro de la transaccion de quien llama, para
   * que el evento y el hecho que describe se confirmen o se deshagan juntos.
   */
  async record(input: AuditInput, manager?: EntityManager): Promise<void> {
    try {
      const repo = manager ? manager.getRepository(AuditEvent) : this.events;
      await repo.save(
        repo.create({
          actorUserId: input.actorUserId,
          eventType: input.eventType,
          entityType: input.entityType,
          entityId: input.entityId ?? null,
          metadata: this.sanitize(input.metadata ?? {}),
        }),
      );
    } catch (error) {
      this.logger.error(
        `No se pudo registrar el evento ${input.eventType}: ${(error as Error).message}`,
      );
    }
  }

  /** Consulta de auditoria para el administrador. */
  async list(params: {
    entityType?: string;
    entityId?: string;
    actorUserId?: string;
    eventType?: string;
    limit?: number;
  }) {
    const qb = this.events
      .createQueryBuilder('e')
      .leftJoinAndSelect('e.actor', 'a')
      .orderBy('e.createdAt', 'DESC')
      .limit(Math.min(Math.max(params.limit ?? 100, 1), 500));

    if (params.entityType) qb.andWhere('e.entityType = :et', { et: params.entityType });
    if (params.entityId) qb.andWhere('e.entityId = :ei', { ei: params.entityId });
    if (params.actorUserId) qb.andWhere('e.actorUserId = :au', { au: params.actorUserId });
    if (params.eventType) qb.andWhere('e.eventType = :ev', { ev: params.eventType });

    const rows = await qb.getMany();
    return rows.map((e) => ({
      id: e.id,
      eventType: e.eventType,
      entityType: e.entityType,
      entityId: e.entityId,
      actor: e.actor ? `${e.actor.firstName} ${e.actor.lastName}` : null,
      actorUserId: e.actorUserId,
      metadata: e.metadata,
      createdAt: e.createdAt,
    }));
  }

  /**
   * Retira del metadata cualquier clave sensible y recorta los valores largos.
   * Es una red de seguridad: el llamante no deberia enviarlas, pero un
   * descuido no debe convertirse en un secreto persistido.
   */
  private sanitize(metadata: Record<string, unknown>): Record<string, unknown> {
    const safe: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(metadata)) {
      if (FORBIDDEN_KEYS.includes(key.toLowerCase().replace(/[_-]/g, ''))) continue;
      if (typeof value === 'string') {
        safe[key] = value.length > 300 ? `${value.slice(0, 300)}…` : value;
      } else if (
        value === null
        || typeof value === 'number'
        || typeof value === 'boolean'
        || Array.isArray(value)
      ) {
        safe[key] = value;
      } else if (typeof value === 'object') {
        safe[key] = this.sanitize(value as Record<string, unknown>);
      }
    }
    return safe;
  }
}
