/**
 * Punto de emisión de notificaciones (V3 §33). Los servicios de negocio
 * emiten aquí sin saber cómo se entrega; el centro de notificaciones (B16)
 * las persiste con su clave de deduplicación. La operación de negocio nunca
 * depende de que la notificación llegue.
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
  /** Entidad de la que trata, para filtrar y para enlazar. */
  entityType?: string;
  entityId?: string;
  /**
   * Clave de deduplicación: el mismo hecho no se notifica dos veces
   * aunque el evento se emita más de una vez.
   */
  dedupeKey: string;
}

export interface NotificationEmitter {
  emit(event: NotificationEvent): Promise<void>;
}
