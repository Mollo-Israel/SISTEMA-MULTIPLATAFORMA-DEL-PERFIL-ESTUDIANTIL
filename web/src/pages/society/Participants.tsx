import { Link } from 'react-router-dom';
import { useMemo, useState } from 'react';
import { FiEyeOff } from 'react-icons/fi';
import { analyticsService, type SocietyMetrics } from '../../services';
import { useAsync } from '../../hooks/useAsync';
import { ACTIVITY_STATUS_LABEL, lbl } from '../../constants';
import { AsyncView, Badge, Card, EmptyState, PageHeader, SearchInput, SkeletonTable } from '../../components/ui';

const FECHA = (v: string | null | undefined) =>
  v ? new Date(v).toLocaleDateString('es-BO', { day: 'numeric', month: 'short', year: 'numeric' }) : '—';

/**
 * Participantes (V3 §53): por cada actividad propia, cuántos se inscribieron,
 * cuántos se confirmaron y cuántos faltaron, con un clic a la lista para
 * confirmar asistencia. La lista nominal se ve solo dentro de la actividad.
 */
export default function SocietyParticipantsPage() {
  const state = useAsync(() => analyticsService.societyMetrics(), []);
  const [q, setQ] = useState('');
  const [soloPendientes, setSoloPendientes] = useState(false);

  return (
    <div>
      <PageHeader
        title="Participantes"
        description="Quién se inscribió en tus actividades y a quién falta confirmar."
      />
      <AsyncView loading={state.loading} error={state.error} data={state.data} skeleton={<SkeletonTable rows={5} columns={5} />}>
        {(m: SocietyMetrics) => <Lista m={m} q={q} setQ={setQ} soloPendientes={soloPendientes} setSoloPendientes={setSoloPendientes} />}
      </AsyncView>
    </div>
  );
}

function Lista({ m, q, setQ, soloPendientes, setSoloPendientes }: {
  m: SocietyMetrics; q: string; setQ: (v: string) => void; soloPendientes: boolean; setSoloPendientes: (v: boolean) => void;
}) {
  const filas = useMemo(() => m.activities
    .filter((a) => !q || (a.title ?? '').toLowerCase().includes(q.toLowerCase()))
    .filter((a) => !soloPendientes || ((a.registrations ?? 0) - (a.confirmed ?? 0) - (a.absent ?? 0)) > 0), [m, q, soloPendientes]);
  return (
    <Card
      title="Por actividad"
      actions={
        <div className="flex" style={{ gap: '0.6rem', flexWrap: 'wrap', alignItems: 'center' }}>
          <SearchInput value={q} onChange={setQ} placeholder="Buscar actividad…" />
          <label className="flex" style={{ gap: '0.35rem', alignItems: 'center' }}>
            <input type="checkbox" checked={soloPendientes} onChange={(e) => setSoloPendientes(e.target.checked)} />
            Con asistencia por confirmar
          </label>
        </div>
      }
    >
      {filas.length === 0 ? (
        <EmptyState message={m.activities.length === 0 ? 'Todavía no organizaste ninguna actividad.' : 'Ninguna actividad coincide.'} />
      ) : (
        <div className="scroll-x">
          <table>
            <thead>
              <tr>
                <th>Actividad</th><th>Fecha</th><th>Estado</th>
                <th style={{ textAlign: 'right' }}>Inscritos</th>
                <th style={{ textAlign: 'right' }}>Confirmados</th>
                <th style={{ textAlign: 'right' }}>Ausentes</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {filas.map((a) => (
                <tr key={a.activityId}>
                  <td>{a.title}</td>
                  <td className="muted">{FECHA(a.eventDate)}</td>
                  <td><Badge tone="gray">{lbl(ACTIVITY_STATUS_LABEL, a.status ?? '')}</Badge></td>
                  <td style={{ textAlign: 'right' }}>{a.registrations}</td>
                  {a.suppressed ? (
                    <td className="muted sin-desglose" colSpan={2}><FiEyeOff size={12} /> {a.reason}</td>
                  ) : (
                    <>
                      <td style={{ textAlign: 'right' }}>{a.confirmed}</td>
                      <td style={{ textAlign: 'right' }}>{a.absent ?? 0}</td>
                    </>
                  )}
                  <td><Link to={`/society/activities?actividad=${a.activityId}`} className="btn btn-ghost btn-sm">Ver y confirmar</Link></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </Card>
  );
}
