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
  /**
   * V7.1 §5.2–§5.3: no corresponde procesarla. Es el caso de una histórica o
   * de una vinculada sin certificado modelo: van directo a la revisión de
   * Dirección. Es una omisión, no un fallo ni un resultado favorable.
   */
  NOT_APPLICABLE = 'not_applicable',
}

/** V7.1 §5.3: por qué las fases técnicas 1 y 2 no se ejecutaron. */
export enum ProcessingSkipReason {
  /** Obtenida antes o fuera de Afinia: no hay con qué compararla. */
  HISTORICAL = 'historical',
  /** La oportunidad no tiene certificado modelo. */
  NO_REFERENCE_MODEL = 'no_reference_model',
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
  /** V4.1 A41-018: verificada por una persona con prueba externa independiente. */
  CORROBORATED = 'corroborated',
  /** Anterior a V4.1; se lee como «inconclusa». */
  NOT_CORROBORATED = 'not_corroborated',
  /** V4.1 A41-018 (B32): revisada, pero sin fuente externa que verifique emisor o titular. */
  INCONCLUSIVE = 'inconclusive',
  /** V4.1 A41-018: contradicción fuerte documentada (p. ej., credencial de otra persona). */
  REJECTED = 'rejected',
  /**
   * V7.1 §5.3 fase 3: Dirección pide una corrección con su motivo. El
   * estudiante corrige y la reenvía; mientras tanto no cuenta.
   */
  OBSERVED = 'observed',
  /**
   * V7.1 §5.3 fase 3 (C22): Dirección la acepta tras revisar el documento y
   * las fuentes disponibles, sin una prueba externa independiente. Cuenta con
   * respaldo parcial; no es una corroboración fuerte ni una certificación.
   */
  APPROVED = 'approved',
}

/**
 * V7.1 §5.1: ¿la credencial cuenta para afinidad, tecnologías respaldadas y
 * trayectoria? No mientras espera a Dirección, ni observada, ni rechazada.
 * Las que no pasaron por la revisión (anteriores a V7.1) conservan su
 * comportamiento: C23 prohíbe revocarlas en silencio.
 */
export function credencialCuenta(revision: ManualReviewStatus | null | undefined): boolean {
  return revision !== ManualReviewStatus.REQUESTED
    && revision !== ManualReviewStatus.OBSERVED
    && revision !== ManualReviewStatus.REJECTED;
}

/**
 * V4.1 A41-018 (§6.2, A.8): cómo se comprobó en una revisión manual. Solo las
 * tres primeras son una prueba externa independiente del propio archivo.
 */
export enum ManualReviewMethod {
  /** Se consultó la página o registro individual del emisor. */
  ISSUER_OFFICIAL_LOOKUP = 'issuer_official_lookup',
  /** El emisor confirmó por un canal propio (correo, nota oficial). */
  ISSUER_CONFIRMATION = 'issuer_confirmation',
  /** Registro institucional que lo respalda (acta, libro, sistema académico). */
  INSTITUTIONAL_REGISTRY = 'institutional_registry',
  /** Solo se miró el documento aportado: no verifica (B32). */
  DOCUMENT_ONLY = 'document_only',
}

export const INDEPENDENT_REVIEW_METHODS: readonly ManualReviewMethod[] = [
  ManualReviewMethod.ISSUER_OFFICIAL_LOOKUP,
  ManualReviewMethod.ISSUER_CONFIRMATION,
  ManualReviewMethod.INSTITUTIONAL_REGISTRY,
];

/**
 * V4.1 A41-018 (§6.2, A.8): estado de validación de una credencial externa.
 *
 * Es un eje distinto del respaldo (`BackingTier`) y del trabajo del worker
 * (`ValidationStatus`). Se deriva de lo ya registrado; no reemplaza nada.
 */
export enum CredentialValidationStatus {
  PENDING = 'PENDING',
  AUTO_VERIFIED = 'AUTO_VERIFIED',
  MANUAL_REVIEW_REQUIRED = 'MANUAL_REVIEW_REQUIRED',
  MANUALLY_VERIFIED = 'MANUALLY_VERIFIED',
  INCONCLUSIVE = 'INCONCLUSIVE',
  REJECTED = 'REJECTED',
  /** V7.1: Dirección pidió una corrección. */
  OBSERVED = 'OBSERVED',
  /** V7.1 (C22): aceptada por Dirección revisando el documento, sin prueba externa. */
  APPROVED = 'APPROVED',
}

/**
 * V7.1 §5.1, §5.3: la plataforma no declara autenticidad. «Aprobada» es una
 * decisión de Dirección con su alcance, no una certificación de Afinia.
 */
export const CREDENTIAL_VALIDATION_LABEL: Record<CredentialValidationStatus, string> = {
  [CredentialValidationStatus.PENDING]: 'En comprobación',
  [CredentialValidationStatus.AUTO_VERIFIED]: 'Comprobada por la fuente oficial (anterior a la revisión obligatoria)',
  [CredentialValidationStatus.MANUAL_REVIEW_REQUIRED]: 'Pendiente de revisión de Dirección',
  [CredentialValidationStatus.MANUALLY_VERIFIED]: 'Aprobada por Dirección con una prueba externa',
  [CredentialValidationStatus.INCONCLUSIVE]: 'Revisada sin poder contrastarla con una fuente externa',
  [CredentialValidationStatus.REJECTED]: 'Rechazada por Dirección',
  [CredentialValidationStatus.OBSERVED]: 'Observada: corrígela y vuelve a enviarla',
  [CredentialValidationStatus.APPROVED]: 'Aprobada por Dirección (revisión del documento, respaldo parcial)',
};

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
