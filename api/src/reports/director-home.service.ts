import { Injectable, Logger } from '@nestjs/common';
import { DataSource } from 'typeorm';
import {
  ConsultasDeInicio, ESTADO_CUENTA, MAX_FILAS, PROYECTO_COMPARTIDO_DIRECCION, TIPO_ACTIVIDAD, iso, n,
  type DetalleTarjeta, type FilaDetalle, type Resultado,
} from './inicio-consultas';

/**
 * V7.1 §13 · Inicio de Dirección: el mismo patrón de «Detalles» de solo
 * lectura que Administración (§3.1), con las consultas del alcance de
 * Dirección.
 *
 * Nada de aquí sale de los módulos de Administración ni les da acceso: este
 * servicio solo lo usan las rutas `reports/director/home…`, que son de
 * Dirección. Cada conjunto lee lo mismo que muestra el módulo al que lleva
 * «Ir a…»: las actividades con la visibilidad de su gestión, los proyectos con
 * la de su galería, las credenciales y propuestas con la de sus bandejas.
 *
 * No hay estudiantes con datos de contacto ni documentos: la tarjeta de
 * estudiantes es un resumen por semestre y las altas recientes con nombre y
 * semestre; la de analítica, cifras agregadas.
 */

/**
 * Las actividades que Dirección gestiona (`ActivitiesService.filtrarGestionables`):
 * las suyas; las que tiene asignadas, salvo el borrador de otra autoridad; las
 * que no pasan por revisión una vez publicadas y las que ya aprobó. Lo que otro
 * envió y espera decisión está en Aprobaciones, no aquí.
 */
const VISIBLE_PARA_DIRECCION = `(a.creator_id = $1
  OR ((a.responsible_user_id = $1 OR EXISTS (SELECT 1 FROM activity_responsibles ar WHERE ar.activity_id = a.id AND ar.user_id = $1))
      AND (a.status <> 'draft' OR NOT EXISTS (SELECT 1 FROM users cu JOIN roles cr ON cr.id = cu.role_id
                                               WHERE cu.id = a.creator_id AND cr.name IN ('ADMIN', 'CAREER_DIRECTOR'))))
  OR (NOT a.requires_review AND a.status <> 'draft')
  OR (a.requires_review AND a.review_status = 'approved'))`;

/** La bandeja de Aprobaciones lista todo lo pendiente (`ActivitiesService.pendingReviews`). `$1` se usa solo para fijar su tipo. */
const TODA_LA_BANDEJA = `($1::uuid IS NOT NULL)`;

/** El conjunto de cada tarjeta, para validar la ruta antes de consultar. */
export const SEGMENTOS_DIRECCION: Record<string, readonly string[]> = {
  aprobaciones: ['academica', 'extracurricular', 'externa'],
  credenciales: ['pendientes', 'observadas', 'decididas'],
  estudiantes: ['semestres', 'recientes'],
  proyectos: ['recientes'],
  actividades: ['academica', 'extracurricular', 'externa'],
  participaciones: ['recientes', 'asistencia'],
  recursos: ['recientes', 'propuestas'],
  autonomia: ['vigentes', 'revocadas'],
  puntos: ['concesiones', 'propuestas'],
  analitica: ['indicadores'],
};

const MODULO_AUTONOMIA: Record<string, string> = {
  RESOURCE: 'Publicar recursos sin revisión',
  GAMIFICATION: 'Otorgar puntos sin revisión',
  ACTIVITY: 'Publicar actividades sin revisión',
};

/** Una vista de Gestión de actividades: interna por tipo o externa de cualquier tipo. */
const vista = (tipo: string) => (tipo === 'externa'
  ? { donde: `a.origin_type = 'external'`, params: [] as unknown[] }
  : { donde: `a.origin_type = 'internal' AND a.type = $2`, params: [tipo] as unknown[] });

/** La actividad ya empezó (o terminó): es cuando se registra la asistencia. */
const YA_EMPEZO = `a.event_date IS NOT NULL AND a.event_date <= now()`;

@Injectable()
export class DirectorHomeService extends ConsultasDeInicio {
  protected readonly logger = new Logger(DirectorHomeService.name);
  protected readonly inicio = 'Inicio de Dirección';

  constructor(dataSource: DataSource) {
    super(dataSource);
  }

  /** §13 (H12, H13): un resumen por tarjeta; una que falla llega con su error y las demás siguen. */
  async resumen(directorId: string) {
    return this.calcularTarjetas({
      aprobaciones: async () => {
        const filas = await this.q(`SELECT CASE WHEN a.origin_type = 'external' THEN 'externa' ELSE a.type::text END AS k,
                                           COUNT(*) FILTER (WHERE a.review_status = 'pending') AS pendientes,
                                           COUNT(*) FILTER (WHERE a.review_status = 'observed') AS observadas
                                      FROM activities a WHERE a.review_status IN ('pending', 'observed') GROUP BY 1`);
        const de = (k: string, c: 'pendientes' | 'observadas') => n(filas.find((f) => f.k === k)?.[c]);
        const tipos = ['academica', 'extracurricular', 'externa'];
        return {
          total: tipos.reduce((s, t) => s + de(t, 'pendientes'), 0),
          academica: de('academica', 'pendientes'),
          extracurricular: de('extracurricular', 'pendientes'),
          externa: de('externa', 'pendientes'),
          observadas: tipos.reduce((s, t) => s + de(t, 'observadas'), 0),
        };
      },
      // D01 (DIR-02): todas las credenciales que esperan la decisión de Dirección, no solo las «excepcionales».
      credenciales: async () => {
        const [c] = await this.q(`SELECT COUNT(*) FILTER (WHERE v.manual_review_status = 'requested') AS pendientes,
                                         COUNT(*) FILTER (WHERE v.manual_review_status = 'observed') AS observadas
                                    FROM validation_records v JOIN external_certificates x ON x.id = v.resource_id
                                   WHERE v.resource_type = 'external_certificate'`);
        return { total: n(c?.pendientes), observadas: n(c?.observadas) };
      },
      estudiantes: async () => {
        const [c] = await this.q(`SELECT COUNT(*) AS total, COUNT(*) FILTER (WHERE u.status = 'active') AS activas
                                    FROM student_profiles p JOIN users u ON u.id = p.user_id`);
        return { total: n(c?.total), activas: n(c?.activas) };
      },
      proyectos: async () => ({ total: n((await this.q(`SELECT COUNT(*) AS c FROM projects p WHERE ${PROYECTO_COMPARTIDO_DIRECCION}`))[0]?.c) }),
      actividades: async () => {
        const [c] = await this.q(`SELECT COUNT(*) FILTER (WHERE a.origin_type = 'internal' AND a.type = 'academica') AS academica,
                                         COUNT(*) FILTER (WHERE a.origin_type = 'internal' AND a.type = 'extracurricular') AS extracurricular,
                                         COUNT(*) FILTER (WHERE a.origin_type = 'external') AS externa
                                    FROM activities a WHERE ${VISIBLE_PARA_DIRECCION}`, [directorId]);
        return { total: n(c?.academica) + n(c?.extracurricular) + n(c?.externa), academica: n(c?.academica), extracurricular: n(c?.extracurricular), externa: n(c?.externa) };
      },
      participaciones: async () => {
        const [c] = await this.q(`SELECT (SELECT COUNT(*) FROM activity_registrations r JOIN activities a ON a.id = r.activity_id
                                           WHERE r.status = 'confirmed' AND a.origin_type = 'internal') AS confirmadas,
                                         (SELECT COUNT(*) FROM activities a
                                           WHERE a.origin_type = 'internal' AND a.status <> 'cancelled' AND ${YA_EMPEZO}
                                             AND a.attendance_closed_at IS NULL AND ${VISIBLE_PARA_DIRECCION}) AS abiertas`, [directorId]);
        return { total: n(c?.confirmadas), asistenciaAbierta: n(c?.abiertas) };
      },
      recursos: async () => {
        const [c] = await this.q(`SELECT COUNT(*) FILTER (WHERE status = 'active' AND COALESCE(review_status, 'not_required') IN ('not_required', 'approved')) AS publicados,
                                         COUNT(*) FILTER (WHERE review_status = 'pending') AS propuestas FROM learning_resources`);
        return { total: n(c?.publicados), propuestas: n(c?.propuestas) };
      },
      autonomia: async () => {
        const [c] = await this.q(`SELECT COUNT(*) FILTER (WHERE revoked_at IS NULL) AS vigentes,
                                         COUNT(DISTINCT teacher_user_id) FILTER (WHERE revoked_at IS NULL) AS docentes,
                                         COUNT(*) FILTER (WHERE revoked_at IS NOT NULL) AS revocadas
                                    FROM approval_policies`);
        return { total: n(c?.vigentes), docentes: n(c?.docentes), revocadas: n(c?.revocadas) };
      },
      puntos: async () => {
        const [c] = await this.q(`SELECT (SELECT COUNT(*) FROM gamification_events WHERE points > 0) AS concesiones,
                                         (SELECT COUNT(*) FROM gamification_proposals WHERE status = 'pending') AS propuestas`);
        return { total: n(c?.concesiones), propuestas: n(c?.propuestas) };
      },
      analitica: async () => {
        const [c] = await this.q(`SELECT COUNT(DISTINCT student_profile_id) AS c FROM affinity_results`);
        return { total: n(c?.c) };
      },
    });
  }

  /** El modal: total real del conjunto y sus últimos 10. */
  async detalle(directorId: string, tarjeta: string, segmento: string): Promise<DetalleTarjeta> {
    return this.detalleDe(SEGMENTOS_DIRECCION, tarjeta, segmento, () => this.consultar(directorId, tarjeta, segmento));
  }

  private consultar(directorId: string, tarjeta: string, segmento: string): Promise<Resultado> {
    switch (tarjeta) {
      case 'aprobaciones': {
        const v = vista(segmento);
        return this.actividades(directorId, `${v.donde} AND a.review_status = 'pending'`, v.params, 'COALESCE(a.submitted_at, a.created_at)', TODA_LA_BANDEJA);
      }
      case 'credenciales': return this.revisiones(segmento);
      case 'estudiantes': return segmento === 'semestres' ? this.semestres() : this.altasRecientes();
      case 'proyectos': return this.proyectos(PROYECTO_COMPARTIDO_DIRECCION);
      case 'actividades': {
        const v = vista(segmento);
        return this.actividades(directorId, v.donde, v.params, 'a.created_at', VISIBLE_PARA_DIRECCION);
      }
      case 'participaciones': return segmento === 'asistencia' ? this.asistencia(directorId) : this.participacionesRecientes();
      case 'recursos': return this.recursos(segmento);
      case 'autonomia': return this.autonomia(segmento === 'revocadas');
      case 'puntos': return segmento === 'propuestas' ? this.propuestasDePuntos() : this.concesiones();
      default: return this.indicadores();
    }
  }

  // ---------- Estudiantes ----------

  /** Totales por semestre: sin nombres ni datos de contacto. */
  private async semestres(): Promise<Resultado> {
    const filas = await this.q(`SELECT p.semester, COUNT(*) AS estudiantes,
                                       COUNT(*) FILTER (WHERE u.status = 'active') AS activas,
                                       COUNT(*) FILTER (WHERE EXISTS (SELECT 1 FROM activity_registrations r JOIN activities a ON a.id = r.activity_id
                                                                       WHERE r.student_profile_id = p.id AND r.status = 'confirmed' AND a.origin_type = 'internal')) AS participaron
                                  FROM student_profiles p JOIN users u ON u.id = p.user_id
                                 GROUP BY p.semester ORDER BY p.semester NULLS LAST`);
    return {
      total: filas.reduce((s, f) => s + n(f.estudiantes), 0),
      nota: 'Totales por semestre. Dirección no tiene una gestión de estudiantes propia: el detalle por semestre está en Analítica › Participación.',
      filas: filas.map((f): FilaDetalle => ({
        id: `semestre-${f.semester ?? 'sin'}`,
        titulo: f.semester ? `${f.semester}.º semestre` : 'Sin semestre registrado',
        fecha: null,
        agregada: true,
        datos: [
          { campo: 'Estudiantes', valor: String(n(f.estudiantes)) },
          { campo: 'Con cuenta activa', valor: String(n(f.activas)) },
          { campo: 'Con participación confirmada', valor: String(n(f.participaron)) },
        ],
      })),
    };
  }

  /** Las últimas altas: nombre, semestre y estado de la cuenta; sin correo ni código. */
  private async altasRecientes(): Promise<Resultado> {
    const [[c], filas] = await Promise.all([
      this.q(`SELECT COUNT(*) AS c FROM student_profiles`),
      this.q(`SELECT p.id, p.semester, p.created_at, u.first_name, u.last_name, u.status
                FROM student_profiles p JOIN users u ON u.id = p.user_id
               ORDER BY p.created_at DESC, p.id DESC LIMIT ${MAX_FILAS}`),
    ]);
    return {
      total: n(c?.c),
      filas: filas.map((f): FilaDetalle => ({
        id: f.id,
        titulo: `${f.first_name} ${f.last_name}`.trim(),
        detalle: f.semester ? `${f.semester}.º semestre` : 'Sin semestre registrado',
        fecha: iso(f.created_at),
        estado: ESTADO_CUENTA[f.status] ?? null,
      })),
    };
  }

  // ---------- Participaciones ----------

  /** Los últimos hechos confirmados en actividades internas: quién y en qué. */
  private async participacionesRecientes(): Promise<Resultado> {
    const desde = `FROM activity_registrations r JOIN activities a ON a.id = r.activity_id WHERE r.status = 'confirmed' AND a.origin_type = 'internal'`;
    const [[c], filas] = await Promise.all([
      this.q(`SELECT COUNT(*) AS c ${desde}`),
      this.q(`SELECT r.id, r.updated_at, a.id AS actividad_id, a.title, a.type, u.first_name || ' ' || u.last_name AS estudiante, p.semester
                FROM activity_registrations r JOIN activities a ON a.id = r.activity_id
                JOIN student_profiles p ON p.id = r.student_profile_id JOIN users u ON u.id = p.user_id
               WHERE r.status = 'confirmed' AND a.origin_type = 'internal'
               ORDER BY r.updated_at DESC, r.id DESC LIMIT ${MAX_FILAS}`),
    ]);
    return {
      total: n(c?.c),
      nota: 'Asistencias confirmadas por el responsable de cada actividad interna, las últimas primero.',
      filas: filas.map((f): FilaDetalle => ({
        id: f.id,
        actividadId: f.actividad_id,
        titulo: f.estudiante,
        detalle: f.title,
        fecha: iso(f.updated_at),
        estado: { texto: 'Participación confirmada', tono: 'green' },
        datos: [
          { campo: 'Tipo', valor: TIPO_ACTIVIDAD[f.type] ?? '—' },
          ...(f.semester ? [{ campo: 'Semestre', valor: `${f.semester}.º` }] : []),
        ],
      })),
    };
  }

  /** Actividades internas que ya empezaron: cuántos asistieron y si la asistencia sigue abierta. */
  private async asistencia(directorId: string): Promise<Resultado> {
    const donde = `a.origin_type = 'internal' AND a.status <> 'cancelled' AND ${YA_EMPEZO} AND ${VISIBLE_PARA_DIRECCION}`;
    const [[c], filas] = await Promise.all([
      this.q(`SELECT COUNT(*) AS c FROM activities a WHERE ${donde}`, [directorId]),
      this.q(`SELECT a.id, a.title, a.type, a.attendance_closed_at, a.event_date AS fecha,
                     COUNT(r.id) FILTER (WHERE r.status = 'confirmed') AS confirmados,
                     COUNT(r.id) FILTER (WHERE r.status = 'absent') AS ausentes,
                     COUNT(r.id) FILTER (WHERE r.status IN ('registered', 'accepted')) AS sin_marcar
                FROM activities a LEFT JOIN activity_registrations r ON r.activity_id = a.id
               WHERE ${donde}
               GROUP BY a.id
               ORDER BY a.event_date DESC, a.id DESC LIMIT ${MAX_FILAS}`, [directorId]),
    ]);
    return {
      total: n(c?.c),
      nota: 'Actividades internas que ya empezaron, la última en empezar primero. La asistencia la registra y la cierra su responsable.',
      filas: filas.map((f): FilaDetalle => {
        const sinMarcar = n(f.sin_marcar);
        return {
          id: f.id,
          actividadId: f.id,
          titulo: f.title,
          detalle: TIPO_ACTIVIDAD[f.type] ?? null,
          fecha: iso(f.fecha),
          estado: f.attendance_closed_at
            ? { texto: 'Asistencia cerrada', tono: 'green' }
            : { texto: sinMarcar ? `Asistencia abierta: ${sinMarcar} sin marcar` : 'Asistencia abierta', tono: 'amber' },
          datos: [
            { campo: 'Asistieron', valor: String(n(f.confirmados)) },
            { campo: 'Ausentes', valor: String(n(f.ausentes)) },
            { campo: 'Sin marcar', valor: String(sinMarcar) },
          ],
        };
      }),
    };
  }

  // ---------- Autonomía docente ----------

  private async autonomia(revocadas: boolean): Promise<Resultado> {
    const donde = revocadas ? 'ap.revoked_at IS NOT NULL' : 'ap.revoked_at IS NULL';
    const fecha = revocadas ? 'ap.revoked_at' : 'ap.granted_at';
    const [[c], filas] = await Promise.all([
      this.q(`SELECT COUNT(*) AS c FROM approval_policies ap WHERE ${donde}`),
      this.q(`SELECT ap.id, ap.module, ap.justification, ap.revoke_reason, ${fecha} AS fecha,
                     t.first_name || ' ' || t.last_name AS docente, g.first_name || ' ' || g.last_name AS concede
                FROM approval_policies ap JOIN users t ON t.id = ap.teacher_user_id LEFT JOIN users g ON g.id = ap.granted_by
               WHERE ${donde} ORDER BY ${fecha} DESC, ap.id DESC LIMIT ${MAX_FILAS}`),
    ]);
    return {
      total: n(c?.c),
      nota: revocadas
        ? 'Autorizaciones ya revocadas: lo publicado u otorgado mientras estuvieron vigentes no se deshace.'
        : 'Lo que cada docente puede hacer sin pasar por Aprobaciones. Se concede y se revoca en Autonomía docente.',
      filas: filas.map((f): FilaDetalle => ({
        id: f.id,
        titulo: f.docente,
        detalle: MODULO_AUTONOMIA[f.module] ?? 'Otra autorización',
        fecha: iso(f.fecha),
        estado: revocadas ? { texto: 'Revocada', tono: 'gray' } : { texto: 'Vigente', tono: 'green' },
        datos: [
          ...(f.concede ? [{ campo: 'Concedió', valor: f.concede }] : []),
          { campo: revocadas ? 'Motivo de la revocación' : 'Justificación', valor: String((revocadas ? f.revoke_reason : f.justification) ?? '—').slice(0, 140) },
        ],
      })),
    };
  }

  // ---------- Analítica ----------

  /**
   * Una fila por pestaña de Analítica con cifras que ya existen en la base;
   * nada estimado ni proyectado. Cada fila lleva a su pestaña.
   */
  private async indicadores(): Promise<Resultado> {
    const [c] = await this.q(`SELECT
        (SELECT COUNT(*) FROM student_profiles) AS estudiantes,
        (SELECT COUNT(*) FROM projects p WHERE ${PROYECTO_COMPARTIDO_DIRECCION}) AS proyectos,
        (SELECT COUNT(*) FROM activities WHERE status NOT IN ('draft', 'cancelled')) AS actividades,
        (SELECT COUNT(DISTINCT student_profile_id) FROM affinity_results) AS con_afinidad,
        (SELECT COUNT(DISTINCT academic_area_id) FROM affinity_results) AS areas_afinidad,
        (SELECT COUNT(*) FROM activity_registrations r JOIN activities a ON a.id = r.activity_id WHERE r.status = 'confirmed' AND a.origin_type = 'internal') AS confirmadas,
        (SELECT COUNT(DISTINCT r.student_profile_id) FROM activity_registrations r JOIN activities a ON a.id = r.activity_id WHERE r.status = 'confirmed' AND a.origin_type = 'internal') AS participantes,
        (SELECT COUNT(*) FROM activity_registrations r JOIN activities a ON a.id = r.activity_id WHERE a.status = 'open' AND r.status IN ('registered', 'accepted')) AS inscritos_abiertas,
        (SELECT COUNT(*) FROM activities WHERE status = 'open') AS abiertas,
        (SELECT COUNT(*) FROM activity_registrations r JOIN activities a ON a.id = r.activity_id
          WHERE r.status = 'confirmed' AND a.origin_type = 'internal' AND a.event_date > now() - interval '30 days' AND a.event_date <= now()) AS ultimos30,
        (SELECT COUNT(*) FROM activity_registrations r JOIN activities a ON a.id = r.activity_id
          WHERE r.status = 'confirmed' AND a.origin_type = 'internal' AND a.event_date > now() - interval '60 days' AND a.event_date <= now() - interval '30 days') AS previos30`);
    const fila = (id: string, titulo: string, detalle: string, datos: [string, unknown][]): FilaDetalle => ({
      id, titulo, detalle, fecha: null, agregada: true, datos: datos.map(([campo, v]) => ({ campo, valor: String(n(v)) })),
    });
    return {
      total: 5,
      nota: 'Cifras descriptivas de la carrera, calculadas ahora. No miden rendimiento ni predicen nada. Cada fila abre su pestaña.',
      filas: [
        fila('panorama', 'Panorama', 'La carrera de un vistazo.', [['Estudiantes', c?.estudiantes], ['Proyectos compartidos', c?.proyectos], ['Actividades publicadas', c?.actividades]]),
        fila('afinidad', 'Afinidad', 'Áreas hacia las que se inclinan los estudiantes, según su trayectoria.', [['Estudiantes con afinidad calculada', c?.con_afinidad], ['Áreas con afinidad', c?.areas_afinidad]]),
        fila('participacion', 'Participación', 'Asistencias confirmadas en actividades internas.', [['Participaciones confirmadas', c?.confirmadas], ['Estudiantes que participaron', c?.participantes]]),
        fila('demanda', 'Demanda', 'Interés por lo que se ofrece ahora.', [['Actividades con inscripciones abiertas', c?.abiertas], ['Inscripciones en ellas', c?.inscritos_abiertas]]),
        fila('evolucion', 'Evolución', 'Participaciones confirmadas en actividades de los últimos 30 días y de los 30 anteriores.', [['Últimos 30 días', c?.ultimos30], ['30 días anteriores', c?.previos30]]),
      ],
    };
  }
}
