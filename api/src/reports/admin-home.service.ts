import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { DataSource } from 'typeorm';
import { GAMIFICATION_TRIGGER_LABEL, RolNombre } from '@perfil/shared';
import { AUDIT_ENTITY_LABEL, AUDIT_EVENT_LABEL, AUDIT_MODULE_LABEL } from '../audit/audit-labels';
import {
  ConsultasDeInicio, ESTADO_CUENTA, MAX_FILAS, PROCESO_CREDENCIAL, PROYECTO_COMPARTIDO_ADMIN, REVISION_CREDENCIAL, ROL,
  TIPO_ACTIVIDAD, fechaCorta, iso, n, type DetalleTarjeta, type FilaDetalle, type Resultado, type Tono,
} from './inicio-consultas';

export type { DetalleTarjeta, FilaDetalle, Tono } from './inicio-consultas';

/**
 * V7.1 §3 · Inicio de Administración: tarjetas con «Detalles».
 *
 * Cada tarjeta tiene un resumen (sus totales reales) y uno o más conjuntos
 * («segmentos») que el modal de solo lectura lista: los últimos 10 de ese
 * conjunto, ordenados por la fecha que le corresponde y con desempate por ID,
 * más el total real del mismo conjunto. Las consultas cuentan filas de la
 * tabla principal (`COUNT(*)` o `COUNT(DISTINCT …)`), nunca filas de un join.
 *
 * Aquí no hay ninguna mutación: aprobar, reenviar o dar de baja se hace en el
 * módulo correspondiente, al que la web lleva con el filtro aplicado. Tampoco
 * salen correos completos de terceros fuera de la tarjeta de cuentas, ni
 * tokens, ni metadatos de auditoría, ni archivos.
 */

const IMPORTACION: Record<string, { texto: string; tono: Tono }> = {
  applied: { texto: 'Aplicada', tono: 'green' },
  failed: { texto: 'Falló', tono: 'red' },
  discarded: { texto: 'Descartada', tono: 'gray' },
  previewed: { texto: 'Analizada, sin aplicar', tono: 'gray' },
};
const TIPO_IMPORTACION: Record<string, string> = { students: 'Estudiantes', teachers: 'Docentes' };
const MODO_CERTIFICADO: Record<string, string> = { general: 'General (un archivo común)', individual: 'Individual (uno por estudiante)' };

/** Las actividades que Administración puede ver: un borrador ajeno solo desde que se envió a revisión (V3.2 §24). */
const VISIBLE_PARA_ADMIN = `(a.status <> 'draft' OR a.creator_id = $1 OR (a.requires_review AND a.review_status IS NOT NULL))`;

/** El conjunto de cada tarjeta, para validar la ruta antes de consultar. */
export const SEGMENTOS: Record<string, readonly string[]> = {
  cuentas: ['pendientes'],
  roles: Object.values(RolNombre),
  padron: ['aplicadas'],
  auditoria: ['recientes'],
  catalogo: ['areas', 'tecnologias'],
  pedidos: ['pendientes'],
  categorias: ['recientes'],
  revision: ['academica', 'extracurricular', 'externa'],
  academicas: ['recientes', 'revision', 'entrega'],
  extracurriculares: ['recientes', 'revision', 'entrega'],
  externas: ['recientes', 'revision', 'cobertura', 'vinculadas', 'historicas'],
  credenciales: ['pendientes', 'observadas', 'decididas'],
  recursos: ['recientes', 'propuestas'],
  puntos: ['concesiones', 'propuestas'],
  gamificacion: ['criterios', 'extras'],
  proyectos: ['recientes'],
};

const ESTADOS_DE_ROL = ['todas', 'active', 'pending_activation'] as const;

@Injectable()
export class AdminHomeService extends ConsultasDeInicio {
  protected readonly logger = new Logger(AdminHomeService.name);
  protected readonly inicio = 'Inicio de Administración';

  constructor(dataSource: DataSource) {
    super(dataSource);
  }

  /** §3.1 (H13): cada tarjeta por separado; una que falla no apaga a las demás. */
  async resumen(adminId: string) {
    const tarjetas: Record<string, () => Promise<Record<string, unknown>>> = {
      cuentas: async () => ({ total: n((await this.q(`SELECT COUNT(*) AS c FROM users WHERE status = 'pending_activation'`))[0]?.c) }),
      roles: async () => {
        const filas = await this.q(`SELECT r.name AS role, u.status, COUNT(*)::int AS c FROM users u JOIN roles r ON r.id = u.role_id GROUP BY r.name, u.status`);
        const roles = Object.values(RolNombre).map((role) => {
          const de = filas.filter((f) => f.role === role);
          return {
            role,
            label: ROL[role],
            total: de.reduce((a, f) => a + n(f.c), 0),
            active: n(de.find((f) => f.status === 'active')?.c),
            pendingActivation: n(de.find((f) => f.status === 'pending_activation')?.c),
          };
        });
        return { total: roles.reduce((a, r) => a + r.total, 0), roles };
      },
      padron: async () => {
        const [c] = await this.q(`SELECT COUNT(*) FILTER (WHERE status = 'applied') AS aplicadas, MAX(applied_at) AS ultima FROM import_batches`);
        return { total: n(c?.aplicadas), ultima: iso(c?.ultima) };
      },
      auditoria: async () => ({ total: n((await this.q(`SELECT COUNT(*) AS c FROM audit_events WHERE created_at >= now() - interval '7 days'`))[0]?.c) }),
      catalogo: async () => {
        const [c] = await this.q(`SELECT (SELECT COUNT(*) FROM academic_areas WHERE is_active) AS areas, (SELECT COUNT(*) FROM skills WHERE is_active) AS tecnologias`);
        return { total: n(c?.areas) + n(c?.tecnologias), areas: n(c?.areas), tecnologias: n(c?.tecnologias) };
      },
      pedidos: async () => ({ total: n((await this.q(`SELECT COUNT(*) AS c FROM skill_requests WHERE status = 'pending'`))[0]?.c) }),
      categorias: async () => ({ total: n((await this.q(`SELECT COUNT(*) AS c FROM activity_categories WHERE is_active`))[0]?.c) }),
      revision: async () => {
        const filas = await this.q(`SELECT CASE WHEN a.origin_type = 'external' THEN 'externa' ELSE a.type::text END AS k, COUNT(*) AS c
                                      FROM activities a WHERE a.review_status = 'pending' GROUP BY 1`);
        const de = (k: string) => n(filas.find((f) => f.k === k)?.c);
        return { total: de('academica') + de('extracurricular') + de('externa'), academica: de('academica'), extracurricular: de('extracurricular'), externa: de('externa') };
      },
      academicas: () => this.resumenInterna('academica', adminId),
      extracurriculares: () => this.resumenInterna('extracurricular', adminId),
      externas: async () => {
        const [c] = await this.q(`SELECT COUNT(*) AS total, COUNT(*) FILTER (WHERE a.review_status = 'pending') AS revision
                                    FROM activities a WHERE a.origin_type = 'external' AND ${VISIBLE_PARA_ADMIN}`, [adminId]);
        const [k] = await this.q(`SELECT COUNT(*) FILTER (WHERE c.source = 'opportunity') AS vinculadas, COUNT(*) FILTER (WHERE c.source = 'historical_external') AS historicas FROM external_certificates c`);
        return { total: n(c?.total), revision: n(c?.revision), vinculadas: n(k?.vinculadas), historicas: n(k?.historicas) };
      },
      credenciales: async () => {
        const [c] = await this.q(`SELECT COUNT(*) FILTER (WHERE v.manual_review_status = 'requested') AS pendientes,
                                         COUNT(*) FILTER (WHERE v.manual_review_status = 'observed') AS observadas
                                    FROM validation_records v JOIN external_certificates x ON x.id = v.resource_id
                                   WHERE v.resource_type = 'external_certificate'`);
        return { total: n(c?.pendientes), observadas: n(c?.observadas) };
      },
      recursos: async () => {
        const [c] = await this.q(`SELECT COUNT(*) FILTER (WHERE status = 'active' AND COALESCE(review_status, 'not_required') IN ('not_required', 'approved')) AS publicados,
                                         COUNT(*) FILTER (WHERE review_status = 'pending') AS propuestas FROM learning_resources`);
        return { total: n(c?.publicados), propuestas: n(c?.propuestas) };
      },
      puntos: async () => {
        const [c] = await this.q(`SELECT (SELECT COUNT(*) FROM gamification_events WHERE points > 0) AS concesiones,
                                         (SELECT COUNT(*) FROM gamification_proposals WHERE status = 'pending') AS propuestas`);
        return { total: n(c?.concesiones), propuestas: n(c?.propuestas) };
      },
      gamificacion: async () => {
        const [c] = await this.q(`SELECT COUNT(*) FILTER (WHERE NOT is_bonus) AS criterios,
                                         COUNT(*) FILTER (WHERE is_bonus AND ${EXTRA_VIGENTE}) AS extras
                                    FROM gamification_criteria WHERE is_active`);
        return { total: n(c?.criterios), extras: n(c?.extras) };
      },
      proyectos: async () => ({ total: n((await this.q(`SELECT COUNT(*) AS c FROM projects p WHERE ${PROYECTO_COMPARTIDO_ADMIN}`))[0]?.c) }),
    };
    return this.calcularTarjetas(tarjetas);
  }


  private async resumenInterna(tipo: string, adminId: string) {
    const [c] = await this.q(`SELECT COUNT(*) AS total,
                                     COUNT(*) FILTER (WHERE a.review_status = 'pending') AS revision,
                                     COUNT(*) FILTER (WHERE a.outcome_policy = 'institution_issued_certificate' AND a.status <> 'cancelled') AS entrega
                                FROM activities a WHERE a.origin_type = 'internal' AND a.type = $2 AND ${VISIBLE_PARA_ADMIN}`, [adminId, tipo]);
    return { total: n(c?.total), revision: n(c?.revision), entrega: n(c?.entrega) };
  }

  /** El modal: total real del conjunto y sus últimos 10. */
  async detalle(adminId: string, tarjeta: string, segmento: string, estado?: string): Promise<DetalleTarjeta> {
    return this.detalleDe(SEGMENTOS, tarjeta, segmento, () => this.consultar(adminId, tarjeta, segmento, estado));
  }

  private async consultar(adminId: string, tarjeta: string, segmento: string, estado?: string): Promise<Resultado> {
    switch (tarjeta) {
      case 'cuentas': return this.cuentas(`u.status = 'pending_activation'`, []);
      case 'roles': {
        const e = (ESTADOS_DE_ROL as readonly string[]).includes(estado ?? '') ? estado! : 'todas';
        return e === 'todas'
          ? this.cuentas(`r.name = $1`, [segmento])
          : this.cuentas(`r.name = $1 AND u.status = $2`, [segmento, e]);
      }
      case 'padron': return this.padron();
      case 'auditoria': return this.auditoria();
      case 'catalogo': return segmento === 'areas' ? this.areas() : this.tecnologias();
      case 'pedidos': return this.pedidos();
      case 'categorias': return this.categorias();
      case 'revision':
        return segmento === 'externa'
          ? this.act(adminId, `a.origin_type = 'external' AND a.review_status = 'pending'`, [], 'COALESCE(a.submitted_at, a.created_at)')
          : this.act(adminId, `a.origin_type = 'internal' AND a.type = $2 AND a.review_status = 'pending'`, [segmento], 'COALESCE(a.submitted_at, a.created_at)');
      case 'academicas':
      case 'extracurriculares': {
        const tipo = tarjeta === 'academicas' ? 'academica' : 'extracurricular';
        if (segmento === 'entrega') return this.entrega(adminId, tipo);
        if (segmento === 'revision') {
          return this.act(adminId, `a.origin_type = 'internal' AND a.type = $2 AND a.review_status = 'pending'`, [tipo], 'COALESCE(a.submitted_at, a.created_at)');
        }
        return this.act(adminId, `a.origin_type = 'internal' AND a.type = $2`, [tipo], 'a.created_at');
      }
      case 'externas':
        if (segmento === 'cobertura') return this.cobertura(adminId);
        if (segmento === 'vinculadas' || segmento === 'historicas') return this.credencialesExternas(segmento);
        if (segmento === 'revision') {
          return this.act(adminId, `a.origin_type = 'external' AND a.review_status = 'pending'`, [], 'COALESCE(a.submitted_at, a.created_at)');
        }
        return this.act(adminId, `a.origin_type = 'external'`, [], 'a.created_at');
      case 'credenciales': return this.revisiones(segmento);
      case 'recursos': return this.recursos(segmento);
      case 'puntos': return segmento === 'propuestas' ? this.propuestasDePuntos() : this.concesiones();
      case 'gamificacion': return this.criterios(segmento === 'extras');
      case 'proyectos': return this.proyectos(PROYECTO_COMPARTIDO_ADMIN);
      default: throw new NotFoundException('Ese resumen no existe.');
    }
  }

  // ---------- Identidad ----------

  /** A01 / A02: nombre, rol, correo institucional, alta y estado. Sin tokens ni códigos. */
  private async cuentas(donde: string, params: unknown[]) {
    const desde = `FROM users u JOIN roles r ON r.id = u.role_id WHERE ${donde}`;
    const [[c], filas] = await Promise.all([
      this.q(`SELECT COUNT(*) AS c ${desde}`, params),
      this.q(`SELECT u.id, u.first_name, u.last_name, u.email, u.status, u.semester, u.created_at, r.name AS role
                ${desde} ORDER BY u.created_at DESC, u.id DESC LIMIT ${MAX_FILAS}`, params),
    ]);
    return {
      total: n(c?.c),
      filas: filas.map((f): FilaDetalle => ({
        id: f.id,
        titulo: `${f.first_name} ${f.last_name}`.trim(),
        detalle: f.email,
        fecha: iso(f.created_at),
        estado: ESTADO_CUENTA[f.status] ?? null,
        datos: [
          { campo: 'Rol', valor: ROL[f.role] ?? 'Sin rol' },
          ...(f.role === RolNombre.STUDENT && f.semester ? [{ campo: 'Semestre', valor: `${f.semester}.º` }] : []),
        ],
      })),
    };
  }

  /** A03 (D07): solo el resumen guardado; el archivo original no se conserva. */
  private async padron() {
    const [[c], filas] = await Promise.all([
      this.q(`SELECT COUNT(*) AS c FROM import_batches WHERE status = 'applied'`),
      this.q(`SELECT b.id, b.original_filename, b.kind, b.status, b.counts, b.total_rows, b.applied_at, b.created_at,
                     u.first_name || ' ' || u.last_name AS autor
                FROM import_batches b LEFT JOIN users u ON u.id = b.imported_by_user_id
               WHERE b.status = 'applied'
               ORDER BY COALESCE(b.applied_at, b.created_at) DESC, b.id DESC LIMIT ${MAX_FILAS}`),
    ]);
    const cuenta = (o: Record<string, unknown> | null, clave: string) => String(n(o?.[clave]));
    return {
      total: n(c?.c),
      nota: 'Afinia procesa el padrón en memoria: guarda el resumen de cada importación, no el archivo original. No hay descarga del original.',
      filas: filas.map((f): FilaDetalle => ({
        id: f.id,
        titulo: f.original_filename || 'Padrón sin nombre',
        detalle: f.autor ? `Importó: ${f.autor}` : null,
        fecha: iso(f.applied_at ?? f.created_at),
        estado: IMPORTACION[f.status] ?? null,
        datos: [
          { campo: 'Padrón de', valor: TIPO_IMPORTACION[f.kind] ?? 'Estudiantes' },
          { campo: 'Filas', valor: String(n(f.total_rows)) },
          { campo: 'Nuevas', valor: cuenta(f.counts, 'new') },
          { campo: 'Actualizadas', valor: cuenta(f.counts, 'update') },
          { campo: 'Sin cambios', valor: cuenta(f.counts, 'unchanged') },
          { campo: 'Conflictos', valor: cuenta(f.counts, 'conflict') },
          { campo: 'Con errores', valor: cuenta(f.counts, 'invalid') },
        ],
      })),
    };
  }

  /** A04: fecha, actor, acción y objetivo, sin metadatos (pueden traer datos sensibles). */
  private async auditoria() {
    const desde = `FROM audit_events e WHERE e.created_at >= now() - interval '7 days'`;
    const [[c], filas] = await Promise.all([
      this.q(`SELECT COUNT(*) AS c ${desde}`),
      this.q(`SELECT e.id, e.event_type, e.entity_type, e.created_at, u.first_name || ' ' || u.last_name AS actor, r.name AS rol
                FROM audit_events e LEFT JOIN users u ON u.id = e.actor_user_id LEFT JOIN roles r ON r.id = u.role_id
               WHERE e.created_at >= now() - interval '7 days'
               ORDER BY e.created_at DESC, e.id DESC LIMIT ${MAX_FILAS}`),
    ]);
    return {
      total: n(c?.c),
      nota: 'Eventos de los últimos 7 días.',
      filas: filas.map((f): FilaDetalle => {
        const etiqueta = AUDIT_EVENT_LABEL[f.event_type];
        return {
          id: f.id,
          titulo: etiqueta?.accion ?? 'Otra acción del sistema',
          detalle: f.actor ? `${f.actor} · ${ROL[f.rol] ?? ''}`.replace(/ · $/, '') : 'El sistema',
          fecha: iso(f.created_at),
          datos: [
            ...(etiqueta ? [{ campo: 'Módulo', valor: AUDIT_MODULE_LABEL[etiqueta.modulo] }] : []),
            ...(f.entity_type ? [{ campo: 'Sobre', valor: AUDIT_ENTITY_LABEL[f.entity_type] ?? 'Otro registro' }] : []),
          ],
        };
      }),
    };
  }

  // ---------- Catálogos ----------

  private async areas() {
    const [[c], filas] = await Promise.all([
      this.q(`SELECT COUNT(*) AS c FROM academic_areas`),
      this.q(`SELECT id, name, is_active, created_at FROM academic_areas ORDER BY created_at DESC, id DESC LIMIT ${MAX_FILAS}`),
    ]);
    return {
      total: n(c?.c),
      filas: filas.map((f): FilaDetalle => ({
        id: f.id, titulo: f.name, fecha: iso(f.created_at),
        estado: f.is_active ? { texto: 'Vigente', tono: 'green' } : { texto: 'Dada de baja', tono: 'gray' },
      })),
    };
  }

  private async tecnologias() {
    const [[c], filas] = await Promise.all([
      this.q(`SELECT COUNT(*) AS c FROM skills`),
      this.q(`SELECT s.id, s.name, s.is_active, s.created_at, a.name AS area
                FROM skills s LEFT JOIN academic_areas a ON a.id = s.academic_area_id
               ORDER BY s.created_at DESC, s.id DESC LIMIT ${MAX_FILAS}`),
    ]);
    return {
      total: n(c?.c),
      filas: filas.map((f): FilaDetalle => ({
        id: f.id, titulo: f.name, detalle: f.area ? `Área: ${f.area}` : 'Sin área', fecha: iso(f.created_at),
        estado: f.is_active ? { texto: 'Vigente', tono: 'green' } : { texto: 'Dada de baja', tono: 'gray' },
      })),
    };
  }

  /** A06: solo los pedidos sin decidir. */
  private async pedidos() {
    const [[c], filas] = await Promise.all([
      this.q(`SELECT COUNT(*) AS c FROM skill_requests WHERE status = 'pending'`),
      this.q(`SELECT s.id, s.name, s.created_at, u.first_name || ' ' || u.last_name AS quien, r.name AS rol
                FROM skill_requests s LEFT JOIN users u ON u.id = s.requested_by LEFT JOIN roles r ON r.id = u.role_id
               WHERE s.status = 'pending' ORDER BY s.created_at DESC, s.id DESC LIMIT ${MAX_FILAS}`),
    ]);
    return {
      total: n(c?.c),
      filas: filas.map((f): FilaDetalle => ({
        id: f.id, titulo: f.name, detalle: f.quien ? `Pidió: ${f.quien}${ROL[f.rol] ? ` (${ROL[f.rol]})` : ''}` : null,
        fecha: iso(f.created_at), estado: { texto: 'Sin decidir', tono: 'amber' },
      })),
    };
  }

  private async categorias() {
    const [[c], filas] = await Promise.all([
      this.q(`SELECT COUNT(*) AS c FROM activity_categories`),
      this.q(`SELECT id, name, applies_to, is_active, created_at FROM activity_categories ORDER BY created_at DESC, id DESC LIMIT ${MAX_FILAS}`),
    ]);
    return {
      total: n(c?.c),
      filas: filas.map((f): FilaDetalle => ({
        id: f.id, titulo: f.name, detalle: f.applies_to ? `Para actividades ${TIPO_ACTIVIDAD[f.applies_to]?.toLowerCase() ?? ''}s` : 'Para cualquier actividad',
        fecha: iso(f.created_at),
        estado: f.is_active ? { texto: 'Vigente', tono: 'green' } : { texto: 'Dada de baja', tono: 'gray' },
      })),
    };
  }

  // ---------- Gestión: actividades ----------

  /** Las actividades que ve Administración (V3.2 §24), con el mismo formato de fila que Dirección. */
  private act(adminId: string, donde: string, params: unknown[], orden: string): Promise<Resultado> {
    return this.actividades(adminId, donde, params, orden, VISIBLE_PARA_ADMIN);
  }

  /**
   * A08/A09, tercera vista (§3.2, H06): entrega del documento institucional.
   * Destinatarios y archivos se cuentan aparte: un archivo común entregado a 8
   * son 8 destinatarios y 1 archivo. Los pendientes son asistentes
   * confirmados sin entrega registrada (D07), no una obligación del emisor.
   */
  private async entrega(adminId: string, tipo: string) {
    const donde = `a.origin_type = 'internal' AND a.type = $2 AND a.outcome_policy = 'institution_issued_certificate' AND a.status <> 'cancelled'`;
    const [[c], filas] = await Promise.all([
      this.q(`SELECT COUNT(*) AS c FROM activities a WHERE ${donde} AND ${VISIBLE_PARA_ADMIN}`, [adminId, tipo]),
      this.q(`SELECT a.id, a.title, a.status, a.certificate_mode, a.event_date, COALESCE(a.end_at, a.event_date) AS fecha,
                     (SELECT COUNT(DISTINCT r.student_profile_id) FROM activity_registrations r
                       WHERE r.activity_id = a.id AND r.status = 'confirmed') AS confirmados,
                     (SELECT COUNT(DISTINCT k.student_profile_id) FROM internal_constancies k
                       WHERE k.activity_id = a.id AND k.kind = 'institution_certificate' AND k.status = 'authorized') AS destinatarios,
                     (SELECT COUNT(DISTINCT k.stored_file_id) FROM internal_constancies k
                       WHERE k.activity_id = a.id AND k.kind = 'institution_certificate' AND k.status = 'authorized') AS archivos,
                     (SELECT COUNT(DISTINCT r.student_profile_id) FROM activity_registrations r
                       WHERE r.activity_id = a.id AND r.status = 'confirmed'
                         AND NOT EXISTS (SELECT 1 FROM internal_constancies k WHERE k.activity_id = a.id
                                           AND k.student_profile_id = r.student_profile_id
                                           AND k.kind = 'institution_certificate' AND k.status = 'authorized')) AS pendientes
                FROM activities a WHERE ${donde} AND ${VISIBLE_PARA_ADMIN}
               ORDER BY COALESCE(a.end_at, a.event_date) DESC NULLS LAST, a.id DESC LIMIT ${MAX_FILAS}`, [adminId, tipo]),
    ]);
    return {
      total: n(c?.c),
      nota: 'Solo actividades que entregan un documento institucional. Destinatarios y archivos se cuentan por separado; «sin entrega» son asistentes confirmados que aún no lo tienen.',
      filas: filas.map((f): FilaDetalle => {
        const pendientes = n(f.pendientes);
        const confirmados = n(f.confirmados);
        return {
          id: f.id,
          actividadId: f.id,
          titulo: f.title,
          detalle: MODO_CERTIFICADO[f.certificate_mode] ?? 'Entrega manual del responsable',
          fecha: iso(f.fecha),
          estado: confirmados === 0
            ? { texto: 'Sin asistentes confirmados', tono: 'gray' }
            : pendientes === 0
              ? { texto: 'Todos los confirmados lo recibieron', tono: 'green' }
              : { texto: `${pendientes} sin entrega`, tono: 'amber' },
          datos: [
            { campo: 'Asistentes confirmados', valor: String(confirmados) },
            { campo: 'Destinatarios con documento', valor: String(n(f.destinatarios)) },
            { campo: 'Archivos distintos', valor: String(n(f.archivos)) },
            { campo: 'Sin entrega', valor: String(pendientes) },
          ],
        };
      }),
    };
  }

  /**
   * A10 (H07): cobertura de credenciales por oportunidad externa. Pendiente
   * no es aprobada; nada se rotula «verificado» antes de la decisión de Dirección.
   */
  private async cobertura(adminId: string) {
    const donde = `a.origin_type = 'external' AND a.status <> 'cancelled'`;
    const [[c], filas] = await Promise.all([
      this.q(`SELECT COUNT(*) AS c FROM activities a WHERE ${donde} AND ${VISIBLE_PARA_ADMIN}`, [adminId]),
      this.q(`SELECT a.id, a.title, a.provider, GREATEST(a.created_at, COALESCE(k.ultima, a.created_at)) AS fecha,
                     (SELECT COUNT(DISTINCT r.student_profile_id) FROM activity_registrations r
                       WHERE r.activity_id = a.id AND r.status = 'accepted') AS admitidos,
                     k.registradas, k.pendientes, k.aprobadas, k.observadas, k.rechazadas,
                     (SELECT COUNT(DISTINCT r.student_profile_id) FROM activity_registrations r
                       WHERE r.activity_id = a.id AND r.status = 'accepted'
                         AND NOT EXISTS (SELECT 1 FROM external_certificates x WHERE x.activity_id = a.id AND x.student_profile_id = r.student_profile_id)) AS sin_registro
                FROM activities a
                LEFT JOIN LATERAL (
                  SELECT COUNT(DISTINCT x.id) AS registradas, MAX(x.created_at) AS ultima,
                         COUNT(DISTINCT x.id) FILTER (WHERE v.manual_review_status = 'requested'
                                                         OR (v.manual_review_status IS NULL AND v.status IN ('pending', 'processing'))) AS pendientes,
                         COUNT(DISTINCT x.id) FILTER (WHERE v.manual_review_status IN ('approved', 'corroborated')) AS aprobadas,
                         COUNT(DISTINCT x.id) FILTER (WHERE v.manual_review_status = 'observed') AS observadas,
                         COUNT(DISTINCT x.id) FILTER (WHERE v.manual_review_status = 'rejected') AS rechazadas
                    FROM external_certificates x
                    LEFT JOIN validation_records v ON v.resource_id = x.id AND v.resource_type = 'external_certificate'
                   WHERE x.activity_id = a.id) k ON true
               WHERE ${donde} AND ${VISIBLE_PARA_ADMIN}
               ORDER BY GREATEST(a.created_at, COALESCE(k.ultima, a.created_at)) DESC, a.id DESC LIMIT ${MAX_FILAS}`, [adminId]),
    ]);
    return {
      total: n(c?.c),
      nota: 'Por oportunidad externa, primero las de movimiento más reciente (creación o última credencial). «Pendientes» esperan la decisión de Dirección y no cuentan como aprobadas. Las históricas, sin oportunidad, están en su propia vista.',
      filas: filas.map((f): FilaDetalle => ({
        id: f.id,
        actividadId: f.id,
        titulo: f.title,
        detalle: f.provider ? `Proveedor: ${f.provider}` : null,
        fecha: iso(f.fecha),
        estado: n(f.pendientes) > 0 ? { texto: `${n(f.pendientes)} por revisar`, tono: 'amber' } : null,
        datos: [
          { campo: 'Admitidos por el proveedor', valor: String(n(f.admitidos)) },
          { campo: 'Credenciales registradas', valor: String(n(f.registradas)) },
          { campo: 'Pendientes de revisión', valor: String(n(f.pendientes)) },
          { campo: 'Aprobadas', valor: String(n(f.aprobadas)) },
          { campo: 'Observadas o rechazadas', valor: String(n(f.observadas) + n(f.rechazadas)) },
          { campo: 'Admitidos sin registro', valor: String(n(f.sin_registro)) },
        ],
      })),
    };
  }

  /** A10: últimas credenciales vinculadas o históricas, con su estado humano. */
  private async credencialesExternas(segmento: 'vinculadas' | 'historicas') {
    const fuente = segmento === 'vinculadas' ? 'opportunity' : 'historical_external';
    const [[c], filas] = await Promise.all([
      this.q(`SELECT COUNT(*) AS c FROM external_certificates WHERE source = $1`, [fuente]),
      this.q(`SELECT x.id, x.certificate_name, x.issuer, x.created_at, a.title AS actividad,
                     u.first_name || ' ' || u.last_name AS estudiante, v.manual_review_status, v.status AS proceso
                FROM external_certificates x
                JOIN student_profiles p ON p.id = x.student_profile_id JOIN users u ON u.id = p.user_id
                LEFT JOIN activities a ON a.id = x.activity_id
                LEFT JOIN validation_records v ON v.resource_id = x.id AND v.resource_type = 'external_certificate'
               WHERE x.source = $1 ORDER BY x.created_at DESC, x.id DESC LIMIT ${MAX_FILAS}`, [fuente]),
    ]);
    return {
      total: n(c?.c),
      filas: filas.map((f): FilaDetalle => ({
        id: f.id,
        titulo: f.certificate_name || 'Credencial sin nombre',
        detalle: [f.estudiante, f.issuer ? `Emisor: ${f.issuer}` : null, f.actividad ? `Oportunidad: ${f.actividad}` : null].filter(Boolean).join(' · '),
        fecha: iso(f.created_at),
        estado: REVISION_CREDENCIAL[f.manual_review_status] ?? { texto: 'Sin decisión de Dirección', tono: 'gray' },
        datos: f.proceso ? [{ campo: 'Ayuda a la revisión', valor: PROCESO_CREDENCIAL[f.proceso] ?? '—' }] : [],
      })),
    };
  }

  // ---------- Seguimiento ----------

  /** A14 (H09): criterios vigentes y extras de temporada vigentes hoy (Bolivia). */
  private async criterios(extras: boolean) {
    const donde = extras ? `is_active AND is_bonus AND ${EXTRA_VIGENTE}` : `is_active AND NOT is_bonus`;
    const [[c], filas] = await Promise.all([
      this.q(`SELECT COUNT(*) AS c FROM gamification_criteria WHERE ${donde}`),
      this.q(`SELECT id, name, points, trigger, to_char(valid_from, 'YYYY-MM-DD') AS valid_from, to_char(valid_until, 'YYYY-MM-DD') AS valid_until, created_at FROM gamification_criteria
               WHERE ${donde} ORDER BY created_at DESC, id DESC LIMIT ${MAX_FILAS}`),
    ]);
    return {
      total: n(c?.c),
      nota: extras ? 'Extras de temporada con vigencia hoy. Si no hay, no hay temporada activa.' : 'Puntos que se ganan por cada hecho, mientras el criterio esté vigente.',
      filas: filas.map((f): FilaDetalle => ({
        id: f.id,
        titulo: `${f.name}: ${n(f.points)} puntos`,
        detalle: GAMIFICATION_TRIGGER_LABEL[f.trigger] ? `Familia: ${GAMIFICATION_TRIGGER_LABEL[f.trigger]}` : null,
        fecha: iso(f.created_at),
        estado: { texto: 'Vigente', tono: 'green' },
        datos: extras || f.valid_from || f.valid_until
          ? [{ campo: 'Desde', valor: fechaCorta(f.valid_from) }, { campo: 'Hasta', valor: f.valid_until ? fechaCorta(f.valid_until) : 'Sin fecha de fin' }]
          : [],
      })),
    };
  }
}

/** Extra de temporada vigente hoy en Bolivia (mismo criterio que `GamificationService`). */
const EXTRA_VIGENTE = `(valid_from IS NULL OR valid_from <= (now() AT TIME ZONE 'America/La_Paz')::date)
                       AND (valid_until IS NULL OR valid_until >= (now() AT TIME ZONE 'America/La_Paz')::date)`;

