import { Logger, NotFoundException } from '@nestjs/common';
import { DataSource } from 'typeorm';
import { ACTIVITY_REVIEW_LABEL, GAMIFICATION_TRIGGER_LABEL, RolNombre } from '@perfil/shared';

/**
 * V7.1 §3.1 / §13 · Lo común a los Inicios con «Detalles» (Administración y
 * Dirección).
 *
 * Cada rol tiene su propio servicio, sus rutas y su lista cerrada de
 * conjuntos; aquí solo viven la forma de una fila, las etiquetas en palabras y
 * las consultas que los dos leen igual. Lo que depende del rol (qué
 * actividades o proyectos ve) entra como un predicado SQL que fija cada
 * servicio: reutilizar una consulta nunca hereda la visibilidad del otro rol.
 *
 * No hay ninguna mutación: todo es lectura con un máximo de 10 filas, el total
 * real del mismo conjunto y orden estable por fecha con desempate por ID.
 */

export type Tono = 'green' | 'amber' | 'red' | 'gray' | 'blue';

export interface FilaDetalle {
  id: string;
  titulo: string;
  /** Una línea de contexto (rol, responsable, emisor…). */
  detalle?: string | null;
  fecha: string | null;
  estado?: { texto: string; tono: Tono } | null;
  /** Pares campo–valor legibles; nunca códigos técnicos. */
  datos?: { campo: string; valor: string }[];
  /** Para ir a una fila concreta en el módulo (p. ej. la actividad). */
  actividadId?: string;
  /** Fila de totales (p. ej. un semestre): no tiene una fecha propia. */
  agregada?: boolean;
}

export interface DetalleTarjeta {
  tarjeta: string;
  segmento: string;
  total: number;
  filas: FilaDetalle[];
  /** Aclaración honesta del conjunto (p. ej. que el original del padrón no se guarda). */
  nota?: string;
}

export type Resultado = Omit<DetalleTarjeta, 'tarjeta' | 'segmento'>;

export const MAX_FILAS = 10;
export const n = (v: unknown) => Number(v ?? 0);
export const iso = (v: unknown): string | null => (v ? new Date(v as string).toISOString() : null);
export const fechaCorta = (v: unknown): string => (v ? String(v).slice(0, 10).split('-').reverse().join('/') : '—');

export const ROL: Record<string, string> = {
  [RolNombre.ADMIN]: 'Administración',
  [RolNombre.CAREER_DIRECTOR]: 'Dirección',
  [RolNombre.TEACHER]: 'Docente',
  [RolNombre.SCIENTIFIC_SOCIETY]: 'Sociedad científica',
  [RolNombre.STUDENT]: 'Estudiante',
};
export const ESTADO_CUENTA: Record<string, { texto: string; tono: Tono }> = {
  pending_activation: { texto: 'Sin activar', tono: 'amber' },
  active: { texto: 'Activa', tono: 'green' },
  suspended: { texto: 'Suspendida', tono: 'red' },
  inactive: { texto: 'Inactiva', tono: 'gray' },
};
export const ESTADO_ACTIVIDAD: Record<string, { texto: string; tono: Tono }> = {
  draft: { texto: 'Borrador', tono: 'gray' },
  published: { texto: 'Publicada', tono: 'blue' },
  open: { texto: 'Inscripciones abiertas', tono: 'green' },
  closed: { texto: 'Inscripciones cerradas', tono: 'blue' },
  finished: { texto: 'Finalizada', tono: 'gray' },
  cancelled: { texto: 'Cancelada', tono: 'red' },
};
export const REVISION_CREDENCIAL: Record<string, { texto: string; tono: Tono }> = {
  requested: { texto: 'Pendiente de decisión', tono: 'amber' },
  observed: { texto: 'Observada: espera corrección', tono: 'amber' },
  approved: { texto: 'Aprobada por Dirección', tono: 'green' },
  corroborated: { texto: 'Corroborada por Dirección', tono: 'green' },
  rejected: { texto: 'Rechazada', tono: 'red' },
  inconclusive: { texto: 'Revisada sin poder confirmar', tono: 'gray' },
  not_corroborated: { texto: 'Revisada sin poder confirmar', tono: 'gray' },
};
export const PROCESO_CREDENCIAL: Record<string, string> = {
  pending: 'Comparación en cola',
  processing: 'Comparación en curso',
  completed: 'Comparación terminada',
  inconclusive: 'Comparación sin conclusión',
  failed: 'Comparación con error',
  not_applicable: 'Sin modelo: va directo a Dirección',
};
export const PROPUESTA: Record<string, { texto: string; tono: Tono }> = {
  pending: { texto: 'Pendiente de decisión', tono: 'amber' },
  observed: { texto: 'Observada', tono: 'amber' },
  approved: { texto: 'Aprobada', tono: 'green' },
  rejected: { texto: 'Rechazada', tono: 'red' },
  not_required: { texto: 'Publicado', tono: 'green' },
};
export const TIPO_ACTIVIDAD: Record<string, string> = { academica: 'Académica', extracurricular: 'Extracurricular' };

/** Lo que la galería muestra a cada rol (`ProjectGalleryService.visibles`). */
export const PROYECTO_COMPARTIDO_ADMIN = `p.status = 'active' AND p.visibility IN ('profile', 'public_link', 'teachers')`;
export const PROYECTO_COMPARTIDO_DIRECCION = `p.status = 'active' AND p.visibility IN ('profile', 'public_link')`;

export const ERROR_TARJETA = 'No se pudo cargar este resumen.';

export abstract class ConsultasDeInicio {
  protected abstract readonly logger: Logger;
  /** Cómo se nombra el Inicio en el registro de errores. */
  protected abstract readonly inicio: string;

  constructor(protected readonly dataSource: DataSource) {}

  protected q(sql: string, params: unknown[] = []): Promise<any[]> {
    return this.dataSource.query(sql, params);
  }

  /**
   * §3.1 (H13): cada tarjeta se calcula por separado. Si una consulta falla,
   * esa tarjeta llega con `error` y las demás siguen; nunca se devuelve un
   * cero que parezca un dato válido.
   */
  protected async calcularTarjetas(tarjetas: Record<string, () => Promise<Record<string, unknown>>>) {
    const salida: Record<string, Record<string, unknown>> = {};
    await Promise.all(Object.entries(tarjetas).map(async ([id, fn]) => {
      try {
        salida[id] = await fn();
      } catch (e) {
        this.logger.warn(`${this.inicio}: la tarjeta «${id}» no se pudo calcular: ${(e as Error).message}`);
        salida[id] = { error: ERROR_TARJETA };
      }
    }));
    return { generatedAt: new Date().toISOString(), tarjetas: salida };
  }

  /** Valida la ruta contra la lista cerrada antes de tocar la base. */
  protected async detalleDe(
    segmentos: Record<string, readonly string[]>,
    tarjeta: string,
    segmento: string,
    consultar: () => Promise<Resultado>,
  ): Promise<DetalleTarjeta> {
    if (!Object.prototype.hasOwnProperty.call(segmentos, tarjeta) || !segmentos[tarjeta].includes(segmento)) {
      throw new NotFoundException('Ese resumen no existe.');
    }
    const r = await consultar();
    return { tarjeta, segmento, ...r, filas: r.filas.slice(0, MAX_FILAS) };
  }

  /**
   * Actividades de un conjunto. `visible` es el predicado del rol, con `$1`
   * como el ID de quien consulta; `donde` usa `$2…`.
   */
  protected async actividades(usuarioId: string, donde: string, params: unknown[], orden: string, visible: string): Promise<Resultado> {
    const ps = [usuarioId, ...params];
    const [[c], filas] = await Promise.all([
      this.q(`SELECT COUNT(*) AS c FROM activities a WHERE ${donde} AND ${visible}`, ps),
      this.q(`SELECT a.id, a.title, a.type, a.status, a.review_status, a.provider,
                     to_char(a.event_date AT TIME ZONE 'America/La_Paz', 'YYYY-MM-DD') AS inicio, ${orden} AS fecha,
                     u.first_name || ' ' || u.last_name AS creador, r.name AS rol
                FROM activities a LEFT JOIN users u ON u.id = a.creator_id LEFT JOIN roles r ON r.id = u.role_id
               WHERE ${donde} AND ${visible}
               ORDER BY ${orden} DESC, a.id DESC LIMIT ${MAX_FILAS}`, ps),
    ]);
    return {
      total: n(c?.c),
      filas: filas.map((f): FilaDetalle => ({
        id: f.id,
        actividadId: f.id,
        titulo: f.title,
        detalle: [f.creador ? `Propone: ${f.creador}${ROL[f.rol] ? ` (${ROL[f.rol]})` : ''}` : null, f.provider ? `Proveedor: ${f.provider}` : null].filter(Boolean).join(' · ') || null,
        fecha: iso(f.fecha),
        estado: ESTADO_ACTIVIDAD[f.status] ?? null,
        datos: [
          { campo: 'Tipo', valor: TIPO_ACTIVIDAD[f.type] ?? '—' },
          ...(f.review_status ? [{ campo: 'Revisión', valor: ACTIVITY_REVIEW_LABEL[f.review_status as keyof typeof ACTIVITY_REVIEW_LABEL] ?? '—' }] : []),
          ...(f.inicio ? [{ campo: 'Inicio', valor: fechaCorta(f.inicio) }] : []),
        ],
      })),
    };
  }

  /** Credenciales externas por decisión de Dirección: pendientes, observadas o decididas. */
  protected async revisiones(segmento: string): Promise<Resultado> {
    const estados = segmento === 'pendientes' ? ['requested']
      : segmento === 'observadas' ? ['observed']
        : ['approved', 'corroborated', 'rejected', 'inconclusive', 'not_corroborated'];
    const fecha = segmento === 'decididas' ? 'v.manual_reviewed_at' : 'v.manual_review_requested_at';
    // Se cuenta lo mismo que se lista: un registro de validación cuya credencial
    // ya no existe no es una credencial por revisar.
    const desde = `FROM validation_records v JOIN external_certificates x ON x.id = v.resource_id
                   WHERE v.resource_type = 'external_certificate' AND v.manual_review_status::text = ANY($1::text[])`;
    const [[c], filas] = await Promise.all([
      this.q(`SELECT COUNT(*) AS c ${desde}`, [estados]),
      this.q(`SELECT x.id, x.certificate_name, x.issuer, x.source, ${fecha} AS fecha, v.manual_review_status, v.status AS proceso,
                     u.first_name || ' ' || u.last_name AS estudiante, a.title AS actividad
                FROM validation_records v
                JOIN external_certificates x ON x.id = v.resource_id
                JOIN student_profiles p ON p.id = x.student_profile_id JOIN users u ON u.id = p.user_id
                LEFT JOIN activities a ON a.id = x.activity_id
               WHERE v.resource_type = 'external_certificate' AND v.manual_review_status::text = ANY($1::text[])
               ORDER BY ${fecha} DESC NULLS LAST, v.id DESC LIMIT ${MAX_FILAS}`, [estados]),
    ]);
    return {
      total: n(c?.c),
      filas: filas.map((f): FilaDetalle => ({
        id: f.id,
        titulo: f.certificate_name || 'Credencial sin nombre',
        detalle: [f.estudiante, f.issuer ? `Emisor: ${f.issuer}` : null].filter(Boolean).join(' · '),
        fecha: iso(f.fecha),
        estado: REVISION_CREDENCIAL[f.manual_review_status] ?? null,
        datos: [
          { campo: 'Origen', valor: f.source === 'opportunity' ? `Vinculada${f.actividad ? `: ${f.actividad}` : ''}` : 'Histórica' },
          ...(f.proceso ? [{ campo: 'Ayuda a la revisión', valor: PROCESO_CREDENCIAL[f.proceso] ?? '—' }] : []),
        ],
      })),
    };
  }

  /** Recursos: las últimas altas o las propuestas que esperan a Dirección. */
  protected async recursos(segmento: string): Promise<Resultado> {
    const donde = segmento === 'propuestas'
      ? `r.review_status = 'pending'`
      : `COALESCE(r.review_status, 'not_required') <> 'pending'`;
    const [[c], filas] = await Promise.all([
      this.q(`SELECT COUNT(*) AS c FROM learning_resources r WHERE ${donde}`),
      this.q(`SELECT r.id, r.title, r.status, r.review_status, r.provider, r.created_at,
                     u.first_name || ' ' || u.last_name AS creador, ro.name AS rol
                FROM learning_resources r LEFT JOIN users u ON u.id = r.created_by LEFT JOIN roles ro ON ro.id = u.role_id
               WHERE ${donde} ORDER BY r.created_at DESC, r.id DESC LIMIT ${MAX_FILAS}`),
    ]);
    return {
      total: n(c?.c),
      filas: filas.map((f): FilaDetalle => ({
        id: f.id,
        titulo: f.title,
        detalle: [f.creador ? `Creó: ${f.creador}${ROL[f.rol] ? ` (${ROL[f.rol]})` : ''}` : null, f.provider].filter(Boolean).join(' · ') || null,
        fecha: iso(f.created_at),
        estado: f.status === 'inactive' ? { texto: 'Retirado', tono: 'gray' } : PROPUESTA[f.review_status ?? 'not_required'] ?? null,
      })),
    };
  }

  /** H10: solo proyectos activos que el rol ve en la galería; nunca un borrador ni uno privado. */
  protected async proyectos(compartido: string): Promise<Resultado> {
    const [[c], filas] = await Promise.all([
      this.q(`SELECT COUNT(*) AS c FROM projects p WHERE ${compartido}`),
      this.q(`SELECT p.id, p.title, p.updated_at, u.first_name || ' ' || u.last_name AS responsable,
                     ARRAY(SELECT a.name FROM project_areas pa JOIN academic_areas a ON a.id = pa.academic_area_id WHERE pa.project_id = p.id ORDER BY a.name) AS areas,
                     ARRAY(SELECT s.name FROM project_skills ps JOIN skills s ON s.id = ps.skill_id WHERE ps.project_id = p.id ORDER BY s.name) AS tecnologias
                FROM projects p JOIN student_profiles sp ON sp.id = p.created_by_profile_id JOIN users u ON u.id = sp.user_id
               WHERE ${compartido}
               ORDER BY p.updated_at DESC, p.id DESC LIMIT ${MAX_FILAS}`),
    ]);
    return {
      total: n(c?.c),
      filas: filas.map((f): FilaDetalle => ({
        id: f.id,
        titulo: f.title,
        detalle: `Responsable: ${f.responsable}`,
        fecha: iso(f.updated_at),
        datos: [
          { campo: 'Áreas', valor: (f.areas ?? []).join(', ') || '—' },
          { campo: 'Tecnologías', valor: (f.tecnologias ?? []).slice(0, 6).join(', ') || '—' },
        ],
      })),
    };
  }

  protected async concesiones(): Promise<Resultado> {
    const [[c], filas] = await Promise.all([
      this.q(`SELECT COUNT(*) AS c FROM gamification_events WHERE points > 0`),
      this.q(`SELECT e.id, e.points, e.reason, e.trigger, e.occurred_at, g.name AS criterio,
                     u.first_name || ' ' || u.last_name AS estudiante
                FROM gamification_events e
                JOIN student_profiles p ON p.id = e.student_profile_id JOIN users u ON u.id = p.user_id
                LEFT JOIN gamification_criteria g ON g.id = e.criterion_id
               WHERE e.points > 0 ORDER BY e.occurred_at DESC, e.id DESC LIMIT ${MAX_FILAS}`),
    ]);
    return {
      total: n(c?.c),
      filas: filas.map((f): FilaDetalle => ({
        id: f.id,
        titulo: `${f.estudiante}: +${n(f.points)} puntos`,
        detalle: f.criterio ?? GAMIFICATION_TRIGGER_LABEL[f.trigger] ?? null,
        fecha: iso(f.occurred_at),
        estado: { texto: 'Otorgados', tono: 'green' },
        datos: f.reason ? [{ campo: 'Motivo', valor: String(f.reason).slice(0, 140) }] : [],
      })),
    };
  }

  protected async propuestasDePuntos(): Promise<Resultado> {
    const [[c], filas] = await Promise.all([
      this.q(`SELECT COUNT(*) AS c FROM gamification_proposals WHERE status = 'pending'`),
      this.q(`SELECT gp.id, gp.reason, gp.created_at, g.name AS criterio, g.points,
                     u.first_name || ' ' || u.last_name AS estudiante, d.first_name || ' ' || d.last_name AS propone
                FROM gamification_proposals gp
                JOIN student_profiles p ON p.id = gp.student_profile_id JOIN users u ON u.id = p.user_id
                LEFT JOIN users d ON d.id = gp.proposed_by
                LEFT JOIN gamification_criteria g ON g.id = gp.criterion_id
               WHERE gp.status = 'pending' ORDER BY gp.created_at DESC, gp.id DESC LIMIT ${MAX_FILAS}`),
    ]);
    return {
      total: n(c?.c),
      filas: filas.map((f): FilaDetalle => ({
        id: f.id,
        titulo: `${f.estudiante}${f.points ? `: +${n(f.points)} puntos` : ''}`,
        detalle: [f.criterio, f.propone ? `Propone: ${f.propone}` : null].filter(Boolean).join(' · ') || null,
        fecha: iso(f.created_at),
        estado: PROPUESTA.pending,
        datos: f.reason ? [{ campo: 'Motivo', valor: String(f.reason).slice(0, 140) }] : [],
      })),
    };
  }
}
