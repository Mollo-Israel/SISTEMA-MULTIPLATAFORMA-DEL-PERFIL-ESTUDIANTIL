import { useEffect, useState } from 'react';
import { useCachedState } from '../hooks/viewCache';
import { Link } from 'react-router-dom';
import { FiBookmark, FiCompass } from 'react-icons/fi';
import { apiError } from '../api/client';
import { activityService, recommendationService, type RecommendationItem, type RecommendationsResponse } from '../services';
import { Badge, Button, Card, Diferido, EmptyState, SkeletonCards, Stagger } from './ui';
import { useToast } from './feedback';

/** Tipos que son oportunidades (actividades y cursos). */
const DE_OPORTUNIDAD = ['activity', 'opportunity', 'external_course'];

/**
 * «Para ti» dentro de Actividades (V3 §34.2).
 *
 * Recomienda lo que el estudiante quiere explorar o mejorar, no lo que ya
 * sabe: la afinidad no es un factor. Cada tarjeta dice por qué aparece.
 * V6 §9.1: sin «No me interesa» ni «Descartadas»; «Guardar» es un favorito
 * de acceso rápido que no cambia el orden.
 */
export default function ParaTi({ onChanged }: { onChanged?: () => void }) {
  // Con memoria de la sesión: al volver a Actividades se pinta al instante
  // con lo último y se refresca por detrás.
  const [data, setData] = useCachedState<RecommendationsResponse | null>('para-ti', null);
  const [busy, setBusy] = useState<string | null>(null);
  const toast = useToast();

  const cargar = () => recommendationService.mine().then(setData).catch((e) => toast.error(apiError(e)));
  useEffect(() => { cargar(); }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const [guardadas, setGuardadas] = useState<Set<string>>(new Set());
  const guardar = async (r: RecommendationItem) => {
    setBusy(r.id);
    try {
      const ya = guardadas.has(r.targetId);
      await (ya ? activityService.unfavorite(r.targetId) : activityService.favorite(r.targetId));
      setGuardadas((s) => { const n = new Set(s); if (ya) n.delete(r.targetId); else n.add(r.targetId); return n; });
      toast.success(ya ? 'Quitada de guardadas' : 'Guardada', ya ? undefined : 'La encuentras en «Guardadas». No cambia lo que te sugerimos.');
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
                  {/* V6 §9.3: por qué, en palabras; sin puntos internos. */}
                  {r.reasons.filter((x) => x.points > 0 || x.code === 'context_match').map((x) => (
                    <li key={x.code + x.label} className="small">{x.label}</li>
                  ))}
                </ul>
                <div className="flex mt" style={{ gap: '0.5rem', flexWrap: 'wrap' }}>
                  <Link className="btn btn-secondary btn-sm" to={`/student/activities?tab=todas&actividad=${r.targetId}`}>Ver detalles</Link>
                  <Button size="sm" variant="ghost" loading={busy === r.id}
                    onClick={() => void guardar(r)} icon={<FiBookmark size={13} />} aria-pressed={guardadas.has(r.targetId)}>
                    {guardadas.has(r.targetId) ? 'Quitar de guardadas' : 'Guardar'}
                  </Button>
                </div>
              </Card>
            </Stagger>
          ))}
        </div>
      )}
      <p className="muted small mt" data-testid="como-se-ordena">
        Se ordena por lo que declaraste en tu perfil: lo que te interesa, lo que quieres mejorar, las tecnologías
        que quieres explorar y tu orientación. Guardar, inscribirte o abrir una actividad no cambia el orden, y tu
        afinidad no decide qué ves. Lo editas en <Link to="/student/profile?tab=intereses">Mi perfil → Intereses</Link>.
      </p>
    </div>
  );
}
