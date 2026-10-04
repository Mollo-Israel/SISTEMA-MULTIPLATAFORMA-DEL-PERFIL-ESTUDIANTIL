import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Inject,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import {
  AI_TASK_LABEL,
  AiRunStatus,
  AiTaskType,
  CvAssistMode,
  ProjectBackingTier,
  RolNombre,
} from '@perfil/shared';
import { AiAssistanceRun } from '../entities/ai-assistance-run.entity';
import { AcademicArea } from '../entities/academic-area.entity';
import { AuthenticatedUser } from '../auth/types/authenticated-user';
import { AuditEventType, AuditService } from '../audit/audit.service';
import { ProjectsService } from '../projects/projects.service';
import { AnalyticsService } from '../reports/analytics.service';
import { classifySkill } from '../catalogs/skill-classification';
import { AI_ASSISTANCE_PORT, AiAssistancePort, AiUnavailableError } from './ai-assistance.port';
import { PROMPTS, VALIDATE, inputFingerprint, parseJsonLoose, sanitizeForAi } from './ai-text';
import { AiSuggestionDto } from './dto/ai-suggestion.dto';

/** Quién puede pedir cada tarea. La moderación es interna: nadie la pide. */
const TASK_ROLES: Record<AiTaskType, RolNombre[]> = {
  [AiTaskType.TAG_SUGGESTION]: [RolNombre.ADMIN, RolNombre.CAREER_DIRECTOR, RolNombre.TEACHER, RolNombre.SCIENTIFIC_SOCIETY],
  [AiTaskType.EVIDENCE_SUMMARY]: [RolNombre.STUDENT, RolNombre.TEACHER, RolNombre.ADMIN],
  [AiTaskType.INCONSISTENCY_EXPLANATION]: [RolNombre.STUDENT, RolNombre.TEACHER, RolNombre.ADMIN],
  [AiTaskType.CV_TEXT_ASSIST]: [RolNombre.STUDENT],
  [AiTaskType.ANALYTICS_NARRATIVE]: [RolNombre.CAREER_DIRECTOR],
  [AiTaskType.CONTENT_MODERATION_FLAG]: [],
};

export const AI_DISCLAIMER = 'Sugerencia generada por IA. Revísala antes de usarla: no cambia nada hasta que la guardes.';
const NO_DISPONIBLE = 'El asistente de IA no está configurado. Todo sigue funcionando sin él.';
const FALLO = 'El asistente de IA no respondió. Puedes continuar sin él.';

/** Respuesta común de una sugerencia. */
export interface AiSuggestion {
  available: boolean;
  ok: boolean;
  /** `ai`: la produjo el modelo; `rule`: la resolvió una regla sin llamar a la IA. */
  source?: 'ai' | 'rule';
  runId?: string;
  result?: Record<string, unknown>;
  message?: string;
  disclaimer?: string;
}

interface Pedido {
  task: AiTaskType;
  prompt: { system: string; user: string };
  input: string;
  validar: (raw: Record<string, unknown>) => Record<string, unknown> | null;
  targetType: string | null;
  targetId: string | null;
}

/**
 * Asistente de IA (V2 §43). Interpreta y sugiere; nunca escribe afinidad,
 * respaldo, aprobación, participación ni constancias (§43.3). Lo que devuelve
 * es una propuesta: la persona la acepta y la guarda por el camino normal, que
 * aplica sus propias reglas.
 */
@Injectable()
export class AiService {
  private readonly logger = new Logger(AiService.name);
  private readonly maxChars: number;

  constructor(
    @Inject(AI_ASSISTANCE_PORT) private readonly port: AiAssistancePort,
    @InjectRepository(AiAssistanceRun) private readonly runs: Repository<AiAssistanceRun>,
    @InjectRepository(AcademicArea) private readonly areas: Repository<AcademicArea>,
    private readonly projects: ProjectsService,
    private readonly analytics: AnalyticsService,
    private readonly audit: AuditService,
    config: ConfigService,
  ) {
    this.maxChars = Math.min(20000, Math.max(200, Number(config.get('AI_MAX_INPUT_CHARS') ?? 4000) || 4000));
  }

  status(user: AuthenticatedUser) {
    const enabled = this.port.isEnabled();
    return {
      enabled,
      provider: this.port.provider,
      model: enabled ? this.port.model : null,
      tasks: enabled
        ? (Object.keys(TASK_ROLES) as AiTaskType[])
            .filter((t) => TASK_ROLES[t].includes(user.role as RolNombre))
            .map((t) => ({ task: t, label: AI_TASK_LABEL[t] }))
        : [],
      disclaimer: AI_DISCLAIMER,
    };
  }

  async suggest(user: AuthenticatedUser, dto: AiSuggestionDto): Promise<AiSuggestion> {
    if (!TASK_ROLES[dto.task]?.includes(user.role as RolNombre)) {
      throw new ForbiddenException('Tu rol no puede usar esta ayuda de IA.');
    }
    // El acceso se comprueba siempre, haya IA o no: con la IA apagada, un
    // proyecto ajeno no puede responder «no disponible» en lugar de 403.
    if (dto.task === AiTaskType.EVIDENCE_SUMMARY || dto.task === AiTaskType.INCONSISTENCY_EXPLANATION) {
      await this.proyecto(user, dto);
    }
    // Las reglas van primero: lo que una regla resuelve no necesita IA, ni
    // siquiera cuando la IA está apagada.
    const porRegla = await this.resolverPorRegla(user, dto);
    if (porRegla) return porRegla;
    if (!this.port.isEnabled()) return { available: false, ok: false, message: NO_DISPONIBLE };
    const pedido = await this.armar(user, dto);
    return this.ejecutar(user, pedido);
  }

  /** §43.3: aceptar deja constancia de quién adoptó la sugerencia. No aplica nada. */
  async accept(user: AuthenticatedUser, runId: string) {
    const run = await this.runs.findOne({ where: { id: runId } });
    if (!run || run.requestedById !== user.userId) {
      throw new NotFoundException('Sugerencia no encontrada.');
    }
    if (run.status !== AiRunStatus.COMPLETED) {
      throw new ConflictException('Esa sugerencia no se completó.');
    }
    if (run.acceptedById) return this.vista(run);
    run.acceptedById = user.userId;
    run.acceptedAt = new Date();
    await this.runs.save(run);
    await this.audit.record({
      actorUserId: user.userId,
      eventType: AuditEventType.AI_SUGGESTION_ACCEPTED,
      entityType: 'ai_assistance_run',
      entityId: run.id,
      metadata: { tarea: run.taskType, objetivo: run.targetType },
    });
    return this.vista(run);
  }

  /** Soporte: metadatos de las últimas ejecuciones, sin el contenido. */
  async recent(limit = 50) {
    const filas = await this.runs.find({ order: { createdAt: 'DESC' }, take: Math.min(200, Math.max(1, limit)) });
    return filas.map((r) => ({
      id: r.id,
      provider: r.provider,
      model: r.model,
      task: r.taskType,
      status: r.status,
      latencyMs: r.latencyMs,
      error: r.errorMessage,
      targetType: r.targetType,
      accepted: !!r.acceptedById,
      createdAt: r.createdAt,
    }));
  }

  /**
   * Moderación de un nombre de equipo (§44), ya aprobado por las reglas.
   * Si la IA no está o falla, no bloquea: las reglas son la barrera.
   */
  async moderateTeamName(name: string, actorUserId: string, teamId: string | null) {
    if (!this.port.isEnabled()) return { checked: false, flagged: false, reason: null, suggestion: null };
    const input = sanitizeForAi(name, 120);
    const r = await this.ejecutar({ userId: actorUserId } as AuthenticatedUser, {
      task: AiTaskType.CONTENT_MODERATION_FLAG,
      prompt: PROMPTS.moderation(input),
      input,
      validar: VALIDATE.moderation,
      targetType: 'team',
      targetId: teamId,
    });
    if (!r.ok || !r.result) return { checked: false, flagged: false, reason: null, suggestion: null };
    const res = r.result as { flagged: boolean; reason: string | null; suggestion: string | null };
    return { checked: true, ...res };
  }

  // -------------------------------------------------------------------------

  private async resolverPorRegla(user: AuthenticatedUser, dto: AiSuggestionDto): Promise<AiSuggestion | null> {
    if (dto.task === AiTaskType.TAG_SUGGESTION && dto.target === 'skill') {
      if (user.role !== RolNombre.ADMIN) throw new ForbiddenException('El catálogo de habilidades es de la Administración.');
      const nombre = (dto.text ?? '').trim();
      if (!nombre) throw this.falta('text', 'Escribe el nombre de la habilidad.');
      const c = classifySkill(nombre, [], await this.areas.find());
      if (c.rule === 'canonical') {
        return {
          available: this.port.isEnabled(), ok: true, source: 'rule',
          result: { areaId: c.areaIds[0] ?? null, areaName: c.areaNames[0] ?? null, reason: c.reason },
        };
      }
    }
    if (dto.task === AiTaskType.INCONSISTENCY_EXPLANATION) {
      const p = await this.proyecto(user, dto);
      if (p.backingTier !== ProjectBackingTier.FLAGGED) {
        return {
          available: this.port.isEnabled(), ok: true, source: 'rule',
          result: { explanation: 'Las reglas de Afinia no registran inconsistencias en este proyecto.' },
        };
      }
    }
    return null;
  }

  private async armar(user: AuthenticatedUser, dto: AiSuggestionDto): Promise<Pedido> {
    const s = (t: string) => sanitizeForAi(t, this.maxChars);
    switch (dto.task) {
      case AiTaskType.TAG_SUGGESTION: {
        if (dto.target === 'skill') {
          const areas = (await this.areas.find({ where: { isActive: true } }));
          const input = s(dto.text ?? '');
          return {
            task: dto.task, input, targetType: 'skill', targetId: null,
            prompt: PROMPTS.skillArea(input, areas.map((a) => a.name)),
            // La IA solo puede proponer un área que exista: si inventa una, no hay sugerencia.
            validar: (raw) => {
              const area = areas.find((a) => typeof raw.area === 'string'
                && a.name.toLowerCase() === raw.area.trim().toLowerCase());
              return area ? { areaId: area.id, areaName: area.name, reason: VALIDATE.text(raw, 'reason', 280) } : null;
            },
          };
        }
        const input = s(dto.text ?? '');
        if (input.length < 10) throw this.falta('text', 'Escribe el título y la descripción para sugerir etiquetas.');
        return {
          task: dto.task, input, targetType: 'activity', targetId: null,
          prompt: PROMPTS.activityTags(input), validar: VALIDATE.tags,
        };
      }
      case AiTaskType.EVIDENCE_SUMMARY: {
        const p = await this.proyecto(user, dto);
        if (!p.evidences?.length) {
          throw new BadRequestException('El proyecto no tiene evidencias registradas para resumir.');
        }
        // Solo metadatos (§43.4): tipo, descripción, nombre de archivo y dominio del enlace.
        const lista = p.evidences.map((e) => {
          let host = '';
          try { host = e.externalUrl ? new URL(e.externalUrl).host : ''; } catch { host = ''; }
          return `- ${e.evidenceType}: ${e.description ?? 'sin descripción'}${e.fileName ? ` (archivo ${e.fileName})` : ''}${host ? ` (enlace en ${host})` : ''}`;
        }).join('\n');
        const input = s(`Proyecto: ${p.title}\n${lista}`);
        return {
          task: dto.task, input, targetType: 'project', targetId: p.id,
          prompt: PROMPTS.evidenceSummary(input),
          validar: (raw) => { const t = VALIDATE.text(raw, 'summary'); return t ? { summary: t } : null; },
        };
      }
      case AiTaskType.INCONSISTENCY_EXPLANATION: {
        const p = await this.proyecto(user, dto);
        const input = s(`Proyecto: ${p.title}\nObservaciones:\n${(p.backingReasons ?? []).map((r) => `- ${r}`).join('\n')}`);
        return {
          task: dto.task, input, targetType: 'project', targetId: p.id,
          prompt: PROMPTS.inconsistency(input),
          validar: (raw) => { const t = VALIDATE.text(raw, 'explanation'); return t ? { explanation: t } : null; },
        };
      }
      case AiTaskType.CV_TEXT_ASSIST: {
        const input = s(dto.text ?? '');
        if (input.length < 20) throw this.falta('text', 'Escribe al menos un par de oraciones para mejorar.');
        const modo = dto.mode ?? CvAssistMode.IMPROVE;
        return {
          task: dto.task, input, targetType: 'cv', targetId: null,
          prompt: PROMPTS.cv(input, modo),
          validar: (raw) => VALIDATE.cv(raw, input),
        };
      }
      case AiTaskType.ANALYTICS_NARRATIVE: {
        // Las cifras salen de consultas deterministas (§63); la IA solo las redacta.
        const t = await this.analytics.directorTrends();
        const lineas = (titulo: string, filas: unknown, campos: [string, string]) =>
          `${titulo}:\n${(Array.isArray(filas) ? filas : []).slice(0, 6)
            .map((f: Record<string, unknown>) => `- ${f[campos[0]]}: ${f[campos[1]]}`).join('\n')}`;
        const cifras = s([
          lineas('Tecnologías más usadas en proyectos', t.technologies, ['technology', 'projects']),
          lineas('Actividades con más participación', t.activities, ['activity', 'confirmed']),
        ].join('\n'));
        return {
          task: dto.task, input: cifras, targetType: 'analytics', targetId: null,
          prompt: PROMPTS.analytics(cifras),
          validar: (raw) => { const n = VALIDATE.narrative(raw, cifras); return n ? { narrative: n, figures: cifras } : null; },
        };
      }
      default:
        throw new BadRequestException('Esa tarea no se puede pedir directamente.');
    }
  }

  private async ejecutar(user: AuthenticatedUser, p: Pedido): Promise<AiSuggestion> {
    const inicio = Date.now();
    let result: Record<string, unknown> | null = null;
    let error: string | null = null;
    try {
      const texto = await this.port.complete({ ...p.prompt });
      const raw = parseJsonLoose(texto);
      result = raw ? p.validar(raw) : null;
      if (!result) error = 'La respuesta no tenía la forma esperada o traía datos que la fuente no tiene.';
    } catch (e) {
      error = e instanceof AiUnavailableError ? e.message : 'Error inesperado del asistente.';
      if (!(e instanceof AiUnavailableError)) this.logger.warn(`IA: ${(e as Error).message}`);
    }
    const run = await this.runs.save(this.runs.create({
      provider: this.port.provider,
      model: this.port.model,
      taskType: p.task,
      inputFingerprint: inputFingerprint(p.task, p.input),
      result,
      status: result ? AiRunStatus.COMPLETED : AiRunStatus.FAILED,
      errorMessage: error?.slice(0, 300) ?? null,
      latencyMs: Date.now() - inicio,
      targetType: p.targetType,
      targetId: p.targetId,
      requestedById: user.userId ?? null,
    }));
    await this.audit.record({
      actorUserId: user.userId ?? null,
      eventType: AuditEventType.AI_SUGGESTION_CREATED,
      entityType: 'ai_assistance_run',
      entityId: run.id,
      metadata: { tarea: p.task, estado: run.status, objetivo: p.targetType },
    });
    return result
      ? { available: true, ok: true, source: 'ai', runId: run.id, result, disclaimer: AI_DISCLAIMER }
      : { available: true, ok: false, runId: run.id, message: FALLO };
  }

  private async proyecto(user: AuthenticatedUser, dto: AiSuggestionDto) {
    if (!dto.projectId) throw this.falta('projectId', 'Indica el proyecto.');
    // El acceso es el mismo que para ver el proyecto: la IA no abre puertas.
    return this.projects.findOneForUser(user, dto.projectId);
  }

  private falta(campo: string, mensaje: string) {
    return new BadRequestException({ message: mensaje, fields: { [campo]: [mensaje] } });
  }

  private vista(run: AiAssistanceRun) {
    return {
      id: run.id, task: run.taskType, status: run.status,
      acceptedAt: run.acceptedAt, result: run.result,
    };
  }
}
