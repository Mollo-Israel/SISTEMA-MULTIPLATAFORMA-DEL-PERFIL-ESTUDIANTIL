import { useEffect, useState } from 'react';
import { useCachedState } from '../hooks/viewCache';
import { Link } from 'react-router-dom';
import { FiBookmark, FiCompass, FiThumbsDown } from 'react-icons/fi';
import { apiError } from '../api/client';
import { recommendationService, type RecommendationItem, type RecommendationsResponse } from '../services';
import { Badge, Button, Card, Diferido, EmptyState, SkeletonCards, Stagger } from './ui';
import { useToast } from './feedback';

/** Tipos que son oportunidades: los demás viven en «Más sugerencias». */
const DE_OPORTUNIDAD = ['activity', 'opportunity', 'external_course'];

/**
 * «Para ti» dentro de Actividades (V3 §34.2).
 *
 * Recomienda lo que el estudiante quiere explorar o mejorar, no lo que ya
 * sabe: la afinidad no es un factor. Cada tarjeta dice por qué aparece.
 * «No me interesa» baja lo parecido sin tocar sus intereses (§34.1).
 */
export default function ParaTi({ onChanged }: { onChanged?: () => void }) {
  // Con memoria de la sesión: al volver a Actividades se pinta al instante
  // con lo último y se refresca por detrás.
  const [data, setData] = useCachedState<RecommendationsResponse | null>('para-ti', null);
  const [busy, setBusy] = useState<string | null>(null);
  const toast = useToast();

  const cargar = () => recommendationService.mine().then(setData).catch((e) => toast.error(apiError(e)));
  useEffect(() => { cargar(); }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const decidir = async (r: RecommendationItem, status: 'saved' | 'dismissed') => {
    setBusy(r.id);
    try {
      await recommendationService.decide(r.id, status);
      toast.success(
        status === 'saved' ? 'Guardada' : 'No volverá a aparecer',
        status === 'saved'
          ? 'Lo parecido sube un poco en tus sugerencias.'
          : 'Lo parecido baja de prioridad. Tus intereses no cambian: eso se edita en Mi perfil → Intereses.',
      );
      await cargar();
      onChanged?.();
    } catch (e) {
      toast.error(apiError(e));
    } finally {
      setBusy(null);
    }
  };

  if (!data) return <Diferido><SkeletonCards count={3} /></Diferido>;
  const items = data.groups.flatMap((g) => g.items).filter((i) => DE_OPORTUNIDAD.includes(i.type))
    .sort((a, b) => b.score - a.score);

  return (
    <div>
      {items.length === 0 ? (
        <EmptyState
          icon={<FiCompass size={22} />}
          message={data.outcome === 'insufficient_profile'
            ? 'Cuéntanos qué te interesa y qué quieres mejorar (Mi perfil → Intereses) para sugerirte oportunidades.'
            : 'Ahora mismo no hay oportunidades abiertas que encajen con lo que buscas.'}
        />
      ) : (
        <div className="grid cols-2">
          {items.map((r, index) => (
            <Stagger key={r.id} index={index}>
              <Card title={r.title} actions={<Badge tone="bordo">{r.typeLabel}</Badge>}>
                {r.area && <p className="muted" style={{ marginTop: 0 }}>{r.area.name}</p>}
                <ul className="plain-list">
                  {r.reasons.filter((x) => x.points !== 0 || x.code === 'context_match').map((x) => (
                    <li key={x.code + x.label} className="small">
                      {x.label}
                      {x.points !== 0 && <span className="muted"> · {x.points > 0 ? '+' : ''}{x.points}</span>}
                    </li>
                  ))}
                </ul>
                <div className="flex mt" style={{ gap: '0.5rem', flexWrap: 'wrap' }}>
                  <Button size="sm" variant="secondary" loading={busy === r.id} disabled={r.status === 'saved'}
                    onClick={() => decidir(r, 'saved')} icon={<FiBookmark size={13} />}>
                    {r.status === 'saved' ? 'Guardada' : 'Guardar'}
                  </Button>
                  <Button size="sm" variant="ghost" loading={busy === r.id}
                    onClick={() => decidir(r, 'dismissed')} icon={<FiThumbsDown size={13} />}>
                    No me interesa
                  </Button>
                </div>
              </Card>
            </Stagger>
          ))}
        </div>
      )}
      <p className="muted small mt">
        Se ordena por tus intereses (40 %), áreas a mejorar (30 %), tecnologías (15 %), orientación (10 %) y lo que
        guardaste (5 %). Tu afinidad no decide qué ves. ¿Buscas recursos, áreas para fortalecer o compañeros?{' '}
        <Link to="/student/recommendations">Más sugerencias</Link>.
      </p>
    </div>
  );
}
