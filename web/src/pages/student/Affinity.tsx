import { useMemo, useState } from 'react';
import { FiActivity, FiRefreshCw, FiSearch, FiSliders } from 'react-icons/fi';
import { apiError } from '../../api/client';
import { affinityService, AffinitySnapshotView, AffinityWeightRow } from '../../services';
import { useAsync } from '../../hooks/useAsync';
import {
  AsyncView, Badge, Button, Card, EmptyState, PageHeader, ResultCount, SearchInput,
  SkeletonCards, SkeletonTable, Tabs,
} from '../../components/ui';
import { useConfirm, useToast } from '../../components/feedback';
import { AffinityBars } from '../../components/charts';
import {
  AffinityDisclaimer,
  AffinityInsufficient,
  AffinityRanking,
  formatDateTime,
} from '../../components/affinity';
import { AFFINITY_BADGE, AFFINITY_LEVEL_LABEL, lbl } from '../../constants';

const normalize = (s: string) =>
  s.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');

/**
 * Areas de afinidad del estudiante en el panel web (RF17).
 *
 * RF17 asigna el requerimiento a la pantalla movil, pero el estudiante tambien
 * tiene panel web y no tendria sentido que ahi viera menos. Muestra lo mismo:
 * ranking con nivel, el desglose que lo explica, la evolucion y las reglas.
 */
export default function StudentAffinityPage() {
  const summaryState = useAsync(() => affinityService.summary(), []);
  const [busy, setBusy] = useState(false);
  const toast = useToast();
  const confirm = useConfirm();

  const [tab, setTab] = useState<'areas' | 'history' | 'rules'>('areas');
  const [history, setHistory] = useState<AffinitySnapshotView[] | null>(null);
  const [weights, setWeights] = useState<AffinityWeightRow[] | null>(null);
  const [weightQuery, setWeightQuery] = useState('');

  const reloadSummary = summaryState.reload;

  const visibleWeights = useMemo(() => {
    if (!weights) return [];
    const q = normalize(weightQuery.trim());
    if (!q) return weights;
    return weights.filter((w) =>
      [w.label ?? '', w.description ?? ''].some((f) => normalize(f).includes(q)),
    );
  }, [weights, weightQuery]);

  const recalc = async () => {
    const ok = await confirm({
      title: 'Recalcular afinidad',
      message:
        'Se volverán a calcular tus áreas con la información que tienes registrada hoy. '
        + 'El resultado anterior queda guardado en la pestaña «Evolución».',
      confirmLabel: 'Recalcular',
    });
    if (!ok) return;
    setBusy(true);
    try {
      await affinityService.recalculateMine();
      reloadSummary();
      setHistory(null);
      toast.success('Afinidad recalculada', 'Tus áreas reflejan tu información más reciente.');
    } catch (e) {
      toast.error(apiError(e));
    } finally {
      setBusy(false);
    }
  };

  const openTab = async (next: 'areas' | 'history' | 'rules') => {
    setTab(next);
    try {
      if (next === 'history' && !history) setHistory(await affinityService.history(10));
      if (next === 'rules' && !weights) setWeights(await affinityService.weights());
    } catch (e) {
      toast.error(apiError(e));
    }
  };

  return (
    <div>
      <PageHeader
        title="Mis afinidades"
        description="Las áreas con las que más se relaciona lo que declaras y lo que haces en la plataforma."
        actions={
          <Button loading={busy} onClick={recalc} icon={<FiRefreshCw size={15} />}>
            Recalcular afinidad
          </Button>
        }
      />

      <AffinityDisclaimer />

      <Tabs
        value={tab}
        onChange={(key) => openTab(key as 'areas' | 'history' | 'rules')}
        items={[
          { key: 'areas', label: 'Áreas' },
          { key: 'history', label: 'Evolución' },
          { key: 'rules', label: 'Cómo se calcula' },
        ]}
      />

      {tab === 'areas' && (
        <AsyncView
          loading={summaryState.loading}
          error={summaryState.error}
          data={summaryState.data}
          skeleton={<SkeletonCards count={2} />}
        >
          {(summary) =>
            summary.status === 'insufficient_data' ? (
              <Card>
                <AffinityInsufficient message={summary.message} />
              </Card>
            ) : (
              <>
                <Card>
                  <div className="flex between">
                    <span className="muted">
                      {summary.areas.length} áreas · {summary.signalsCount} señales consideradas
                    </span>
                    <span className="muted">
                      Último cálculo: {formatDateTime(summary.calculatedAt)}
                    </span>
                  </div>
                  <div style={{ marginTop: '1rem' }}>
                    <AffinityBars
                      data={summary.areas.map((a) => ({
                        area: a.area ?? '—',
                        score: a.score,
                        level: a.level,
                      }))}
                    />
                  </div>
                </Card>

                <Card title="Ranking y desglose">
                  <AffinityRanking
                    summary={summary}
                    loadBreakdown={(areaId) => affinityService.breakdown(areaId)}
                  />
                </Card>
              </>
            )
          }
        </AsyncView>
      )}

      {tab === 'history' && (
        <Card title="Evolución de tus afinidades">
          <p className="muted">
            Historial de los cálculos registrados. No es una predicción de resultados académicos.
          </p>
          {!history && <SkeletonTable rows={4} columns={6} />}
          {history && history.length === 0 && (
            <EmptyState
              icon={<FiActivity size={22} />}
              message="Todavía no hay cálculos registrados. Recalcula tu afinidad para empezar el historial."
            />
          )}
          {history && history.length > 0 && (
            <div className="scroll-x">
              <table>
                <thead>
                  <tr>
                    <th>Fecha</th>
                    <th>Áreas</th>
                    <th>Señales</th>
                    <th>Total</th>
                    <th>Área más afín</th>
                    <th>Variación</th>
                  </tr>
                </thead>
                <tbody>
                  {history.map((s, i) => {
                    const previous = history[i + 1];
                    const delta = previous ? s.totalScore - previous.totalScore : null;
                    const top = s.areas[0];
                    return (
                      <tr key={s.id}>
                        <td>{formatDateTime(s.calculatedAt)}</td>
                        <td>{s.areasCount}</td>
                        <td>{s.signalsCount}</td>
                        <td>{s.totalScore}</td>
                        <td>
                          {top ? (
                            <Badge
                              tone={(AFFINITY_BADGE[top.level] ?? 'badge-gray').replace('badge-', '')}
                            >
                              {top.area}: {top.score} · {lbl(AFFINITY_LEVEL_LABEL, top.level)}
                            </Badge>
                          ) : (
                            <span className="muted">sin datos suficientes</span>
                          )}
                        </td>
                        <td>
                          {delta === null || delta === 0 ? (
                            <span className="muted">—</span>
                          ) : (
                            <span>{delta > 0 ? `+${delta}` : delta}</span>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </Card>
      )}

      {tab === 'rules' && (
        <Card
          title="Ponderaciones del motor"
          actions={
            weights && (
              <div className="flex" style={{ gap: '0.6rem' }}>
                <SearchInput
                  value={weightQuery}
                  onChange={setWeightQuery}
                  placeholder="Buscar señal…"
                />
                <ResultCount shown={visibleWeights.length} total={weights.length} noun="reglas" />
              </div>
            )
          }
        >
          <p className="muted">
            Reglas con las que el sistema calcula la afinidad. Son configuración del sistema y se
            consultan solo de lectura.
          </p>
          {!weights && <SkeletonTable rows={5} columns={3} />}
          {weights && visibleWeights.length === 0 && (
            <EmptyState
              icon={<FiSearch size={22} />}
              message={`Ninguna regla coincide con “${weightQuery}”.`}
              action={
                <Button variant="secondary" size="sm" onClick={() => setWeightQuery('')}>
                  Limpiar búsqueda
                </Button>
              }
            />
          )}
          {weights && visibleWeights.length > 0 && (
            <div className="scroll-x">
              <table>
                <thead>
                  <tr>
                    <th>Señal</th>
                    <th>Justificación</th>
                    <th style={{ textAlign: 'right' }}>Puntos</th>
                  </tr>
                </thead>
                <tbody>
                  {visibleWeights.map((w) => (
                    <tr key={w.code}>
                      <td className="flex" style={{ gap: '0.45rem' }}>
                        <FiSliders size={13} /> {w.label}
                      </td>
                      <td className="muted">{w.description}</td>
                      <td style={{ textAlign: 'right' }}>{w.points}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Card>
      )}
    </div>
  );
}
