/**
 * Origen de una oportunidad (V3 §12): una interna la organiza la carrera; una
 * externa la ofrece un proveedor (Cisco, IBM, Coursera…). Para el estudiante
 * es un único universo de oportunidades.
 */
export enum ActivityOrigin {
  INTERNAL = 'internal',
  EXTERNAL = 'external',
}

/**
 * Qué puede generarse al terminar una oportunidad (V3 §14). Lo decide el
 * responsable al crearla y Dirección lo aprueba con la oportunidad.
 */
export enum ActivityOutcomePolicy {
  NONE = 'none',
  /** Constancia interna automática al confirmar la participación (§14.1). */
  INTERNAL_CONSTANCY = 'internal_constancy',
  /** Un tercero emite una credencial que el estudiante adjunta después (§14.2). */
  EXTERNAL_CREDENTIAL_EXPECTED = 'external_credential_expected',
  /** Otro recurso que autoriza el responsable. */
  OTHER_AUTHORIZED_RESOURCE = 'other_authorized_resource',
}

/**
 * De dónde viene una credencial externa (V3 §15, §16).
 *
 *   OPPORTUNITY         — de una oportunidad de Afinia en la que el estudiante
 *                         fue aceptado (externa) o confirmado (interna que
 *                         conduce a una credencial de un tercero).
 *   HISTORICAL_EXTERNAL — obtenida antes de Afinia o fuera de ella. No exige
 *                         recrear ninguna oportunidad.
 */
export enum ExternalCredentialSource {
  OPPORTUNITY = 'opportunity',
  HISTORICAL_EXTERNAL = 'historical_external',
}

export enum ActivityType {
  ACADEMICA = 'academica',
  EXTRACURRICULAR = 'extracurricular',
}

export enum ActivityCategory {
  TALLER_ACADEMICO = 'taller_academico',
  CLASE_ESPEJO = 'clase_espejo',
  SEMINARIO = 'seminario',
  CHARLA = 'charla',
  CURSO_EXTERNO_RECOMENDADO = 'curso_externo_recomendado',
  RETO = 'reto',
  HACKATHON = 'hackathon',
  CONVOCATORIA = 'convocatoria',
  ACTIVIDAD_SOCIEDAD_CIENTIFICA = 'actividad_sociedad_cientifica',
  CLUB_ESTUDIO = 'club_estudio',
  TUTORIA = 'tutoria',
  INVESTIGACION = 'investigacion',
  RESPONSABILIDAD_SOCIAL = 'responsabilidad_social',
  INTEGRACION = 'integracion',
  /** Guia, documentacion o material de consulta (Objetivo 7, RN-16). */
  RECURSO_DE_APOYO = 'recurso_de_apoyo',
}

export enum ActivityModality {
  PRESENCIAL = 'presencial',
  VIRTUAL = 'virtual',
  HIBRIDA = 'hibrida',
}

/**
 * Ciclo de vida de una actividad (especificacion §22).
 *
 *   DRAFT     — se está redactando; solo la ve quien la gestiona.
 *   PUBLISHED — visible, pero todavía sin inscripciones.
 *   OPEN      — admite inscripciones.
 *   CLOSED    — cerrada a nuevas inscripciones; aún no ocurrió o no terminó.
 *   FINISHED  — terminó; es cuando se confirma la participación.
 *   CANCELLED — no se realizará. Estado final.
 */
export enum ActivityStatus {
  DRAFT = 'draft',
  PUBLISHED = 'published',
  OPEN = 'open',
  CLOSED = 'closed',
  FINISHED = 'finished',
  CANCELLED = 'cancelled',
}

/**
 * Máquina de estados explícita (§22).
 *
 * Se declara como tabla en vez de repartir condiciones por el servicio: así el
 * ciclo de vida completo se lee de un vistazo y añadir un camino nuevo es
 * cambiar una línea, no recordar en qué tres sitios había un `if`.
 *
 * Las ausencias son tan deliberadas como las presencias:
 *
 *   - de `FINISHED` no se sale. Una actividad que ya ocurrió no deja de haber
 *     ocurrido, y su participación confirmada ya alimentó perfiles;
 *   - de `CANCELLED` tampoco: recuperarla sería reabrir algo que se comunicó
 *     como cancelado. Se crea otra;
 *   - `CLOSED → OPEN` sí existe, porque cerrar y reabrir inscripciones es una
 *     decisión ordinaria de quien organiza;
 *   - volver a `DRAFT` se permite solo desde `PUBLISHED`, y el servicio añade
 *     una condición que esta tabla no puede expresar: que nadie tenga aún
 *     participación confirmada.
 */
export const ACTIVITY_TRANSITIONS: Record<ActivityStatus, readonly ActivityStatus[]> = {
  // `DRAFT → OPEN` existe porque publicar y abrir inscripciones a la vez es lo
  // que de verdad hace quien termina de redactar una actividad. No salta
  // ningún control: `OPEN` es estrictamente más visible que `PUBLISHED`, así
  // que obligar a dos llamadas añadiría fricción sin ganar nada.
  [ActivityStatus.DRAFT]: [
    ActivityStatus.PUBLISHED,
    ActivityStatus.OPEN,
    ActivityStatus.CANCELLED,
  ],
  [ActivityStatus.PUBLISHED]: [
    ActivityStatus.DRAFT,
    ActivityStatus.OPEN,
    ActivityStatus.CLOSED,
    ActivityStatus.FINISHED,
    ActivityStatus.CANCELLED,
  ],
  [ActivityStatus.OPEN]: [
    ActivityStatus.CLOSED,
    ActivityStatus.FINISHED,
    ActivityStatus.CANCELLED,
  ],
  [ActivityStatus.CLOSED]: [
    ActivityStatus.OPEN,
    ActivityStatus.FINISHED,
    ActivityStatus.CANCELLED,
  ],
  [ActivityStatus.FINISHED]: [],
  [ActivityStatus.CANCELLED]: [],
};

/** Estados finales: ya no admiten ningún cambio. */
export const TERMINAL_ACTIVITY_STATUSES: readonly ActivityStatus[] = [
  ActivityStatus.FINISHED,
  ActivityStatus.CANCELLED,
];

/** Estados en los que un estudiante puede manifestar interés o inscribirse. */
export const REGISTRABLE_ACTIVITY_STATUSES: readonly ActivityStatus[] = [
  ActivityStatus.PUBLISHED,
  ActivityStatus.OPEN,
];

export function canTransition(from: ActivityStatus, to: ActivityStatus): boolean {
  if (from === to) return true;
  return (ACTIVITY_TRANSITIONS[from] ?? []).includes(to);
}

/** Etiquetas para la interfaz, en un solo sitio para web y móvil. */
export const ACTIVITY_STATUS_LABEL: Record<ActivityStatus, string> = {
  [ActivityStatus.DRAFT]: 'Borrador',
  [ActivityStatus.PUBLISHED]: 'Publicada',
  [ActivityStatus.OPEN]: 'Inscripciones abiertas',
  [ActivityStatus.CLOSED]: 'Inscripciones cerradas',
  [ActivityStatus.FINISHED]: 'Finalizada',
  [ActivityStatus.CANCELLED]: 'Cancelada',
};

/**
 * Revisión institucional de una actividad (V2 §27.2).
 *
 * Va aparte del ciclo de vida: aprobar no es publicar, y publicar exige haber
 * sido aprobada (o no necesitarlo). `null` en la base significa que la
 * actividad requiere revisión y todavía no se envió.
 */
export enum ActivityReviewStatus {
  /** La crea Dirección: no necesita una segunda autoridad (§27.5). */
  NOT_REQUIRED = 'not_required',
  /** Enviada; espera la decisión de Dirección. */
  PENDING = 'pending',
  /** Dirección pidió cambios: se edita y se reenvía. */
  OBSERVED = 'observed',
  APPROVED = 'approved',
  /** No se publica. Queda en la historia; no se reaprovecha como aprobada. */
  REJECTED = 'rejected',
}

export const ACTIVITY_REVIEW_LABEL: Record<ActivityReviewStatus | 'unsubmitted', string> = {
  unsubmitted: 'Sin enviar a revisión',
  [ActivityReviewStatus.NOT_REQUIRED]: 'No requiere revisión',
  [ActivityReviewStatus.PENDING]: 'En revisión por Dirección',
  [ActivityReviewStatus.OBSERVED]: 'Con observaciones',
  [ActivityReviewStatus.APPROVED]: 'Aprobada por Dirección',
  [ActivityReviewStatus.REJECTED]: 'Rechazada',
};

/** Estados de revisión que permiten publicar o abrir (§27.6). */
export const PUBLISHABLE_REVIEW_STATUSES: readonly ActivityReviewStatus[] = [
  ActivityReviewStatus.NOT_REQUIRED,
  ActivityReviewStatus.APPROVED,
];

export type ActivityReviewAction = 'submitted' | 'approved' | 'observed' | 'rejected';
