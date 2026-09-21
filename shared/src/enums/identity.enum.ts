/**
 * Identidad, provisionamiento y activacion de cuentas.
 *
 * Afinia no tiene registro publico: una cuenta nace provisionada por el
 * administrador y solo la activa quien demuestra control del correo
 * institucional (especificacion §9 y §12).
 */

/** Proposito de un token de un solo uso (§12). */
export enum AccountTokenPurpose {
  ACCOUNT_ACTIVATION = 'account_activation',
  PASSWORD_RESET = 'password_reset',
}

/**
 * Resultado de evaluar una fila del padron antes de aplicarla (§10).
 * La previsualizacion muestra estos estados; aplicar no produce sorpresas.
 */
export enum ImportRowStatus {
  /** La cuenta no existe: se creara. */
  NEW = 'new',
  /** La cuenta existe y algun dato seguro cambia. */
  UPDATE = 'update',
  /** La cuenta existe y no cambia nada. */
  UNCHANGED = 'unchanged',
  /** Identidad ambigua: mismo correo con otro codigo, o al reves. No se resuelve solo. */
  CONFLICT = 'conflict',
  /** La fila no cumple el formato minimo. */
  INVALID = 'invalid',
}

/** Estado de un lote de importacion (§10.4). */
export enum ImportBatchStatus {
  /** Analizado, pendiente de confirmacion. */
  PREVIEWED = 'previewed',
  /** Cambios escritos en la base. */
  APPLIED = 'applied',
  /** Previsualizado y descartado sin aplicar. */
  DISCARDED = 'discarded',
}
