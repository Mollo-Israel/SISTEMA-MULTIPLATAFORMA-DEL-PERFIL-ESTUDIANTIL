import { useCallback, useState } from 'react';
import { FiChevronDown, FiChevronRight, FiExternalLink, FiInfo } from 'react-icons/fi';
import { apiError } from '../../api/client';
import {
  recommendationService,
  RecommendationDetail,
  RecommendationItem,
  RecommendationsResponse,
} from '../../services';
import { useAsync } from '../../hooks/useAsync';
import { AsyncView, Card, Badge, Loading } from '../../components/ui';

/**
 * Recomendaciones academicas del estudiante en el panel web (RF18).
 *
 * RF18 asigna el requerimiento a la pantalla movil, pero el estudiante tambien
 * tiene panel web y no tendria sentido que ahi viera menos. Muestra lo mismo:
 * las recomendaciones agrupadas por tipo, el motivo de cada una y la decision
 * que RN-16 le reserva al estudiante.
 */

type Tab = 'foryou' | 'saved' | 'dismissed';

const STATUS_LABEL: Record<string, string> = {
  new: 'Nueva',
  viewed: 'Vista',
  saved: 'Guardada',
  dismissed: 'Descartada',
};

const HINTS = [
  'Declara tus áreas de preferencia',
  'Agrega tus intereses y habilidades',
  'Indica en qué áreas quieres mejorar',
  'Participa en una actividad o registra un proyecto',
];

export default function StudentRecommendationsPage() {
  const [tab, setTab] = useState<Tab>('foryou');
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);

  const [open, setOpen] = useState<string | null>(null);
  const [details, setDetails] = useState<Record<string, RecommendationDetail>>({});
  const [loadingDetail, setLoadingDetail] = useState<string | null>(null);

  const [history, setHistory] = useState<RecommendationItem[] | null>(null);
  const [loadingHistory, setLoadingHistory] = useState(false);

  const main = useAsync<RecommendationsResponse>(() => recommendationService.mine(), []);
  const reloadMain = main.reload;

  const loadHistory = useCallback(async (status: 'saved' | 'dismissed') => {
    setLoadingHistory(true);
    setErr(null);
    try {
      setHistory(await recommendationService.history(status));
    } catch (e) {
      setErr(apiError(e));
    } finally {
      setLoadingHistory(false);
    }
  }, []);

  const changeTab = (next: Tab) => {
    setTab(next);
    setOpen(null);
    setErr(null);
    if (next === 'foryou') reloadMain();
    else loadHistory(next);
  };

  /** Abrir el detalle la marca como vista: markAsViewed() del documento. */
  const toggle = async (id: string) => {
    if (open === id) {
      setOpen(null);
      return;
    }
    setOpen(id);
    if (details[id]) return;
    setLoadingDetail(id);
    setErr(null);
    try {
      const detail = await recommendationService.detail(id);
      setDetails((prev) => ({ ...prev, [id]: detail }));
    } catch (e) {
      setErr(apiError(e));
      setOpen(null);
    } finally {
      setLoadingDetail(null);
    }
  };

  const decide = async (id: string, status: 'saved' | 'dismissed' | 'viewed') => {
    setBusy(id);
    setErr(null);
    try {
      await recommendationService.decide(id, status);
      setDetails((prev) => {
        const copy = { ...prev };
        delete copy[id];
        return copy;
      });
      setOpen(null);
      if (tab === 'foryou') reloadMain();
      else loadHistory(tab);
    } catch (e) {
      setErr(apiError(e));
    } finally {
      setBusy(null);
    }
  };

  const counts = main.data?.counts;

  const renderItem = (item: RecommendationItem, fromHistory: boolean) => {
    const isOpen = open === item.id;
    const detail = details[item.id];
    const top = item.reasons[0];

    return (
      <div key={item.id} style={{ borderBottom: '1px solid var(--gray-100)', padding: '0.7rem 0' }}>
        <button
          type="button"
          onClick={() => toggle(item.id)}
          style={{ all: 'unset', cursor: 'pointer', display: 'block', width: '100%' }}
          aria-expanded={isOpen}
        >
          <div className="flex between">
            <span className="flex" style={{ gap: '0.5rem' }}>
              {isOpen ? <FiChevronDown size={14} /> : <FiChevronRight size={14} />}
              <strong>{item.title}</strong>
            </span>
            {item.status !== 'new' && (
              <Badge tone={item.status === 'dismissed' ? 'gray' : 'bordo'}>
                {STATUS_LABEL[item.status] ?? item.status}
              </Badge>
            )}
          </div>

          {item.area && <div className="muted" style={{ fontSize: '0.8rem' }}>{item.area.name}</div>}
          {item.description && <div style={{ marginTop: '0.2rem' }}>{item.description}</div>}
          {!item.isCurrent && (
            <div className="muted" style={{ fontSize: '0.8rem' }}>
              Ya no está disponible en la plataforma.
            </div>
          )}
          {top && (
            <div style={{ color: 'var(--bordo)', fontSize: '0.82rem', marginTop: '0.35rem' }}>
              {top.label}
            </div>
          )}
        </button>

        {isOpen && loadingDetail === item.id && <Loading />}

        {isOpen && detail && (
          <div className="mt">
            <strong>Por qué te lo recomendamos</strong>
            <ul className="plain-list">
              {detail.reasons.map((r, i) => (
                <li key={`${r.code}-${i}`} className="flex between">
                  <span>{r.label}</span>
                  <strong>+{r.points}</strong>
                </li>
              ))}
            </ul>

            {detail.type === 'teammate' && (
              <p className="muted">Puedes invitarlo desde tu proyecto, en la sección Integrantes.</p>
            )}
            {!!detail.detail?.eventDate && (
              <p className="muted">
                Fecha: {new Date(detail.detail.eventDate as string).toLocaleDateString('es-BO')}
              </p>
            )}
            {!!detail.detail?.category && (
              <p className="muted">Categoría: {String(detail.detail.category)}</p>
            )}

            <div className="flex mt" style={{ gap: '0.5rem', flexWrap: 'wrap' }}>
              {item.targetLink && (
                <a
                  className="btn btn-sm btn-secondary"
                  href={item.targetLink}
                  target="_blank"
                  rel="noreferrer"
                >
                  <FiExternalLink size={14} /> Abrir enlace
                </a>
              )}

              {fromHistory || item.status === 'dismissed' ? (
                <button
                  className="btn btn-sm btn-primary"
                  onClick={() => decide(item.id, 'viewed')}
                  disabled={busy === item.id}
                >
                  Devolver a mis recomendaciones
                </button>
              ) : (
                <>
                  <button
                    className="btn btn-sm btn-primary"
                    onClick={() => decide(item.id, 'saved')}
                    disabled={busy === item.id || item.status === 'saved'}
                  >
                    {item.status === 'saved' ? 'Guardada' : 'Guardar'}
                  </button>
                  <button
                    className="btn btn-sm btn-ghost"
                    onClick={() => decide(item.id, 'dismissed')}
                    disabled={busy === item.id}
                  >
                    No me interesa
                  </button>
                </>
              )}
            </div>
          </div>
        )}
      </div>
    );
  };

  return (
    <div>
      <h1>Recomendaciones</h1>

      <div className="scope-note">
        <FiInfo size={16} />
        <span>
          Sugerencias orientativas según tu perfil y tus afinidades. No son obligatorias: tú
          decides si te sirven.
        </span>
      </div>

      {err && <div className="alert alert-error">{err}</div>}

      <div className="filters">
        {([
          { key: 'foryou', label: 'Para ti' },
          { key: 'saved', label: `Guardadas${counts?.saved ? ` (${counts.saved})` : ''}` },
          { key: 'dismissed', label: `Descartadas${counts?.dismissed ? ` (${counts.dismissed})` : ''}` },
        ] as const).map((t) => (
          <button
            key={t.key}
            className={`btn btn-sm ${tab === t.key ? 'btn-primary' : 'btn-ghost'}`}
            onClick={() => changeTab(t.key)}
          >
            {t.label}
          </button>
        ))}
      </div>

      {tab === 'foryou' && (
        <AsyncView loading={main.loading} error={main.error} data={main.data}>
          {(data) => {
            if (data.outcome === 'insufficient_profile') {
              return (
                <Card title="Todavía no podemos recomendarte">
                  <p>{data.message}</p>
                  <ul className="plain-list">
                    {HINTS.map((h) => (
                      <li key={h}>{h}</li>
                    ))}
                  </ul>
                </Card>
              );
            }
            if (data.outcome === 'no_matches') {
              return (
                <Card title="Sin recomendaciones por ahora">
                  <p>{data.message}</p>
                </Card>
              );
            }
            return (
              <>
                {data.groups.map((group) => (
                  <Card key={group.type} title={`${group.label} (${group.items.length})`}>
                    {group.items.map((item) => renderItem(item, false))}
                  </Card>
                ))}
              </>
            );
          }}
        </AsyncView>
      )}

      {tab !== 'foryou' && (
        <Card title={tab === 'saved' ? 'Recomendaciones guardadas' : 'Recomendaciones descartadas'}>
          {loadingHistory && <Loading />}
          {!loadingHistory && history && history.length === 0 && (
            <p className="muted">
              {tab === 'saved'
                ? 'Todavía no guardaste ninguna recomendación.'
                : 'No descartaste ninguna recomendación.'}
            </p>
          )}
          {!loadingHistory && history?.map((item) => renderItem(item, true))}
        </Card>
      )}
    </div>
  );
}
