import { Inject, Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, Repository } from 'typeorm';
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

    const [
      integrantes,
      evidencias,
      comentarios,
      repoCheck,
      demoCheck,
    ] = await Promise.all([
      // El responsable no es una señal adicional de sí mismo (§36).
      this.members.count({ where: { projectId, isOwner: false } }),
      this.evidences.count({ where: { projectId } }),
      this.feedback.count({ where: { projectId } }),
      this.repoChecks.findOne({ where: { projectId }, order: { checkedAt: 'DESC' } }),
      this.linkChecks.findOne({ where: { projectId }, order: { checkedAt: 'DESC' } }),
    ]);

    const razones: string[] = [];

    // ---------------------------------------------------- señales
    const repoAccesible = repoCheck?.status === LinkCheckStatus.AVAILABLE;
    const demoAccesible = demoCheck?.status === LinkCheckStatus.AVAILABLE;

    if (integrantes > 0) razones.push(`${integrantes} integrante(s) aceptado(s)`);
    if (evidencias > 0) razones.push(`${evidencias} evidencia(s) adjunta(s)`);
    if (repoAccesible) razones.push('Repositorio público accesible');
    if (demoAccesible) razones.push('Demo accesible');
    if (comentarios > 0) razones.push(`${comentarios} retroalimentación(es) docente(s)`);

    const senales = [integrantes > 0, evidencias > 0, repoAccesible, demoAccesible]
      .filter(Boolean).length;
    // §36: una corroboración técnica es algo que responde por sí mismo, no
    // algo que alguien escribió. Un integrante o una evidencia son fuentes
    // adicionales, pero no corroboran técnicamente nada.
    const corroboracionTecnica = repoAccesible || demoAccesible;

    let tier = ProjectBackingTier.DECLARED;
    if (senales >= 1) tier = ProjectBackingTier.SUPPORTED;
    if (senales >= 2 && corroboracionTecnica) tier = ProjectBackingTier.CORROBORATED;
    if (tier !== ProjectBackingTier.DECLARED && comentarios > 0) {
      tier = ProjectBackingTier.REVIEWED;
    }

    // ---------------------------------------------------- inconsistencias
    const problemas = this.detectarProblemas(project, repoCheck, demoCheck);
    if (problemas.length > 0) {
      tier = ProjectBackingTier.FLAGGED;
      razones.push(...problemas);
    }

    if (razones.length === 0) {
      razones.push('Solo información declarada por su autor.');
    }

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
    if (project.repositoryUrl && repoCheck?.metadata && !repoCheck.metadata.exists
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
