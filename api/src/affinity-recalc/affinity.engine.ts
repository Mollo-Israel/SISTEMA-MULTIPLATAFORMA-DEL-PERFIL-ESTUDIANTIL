import { createHash } from 'crypto';
import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, In, Repository } from 'typeorm';
import {
  AffinityCalculationStatus,
  AffinityLevel,
  AffinityMatchType,
  AffinitySignalType,
  AffinityWeightCode,
  RegistrationStatus,
} from '@perfil/shared';
import { StudentProfile } from '../entities/student-profile.entity';
import { StudentInterest } from '../entities/student-interest.entity';
import { StudentSkill } from '../entities/student-skill.entity';
import { AcademicArea } from '../entities/academic-area.entity';
import { ActivityRegistration } from '../entities/activity-registration.entity';
import { Project } from '../entities/project.entity';
import { ProjectMember } from '../entities/project-member.entity';
import { ProjectEvidence } from '../entities/project-evidence.entity';
import { ExternalCertificate } from '../entities/external-certificate.entity';
import { InternalConstancy } from '../entities/internal-constancy.entity';
import { AffinityResult } from '../entities/affinity-result.entity';
import { AffinityWeight } from '../entities/affinity-weight.entity';
import { AffinityContribution } from '../entities/affinity-contribution.entity';
import { AffinitySnapshot } from '../entities/affinity-snapshot.entity';
import { AffinitySnapshotItem } from '../entities/affinity-snapshot-item.entity';
import { AffinityRecalculationPort } from './affinity-recalculation.port';

interface AreaInfo {
  id: string;
  /** Nombre normalizado en minusculas, para las coincidencias de texto. */
  name: string;
  /** Nombre tal cual se muestra al estudiante. */
  displayName: string;
  tags: string[];
}

/**
 * Una senal ya resuelta: que sumo, a que area y por que.
 *
 * El motor primero produce la lista completa de contribuciones y solo despues
 * agrega los puntajes. Ese orden importa: el desglose que ve el estudiante y el
 * numero que ve son la misma cuenta, no dos calculos que podrian discrepar.
 */
interface Contribution {
  areaId: string;
  signalType: AffinitySignalType;
  weightCode: AffinityWeightCode;
  matchType: AffinityMatchType;
  points: number;
  sourceLabel: string;
  sourceId: string | null;
}

/**
 * Ponderaciones de respaldo, identicas a las que siembra la migracion.
 *
 * El motor lee los pesos de `affinity_weights`. Estas constantes solo actuan si
 * una fila falta: es preferible calcular con el valor conocido que devolver una
 * afinidad silenciosamente incompleta.
 */
const DEFAULT_WEIGHTS: Record<AffinityWeightCode, number> = {
  [AffinityWeightCode.INTEREST]: 2,
  [AffinityWeightCode.IMPROVEMENT_AREA]: 1,
  [AffinityWeightCode.SKILL_BASIC]: 1,
  [AffinityWeightCode.SKILL_INTERMEDIATE]: 2,
  [AffinityWeightCode.SKILL_ADVANCED]: 3,
  [AffinityWeightCode.ACTIVITY_INTERESTED]: 1,
  [AffinityWeightCode.ACTIVITY_REGISTERED]: 2,
  [AffinityWeightCode.ACTIVITY_CONFIRMED]: 3,
  [AffinityWeightCode.PROJECT_OWNED]: 5,
  [AffinityWeightCode.PROJECT_MEMBER]: 5,
  [AffinityWeightCode.EVIDENCE]: 2,
  [AffinityWeightCode.CERTIFICATE]: 4,
  [AffinityWeightCode.CONSTANCY]: 3,
};

/** Familia de senal a la que pertenece cada ponderacion. */
const SIGNAL_OF: Record<AffinityWeightCode, AffinitySignalType> = {
  [AffinityWeightCode.INTEREST]: AffinitySignalType.INTEREST,
  [AffinityWeightCode.IMPROVEMENT_AREA]: AffinitySignalType.IMPROVEMENT_AREA,
  [AffinityWeightCode.SKILL_BASIC]: AffinitySignalType.SKILL,
  [AffinityWeightCode.SKILL_INTERMEDIATE]: AffinitySignalType.SKILL,
  [AffinityWeightCode.SKILL_ADVANCED]: AffinitySignalType.SKILL,
  [AffinityWeightCode.ACTIVITY_INTERESTED]: AffinitySignalType.ACTIVITY,
  [AffinityWeightCode.ACTIVITY_REGISTERED]: AffinitySignalType.ACTIVITY,
  [AffinityWeightCode.ACTIVITY_CONFIRMED]: AffinitySignalType.ACTIVITY,
  [AffinityWeightCode.PROJECT_OWNED]: AffinitySignalType.PROJECT,
  [AffinityWeightCode.PROJECT_MEMBER]: AffinitySignalType.PROJECT,
  [AffinityWeightCode.EVIDENCE]: AffinitySignalType.EVIDENCE,
  [AffinityWeightCode.CERTIFICATE]: AffinitySignalType.CERTIFICATE,
  [AffinityWeightCode.CONSTANCY]: AffinitySignalType.CONSTANCY,
};

/**
 * Reglas de clasificacion del nivel de afinidad (RF17).
 *
 * El nivel se calculaba con umbrales absolutos: menos de 5 puntos bajo, hasta
 * 10 medio, y alto por encima. Eso no discrimina. Un estudiante de octavo
 * semestre acumula puntos en todo y termina con TODAS sus areas en "alto",
 * momento en el que el nivel deja de orientar: si todo es alto, nada lo es. Al
 * de primer semestre le pasa lo contrario y todo le sale bajo.
 *
 * La afinidad responde a "hacia donde se inclina este estudiante", y esa
 * pregunta es relativa al propio estudiante, no a una escala fija de la
 * carrera. Por eso el nivel compara cada area con el area mas fuerte del mismo
 * perfil.
 *
 * El piso absoluto evita el efecto contrario: sin el, un estudiante que solo
 * declaro un interes de 2 puntos tendria un area "alta" sin ninguna
 * trayectoria detras. Hacen falta las dos condiciones.
 */
const LEVEL_RULES = {
  /** Proporcion respecto al area mas fuerte para considerarse alta. */
  HIGH_SHARE: 0.6,
  /** Piso absoluto para nivel alto: sin sustancia propia no hay afinidad alta. */
  HIGH_MIN_SCORE: 6,
  /** Proporcion respecto al area mas fuerte para considerarse media. */
  MEDIUM_SHARE: 0.3,
  /** Piso absoluto para nivel medio. */
  MEDIUM_MIN_SCORE: 3,
};

/** Cuantas instantaneas se conservan por estudiante. */
const SNAPSHOT_RETENTION = 30;

/** Limite de la columna `source_label`. */
const LABEL_MAX = 200;

@Injectable()
export class AffinityEngineService implements AffinityRecalculationPort {
  constructor(
    private readonly dataSource: DataSource,
    @InjectRepository(StudentProfile) private readonly profiles: Repository<StudentProfile>,
    @InjectRepository(StudentInterest) private readonly interests: Repository<StudentInterest>,
    @InjectRepository(StudentSkill) private readonly skills: Repository<StudentSkill>,
    @InjectRepository(AcademicArea) private readonly areas: Repository<AcademicArea>,
    @InjectRepository(ActivityRegistration)
    private readonly registrations: Repository<ActivityRegistration>,
    @InjectRepository(Project) private readonly projects: Repository<Project>,
    @InjectRepository(ProjectMember)
    private readonly projectMembers: Repository<ProjectMember>,
    @InjectRepository(ProjectEvidence) private readonly evidences: Repository<ProjectEvidence>,
    @InjectRepository(ExternalCertificate)
    private readonly certificates: Repository<ExternalCertificate>,
    @InjectRepository(InternalConstancy)
    private readonly constancies: Repository<InternalConstancy>,
    @InjectRepository(AffinityResult) private readonly results: Repository<AffinityResult>,
    @InjectRepository(AffinityWeight) private readonly weights: Repository<AffinityWeight>,
    @InjectRepository(AffinityContribution)
    private readonly contributions: Repository<AffinityContribution>,
    @InjectRepository(AffinitySnapshot)
    private readonly snapshots: Repository<AffinitySnapshot>,
  ) {}

  async requestRecalculation(studentProfileId: string): Promise<void> {
    await this.recalculate(studentProfileId);
  }

  async recalculate(studentProfileId: string): Promise<AffinityResult[]> {
    const profile = await this.profiles.findOne({ where: { id: studentProfileId } });
    if (!profile) {
      throw new NotFoundException('Perfil no encontrado.');
    }

    const areaList = await this.areas.find();
    const areas: AreaInfo[] = areaList.map((a) => ({
      id: a.id,
      name: a.name.toLowerCase(),
      displayName: a.name,
      tags: (a.tags ?? []).map((t) => t.toLowerCase()),
    }));
    const areaName = new Map(areas.map((a) => [a.id, a.displayName]));

    const { points: weightOf, version: rulesVersion } = await this.loadWeights();

    const found: Contribution[] = [];
    const add = (
      areaId: string | null | undefined,
      weightCode: AffinityWeightCode,
      matchType: AffinityMatchType,
      sourceLabel: string,
      sourceId: string | null,
    ) => {
      if (!areaId) return;
      const points = weightOf.get(weightCode) ?? 0;
      if (points <= 0) return;
      found.push({
        areaId,
        signalType: SIGNAL_OF[weightCode],
        weightCode,
        matchType,
        points,
        sourceLabel: sourceLabel.slice(0, LABEL_MAX),
        sourceId,
      });
    };

    // 1. Intereses declarados
    const interests = await this.interests.find({ where: { studentProfileId } });
    interests.forEach((i) =>
      add(
        i.academicAreaId,
        AffinityWeightCode.INTEREST,
        AffinityMatchType.DECLARED,
        `Interes declarado: ${areaName.get(i.academicAreaId) ?? 'area'}`,
        i.id,
      ),
    );

    // 2. Habilidades declaradas, ponderadas segun el nivel indicado
    const studentSkills = await this.skills.find({
      where: { studentProfileId },
      relations: { skill: true },
    });
    studentSkills.forEach((s) => {
      if (!s.skill?.academicAreaId) return;
      add(
        s.skill.academicAreaId,
        this.skillWeightCode(s.level),
        AffinityMatchType.DECLARED,
        `Habilidad declarada: ${s.skill.name} (nivel ${s.level})`,
        s.id,
      );
    });

    // 3. Areas en las que desea mejorar
    (profile.improvementAreaIds ?? []).forEach((id) =>
      add(
        id,
        AffinityWeightCode.IMPROVEMENT_AREA,
        AffinityMatchType.DECLARED,
        `Area en la que desea mejorar: ${areaName.get(id) ?? 'area'}`,
        null,
      ),
    );

    // 4-6. Actividades: interes, inscripcion o participacion confirmada
    const registrations = await this.registrations.find({
      where: { studentProfileId },
      relations: { activity: true },
    });
    registrations.forEach((r) => {
      const areaId = r.activity?.academicAreaId;
      if (!areaId) return;
      const code = this.activityWeightCode(r.status);
      if (!code) return;
      add(
        areaId,
        code,
        AffinityMatchType.INHERITED,
        `${this.activityLabel(r.status)}: ${r.activity?.title ?? 'actividad'}`,
        r.activity?.id ?? null,
      );
    });

    // 7-9. Proyectos, tecnologias y evidencias
    //
    // Cuentan tanto los proyectos de los que el estudiante es responsable como
    // aquellos en los que participa por haber ACEPTADO una invitacion (RF14).
    // Las invitaciones pendientes o rechazadas no generan pertenencia y, por
    // tanto, no influyen en la afinidad.
    const owned = await this.projects.find({ where: { createdByProfileId: studentProfileId } });

    const memberships = await this.projectMembers.find({ where: { userId: profile.userId } });
    const ownedIds = new Set(owned.map((p) => p.id));
    const collaborativeIds = memberships
      .map((m) => m.projectId)
      .filter((id) => !ownedIds.has(id));
    const collaborative = collaborativeIds.length
      ? await this.projects.find({ where: { id: In(collaborativeIds) } })
      : [];

    const areasByProject = new Map<string, string[]>();
    for (const project of [...owned, ...collaborative]) {
      const isOwned = ownedIds.has(project.id);
      const code = isOwned
        ? AffinityWeightCode.PROJECT_OWNED
        : AffinityWeightCode.PROJECT_MEMBER;
      const prefix = isOwned ? 'Proyecto propio' : 'Proyecto como integrante';

      // El area declarada manda. Si no hay, se deduce por coincidencia entre
      // las tecnologias del proyecto y las etiquetas del area (RN-14).
      const declared = !!project.academicAreaId;
      const projectAreas = declared
        ? [project.academicAreaId as string]
        : this.inferAreasByTech(project.technologies, areas);
      areasByProject.set(project.id, projectAreas);

      projectAreas.forEach((areaId) =>
        add(
          areaId,
          code,
          declared ? AffinityMatchType.DECLARED : AffinityMatchType.TAG,
          `${prefix}: ${project.title}`,
          project.id,
        ),
      );
    }

    // Todas las evidencias del estudiante en una sola consulta. Una evidencia
    // puntua en el area que declara, o en la de la actividad, o en las del
    // proyecto que respalda.
    const evidences = await this.evidences.find({
      where: { studentProfileId },
      relations: { activity: true },
    });
    for (const evidence of evidences) {
      const label = `Evidencia: ${evidence.description ?? 'sin descripcion'}`;
      if (evidence.academicAreaId) {
        add(
          evidence.academicAreaId,
          AffinityWeightCode.EVIDENCE,
          AffinityMatchType.DECLARED,
          label,
          evidence.id,
        );
      } else if (evidence.activity?.academicAreaId) {
        add(
          evidence.activity.academicAreaId,
          AffinityWeightCode.EVIDENCE,
          AffinityMatchType.INHERITED,
          label,
          evidence.id,
        );
      } else if (evidence.projectId) {
        (areasByProject.get(evidence.projectId) ?? []).forEach((areaId) =>
          add(
            areaId,
            AffinityWeightCode.EVIDENCE,
            AffinityMatchType.INHERITED,
            label,
            evidence.id,
          ),
        );
      }
    }

    // 10. Certificados externos: el area declarada manda; si no hay, se infiere
    // por coincidencia de texto con el nombre y las etiquetas del area.
    const certs = await this.certificates.find({ where: { studentProfileId } });
    certs.forEach((c) => {
      const label = `Certificado externo: ${c.certificateName}`;
      if (c.academicAreaId) {
        add(
          c.academicAreaId,
          AffinityWeightCode.CERTIFICATE,
          AffinityMatchType.DECLARED,
          label,
          c.id,
        );
        return;
      }
      this.matchAreasByText(`${c.certificateName} ${c.issuer}`, areas).forEach((areaId) =>
        add(areaId, AffinityWeightCode.CERTIFICATE, AffinityMatchType.TEXT, label, c.id),
      );
    });

    // 11. Constancias internas, por actividad o por coincidencia de texto
    const constancies = await this.constancies.find({
      where: { studentProfileId },
      relations: { activity: true },
    });
    constancies.forEach((c) => {
      const label = `Constancia interna: ${c.description}`;
      if (c.activity?.academicAreaId) {
        add(
          c.activity.academicAreaId,
          AffinityWeightCode.CONSTANCY,
          AffinityMatchType.INHERITED,
          label,
          c.id,
        );
      } else {
        this.matchAreasByText(c.description, areas).forEach((areaId) =>
          add(areaId, AffinityWeightCode.CONSTANCY, AffinityMatchType.TEXT, label, c.id),
        );
      }
    });

    return this.persist(studentProfileId, found, rulesVersion);
  }

  async getForProfile(studentProfileId: string): Promise<AffinityResult[]> {
    return this.results.find({
      where: { studentProfileId },
      relations: { academicArea: true },
      order: { score: 'DESC' },
    });
  }

  async resolveProfileIdByUser(userId: string): Promise<string> {
    const profile = await this.profiles.findOne({ where: { userId } });
    if (!profile) {
      throw new NotFoundException('Aún no has creado tu perfil estudiantil.');
    }
    return profile.id;
  }

  async assertProfileExists(studentProfileId: string): Promise<void> {
    const exists = await this.profiles.exists({ where: { id: studentProfileId } });
    if (!exists) {
      throw new NotFoundException('Perfil no encontrado.');
    }
  }

  /**
   * Vista completa de la afinidad de un estudiante (RF17).
   *
   * RF17 define dos salidas y son distintas entre si: mostrar las areas y sus
   * niveles, o informar que todavia no hay informacion suficiente. Una lista
   * vacia no comunica lo segundo, y por eso la respuesta lleva un estado
   * explicito y un mensaje que dice que hacer al respecto.
   */
  async getSummary(studentProfileId: string) {
    const [results, snapshot] = await Promise.all([
      this.getForProfile(studentProfileId),
      this.snapshots.findOne({
        where: { studentProfileId },
        order: { calculatedAt: 'DESC' },
      }),
    ]);

    const topScore = results.length ? Number(results[0].score) : 0;
    const status =
      results.length > 0
        ? AffinityCalculationStatus.CALCULATED
        : AffinityCalculationStatus.INSUFFICIENT_DATA;

    return {
      status,
      message:
        status === AffinityCalculationStatus.CALCULATED
          ? 'Afinidades calculadas a partir de la informacion de tu perfil.'
          : 'Todavia no hay informacion suficiente para orientarte. Declara intereses y ' +
            'habilidades, registra proyectos o participa en actividades y vuelve a consultar.',
      calculatedAt: snapshot?.calculatedAt ?? null,
      rulesVersion: snapshot?.rulesVersion ?? null,
      signalsCount: snapshot?.signalsCount ?? 0,
      totalScore: Number(results.reduce((sum, r) => sum + Number(r.score), 0).toFixed(2)),
      areas: results.map((r, index) => ({
        academicAreaId: r.academicAreaId,
        area: r.academicArea?.name ?? null,
        score: Number(r.score),
        level: r.level,
        rank: index + 1,
        /** Peso relativo respecto al area mas fuerte, que es como se clasifica. */
        share: topScore > 0 ? Number((Number(r.score) / topScore).toFixed(4)) : 0,
      })),
    };
  }

  /**
   * Desglose de un area concreta: por que el estudiante tiene ese puntaje.
   *
   * Es la respuesta a la pregunta que un tribunal hace siempre ante un motor de
   * puntuacion. La suma de las lineas es exactamente el puntaje del area.
   */
  async getBreakdown(studentProfileId: string, academicAreaId: string) {
    const [area, result, rows] = await Promise.all([
      this.areas.findOne({ where: { id: academicAreaId } }),
      this.results.findOne({ where: { studentProfileId, academicAreaId } }),
      this.contributions.find({
        where: { studentProfileId, academicAreaId },
        order: { points: 'DESC', createdAt: 'ASC' },
      }),
    ]);

    if (!area) {
      throw new NotFoundException('Area academica no encontrada.');
    }

    return {
      academicAreaId,
      area: area.name,
      score: result ? Number(result.score) : 0,
      level: result?.level ?? null,
      contributions: rows.map((c) => ({
        signalType: c.signalType,
        weightCode: c.weightCode,
        matchType: c.matchType,
        points: Number(c.points),
        sourceLabel: c.sourceLabel,
        sourceId: c.sourceId,
      })),
    };
  }

  /**
   * Historial de calculos, del mas reciente al mas antiguo (RF17).
   *
   * Permite ver como evoluciono la orientacion del estudiante. NO es una
   * prediccion: RN-15 prohibe usar estos datos para anticipar resultados
   * academicos, y las estimaciones de tendencias son el decimo objetivo.
   */
  async getHistory(studentProfileId: string, limit = 10) {
    const rows = await this.snapshots.find({
      where: { studentProfileId },
      relations: { items: { academicArea: true } },
      order: { calculatedAt: 'DESC' },
      take: Math.min(Math.max(limit, 1), SNAPSHOT_RETENTION),
    });

    return rows.map((snapshot) => ({
      id: snapshot.id,
      calculatedAt: snapshot.calculatedAt,
      status: snapshot.status,
      totalScore: Number(snapshot.totalScore),
      areasCount: snapshot.areasCount,
      signalsCount: snapshot.signalsCount,
      rulesVersion: snapshot.rulesVersion,
      areas: [...(snapshot.items ?? [])]
        .sort((a, b) => a.rank - b.rank)
        .map((item) => ({
          academicAreaId: item.academicAreaId,
          area: item.academicArea?.name ?? null,
          score: Number(item.score),
          level: item.level,
          rank: item.rank,
        })),
    }));
  }

  /**
   * Las ponderaciones vigentes, para que la explicacion sea completa.
   *
   * RN-14 exige que el calculo use ponderaciones definidas para el sistema.
   * Exponerlas de solo lectura permite que el estudiante -y el tribunal- vean
   * la regla, no solo su resultado.
   */
  async getWeights() {
    const rows = await this.weights.find({
      where: { isActive: true },
      order: { signalType: 'ASC', points: 'DESC' },
    });
    return rows.map((w) => ({
      code: w.code,
      signalType: w.signalType,
      points: Number(w.points),
      label: w.label,
      description: w.description,
    }));
  }

  /**
   * Conteo agregado de afinidades por area, para el mapa del director.
   *
   * La agregacion se hace en la base. Antes se traian todas las filas de
   * affinity_results a memoria para contarlas en JavaScript: con un estudiante
   * por semestre daba igual, pero crece con el numero de estudiantes por el de
   * areas y no hay razon para pagarlo.
   */
  async basicMap() {
    const rows = await this.results
      .createQueryBuilder('result')
      .innerJoin('result.academicArea', 'area')
      .select('result.academic_area_id', 'areaId')
      .addSelect('area.name', 'area')
      .addSelect('COUNT(*)::int', 'students')
      .addSelect('COALESCE(AVG(result.score), 0)', 'averageScore')
      .addSelect(`COUNT(*) FILTER (WHERE result.level = 'low')::int`, 'low')
      .addSelect(`COUNT(*) FILTER (WHERE result.level = 'medium')::int`, 'medium')
      .addSelect(`COUNT(*) FILTER (WHERE result.level = 'high')::int`, 'high')
      .groupBy('result.academic_area_id')
      .addGroupBy('area.name')
      .orderBy('students', 'DESC')
      .getRawMany<{
        areaId: string;
        area: string;
        students: number;
        averageScore: string;
        low: number;
        medium: number;
        high: number;
      }>();

    return rows.map((r) => ({
      areaId: r.areaId,
      area: r.area,
      students: r.students,
      averageScore: Number(Number(r.averageScore).toFixed(2)),
      byLevel: { low: r.low, medium: r.medium, high: r.high },
    }));
  }

  /**
   * Carga las ponderaciones vigentes y calcula su huella.
   *
   * La huella permite distinguir despues una variacion de puntaje causada por
   * nueva actividad del estudiante de una causada por un ajuste de las reglas.
   */
  private async loadWeights(): Promise<{
    points: Map<AffinityWeightCode, number>;
    version: string;
  }> {
    const rows = await this.weights.find({ where: { isActive: true } });
    const points = new Map<AffinityWeightCode, number>();
    rows.forEach((r) => points.set(r.code, Number(r.points)));

    // Una regla ausente no debe traducirse en una afinidad incompleta y
    // silenciosa: se completa con el valor conocido por defecto.
    (Object.keys(DEFAULT_WEIGHTS) as AffinityWeightCode[]).forEach((code) => {
      if (!points.has(code)) points.set(code, DEFAULT_WEIGHTS[code]);
    });

    // La huella incluye tambien los umbrales de clasificacion: si cambian, el
    // nivel de un area puede moverse sin que el estudiante haya hecho nada, y
    // el historial debe permitir distinguir esos dos casos.
    const fingerprint = [
      ...[...points.entries()]
        .sort(([a], [b]) => a.localeCompare(b))
        .map(([code, value]) => `${code}=${value}`),
      `levels=${LEVEL_RULES.HIGH_SHARE}/${LEVEL_RULES.HIGH_MIN_SCORE}` +
        `/${LEVEL_RULES.MEDIUM_SHARE}/${LEVEL_RULES.MEDIUM_MIN_SCORE}`,
    ].join('|');

    return {
      points,
      version: createHash('sha256').update(fingerprint).digest('hex').slice(0, 16),
    };
  }

  /**
   * Escribe resultados, desglose e instantanea en una sola transaccion.
   *
   * Antes se borraban los resultados y despues se insertaban los nuevos sin
   * transaccion: si algo fallaba entre ambos pasos, el estudiante se quedaba
   * sin ninguna afinidad. Ahora, o se aplica todo, o no cambia nada.
   */
  private async persist(
    studentProfileId: string,
    contributions: Contribution[],
    rulesVersion: string,
  ): Promise<AffinityResult[]> {
    const totals = new Map<string, number>();
    contributions.forEach((c) => {
      totals.set(c.areaId, (totals.get(c.areaId) ?? 0) + c.points);
    });

    // El nivel es relativo al area mas fuerte del propio estudiante, asi que
    // primero hay que conocer el maximo y solo despues clasificar.
    const scored = [...totals.entries()]
      .filter(([, score]) => score > 0)
      .map(([academicAreaId, score]) => ({ academicAreaId, score: Number(score.toFixed(2)) }))
      .sort((a, b) => b.score - a.score);

    const topScore = scored.length ? scored[0].score : 0;
    const ranked = scored.map((entry) => ({
      ...entry,
      level: this.classify(entry.score, topScore),
    }));

    await this.dataSource.transaction(async (manager) => {
      await manager.delete(AffinityResult, { studentProfileId });
      await manager.delete(AffinityContribution, { studentProfileId });

      if (ranked.length > 0) {
        await manager.insert(
          AffinityResult,
          ranked.map((r) => ({
            studentProfileId,
            academicAreaId: r.academicAreaId,
            score: r.score,
            level: r.level,
          })),
        );
        await manager.insert(
          AffinityContribution,
          contributions.map((c) => ({
            studentProfileId,
            academicAreaId: c.areaId,
            signalType: c.signalType,
            weightCode: c.weightCode,
            matchType: c.matchType,
            points: c.points,
            sourceLabel: c.sourceLabel,
            sourceId: c.sourceId,
          })),
        );
      }

      const snapshot = await manager.save(
        manager.create(AffinitySnapshot, {
          studentProfileId,
          status: ranked.length
            ? AffinityCalculationStatus.CALCULATED
            : AffinityCalculationStatus.INSUFFICIENT_DATA,
          totalScore: Number(ranked.reduce((sum, r) => sum + r.score, 0).toFixed(2)),
          areasCount: ranked.length,
          signalsCount: contributions.length,
          rulesVersion,
        }),
      );

      if (ranked.length > 0) {
        await manager.insert(
          AffinitySnapshotItem,
          ranked.map((r, index) => ({
            snapshotId: snapshot.id,
            academicAreaId: r.academicAreaId,
            score: r.score,
            level: r.level,
            rank: index + 1,
          })),
        );
      }

      await this.pruneSnapshots(manager, studentProfileId);
    });

    return ranked.length ? this.getForProfile(studentProfileId) : [];
  }

  /**
   * Conserva solo las ultimas instantaneas de cada estudiante.
   *
   * El historial debe permitir ver evolucion, no crecer sin limite: cada accion
   * del estudiante dispara un recalculo, y sin poda la tabla crece de forma
   * indefinida.
   */
  private async pruneSnapshots(
    manager: DataSource['manager'],
    studentProfileId: string,
  ): Promise<void> {
    const obsolete = await manager
      .createQueryBuilder(AffinitySnapshot, 'snapshot')
      .select('snapshot.id', 'id')
      .where('snapshot.student_profile_id = :studentProfileId', { studentProfileId })
      .orderBy('snapshot.calculated_at', 'DESC')
      .addOrderBy('snapshot.id', 'DESC')
      .offset(SNAPSHOT_RETENTION)
      .limit(500)
      .getRawMany<{ id: string }>();

    if (obsolete.length > 0) {
      await manager.delete(
        AffinitySnapshot,
        obsolete.map((row) => row.id),
      );
    }
  }

  private skillWeightCode(level: number): AffinityWeightCode {
    if (level <= 2) return AffinityWeightCode.SKILL_BASIC;
    if (level === 3) return AffinityWeightCode.SKILL_INTERMEDIATE;
    return AffinityWeightCode.SKILL_ADVANCED;
  }

  private activityWeightCode(status: RegistrationStatus): AffinityWeightCode | null {
    if (status === RegistrationStatus.INTERESTED) return AffinityWeightCode.ACTIVITY_INTERESTED;
    if (status === RegistrationStatus.REGISTERED) return AffinityWeightCode.ACTIVITY_REGISTERED;
    if (status === RegistrationStatus.CONFIRMED) return AffinityWeightCode.ACTIVITY_CONFIRMED;
    return null;
  }

  private activityLabel(status: RegistrationStatus): string {
    if (status === RegistrationStatus.INTERESTED) return 'Interes en actividad';
    if (status === RegistrationStatus.REGISTERED) return 'Inscripcion en actividad';
    return 'Participacion confirmada';
  }

  /**
   * Clasifica un area comparandola con la mas fuerte del mismo estudiante.
   *
   * Exige las dos condiciones a la vez: peso relativo dentro del perfil y una
   * sustancia absoluta minima. Ver LEVEL_RULES.
   */
  private classify(score: number, topScore: number): AffinityLevel {
    const share = topScore > 0 ? score / topScore : 0;
    if (share >= LEVEL_RULES.HIGH_SHARE && score >= LEVEL_RULES.HIGH_MIN_SCORE) {
      return AffinityLevel.HIGH;
    }
    if (share >= LEVEL_RULES.MEDIUM_SHARE && score >= LEVEL_RULES.MEDIUM_MIN_SCORE) {
      return AffinityLevel.MEDIUM;
    }
    return AffinityLevel.LOW;
  }

  private inferAreasByTech(technologies: string[] | null, areas: AreaInfo[]): string[] {
    if (!technologies || technologies.length === 0) return [];
    const techs = technologies.map((t) => t.toLowerCase());
    const matched = new Set<string>();
    for (const area of areas) {
      const hit = techs.some((tech) =>
        area.tags.some((tag) => tech.includes(tag) || tag.includes(tech)),
      );
      if (hit) matched.add(area.id);
    }
    return [...matched];
  }

  private matchAreasByText(text: string, areas: AreaInfo[]): string[] {
    const normalized = text.toLowerCase();
    const matched = new Set<string>();
    for (const area of areas) {
      const hit =
        normalized.includes(area.name) || area.tags.some((tag) => normalized.includes(tag));
      if (hit) matched.add(area.id);
    }
    return [...matched];
  }
}
