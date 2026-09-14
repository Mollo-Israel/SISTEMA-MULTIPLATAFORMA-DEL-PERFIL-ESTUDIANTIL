import { useCallback, useState } from 'react';
import {
  FiBookmark, FiChevronDown, FiChevronRight, FiCompass, FiCornerUpLeft, FiExternalLink,
  FiInfo, FiSearch, FiSlash,
} from 'react-icons/fi';
import { apiError } from '../../api/client';
import {
  recommendationService,
  RecommendationDetail,
  RecommendationItem,
  RecommendationsResponse,
} from '../../services';
import { useAsync } from '../../hooks/useAsync';
import {
  AsyncView, Badge, Button, Card, EmptyState, Loading, PageHeader, ResultCount, SearchInput,
  SkeletonCards, Stagger, Tabs,
} from '../../components/ui';
import { useConfirm, useToast } from '../../components/feedback';

const normalize = (s: string) =>
  s.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');


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
  const [busy, setBusy] = useState<string | null>(null);
  const [query, setQuery] = useState('');
  const toast = useToast();
  const confirm = useConfirm();

  const [open, setOpen] = useState<string | null>(null);
  const [details, setDetails] = useState<Record<string, RecommendationDetail>>({});
  const [loadingDetail, setLoadingDetail] = useState<string | null>(null);

  const [history, setHistory] = useState<RecommendationItem[] | null>(null);
  const [loadingHistory, setLoadingHistory] = useState(false);

  const main = useAsync<RecommendationsResponse>(() => recommendationService.mine(), []);
  const reloadMain = main.reload;

  const loadHistory = useCallback(async (status: 'saved' | 'dismissed') => {
    setLoadingHistory(true);
    try {
      setHistory(await recommendationService.history(status));
    } catch (e) {
      toast.error(apiError(e));
    } finally {
      setLoadingHistory(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const changeTab = (next: Tab) => {
    setTab(next);
    setOpen(null);
    setHistory(null);
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
    try {
      const detail = await recommendationService.detail(id);
      setDetails((prev) => ({ ...prev, [id]: detail }));
    } catch (e) {
      toast.error(apiError(e));
      setOpen(null);
    } finally {
      setLoadingDetail(null);
    }
  };

  const DECISION_MESSAGE: Record<string, string> = {
    saved: 'Recomendación guardada. La encuentras en la pestaña «Guardadas».',
    dismissed: 'Recomendación descartada. Puedes recuperarla desde «Descartadas».',
    viewed: 'Recomendación devuelta a «Para ti».',
  };

  const decide = async (id: string, status: 'saved' | 'dismissed' | 'viewed') => {
    setBusy(id);
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
      toast.success(DECISION_MESSAGE[status]);
    } catch (e) {
      toast.error(apiError(e));
    } finally {
      setBusy(null);
    }
  };

  /** Descartar saca la recomendacion de la vista: se confirma antes. */
  const dismiss = async (item: RecommendationItem) => {
    const ok = await confirm({
      title: 'Descartar recomendación',
      message: (
        <>
          Dejaremos de mostrarte <strong>{item.title}</strong> entre tus sugerencias. Podrás
          recuperarla desde la pestaña «Descartadas».
        </>
      ),
      confirmLabel: 'No me interesa',
    });
    if (ok) decide(item.id, 'dismissed');
  };

  const counts = main.data?.counts;

  const q = normalize(query.trim());
  const matches = (item: RecommendationItem) =>
    !q
    || [item.title, item.description ?? '', item.area?.name ?? '']
      .some((field) => normalize(field).includes(q));
  const historyRows = (history ?? []).filter(matches);

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
                <Button
                  size="sm"
                  loading={busy === item.id}
                  onClick={() => decide(item.id, 'viewed')}
                  icon={<FiCornerUpLeft size={14} />}
                >
                  Devolver a mis recomendaciones
                </Button>
              ) : (
                <>
                  <Button
                    size="sm"
                    loading={busy === item.id}
                    disabled={item.status === 'saved'}
                    onClick={() => decide(item.id, 'saved')}
                    icon={<FiBookmark size={14} />}
                  >
                    {item.status === 'saved' ? 'Guardada' : 'Guardar'}
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    loading={busy === item.id}
                    onClick={() => dismiss(item)}
                    icon={<FiSlash size={14} />}
                  >
                    No me interesa
                  </Button>
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
      <PageHeader
        title="Recomendaciones"
        description="Actividades, oportunidades y compañeros sugeridos a partir de tu perfil."
        actions={
          <SearchInput
            value={query}
            onChange={setQuery}
            placeholder="Buscar recomendación…"
          />
        }
      />

      <div className="scope-note">
        <FiInfo size={16} />
        <span>
          Sugerencias orientativas según tu perfil y tus afinidades. No son obligatorias: tú
          decides si te sirven.
        </span>
      </div>

      <Tabs
        value={tab}
        onChange={(key) => changeTab(key as Tab)}
        items={[
          { key: 'foryou', label: 'Para ti' },
          { key: 'saved', label: 'Guardadas', count: counts?.saved },
          { key: 'dismissed', label: 'Descartadas', count: counts?.dismissed },
        ]}
      />

      {tab === 'foryou' && (
        <AsyncView
          loading={main.loading}
          error={main.error}
          data={main.data}
          skeleton={<SkeletonCards count={3} />}
        >
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
            const groups = data.groups
              .map((group) => ({ ...group, items: group.items.filter(matches) }))
              .filter((group) => group.items.length > 0);
            const total = data.groups.reduce((n, group) => n + group.items.length, 0);
            const shown = groups.reduce((n, group) => n + group.items.length, 0);
            if (shown === 0) {
              return (
                <EmptyState
                  icon={<FiSearch size={22} />}
                  message={`Ninguna recomendación coincide con “${query}”.`}
                  action={
                    <Button variant="secondary" size="sm" onClick={() => setQuery('')}>
                      Limpiar búsqueda
                    </Button>
                  }
                />
              );
            }
            return (
              <>
                <div className="flex" style={{ marginBottom: '0.7rem' }}>
                  <ResultCount shown={shown} total={total} noun="recomendaciones" />
                </div>
                {groups.map((group, index) => (
                  <Stagger key={group.type} index={index}>
                    <Card title={`${group.label} (${group.items.length})`}>
                      {group.items.map((item) => renderItem(item, false))}
                    </Card>
                  </Stagger>
                ))}
              </>
            );
          }}
        </AsyncView>
      )}

      {tab !== 'foryou' && (
        <Card
          title={tab === 'saved' ? 'Recomendaciones guardadas' : 'Recomendaciones descartadas'}
          actions={
            history && history.length > 0 ? (
              <ResultCount
                shown={historyRows.length}
                total={history.length}
                noun="recomendaciones"
              />
            ) : undefined
          }
        >
          {loadingHistory && <SkeletonCards count={2} />}
          {!loadingHistory && history && history.length === 0 && (
            <EmptyState
              icon={<FiCompass size={22} />}
              message={
                tab === 'saved'
                  ? 'Todavía no guardaste ninguna recomendación.'
                  : 'No descartaste ninguna recomendación.'
              }
            />
          )}
          {!loadingHistory && history && history.length > 0 && historyRows.length === 0 && (
            <EmptyState
              icon={<FiSearch size={22} />}
              message={`Ninguna recomendación coincide con “${query}”.`}
              action={
                <Button variant="secondary" size="sm" onClick={() => setQuery('')}>
                  Limpiar búsqueda
                </Button>
              }
            />
          )}
          {!loadingHistory && historyRows.map((item) => renderItem(item, true))}
        </Card>
      )}
    </div>
  );
}
