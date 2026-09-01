import { useCallback, useEffect, useState } from 'react';
import { FiCalendar, FiEdit2, FiUsers, FiPlus } from 'react-icons/fi';
import { apiError } from '../api/client';
import { activityService, catalogService } from '../services';
import type { AcademicArea, Activity, ActivityCategoryItem, Participant } from '../services/types';
import { Card, Loading, EmptyState, Badge } from './ui';
import {
  ACTIVITY_MODALITIES,
  ACTIVITY_STATUS_LABEL,
  ACTIVITY_STATUSES,
  REGISTRATION_BADGE,
  REGISTRATION_STATUS_LABEL,
  lbl,
} from '../constants';

const emptyForm = {
  title: '',
  description: '',
  categoryId: '',
  modality: 'presencial',
  areaId: '',
  activityDate: '',
  location: '',
  externalUrl: '',
  capacity: '',
  tags: '',
  status: 'draft',
};

export default function ActivityManager({
  activityType,
}: {
  activityType: 'academica' | 'extracurricular';
}) {
  const [activities, setActivities] = useState<Activity[]>([]);
  const [areas, setAreas] = useState<AcademicArea[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [msg, setMsg] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const [categories, setCategories] = useState<ActivityCategoryItem[]>([]);
  const [editing, setEditing] = useState<Activity | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState(emptyForm);

  const [selected, setSelected] = useState<string | null>(null);
  const [participants, setParticipants] = useState<Participant[]>([]);
  const [partLoading, setPartLoading] = useState(false);

  // Del catálogo administrable: las que aplican a este tipo o a ambos (RF4).
  const usableCategories = categories.filter(
    (c) => c.isActive && (!c.appliesTo || c.appliesTo === activityType),
  );

  const notify = (t: string) => {
    setMsg(t);
    setError(null);
    window.setTimeout(() => setMsg(null), 4000);
  };

  const load = useCallback(async () => {
    const list = await activityService.managed();
    setActivities(list.filter((a) => a.type === activityType));
  }, [activityType]);

  useEffect(() => {
    setLoading(true);
    Promise.all([
      load(),
      catalogService.areas().then(setAreas),
      catalogService.activityCategories().then(setCategories),
    ])
      .catch((e) => setError(apiError(e)))
      .finally(() => setLoading(false));
  }, [load]);

  const resetForm = () => {
    setForm({ ...emptyForm, categoryId: usableCategories[0]?.id ?? '' });
    setEditing(null);
    setShowForm(false);
  };

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSaving(true);
    const payload: Record<string, unknown> = {
      title: form.title,
      description: form.description || undefined,
      type: activityType,
      categoryId: form.categoryId,
      modality: form.modality,
      areaId: form.areaId || undefined,
      activityDate: form.activityDate ? new Date(form.activityDate).toISOString() : undefined,
      location: form.location || undefined,
      externalUrl: form.externalUrl || undefined,
      capacity: form.capacity ? Number(form.capacity) : undefined,
      tags: form.tags
        ? form.tags
            .split(',')
            .map((t) => t.trim())
            .filter(Boolean)
        : undefined,
      status: form.status,
    };
    try {
      if (editing) {
        delete payload.type;
        await activityService.update(editing.id, payload);
        notify('Actividad actualizada.');
      } else {
        await activityService.create(payload as never);
        notify(
          form.status === 'draft'
            ? 'Actividad guardada como borrador.'
            : 'Actividad publicada.',
        );
      }
      resetForm();
      await load();
    } catch (err) {
      setError(apiError(err));
    } finally {
      setSaving(false);
    }
  };

  const startEdit = (a: Activity) => {
    setEditing(a);
    setShowForm(true);
    setForm({
      title: a.title,
      description: a.description ?? '',
      categoryId: a.categoryId,
      modality: a.modality,
      areaId: a.academicAreaId ?? '',
      activityDate: a.eventDate ? a.eventDate.slice(0, 16) : '',
      location: a.location ?? '',
      externalUrl: a.externalUrl ?? '',
      capacity: a.capacity ? String(a.capacity) : '',
      tags: (a.tags ?? []).join(', '),
      status: a.status,
    });
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const changeStatus = async (a: Activity, status: string) => {
    setError(null);
    try {
      await activityService.update(a.id, { status });
      notify(`Estado actualizado a “${lbl(ACTIVITY_STATUS_LABEL, status)}”.`);
      await load();
    } catch (e) {
      setError(apiError(e));
    }
  };

  const openParticipants = async (activityId: string) => {
    setSelected(activityId);
    setPartLoading(true);
    setError(null);
    try {
      setParticipants(await activityService.participants(activityId));
    } catch (e) {
      setError(apiError(e));
      setParticipants([]);
    } finally {
      setPartLoading(false);
    }
  };

  const decide = async (activityId: string, studentProfileId: string, status: 'confirmed' | 'absent') => {
    setError(null);
    try {
      await activityService.confirm(activityId, studentProfileId, status);
      setParticipants(await activityService.participants(activityId));
      await load();
      notify(status === 'confirmed' ? 'Participación confirmada.' : 'Registrado como ausente.');
    } catch (e) {
      setError(apiError(e));
    }
  };

  if (loading) return <Loading label="Cargando actividades…" />;

  const selectedActivity = activities.find((a) => a.id === selected);
  const pending = participants.filter((r) => r.status === 'registered');
  const interested = participants.filter((r) => r.status === 'interested');
  const confirmed = participants.filter((r) => r.status === 'confirmed');
  const absent = participants.filter((r) => r.status === 'absent');
  const full = !!(selectedActivity?.capacity && confirmed.length >= selectedActivity.capacity);
  const tipo = activityType === 'academica' ? 'académica' : 'extracurricular';

  return (
    <div>
      {error && <div className="alert alert-error">{error}</div>}
      {msg && <div className="alert alert-success">{msg}</div>}

      {!showForm && (
        <button
          className="btn btn-primary"
          onClick={() => {
            setForm({ ...emptyForm, categoryId: usableCategories[0]?.id ?? '' });
            setShowForm(true);
          }}
        >
          <FiPlus /> Nueva actividad {tipo}
        </button>
      )}

      {showForm && (
        <Card
          title={editing ? `Editar “${editing.title}”` : `Nueva actividad ${tipo}`}
          actions={
            <button className="btn btn-ghost btn-sm" onClick={resetForm}>
              Cancelar
            </button>
          }
        >
          <form onSubmit={submit}>
            <div className="row">
              <div className="field">
                <label>Título</label>
                <input
                  value={form.title}
                  onChange={(e) => setForm({ ...form, title: e.target.value })}
                  placeholder={
                    activityType === 'academica'
                      ? 'Taller de arquitectura de software'
                      : 'Hackathon interna de innovación'
                  }
                  required
                />
              </div>
              <div className="field">
                <label>Categoría</label>
                <select
                  value={form.categoryId}
                  onChange={(e) => setForm({ ...form, categoryId: e.target.value })}
                  required
                >
                  <option value="">Seleccione una categoría…</option>
                  {usableCategories.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div className="field">
              <label>Descripción</label>
              <textarea
                value={form.description}
                onChange={(e) => setForm({ ...form, description: e.target.value })}
                placeholder="Objetivo de la actividad, a quién está dirigida y qué se espera del participante."
              />
            </div>

            <div className="row">
              <div className="field">
                <label>Fecha y hora</label>
                <input
                  type="datetime-local"
                  value={form.activityDate}
                  onChange={(e) => setForm({ ...form, activityDate: e.target.value })}
                />
              </div>
              <div className="field">
                <label>Modalidad</label>
                <select
                  value={form.modality}
                  onChange={(e) => setForm({ ...form, modality: e.target.value })}
                >
                  {ACTIVITY_MODALITIES.map((m) => (
                    <option key={m.value} value={m.value}>
                      {m.label}
                    </option>
                  ))}
                </select>
              </div>
              <div className="field">
                <label>Área académica</label>
                <select
                  value={form.areaId}
                  onChange={(e) => setForm({ ...form, areaId: e.target.value })}
                >
                  <option value="">Sin área</option>
                  {areas.map((a) => (
                    <option key={a.id} value={a.id}>
                      {a.name}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div className="row">
              <div className="field">
                <label>Ubicación</label>
                <input
                  value={form.location}
                  onChange={(e) => setForm({ ...form, location: e.target.value })}
                  placeholder="Aula 301, Bloque B"
                />
              </div>
              <div className="field">
                <label>Enlace externo</label>
                <input
                  type="url"
                  value={form.externalUrl}
                  onChange={(e) => setForm({ ...form, externalUrl: e.target.value })}
                  placeholder="https://…"
                />
              </div>
              <div className="field">
                <label>Cupo</label>
                <input
                  type="number"
                  min={1}
                  max={1000}
                  value={form.capacity}
                  onChange={(e) => setForm({ ...form, capacity: e.target.value })}
                  placeholder="Sin límite"
                />
              </div>
            </div>

            <div className="row">
              <div className="field">
                <label>Etiquetas (separadas por coma)</label>
                <input
                  value={form.tags}
                  onChange={(e) => setForm({ ...form, tags: e.target.value })}
                  placeholder="react, arquitectura, backend"
                />
              </div>
              <div className="field">
                <label>Estado</label>
                <select
                  value={form.status}
                  onChange={(e) => setForm({ ...form, status: e.target.value })}
                >
                  {ACTIVITY_STATUSES.map((s) => (
                    <option key={s} value={s}>
                      {lbl(ACTIVITY_STATUS_LABEL, s)}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <p className="muted" style={{ fontSize: '0.78rem', marginBottom: '0.7rem' }}>
              En <strong>borrador</strong> la actividad no es visible para los estudiantes. Para que
              puedan inscribirse debe estar <strong>publicada</strong> o <strong>abierta</strong>.
            </p>

            <button className="btn btn-primary" disabled={saving}>
              {saving ? 'Guardando…' : editing ? 'Guardar cambios' : 'Guardar actividad'}
            </button>
          </form>
        </Card>
      )}

      <div className="section-title">
        <h2>Actividades que gestiona</h2>
      </div>

      {activities.length === 0 ? (
        <Card>
          <EmptyState
            message={`Todavía no ha publicado ninguna actividad ${tipo}. Use el botón “Nueva actividad” para crear la primera.`}
          />
        </Card>
      ) : (
        <Card>
          <div className="scroll-x">
            <table>
              <thead>
                <tr>
                  <th>Título</th>
                  <th>Categoría</th>
                  <th>Fecha</th>
                  <th>Estado</th>
                  <th>Confirmados</th>
                  <th>Pendientes</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {activities.map((a) => {
                  const pend = (a.registrationCount ?? 0) - (a.confirmedCount ?? 0);
                  return (
                    <tr key={a.id}>
                      <td>
                        <strong>{a.title}</strong>
                        {a.location && <div className="muted">{a.location}</div>}
                      </td>
                      <td className="muted">{a.category?.name ?? '—'}</td>
                      <td className="muted">
                        {a.eventDate ? (
                          new Date(a.eventDate).toLocaleString('es-BO', {
                            day: '2-digit',
                            month: 'short',
                            year: 'numeric',
                            hour: '2-digit',
                            minute: '2-digit',
                          })
                        ) : (
                          <span>Sin fecha</span>
                        )}
                      </td>
                      <td>
                        <select
                          className="status-select"
                          value={a.status}
                          onChange={(e) => changeStatus(a, e.target.value)}
                          aria-label={`Estado de ${a.title}`}
                        >
                          {ACTIVITY_STATUSES.map((s) => (
                            <option key={s} value={s}>
                              {lbl(ACTIVITY_STATUS_LABEL, s)}
                            </option>
                          ))}
                        </select>
                      </td>
                      <td>
                        {a.confirmedCount ?? 0} / {a.capacity ?? '∞'}
                      </td>
                      <td>
                        {pend > 0 ? (
                          <Badge tone="amber">{pend}</Badge>
                        ) : (
                          <span className="muted">—</span>
                        )}
                      </td>
                      <td>
                        <div className="flex" style={{ gap: '0.35rem' }}>
                          <button
                            className="btn btn-secondary btn-sm"
                            onClick={() => startEdit(a)}
                            title="Editar"
                          >
                            <FiEdit2 />
                          </button>
                          <button
                            className={`btn btn-sm ${selected === a.id ? 'btn-primary' : 'btn-secondary'}`}
                            onClick={() => openParticipants(a.id)}
                          >
                            <FiUsers /> Participación
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </Card>
      )}

      {selectedActivity && (
        <Card title={`Participación · ${selectedActivity.title}`}>
          <p className="muted">
            Confirmados: <strong>{confirmed.length}</strong> de{' '}
            {selectedActivity.capacity ?? 'cupo ilimitado'}
            {full && ' · el cupo está lleno'}
          </p>

          {partLoading ? (
            <Loading label="Cargando participantes…" />
          ) : participants.length === 0 ? (
            <EmptyState message="Todavía nadie manifestó interés ni se inscribió en esta actividad." />
          ) : (
            <>
              <ParticipantGroup
                title={`Inscritos pendientes de registro (${pending.length})`}
                rows={pending}
                empty="No hay inscripciones pendientes."
                render={(r) => (
                  <div className="flex" style={{ gap: '0.35rem' }}>
                    <button
                      className="btn btn-primary btn-sm"
                      disabled={full}
                      title={full ? 'El cupo está lleno' : 'Registrar asistencia'}
                      onClick={() => decide(selectedActivity.id, r.studentProfileId, 'confirmed')}
                    >
                      Confirmar participación
                    </button>
                    <button
                      className="btn btn-secondary btn-sm"
                      onClick={() => decide(selectedActivity.id, r.studentProfileId, 'absent')}
                    >
                      Ausente
                    </button>
                  </div>
                )}
              />

              <ParticipantGroup
                title={`Solo interesados (${interested.length})`}
                rows={interested}
                empty="Nadie marcó únicamente interés."
                render={(r) => (
                  <button
                    className="btn btn-secondary btn-sm"
                    disabled={full}
                    onClick={() => decide(selectedActivity.id, r.studentProfileId, 'confirmed')}
                  >
                    Confirmar participación
                  </button>
                )}
              />

              <ParticipantGroup
                title={`Participación confirmada (${confirmed.length})`}
                rows={confirmed}
                empty="Todavía no hay participación confirmada."
                render={(r) => (
                  <button
                    className="btn btn-secondary btn-sm"
                    onClick={() => decide(selectedActivity.id, r.studentProfileId, 'absent')}
                  >
                    Marcar ausente
                  </button>
                )}
              />

              {absent.length > 0 && (
                <ParticipantGroup
                  title={`Ausentes (${absent.length})`}
                  rows={absent}
                  empty=""
                  render={(r) => (
                    <button
                      className="btn btn-secondary btn-sm"
                      disabled={full}
                      onClick={() => decide(selectedActivity.id, r.studentProfileId, 'confirmed')}
                    >
                      Confirmar participación
                    </button>
                  )}
                />
              )}
            </>
          )}
        </Card>
      )}

      {!selectedActivity && activities.length > 0 && (
        <div className="state">
          <FiCalendar size={24} style={{ opacity: 0.4 }} />
          <p className="muted">
            Seleccione “Participación” en una actividad para registrar la asistencia.
          </p>
        </div>
      )}
    </div>
  );
}

function ParticipantGroup({
  title,
  rows,
  empty,
  render,
}: {
  title: string;
  rows: Participant[];
  empty: string;
  render: (r: Participant) => React.ReactNode;
}) {
  if (rows.length === 0 && !empty) return null;
  return (
    <div className="mt">
      <h3>{title}</h3>
      {rows.length === 0 ? (
        <p className="muted">{empty}</p>
      ) : (
        <div className="scroll-x">
          <table>
            <tbody>
              {rows.map((r) => (
                <tr key={r.id}>
                  <td>
                    <strong>{r.studentName ?? 'Estudiante'}</strong>
                    <div className="muted">
                      {r.semester ? `${r.semester}º semestre` : 'Semestre no declarado'}
                    </div>
                  </td>
                  <td style={{ width: 130 }}>
                    <Badge tone={(REGISTRATION_BADGE[r.status] ?? 'badge-gray').replace('badge-', '')}>
                      {lbl(REGISTRATION_STATUS_LABEL, r.status)}
                    </Badge>
                  </td>
                  <td style={{ width: 300 }}>{render(r)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
