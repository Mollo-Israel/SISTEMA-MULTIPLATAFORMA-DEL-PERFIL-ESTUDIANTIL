import { useEffect, useMemo, useState } from 'react';
import {
  FiCheck, FiCopy, FiLink, FiMessageSquare, FiRefreshCw, FiSend, FiUserPlus, FiUsers, FiX,
} from 'react-icons/fi';
import { apiError } from '../../api/client';
import {
  collaborationService,
  type ContactView,
  type ConversationView,
  type MessageView,
  type PublicLinkView,
  type TeamNeedView,
  type TeamSuggestionsView,
  type TeamView,
} from '../../services';
import { catalogService } from '../../services';
import type { Skill } from '../../services/types';
import { useConfirm, useToast } from '../../components/feedback';
import {
  Badge, Button, Card, EmptyState, Loading, PageHeader, Tabs,
} from '../../components/ui';

const DISPONIBILIDAD: Record<string, string> = {
  looking: 'Busca equipo',
  open: 'Escucha propuestas',
  busy: 'Sin margen',
  unspecified: 'Sin declarar',
};

/**
 * Colaboración del estudiante (§43 a §47).
 *
 * Una sola pantalla con cuatro pestañas porque las cuatro cosas son la misma
 * historia contada en orden: comparto mi perfil, alguien me contacta, formamos
 * un equipo, hablamos. Separarlas en cuatro entradas de menú obligaría a
 * recorrerlas para entender de qué va.
 */
export default function StudentCollaborationPage() {
  const [tab, setTab] = useState<'enlace' | 'contactos' | 'equipos' | 'mensajes'>('enlace');
  const toast = useToast();
  const confirm = useConfirm();

  return (
    <div>
      <PageHeader
        title="Colaboración"
        description="Tu perfil compartible, tus contactos y los equipos que formas con ellos."
      />
      <Tabs
        value={tab}
        onChange={(k) => setTab(k as typeof tab)}
        items={[
          { key: 'enlace', label: 'Mi enlace y QR' },
          { key: 'contactos', label: 'Contactos' },
          { key: 'equipos', label: 'Equipos' },
          { key: 'mensajes', label: 'Mensajes' },
        ]}
      />

      {tab === 'enlace' && <MiEnlace toast={toast} confirm={confirm} />}
      {tab === 'contactos' && <Contactos toast={toast} confirm={confirm} />}
      {tab === 'equipos' && <Equipos toast={toast} />}
      {tab === 'mensajes' && <Mensajes toast={toast} />}
    </div>
  );
}

// ---------------------------------------------------------------------------
// §43 · Mi enlace y mi QR
// ---------------------------------------------------------------------------

function MiEnlace({ toast, confirm }: { toast: any; confirm: any }) {
  const [enlace, setEnlace] = useState<PublicLinkView | null>(null);
  const [rotando, setRotando] = useState(false);
  const [copiado, setCopiado] = useState(false);

  const cargar = () =>
    collaborationService.myPublicLink().then(setEnlace).catch((e) => toast.error(apiError(e)));

  useEffect(() => { void cargar(); /* eslint-disable-next-line */ }, []);

  const rotar = async () => {
    const ok = await confirm({
      title: 'Cambiar tu identificador',
      message:
        'Los códigos QR que ya imprimiste o compartiste dejarán de funcionar. '
        + 'Es lo que se hace cuando un QR tuyo acabó donde no debía.',
      confirmLabel: 'Cambiar',
      tone: 'danger',
    });
    if (!ok) return;
    setRotando(true);
    try {
      setEnlace(await collaborationService.rotatePublicLink());
      toast.success('Identificador cambiado.', 'Los códigos anteriores ya no llevan a tu perfil.');
    } catch (e) {
      toast.error(apiError(e));
    } finally {
      setRotando(false);
    }
  };

  const copiar = async () => {
    if (!enlace) return;
    try {
      await navigator.clipboard.writeText(enlace.url);
      setCopiado(true);
      setTimeout(() => setCopiado(false), 2000);
    } catch {
      toast.error('No se pudo copiar el enlace.');
    }
  };

  if (!enlace) return <Card><Loading /></Card>;

  return (
    <Card
      title="Tu perfil compartible"
      actions={
        <Badge tone={enlace.enabled ? 'green' : 'gray'}>
          {enlace.enabled ? 'Publicado' : 'Sin publicar'}
        </Badge>
      }
    >
      {!enlace.enabled && (
        <p className="inline-note">
          Tu perfil todavía no está publicado. Actívalo en <strong>Privacidad</strong> y elige qué
          campos se ven: nada se comparte mientras no lo decidas.
        </p>
      )}

      <div className="qr-bloque">
        {/* El QR lo genera el servidor y contiene únicamente esta URL (§43). */}
        <div
          className="qr-lienzo"
          // eslint-disable-next-line react/no-danger
          dangerouslySetInnerHTML={{ __html: enlace.qrSvg }}
        />
        <div className="qr-datos">
          <p className="muted" style={{ marginTop: 0 }}>
            El código lleva solo este enlace. Ni tu correo, ni tu código universitario, ni ningún
            identificador interno.
          </p>
          <div className="flex" style={{ gap: '0.5rem', flexWrap: 'wrap' }}>
            <code className="enlace-publico">{enlace.url}</code>
            <Button
              size="sm"
              variant="secondary"
              icon={copiado ? <FiCheck size={14} /> : <FiCopy size={14} />}
              onClick={copiar}
            >
              {copiado ? 'Copiado' : 'Copiar'}
            </Button>
          </div>
          <div className="mt">
            <Button
              variant="secondary"
              loading={rotando}
              icon={<FiRefreshCw size={15} />}
              onClick={rotar}
            >
              Cambiar mi identificador
            </Button>
          </div>
        </div>
      </div>
    </Card>
  );
}

// ---------------------------------------------------------------------------
// §45 · Contactos
// ---------------------------------------------------------------------------

function Contactos({ toast, confirm }: { toast: any; confirm: any }) {
  const [contactos, setContactos] = useState<ContactView[] | null>(null);
  const [recibidas, setRecibidas] = useState<any[]>([]);
  const [enviadas, setEnviadas] = useState<any[]>([]);
  const [slug, setSlug] = useState('');
  const [mensaje, setMensaje] = useState('');
  const [enviando, setEnviando] = useState(false);

  const cargar = async () => {
    try {
      const [c, r, e] = await Promise.all([
        collaborationService.contacts(),
        collaborationService.receivedRequests(),
        collaborationService.sentRequests(),
      ]);
      setContactos(c);
      setRecibidas(r);
      setEnviadas(e);
    } catch (err) {
      toast.error(apiError(err));
      setContactos([]);
    }
  };

  useEffect(() => { void cargar(); /* eslint-disable-next-line */ }, []);

  const solicitar = async (e: React.FormEvent) => {
    e.preventDefault();
    setEnviando(true);
    try {
      await collaborationService.requestContact({
        slug: slug.trim(),
        message: mensaje || undefined,
        source: 'qr',
      });
      toast.success('Solicitud enviada.', 'Le llegará para que la acepte o la rechace.');
      setSlug('');
      setMensaje('');
      await cargar();
    } catch (err) {
      toast.error(apiError(err));
    } finally {
      setEnviando(false);
    }
  };

  const decidir = async (id: string, decision: 'accept' | 'reject') => {
    try {
      await collaborationService.decideContactRequest(id, decision);
      toast.success(decision === 'accept' ? 'Contacto establecido.' : 'Solicitud rechazada.');
      await cargar();
    } catch (err) {
      toast.error(apiError(err));
    }
  };

  const eliminar = async (c: ContactView) => {
    const ok = await confirm({
      title: `Deshacer el contacto con ${c.name}`,
      message: 'Dejarán de poder escribirse. Cualquiera de los dos puede volver a solicitarlo.',
      confirmLabel: 'Deshacer',
      tone: 'danger',
    });
    if (!ok) return;
    try {
      await collaborationService.removeContact(c.profileId);
      toast.success('Contacto deshecho.');
      await cargar();
    } catch (err) {
      toast.error(apiError(err));
    }
  };

  return (
    <>
      <Card title="Solicitar contacto">
        <p className="muted" style={{ marginTop: 0 }}>
          Escanear un QR te lleva al perfil, pero no establece contacto: eso lo decide la otra
          persona. Pega aquí el identificador que aparece al final de su enlace.
        </p>
        <form onSubmit={solicitar}>
          <div className="grid-2">
            <div className="field">
              <label>Identificador del perfil</label>
              <input
                value={slug}
                onChange={(e) => setSlug(e.target.value)}
                placeholder="cdwxx59caf76"
                required
              />
            </div>
            <div className="field">
              <label>Presentación (opcional)</label>
              <input
                value={mensaje}
                onChange={(e) => setMensaje(e.target.value)}
                placeholder="Nos vimos en el taller de redes."
                maxLength={300}
              />
            </div>
          </div>
          <Button type="submit" loading={enviando} icon={<FiUserPlus size={15} />}>
            Enviar solicitud
          </Button>
        </form>
      </Card>

      {recibidas.length > 0 && (
        <Card title={`Solicitudes recibidas (${recibidas.length})`}>
          {recibidas.map((r) => (
            <div key={r.id} className="flex between solicitud-fila">
              <div>
                <strong>{r.student?.name}</strong>
                {r.student?.semester && (
                  <span className="muted"> · {r.student.semester}.º semestre</span>
                )}
                {r.message && <p className="muted" style={{ margin: 0 }}>{r.message}</p>}
              </div>
              <div className="flex" style={{ gap: '0.4rem' }}>
                <Button size="sm" icon={<FiCheck size={14} />} onClick={() => decidir(r.id, 'accept')}>
                  Aceptar
                </Button>
                <Button
                  size="sm"
                  variant="secondary"
                  icon={<FiX size={14} />}
                  onClick={() => decidir(r.id, 'reject')}
                >
                  Rechazar
                </Button>
              </div>
            </div>
          ))}
        </Card>
      )}

      {enviadas.length > 0 && (
        <Card title={`Enviadas y sin responder (${enviadas.length})`}>
          {enviadas.map((r) => (
            <div key={r.id} className="flex between solicitud-fila">
              <span>{r.student?.name}</span>
              <Button
                size="sm"
                variant="secondary"
                onClick={async () => {
                  await collaborationService.cancelContactRequest(r.id);
                  await cargar();
                }}
              >
                Retirar
              </Button>
            </div>
          ))}
        </Card>
      )}

      <Card title="Mis contactos">
        {!contactos && <Loading />}
        {contactos && contactos.length === 0 && (
          <EmptyState
            icon={<FiUsers size={22} />}
            message="Todavía no tienes contactos. Comparte tu QR o solicita el de alguien."
          />
        )}
        {contactos && contactos.length > 0 && (
          <div className="scroll-x">
            <table>
              <thead>
                <tr><th>Estudiante</th><th>Semestre</th><th>Disponibilidad</th><th /></tr>
              </thead>
              <tbody>
                {contactos.map((c) => (
                  <tr key={c.contactId}>
                    <td>{c.name}</td>
                    <td className="muted">{c.semester ?? '—'}</td>
                    <td className="muted">
                      {DISPONIBILIDAD[c.availability ?? 'unspecified']}
                    </td>
                    <td>
                      <Button size="sm" variant="danger" onClick={() => eliminar(c)}>
                        Deshacer
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>
    </>
  );
}

// ---------------------------------------------------------------------------
// §46, §47, §93 · Equipos
// ---------------------------------------------------------------------------

function Equipos({ toast }: { toast: any }) {
  const [necesidades, setNecesidades] = useState<TeamNeedView[] | null>(null);
  const [equipos, setEquipos] = useState<TeamView[]>([]);
  const [invitaciones, setInvitaciones] = useState<any[]>([]);
  const [skills, setSkills] = useState<Skill[]>([]);
  const [sugerencias, setSugerencias] = useState<TeamSuggestionsView | null>(null);
  const [abierta, setAbierta] = useState<string | null>(null);
  const [form, setForm] = useState({ purpose: '', maxMembers: 4, skillIds: [] as string[] });
  const [creando, setCreando] = useState(false);

  const cargar = async () => {
    try {
      const [n, t, i] = await Promise.all([
        collaborationService.myNeeds(),
        collaborationService.myTeams(),
        collaborationService.myTeamInvitations(),
      ]);
      setNecesidades(n);
      setEquipos(t);
      setInvitaciones(i);
    } catch (e) {
      toast.error(apiError(e));
      setNecesidades([]);
    }
  };

  useEffect(() => {
    void cargar();
    catalogService.skills().then(setSkills).catch(() => {});
    // eslint-disable-next-line
  }, []);

  const crear = async (e: React.FormEvent) => {
    e.preventDefault();
    setCreando(true);
    try {
      await collaborationService.createTeamNeed({
        purpose: form.purpose,
        maxMembers: form.maxMembers,
        requiredSkillIds: form.skillIds,
        availabilityRequirement: 'open_or_looking',
      });
      toast.success('Necesidad publicada.', 'Ya puedes ver quién podría cubrir lo que falta.');
      setForm({ purpose: '', maxMembers: 4, skillIds: [] });
      await cargar();
    } catch (err) {
      toast.error(apiError(err));
    } finally {
      setCreando(false);
    }
  };

  const verCandidatos = async (needId: string) => {
    if (abierta === needId) { setAbierta(null); return; }
    setAbierta(needId);
    try {
      setSugerencias(await collaborationService.teamSuggestions(needId));
    } catch (e) {
      toast.error(apiError(e));
    }
  };

  const decidirInvitacion = async (id: string, decision: 'accept' | 'decline') => {
    try {
      await collaborationService.decideTeamInvitation(id, decision);
      toast.success(decision === 'accept' ? 'Te sumaste al equipo.' : 'Invitación declinada.');
      await cargar();
    } catch (e) {
      toast.error(apiError(e));
    }
  };

  return (
    <>
      {invitaciones.length > 0 && (
        <Card title={`Invitaciones a equipos (${invitaciones.length})`}>
          {invitaciones.map((i) => (
            <div key={i.id} className="flex between solicitud-fila">
              <div>
                <strong>{i.team?.name}</strong>
                <p className="muted" style={{ margin: 0 }}>{i.team?.purpose}</p>
                {i.message && <p className="muted" style={{ margin: 0 }}>«{i.message}»</p>}
              </div>
              <div className="flex" style={{ gap: '0.4rem' }}>
                <Button size="sm" onClick={() => decidirInvitacion(i.id, 'accept')}>Aceptar</Button>
                <Button
                  size="sm"
                  variant="secondary"
                  onClick={() => decidirInvitacion(i.id, 'decline')}
                >
                  Declinar
                </Button>
              </div>
            </div>
          ))}
        </Card>
      )}

      <Card title="¿Qué le falta a tu equipo?">
        <p className="muted" style={{ marginTop: 0 }}>
          Declara lo que <strong>falta</strong>, no lo que ya tienes: el sistema busca quien
          complemente, no quien repita.
        </p>
        <form onSubmit={crear}>
          <div className="field">
            <label>Para qué buscas gente</label>
            <input
              value={form.purpose}
              onChange={(e) => setForm({ ...form, purpose: e.target.value })}
              placeholder="Armar el panel de control del laboratorio"
              maxLength={300}
              required
            />
          </div>
          <div className="field">
            <label>Habilidades que faltan</label>
            <div className="chip-row">
              {skills.slice(0, 40).map((s) => {
                const on = form.skillIds.includes(s.id);
                return (
                  <button
                    type="button"
                    key={s.id}
                    className={`chip ${on ? 'on' : ''}`}
                    aria-pressed={on}
                    onClick={() => setForm({
                      ...form,
                      skillIds: on
                        ? form.skillIds.filter((x) => x !== s.id)
                        : [...form.skillIds, s.id],
                    })}
                  >
                    {s.name}
                  </button>
                );
              })}
            </div>
          </div>
          <Button type="submit" loading={creando} icon={<FiUsers size={15} />}>
            Publicar necesidad
          </Button>
        </form>
      </Card>

      <Card title="Mis necesidades">
        {!necesidades && <Loading />}
        {necesidades && necesidades.length === 0 && (
          <EmptyState message="Todavía no publicaste ninguna." />
        )}
        {(necesidades ?? []).map((n) => (
          <div key={n.id} className="necesidad">
            <div className="flex between">
              <strong>{n.purpose}</strong>
              <Badge tone={n.status === 'open' ? 'green' : 'gray'}>
                {n.status === 'open' ? 'Abierta' : 'Cerrada'}
              </Badge>
            </div>
            <div className="chip-row">
              {n.requiredSkills.map((s) => (
                <span key={s.skillId} className="chip">{s.name}</span>
              ))}
            </div>
            <Button size="sm" variant="secondary" onClick={() => verCandidatos(n.id)}>
              {abierta === n.id ? 'Ocultar candidatos' : 'Ver candidatos'}
            </Button>

            {abierta === n.id && sugerencias && (
              <div className="mt">
                <p className="muted">
                  {/* §47: sugerir no es invitar. Se dice en la pantalla. */}
                  Aparecer aquí no le envía nada a nadie. Invitar es una decisión tuya.
                </p>
                {sugerencias.candidates.length === 0 && (
                  <EmptyState message="Por ahora no hay candidatos que cubran lo que falta." />
                )}
                {sugerencias.candidates.map((c) => (
                  <div key={c.profileId} className="candidato">
                    <div className="flex between">
                      <div>
                        <strong>{c.name}</strong>
                        {c.semester && <span className="muted"> · {c.semester}.º semestre</span>}
                      </div>
                      <Badge tone="bordo">{Math.round(c.score)}/100</Badge>
                    </div>
                    <ul className="plain-list">
                      {c.reasons.map((r, i) => (
                        <li key={`${r.code}-${i}`} className="muted">{r.label}</li>
                      ))}
                    </ul>
                  </div>
                ))}
              </div>
            )}
          </div>
        ))}
      </Card>

      <Card title="Mis equipos">
        {equipos.length === 0 && <EmptyState message="Todavía no formas parte de ningún equipo." />}
        {equipos.map((t) => (
          <div key={t.id} className="necesidad">
            <div className="flex between">
              <strong>{t.name}</strong>
              <Badge tone={t.openings > 0 ? 'amber' : 'green'}>
                {t.openings > 0 ? `${t.openings} vacante(s)` : 'Completo'}
              </Badge>
            </div>
            {t.purpose && <p className="muted" style={{ margin: 0 }}>{t.purpose}</p>}
            <div className="grid-2 mt">
              <div>
                <span className="muted">Cubierto</span>
                <div className="chip-row">
                  {t.coveredSkills.map((s) => (
                    <span key={s.skillId} className="chip on">{s.name}</span>
                  ))}
                  {t.coveredSkills.length === 0 && <span className="muted">—</span>}
                </div>
              </div>
              <div>
                <span className="muted">Falta</span>
                <div className="chip-row">
                  {t.missingSkills.map((s) => (
                    <span key={s.skillId} className="chip">{s.name}</span>
                  ))}
                  {t.missingSkills.length === 0 && <span className="muted">—</span>}
                </div>
              </div>
            </div>
            <div className="chip-row mt">
              {t.members.map((m) => (
                <span key={m.profileId} className="chip">
                  {m.name}{m.role ? ` · ${m.role}` : ''}
                </span>
              ))}
            </div>
          </div>
        ))}
      </Card>
    </>
  );
}

// ---------------------------------------------------------------------------
// §42 · Mensajes
// ---------------------------------------------------------------------------

function Mensajes({ toast }: { toast: any }) {
  const [conversaciones, setConversaciones] = useState<ConversationView[] | null>(null);
  const [abierta, setAbierta] = useState<string | null>(null);
  const [mensajes, setMensajes] = useState<MessageView[]>([]);
  const [texto, setTexto] = useState('');
  const [enviando, setEnviando] = useState(false);

  useEffect(() => {
    collaborationService
      .conversations()
      .then(setConversaciones)
      .catch((e) => { toast.error(apiError(e)); setConversaciones([]); });
    // eslint-disable-next-line
  }, []);

  const abrir = async (id: string) => {
    setAbierta(id);
    try {
      setMensajes(await collaborationService.messages(id));
    } catch (e) {
      toast.error(apiError(e));
    }
  };

  const enviar = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!abierta || !texto.trim()) return;
    setEnviando(true);
    try {
      await collaborationService.sendMessage(abierta, texto.trim());
      setTexto('');
      setMensajes(await collaborationService.messages(abierta));
    } catch (err) {
      toast.error(apiError(err));
    } finally {
      setEnviando(false);
    }
  };

  const actual = useMemo(
    () => (conversaciones ?? []).find((c) => c.id === abierta) ?? null,
    [conversaciones, abierta],
  );

  return (
    <Card title="Conversaciones">
      <p className="muted" style={{ marginTop: 0 }}>
        Solo con tus contactos y con los equipos a los que perteneces. Lo que escribas aquí no
        cuenta para tu afinidad ni sirve como prueba de lo que hiciste: eso vive en la bitácora de
        cada proyecto.
      </p>

      {!conversaciones && <Loading />}
      {conversaciones && conversaciones.length === 0 && (
        <EmptyState
          icon={<FiMessageSquare size={22} />}
          message="Todavía no tienes conversaciones. Acepta un contacto o súmate a un equipo."
        />
      )}

      <div className="mensajeria">
        <div className="mensajeria-lista">
          {(conversaciones ?? []).map((c) => (
            <button
              type="button"
              key={c.id}
              className={`conversacion ${abierta === c.id ? 'on' : ''}`}
              onClick={() => abrir(c.id)}
            >
              <strong>{c.title}</strong>
              <span className="muted">{c.kind === 'team' ? 'Equipo' : 'Directo'}</span>
            </button>
          ))}
        </div>

        {actual && (
          <div className="mensajeria-hilo">
            <h4 style={{ marginTop: 0 }}>{actual.title}</h4>
            <div className="mensajes">
              {mensajes.map((m) => (
                <div key={m.id} className={`mensaje ${m.mine ? 'mio' : ''}`}>
                  {!m.mine && <span className="muted">{m.sender.name}</span>}
                  <p>{m.body}</p>
                </div>
              ))}
              {mensajes.length === 0 && <p className="muted">Sin mensajes todavía.</p>}
            </div>
            <form onSubmit={enviar} className="flex" style={{ gap: '0.5rem' }}>
              <input
                value={texto}
                onChange={(e) => setTexto(e.target.value)}
                placeholder="Escribe un mensaje…"
                maxLength={2000}
              />
              <Button type="submit" loading={enviando} icon={<FiSend size={15} />}>
                Enviar
              </Button>
            </form>
          </div>
        )}
      </div>
    </Card>
  );
}
