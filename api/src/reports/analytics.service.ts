import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, Repository } from 'typeorm';
import {
  AffinityLevel,
  ProjectBackingTier,
  RegistrationStatus,
  RolNombre,
} from '@perfil/shared';
import { AffinitySnapshot } from '../entities/affinity-snapshot.entity';
import { AffinitySnapshotItem } from '../entities/affinity-snapshot-item.entity';
import { AffinityResult } from '../entities/affinity-result.entity';
import { Activity } from '../entities/activity.entity';
import { ActivityRegistration } from '../entities/activity-registration.entity';
import { Project } from '../entities/project.entity';
import { StudentInterest } from '../entities/student-interest.entity';
import { StudentProfile } from '../entities/student-profile.entity';
import { TeacherScopeService } from '../access/teacher-scope.service';
import { AuthenticatedUser } from '../auth/types/authenticated-user';
import { AnalyticsPrivacyService } from './analytics-privacy.service';

const num = (v: unknown): number => Number(v ?? 0);

/** Cuántos periodos se muestran en una evolución. */
const PERIODOS = 12;

const NIVEL: Record<string, string> = {
  [AffinityLevel.HIGH]: 'alto',
  [AffinityLevel.MEDIUM]: 'medio',
  [AffinityLevel.LOW]: 'bajo',
};

/**
 * Analítica descriptiva (§63, §64, §65, §69).
 *
 * Todo lo de aquí describe lo que ocurrió. §63 y §64 lo prohíben en los mismos
 * términos: *«No utilizar lenguaje predictivo»*, *«No predecir notas, abandono,
 * aprobación, éxito profesional ni rendimiento»*. Eso no es solo una regla de
 * redacción: condiciona qué se calcula. Aquí no hay proyecciones, ni
 * tendencias extrapoladas, ni ningún número que responda «qué va a pasar».
 *
 * El umbral de §65 se aplica en cada desglose por grupo, y la nota que lo
 * explica viaja en la respuesta.
 */
@Injectable()
export class AnalyticsService {
  constructor(
    @InjectRepository(AffinitySnapshot)
    private readonly snapshots: Repository<AffinitySnapshot>,
    @InjectRepository(AffinitySnapshotItem)
    private readonly snapshotItems: Repository<AffinitySnapshotItem>,
    @InjectRepository(AffinityResult) private readonly affinities: Repository<AffinityResult>,
    @InjectRepository(Activity) private readonly activities: Repository<Activity>,
    @InjectRepository(ActivityRegistration)
    private readonly registrations: Repository<ActivityRegistration>,
    @InjectRepository(Project) private readonly projects: Repository<Project>,
    @InjectRepository(StudentInterest) private readonly interests: Repository<StudentInterest>,
    @InjectRepository(StudentProfile) private readonly profiles: Repository<StudentProfile>,
    private readonly teacherScope: TeacherScopeService,
    private readonly privacy: AnalyticsPrivacyService,
  ) {}

  // =========================================================================
  // §63 · Evolución del estudiante
  // =========================================================================

  /**
   * Evolución de un estudiante a partir de sus instantáneas (§63).
   *
   * §63 enumera exactamente qué sale: periodo, área, `affinity_score`,
   * `support_score` y `support_level`. Se devuelve eso y nada más — ni
   * proyecciones, ni «va camino de», ni comparación con una media que
   * invitaría a leerlo como una nota.
   *
   * Las instantáneas del motor V1 se marcan aparte: guardaban puntos crudos sin
   * techo y las de V2 un porcentaje sobre 100. Ponerlas en la misma línea
   * mostraría una caída enorme donde solo hubo un cambio de escala.
   */
  async studentEvolution(studentProfileId: string) {
    const perfil = await this.profiles.findOne({
      where: { id: studentProfileId },
      relations: { user: true },
    });
    if (!perfil) throw new NotFoundException('Perfil no encontrado.');

    const instantaneas = await this.snapshots.find({
      where: { studentProfileId },
      order: { calculatedAt: 'DESC' },
      take: PERIODOS,
    });
    if (instantaneas.length === 0) {
      return {
        student: this.vistaEstudiante(perfil),
        periods: [],
        areas: [],
        note: this.privacy.notice,
        message:
          'Todavía no hay cálculos registrados. La evolución aparece cuando el perfil '
          + 'acumula al menos dos.',
      };
    }

    const items = await this.snapshotItems.find({
      where: { snapshotId: In(instantaneas.map((s) => s.id)) },
      relations: { academicArea: true },
    });
    const porInstantanea = new Map<string, AffinitySnapshotItem[]>();
    items.forEach((i) => {
      const lista = porInstantanea.get(i.snapshotId) ?? [];
      lista.push(i);
      porInstantanea.set(i.snapshotId, lista);
    });

    // De la más antigua a la más reciente: una evolución se lee hacia adelante.
    const ordenadas = [...instantaneas].reverse();

    const periods = ordenadas.map((s) => ({
      period: s.calculatedAt,
      engineVersion: s.engineVersion,
      /** Comparable con los demás periodos solo si comparten versión de motor. */
      comparable: s.engineVersion === instantaneas[0].engineVersion,
      areasCount: s.areasCount,
      signalsCount: s.signalsCount,
      averageSupport: s.averageSupport,
      areas: (porInstantanea.get(s.id) ?? [])
        .sort((a, b) => a.rank - b.rank)
        .map((i) => ({
          area: i.academicArea?.name ?? null,
          academicAreaId: i.academicAreaId,
          affinityScore: Number(i.score),
          supportScore: i.supportScore,
          supportLevel: i.supportLevel,
        })),
    }));

    // Una segunda vista, por área, que es como se lee una evolución.
    const porArea = new Map<string, { area: string | null; puntos: unknown[] }>();
    periods.forEach((p) => {
      p.areas.forEach((a) => {
        const entrada = porArea.get(a.academicAreaId)
          ?? { area: a.area, puntos: [] as unknown[] };
        entrada.puntos.push({
          period: p.period,
          engineVersion: p.engineVersion,
          affinityScore: a.affinityScore,
          supportScore: a.supportScore,
          supportLevel: a.supportLevel,
        });
        porArea.set(a.academicAreaId, entrada);
      });
    });

    return {
      student: this.vistaEstudiante(perfil),
      periods,
      areas: [...porArea.entries()].map(([academicAreaId, v]) => ({
        academicAreaId,
        area: v.area,
        points: v.puntos,
      })),
      note: this.privacy.notice,
      message: null as string | null,
    };
  }

  /** La evolución de un estudiante, comprobando el alcance docente (§68). */
  async studentEvolutionForStaff(user: AuthenticatedUser, studentProfileId: string) {
    await this.teacherScope.assertCanAccessProfile(user, studentProfileId);
    return this.studentEvolution(studentProfileId);
  }

  // =========================================================================
  // §64 · Tendencias para Dirección
  // =========================================================================

  /**
   * Las cinco tendencias que §64 enumera, todas descriptivas.
   *
   * «Evolución» aquí significa comparar dos momentos de lo registrado, no
   * proyectar el tercero. La diferencia importa: un delta dice qué cambió, una
   * proyección afirma qué va a pasar, y §64 admite lo primero y prohíbe lo
   * segundo.
   */
  async directorTrends() {
    const [
      interesPorArea,
      participacion,
      areasPorSemestre,
      tecnologias,
      actividades,
    ] = await Promise.all([
      this.evolucionInteresPorArea(),
      this.evolucionParticipacion(),
      this.areasPredominantesPorSemestre(),
      this.tecnologiasEnProyectos(),
      this.actividadesConMasParticipacion(),
    ]);

    return {
      interestByArea: interesPorArea,
      participation: participacion,
      areasBySemester: areasPorSemestre,
      technologies: tecnologias,
      activities: actividades,
      note: this.privacy.notice,
    };
  }

  /** Cuántos estudiantes declaran cada área, y desde cuándo. */
  private async evolucionInteresPorArea() {
    const filas = await this.interests
      .createQueryBuilder('i')
      .leftJoin('i.academicArea', 'a')
      .select('a.name', 'area')
      .addSelect('COUNT(*)', 'students')
      .addSelect("COUNT(*) FILTER (WHERE i.created_at >= now() - interval '90 days')", 'recent')
      .addSelect('AVG(i.priority)', 'avgPriority')
      .groupBy('a.id')
      .addGroupBy('a.name')
      .orderBy('students', 'DESC')
      .limit(15)
      .getRawMany();

    return this.privacy.protect(
      filas.map((f) => ({
        area: f.area,
        students: num(f.students),
        declaredLast90Days: num(f.recent),
        averagePriority: Number(num(f.avgPriority).toFixed(2)),
      })),
      (f) => f.students,
      ['area', 'students'],
    );
  }

  /** Participación registrada y confirmada, por mes. */
  private async evolucionParticipacion() {
    const filas = await this.registrations
      .createQueryBuilder('r')
      .select("to_char(date_trunc('month', r.created_at), 'YYYY-MM')", 'period')
      .addSelect('COUNT(*)', 'registrations')
      .addSelect(
        `COUNT(*) FILTER (WHERE r.status = '${RegistrationStatus.CONFIRMED}')`,
        'confirmed',
      )
      .addSelect('COUNT(DISTINCT r.student_profile_id)', 'students')
      .groupBy("date_trunc('month', r.created_at)")
      .orderBy("date_trunc('month', r.created_at)", 'ASC')
      .limit(PERIODOS)
      .getRawMany();

    return this.privacy.protect(
      filas.map((f) => ({
        period: f.period,
        students: num(f.students),
        registrations: num(f.registrations),
        confirmed: num(f.confirmed),
      })),
      (f) => f.students,
      ['period', 'students'],
    );
  }

  /**
   * Qué áreas predominan en cada semestre.
   *
   * Es el desglose que más pide el umbral de §65: con dos estudiantes en un
   * semestre, decir cuál es su área predominante es decir a qué se dedica cada
   * uno.
   */
  private async areasPredominantesPorSemestre() {
    const filas = await this.affinities
      .createQueryBuilder('r')
      .innerJoin('r.studentProfile', 'p')
      .innerJoin('r.academicArea', 'a')
      .select('p.semester', 'semester')
      .addSelect('a.name', 'area')
      .addSelect('COUNT(DISTINCT r.student_profile_id)', 'students')
      .addSelect('AVG(r.score)', 'avgAffinity')
      .addSelect('AVG(r.support_score)', 'avgSupport')
      .where('p.semester IS NOT NULL')
      .andWhere('r.score > 0')
      .groupBy('p.semester')
      .addGroupBy('a.id')
      .addGroupBy('a.name')
      .orderBy('p.semester', 'ASC')
      .addOrderBy('students', 'DESC')
      .getRawMany();

    // Estudiantes distintos por semestre: es el tamaño real del grupo, y no la
    // suma de las filas, porque un estudiante aparece en varias áreas.
    const porSemestre = new Map<number, number>();
    const cohortes = await this.profiles
      .createQueryBuilder('p')
      .select('p.semester', 'semester')
      .addSelect('COUNT(*)', 'students')
      .where('p.semester IS NOT NULL')
      .groupBy('p.semester')
      .getRawMany();
    cohortes.forEach((c) => porSemestre.set(num(c.semester), num(c.students)));

    const agrupado = new Map<number, unknown[]>();
    filas.forEach((f) => {
      const semestre = num(f.semester);
      const lista = agrupado.get(semestre) ?? [];
      if (lista.length < 5) {
        lista.push({
          area: f.area,
          students: num(f.students),
          averageAffinity: Number(num(f.avgAffinity).toFixed(1)),
          averageSupport: Number(num(f.avgSupport).toFixed(1)),
        });
      }
      agrupado.set(semestre, lista);
    });

    return this.privacy.protect(
      [...agrupado.entries()]
        .sort(([a], [b]) => a - b)
        .map(([semester, areas]) => ({
          semester,
          students: porSemestre.get(semester) ?? 0,
          areas,
        })),
      (f) => f.students,
      ['semester', 'students'],
    );
  }

  /**
   * Tecnologías más presentes en los proyectos (§64).
   *
   * En SQL directo: `unnest` sobre un arreglo dentro de una subconsulta se
   * expresa con claridad así, y el constructor de consultas obligaba a dos
   * alias que terminaban chocando entre sí.
   */
  private async tecnologiasEnProyectos() {
    const filas: { technology: string; projects: string; students: string }[] =
      await this.projects.query(`
        SELECT t.tecnologia AS technology,
               COUNT(*) AS projects,
               COUNT(DISTINCT t.created_by_profile_id) AS students
          FROM (
            SELECT p.created_by_profile_id,
                   unnest(p.technologies) AS tecnologia
              FROM projects p
             WHERE p.technologies IS NOT NULL
          ) t
         WHERE t.tecnologia IS NOT NULL AND t.tecnologia <> ''
         GROUP BY t.tecnologia
         ORDER BY projects DESC
         LIMIT 20
      `);

    return filas.map((f) => ({
      technology: f.technology,
      projects: num(f.projects),
      students: num(f.students),
    }));
  }

  /** Actividades con mayor participación confirmada (§64). */
  private async actividadesConMasParticipacion() {
    const filas = await this.registrations
      .createQueryBuilder('r')
      .innerJoin('r.activity', 'act')
      .leftJoin('act.academicArea', 'a')
      .select('act.title', 'activity')
      .addSelect('act.type', 'type')
      .addSelect('a.name', 'area')
      .addSelect('COUNT(*)', 'registrations')
      .addSelect(
        `COUNT(*) FILTER (WHERE r.status = '${RegistrationStatus.CONFIRMED}')`,
        'confirmed',
      )
      .groupBy('act.id')
      .addGroupBy('act.title')
      .addGroupBy('act.type')
      .addGroupBy('a.name')
      .orderBy('confirmed', 'DESC')
      .addOrderBy('registrations', 'DESC')
      .limit(15)
      .getRawMany();

    return filas.map((f) => ({
      activity: f.activity,
      type: f.type,
      area: f.area ?? null,
      registrations: num(f.registrations),
      confirmed: num(f.confirmed),
    }));
  }

  // =========================================================================
  // §65 · Sociedad científica: métricas de sus actividades
  // =========================================================================

  /**
   * Métricas de las actividades que gestiona la sociedad científica (§65).
   *
   * *«Sociedad: métricas de sus actividades»*, y nada más. No ve perfiles, ni
   * afinidades, ni proyectos: solo lo que ocurrió en lo que organizó. Por eso
   * el filtro es por responsable y no por rol — proteger el endpoint por rol
   * dejaría ver las actividades de toda la carrera a quien solo organizó dos.
   */
  async societyMetrics(user: AuthenticatedUser) {
    const suyas = await this.activities.find({
      where: [{ creatorId: user.userId }, { responsibleUserId: user.userId }],
      relations: { academicArea: true, category: true },
      order: { createdAt: 'DESC' },
    });
    if (suyas.length === 0) {
      return {
        activities: [],
        totals: { activities: 0, registrations: 0, confirmed: 0, students: 0 },
        note: this.privacy.notice,
      };
    }

    const ids = suyas.map((a) => a.id);
    const conteos = await this.registrations
      .createQueryBuilder('r')
      .select('r.activity_id', 'activityId')
      .addSelect('COUNT(*)', 'registrations')
      .addSelect(
        `COUNT(*) FILTER (WHERE r.status = '${RegistrationStatus.CONFIRMED}')`,
        'confirmed',
      )
      .where('r.activity_id IN (:...ids)', { ids })
      .groupBy('r.activity_id')
      .getRawMany();
    const porActividad = new Map(
      conteos.map((c) => [c.activityId, { registros: num(c.registrations), confirmados: num(c.confirmed) }]),
    );

    const distintos = await this.registrations
      .createQueryBuilder('r')
      .select('COUNT(DISTINCT r.student_profile_id)', 'students')
      .where('r.activity_id IN (:...ids)', { ids })
      .getRawOne();

    const filas = suyas.map((a) => {
      const c = porActividad.get(a.id) ?? { registros: 0, confirmados: 0 };
      return {
        activityId: a.id,
        title: a.title,
        type: a.type,
        status: a.status,
        area: a.academicArea?.name ?? null,
        category: a.category?.name ?? null,
        eventDate: a.eventDate,
        capacity: a.capacity,
        registrations: c.registros,
        confirmed: c.confirmados,
      };
    });

    return {
      // §65 aplica también aquí: una actividad con dos inscritos no se
      // desglosa, porque la sociedad sabe perfectamente quiénes son.
      activities: this.privacy.protect(
        filas,
        (f) => f.registrations,
        ['activityId', 'title', 'type', 'status', 'eventDate', 'registrations'],
      ),
      totals: {
        activities: suyas.length,
        registrations: filas.reduce((s, f) => s + f.registrations, 0),
        confirmed: filas.reduce((s, f) => s + f.confirmed, 0),
        students: num(distintos?.students),
      },
      note: this.privacy.notice,
    };
  }

  // =========================================================================
  // §69 · Mapa de Dirección, con respaldo
  // =========================================================================

  /**
   * Mapa de áreas de la carrera (§69), ahora con el respaldo de V2.
   *
   * La afinidad sola describe hacia dónde dice inclinarse la carrera; con el
   * respaldo al lado se ve además cuánto de eso está demostrado, que es una
   * pregunta distinta y más útil para decidir dónde hace falta apoyo.
   */
  async directorAffinityMap(semesters?: number[]) {
    const qb = this.affinities
      .createQueryBuilder('r')
      .innerJoin('r.academicArea', 'a')
      .innerJoin('r.studentProfile', 'p');

    if (semesters) {
      qb.andWhere('p.semester IN (:...semesters)', { semesters });
    }

    const filas = await qb
      .select('a.name', 'area')
      .addSelect('COUNT(DISTINCT r.student_profile_id)', 'students')
      .addSelect('AVG(r.score)', 'avgAffinity')
      .addSelect('AVG(r.support_score)', 'avgSupport')
      .addSelect(`COUNT(*) FILTER (WHERE r.support_level = '${AffinityLevel.HIGH}')`, 'supportHigh')
      .addSelect(`COUNT(*) FILTER (WHERE r.support_level = '${AffinityLevel.MEDIUM}')`, 'supportMedium')
      .addSelect(`COUNT(*) FILTER (WHERE r.support_level = '${AffinityLevel.LOW}')`, 'supportLow')
      .groupBy('a.id')
      .addGroupBy('a.name')
      .orderBy('students', 'DESC')
      .getRawMany();

    return {
      areas: this.privacy.protect(
        filas.map((f) => ({
          area: f.area,
          students: num(f.students),
          averageAffinity: Number(num(f.avgAffinity).toFixed(1)),
          averageSupport: Number(num(f.avgSupport).toFixed(1)),
          bySupportLevel: {
            [NIVEL[AffinityLevel.HIGH]]: num(f.supportHigh),
            [NIVEL[AffinityLevel.MEDIUM]]: num(f.supportMedium),
            [NIVEL[AffinityLevel.LOW]]: num(f.supportLow),
          },
        })),
        (f) => f.students,
        ['area', 'students'],
      ),
      note: this.privacy.notice,
    };
  }

  // =========================================================================
  // §68 · Panel del docente, con el respaldo de su alcance
  // =========================================================================

  /**
   * Respaldo del grupo del docente (§68).
   *
   * El alcance se resuelve antes de consultar: sin semestres habilitados no se
   * devuelve nada, y no «todo lo de la carrera». Es lo que §68 quiere decir con
   * que no basta con proteger el endpoint por rol.
   */
  async teacherSupportSummary(user: AuthenticatedUser) {
    const scope = await this.teacherScope.scopeFor(user);
    if (Array.isArray(scope) && scope.length === 0) {
      return {
        semesters: [] as number[],
        areas: [],
        projects: { total: 0, withBacking: 0, corroborated: 0 },
        note: this.privacy.notice,
      };
    }

    const qb = this.affinities
      .createQueryBuilder('r')
      .innerJoin('r.academicArea', 'a')
      .innerJoin('r.studentProfile', 'p');
    if (scope) qb.andWhere('p.semester IN (:...scope)', { scope });

    const filas = await qb
      .select('a.name', 'area')
      .addSelect('COUNT(DISTINCT r.student_profile_id)', 'students')
      .addSelect('AVG(r.score)', 'avgAffinity')
      .addSelect('AVG(r.support_score)', 'avgSupport')
      .groupBy('a.id')
      .addGroupBy('a.name')
      .orderBy('students', 'DESC')
      .limit(12)
      .getRawMany();

    const proyectosQb = this.projects
      .createQueryBuilder('pr')
      .innerJoin('pr.createdByProfile', 'p');
    if (scope) proyectosQb.andWhere('p.semester IN (:...scope)', { scope });

    const proyectos = await proyectosQb
      .select('COUNT(*)', 'total')
      .addSelect(
        `COUNT(*) FILTER (WHERE pr.backing_tier <> '${ProjectBackingTier.DECLARED}'`
        + ` AND pr.backing_tier <> '${ProjectBackingTier.FLAGGED}')`,
        'withBacking',
      )
      .addSelect(
        `COUNT(*) FILTER (WHERE pr.backing_tier IN ('${ProjectBackingTier.CORROBORATED}',`
        + ` '${ProjectBackingTier.REVIEWED}'))`,
        'corroborated',
      )
      .getRawOne();

    return {
      semesters: scope,
      areas: this.privacy.protect(
        filas.map((f) => ({
          area: f.area,
          students: num(f.students),
          averageAffinity: Number(num(f.avgAffinity).toFixed(1)),
          averageSupport: Number(num(f.avgSupport).toFixed(1)),
        })),
        (f) => f.students,
        ['area', 'students'],
      ),
      projects: {
        total: num(proyectos?.total),
        withBacking: num(proyectos?.withBacking),
        corroborated: num(proyectos?.corroborated),
      },
      note: this.privacy.notice,
    };
  }

  // =========================================================================

  private vistaEstudiante(perfil: StudentProfile) {
    return {
      profileId: perfil.id,
      name: perfil.user ? `${perfil.user.firstName} ${perfil.user.lastName}` : 'Estudiante',
      semester: perfil.semester,
    };
  }

  /** Perfil del usuario autenticado, para su propia evolución. */
  async ownProfileId(user: AuthenticatedUser): Promise<string> {
    if (user.role !== RolNombre.STUDENT) {
      throw new NotFoundException('Solo el estudiante tiene evolución propia.');
    }
    const perfil = await this.profiles.findOne({
      where: { userId: user.userId },
      select: { id: true },
    });
    if (!perfil) {
      throw new NotFoundException('Aún no has creado tu perfil estudiantil.');
    }
    return perfil.id;
  }
}
