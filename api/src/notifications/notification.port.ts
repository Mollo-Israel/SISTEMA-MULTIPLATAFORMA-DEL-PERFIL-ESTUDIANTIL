/**
 * Punto de emisión de notificaciones (V3 §72: B8, B12 y B17 dejan listo el
 * evento; B16 lo conecta al centro de notificaciones).
 *
 * Los servicios de negocio emiten aquí sin saber cómo se entrega. Mientras
 * no exista el centro, la implementación por defecto solo deja rastro en el
 * registro: la operación de negocio nunca depende de que la notificación
 * llegue.
 */
export const NOTIFICATION_EMITTER = Symbol('NOTIFICATION_EMITTER');

export interface NotificationEvent {
  /** Usuario destinatario. */
  userId: string;
  /** Tipo estable, para filtrar y agrupar (p. ej. `EXTERNAL_EVIDENCE_ENABLED`). */
  kind: string;
  title: string;
  body: string;
  /** Ruta de la interfaz a la que lleva la notificación. */
  link?: string;
  /**
   * Clave de deduplicación: el mismo hecho no se notifica dos veces
   * aunque el evento se emita más de una vez.
   */
  dedupeKey: string;
}

export interface NotificationEmitter {
  emit(event: NotificationEvent): Promise<void>;
}
