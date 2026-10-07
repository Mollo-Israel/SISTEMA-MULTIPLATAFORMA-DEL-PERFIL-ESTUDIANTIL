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
  /**
   * Señal verificable fuerte (V3 §19): fuente oficial que identifica la
   * credencial y coincide, insignia verificable, o la revisión manual
   * excepcional de Dirección para una histórica sin verificador.
   */
  CORROBORATED = 'corroborated',
  /**
   * V3 §19: contradicción significativa (nombre, curso, emisor, código o
   * dominio). No se borra: queda señalada y no suma mientras siga así.
   */
  FLAGGED = 'flagged',
}

/** Orden de menor a mayor respaldo, para comparar niveles. FLAGGED queda por debajo de todo. */
export const BACKING_TIER_ORDER: readonly BackingTier[] = [
  BackingTier.FLAGGED,
  BackingTier.DECLARED,
  BackingTier.SUPPORTED,
  BackingTier.CORROBORATED,
];

/**
 * Resultado de la verificación oficial de una credencial externa (V3 §18.2).
 *
 * Una página que no responde o que necesita JavaScript no convierte la
 * credencial en falsa: queda inconclusa o sin prueba legible.
 */
export enum CredentialCheckStatus {
  /** Una fuente oficial identifica la credencial y coincide con el estudiante. */
  VERIFIED_MATCH = 'verified_match',
  /** Responde, pero no expone una prueba que pueda leerse. */
  REACHABLE_NO_STRUCTURED_PROOF = 'reachable_no_structured_proof',
  /** Contradice: dominio no permitido, destinatario de otro, revocada. */
  MISMATCH = 'mismatch',
  /** No se pudo comprobar (verificador apagado o sin salida a internet). */
  INCONCLUSIVE = 'inconclusive',
  /** El proveedor no respondió. */
  UNREACHABLE = 'unreachable',
  /** La credencial no trae URL, QR ni insignia verificable. */
  NO_VERIFIER = 'no_verifier',
}

/** V3 §18.1: el QR no es obligatorio; se registra si estaba o no. */
export enum QrPresence {
  QR_PRESENT = 'qr_present',
  QR_ABSENT = 'qr_absent',
}

/**
 * Revisión manual excepcional (V3 §16, §19): solo para credenciales
 * históricas sin verificador digital, y solo Dirección puede decidirla.
 */
export enum ManualReviewStatus {
  REQUESTED = 'requested',
  CORROBORATED = 'corroborated',
  NOT_CORROBORATED = 'not_corroborated',
}

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
