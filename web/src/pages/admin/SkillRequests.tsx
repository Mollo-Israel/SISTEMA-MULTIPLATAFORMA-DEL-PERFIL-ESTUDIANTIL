import { useState } from 'react';
import { FiCheck, FiCpu, FiX } from 'react-icons/fi';
import { apiError } from '../../api/client';
import { catalogService, skillRequestService } from '../../services';
import type { SkillRequestItem } from '../../services';
import { useAsync } from '../../hooks/useAsync';
import { AsyncView, Badge, Button, Card, EmptyState, PageHeader, SkeletonTable } from '../../components/ui';
import { useToast } from '../../components/feedback';

const ESTADO: Record<SkillRequestItem['status'], { label: string; tone: string }> = {
  pending: { label: 'Por decidir', tone: 'amber' },
  added: { label: 'Agregada', tone: 'green' },
  rejected: { label: 'Rechazada', tone: 'gray' },
};

/**
 * V4.1 A41-020 (§11.2, §11.4) · Pedidos de tecnologías no catalogadas.
 *
 * Una dependencia detectada en GitHub no crea una tecnología sola. El
 * estudiante pide evaluarla; Administración la crea antes en «Áreas y
 * habilidades» (con su área y alias) y aquí la vincula, o rechaza con motivo.
 */
export default function AdminSkillRequestsPage() {
  const [estado, setEstado] = useState<SkillRequestItem['status']>('pending');
  const lista = useAsync(() => skillRequestService.list(estado), [estado], { cache: false });
  const skills = useAsync(() => catalogService.skills(), []);
  const [eleccion, setEleccion] = useState<Record<string, { skillId: string; note: string }>>({});
  const [busy, setBusy] = useState<string | null>(null);
  const toast = useToast();

  const decidir = async (r: SkillRequestItem, decision: 'added' | 'rejected') => {
    const e = eleccion[r.id] ?? { skillId: '', note: '' };
    setBusy(r.id);
    try {
      await skillRequestService.decide(r.id, { decision, skillId: e.skillId || undefined, note: e.note.trim() || undefined });
      toast.success(decision === 'added' ? 'Pedido resuelto: tecnología vinculada.' : 'Pedido rechazado.');
      lista.reload();
    } catch (err) {
      toast.error(apiError(err));
    } finally {
      setBusy(null);
    }
  };
  const set = (id: string, campo: 'skillId' | 'note', v: string) =>
    setEleccion((x) => ({ ...x, [id]: { ...(x[id] ?? { skillId: '', note: '' }), [campo]: v } }));

  return (
    <div>
      <PageHeader
        title="Pedidos de tecnologías"
        description="Tecnologías que GitHub detectó en un proyecto y no están en el catálogo. Nada se agrega solo: créala en «Áreas y habilidades» con su área y alias, y vincúlala aquí; o recházala con motivo."
      />
      <Card
        title="Pedidos"
        actions={
          <select aria-label="Estado" value={estado} onChange={(e) => setEstado(e.target.value as typeof estado)}>
            <option value="pending">Por decidir</option>
            <option value="added">Agregadas</option>
            <option value="rejected">Rechazadas</option>
          </select>
        }
      >
        <AsyncView
          loading={lista.loading}
          error={lista.error}
          data={lista.data}
          skeleton={<SkeletonTable rows={3} columns={4} />}
          isEmpty={(d) => d.length === 0}
          empty={<EmptyState icon={<FiCpu size={22} />} message="No hay pedidos." />}
        >
          {(filas) => (
            <div className="table-scroll">
              <table>
                <thead><tr><th>Tecnología</th><th>Dónde se detectó</th><th>Pidió</th><th>Estado</th>{estado === 'pending' && <th></th>}</tr></thead>
                <tbody>
                  {filas.map((r) => (
                    <tr key={r.id}>
                      <td><strong>{r.name}</strong></td>
                      <td className="muted small">{r.source ?? '—'}</td>
                      <td>{r.requestedByName ?? '—'}</td>
                      <td>
                        <Badge tone={ESTADO[r.status].tone}>{ESTADO[r.status].label}</Badge>
                        {r.decisionNote && <div className="muted small">{r.decisionNote}</div>}
                      </td>
                      {estado === 'pending' && (
                        <td>
                          <div className="stack" style={{ gap: '0.35rem', minWidth: 220 }}>
                            <select aria-label="Tecnología del catálogo" value={eleccion[r.id]?.skillId ?? ''} onChange={(e) => set(r.id, 'skillId', e.target.value)}>
                              <option value="">Vincular con…</option>
                              {(skills.data ?? []).filter((s) => s.isActive !== false).map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
                            </select>
                            <input aria-label="Motivo" placeholder="Motivo (obligatorio al rechazar)" value={eleccion[r.id]?.note ?? ''} onChange={(e) => set(r.id, 'note', e.target.value)} />
                            <div className="flex" style={{ gap: '0.35rem' }}>
                              <Button size="sm" icon={<FiCheck size={13} />} loading={busy === r.id} disabled={!eleccion[r.id]?.skillId} onClick={() => decidir(r, 'added')}>Vincular</Button>
                              <Button size="sm" variant="secondary" icon={<FiX size={13} />} disabled={busy === r.id} onClick={() => decidir(r, 'rejected')}>Rechazar</Button>
                            </div>
                          </div>
                        </td>
                      )}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </AsyncView>
      </Card>
    </div>
  );
}
