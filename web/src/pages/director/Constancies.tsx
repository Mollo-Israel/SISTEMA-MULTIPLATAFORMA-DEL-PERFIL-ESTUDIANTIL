import { useEffect, useMemo, useState } from 'react';
import { FiAward, FiCalendar, FiCheck, FiSearch, FiX } from 'react-icons/fi';
import { apiError } from '../../api/client';
import { activityService, constancyService } from '../../services';
import {
  Badge, Button, Card, EmptyState, PageHeader, ResultCount, SearchInput, SkeletonCards,
  SkeletonTable, Stagger,
} from '../../components/ui';
import { useConfirm, useToast } from '../../components/feedback';
import type { Activity, EligibleParticipant, InternalConstancy } from '../../services/types';

const normalize = (s: string) =>
  s.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');

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
  const [query, setQuery] = useState('');
  const toast = useToast();
  const confirm = useConfirm();

  const notify = (t: string, detail?: string) => toast.success(t, detail);

  useEffect(() => {
    activityService
      .managed()
      .then(setActivities)
      .catch((e) => toast.error(apiError(e)))
      .finally(() => setLoading(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const loadActivity = async (activityId: string) => {
    setSelected(activityId);
    setTarget(null);
    setQuery('');
    setEligible([]);
    setIssued([]);
    if (!activityId) return;
    setListBusy(true);
    try {
      const [e, i] = await Promise.all([
        constancyService.eligible(activityId),
        constancyService.byActivity(activityId),
      ]);
      setEligible(e);
      setIssued(i);
    } catch (e2) {
      toast.error(apiError(e2));
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
    const who = target.studentName ?? 'el estudiante';
    const ok = await confirm({
      title: 'Emitir la constancia',
      message: (
        <>
          Se emitirá la constancia interna de <strong>{who}</strong>. Solo puede emitirse una
          vez por estudiante y actividad, y el estudiante la verá en sus evidencias.
        </>
      ),
      confirmLabel: 'Emitir constancia',
    });
    if (!ok) return;
    setSaving(true);
    try {
      await constancyService.create({
        profileId: target.studentProfileId,
        activityId: selected,
        description,
      });
      notify('Constancia emitida.', `${who} ya puede verla en sus evidencias.`);
      setTarget(null);
      setDescription('');
      await loadActivity(selected);
    } catch (e2) {
      toast.error(apiError(e2));
    } finally {
      setSaving(false);
    }
  };

  const needle = normalize(query.trim());
  const match = (name: string | null | undefined) =>
    !needle || normalize(name ?? '').includes(needle);

  const allPending = eligible.filter((e) => !e.hasConstancy);
  const pending = allPending.filter((e) => match(e.studentName));
  const withConstancy = eligible.filter((e) => e.hasConstancy);

  if (loading) return <SkeletonCards count={2} />;

  return (
    <div>
      <PageHeader
        title="Constancias internas"
        description={
          <>
            Se emiten únicamente sobre participación <strong>confirmada</strong> y una sola vez
            por estudiante y actividad. Es una constancia interna del sistema: no sustituye ni
            equivale a un certificado oficial de la universidad.
          </>
        }
      />

      <Card title="Elegir actividad">
        {activities.length === 0 ? (
          <EmptyState
            icon={<FiCalendar size={22} />}
            message="Todavía no gestiona ninguna actividad. Publique una desde “Actividades académicas”."
          />
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

      {listBusy && <SkeletonTable rows={4} columns={3} />}

      {selected && !listBusy && (
        <>
          <Card
            title={`Participación confirmada sin constancia (${allPending.length})`}
            actions={
              allPending.length > 0 ? (
                <div className="flex" style={{ gap: '0.6rem', flexWrap: 'wrap' }}>
                  <SearchInput
                    value={query}
                    onChange={setQuery}
                    placeholder="Buscar estudiante…"
                  />
                  <ResultCount
                    shown={pending.length}
                    total={allPending.length}
                    noun="estudiantes"
                  />
                </div>
              ) : undefined
            }
          >
            {allPending.length === 0 ? (
              <EmptyState
                icon={<FiAward size={22} />}
                message={
                  eligible.length === 0
                    ? 'Esta actividad todavía no tiene participación confirmada. Registre primero la asistencia desde “Actividades académicas”.'
                    : 'Todos los participantes confirmados ya tienen su constancia.'
                }
              />
            ) : pending.length === 0 ? (
              <EmptyState
                icon={<FiSearch size={22} />}
                message={`Ningún estudiante coincide con “${query}”.`}
                action={
                  <Button variant="secondary" size="sm" onClick={() => setQuery('')}>
                    Limpiar búsqueda
                  </Button>
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
                      <tr
                        key={p.studentProfileId}
                        className={
                          target?.studentProfileId === p.studentProfileId ? 'row-picked' : undefined
                        }
                      >
                        <td>{p.studentName ?? 'Estudiante'}</td>
                        <td className="muted">{p.semester ? `${p.semester}º` : '—'}</td>
                        <td>
                          <Button
                            size="sm"
                            variant={
                              target?.studentProfileId === p.studentProfileId
                                ? 'primary'
                                : 'secondary'
                            }
                            onClick={() => startIssue(p)}
                            icon={<FiAward size={14} />}
                          >
                            Emitir constancia
                          </Button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </Card>

          {target && (
            <Stagger index={0}>
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
                  <Button type="submit" loading={saving} icon={<FiAward size={15} />}>
                    Emitir constancia
                  </Button>
                  <Button
                    type="button"
                    variant="secondary"
                    onClick={() => setTarget(null)}
                    icon={<FiX size={14} />}
                  >
                    Cancelar
                  </Button>
                </div>
              </form>
            </Card>
            </Stagger>
          )}

          <Card title={`Constancias emitidas (${issued.length})`}>
            {issued.length === 0 ? (
              <EmptyState
                icon={<FiAward size={22} />}
                message="Todavía no se emitió ninguna constancia para esta actividad."
              />
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
