/**
 * Motor de Validación y Respaldo (especificacion §26).
 *
 * Es independiente del Motor de Afinidad. Su responsabilidad es determinar qué
 * informacion **puede corroborarse tecnicamente** y cuanto respaldo posee una
 * senal. No determina notas ni competencia profesional, y Afinia nunca afirma
 * autenticidad legal absoluta (§30).
 */

/** Tipos de evidencia del sistema (§25). Toda evidencia requiere contexto. */
export enum ValidationResourceType {
  PROJECT_EVIDENCE = 'project_evidence',
  EXTERNAL_CERTIFICATE = 'external_certificate',
  ACTIVITY_EVIDENCE = 'activity_evidence',
}

/**
 * Estado del trabajo de validacion (§76).
 *
 * `INCONCLUSIVE` no es un fallo: es el resultado honesto cuando el documento
 * no pudo leerse. §29 es explicito en que el recurso se conserva.
 */
export enum ValidationStatus {
  /** En cola. Nadie lo ha tomado todavia. */
  PENDING = 'pending',
  /** Un worker lo reclamo y lo esta procesando. */
  PROCESSING = 'processing',
  /** Terminado con un veredicto. */
  COMPLETED = 'completed',
  /** Se proceso pero no se pudo concluir nada. El recurso NO se elimina. */
  INCONCLUSIVE = 'inconclusive',
  /** Error tecnico tras agotar los reintentos. */
  FAILED = 'failed',
}

/**
 * Cuanto respalda un documento a la senal que acompana (§30).
 *
 * Es una escala de corroboracion tecnica, no de calidad ni de veracidad. Un
 * certificado `DECLARED` puede ser perfectamente autentico: solo significa que
 * el sistema no pudo comprobar nada por si mismo.
 */
export enum BackingTier {
  /** Archivo aportado, sin corroboracion suficiente. */
  DECLARED = 'declared',
  /** Documento legible y metadata consistente. */
  SUPPORTED = 'supported',
  /** URL o QR externo accesible y coherente con lo declarado. */
  CORROBORATED = 'corroborated',
}

/** Orden de menor a mayor respaldo, para comparar niveles. */
export const BACKING_TIER_ORDER: readonly BackingTier[] = [
  BackingTier.DECLARED,
  BackingTier.SUPPORTED,
  BackingTier.CORROBORATED,
];

/**
 * Coincidencia entre el nombre del titular y el que aparece en el documento
 * (§30).
 *
 * `UNKNOWN` cuando no se pudo leer un nombre; `MISMATCH` solo cuando se leyo
 * uno y no corresponde.
 */
export enum IdentityMatchStatus {
  MATCH = 'match',
  PARTIAL_MATCH = 'partial_match',
  MISMATCH = 'mismatch',
  UNKNOWN = 'unknown',
}

/**
 * Resultado de comprobar un enlace externo (§31).
 *
 * `BLOCKED` distingue lo que el sistema se **niega** a consultar —direcciones
 * internas, rangos privados, metadata de nube— de lo que simplemente no
 * respondio. Confundirlos convertiria al verificador en un escaner de la red
 * interna a disposicion de cualquiera.
 */
export enum LinkCheckStatus {
  UNVERIFIED = 'unverified',
  AVAILABLE = 'available',
  UNAVAILABLE = 'unavailable',
  BLOCKED = 'blocked',
}
