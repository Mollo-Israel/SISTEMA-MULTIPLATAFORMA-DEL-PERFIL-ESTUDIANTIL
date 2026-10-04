import { AiProvider } from '@perfil/shared';
import { AiAssistancePort, AiUnavailableError } from '../ai-assistance.port';

/**
 * `AI_PROVIDER=none` (§84): no hay IA. El sistema arranca, la afinidad, las
 * recomendaciones, las evidencias y el CV funcionan con sus reglas, y las
 * pantallas no ofrecen el botón de sugerencia.
 */
export class NoneAiAdapter implements AiAssistancePort {
  readonly provider = AiProvider.NONE;
  readonly model = null;

  isEnabled(): boolean {
    return false;
  }

  async complete(): Promise<string> {
    throw new AiUnavailableError('El asistente de IA no está configurado.');
  }
}
