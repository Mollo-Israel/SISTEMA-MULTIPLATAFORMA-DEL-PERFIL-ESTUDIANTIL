import { Inject, Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, IsNull, Not, Repository } from 'typeorm';
import {
  LinkCheckStatus,
  ProjectBackingTier,
  ProjectEventType,
  ProjectInvitationStatus,
} from '@perfil/shared';
import { Project } from '../entities/project.entity';
import { ProjectMember } from '../entities/project-member.entity';
import { ProjectEvidence } from '../entities/project-evidence.entity';
import { ProjectFeedback } from '../entities/project-feedback.entity';
import {
  ProjectLinkCheck,
  ProjectRepositoryCheck,
} from '../entities/project-check.entity';
import { ProjectEventsService } from './project-events.service';
import {
  TRAJECTORY_RECALCULATION,
  TrajectoryRecalculationPort,
} from '../trajectory/trajectory-recalculation.port';
import { StudentProfile } from '../entities/student-profile.entity';
import { ProjectSkill } from '../entities/project-area.entity';
import { TECHNICAL_EVIDENCE, decideProjectBacking } from './project-backing.rules';

/** Repositorio normalizado: host + dueño/nombre en minúsculas, sin `.git`, rama ni barra final. */
export function normalizarRepo(url: string | null | undefined): string | null {
  if (!url) return null;
  try {
    const u = new URL(url.trim());
    const partes = u.pathname.split('/').filter(Boolean);
    if (partes.length < 2) return null;
    return `https://${u.hostname.toLowerCase().replace(/^www\./, '')}/${partes[0].toLowerCase()}/${partes[1].toLowerCase().replace(/\.git$/, '')}`;
  } catch {
    return null;
  }
}

/**
 * Nivel de respaldo de un proyecto (especificacion §36).
 *
 * Se **deriva**, nunca se fija a mano. Un proyecto no es más creíble porque
 * alguien marque una casilla: lo es porque existen señales que cualquiera
 * puede comprobar.
 *
 * La escala no mide calidad académica. Un proyecto excelente de una sola
 * persona, sin repositorio público, se queda en `DECLARED`, y eso no dice nada
 * malo de él: dice que el sistema no pudo corroborar nada por su cuenta.
 */
@Injectable()
export class ProjectBackingService {
  private readonly logger = new Logger(ProjectBackingService.name);

  constructor(
    @InjectRepository(Project) private readonly projects: Repository<Project>,
    @InjectRepository(ProjectMember) private readonly members: Repository<ProjectMember>,
    @InjectRepository(ProjectEvidence) private readonly evidences: Repository<ProjectEvidence>,
    @InjectRepository(ProjectFeedback) private readonly feedback: Repository<ProjectFeedback>,
    @InjectRepository(ProjectRepositoryCheck)
    private readonly repoChecks: Repository<ProjectRepositoryCheck>,
    @InjectRepository(ProjectLinkCheck)
    private readonly linkChecks: Repository<ProjectLinkCheck>,
    @InjectRepository(StudentProfile)
    private readonly profiles: Repository<StudentProfile>,
    @InjectRepository(ProjectSkill)
    private readonly projectSkills: Repository<ProjectSkill>,
    private readonly events: ProjectEventsService,
    @Inject(TRAJECTORY_RECALCULATION)
    private readonly trajectory: TrajectoryRecalculationPort,
  ) {}

  /**
   * Recalcula el nivel y lo persiste si cambió.
   *
   * Las reglas de §36, en orden:
   *
   *   DECLARED     — solo información declarada.
   *   SUPPORTED    — al menos una fuente adicional: integrante aceptado,
   *                  evidencia, repositorio accesible o demo accesible.
   *   CORROBORATED — dos señales independientes **y** una corroboración
   *                  técnica relevante (repositorio o demo que responden).
   *   REVIEWED     — al menos SUPPORTED y con retroalimentación docente.
   *   FLAGGED      — hay una inconsistencia grave. Convive con lo anterior y
   *                  manda sobre todo, porque es una advertencia, no un
   *                  escalón.
   */
  async recalculate(projectId: string, actorUserId: string | null = null): Promise<Project | null> {
    const project = await this.projects.findOne({ where: { id: projectId } });
    if (!project) return null;
    const { tier, razones, senales } = await this.computar(project);

    const anterior = project.backingTier;
    if (anterior === tier && this.mismasRazones(project.backingReasons, razones)) {
      return project;
    }

    project.backingTier = tier;
    project.backingReasons = razones;
    await this.projects.save(project);

    if (anterior !== tier) {
      await this.events.record({
        projectId,
        actorUserId,
        eventType: ProjectEventType.BACKING_TIER_CHANGED,
        metadata: { de: anterior, a: tier, senales },
      });
      await this.recalcularAfinidades(project);
    }
    return project;
  }

  /**
   * V4.1 A41-021 (§12): recálculo de todos los proyectos con informe antes /
   * después. Sin `apply` solo informa (no guarda nada).
   */
  async recalculateAll(apply: boolean, actorUserId: string | null) {
    const todos = await this.projects.find({ order: { createdAt: 'ASC' } });
    const cambios: { id: string; title: string; de: ProjectBackingTier; a: ProjectBackingTier }[] = [];
    const antes: Record<string, number> = {};
    const despues: Record<string, number> = {};
    for (const p of todos) {
      const { tier } = await this.computar(p);
      antes[p.backingTier] = (antes[p.backingTier] ?? 0) + 1;
      despues[tier] = (despues[tier] ?? 0) + 1;
      if (tier !== p.backingTier) cambios.push({ id: p.id, title: p.title, de: p.backingTier, a: tier });
    }
    if (apply) {
      for (const c of cambios) await this.recalculate(c.id, actorUserId);
    }
    const transiciones: Record<string, number> = {};
    for (const c of cambios) transiciones[`${c.de}→${c.a}`] = (transiciones[`${c.de}→${c.a}`] ?? 0) + 1;
    return { applied: apply, total: todos.length, changed: cambios.length, before: antes, after: despues, transitions: transiciones, changes: cambios.slice(0, 500) };
  }

  /** V4.1 §11.5: ¿el mismo repositorio figura en un proyecto de otra persona, ajeno a este? */
  private async atribucionDisputada(project: Project): Promise<boolean> {
    const clave = normalizarRepo(project.repositoryUrl);
    if (!clave) return false;
    const otros = (await this.projects
      .createQueryBuilder('p')
      .where('p.id <> :id', { id: project.id })
      .andWhere('p.created_by_profile_id <> :owner', { owner: project.createdByProfileId })
      .andWhere('lower(p.repository_url) LIKE :pref', { pref: `${clave}%` })
      .getMany()).filter((p) => normalizarRepo(p.repositoryUrl) === clave);
    if (!otros.length) return false;
    // No es ajeno si el dueño de este proyecto integra aquel, o al revés.
    const perfilDueno = await this.profiles.findOne({ where: { id: project.createdByProfileId } });
    for (const o of otros) {
      const duenoOtro = await this.profiles.findOne({ where: { id: o.createdByProfileId } });
      const yoEnSuyo = perfilDueno && await this.members.exist({ where: { projectId: o.id, userId: perfilDueno.userId } });
      const elEnMio = duenoOtro && await this.members.exist({ where: { projectId: project.id, userId: duenoOtro.userId } });
      if (!yoEnSuyo && !elEnMio) return true;
    }
    return false;
  }

  /** Nivel, razones y señales, sin guardar. */
  private async computar(project: Project) {
    const projectId = project.id;

    const [
      confirmados,
      evidencias,
      comentarios,
      repoCheck,
      demoCheck,
      tecnicas,
    ] = await Promise.all([
      this.members.count({ where: { projectId, isOwner: false, contributionConfirmedAt: Not(IsNull()) } }),
      this.evidences.count({ where: { projectId } }),
      this.feedback.count({ where: { projectId } }),
      this.repoChecks.findOne({ where: { projectId }, order: { checkedAt: 'DESC' } }),
      this.linkChecks.findOne({ where: { projectId }, order: { checkedAt: 'DESC' } }),
      this.projectSkills.find({ where: { projectId, evidenceStatus: In([...TECHNICAL_EVIDENCE]) }, relations: { skill: true } }),
    ]);

    const razones: string[] = [];

    // V3 §28: solo vale la comprobación del repositorio que el proyecto
    // declara hoy, no la de una URL anterior.
    const repoAccesible = repoCheck?.status === LinkCheckStatus.AVAILABLE
      && repoCheck.repositoryUrl === project.repositoryUrl;
    const demoAccesible = demoCheck?.status === LinkCheckStatus.AVAILABLE && demoCheck.url === project.demoUrl;

    if (repoAccesible) razones.push('Repositorio público accesible');
    else razones.push('Sin repositorio público comprobado: no hay respaldo técnico suficiente (§28).');
    if (tecnicas.length > 0) {
      razones.push(`Tecnologías respaldadas por el repositorio: ${tecnicas.map((t) => t.skill?.name).filter(Boolean).join(', ')}`);
    }
    if (demoAccesible) razones.push('Demo accesible');
    if (confirmados > 0) razones.push(`${confirmados} integrante(s) con su contribución confirmada`);
    if (evidencias > 0) razones.push(`${evidencias} evidencia(s) de contexto`);
    if (comentarios > 0) razones.push(`${comentarios} retroalimentación(es) docente(s)`);

    const problemas = this.detectarProblemas(project, repoCheck, demoCheck);
    const disputada = repoAccesible && await this.atribucionDisputada(project);
    if (disputada) {
      razones.push('El mismo repositorio figura en el proyecto de otra persona: sus señales no se le atribuyen automáticamente (§11.5).');
    }
    if (evidencias > 0 && tecnicas.length > 0 && !demoAccesible && confirmados === 0) {
      razones.push('Las capturas apoyan, pero no son una fuente independiente: para corroborar falta una demo accesible u otra persona que confirme su contribución (§12).');
    }
    const tier = decideProjectBacking({
      repositoryAccessible: repoAccesible,
      technicalCorroborations: tecnicas.length,
      demoAccessible: demoAccesible,
      confirmedMembers: confirmados,
      evidenceCount: evidencias,
      feedbackCount: comentarios,
      problems: problemas,
      attributionContested: disputada,
    });
    if (problemas.length > 0) razones.push(...problemas);
    const senales = { tecnicas: tecnicas.length, demo: demoAccesible, confirmados, evidencias, disputada };
    return { tier, razones, senales };
  }

  /**
   * Recalcula la afinidad de quienes obtienen experiencia de este proyecto
   * (§57).
   *
   * §51.3 puntua el proyecto **segun su nivel de respaldo**, asi que cambiar
   * el nivel cambia la afinidad de todo el equipo, no solo la de quien provoco
   * el cambio. Antes esto no se hacia: un docente dejaba retroalimentacion, el
   * proyecto subia a REVIEWED y los puntajes seguian reflejando el nivel
   * anterior hasta que alguien tocara otra cosa por casualidad.
   *
   * §57 tambien exige recalcular «al propietario correcto de la señal»: los
   * integrantes cuentan solo si confirmaron su contribucion (§33), asi que un
   * recalculo para quien no la confirmo no cambiaria nada, pero tampoco hace
   * daño y evita depender de ese detalle desde aqui.
   */
  private async recalcularAfinidades(project: Project): Promise<void> {
    const integrantes = await this.members.find({ where: { projectId: project.id } });
    const perfiles = integrantes.length
      ? await this.profiles.find({ where: { userId: In(integrantes.map((m) => m.userId)) } })
      : [];

    const destinatarios = new Set<string>([project.createdByProfileId]);
    perfiles.forEach((p) => destinatarios.add(p.id));

    for (const perfilId of destinatarios) {
      try {
        await this.trajectory.requestRecalculation(perfilId);
      } catch (e) {
        // El nivel de respaldo ya quedo guardado. Un fallo al recalcular no
        // puede deshacerlo ni impedir la respuesta: se registra y el proximo
        // recalculo del perfil lo pone al dia.
        this.logger.warn(`No se pudo recalcular la afinidad de ${perfilId}: ${String(e)}`);
      }
    }
  }

  /**
   * Inconsistencias graves que justifican `FLAGGED` (§36).
   *
   * El proyecto **no se elimina**: se marca. Un enlace caído puede ser un
   * servidor apagado un fin de semana, no un intento de engañar a nadie, y
   * borrar el trabajo de alguien por eso sería desproporcionado.
   */
  private detectarProblemas(
    project: Project,
    repoCheck: ProjectRepositoryCheck | null,
    demoCheck: ProjectLinkCheck | null,
  ): string[] {
    const problemas: string[] = [];

    if (repoCheck?.status === LinkCheckStatus.BLOCKED) {
      problemas.push('El repositorio apunta a una dirección que el sistema no consulta.');
    }
    if (demoCheck?.status === LinkCheckStatus.BLOCKED) {
      problemas.push('La demo apunta a una dirección que el sistema no consulta.');
    }
    if (project.repositoryUrl && repoCheck?.repositoryUrl === project.repositoryUrl
      && repoCheck?.metadata && !repoCheck.metadata.exists
      && repoCheck.status === LinkCheckStatus.UNAVAILABLE) {
      problemas.push('El repositorio declarado no existe o dejó de ser público.');
    }
    return problemas;
  }

  private mismasRazones(a: string[] | null, b: string[]): boolean {
    if (!a || a.length !== b.length) return false;
    return a.every((x, i) => x === b[i]);
  }
}
