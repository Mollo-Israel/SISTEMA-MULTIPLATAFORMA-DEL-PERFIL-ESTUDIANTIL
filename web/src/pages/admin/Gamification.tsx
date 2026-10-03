import { useMemo, useState } from 'react';
import { FiAward, FiEdit2, FiGift, FiPlus, FiStar, FiTrendingUp } from 'react-icons/fi';
import { apiError } from '../../api/client';
import { adminService, catalogService } from '../../services';
import { useAsync } from '../../hooks/useAsync';
import type { GamificationCriterion } from '../../services/types';
import {
  AsyncView, Badge, Button, Card, EmptyState, Modal, PageHeader, SkeletonTable,
} from '../../components/ui';
import { FormAlert, FormField, useFormErrors } from '../../components/form';
import { useConfirm, useToast } from '../../components/feedback';
import { GAMIFICATION_TRIGGERS, RETIRED_GAMIFICATION_TRIGGERS, lbl } from '../../constants';
import { catalogName, integerRange, optionalText, suggestCode, validate, type Validator } from '../../lib/validators';

const TRIGGER_LABEL: Record<string, string> = Object.fromEntries(
  [...GAMIFICATION_TRIGGERS, ...RETIRED_GAMIFICATION_TRIGGERS].map((t) => [t.value, t.label]),
);
const VIGENTES = new Set(GAMIFICATION_TRIGGERS.map((t) => t.value));

const CAMPOS = ['name', 'code', 'trigger', 'points', 'academicAreaId', 'description'] as const;
type Campo = (typeof CAMPOS)[number];
type Form = Record<Campo, string>;

const codigo: Validator = (v) =>
  /^[a-z0-9_]{3,60}$/.test((v ?? '').trim()) ? null : 'Minúsculas, números y guion bajo (3 a 60 caracteres).';

/** Un criterio general es el que da los puntos de un hecho en todas las áreas. */
const esGeneral = (c: GamificationCriterion) => !c.academicAreaId && c.code === c.trigger;

/**
 * Criterios de gamificación (correcciones de QA).
 *
 * Deja claro qué alimentan: cada vez que el sistema reconoce un hecho, da los
 * puntos de su criterio general, o los del extra de su área si existe. Los
 * puntos se canjean por recompensas y nunca cambian la afinidad (§66).
 */
export default function AdminGamificationPage() {
  const { data, loading, error, reload } = useAsync(() => adminService.listCriteria(), []);
  const areas = useAsync(() => catalogService.areas(), []);
  const [modal, setModal] = useState<{ modo: 'general' | 'extra'; criterio: GamificationCriterion | null } | null>(null);
  const toast = useToast();
  const confirm = useConfirm();

  const grupos = useMemo(() => {
    const rows = data ?? [];
    return {
      generales: GAMIFICATION_TRIGGERS.map((t) => ({
        hecho: t,
        criterio: rows.find((c) => esGeneral(c) && c.trigger === t.value) ?? null,
      })),
      extras: rows.filter((c) => c.academicAreaId && VIGENTES.has(c.trigger)),
      retirados: rows.filter((c) => !VIGENTES.has(c.trigger) || (!c.academicAreaId && c.code !== c.trigger)),
    };
  }, [data]);

  const alternar = async (c: GamificationCriterion) => {
    if (c.isActive) {
      const ok = await confirm({
        title: `Pausar «${c.name}»`,
        message: esGeneral(c)
          ? 'Mientras esté pausado, este hecho no dará puntos a nadie. Lo puedes reactivar cuando quieras.'
          : 'El área vuelve a usar los puntos del criterio general. Lo puedes reactivar cuando quieras.',
        confirmLabel: 'Pausar',
        tone: 'danger',
      });
      if (!ok) return;
    }
    try {
      await adminService.updateCriterion(c.id, { isActive: !c.isActive });
      toast.success(c.isActive ? 'Criterio pausado.' : 'Criterio activado.');
      reload();
    } catch (e) {
      toast.error(apiError(e));
    }
  };

  return (
    <div>
      <PageHeader
        title="Puntos y reconocimientos"
        description="Aquí decides cuántos puntos gana un estudiante cuando logra algo verificable. Los puntos lo motivan y se canjean por recompensas; no cambian su afinidad ni sus recomendaciones."
      />

      <div className="how-grid" style={{ marginBottom: '1.2rem' }}>
        <div className="how-card c1">
          <FiStar size={20} />
          <strong>1. Algo ocurre</strong>
          <p className="muted small">Un docente confirma una asistencia, respalda un proyecto o acepta una colaboración.</p>
        </div>
        <div className="how-card c2">
          <FiTrendingUp size={20} />
          <strong>2. Se suman puntos</strong>
          <p className="muted small">Los del criterio de ese hecho. Si el hecho es de un área con extra, cuenta el extra.</p>
        </div>
        <div className="how-card c4">
          <FiGift size={20} />
          <strong>3. Se canjean</strong>
          <p className="muted small">Cada estudiante ve sus puntos de la semana, el mes y el año, y los canjea por recompensas que ofrecen sus docentes.</p>
        </div>
        <div className="how-card c5">
          <FiAward size={20} />
          <strong>Retos docentes</strong>
          <p className="muted small">Además, cada docente crea sus propios retos con sus puntos en «Retos y recompensas».</p>
        </div>
      </div>

      <AsyncView
        loading={loading}
        error={error}
        data={data}
        skeleton={<SkeletonTable rows={5} columns={4} />}
      >
        {() => (
          <>
            <Card title="Puntos por cada hecho">
              <p className="muted" style={{ marginTop: 0 }}>Valen para todas las áreas. Pausar un hecho hace que deje de dar puntos.</p>
              <div className="criteria-grid">
                {grupos.generales.map(({ hecho, criterio }) => (
                  <div key={hecho.value} className={`criterion-card ${criterio?.isActive ? '' : 'is-inactive'}`}>
                    <div className="flex" style={{ justifyContent: 'space-between', alignItems: 'flex-start' }}>
                      <strong>{criterio?.name ?? hecho.label}</strong>
                      <span className="points-pill">{criterio ? `+${criterio.points}` : '—'}</span>
                    </div>
                    <p className="muted small">{hecho.hint}</p>
                    {criterio ? (
                      <div className="flex" style={{ gap: '0.35rem' }}>
                        <Button size="sm" variant="secondary" icon={<FiEdit2 size={13} />} onClick={() => setModal({ modo: 'general', criterio })}>
                          Cambiar puntos
                        </Button>
                        <Button size="sm" variant="ghost" onClick={() => alternar(criterio)}>
                          {criterio.isActive ? 'Pausar' : 'Activar'}
                        </Button>
                      </div>
                    ) : (
                      <Badge tone="gray">Sin criterio: no da puntos</Badge>
                    )}
                  </div>
                ))}
              </div>
            </Card>

            <Card
              title="Extras por área"
              actions={
                <Button size="sm" icon={<FiPlus size={14} />} onClick={() => setModal({ modo: 'extra', criterio: null })}>
                  Nuevo extra
                </Button>
              }
            >
              <p className="muted" style={{ marginTop: 0 }}>
                Para impulsar un área concreta: por ejemplo, 15 puntos en lugar de 10 por participar en actividades de Ciberseguridad.
              </p>
              {grupos.extras.length === 0 ? (
                <EmptyState icon={<FiTrendingUp size={22} />} message="No hay extras por área. Todas usan los puntos generales." />
              ) : (
                <div className="table-scroll">
                  <table>
                    <thead><tr><th>Nombre</th><th>Hecho</th><th>Área</th><th>Puntos</th><th>Estado</th><th></th></tr></thead>
                    <tbody>
                      {grupos.extras.map((c) => (
                        <tr key={c.id} className={c.isActive ? '' : 'is-inactive'}>
                          <td><strong>{c.name}</strong><div><span className="code-pill">{c.code}</span></div></td>
                          <td className="muted">{lbl(TRIGGER_LABEL, c.trigger)}</td>
                          <td>{c.academicArea?.name ?? '—'}</td>
                          <td><span className="points-pill">+{c.points}</span></td>
                          <td><Badge tone={c.isActive ? 'green' : 'gray'}>{c.isActive ? 'Activo' : 'Pausado'}</Badge></td>
                          <td>
                            <div className="flex" style={{ gap: '0.35rem' }}>
                              <Button size="sm" variant="secondary" icon={<FiEdit2 size={13} />} onClick={() => setModal({ modo: 'extra', criterio: c })}>Editar</Button>
                              <Button size="sm" variant="ghost" onClick={() => alternar(c)}>{c.isActive ? 'Pausar' : 'Activar'}</Button>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </Card>

            {grupos.retirados.length > 0 && (
              <details className="card retired-block">
                <summary>Criterios antiguos que ya no dan puntos ({grupos.retirados.length})</summary>
                <p className="muted small">
                  Premiaban cosas que uno mismo declara (completar el perfil, subir archivos, registrar un proyecto vacío) o repetían un hecho que ya tiene su criterio general. Se conservan solo como historial.
                </p>
                <ul className="retired-list">
                  {grupos.retirados.map((c) => (
                    <li key={c.id}>
                      <span>{c.name}</span>
                      <span className="muted small">{lbl(TRIGGER_LABEL, c.trigger)} · {c.points} pts</span>
                    </li>
                  ))}
                </ul>
              </details>
            )}
          </>
        )}
      </AsyncView>

      {modal && (
        <CriterioDialog
          modo={modal.modo}
          criterio={modal.criterio}
          areas={(areas.data ?? []).filter((a) => a.isActive || a.id === modal.criterio?.academicAreaId)}
          onClose={() => setModal(null)}
          onSaved={(msg) => {
            setModal(null);
            toast.success(msg);
            reload();
          }}
        />
      )}
    </div>
  );
}

function CriterioDialog({
  modo,
  criterio,
  areas,
  onClose,
  onSaved,
}: {
  modo: 'general' | 'extra';
  criterio: GamificationCriterion | null;
  areas: { id: string; name: string }[];
  onClose: () => void;
  onSaved: (msg: string) => void;
}) {
  const [form, setForm] = useState<Form>({
    name: criterio?.name ?? '',
    code: criterio?.code ?? '',
    trigger: criterio?.trigger ?? GAMIFICATION_TRIGGERS[0].value,
    points: String(criterio?.points ?? 15),
    academicAreaId: criterio?.academicAreaId ?? '',
    description: criterio?.description ?? '',
  });
  const [codigoTocado, setCodigoTocado] = useState(Boolean(criterio));
  const [saving, setSaving] = useState(false);
  const errores = useFormErrors(CAMPOS);
  const general = modo === 'general';

  const set = (c: Campo, v: string) => {
    setForm((f) => {
      const next = { ...f, [c]: v };
      if (c === 'name' && !codigoTocado && !general) next.code = suggestCode(v);
      return next;
    });
    if (c === 'code') setCodigoTocado(true);
    errores.clear(c);
  };

  const guardar = async (e: React.FormEvent) => {
    e.preventDefault();
    const locales = validate(form, {
      name: catalogName('del criterio'),
      points: integerRange(1, 1000, 'Los puntos'),
      description: optionalText(300),
      ...(general
        ? {}
        : {
            code: codigo,
            academicAreaId: (v: string) => (v ? null : 'Elige el área a la que se aplica el extra.'),
          }),
    });
    if (Object.keys(locales).length) {
      errores.setErrors(locales);
      return;
    }
    const payload: Record<string, unknown> = {
      name: form.name.trim(),
      points: Number(form.points),
      description: form.description.trim() || undefined,
    };
    if (!general) {
      payload.code = form.code.trim();
      payload.trigger = form.trigger;
      payload.academicAreaId = form.academicAreaId;
    }
    setSaving(true);
    try {
      if (criterio) {
        await adminService.updateCriterion(criterio.id, payload);
        onSaved('Criterio actualizado.');
      } else {
        await adminService.createCriterion(payload);
        onSaved('Extra creado. Desde ahora el área usa estos puntos.');
      }
    } catch (e2) {
      errores.fromApi(e2);
      setSaving(false);
    }
  };

  return (
    <Modal
      title={general ? `Puntos por «${lbl(TRIGGER_LABEL, form.trigger)}»` : criterio ? `Editar «${criterio.name}»` : 'Nuevo extra por área'}
      subtitle={general ? 'Valen para todas las áreas que no tengan un extra propio.' : undefined}
      onClose={onClose}
      width={560}
    >
      <form onSubmit={guardar} noValidate>
        <FormAlert message={errores.general} />
        <FormField label="Nombre" required error={errores.errors.name}>
          <input value={form.name} onChange={(e) => set('name', e.target.value)} placeholder="Extra por participar en Ciberseguridad" />
        </FormField>
        {!general && (
          <div className="row">
            <FormField label="Hecho" required error={errores.errors.trigger}>
              <select value={form.trigger} onChange={(e) => set('trigger', e.target.value)}>
                {GAMIFICATION_TRIGGERS.map((t) => <option key={t.value} value={t.value}>{t.label}</option>)}
              </select>
            </FormField>
            <FormField label="Área" required error={errores.errors.academicAreaId}>
              <select value={form.academicAreaId} onChange={(e) => set('academicAreaId', e.target.value)}>
                <option value="">Elige un área…</option>
                {areas.map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}
              </select>
            </FormField>
          </div>
        )}
        <div className="row">
          <FormField label="Puntos" required error={errores.errors.points} hint="Número entero de 1 a 1000.">
            <input inputMode="numeric" value={form.points} onChange={(e) => set('points', e.target.value.replace(/[^\d]/g, '').slice(0, 4))} />
          </FormField>
          {!general && (
            <FormField label="Código" required error={errores.errors.code} hint="Se sugiere a partir del nombre.">
              <input value={form.code} onChange={(e) => set('code', e.target.value.toLowerCase())} />
            </FormField>
          )}
        </div>
        <FormField label="Descripción (opcional)" error={errores.errors.description}>
          <textarea value={form.description} onChange={(e) => set('description', e.target.value)} placeholder="Por qué se premia este hecho." />
        </FormField>
        <div className="flex" style={{ justifyContent: 'flex-end', gap: '0.5rem' }}>
          <Button type="button" variant="secondary" onClick={onClose}>Cancelar</Button>
          <Button type="submit" loading={saving}>{criterio ? 'Guardar cambios' : 'Crear extra'}</Button>
        </div>
      </form>
    </Modal>
  );
}
