/**
 * V3.2 §59 (C13) · Auditoría legible para una persona.
 *
 * El registro guarda códigos estables (`ACTIVITY_APPROVED`, `user`) y
 * metadatos técnicos. Aquí se traducen a lo que la Administración necesita
 * leer: quién (actor), en qué módulo, qué acción, cuándo y con qué resultado.
 * El código sigue disponible para quien lo necesite, pero ya no es lo primero
 * que se ve.
 */

export type AuditModule =
  | 'cuentas' | 'importacion' | 'perfil' | 'actividades' | 'credenciales' | 'proyectos'
  | 'recomendaciones' | 'afinidad' | 'catalogo' | 'colaboracion' | 'archivos' | 'ia' | 'configuracion' | 'curriculo';

export const AUDIT_MODULE_LABEL: Record<AuditModule, string> = {
  cuentas: 'Cuentas y acceso',
  importacion: 'Importación de padrón',
  perfil: 'Perfil del estudiante',
  actividades: 'Actividades',
  credenciales: 'Credenciales externas',
  proyectos: 'Proyectos',
  recomendaciones: 'Recomendaciones',
  afinidad: 'Afinidad',
  catalogo: 'Catálogo',
  colaboracion: 'Colaboración y equipos',
  archivos: 'Archivos y evidencias',
  ia: 'Asistente de IA',
  configuracion: 'Configuración',
  curriculo: 'Currículo',
};

export type AuditResult = 'correcto' | 'rechazado' | 'cancelado' | 'moderado';

export const AUDIT_RESULT_LABEL: Record<AuditResult, string> = {
  correcto: 'Correcto',
  rechazado: 'Rechazado',
  cancelado: 'Cancelado',
  moderado: 'Moderado',
};

/** Módulo, acción en español y resultado de cada tipo de evento. */
export const AUDIT_EVENT_LABEL: Record<string, { modulo: AuditModule; accion: string; resultado?: AuditResult }> = {
  USER_PROVISIONED: { modulo: 'cuentas', accion: 'Alta de cuenta' },
  USER_ROLE_CHANGED: { modulo: 'cuentas', accion: 'Cambio de rol' },
  USER_STATUS_CHANGED: { modulo: 'cuentas', accion: 'Cambio de estado de la cuenta' },
  TEACHER_SCOPE_CHANGED: { modulo: 'cuentas', accion: 'Cambio de semestres del docente' },
  ACCOUNT_ACTIVATED: { modulo: 'cuentas', accion: 'Cuenta activada' },
  ACTIVATION_REQUESTED: { modulo: 'cuentas', accion: 'Pedido de activación' },
  PASSWORD_RESET_REQUESTED: { modulo: 'cuentas', accion: 'Pedido de nueva contraseña' },
  PASSWORD_CHANGED: { modulo: 'cuentas', accion: 'Cambio de contraseña' },
  SESSION_REVOKED: { modulo: 'cuentas', accion: 'Sesión cerrada' },
  ALL_SESSIONS_REVOKED: { modulo: 'cuentas', accion: 'Todas las sesiones cerradas' },
  IMPORT_PREVIEWED: { modulo: 'importacion', accion: 'Previsualización (histórico)' },
  IMPORT_APPLIED: { modulo: 'importacion', accion: 'Importación aplicada' },
  ONBOARDING_COMPLETED: { modulo: 'perfil', accion: 'Bienvenida completada' },
  ONBOARDING_CONFIRMED: { modulo: 'perfil', accion: 'Orientación confirmada' },
  INSTITUTIONAL_DATA_CHANGED: { modulo: 'perfil', accion: 'Cambio de datos institucionales' },
  VISIBILITY_CHANGED: { modulo: 'perfil', accion: 'Cambio de visibilidad' },
  ACTIVITY_CREATED: { modulo: 'actividades', accion: 'Actividad creada' },
  ACTIVITY_DUPLICATED: { modulo: 'actividades', accion: 'Actividad duplicada' },
  ACTIVITY_STATUS_CHANGED: { modulo: 'actividades', accion: 'Cambio de estado de la actividad' },
  ACTIVITY_SUBMITTED: { modulo: 'actividades', accion: 'Enviada a revisión' },
  ACTIVITY_SUBMISSION_CANCELLED: { modulo: 'actividades', accion: 'Envío a revisión retirado', resultado: 'cancelado' },
  ACTIVITY_APPROVED: { modulo: 'actividades', accion: 'Actividad aprobada' },
  ACTIVITY_OBSERVED: { modulo: 'actividades', accion: 'Actividad observada' },
  ACTIVITY_REJECTED: { modulo: 'actividades', accion: 'Actividad rechazada', resultado: 'rechazado' },
  ACTIVITY_REGISTERED: { modulo: 'actividades', accion: 'Inscripción' },
  PARTICIPATION_CONFIRMED: { modulo: 'actividades', accion: 'Participación confirmada' },
  PARTICIPATION_CORRECTED: { modulo: 'actividades', accion: 'Corrección excepcional de participación' },
  ATTENDANCE_CLOSED: { modulo: 'actividades', accion: 'Asistencia cerrada' },
  CONSTANCY_ISSUED: { modulo: 'actividades', accion: 'Constancia o certificado entregado' },
  VALIDATION_REFERENCE_UPDATED: { modulo: 'actividades', accion: 'Referencia de validación actualizada' },
  EXTERNAL_OPPORTUNITY_ACCEPTED: { modulo: 'credenciales', accion: 'Aceptado en oportunidad externa' },
  EXTERNAL_EVIDENCE_ENABLED: { modulo: 'credenciales', accion: 'Credencial habilitada para adjuntar' },
  EXTERNAL_CREDENTIAL_CREATED: { modulo: 'credenciales', accion: 'Credencial registrada' },
  EXTERNAL_CREDENTIAL_CHECKED: { modulo: 'credenciales', accion: 'Credencial comprobada' },
  EXTERNAL_CREDENTIAL_MANUAL_REVIEW_REQUESTED: { modulo: 'credenciales', accion: 'Revisión manual pedida' },
  EXTERNAL_CREDENTIAL_MANUAL_REVIEWED: { modulo: 'credenciales', accion: 'Revisión manual resuelta' },
  VALIDATION_COMPLETED: { modulo: 'credenciales', accion: 'Validación terminada' },
  PROJECT_CREATED: { modulo: 'proyectos', accion: 'Proyecto creado' },
  PROJECT_ACTIVATED: { modulo: 'proyectos', accion: 'Proyecto activado' },
  MEMBER_INVITED: { modulo: 'proyectos', accion: 'Integrante invitado' },
  MEMBER_ACCEPTED: { modulo: 'proyectos', accion: 'Integrante aceptado' },
  CONTRIBUTION_CONFIRMED: { modulo: 'proyectos', accion: 'Contribución confirmada' },
  PROJECT_EVIDENCE_ADDED: { modulo: 'proyectos', accion: 'Evidencia de proyecto agregada' },
  REPOSITORY_CHECKED: { modulo: 'proyectos', accion: 'Repositorio comprobado' },
  DEMO_CHECKED: { modulo: 'proyectos', accion: 'Demo comprobada' },
  PROJECT_BACKING_CHANGED: { modulo: 'proyectos', accion: 'Cambio de respaldo del proyecto' },
  FEEDBACK_ADDED: { modulo: 'proyectos', accion: 'Comentario docente' },
  RECOMMENDATION_DISMISSED: { modulo: 'recomendaciones', accion: 'Recomendación descartada' },
  AFFINITY_RECALCULATED: { modulo: 'afinidad', accion: 'Afinidad recalculada' },
  SKILL_CLASSIFICATION_OVERRIDE: { modulo: 'catalogo', accion: 'Habilidad guardada fuera del área sugerida' },
  CONTACT_ACCEPTED: { modulo: 'colaboracion', accion: 'Contacto aceptado' },
  TEAM_APPLICATION_CREATED: { modulo: 'colaboracion', accion: 'Postulación a un equipo' },
  TEAM_MEMBER_ACCEPTED: { modulo: 'colaboracion', accion: 'Integrante aceptado en un equipo' },
  TEAM_NAME_MODERATED: { modulo: 'colaboracion', accion: 'Nombre de equipo moderado', resultado: 'moderado' },
  EVIDENCE_UPLOADED: { modulo: 'archivos', accion: 'Evidencia subida' },
  EVIDENCE_DELETED: { modulo: 'archivos', accion: 'Evidencia eliminada' },
  FILE_UPLOADED: { modulo: 'archivos', accion: 'Archivo subido' },
  AI_SUGGESTION_CREATED: { modulo: 'ia', accion: 'Sugerencia de IA generada' },
  AI_SUGGESTION_ACCEPTED: { modulo: 'ia', accion: 'Sugerencia de IA aceptada' },
  CONFIG_CHANGED: { modulo: 'configuracion', accion: 'Cambio de configuración' },
  RESOURCE_PROPOSED: { modulo: 'catalogo', accion: 'Recurso propuesto por un docente' },
  RESOURCE_REVIEWED: { modulo: 'catalogo', accion: 'Revisión de un recurso propuesto' },
  CURRICULUM_EXPORTED: { modulo: 'curriculo', accion: 'Currículo exportado' },
};

/** Lo que el evento afecta, en palabras. */
export const AUDIT_ENTITY_LABEL: Record<string, string> = {
  user: 'Cuenta',
  activity: 'Actividad',
  activity_registration: 'Inscripción',
  import_batch: 'Lote de importación',
  internal_constancy: 'Constancia o certificado',
  external_certificate: 'Credencial externa',
  project: 'Proyecto',
  project_evidence: 'Evidencia de proyecto',
  skill: 'Habilidad',
  academic_area: 'Área',
  team: 'Equipo',
  student_profile: 'Perfil',
  recommendation: 'Recomendación',
  config: 'Configuración',
  stored_file: 'Archivo',
};

/** Nombres de los datos de detalle más frecuentes. */
const CAMPO: Record<string, string> = {
  de: 'Antes', a: 'Después', motivo: 'Motivo', reason: 'Motivo', status: 'Estado', type: 'Tipo', origin: 'Origen',
  kind: 'Clase', role: 'Rol', semesters: 'Semestres', created: 'Creadas', updated: 'Actualizadas', totalRows: 'Filas',
  counts: 'Resultado por fila', decision: 'Decisión', comment: 'Comentario', automatico: 'Automático', issuer: 'Emisor',
  semesterScope: 'Semestres', responsibleUserId: 'Responsable', viaAdmin: 'Creada por Administración', name: 'Nombre',
  filename: 'Archivo', activityId: 'Actividad', reenvio: 'Reenvío', sections: 'Secciones',
  via: 'Por medio de', email: 'Correo', areas: 'Áreas', reglas: 'Reglas', studentProfileId: 'Perfil', duplicate: 'Duplicado',
  backingTier: 'Respaldo', identityMatchStatus: 'Coincidencia de identidad', source: 'Fuente', linkStatus: 'Estado del enlace',
  antes: 'Antes', despues: 'Después', sizeBytes: 'Tamaño (bytes)', mimeType: 'Tipo de archivo', title: 'Título',
  credentialCheck: 'Comprobación', comentario: 'Comentario', contradictions: 'Contradicciones', qr: 'Código QR',
  official: 'Fuente oficial', responsibleUserIds: 'Responsables', contactUserIds: 'Contactos', tarea: 'Tarea',
  objetivo: 'Objetivo', estado: 'Estado', senales: 'Señales', visibility: 'Visibilidad', lenguajes: 'Lenguajes',
  resultado: 'Resultado', publicProfileEnabled: 'Perfil público', regla: 'Regla', suggested: 'Sugerida',
  evidenceType: 'Tipo de evidencia', owner: 'Propietario', to: 'Para', automatica: 'Automática', batchId: 'Lote',
  campos: 'Campos', from: 'Desde', origen: 'Origen', version: 'Versión', answered: 'Respondida', rol: 'Rol',
  peerDiscoverable: 'Visible para compañeros', skills: 'Habilidades', confirmed: 'Confirmada', integrante: 'Integrante',
  plantilla: 'Plantilla',
};

/** El detalle como pares legibles, sin volcar JSON. */
export function auditDetail(metadata: Record<string, unknown> | null | undefined): { campo: string; valor: string }[] {
  if (!metadata) return [];
  const legible = (v: unknown): string => {
    if (v === null || v === undefined) return '—';
    if (typeof v === 'boolean') return v ? 'Sí' : 'No';
    if (Array.isArray(v)) return v.map(legible).join(', ');
    if (typeof v === 'object') {
      return Object.entries(v as Record<string, unknown>).map(([k, x]) => `${CAMPO[k] ?? k}: ${legible(x)}`).join(' · ');
    }
    if (typeof v === 'string' && /^[0-9a-f-]{36}$/i.test(v)) return `#${v.slice(0, 8)}`;
    return String(v);
  };
  return Object.entries(metadata).slice(0, 12).map(([k, v]) => ({ campo: CAMPO[k] ?? k, valor: legible(v).slice(0, 300) }));
}

/** Tipos de evento de un módulo, para filtrar. */
export function eventTypesOf(modulo: string): string[] {
  return Object.entries(AUDIT_EVENT_LABEL).filter(([, v]) => v.modulo === modulo).map(([k]) => k);
}

/** Tipos de evento con un resultado dado. */
export function eventTypesWithResult(resultado: string): string[] {
  return Object.entries(AUDIT_EVENT_LABEL).filter(([, v]) => (v.resultado ?? 'correcto') === resultado).map(([k]) => k);
}
