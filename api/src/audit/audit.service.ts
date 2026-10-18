import { Injectable, Logger } from '@nestjs/common';
import {
  AUDIT_ENTITY_LABEL, AUDIT_EVENT_LABEL, AUDIT_MODULE_LABEL, AUDIT_RESULT_LABEL, auditDetail, eventTypesOf, eventTypesWithResult,
} from './audit-labels';
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
  ACTIVITY_SUBMISSION_CANCELLED: 'ACTIVITY_SUBMISSION_CANCELLED',
  // Perfil y onboarding
  ONBOARDING_COMPLETED: 'ONBOARDING_COMPLETED',
  ONBOARDING_CONFIRMED: 'ONBOARDING_CONFIRMED',
  INSTITUTIONAL_DATA_CHANGED: 'INSTITUTIONAL_DATA_CHANGED',
  // Actividades
  ACTIVITY_CREATED: 'ACTIVITY_CREATED',
  ACTIVITY_DUPLICATED: 'ACTIVITY_DUPLICATED',
  ACTIVITY_STATUS_CHANGED: 'ACTIVITY_STATUS_CHANGED',
  /** V2 §27, §69: revisión de Dirección. */
  ACTIVITY_SUBMITTED: 'ACTIVITY_SUBMITTED',
  ACTIVITY_APPROVED: 'ACTIVITY_APPROVED',
  ACTIVITY_OBSERVED: 'ACTIVITY_OBSERVED',
  ACTIVITY_REJECTED: 'ACTIVITY_REJECTED',
  // Trayectoria
  ACTIVITY_REGISTERED: 'ACTIVITY_REGISTERED',
  PARTICIPATION_CONFIRMED: 'PARTICIPATION_CONFIRMED',
  PARTICIPATION_CORRECTED: 'PARTICIPATION_CORRECTED',
  ATTENDANCE_CLOSED: 'ATTENDANCE_CLOSED',
  // V3 §15–§17: oportunidades externas y credenciales
  EXTERNAL_OPPORTUNITY_ACCEPTED: 'EXTERNAL_OPPORTUNITY_ACCEPTED',
  EXTERNAL_EVIDENCE_ENABLED: 'EXTERNAL_EVIDENCE_ENABLED',
  EXTERNAL_CREDENTIAL_CREATED: 'EXTERNAL_CREDENTIAL_CREATED',
  EXTERNAL_CREDENTIAL_CHECKED: 'EXTERNAL_CREDENTIAL_CHECKED',
  // V3 §22: proyecto que pasa a ACTIVE cumpliendo los requisitos.
  PROJECT_ACTIVATED: 'PROJECT_ACTIVATED',
  // V3 §34.1: «No me interesa».
  RECOMMENDATION_DISMISSED: 'RECOMMENDATION_DISMISSED',
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
  RESOURCE_PROPOSED: 'RESOURCE_PROPOSED',
  GAMIFICATION_PROPOSED: 'GAMIFICATION_PROPOSED',
  GAMIFICATION_PROPOSAL_REVIEWED: 'GAMIFICATION_PROPOSAL_REVIEWED',
  GAMIFICATION_SCOPE_VIEWED: 'GAMIFICATION_SCOPE_VIEWED',
  SKILL_REQUESTED: 'SKILL_REQUESTED',
  SKILL_REQUEST_DECIDED: 'SKILL_REQUEST_DECIDED',
  PROJECT_BACKING_RECALCULATED: 'PROJECT_BACKING_RECALCULATED',
  RESOURCE_REVIEWED: 'RESOURCE_REVIEWED',
  /** V2 §23.3: el administrador guardó una habilidad fuera del área sugerida. */
  SKILL_CLASSIFICATION_OVERRIDE: 'SKILL_CLASSIFICATION_OVERRIDE',
  /** V2 §43, §69: asistente de IA (sin el contenido). */
  AI_SUGGESTION_CREATED: 'AI_SUGGESTION_CREATED',
  AI_SUGGESTION_ACCEPTED: 'AI_SUGGESTION_ACCEPTED',
  /** V2 §44: nombre de equipo rechazado o marcado. */
  TEAM_NAME_MODERATED: 'TEAM_NAME_MODERATED',
  // V3 §65: eventos mínimos que faltaban.
  PROJECT_CREATED: 'PROJECT_CREATED',
  MEMBER_INVITED: 'MEMBER_INVITED',
  MEMBER_ACCEPTED: 'MEMBER_ACCEPTED',
  CONTRIBUTION_CONFIRMED: 'CONTRIBUTION_CONFIRMED',
  PROJECT_EVIDENCE_ADDED: 'PROJECT_EVIDENCE_ADDED',
  REPOSITORY_CHECKED: 'REPOSITORY_CHECKED',
  DEMO_CHECKED: 'DEMO_CHECKED',
  PROJECT_BACKING_CHANGED: 'PROJECT_BACKING_CHANGED',
  AFFINITY_RECALCULATED: 'AFFINITY_RECALCULATED',
  CONTACT_ACCEPTED: 'CONTACT_ACCEPTED',
  TEAM_APPLICATION_CREATED: 'TEAM_APPLICATION_CREATED',
  TEAM_MEMBER_ACCEPTED: 'TEAM_MEMBER_ACCEPTED',
  CURRICULUM_EXPORTED: 'CURRICULUM_EXPORTED',
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
   * V3.2 §59 (C13): la auditoría para una persona. Actor, módulo, acción,
   * fecha y resultado, con filtros que funcionan y de a 10 (§6.1). El código
   * del evento sigue en la respuesta, pero no es lo que se muestra primero.
   */
  async listHuman(params: {
    modulo?: string;
    eventType?: string;
    actor?: string;
    desde?: string;
    hasta?: string;
    resultado?: string;
    limit?: number;
    offset?: number;
  }) {
    const limit = Math.min(Math.max(params.limit ?? 10, 1), 100);
    const offset = Math.max(params.offset ?? 0, 0);
    const qb = this.events.createQueryBuilder('e').leftJoinAndSelect('e.actor', 'a').leftJoinAndSelect('a.role', 'r');
    const tipos = params.eventType ? [params.eventType] : params.modulo ? eventTypesOf(params.modulo) : null;
    if (tipos) qb.andWhere('e.eventType IN (:...tipos)', { tipos: tipos.length ? tipos : ['-'] });
    if (params.resultado) {
      const conResultado = eventTypesWithResult(params.resultado);
      qb.andWhere('e.eventType IN (:...res)', { res: conResultado.length ? conResultado : ['-'] });
    }
    const texto = params.actor?.trim();
    if (texto) {
      if (/^sistema$/i.test(texto)) qb.andWhere('e.actorUserId IS NULL');
      else qb.andWhere("(a.firstName ILIKE :t OR a.lastName ILIKE :t OR a.email ILIKE :t OR CONCAT(a.firstName, ' ', a.lastName) ILIKE :t)", { t: `%${texto}%` });
    }
    const fecha = (v?: string) => (v && /^\d{4}-\d{2}-\d{2}$/.test(v) ? v : null);
    if (fecha(params.desde)) qb.andWhere(`e.createdAt >= ((:desde::date)::timestamp AT TIME ZONE 'America/La_Paz')`, { desde: params.desde });
    if (fecha(params.hasta)) qb.andWhere(`e.createdAt < ((:hasta::date + 1)::timestamp AT TIME ZONE 'America/La_Paz')`, { hasta: params.hasta });
    const total = await qb.getCount();
    const rows = await qb.orderBy('e.createdAt', 'DESC').skip(offset).take(limit).getMany();
    return {
      total,
      limit,
      offset,
      items: rows.map((e) => {
        const etiqueta = AUDIT_EVENT_LABEL[e.eventType];
        const resultado = etiqueta?.resultado ?? 'correcto';
        return {
          id: e.id,
          fecha: e.createdAt,
          actor: e.actor ? `${e.actor.firstName} ${e.actor.lastName}` : 'Sistema',
          actorRol: e.actor?.role?.name ?? null,
          modulo: etiqueta ? AUDIT_MODULE_LABEL[etiqueta.modulo] : 'Otros',
          accion: etiqueta?.accion ?? e.eventType,
          resultado: AUDIT_RESULT_LABEL[resultado],
          resultadoCodigo: resultado,
          sobre: e.entityType ? (AUDIT_ENTITY_LABEL[e.entityType] ?? e.entityType) : null,
          detalle: auditDetail(e.metadata),
          eventType: e.eventType,
          entityId: e.entityId,
        };
      }),
    };
  }

  /** Módulos y acciones disponibles para los filtros de la pantalla. */
  catalogoHumano() {
    return {
      modulos: Object.entries(AUDIT_MODULE_LABEL).map(([value, label]) => ({ value, label })),
      acciones: Object.entries(AUDIT_EVENT_LABEL).map(([value, v]) => ({ value, label: v.accion, modulo: v.modulo })),
      resultados: Object.entries(AUDIT_RESULT_LABEL).map(([value, label]) => ({ value, label })),
    };
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
