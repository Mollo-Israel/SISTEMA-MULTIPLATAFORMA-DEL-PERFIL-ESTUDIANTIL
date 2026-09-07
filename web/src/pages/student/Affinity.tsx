import { useState } from 'react';
import { apiError } from '../../api/client';
import { affinityService, AffinitySnapshotView, AffinityWeightRow } from '../../services';
import { useAsync } from '../../hooks/useAsync';
import { AsyncView, Card, Badge } from '../../components/ui';
import { AffinityBars } from '../../components/charts';
import {
  AffinityDisclaimer,
  AffinityInsufficient,
  AffinityRanking,
  formatDateTime,
} from '../../components/affinity';
import { AFFINITY_BADGE, AFFINITY_LEVEL_LABEL, lbl } from '../../constants';

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
  const [err, setErr] = useState<string | null>(null);

  const [tab, setTab] = useState<'areas' | 'history' | 'rules'>('areas');
  const [history, setHistory] = useState<AffinitySnapshotView[] | null>(null);
  const [weights, setWeights] = useState<AffinityWeightRow[] | null>(null);

  const reloadSummary = summaryState.reload;

  const recalc = async () => {
    setBusy(true);
    setErr(null);
    try {
      await affinityService.recalculateMine();
      reloadSummary();
      setHistory(null);
    } catch (e) {
      setErr(apiError(e));
    } finally {
      setBusy(false);
    }
  };

  const openTab = async (next: 'areas' | 'history' | 'rules') => {
    setTab(next);
    setErr(null);
    try {
      if (next === 'history' && !history) setHistory(await affinityService.history(10));
      if (next === 'rules' && !weights) setWeights(await affinityService.weights());
    } catch (e) {
      setErr(apiError(e));
    }
  };

  return (
    <div>
      <div className="flex between">
        <h1>Mis afinidades</h1>
        <button className="btn btn-primary" onClick={recalc} disabled={busy}>
          {busy ? 'Recalculando…' : 'Recalcular afinidad'}
        </button>
      </div>

      <AffinityDisclaimer />
      {err && <div className="alert alert-error">{err}</div>}

      <div className="filters">
        {([
          { key: 'areas', label: 'Áreas' },
          { key: 'history', label: 'Evolución' },
          { key: 'rules', label: 'Cómo se calcula' },
        ] as const).map((t) => (
          <button
            key={t.key}
            className={`btn btn-sm ${tab === t.key ? 'btn-primary' : 'btn-ghost'}`}
            onClick={() => openTab(t.key)}
          >
            {t.label}
          </button>
        ))}
      </div>

      {tab === 'areas' && (
        <AsyncView
          loading={summaryState.loading}
          error={summaryState.error}
          data={summaryState.data}
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
          {!history && <p className="muted">Cargando…</p>}
          {history && history.length === 0 && (
            <p className="muted">Todavía no hay cálculos registrados.</p>
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
        <Card title="Ponderaciones del motor">
          <p className="muted">
            Reglas con las que el sistema calcula la afinidad. Son configuración del sistema y se
            consultan solo de lectura.
          </p>
          {!weights && <p className="muted">Cargando…</p>}
          {weights && (
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
                  {weights.map((w) => (
                    <tr key={w.code}>
                      <td>{w.label}</td>
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
