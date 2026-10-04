import { useEffect, useState, type ReactNode } from 'react';
import { FiCheck, FiCpu, FiX } from 'react-icons/fi';
import { apiError } from '../api/client';
import { aiService, type AiStatus, type AiSuggestionResult, type AiTask } from '../services';
import { Button } from './ui';
import { useToast } from './feedback';

/** Un solo pedido de estado por sesión de pestaña: no cambia sin reiniciar la API. */
let estado: Promise<AiStatus | null> | null = null;
export function useAiStatus(): AiStatus | null {
  const [s, setS] = useState<AiStatus | null>(null);
  useEffect(() => {
    estado ??= aiService.status().catch(() => null);
    let vivo = true;
    estado.then((v) => vivo && setS(v));
    return () => { vivo = false; };
  }, []);
  return s;
}

/**
 * Botón de ayuda de IA (V2 §43). Si no hay proveedor o el rol no tiene la
 * tarea, no se muestra: la pantalla funciona igual sin él (§84).
 *
 * La sugerencia aparece con su advertencia y dos salidas: usarla (se registra
 * quién la adoptó y se pasa al formulario, que la guarda por su camino normal)
 * o descartarla. Nunca se aplica sola.
 */
export default function AiAssist({
  task,
  label,
  request,
  render,
  onUse,
  useLabel = 'Usar sugerencia',
}: {
  task: AiTask;
  label: string;
  /** Cuerpo del pedido, armado en el momento del clic. */
  request: () => Record<string, unknown> | null;
  render: (result: Record<string, any>) => ReactNode;
  /** Sin `onUse` la sugerencia es solo de lectura (un resumen, una explicación). */
  onUse?: (result: Record<string, any>) => void;
  useLabel?: string;
}) {
  const status = useAiStatus();
  const toast = useToast();
  const [busy, setBusy] = useState(false);
  const [r, setR] = useState<AiSuggestionResult | null>(null);

  if (!status?.enabled || !status.tasks.some((t) => t.task === task)) return null;

  const pedir = async () => {
    const body = request();
    if (!body) return;
    setBusy(true);
    try {
      setR(await aiService.suggest({ task, ...body }));
    } catch (e) {
      toast.error(apiError(e));
    } finally {
      setBusy(false);
    }
  };

  const usar = async () => {
    if (!r?.result) return;
    try {
      if (r.runId) await aiService.accept(r.runId);
      onUse?.(r.result);
      setR(null);
    } catch (e) {
      toast.error(apiError(e));
    }
  };

  return (
    <div className="ai-assist">
      <Button type="button" size="sm" variant="ghost" icon={<FiCpu size={13} />} loading={busy} onClick={pedir}>
        {label}
      </Button>
      {r && (
        <div className="ai-assist-card" role="status">
          {r.ok && r.result ? (
            <>
              {render(r.result)}
              <small className="muted">
                {r.source === 'rule' ? 'Resuelto por una regla de Afinia.' : (r.disclaimer ?? status.disclaimer)}
              </small>
              <div className="flex" style={{ gap: '0.4rem', marginTop: '0.4rem' }}>
                {onUse && (
                  <Button type="button" size="sm" icon={<FiCheck size={13} />} onClick={usar}>{useLabel}</Button>
                )}
                <Button type="button" size="sm" variant="ghost" icon={<FiX size={13} />} onClick={() => setR(null)}>
                  {onUse ? 'Descartar' : 'Cerrar'}
                </Button>
              </div>
            </>
          ) : (
            <p className="muted" style={{ margin: 0 }}>
              {r.message ?? 'No hubo una sugerencia útil esta vez.'}{' '}
              <button type="button" className="link-button" onClick={() => setR(null)}>Cerrar</button>
            </p>
          )}
        </div>
      )}
    </div>
  );
}
