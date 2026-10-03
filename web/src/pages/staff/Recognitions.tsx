import { useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { FiAward, FiCheck, FiGift, FiPlus, FiStar, FiX } from 'react-icons/fi';
import { apiError } from '../../api/client';
import { catalogService, gamificationService } from '../../services';
import { useAsync } from '../../hooks/useAsync';
import type { ChallengeItem } from '../../services/types';
import {
  AsyncView, Badge, Button, Card, EmptyState, Modal, PageHeader, SkeletonTable, Tabs,
} from '../../components/ui';
import { FormAlert, FormField, useFormErrors } from '../../components/form';
import { useToast } from '../../components/feedback';
import { catalogName, integerRange, optionalText, validate } from '../../lib/validators';

type Pestana = 'retos' | 'recompensas' | 'canjes';
const PERIODO_LABEL = { week: 'Esta semana', month: 'Este mes', year: 'Este año' } as const;

/**
 * Retos y recompensas (correcciones de QA, §66).
 *
 * El docente decide qué premiar en su curso: crea un reto con sus puntos y lo
 * reconoce a sus estudiantes. Los puntos se canjean por las recompensas que él
 * mismo ofrece. Nada de esto toca la afinidad, y solo ve los puntos de los
 * estudiantes que acompaña: no hay tabla pública.
 */
export default function RecognitionsPage() {
  const [params, setParams] = useSearchParams();
  const tab = (['retos', 'recompensas', 'canjes'].includes(params.get('tab') ?? '') ? params.get('tab') : 'retos') as Pestana;
  return (
    <div>
      <PageHeader
        title="Retos y recompensas"
        description="Premia lo que tus estudiantes logran: crea retos con puntos, reconócelos y ofrece recompensas por las que puedan canjearlos. Los puntos motivan; no cambian su afinidad."
      />
      <Tabs
        items={[
          { key: 'retos', label: 'Retos' },
          { key: 'recompensas', label: 'Recompensas' },
          { key: 'canjes', label: 'Canjes' },
        ]}
        value={tab}
        onChange={(k) => setParams(k === 'retos' ? {} : { tab: k }, { replace: true })}
      />
      {tab === 'retos' ? <RetosTab /> : tab === 'recompensas' ? <RecompensasTab /> : <CanjesTab />}
    </div>
  );
}

// ===========================================================================

const CAMPOS_RETO = ['title', 'points', 'academicAreaId', 'description'] as const;
type CampoReto = (typeof CAMPOS_RETO)[number];

function RetosTab() {
  const retos = useAsync(() => gamificationService.challenges(), []);
  const areas = useAsync(() => catalogService.areas(), []);
  const [periodo, setPeriodo] = useState<'week' | 'month' | 'year'>('month');
  const puntos = useAsync(() => gamificationService.scopePoints(periodo), [periodo]);
  const [form, setForm] = useState<Record<CampoReto, string>>({ title: '', points: '10', academicAreaId: '', description: '' });
  const [saving, setSaving] = useState(false);
  const [reconocer, setReconocer] = useState<ChallengeItem | null>(null);
  const errores = useFormErrors(CAMPOS_RETO);
  const toast = useToast();

  const set = (c: CampoReto, v: string) => {
    setForm((f) => ({ ...f, [c]: v }));
    errores.clear(c);
  };

  const crear = async (e: React.FormEvent) => {
    e.preventDefault();
    const locales = validate(form, {
      title: catalogName('del reto'),
      points: integerRange(1, 100, 'Los puntos'),
      description: optionalText(400),
    });
    if (Object.keys(locales).length) {
      errores.setErrors(locales);
      return;
    }
    setSaving(true);
    try {
      await gamificationService.createChallenge({
        title: form.title.trim(),
        points: Number(form.points),
        academicAreaId: form.academicAreaId || undefined,
        description: form.description.trim() || undefined,
      });
      toast.success('Reto creado.', 'Ahora puedes reconocerlo a tus estudiantes.');
      setForm({ title: '', points: '10', academicAreaId: '', description: '' });
      errores.reset();
      retos.reload();
    } catch (e2) {
      errores.fromApi(e2);
    } finally {
      setSaving(false);
    }
  };

  const alternar = async (r: ChallengeItem) => {
    try {
      await gamificationService.updateChallenge(r.id, { isActive: !r.isActive });
      retos.reload();
    } catch (e) {
      toast.error(apiError(e));
    }
  };

  return (
    <>
      <Card title="Nuevo reto">
        <form onSubmit={crear} noValidate>
          <FormAlert message={errores.general} />
          <div className="row">
            <FormField label="Qué hay que lograr" required error={errores.errors.title}>
              <input value={form.title} onChange={(e) => set('title', e.target.value)} placeholder="Laboratorio de SQL completo" />
            </FormField>
            <FormField label="Puntos" required error={errores.errors.points} hint="De 1 a 100.">
              <input
                inputMode="numeric"
                value={form.points}
                onChange={(e) => set('points', e.target.value.replace(/[^\d]/g, '').slice(0, 3))}
              />
            </FormField>
            <FormField label="Área (opcional)" error={errores.errors.academicAreaId}>
              <select value={form.academicAreaId} onChange={(e) => set('academicAreaId', e.target.value)}>
                <option value="">Cualquiera</option>
                {(areas.data ?? []).filter((a) => a.isActive).map((a) => (
                  <option key={a.id} value={a.id}>{a.name}</option>
                ))}
              </select>
            </FormField>
          </div>
          <FormField label="Descripción (opcional)" error={errores.errors.description}>
            <textarea value={form.description} onChange={(e) => set('description', e.target.value)} placeholder="Qué tiene que hacer el estudiante para conseguirlo." />
          </FormField>
          <Button type="submit" loading={saving} icon={<FiPlus size={15} />}>Crear reto</Button>
        </form>
      </Card>

      <Card title="Tus retos">
        <AsyncView
          loading={retos.loading}
          error={retos.error}
          data={retos.data}
          skeleton={<SkeletonTable rows={3} columns={4} />}
          isEmpty={(d) => d.length === 0}
          empty={<EmptyState icon={<FiStar size={22} />} message="Todavía no creaste retos." />}
        >
          {(lista) => (
            <div className="table-scroll">
              <table>
                <thead>
                  <tr><th>Reto</th><th>Puntos</th><th>Área</th><th>Estado</th><th></th></tr>
                </thead>
                <tbody>
                  {lista.map((r) => (
                    <tr key={r.id} className={r.isActive ? '' : 'is-inactive'}>
                      <td><strong>{r.title}</strong>{r.description && <div className="muted small">{r.description}</div>}</td>
                      <td><Badge tone="bordo">+{r.points}</Badge></td>
                      <td className="muted">{r.academicArea?.name ?? 'Cualquiera'}</td>
                      <td><Badge tone={r.isActive ? 'green' : 'gray'}>{r.isActive ? 'Activo' : 'Pausado'}</Badge></td>
                      <td>
                        <div className="flex" style={{ gap: '0.35rem' }}>
                          <Button size="sm" icon={<FiAward size={13} />} onClick={() => setReconocer(r)} disabled={!r.isActive}>
                            Reconocer
                          </Button>
                          <Button size="sm" variant="secondary" onClick={() => alternar(r)}>
                            {r.isActive ? 'Pausar' : 'Activar'}
                          </Button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </AsyncView>
      </Card>

      <Card
        title="Puntos de tus estudiantes"
        actions={
          <select value={periodo} onChange={(e) => setPeriodo(e.target.value as typeof periodo)}>
            {Object.entries(PERIODO_LABEL).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
          </select>
        }
      >
        <p className="muted" style={{ marginTop: 0 }}>Solo tú lo ves, y solo de los semestres que acompañas.</p>
        <AsyncView
          loading={puntos.loading}
          error={puntos.error}
          data={puntos.data}
          skeleton={<SkeletonTable rows={4} columns={3} />}
          isEmpty={(d) => d.students.length === 0}
          emptyMessage="No hay estudiantes en tu alcance todavía."
        >
          {(d) => (
            <div className="table-scroll">
              <table>
                <thead><tr><th>Estudiante</th><th>Semestre</th><th>Puntos</th></tr></thead>
                <tbody>
                  {d.students.slice(0, 50).map((s) => (
                    <tr key={s.profileId}>
                      <td>{s.name}</td>
                      <td className="muted">{s.semester ? `${s.semester}º` : '—'}</td>
                      <td><strong>{s.points}</strong></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </AsyncView>
      </Card>

      {reconocer && (
        <ReconocerDialog
          reto={reconocer}
          onClose={() => setReconocer(null)}
          onDone={(r) => {
            setReconocer(null);
            toast.success(
              `Reto reconocido a ${r.awarded} estudiante${r.awarded === 1 ? '' : 's'}`,
              r.alreadyHad ? `${r.alreadyHad} ya lo tenían.` : undefined,
            );
            puntos.reload();
          }}
        />
      )}
    </>
  );
}

function ReconocerDialog({
  reto,
  onClose,
  onDone,
}: {
  reto: ChallengeItem;
  onClose: () => void;
  onDone: (r: { awarded: number; alreadyHad: number }) => void;
}) {
  const estudiantes = useAsync(() => gamificationService.scopePoints('year'), []);
  const [elegidos, setElegidos] = useState<string[]>([]);
  const [filtro, setFiltro] = useState('');
  const [busy, setBusy] = useState(false);
  const toast = useToast();

  const visibles = useMemo(
    () => (estudiantes.data?.students ?? []).filter((s) => s.name.toLowerCase().includes(filtro.toLowerCase())),
    [estudiantes.data, filtro],
  );

  const enviar = async () => {
    setBusy(true);
    try {
      onDone(await gamificationService.award(reto.id, elegidos));
    } catch (e) {
      toast.error(apiError(e));
      setBusy(false);
    }
  };

  return (
    <Modal title={`Reconocer «${reto.title}»`} subtitle={`+${reto.points} puntos a cada estudiante elegido`} onClose={onClose} width={600}>
      <input value={filtro} onChange={(e) => setFiltro(e.target.value)} placeholder="Buscar estudiante…" style={{ marginBottom: '0.6rem' }} />
      <div className="pick-list">
        {estudiantes.loading ? (
          <SkeletonTable rows={4} columns={2} />
        ) : visibles.length === 0 ? (
          <p className="muted">No hay estudiantes en tu alcance.</p>
        ) : (
          visibles.map((s) => {
            const on = elegidos.includes(s.profileId);
            return (
              <button
                type="button"
                key={s.profileId}
                className={`pick ${on ? 'on' : ''}`}
                onClick={() => setElegidos((x) => (on ? x.filter((y) => y !== s.profileId) : [...x, s.profileId]))}
                aria-pressed={on}
              >
                <span className="chk">{on && <FiCheck size={12} />}</span>
                <span className="grow">{s.name}</span>
                <span className="muted small">{s.semester ? `${s.semester}º sem.` : ''}</span>
              </button>
            );
          })
        )}
      </div>
      <div className="flex" style={{ justifyContent: 'flex-end', gap: '0.5rem', marginTop: '0.8rem' }}>
        <Button variant="secondary" onClick={onClose}>Cancelar</Button>
        <Button onClick={enviar} loading={busy} disabled={elegidos.length === 0} icon={<FiAward size={14} />}>
          Reconocer a {elegidos.length}
        </Button>
      </div>
    </Modal>
  );
}

// ===========================================================================

const CAMPOS_REC = ['name', 'cost', 'stock', 'description'] as const;
type CampoRec = (typeof CAMPOS_REC)[number];

function RecompensasTab() {
  const lista = useAsync(() => gamificationService.rewards(), []);
  const [form, setForm] = useState<Record<CampoRec, string>>({ name: '', cost: '50', stock: '', description: '' });
  const [saving, setSaving] = useState(false);
  const errores = useFormErrors(CAMPOS_REC);
  const toast = useToast();

  const set = (c: CampoRec, v: string) => {
    setForm((f) => ({ ...f, [c]: v }));
    errores.clear(c);
  };

  const crear = async (e: React.FormEvent) => {
    e.preventDefault();
    const locales = validate(form, {
      name: catalogName('de la recompensa'),
      cost: integerRange(1, 10000, 'El costo'),
      stock: (v) => (v.trim() ? integerRange(0, 100000, 'Las unidades')(v) : null),
      description: optionalText(400),
    });
    if (Object.keys(locales).length) {
      errores.setErrors(locales);
      return;
    }
    setSaving(true);
    try {
      await gamificationService.createReward({
        name: form.name.trim(),
        cost: Number(form.cost),
        stock: form.stock.trim() ? Number(form.stock) : null,
        description: form.description.trim() || undefined,
      });
      toast.success('Recompensa creada.');
      setForm({ name: '', cost: '50', stock: '', description: '' });
      errores.reset();
      lista.reload();
    } catch (e2) {
      errores.fromApi(e2);
    } finally {
      setSaving(false);
    }
  };

  const alternar = async (id: string, activa: boolean) => {
    try {
      await gamificationService.updateReward(id, { isActive: !activa });
      lista.reload();
    } catch (e) {
      toast.error(apiError(e));
    }
  };

  return (
    <>
      <Card title="Nueva recompensa">
        <form onSubmit={crear} noValidate>
          <FormAlert message={errores.general} />
          <div className="row">
            <FormField label="Recompensa" required error={errores.errors.name}>
              <input value={form.name} onChange={(e) => set('name', e.target.value)} placeholder="Certificado de reconocimiento del curso" />
            </FormField>
            <FormField label="Costo en puntos" required error={errores.errors.cost}>
              <input inputMode="numeric" value={form.cost} onChange={(e) => set('cost', e.target.value.replace(/[^\d]/g, '').slice(0, 5))} />
            </FormField>
            <FormField label="Unidades" error={errores.errors.stock} hint="Vacío: sin límite.">
              <input inputMode="numeric" value={form.stock} onChange={(e) => set('stock', e.target.value.replace(/[^\d]/g, '').slice(0, 6))} />
            </FormField>
          </div>
          <FormField label="Descripción (opcional)" error={errores.errors.description}>
            <textarea value={form.description} onChange={(e) => set('description', e.target.value)} placeholder="Qué recibe el estudiante y cómo se entrega." />
          </FormField>
          <Button type="submit" loading={saving} icon={<FiGift size={15} />}>Crear recompensa</Button>
        </form>
      </Card>
      <Card title="Tus recompensas">
        <AsyncView
          loading={lista.loading}
          error={lista.error}
          data={lista.data}
          skeleton={<SkeletonTable rows={3} columns={4} />}
          isEmpty={(d) => d.length === 0}
          empty={<EmptyState icon={<FiGift size={22} />} message="Todavía no ofreces recompensas." />}
        >
          {(d) => (
            <div className="table-scroll">
              <table>
                <thead><tr><th>Recompensa</th><th>Costo</th><th>Unidades</th><th>Estado</th><th></th></tr></thead>
                <tbody>
                  {d.map((r) => (
                    <tr key={r.id} className={r.isActive ? '' : 'is-inactive'}>
                      <td><strong>{r.name}</strong>{r.description && <div className="muted small">{r.description}</div>}</td>
                      <td>{r.cost} pts</td>
                      <td className="muted">{r.stock ?? 'Sin límite'}</td>
                      <td><Badge tone={r.isActive ? 'green' : 'gray'}>{r.isActive ? 'Disponible' : 'Retirada'}</Badge></td>
                      <td>
                        <Button size="sm" variant="secondary" onClick={() => alternar(r.id, r.isActive)}>
                          {r.isActive ? 'Retirar' : 'Ofrecer'}
                        </Button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </AsyncView>
      </Card>
    </>
  );
}

function CanjesTab() {
  const lista = useAsync(() => gamificationService.redemptions(), []);
  const toast = useToast();

  const resolver = async (id: string, status: 'delivered' | 'rejected') => {
    try {
      await gamificationService.resolve(id, status);
      toast.success(status === 'delivered' ? 'Marcado como entregado.' : 'Canje rechazado: los puntos volvieron al estudiante.');
      lista.reload();
    } catch (e) {
      toast.error(apiError(e));
    }
  };

  return (
    <Card title="Canjes de tus recompensas">
      <AsyncView
        loading={lista.loading}
        error={lista.error}
        data={lista.data}
        skeleton={<SkeletonTable rows={4} columns={4} />}
        isEmpty={(d) => d.length === 0}
        empty={<EmptyState icon={<FiGift size={22} />} message="Nadie canjeó tus recompensas todavía." />}
      >
        {(d) => (
          <div className="table-scroll">
            <table>
              <thead><tr><th>Estudiante</th><th>Recompensa</th><th>Puntos</th><th>Estado</th><th></th></tr></thead>
              <tbody>
                {d.map((c) => (
                  <tr key={c.id}>
                    <td>{c.student ?? '—'}</td>
                    <td>{c.reward}</td>
                    <td>{c.cost}</td>
                    <td>
                      <Badge tone={c.status === 'pending' ? 'amber' : c.status === 'delivered' ? 'green' : 'gray'}>
                        {c.status === 'pending' ? 'Por entregar' : c.status === 'delivered' ? 'Entregado' : 'Rechazado'}
                      </Badge>
                    </td>
                    <td>
                      {c.status === 'pending' && (
                        <div className="flex" style={{ gap: '0.35rem' }}>
                          <Button size="sm" icon={<FiCheck size={13} />} onClick={() => resolver(c.id, 'delivered')}>Entregado</Button>
                          <Button size="sm" variant="secondary" icon={<FiX size={13} />} onClick={() => resolver(c.id, 'rejected')}>Rechazar</Button>
                        </div>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </AsyncView>
    </Card>
  );
}
