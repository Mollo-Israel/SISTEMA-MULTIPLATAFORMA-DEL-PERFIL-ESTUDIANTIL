import { AiProvider } from '@perfil/shared';
import { AiAssistancePort, AiCompletionRequest, AiUnavailableError } from '../ai-assistance.port';

export interface OpenAiCompatibleConfig {
  baseUrl: string;
  apiKey: string | null;
  model: string;
  timeoutMs: number;
}

/**
 * Adaptador para cualquier API compatible con `POST {base}/chat/completions`
 * (OpenAI, Azure OpenAI con base propia, Ollama, LM Studio, vLLM...).
 *
 * Nunca deja escapar la clave: los errores dicen qué pasó (tiempo agotado,
 * código HTTP, respuesta vacía) sin repetir cabeceras ni cuerpo del pedido.
 */
export class OpenAiCompatibleAdapter implements AiAssistancePort {
  readonly provider = AiProvider.OPENAI_COMPATIBLE;
  readonly model: string;

  constructor(
    private readonly config: OpenAiCompatibleConfig,
    private readonly fetchImpl: typeof fetch = fetch,
  ) {
    this.model = config.model;
  }

  isEnabled(): boolean {
    return true;
  }

  async complete({ system, user, maxTokens = 600 }: AiCompletionRequest): Promise<string> {
    const url = `${this.config.baseUrl.replace(/\/+$/, '')}/chat/completions`;
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), this.config.timeoutMs);
    let res: Response;
    try {
      res = await this.fetchImpl(url, {
        method: 'POST',
        signal: controller.signal,
        headers: {
          'Content-Type': 'application/json',
          ...(this.config.apiKey ? { Authorization: `Bearer ${this.config.apiKey}` } : {}),
        },
        body: JSON.stringify({
          model: this.config.model,
          temperature: 0.2,
          max_tokens: maxTokens,
          messages: [
            { role: 'system', content: system },
            { role: 'user', content: user },
          ],
        }),
      });
    } catch (e) {
      throw new AiUnavailableError(
        (e as Error).name === 'AbortError'
          ? `El proveedor de IA no respondió en ${this.config.timeoutMs} ms.`
          : 'No se pudo contactar al proveedor de IA.',
      );
    } finally {
      clearTimeout(timer);
    }
    if (!res.ok) {
      throw new AiUnavailableError(`El proveedor de IA respondió ${res.status}.`);
    }
    let body: { choices?: { message?: { content?: unknown } }[] };
    try {
      body = await res.json();
    } catch {
      throw new AiUnavailableError('El proveedor de IA devolvió una respuesta ilegible.');
    }
    const content = body.choices?.[0]?.message?.content;
    if (typeof content !== 'string' || !content.trim()) {
      throw new AiUnavailableError('El proveedor de IA devolvió una respuesta vacía.');
    }
    return content;
  }
}
