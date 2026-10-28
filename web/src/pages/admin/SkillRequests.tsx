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

const RESOLUCION: Record<'alias' | 'new_skill', string> = {
  alias: 'Otro nombre de una existente',
  new_skill: 'Tecnología nueva',
};

type Modo = 'new_skill' | 'alias' | 'rejected';
interface Eleccion {
  modo: Modo;
  nombre: string;
  areaId: string;
  secundarias: string[];
  skillId: string;
  misma: boolean;
  nota: string;
}

/**
 * V4.1 A41-020 y V5-25 (§4.3, §12.4) · Pedidos de tecnologías no catalogadas.
 *
 * Una dependencia detectada en GitHub no crea una tecnología sola. Al
 * resolver el pedido, Administración elige entre dos cosas distintas:
 *  - «Es una tecnología nueva» (FastAPI, Pytest): se crea en el catálogo con
 *    su área principal y, si corresponde, secundarias.
 *  - «Es otro nombre de…» (postgres → PostgreSQL): se agrega como alias. Hay
 *    que confirmar que es la MISMA tecnología: que FastAPI use Python no hace
 *    que FastAPI sea Python.
 * O la rechaza con motivo. Cada estudiante recibe un aviso con lo que pasó.
 */
export default function AdminSkillRequestsPage() {
  const [estado, setEstado] = useState<SkillRequestItem['status']>('pending');
  const lista = useAsync(() => skillRequestService.list(estado), [estado], { cache: false });
  const skills = useAsync(() => catalogService.skills(), []);
  const areas = useAsync(() => catalogService.areas(), []);
  const [eleccion, setEleccion] = useState<Record<string, Eleccion>>({});
  const [busy, setBusy] = useState<string | null>(null);
  const toast = useToast();

  const de = (r: SkillRequestItem): Eleccion => eleccion[r.id]
    ?? { modo: 'new_skill', nombre: r.name, areaId: '', secundarias: [], skillId: '', misma: false, nota: '' };
  const alternarSecundaria = (r: SkillRequestItem, e: Eleccion, areaId: string) =>
    set(r, { secundarias: e.secundarias.includes(areaId) ? e.secundarias.filter((x) => x !== areaId) : [...e.secundarias, areaId] });
  const set = (r: SkillRequestItem, cambio: Partial<Eleccion>) =>
    setEleccion((x) => ({ ...x, [r.id]: { ...de(r), ...cambio } }));

  const decidir = async (r: SkillRequestItem) => {
    const e = de(r);
    setBusy(r.id);
    try {
      if (e.modo === 'new_skill') {
        await skillRequestService.decide(r.id, {
          decision: 'new_skill',
          newSkill: { name: e.nombre.trim() || undefined, academicAreaId: e.areaId, secondaryAreaIds: e.secundarias },
        });
        toast.success(`«${e.nombre.trim() || r.name}» se agregó al catálogo.`, 'Quien la pidió ya puede agregarla a su proyecto.');
      } else if (e.modo === 'alias') {
        await skillRequestService.decide(r.id, { decision: 'alias', skillId: e.skillId, sameTechnology: e.misma });
        const nombre = (skills.data ?? []).find((s) => s.id === e.skillId)?.name ?? 'la tecnología elegida';
        toast.success(`«${r.name}» quedó como otro nombre de «${nombre}».`, 'No se creó ninguna tecnología nueva.');
      } else {
        await skillRequestService.decide(r.id, { decision: 'rejected', note: e.nota.trim() || undefined });
        toast.success('Pedido rechazado.', 'Quien lo pidió verá el motivo.');
      }
      lista.reload();
      skills.reload();
    } catch (err) {
      toast.error(apiError(err));
    } finally {
      setBusy(null);
    }
  };

  const listo = (e: Eleccion) => (e.modo === 'new_skill' ? !!e.areaId
    : e.modo === 'alias' ? !!e.skillId && e.misma
      : e.nota.trim().length > 0);

  return (
    <div>
      <PageHeader
        title="Pedidos de tecnologías"
        description="Tecnologías que GitHub detectó en un proyecto y no están en el catálogo. Nada se agrega solo: decide si es una tecnología nueva (con su área), otro nombre de una que ya existe, o recházala con motivo."
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
                <thead><tr><th>Tecnología</th><th>Dónde se detectó</th><th>Pidió</th><th>Estado</th>{estado === 'pending' && <th>Decisión</th>}</tr></thead>
                <tbody>
                  {filas.map((r) => {
                    const e = de(r);
                    return (
                      <tr key={r.id}>
                        <td><strong>{r.name}</strong></td>
                        <td className="muted small">{r.source ?? '—'}</td>
                        <td>{r.requestedByName ?? '—'}</td>
                        <td>
                          <Badge tone={ESTADO[r.status].tone}>{ESTADO[r.status].label}</Badge>
                          {r.resolution && <div className="muted small">{RESOLUCION[r.resolution]}</div>}
                          {r.decisionNote && <div className="muted small">{r.decisionNote}</div>}
                        </td>
                        {estado === 'pending' && (
                          <td>
                            <div className="stack" style={{ gap: '0.4rem', minWidth: 260 }}>
                              <div className="chip-row" role="radiogroup" aria-label={`Decisión sobre ${r.name}`}>
                                {([
                                  ['new_skill', 'Tecnología nueva'],
                                  ['alias', 'Es otro nombre de…'],
                                  ['rejected', 'Rechazar'],
                                ] as const).map(([k, etiqueta]) => (
                                  <button key={k} type="button" role="radio" aria-checked={e.modo === k}
                                    className={`chip ${e.modo === k ? 'on' : ''}`} onClick={() => set(r, { modo: k })}>
                                    {etiqueta}
                                  </button>
                                ))}
                              </div>

                              {e.modo === 'new_skill' && (
                                <>
                                  <input aria-label="Nombre en el catálogo" value={e.nombre} onChange={(ev) => set(r, { nombre: ev.target.value })} />
                                  <select aria-label="Área principal" value={e.areaId} onChange={(ev) => set(r, { areaId: ev.target.value, secundarias: e.secundarias.filter((x) => x !== ev.target.value) })}>
                                    <option value="">Área principal…</option>
                                    {(areas.data ?? []).map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}
                                  </select>
                                  <details>
                                    <summary className="small">Áreas secundarias (opcional)</summary>
                                    <div className="chip-row">
                                      {(areas.data ?? []).filter((a) => a.id !== e.areaId).map((a) => {
                                        const on = e.secundarias.includes(a.id);
                                        return (
                                          <button key={a.id} type="button" className={`chip ${on ? 'on' : ''}`} aria-pressed={on}
                                            onClick={() => alternarSecundaria(r, e, a.id)}>
                                            {a.name}
                                          </button>
                                        );
                                      })}
                                    </div>
                                  </details>
                                </>
                              )}

                              {e.modo === 'alias' && (
                                <>
                                  <select aria-label="Tecnología del catálogo" value={e.skillId} onChange={(ev) => set(r, { skillId: ev.target.value, misma: false })}>
                                    <option value="">Es otro nombre de…</option>
                                    {(skills.data ?? []).filter((s) => s.isActive !== false).map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
                                  </select>
                                  {e.skillId && (
                                    <label className="flex small" style={{ gap: '0.35rem', alignItems: 'flex-start' }}>
                                      <input type="checkbox" checked={e.misma} onChange={(ev) => set(r, { misma: ev.target.checked })} />
                                      <span>
                                        Confirmo que «{r.name}» es la misma tecnología que «{(skills.data ?? []).find((s) => s.id === e.skillId)?.name}»,
                                        no una que la usa (FastAPI usa Python, pero no es Python).
                                      </span>
                                    </label>
                                  )}
                                </>
                              )}

                              {e.modo === 'rejected' && (
                                <input aria-label="Motivo" placeholder="Motivo (lo verá quien lo pidió)" value={e.nota} onChange={(ev) => set(r, { nota: ev.target.value })} />
                              )}

                              <div className="flex" style={{ gap: '0.35rem' }}>
                                <Button size="sm" variant={e.modo === 'rejected' ? 'secondary' : 'primary'}
                                  icon={e.modo === 'rejected' ? <FiX size={13} /> : <FiCheck size={13} />}
                                  loading={busy === r.id} disabled={!listo(e)} onClick={() => void decidir(r)}>
                                  {e.modo === 'new_skill' ? 'Agregar al catálogo' : e.modo === 'alias' ? 'Registrar como alias' : 'Rechazar'}
                                </Button>
                              </div>
                            </div>
                          </td>
                        )}
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </AsyncView>
      </Card>
    </div>
  );
}
