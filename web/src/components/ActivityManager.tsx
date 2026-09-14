import { useCallback, useEffect, useMemo, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import {
  FiCalendar, FiCheck, FiEdit2, FiPlus, FiSave, FiSearch, FiUserX, FiUsers, FiX,
} from 'react-icons/fi';
import { apiError } from '../api/client';
import { activityService, catalogService } from '../services';
import type { AcademicArea, Activity, ActivityCategoryItem, Participant } from '../services/types';
import {
  Badge, Button, Card, EmptyState, ResultCount, SearchInput, SkeletonTable, Stagger,
} from './ui';
import { useConfirm, useToast } from './feedback';
import {
  ACTIVITY_MODALITIES,
  ACTIVITY_STATUS_LABEL,
  ACTIVITY_STATUSES,
  REGISTRATION_BADGE,
  REGISTRATION_STATUS_LABEL,
  lbl,
} from '../constants';

const normalize = (s: string) =>
  s.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');

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
  /** Solo el fallo de la carga inicial: el resto de errores son avisos flotantes. */
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const toast = useToast();
  const confirm = useConfirm();

  const [categories, setCategories] = useState<ActivityCategoryItem[]>([]);
  const [editing, setEditing] = useState<Activity | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState(emptyForm);

  const [selected, setSelected] = useState<string | null>(null);
  const [participants, setParticipants] = useState<Participant[]>([]);
  const [partLoading, setPartLoading] = useState(false);
  const [busyRow, setBusyRow] = useState<string | null>(null);

  const [query, setQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [partQuery, setPartQuery] = useState('');

  // Del catálogo administrable: las que aplican a este tipo o a ambos (RF4).
  const usableCategories = categories.filter(
    (c) => c.isActive && (!c.appliesTo || c.appliesTo === activityType),
  );

  const notify = (t: string, detail?: string) => toast.success(t, detail);

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

  const visible = useMemo(() => {
    const q = normalize(query.trim());
    return activities.filter((a) => {
      if (statusFilter && a.status !== statusFilter) return false;
      if (!q) return true;
      return [a.title, a.description ?? '', a.location ?? '', a.category?.name ?? '',
        a.academicArea?.name ?? '', (a.tags ?? []).join(' ')]
        .some((field) => normalize(field).includes(q));
    });
  }, [activities, query, statusFilter]);

  const resetForm = () => {
    setForm({ ...emptyForm, categoryId: usableCategories[0]?.id ?? '' });
    setEditing(null);
    setShowForm(false);
  };

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
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
      toast.error(apiError(err));
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

  /**
   * Pasar a cancelada o volver a borrador saca la actividad de la vista del
   * estudiante, asi que esos dos casos se confirman antes.
   */
  const changeStatus = async (a: Activity, status: string) => {
    const label = lbl(ACTIVITY_STATUS_LABEL, status);
    if (status === 'cancelled' || status === 'draft') {
      const ok = await confirm({
        title: status === 'cancelled' ? 'Cancelar la actividad' : 'Devolver a borrador',
        message: (
          <>
            <strong>{a.title}</strong> dejará de estar disponible para los estudiantes
            {(a.registrationCount ?? 0) > 0
              ? ` y ya tiene ${a.registrationCount} inscripción(es) registrada(s).`
              : '.'}
          </>
        ),
        confirmLabel: status === 'cancelled' ? 'Cancelar actividad' : 'Devolver a borrador',
        cancelLabel: 'Dejar como está',
        tone: 'danger',
      });
      if (!ok) return;
    }
    try {
      await activityService.update(a.id, { status });
      notify(`Estado actualizado a “${label}”.`);
      await load();
    } catch (e) {
      toast.error(apiError(e));
    }
  };

  const openParticipants = async (activityId: string) => {
    setSelected(activityId);
    setPartQuery('');
    setPartLoading(true);
    try {
      setParticipants(await activityService.participants(activityId));
    } catch (e) {
      toast.error(apiError(e));
      setParticipants([]);
    } finally {
      setPartLoading(false);
    }
  };

  /**
   * Marcar ausente retira participacion que ya cuenta en el perfil del
   * estudiante (RN-9), de modo que se confirma antes de enviarlo.
   */
  const decide = async (
    activityId: string,
    row: Participant,
    status: 'confirmed' | 'absent',
  ) => {
    const who = row.studentName ?? 'el estudiante';
    if (status === 'absent') {
      const ok = await confirm({
        title: 'Registrar ausencia',
        message: (
          <>
            Se registrará a <strong>{who}</strong> como ausente.
            {row.status === 'confirmed'
              && ' Su participación estaba confirmada y dejará de contar en su perfil.'}
          </>
        ),
        confirmLabel: 'Registrar ausente',
        tone: 'danger',
      });
      if (!ok) return;
    }
    setBusyRow(row.id);
    try {
      await activityService.confirm(activityId, row.studentProfileId, status);
      setParticipants(await activityService.participants(activityId));
      await load();
      notify(
        status === 'confirmed' ? 'Participación confirmada.' : 'Registrado como ausente.',
        `${who} · ${status === 'confirmed' ? 'suma a su perfil' : 'ya no cuenta en su perfil'}`,
      );
    } catch (e) {
      toast.error(apiError(e));
    } finally {
      setBusyRow(null);
    }
  };

  if (loading) return <SkeletonTable rows={5} columns={6} />;

  const selectedActivity = activities.find((a) => a.id === selected);
  const partNeedle = normalize(partQuery.trim());
  const shownParticipants = partNeedle
    ? participants.filter((r) => normalize(r.studentName ?? '').includes(partNeedle))
    : participants;
  const pending = shownParticipants.filter((r) => r.status === 'registered');
  const interested = shownParticipants.filter((r) => r.status === 'interested');
  const confirmed = shownParticipants.filter((r) => r.status === 'confirmed');
  const absent = shownParticipants.filter((r) => r.status === 'absent');
  const allConfirmed = participants.filter((r) => r.status === 'confirmed');
  const full = !!(selectedActivity?.capacity && allConfirmed.length >= selectedActivity.capacity);
  const tipo = activityType === 'academica' ? 'académica' : 'extracurricular';

  return (
    <div>
      {error && <div className="alert alert-error">{error}</div>}

      {!showForm && (
        <Button
          onClick={() => {
            setForm({ ...emptyForm, categoryId: usableCategories[0]?.id ?? '' });
            setShowForm(true);
          }}
          icon={<FiPlus size={15} />}
        >
          Nueva actividad {tipo}
        </Button>
      )}

      <AnimatePresence initial={false}>
      {showForm && (
        <motion.div
          initial={{ opacity: 0, height: 0 }}
          animate={{ opacity: 1, height: 'auto' }}
          exit={{ opacity: 0, height: 0 }}
          transition={{ duration: 0.25 }}
          style={{ overflow: 'hidden' }}
        >
        <Card
          title={editing ? `Editar “${editing.title}”` : `Nueva actividad ${tipo}`}
          actions={
            <Button variant="ghost" size="sm" onClick={resetForm} icon={<FiX size={14} />}>
              Cancelar
            </Button>
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

            <Button type="submit" loading={saving} icon={<FiSave size={15} />}>
              {editing ? 'Guardar cambios' : 'Guardar actividad'}
            </Button>
          </form>
        </Card>
        </motion.div>
      )}
      </AnimatePresence>

      <div className="section-title">
        <h2>Actividades que gestiona</h2>
        {activities.length > 0 && (
          <div className="flex" style={{ gap: '0.6rem', flexWrap: 'wrap' }}>
            <SearchInput
              value={query}
              onChange={setQuery}
              placeholder="Buscar por título, lugar, categoría o etiqueta…"
            />
            <select
              className="status-select"
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              aria-label="Filtrar por estado"
            >
              <option value="">Todos los estados</option>
              {ACTIVITY_STATUSES.map((s) => (
                <option key={s} value={s}>
                  {lbl(ACTIVITY_STATUS_LABEL, s)}
                </option>
              ))}
            </select>
            <ResultCount shown={visible.length} total={activities.length} noun="actividades" />
          </div>
        )}
      </div>

      {activities.length === 0 ? (
        <Card>
          <EmptyState
            icon={<FiCalendar size={22} />}
            message={`Todavía no ha publicado ninguna actividad ${tipo}. Use el botón “Nueva actividad” para crear la primera.`}
          />
        </Card>
      ) : visible.length === 0 ? (
        <Card>
          <EmptyState
            icon={<FiSearch size={22} />}
            message="Ninguna actividad coincide con los filtros aplicados."
            action={
              <Button
                variant="secondary"
                size="sm"
                onClick={() => {
                  setQuery('');
                  setStatusFilter('');
                }}
              >
                Quitar filtros
              </Button>
            }
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
                {visible.map((a) => {
                  const pend = (a.registrationCount ?? 0) - (a.confirmedCount ?? 0);
                  return (
                    <tr key={a.id} className={selected === a.id ? 'row-picked' : undefined}>
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
                            title="Editar actividad"
                            aria-label={`Editar ${a.title}`}
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
        <Stagger index={0}>
        <Card
          title={`Participación · ${selectedActivity.title}`}
          actions={
            <div className="flex" style={{ gap: '0.6rem', flexWrap: 'wrap' }}>
              {participants.length > 0 && (
                <SearchInput
                  value={partQuery}
                  onChange={setPartQuery}
                  placeholder="Buscar estudiante…"
                />
              )}
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setSelected(null)}
                icon={<FiX size={14} />}
              >
                Cerrar
              </Button>
            </div>
          }
        >
          <p className="muted">
            Confirmados: <strong>{allConfirmed.length}</strong> de{' '}
            {selectedActivity.capacity ?? 'cupo ilimitado'}
            {full && ' · el cupo está lleno'}
          </p>

          {partLoading ? (
            <SkeletonTable rows={3} columns={3} />
          ) : participants.length === 0 ? (
            <EmptyState
              icon={<FiUsers size={22} />}
              message="Todavía nadie manifestó interés ni se inscribió en esta actividad."
            />
          ) : shownParticipants.length === 0 ? (
            <EmptyState
              icon={<FiSearch size={22} />}
              message={`Ningún participante coincide con “${partQuery}”.`}
              action={
                <Button variant="secondary" size="sm" onClick={() => setPartQuery('')}>
                  Limpiar búsqueda
                </Button>
              }
            />
          ) : (
            <>
              <ParticipantGroup
                title={`Inscritos pendientes de registro (${pending.length})`}
                rows={pending}
                empty="No hay inscripciones pendientes."
                render={(r) => (
                  <div className="flex" style={{ gap: '0.35rem' }}>
                    <Button
                      size="sm"
                      disabled={full}
                      loading={busyRow === r.id}
                      title={full ? 'El cupo está lleno' : 'Registrar asistencia'}
                      onClick={() => decide(selectedActivity.id, r, 'confirmed')}
                      icon={<FiCheck size={14} />}
                    >
                      Confirmar participación
                    </Button>
                    <Button
                      variant="secondary"
                      size="sm"
                      loading={busyRow === r.id}
                      onClick={() => decide(selectedActivity.id, r, 'absent')}
                      icon={<FiUserX size={14} />}
                    >
                      Ausente
                    </Button>
                  </div>
                )}
              />

              <ParticipantGroup
                title={`Solo interesados (${interested.length})`}
                rows={interested}
                empty="Nadie marcó únicamente interés."
                render={(r) => (
                  <Button
                    variant="secondary"
                    size="sm"
                    disabled={full}
                    loading={busyRow === r.id}
                    onClick={() => decide(selectedActivity.id, r, 'confirmed')}
                    icon={<FiCheck size={14} />}
                  >
                    Confirmar participación
                  </Button>
                )}
              />

              <ParticipantGroup
                title={`Participación confirmada (${confirmed.length})`}
                rows={confirmed}
                empty="Todavía no hay participación confirmada."
                render={(r) => (
                  <Button
                    variant="secondary"
                    size="sm"
                    loading={busyRow === r.id}
                    onClick={() => decide(selectedActivity.id, r, 'absent')}
                    icon={<FiUserX size={14} />}
                  >
                    Marcar ausente
                  </Button>
                )}
              />

              {absent.length > 0 && (
                <ParticipantGroup
                  title={`Ausentes (${absent.length})`}
                  rows={absent}
                  empty=""
                  render={(r) => (
                    <Button
                      variant="secondary"
                      size="sm"
                      disabled={full}
                      loading={busyRow === r.id}
                      onClick={() => decide(selectedActivity.id, r, 'confirmed')}
                      icon={<FiCheck size={14} />}
                    >
                      Confirmar participación
                    </Button>
                  )}
                />
              )}
            </>
          )}
        </Card>
        </Stagger>
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
