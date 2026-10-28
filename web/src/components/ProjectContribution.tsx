import { useEffect, useMemo, useState } from 'react';
import { FiAlertCircle, FiCheck, FiCheckCircle, FiSave, FiSearch } from 'react-icons/fi';
import { apiError } from '../api/client';
import { catalogService, projectDetailService, projectService } from '../services';
import { useToast } from './feedback';
import { FieldError } from './form';
import { Badge, Button, Card, EmptyState, Modal, SearchInput, SkeletonText } from './ui';
import type { ProjectMemberDetailed } from '../services/types';
import { PROJECT_ROLES } from '../services/types';

/**
 * V5-29 (§4.4): qué áreas suele tocar cada rol. Solo ordena las tecnologías
 * para encontrarlas antes; no prohíbe ninguna (G05: un rol Backend puede usar
 * cualquier tecnología del proyecto) ni prueba nada.
 */
const AREAS_DEL_ROL: Record<string, RegExp> = {
  Frontend: /web|interfa|front|dise/i,
  Backend: /software|web|back|servid/i,
  'Base de Datos': /datos|base/i,
  Mobile: /m[oó]vil|mobile/i,
  QA: /software|calidad|prueba/i,
  'UX/UI': /dise|interfa|experiencia/i,
  DevOps: /redes|infraestructura|nube|devops|sistemas/i,
  'Datos/IA': /inteligencia|datos|ciencia/i,
};

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
 * Las tecnologías que elige son **las suyas**, no las del proyecto (§34), y
 * salen de las tecnologías del proyecto (V5-20, §13.2): no del catálogo entero.
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
  // V5-20: solo las tecnologías del proyecto, con el área en la que se usan.
  const [delProyecto, setDelProyecto] = useState<{ id: string; name: string; area: string }[]>([]);
  // V5-22: excluir y pedir corrección con un modal propio, con motivo.
  const [excluyendo, setExcluyendo] = useState<ProjectMemberDetailed | null>(null);
  const [motivo, setMotivo] = useState('');
  const [corrigiendo, setCorrigiendo] = useState(false);
  const [nota, setNota] = useState('');
  const [errorModal, setErrorModal] = useState<string | null>(null);
  const [query, setQuery] = useState('');
  const [form, setForm] = useState({ contribution: '', roles: [] as string[], skillIds: [] as string[] });
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
          roles: propia.roles?.length ? propia.roles : propia.role ? [propia.role] : [],
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
    Promise.all([projectService.get(projectId), catalogService.areas(), catalogService.skills()])
      .then(([p, areas, catalogo]) => {
        const nombreArea = new Map(areas.map((a) => [a.id, a.name]));
        const lista = (p.projectSkills ?? [])
          .filter((s) => s.skill)
          .map((s) => ({ id: s.skillId, name: s.skill!.name, area: (s.academicAreaId && nombreArea.get(s.academicAreaId)) || 'Sin área' }));
        // Un proyecto anterior al catálogo declara sus tecnologías como texto.
        const texto = new Set((p.technologies ?? []).map((t) => normalize(t.trim())));
        for (const s of catalogo) {
          if (lista.some((x) => x.id === s.id)) continue;
          if (texto.has(normalize(s.name)) || (s.aliases ?? []).some((a) => texto.has(normalize(a)))) {
            lista.push({ id: s.id, name: s.name, area: (s.academicAreaId && nombreArea.get(s.academicAreaId)) || 'Sin área' });
          }
        }
        setDelProyecto(lista);
      })
      .catch(() => setDelProyecto([]));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [projectId]);

  const visibles = useMemo(() => {
    const q = normalize(query.trim());
    return q ? delProyecto.filter((s) => normalize(s.name).includes(q)) : delProyecto;
  }, [delProyecto, query]);
  const porArea = useMemo(() => {
    const m = new Map<string, typeof visibles>();
    for (const s of visibles) m.set(s.area, [...(m.get(s.area) ?? []), s]);
    // V5-29: primero las áreas que suelen tocar sus roles; el resto sigue disponible.
    const afin = (area: string) => form.roles.some((r) => AREAS_DEL_ROL[r]?.test(area));
    return [...m.entries()].sort(([a], [b]) => Number(afin(b)) - Number(afin(a)) || a.localeCompare(b, 'es'));
  }, [visibles, form.roles]);

  // V4.1 A41-023: el responsable excluye a alguien de ESTE proyecto, con motivo; el equipo no cambia.
  // V5-22: modal propio con motivo obligatorio (no window.prompt).
  const excluir = async () => {
    if (!excluyendo) return;
    if (motivo.trim().length < 5) { setErrorModal('Explica el motivo (al menos 5 caracteres): queda en el historial.'); return; }
    setSaving(true);
    try {
      await projectDetailService.removeMember(projectId, excluyendo.id, motivo.trim());
      toast.success('Integrante excluido del proyecto.', 'Su lugar en el equipo no cambia.');
      setExcluyendo(null);
      await load();
      onChanged?.();
    } catch (e) {
      setErrorModal(apiError(e));
    } finally {
      setSaving(false);
    }
  };

  // V3 §30: si lo que te propusieron no es lo que hiciste, pídele que lo corrija.
  const pedirCorreccion = async () => {
    if (nota.trim().length < 10) { setErrorModal('Explica qué hay que corregir (al menos 10 caracteres).'); return; }
    setSaving(true);
    try {
      await projectDetailService.requestCorrection(projectId, nota.trim());
      toast.success('Corrección pedida', 'El responsable recibirá tu nota.');
      setCorrigiendo(false);
      await load();
    } catch (e) {
      setErrorModal(apiError(e));
    } finally {
      setSaving(false);
    }
  };

  const guardar = async () => {
    setSaving(true);
    try {
      const validas = new Set(delProyecto.map((s) => s.id));
      await projectDetailService.confirmMyContribution(projectId, {
        contribution: form.contribution || undefined,
        roles: form.roles,
        skillIds: form.skillIds.filter((id) => validas.has(id)),
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
            <label htmlFor="project-contribution-que-hiciste">Qué hiciste</label>
            <textarea id="project-contribution-que-hiciste"
              value={form.contribution}
              onChange={(e) => setForm({ ...form, contribution: e.target.value })}
              placeholder="Implementé la API de inscripciones y las pruebas del módulo."
              maxLength={1000}
            />
            <span className="field-hint">{form.contribution.length} de 1000 caracteres</span>
          </div>

          <div className="field">
            <span className="field-label" id={`rol-${projectId}`}>Tus roles</span>
            <div className="chip-row" role="group" aria-labelledby={`rol-${projectId}`}>
              {PROJECT_ROLES.map((r) => {
                const on = form.roles.includes(r);
                return (
                  <button key={r} type="button" className={`chip ${on ? 'on' : ''}`} aria-pressed={on}
                    onClick={() => setForm({ ...form, roles: on ? form.roles.filter((x) => x !== r) : [...form.roles, r].slice(0, 4) })}>
                    {on && <FiCheck size={12} />} {r}
                  </button>
                );
              })}
            </div>
            <span className="field-hint">
              Puedes tener varios (hasta 4); el primero es el principal. Un rol describe lo que hiciste:
              no prueba tecnologías ni cambia tu afinidad, que sale de lo que confirmas.
            </span>
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
              Solo las que tocaste, entre las del proyecto. Que el proyecto use cuatro tecnologías
              no significa que las hayas usado todas.
            </p>

            {delProyecto.length === 0 ? (
              <EmptyState
                icon={<FiSearch size={20} />}
                message="El proyecto todavía no tiene tecnologías. El responsable las agrega primero; después eliges las que usaste."
              />
            ) : visibles.length === 0 ? (
              <EmptyState
                icon={<FiSearch size={20} />}
                message={`Ninguna tecnología del proyecto coincide con “${query}”.`}
              />
            ) : porArea.map(([area, lista]) => (
              <div key={area} style={{ marginBottom: '0.5rem' }}>
                <div className="muted small">{area}</div>
              <div className="chip-row">
                {lista.map((s) => {
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
              </div>
            ))}
          </div>

          <div className="flex" style={{ gap: '0.5rem', flexWrap: 'wrap' }}>
            <Button onClick={guardar} loading={saving} icon={<FiSave size={15} />}>
              {mine.contributionConfirmed ? 'Guardar y reconfirmar' : 'Confirmar mi contribución'}
            </Button>
            {!isOwner && (
              <Button variant="secondary" onClick={() => { setCorrigiendo(true); setNota(''); setErrorModal(null); }} loading={saving}>
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
                {isOwner && <th></th>}
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
                  {isOwner && (
                    <td>
                      {m.userId !== currentUserId && (
                        <Button size="sm" variant="ghost" onClick={() => { setExcluyendo(m); setMotivo(''); setErrorModal(null); }}>Excluir del proyecto</Button>
                      )}
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>

      {excluyendo && (
        <Modal title="Excluir del proyecto" subtitle={excluyendo.name ?? 'Integrante'} onClose={() => setExcluyendo(null)} width={500}>
          <p className="muted">
            Deja de figurar en este proyecto y no se le atribuye su experiencia. Sigue en tu equipo de
            colaboración, y la exclusión queda en el historial con tu motivo.
          </p>
          <div className={`field ${errorModal ? 'has-error' : ''}`}>
            <label htmlFor="excluir-motivo">Motivo</label>
            <textarea id="excluir-motivo" value={motivo} maxLength={300}
              onChange={(e) => { setMotivo(e.target.value); setErrorModal(null); }}
              placeholder="Por ejemplo: no participó en este proyecto, solo en el anterior." />
            <FieldError message={errorModal} />
          </div>
          <div className="form-actions">
            <Button variant="secondary" onClick={() => setExcluyendo(null)}>Volver</Button>
            <Button variant="danger" loading={saving} onClick={() => void excluir()}>Excluir del proyecto</Button>
          </div>
        </Modal>
      )}
      {corrigiendo && (
        <Modal title="Pedir una corrección" subtitle="A quien lleva el proyecto" onClose={() => setCorrigiendo(false)} width={500}>
          <div className={`field ${errorModal ? 'has-error' : ''}`}>
            <label htmlFor="correccion-nota">¿Qué hay que corregir de lo que te propusieron?</label>
            <textarea id="correccion-nota" value={nota} maxLength={500}
              onChange={(e) => { setNota(e.target.value); setErrorModal(null); }} />
            <FieldError message={errorModal} />
          </div>
          <div className="form-actions">
            <Button variant="secondary" onClick={() => setCorrigiendo(false)}>Volver</Button>
            <Button loading={saving} onClick={() => void pedirCorreccion()}>Pedir corrección</Button>
          </div>
        </Modal>
      )}
    </>
  );
}
