/**
 * Puerto del asistente de IA (especificación V2 §43.1).
 *
 * El resto del sistema habla con esta interfaz y no sabe qué hay detrás:
 * `none` (no hay IA, y todo funciona igual) u `openai_compatible` (cualquier
 * servicio con `/chat/completions`). Cambiar de proveedor es configuración,
 * no código.
 */
export interface AiCompletionRequest {
  system: string;
  user: string;
  /** Tope de la respuesta; las tareas de Afinia son cortas. */
  maxTokens?: number;
}

export interface AiAssistancePort {
  readonly provider: string;
  readonly model: string | null;
  isEnabled(): boolean;
  /** Devuelve el texto de la respuesta o lanza `AiUnavailableError`. */
  complete(request: AiCompletionRequest): Promise<string>;
}

export const AI_ASSISTANCE_PORT = Symbol('AI_ASSISTANCE_PORT');

/** El proveedor no está, no respondió a tiempo o devolvió un error. */
export class AiUnavailableError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'AiUnavailableError';
  }
}
