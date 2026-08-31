import { useEffect, useState } from 'react';
import { FiAward, FiCheck } from 'react-icons/fi';
import { apiError } from '../../api/client';
import { activityService, constancyService } from '../../services';
import { Card, Badge, Loading, EmptyState } from '../../components/ui';
import type { Activity, EligibleParticipant, InternalConstancy } from '../../services/types';

/**
 * Emisión de constancias internas (RF12).
 * Solo el director de carrera, y únicamente sobre participación confirmada.
 */
export default function DirectorConstanciesPage() {
  const [activities, setActivities] = useState<Activity[]>([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<string>('');
  const [eligible, setEligible] = useState<EligibleParticipant[]>([]);
  const [issued, setIssued] = useState<InternalConstancy[]>([]);
  const [listBusy, setListBusy] = useState(false);
  const [target, setTarget] = useState<EligibleParticipant | null>(null);
  const [description, setDescription] = useState('');
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);

  const notify = (t: string) => {
    setMsg(t);
    setErr(null);
    window.setTimeout(() => setMsg(null), 4500);
  };

  useEffect(() => {
    activityService
      .managed()
      .then(setActivities)
      .catch((e) => setErr(apiError(e)))
      .finally(() => setLoading(false));
  }, []);

  const loadActivity = async (activityId: string) => {
    setSelected(activityId);
    setTarget(null);
    setEligible([]);
    setIssued([]);
    if (!activityId) return;
    setListBusy(true);
    setErr(null);
    try {
      const [e, i] = await Promise.all([
        constancyService.eligible(activityId),
        constancyService.byActivity(activityId),
      ]);
      setEligible(e);
      setIssued(i);
    } catch (e2) {
      setErr(apiError(e2));
    } finally {
      setListBusy(false);
    }
  };

  const startIssue = (p: EligibleParticipant) => {
    const activity = activities.find((a) => a.id === selected);
    setTarget(p);
    setDescription(
      activity ? `Participó en la actividad “${activity.title}” organizada por la carrera.` : '',
    );
  };

  const issue = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!target) return;
    setSaving(true);
    setErr(null);
    try {
      await constancyService.create({
        profileId: target.studentProfileId,
        activityId: selected,
        description,
      });
      notify(`Constancia emitida para ${target.studentName ?? 'el estudiante'}.`);
      setTarget(null);
      setDescription('');
      await loadActivity(selected);
    } catch (e2) {
      setErr(apiError(e2));
    } finally {
      setSaving(false);
    }
  };

  const pending = eligible.filter((e) => !e.hasConstancy);
  const withConstancy = eligible.filter((e) => e.hasConstancy);

  if (loading) return <Loading label="Cargando actividades…" />;

  return (
    <div>
      <h1>Constancias internas</h1>
      <p className="muted">
        Se emiten únicamente sobre participación <strong>confirmada</strong> y una sola vez por
        estudiante y actividad. Es una constancia interna del sistema: no sustituye ni equivale a
        un certificado oficial de la universidad.
      </p>

      {msg && <div className="alert alert-success">{msg}</div>}
      {err && <div className="alert alert-error">{err}</div>}

      <Card title="Elegir actividad">
        {activities.length === 0 ? (
          <EmptyState message="Todavía no gestiona ninguna actividad. Publique una desde “Actividades académicas”." />
        ) : (
          <div className="field">
            <label>Actividad</label>
            <select value={selected} onChange={(e) => loadActivity(e.target.value)}>
              <option value="">Seleccione una actividad…</option>
              {activities.map((a) => (
                <option key={a.id} value={a.id}>
                  {a.title} · {a.confirmedCount ?? 0} confirmado
                  {(a.confirmedCount ?? 0) === 1 ? '' : 's'}
                </option>
              ))}
            </select>
          </div>
        )}
      </Card>

      {listBusy && <Loading label="Cargando participantes…" />}

      {selected && !listBusy && (
        <>
          <Card title={`Participación confirmada sin constancia (${pending.length})`}>
            {pending.length === 0 ? (
              <EmptyState
                message={
                  eligible.length === 0
                    ? 'Esta actividad todavía no tiene participación confirmada. Registre primero la asistencia desde “Actividades académicas”.'
                    : 'Todos los participantes confirmados ya tienen su constancia.'
                }
              />
            ) : (
              <div className="scroll-x">
                <table>
                  <thead>
                    <tr>
                      <th>Estudiante</th>
                      <th>Semestre</th>
                      <th></th>
                    </tr>
                  </thead>
                  <tbody>
                    {pending.map((p) => (
                      <tr key={p.studentProfileId}>
                        <td>{p.studentName ?? 'Estudiante'}</td>
                        <td className="muted">{p.semester ? `${p.semester}º` : '—'}</td>
                        <td>
                          <button
                            className={`btn btn-sm ${target?.studentProfileId === p.studentProfileId ? 'btn-primary' : 'btn-secondary'}`}
                            onClick={() => startIssue(p)}
                          >
                            <FiAward /> Emitir constancia
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </Card>

          {target && (
            <Card title={`Emitir constancia · ${target.studentName ?? 'Estudiante'}`}>
              <form onSubmit={issue}>
                <div className="field">
                  <label>Texto de la constancia</label>
                  <textarea
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    minLength={5}
                    maxLength={300}
                    required
                    placeholder="Describa la participación que se hace constar."
                  />
                  <span className="muted" style={{ fontSize: '0.76rem' }}>
                    {description.length}/300 caracteres
                  </span>
                </div>
                <div className="flex" style={{ gap: '0.5rem' }}>
                  <button className="btn btn-primary" disabled={saving}>
                    {saving ? 'Emitiendo…' : 'Emitir constancia'}
                  </button>
                  <button type="button" className="btn btn-secondary" onClick={() => setTarget(null)}>
                    Cancelar
                  </button>
                </div>
              </form>
            </Card>
          )}

          <Card title={`Constancias emitidas (${issued.length})`}>
            {issued.length === 0 ? (
              <EmptyState message="Todavía no se emitió ninguna constancia para esta actividad." />
            ) : (
              <div className="scroll-x">
                <table>
                  <thead>
                    <tr>
                      <th>Estudiante</th>
                      <th>Texto</th>
                      <th>Estado</th>
                      <th>Emitida</th>
                    </tr>
                  </thead>
                  <tbody>
                    {issued.map((c) => (
                      <tr key={c.id}>
                        <td>
                          {c.studentProfile?.user
                            ? `${c.studentProfile.user.firstName} ${c.studentProfile.user.lastName}`
                            : withConstancy.find((e) => e.studentProfileId === c.studentProfileId)
                                ?.studentName || 'Estudiante'}
                        </td>
                        <td className="muted">{c.description}</td>
                        <td>
                          <Badge tone="green">
                            <FiCheck /> Autorizada
                          </Badge>
                        </td>
                        <td className="muted">
                          {new Date(c.createdAt).toLocaleDateString('es-BO', {
                            day: '2-digit',
                            month: 'short',
                            year: 'numeric',
                          })}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </Card>
        </>
      )}
    </div>
  );
}
