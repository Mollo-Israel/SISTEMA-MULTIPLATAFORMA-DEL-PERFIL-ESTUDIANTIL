import { useState } from 'react';
import { apiError } from '../../api/client';
import { affinityService } from '../../services';
import { useAsync } from '../../hooks/useAsync';
import { AsyncView, Card, Badge } from '../../components/ui';
import { AffinityBars } from '../../components/charts';
import { AFFINITY_BADGE, AFFINITY_LEVEL_LABEL, lbl } from '../../constants';

export default function StudentAffinityPage() {
  const { data, loading, error, reload, setData } = useAsync(() => affinityService.mine(), []);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const recalc = async () => {
    setBusy(true); setErr(null);
    try { const r = await affinityService.recalculateMine(); setData(r); } catch (e) { setErr(apiError(e)); } finally { setBusy(false); }
  };

  return (
    <div>
      <div className="flex between">
        <h1>Áreas de afinidad</h1>
        <button className="btn btn-primary" onClick={recalc} disabled={busy}>{busy ? 'Recalculando…' : 'Recalcular afinidad'}</button>
      </div>
      <p className="muted">Orientación académica calculada con reglas y puntuación. No representa rendimiento ni notas.</p>
      {err && <div className="alert alert-error">{err}</div>}

      <Card>
        <AsyncView loading={loading} error={error} data={data} isEmpty={(d) => d.length === 0} emptyMessage="Sin afinidades. Agrega intereses, habilidades y proyectos, luego recalcula.">
          {(items) => (
            <>
            <div style={{ marginBottom: '1rem' }}>
              <AffinityBars data={items.map((a) => ({ area: a.academicArea?.name ?? '—', score: Number(a.score), level: a.level }))} />
            </div>
            <table>
              <thead><tr><th>Área académica</th><th>Puntuación</th><th>Nivel</th></tr></thead>
              <tbody>
                {items.map((a) => (
                  <tr key={a.id}>
                    <td>{a.academicArea?.name ?? a.academicAreaId}</td>
                    <td>{a.score}</td>
                    <td><Badge tone={(AFFINITY_BADGE[a.level] ?? 'badge-gray').replace('badge-', '')}>{lbl(AFFINITY_LEVEL_LABEL, a.level)}</Badge></td>
                  </tr>
                ))}
              </tbody>
            </table>
            </>
          )}
        </AsyncView>
      </Card>
    </div>
  );
}
