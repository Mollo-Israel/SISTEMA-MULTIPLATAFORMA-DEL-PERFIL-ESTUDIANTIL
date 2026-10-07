import { useEffect, useMemo, useState } from 'react';
import { FiAlertCircle, FiCheck, FiCheckCircle, FiSave, FiSearch } from 'react-icons/fi';
import { apiError } from '../api/client';
import { catalogService, projectDetailService } from '../services';
import { useToast } from './feedback';
import { Badge, Button, Card, EmptyState, SearchInput, SkeletonText } from './ui';
import type { ProjectMemberDetailed, Skill } from '../services/types';
import { PROJECT_ROLES } from '../services/types';

const normalize = (s: string) =>
  s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');

/**
 * Contribución de un integrante, confirmada por él mismo (§33, §34).
 *
 * Esta pantalla existe porque §33 prohíbe que el responsable atribuya
 * unilateralmente experiencia a otro estudiante. Sin ella, un integrante
 * aceptado no obtendría nada del proyecto: la contribución que otro escribió
 * no alimenta su perfil hasta que él la revisa y la hace suya.
 *
 * Las tecnologías que elige son **las suyas**, no las del proyecto (§34).
 */
export default function ProjectContribution({
  projectId,
  currentUserId,
  isOwner,
  onChanged,
}: {
  projectId: string;
  currentUserId: string;
  isOwner: boolean;
  onChanged?: () => void;
}) {
  const toast = useToast();
  const [members, setMembers] = useState<ProjectMemberDetailed[] | null>(null);
  const [skills, setSkills] = useState<Skill[]>([]);
  const [query, setQuery] = useState('');
  const [form, setForm] = useState({ contribution: '', role: '', skillIds: [] as string[] });
  const [saving, setSaving] = useState(false);

  const mine = useMemo(
    () => (members ?? []).find((m) => m.userId === currentUserId) ?? null,
    [members, currentUserId],
  );

  const load = async () => {
    try {
      const rows = await projectDetailService.membersDetailed(projectId);
      setMembers(rows);
      const propia = rows.find((m) => m.userId === currentUserId);
      if (propia) {
        setForm({
          contribution: propia.contribution ?? '',
          role: propia.role ?? '',
          skillIds: propia.skillsUsed.map((s) => s.skillId),
        });
      }
    } catch (e) {
      toast.error(apiError(e));
      setMembers([]);
    }
  };

  useEffect(() => {
    void load();
    catalogService.skills().then(setSkills).catch(() => {});
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [projectId]);

  const visibles = useMemo(() => {
    const q = normalize(query.trim());
    if (!q) return skills.slice(0, 40);
    return skills.filter((s) => normalize(s.name).includes(q)).slice(0, 40);
  }, [skills, query]);

  // V3 §30: si lo que te propusieron no es lo que hiciste, pídele que lo corrija.
  const pedirCorreccion = async () => {
    const nota = window.prompt('¿Qué hay que corregir de lo que te propusieron?', '');
    if (!nota || nota.trim().length < 10) {
      if (nota !== null) toast.error('Explica qué hay que corregir (al menos 10 caracteres).');
      return;
    }
    setSaving(true);
    try {
      await projectDetailService.requestCorrection(projectId, nota.trim());
      toast.success('Corrección pedida', 'El responsable recibirá tu nota.');
      await load();
    } catch (e) {
      toast.error(apiError(e));
    } finally {
      setSaving(false);
    }
  };

  const guardar = async () => {
    setSaving(true);
    try {
      await projectDetailService.confirmMyContribution(projectId, {
        contribution: form.contribution || undefined,
        role: form.role || undefined,
        skillIds: form.skillIds,
      });
      toast.success(
        'Contribución confirmada.',
        'Ahora este proyecto cuenta en tu perfil con las tecnologías que declaraste.',
      );
      await load();
      onChanged?.();
    } catch (e) {
      toast.error(apiError(e));
    } finally {
      setSaving(false);
    }
  };

  if (members === null) {
    return <Card title="Contribuciones"><SkeletonText lines={4} /></Card>;
  }
  if (members.length === 0) {
    return (
      <Card title="Contribuciones">
        <EmptyState message="Este proyecto todavía no tiene integrantes aceptados." />
      </Card>
    );
  }

  return (
    <>
      {mine && (
        <Card
          title="Mi contribución"
          actions={
            <Badge tone={mine.contributionConfirmed ? 'green' : 'amber'}>
              {mine.contributionConfirmed ? 'Confirmada' : 'Sin confirmar'}
            </Badge>
          }
        >
          {!mine.contributionConfirmed && (
            <p className="inline-note">
              <FiAlertCircle size={13} /> Mientras no la confirmes, este proyecto no cuenta
              en tu perfil. Nadie puede atribuirte experiencia por ti.
            </p>
          )}

          <div className="field">
            <label>Qué hiciste</label>
            <textarea
              value={form.contribution}
              onChange={(e) => setForm({ ...form, contribution: e.target.value })}
              placeholder="Implementé la API de inscripciones y las pruebas del módulo."
              maxLength={1000}
            />
            <span className="field-hint">{form.contribution.length} de 1000 caracteres</span>
          </div>

          <div className="field">
            <label htmlFor={`rol-${projectId}`}>Tu rol</label>
            <select
              id={`rol-${projectId}`}
              value={form.role}
              onChange={(e) => setForm({ ...form, role: e.target.value })}
            >
              <option value="">Elige tu rol…</option>
              {PROJECT_ROLES.map((r) => <option key={r} value={r}>{r}</option>)}
            </select>
            <span className="field-hint">El rol describe lo que hiciste; tu afinidad sale de las tecnologías que confirmas.</span>
          </div>

          <div className="field">
            <div className="flex between" style={{ marginBottom: '0.5rem', flexWrap: 'wrap', gap: '0.6rem' }}>
              <label style={{ margin: 0 }}>Tecnologías que usaste tú</label>
              <div className="flex" style={{ gap: '0.6rem' }}>
                <Badge tone={form.skillIds.length ? 'bordo' : 'gray'}>
                  {form.skillIds.length} seleccionada{form.skillIds.length === 1 ? '' : 's'}
                </Badge>
                <SearchInput value={query} onChange={setQuery} placeholder="Buscar tecnología…" />
              </div>
            </div>
            <p className="muted" style={{ marginTop: 0, fontSize: '0.78rem' }}>
              Solo las que tocaste. Que el proyecto use cuatro tecnologías no significa que
              las hayas usado todas.
            </p>

            {visibles.length === 0 ? (
              <EmptyState
                icon={<FiSearch size={20} />}
                message={`Ninguna tecnología coincide con “${query}”.`}
              />
            ) : (
              <div className="chip-row">
                {visibles.map((s) => {
                  const on = form.skillIds.includes(s.id);
                  return (
                    <button
                      type="button"
                      key={s.id}
                      className={`chip ${on ? 'on' : ''}`}
                      onClick={() => setForm({
                        ...form,
                        skillIds: on
                          ? form.skillIds.filter((x) => x !== s.id)
                          : [...form.skillIds, s.id],
                      })}
                      aria-pressed={on}
                    >
                      {on && <FiCheck size={12} />} {s.name}
                    </button>
                  );
                })}
              </div>
            )}
          </div>

          <div className="flex" style={{ gap: '0.5rem', flexWrap: 'wrap' }}>
            <Button onClick={guardar} loading={saving} icon={<FiSave size={15} />}>
              {mine.contributionConfirmed ? 'Guardar y reconfirmar' : 'Confirmar mi contribución'}
            </Button>
            {!isOwner && (
              <Button variant="secondary" onClick={pedirCorreccion} loading={saving}>
                Pedir corrección al responsable
              </Button>
            )}
          </div>
        </Card>
      )}

      <Card title="Contribuciones del equipo">
        <p className="muted" style={{ marginTop: 0 }}>
          {isOwner
            ? 'Puedes proponer una contribución para cada integrante, pero solo ellos pueden confirmarla.'
            : 'Cada integrante confirma lo que hizo.'}
        </p>
        <div className="scroll-x">
          <table>
            <thead>
              <tr>
                <th>Integrante</th>
                <th>Rol</th>
                <th>Contribución</th>
                <th>Tecnologías</th>
                <th>Estado</th>
              </tr>
            </thead>
            <tbody>
              {members.map((m) => (
                <tr key={m.id}>
                  <td>{m.name ?? '—'}</td>
                  <td className="muted">{m.role ?? '—'}</td>
                  <td className="muted" style={{ maxWidth: 280 }}>{m.contribution ?? '—'}</td>
                  <td>
                    {m.skillsUsed.length === 0 ? (
                      <span className="muted">Sin declarar</span>
                    ) : (
                      <div className="chip-row">
                        {m.skillsUsed.map((s) => (
                          <span key={s.skillId} className="chip">{s.name}</span>
                        ))}
                      </div>
                    )}
                  </td>
                  <td>
                    {m.contributionConfirmed ? (
                      <Badge tone="green"><FiCheckCircle size={11} /> Confirmada</Badge>
                    ) : (
                      <Badge tone="amber">Pendiente</Badge>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>
    </>
  );
}
