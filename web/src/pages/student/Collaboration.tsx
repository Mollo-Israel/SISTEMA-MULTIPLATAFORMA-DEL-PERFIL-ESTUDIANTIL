import { validarFormulario } from '../../components/form';
import { useSearchParams } from 'react-router-dom';
import { useCachedState } from '../../hooks/viewCache';
import { Fragment, useEffect, useMemo, useState } from 'react';
import {
  FiAlertTriangle, FiCheck, FiCopy, FiEdit2, FiLink, FiRefreshCw, FiUserPlus, FiUsers, FiX,
} from 'react-icons/fi';
import { apiError } from '../../api/client';
import {
  collaborationService,
  type ContactChannelType,
  type ContactChannelView,
  type ContactView,
  type PublicLinkView,
  type TeamApplicationView,
  type TeamNeedView,
  type TeamSuggestionsView,
  type TeamView,
} from '../../services';
import { catalogService } from '../../services';
import type { AcademicArea, Skill } from '../../services/types';
import AreaSkillPicker from '../../components/AreaSkillPicker';
import { useConfirm, useToast } from '../../components/feedback';
import {
  Badge, Button, Card, Diferido, EmptyState, Loading, PageHeader, Tabs,
} from '../../components/ui';

/** V3 §55: los mismos motivos predefinidos que valida la API. */
const MOTIVOS_RECHAZO = [
  { code: 'skills_not_matching', label: 'Buscamos otras habilidades' },
  { code: 'team_full', label: 'El equipo ya está completo' },
  { code: 'schedule', label: 'La disponibilidad no coincide' },
  { code: 'chose_other_profile', label: 'Elegimos otro perfil para este cupo' },
  { code: 'other', label: 'Otro motivo' },
];
const SEMESTRES = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10];
const REQUISITO: Record<string, string> = {
  any: 'Cualquier disponibilidad',
  open_or_looking: 'Que escuche propuestas o busque equipo',
  looking: 'Solo quien busca equipo',
};
const ESTADO_POSTULACION: Record<string, { label: string; tone: string }> = {
  pending: { label: 'Pendiente', tone: 'amber' },
  accepted: { label: 'Aceptada', tone: 'green' },
  rejected: { label: 'No aceptada', tone: 'gray' },
  withdrawn: { label: 'Retirada', tone: 'gray' },
};
const semestresTexto = (s: number[]) =>
  s.length === 0 ? 'Cualquier semestre' : `Semestre${s.length > 1 ? 's' : ''} ${s.join(', ')}`;

const DISPONIBILIDAD: Record<string, string> = {
  looking: 'Busca equipo',
  open: 'Escucha propuestas',
  busy: 'Sin margen',
  unspecified: 'Sin declarar',
};

/**
 * Colaboración del estudiante (§43 a §47).
 *
 * Una sola pantalla con tres pestañas porque las tres cosas son la misma
 * historia contada en orden: comparto mi perfil y cómo contactarme, alguien me
 * contacta, formamos un equipo. Separarlas en tres entradas de menú obligaría
 * a recorrerlas para entender de qué va.
 *
 * V2 §57 retiró el chat: la pestaña de mensajes ya no existe y cada contacto
 * muestra los canales externos que la otra persona eligió compartir (§59).
 */
export default function StudentCollaborationPage() {
  // La pestaña viaja en la URL (?tab=): el menú lleva directo a «Equipos» o
  // a «CV / Exportar» (V2 §77), y volver atrás deja donde estaba.
  const [params, setParams] = useSearchParams();
  const pedida = params.get('tab');
  const tab: 'enlace' | 'contactos' | 'equipos' = (['enlace', 'contactos', 'equipos'] as string[]).includes(pedida ?? '') ? (pedida as 'enlace' | 'contactos' | 'equipos') : 'enlace';
  const setTab = (k: 'enlace' | 'contactos' | 'equipos') => setParams(k === 'enlace' ? {} : { tab: k }, { replace: true });
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
        ]}
      />

      {tab === 'enlace' && (
        <>
          <MiEnlace toast={toast} confirm={confirm} />
          <MisCanales toast={toast} />
        </>
      )}
      {tab === 'contactos' && <Contactos toast={toast} confirm={confirm} />}
      {tab === 'equipos' && <Equipos toast={toast} />}
    </div>
  );
}

// ---------------------------------------------------------------------------
// §43 · Mi enlace y mi QR
// ---------------------------------------------------------------------------

function MiEnlace({ toast, confirm }: { toast: any; confirm: any }) {
  const [enlace, setEnlace] = useCachedState<PublicLinkView | null>('enlace', null);
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

  if (!enlace) return <Diferido><Card><Loading /></Card></Diferido>;

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
// V2 §59 · Canales de contacto
// ---------------------------------------------------------------------------

const CANALES: { channel: ContactChannelType; label: string; placeholder: string; help: string }[] = [
  { channel: 'teams', label: 'Microsoft Teams', placeholder: 'tu.cuenta@est.univalle.edu', help: 'Tu cuenta de Teams (correo) o un enlace de teams.microsoft.com.' },
  { channel: 'whatsapp', label: 'WhatsApp', placeholder: '+591 71234567', help: 'Con código de país.' },
  { channel: 'linkedin', label: 'LinkedIn', placeholder: 'linkedin.com/in/tu-nombre', help: 'El enlace de tu perfil.' },
  { channel: 'email', label: 'Correo de contacto', placeholder: 'nombre@correo.com', help: 'El que quieras compartir; el institucional no se muestra si no lo escribes aquí.' },
  { channel: 'link', label: 'Otro enlace', placeholder: 'https://tu-portafolio.dev', help: 'Solo enlaces https.' },
];

function MisCanales({ toast }: { toast: any }) {
  const [valores, setValores] = useCachedState<Record<string, { value: string; isPublic: boolean }>>('canales', {});
  const [errores, setErrores] = useState<Record<string, string>>({});
  const [guardando, setGuardando] = useState(false);

  const aplicar = (lista: ContactChannelView[]) =>
    setValores(Object.fromEntries(lista.map((c) => [c.channel, { value: c.value, isPublic: c.isPublic }])));

  useEffect(() => {
    collaborationService.myChannels().then(aplicar).catch((e) => toast.error(apiError(e)));
    // eslint-disable-next-line
  }, []);

  const guardar = async (e: React.FormEvent) => {
    e.preventDefault();
    // V3 §67: error debajo de cada campo, no el globo del navegador.
    if (!validarFormulario(e.currentTarget as HTMLFormElement)) return;
    const lista = CANALES
      .filter((c) => (valores[c.channel]?.value ?? '').trim())
      .map((c) => ({ channel: c.channel, value: valores[c.channel].value.trim(), isPublic: !!valores[c.channel].isPublic }));
    setGuardando(true);
    setErrores({});
    try {
      aplicar(await collaborationService.saveChannels(lista));
      toast.success('Canales guardados.', 'Tus contactos ya los ven.');
    } catch (err: any) {
      // El servidor indica el canal con problema: channels.<i>.value.
      const fields: Record<string, string[]> = err?.response?.data?.fields ?? {};
      const porCanal: Record<string, string> = {};
      Object.entries(fields).forEach(([k, v]) => {
        const idx = Number(k.split('.')[1]);
        if (lista[idx]) porCanal[lista[idx].channel] = v[0];
      });
      setErrores(porCanal);
      toast.error(apiError(err));
    } finally {
      setGuardando(false);
    }
  };

  return (
    <Card title="Cómo contactarte">
      <p className="muted" style={{ marginTop: 0 }}>
        Afinia no tiene chat: tus contactos te escriben por el canal que elijas. Todos son opcionales.
        Lo que marques como público aparece también en tu perfil compartible.
      </p>
      <form noValidate onSubmit={guardar}>
        {CANALES.map((c) => (
          <div key={c.channel} className="field">
            <label htmlFor={`canal-${c.channel}`}>{c.label}</label>
            <div className="flex" style={{ gap: '0.6rem', flexWrap: 'wrap', alignItems: 'center' }}>
              <input
                id={`canal-${c.channel}`}
                style={{ flex: '1 1 240px' }}
                value={valores[c.channel]?.value ?? ''}
                placeholder={c.placeholder}
                maxLength={300}
                aria-invalid={!!errores[c.channel]}
                onChange={(e) => setValores({ ...valores, [c.channel]: { value: e.target.value, isPublic: valores[c.channel]?.isPublic ?? false } })}
              />
              <label className="check-field" style={{ fontSize: '0.82rem' }}>
                <input
                  type="checkbox"
                  checked={!!valores[c.channel]?.isPublic}
                  disabled={!(valores[c.channel]?.value ?? '').trim()}
                  onChange={(e) => setValores({ ...valores, [c.channel]: { value: valores[c.channel]?.value ?? '', isPublic: e.target.checked } })}
                />
                <span>Mostrar en mi perfil público</span>
              </label>
            </div>
            {errores[c.channel]
              ? <small className="field-error">{errores[c.channel]}</small>
              : <small className="muted">{c.help}</small>}
          </div>
        ))}
        <Button type="submit" loading={guardando}>Guardar canales</Button>
      </form>
    </Card>
  );
}

function CanalesDe({ canales, preferido }: { canales: ContactChannelView[]; preferido: ContactChannelType | null }) {
  if (canales.length === 0) return <span className="muted">No compartió canales</span>;
  const orden = [...canales].sort((a, b) => Number(b.channel === preferido) - Number(a.channel === preferido));
  return (
    <div className="chip-row">
      {orden.map((c) => (c.href ? (
        <a key={c.channel} className={`chip ${c.channel === preferido ? 'on' : ''}`} href={c.href} target="_blank" rel="noopener noreferrer">
          {c.label}
        </a>
      ) : (
        <span key={c.channel} className="chip">{c.label}</span>
      )))}
    </div>
  );
}

// ---------------------------------------------------------------------------
// §45 · Contactos
// ---------------------------------------------------------------------------

function Contactos({ toast, confirm }: { toast: any; confirm: any }) {
  const [contactos, setContactos] = useCachedState<ContactView[] | null>('contactos', null);
  const [recibidas, setRecibidas] = useCachedState<any[]>('recibidas', []);
  const [enviadas, setEnviadas] = useCachedState<any[]>('enviadas', []);
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
    // V3 §67: error debajo de cada campo, no el globo del navegador.
    if (!validarFormulario(e.currentTarget as HTMLFormElement)) return;
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

  const [editando, setEditando] = useState<string | null>(null);
  const [nota, setNota] = useState<{ alias: string; context: string; preferredChannel: string }>({ alias: '', context: '', preferredChannel: '' });

  const abrirNota = (c: ContactView) => {
    setEditando(c.profileId);
    setNota({ alias: c.note.alias ?? '', context: c.note.context ?? '', preferredChannel: c.note.preferredChannel ?? '' });
  };

  const guardarNota = async (c: ContactView) => {
    try {
      await collaborationService.saveContactNote(c.profileId, {
        alias: nota.alias.trim() || null,
        context: nota.context.trim() || null,
        preferredChannel: (nota.preferredChannel || null) as ContactChannelType | null,
      });
      toast.success('Nota guardada.', 'Solo tú la ves.');
      setEditando(null);
      await cargar();
    } catch (err) {
      toast.error(apiError(err));
    }
  };

  const eliminar = async (c: ContactView) => {
    const ok = await confirm({
      title: `Deshacer el contacto con ${c.name}`,
      message: 'Dejarán de ver sus canales de contacto. Cualquiera de los dos puede volver a solicitarlo.',
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
        <form noValidate onSubmit={solicitar}>
          <div className="grid-2">
            <div className="field">
              <label htmlFor="collaboration-identificador-del-perfil">Identificador del perfil</label>
              <input id="collaboration-identificador-del-perfil"
                value={slug}
                onChange={(e) => setSlug(e.target.value)}
                placeholder="cdwxx59caf76"
                required
              />
            </div>
            <div className="field">
              <label htmlFor="collaboration-presentacion-opcional">Presentación (opcional)</label>
              <input id="collaboration-presentacion-opcional"
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
        {!contactos && <Diferido><Loading /></Diferido>}
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
                <tr><th>Estudiante</th><th>Semestre</th><th>Disponibilidad</th><th>Contactar</th><th /></tr>
              </thead>
              <tbody>
                {contactos.map((c) => (
                  <Fragment key={c.contactId}>
                    <tr>
                      <td>
                        {c.note.alias ? <><strong>{c.note.alias}</strong><div className="muted small">{c.name}</div></> : c.name}
                        {c.note.context && <div className="muted small">{c.note.context}</div>}
                      </td>
                      <td className="muted">{c.semester ?? '—'}</td>
                      <td className="muted">
                        {DISPONIBILIDAD[c.availability ?? 'unspecified']}
                      </td>
                      <td><CanalesDe canales={c.channels} preferido={c.note.preferredChannel} /></td>
                      <td>
                        <div className="flex" style={{ gap: '0.3rem' }}>
                          <Button size="sm" variant="ghost" icon={<FiEdit2 size={13} />} onClick={() => abrirNota(c)}>
                            Nota
                          </Button>
                          <Button size="sm" variant="danger" onClick={() => eliminar(c)}>
                            Deshacer
                          </Button>
                        </div>
                      </td>
                    </tr>
                    {editando === c.profileId && (
                      <tr>
                        <td colSpan={5}>
                          <div className="grid-2">
                            <div className="field">
                              <label htmlFor="collaboration-alias">Alias</label>
                              <input id="collaboration-alias" value={nota.alias} maxLength={60} onChange={(e) => setNota({ ...nota, alias: e.target.value })} placeholder="Ana del lab de redes" />
                            </div>
                            <div className="field">
                              <label htmlFor="collaboration-canal-preferido">Canal preferido</label>
                              <select id="collaboration-canal-preferido" value={nota.preferredChannel} onChange={(e) => setNota({ ...nota, preferredChannel: e.target.value })}>
                                <option value="">Sin preferencia</option>
                                {c.channels.map((k) => <option key={k.channel} value={k.channel}>{k.label}</option>)}
                              </select>
                            </div>
                          </div>
                          <div className="field">
                            <label htmlFor="collaboration-contexto">Contexto</label>
                            <input id="collaboration-contexto" value={nota.context} maxLength={300} onChange={(e) => setNota({ ...nota, context: e.target.value })} placeholder="Nos conocimos en el hackatón 2026." />
                          </div>
                          <div className="flex" style={{ gap: '0.4rem' }}>
                            <Button size="sm" onClick={() => guardarNota(c)}>Guardar nota</Button>
                            <Button size="sm" variant="ghost" onClick={() => setEditando(null)}>Cancelar</Button>
                          </div>
                        </td>
                      </tr>
                    )}
                  </Fragment>
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
  const [necesidades, setNecesidades] = useCachedState<TeamNeedView[] | null>('necesidades', null);
  const [equipos, setEquipos] = useCachedState<TeamView[]>('equipos', []);
  const [invitaciones, setInvitaciones] = useCachedState<any[]>('invitaciones-equipo', []);
  const [skills, setSkills] = useCachedState<Skill[]>('skills', []);
  const [areas, setAreas] = useCachedState<AcademicArea[]>('areas', []);
  const [sugerencias, setSugerencias] = useState<TeamSuggestionsView | null>(null);
  const [abierta, setAbierta] = useState<string | null>(null);
  const [form, setForm] = useState({
    purpose: '', maxMembers: 4, skillIds: [] as string[], areaIds: [] as string[],
    targetSemesters: [] as number[], availabilityRequirement: 'open_or_looking',
  });
  const [abiertas, setAbiertas] = useCachedState<TeamNeedView[] | null>('necesidades-abiertas', null);
  const [misPostulaciones, setMisPostulaciones] = useCachedState<TeamApplicationView[]>('mis-postulaciones', []);
  /** Necesidad ajena a la que se está postulando y su presentación. */
  const [postulando, setPostulando] = useState<{ needId: string; message: string } | null>(null);
  /** Postulaciones recibidas de la necesidad abierta en pantalla. */
  const [recibidas, setRecibidas] = useState<{ needId: string; items: TeamApplicationView[] } | null>(null);
  const [rechazo, setRechazo] = useState<{ id: string; reason: string; comment: string } | null>(null);
  const [creando, setCreando] = useState(false);
  /** Nombre en edición: del equipo nuevo (clave = necesidad) o de uno existente. */
  const [nombres, setNombres] = useState<Record<string, string>>({});
  const [renombrando, setRenombrando] = useState<string | null>(null);
  const [ocupado, setOcupado] = useState<string | null>(null);
  const equipoDe = (needId: string) => equipos.find((t) => t.needId === needId) ?? null;

  const cargar = async () => {
    try {
      const [n, t, i, a, p] = await Promise.all([
        collaborationService.myNeeds(),
        collaborationService.myTeams(),
        collaborationService.myTeamInvitations(),
        collaborationService.openNeeds(),
        collaborationService.myApplications(),
      ]);
      setNecesidades(n);
      setEquipos(t);
      setInvitaciones(i);
      setAbiertas(a.filter((x) => !x.isOwner));
      setMisPostulaciones(p);
    } catch (e) {
      toast.error(apiError(e));
      setNecesidades([]);
    }
  };

  useEffect(() => {
    void cargar();
    catalogService.skills().then(setSkills).catch(() => {});
    catalogService.areas().then(setAreas).catch(() => {});
    // eslint-disable-next-line
  }, []);

  const crear = async (e: React.FormEvent) => {
    e.preventDefault();
    // V3 §67: error debajo de cada campo, no el globo del navegador.
    if (!validarFormulario(e.currentTarget as HTMLFormElement)) return;
    setCreando(true);
    try {
      await collaborationService.createTeamNeed({
        purpose: form.purpose,
        maxMembers: form.maxMembers,
        requiredSkillIds: form.skillIds,
        preferredAreaIds: form.areaIds,
        targetSemesters: form.targetSemesters,
        availabilityRequirement: form.availabilityRequirement,
      });
      toast.success('Necesidad publicada.', 'Los estudiantes de los semestres elegidos ya pueden postular.');
      setForm({ purpose: '', maxMembers: 4, skillIds: [], areaIds: [], targetSemesters: [], availabilityRequirement: 'open_or_looking' });
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

  /** §46: el equipo nace de una necesidad propia; §44: su nombre se modera. */
  const formarEquipo = async (needId: string) => {
    setOcupado(needId);
    try {
      const t = await collaborationService.createTeam(needId, (nombres[needId] ?? '').trim());
      if (t.nameStatus === 'flagged') {
        toast.error('El equipo se creó, pero su nombre quedó marcado.', 'Corrígelo para poder invitar.');
      } else {
        toast.success('Equipo creado.', 'Ahora puedes invitar a quien complemente.');
      }
      await cargar();
    } catch (e) {
      toast.error(apiError(e));
    } finally {
      setOcupado(null);
    }
  };

  const renombrar = async (t: TeamView) => {
    setOcupado(t.id);
    try {
      const r = await collaborationService.renameTeam(t.id, (nombres[t.id] ?? '').trim());
      if (r.nameStatus === 'flagged') toast.error('El nombre nuevo también quedó marcado.', r.nameFlagReason ?? undefined);
      else toast.success('Nombre actualizado.');
      setRenombrando(null);
      await cargar();
    } catch (e) {
      toast.error(apiError(e));
    } finally {
      setOcupado(null);
    }
  };

  /** §47: invitar lo decide una persona, candidato por candidato. */
  const invitar = async (teamId: string, profileId: string) => {
    setOcupado(profileId);
    try {
      await collaborationService.inviteToTeam(teamId, profileId);
      toast.success('Invitación enviada.');
    } catch (e) {
      toast.error(apiError(e));
    } finally {
      setOcupado(null);
    }
  };

  const postular = async () => {
    if (!postulando) return;
    setOcupado(postulando.needId);
    try {
      await collaborationService.applyToNeed(postulando.needId, postulando.message.trim());
      toast.success('Postulación enviada.', 'El responsable la verá en su lista y te avisaremos de su respuesta.');
      setPostulando(null);
      await cargar();
    } catch (e) {
      toast.error(apiError(e));
    } finally {
      setOcupado(null);
    }
  };

  const retirar = async (id: string) => {
    setOcupado(id);
    try {
      await collaborationService.withdrawApplication(id);
      toast.success('Postulación retirada.');
      await cargar();
    } catch (e) {
      toast.error(apiError(e));
    } finally {
      setOcupado(null);
    }
  };

  const verPostulaciones = async (needId: string) => {
    if (recibidas?.needId === needId) { setRecibidas(null); return; }
    try {
      setRecibidas({ needId, items: await collaborationService.applicationsForNeed(needId) });
    } catch (e) {
      toast.error(apiError(e));
    }
  };

  const decidirPostulacion = async (needId: string, id: string, body: { decision: 'accept' | 'reject'; reason?: string; comment?: string }) => {
    setOcupado(id);
    try {
      const r = await collaborationService.decideApplication(id, body);
      if (body.decision === 'accept') {
        toast.success('Postulación aceptada.', r?.needClosed ? 'Se llenaron los cupos: la necesidad se cerró.' : 'Ya forma parte del equipo.');
      } else {
        toast.success('Respuesta enviada.', 'Recibirá el motivo que elegiste.');
      }
      setRechazo(null);
      setRecibidas({ needId, items: await collaborationService.applicationsForNeed(needId) });
      await cargar();
    } catch (e) {
      toast.error(apiError(e));
    } finally {
      setOcupado(null);
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

      <Card title="Necesidades abiertas para ti">
        <p className="muted" style={{ marginTop: 0 }}>
          Equipos que buscan integrantes de tu semestre. Postula a los que te interesen; el responsable
          decide y te avisamos.
        </p>
        {!abiertas && <Diferido><Loading /></Diferido>}
        {abiertas && abiertas.length === 0 && (
          <EmptyState message="Por ahora no hay necesidades abiertas para tu semestre." />
        )}
        {(abiertas ?? []).map((n) => {
          const mia = n.myApplication;
          return (
            <div key={n.id} className="necesidad">
              <div className="flex between" style={{ gap: '0.5rem', flexWrap: 'wrap' }}>
                <strong>{n.purpose}</strong>
                <span className="flex" style={{ gap: '0.35rem' }}>
                  {mia && <Badge tone={ESTADO_POSTULACION[mia.status]?.tone}>{ESTADO_POSTULACION[mia.status]?.label}</Badge>}
                  <Badge tone={(n.openings ?? 0) > 0 ? 'green' : 'gray'}>
                    {(n.openings ?? 0) > 0 ? `${n.openings} cupo(s)` : 'Sin cupos'}
                  </Badge>
                </span>
              </div>
              <span className="muted">
                {n.owner.name} · {semestresTexto(n.targetSemesters ?? [])} · {REQUISITO[n.availabilityRequirement] ?? ''}
              </span>
              {n.description && <p style={{ margin: 0 }}>{n.description}</p>}
              <div className="chip-row">
                {n.preferredAreas.map((a) => <span key={a.academicAreaId} className="chip on">{a.name}</span>)}
                {n.requiredSkills.map((s) => <span key={s.skillId} className="chip">{s.name}</span>)}
              </div>
              {n.isMember ? (
                <span className="muted">Ya formas parte de este equipo.</span>
              ) : mia?.status === 'pending' ? (
                <div>
                  <Button size="sm" variant="secondary" loading={ocupado === mia.id} onClick={() => retirar(mia.id)}>
                    Retirar postulación
                  </Button>
                </div>
              ) : mia?.status === 'rejected' || mia?.status === 'accepted' ? null : postulando?.needId === n.id ? (
                <div className="field" style={{ marginBottom: 0 }}>
                  <label htmlFor={`postular-${n.id}`}>Preséntate en una o dos líneas (opcional)</label>
                  <textarea
                    id={`postular-${n.id}`}
                    rows={2}
                    maxLength={300}
                    value={postulando.message}
                    onChange={(e) => setPostulando({ needId: n.id, message: e.target.value })}
                    placeholder="Qué puedes aportar y tu disponibilidad."
                  />
                  <div className="flex mt" style={{ gap: '0.4rem' }}>
                    <Button size="sm" loading={ocupado === n.id} onClick={postular}>Enviar postulación</Button>
                    <Button size="sm" variant="ghost" onClick={() => setPostulando(null)}>Cancelar</Button>
                  </div>
                </div>
              ) : (
                <div>
                  <Button
                    size="sm"
                    icon={<FiUserPlus size={13} />}
                    disabled={(n.openings ?? 0) === 0}
                    onClick={() => setPostulando({ needId: n.id, message: '' })}
                  >
                    Postular
                  </Button>
                </div>
              )}
            </div>
          );
        })}
      </Card>

      {misPostulaciones.length > 0 && (
        <Card title="Mis postulaciones">
          {misPostulaciones.map((p) => (
            <div key={p.id} className="flex between solicitud-fila">
              <div>
                <strong>{p.need?.purpose}</strong>
                {p.need?.owner && <span className="muted"> · {p.need.owner}</span>}
                {p.status === 'rejected' && (
                  <p className="muted" style={{ margin: 0 }}>
                    {p.rejectionReasonLabel}{p.rejectionComment ? `: ${p.rejectionComment}` : ''}
                  </p>
                )}
              </div>
              <Badge tone={ESTADO_POSTULACION[p.status]?.tone}>{ESTADO_POSTULACION[p.status]?.label}</Badge>
            </div>
          ))}
        </Card>
      )}

      <Card title="¿Qué le falta a tu equipo?">
        <p className="muted" style={{ marginTop: 0 }}>
          Declara lo que <strong>falta</strong>, no lo que ya tienes: el sistema busca quien
          complemente, no quien repita.
        </p>
        <form noValidate onSubmit={crear}>
          <div className="field">
            <label htmlFor="necesidad-proposito">Para qué buscas gente</label>
            <input
              id="necesidad-proposito"
              value={form.purpose}
              onChange={(e) => setForm({ ...form, purpose: e.target.value })}
              placeholder="Armar el panel de control del laboratorio"
              maxLength={300}
              required
            />
          </div>
          <AreaSkillPicker
            areas={areas}
            skills={skills}
            value={{ areaIds: form.areaIds, skillIds: form.skillIds }}
            onChange={(v) => setForm({ ...form, areaIds: v.areaIds, skillIds: v.skillIds })}
            areaLabel="Áreas del trabajo"
            skillLabel="Habilidades que faltan"
          />
          <fieldset className="field">
            <legend>Semestres que pueden postular</legend>
            <div className="chip-row">
              {SEMESTRES.map((s) => {
                const on = form.targetSemesters.includes(s);
                return (
                  <button
                    key={s}
                    type="button"
                    className={`chip ${on ? 'on' : ''}`}
                    aria-pressed={on}
                    onClick={() => setForm({
                      ...form,
                      targetSemesters: on ? form.targetSemesters.filter((x) => x !== s) : [...form.targetSemesters, s].sort((a, b) => a - b),
                    })}
                  >
                    {s}.º
                  </button>
                );
              })}
            </div>
            <small className="muted">Sin marcar ninguno, la ve cualquier semestre.</small>
          </fieldset>
          <div className="grid-2">
            <div className="field">
              <label htmlFor="necesidad-cupos">Integrantes en total (contigo)</label>
              <input
                id="necesidad-cupos"
                type="number"
                min={2}
                max={20}
                value={form.maxMembers}
                onChange={(e) => setForm({ ...form, maxMembers: Number(e.target.value) || 2 })}
              />
            </div>
            <div className="field">
              <label htmlFor="necesidad-disponibilidad">Disponibilidad que pides</label>
              <select
                id="necesidad-disponibilidad"
                value={form.availabilityRequirement}
                onChange={(e) => setForm({ ...form, availabilityRequirement: e.target.value })}
              >
                {Object.entries(REQUISITO).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
              </select>
            </div>
          </div>
          <Button type="submit" loading={creando} icon={<FiUsers size={15} />}>
            Publicar necesidad
          </Button>
        </form>
      </Card>

      <Card title="Mis necesidades">
        {!necesidades && <Diferido><Loading /></Diferido>}
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
            <span className="muted">{semestresTexto(n.targetSemesters ?? [])} · hasta {n.maxMembers} integrantes</span>
            <div className="chip-row">
              {n.requiredSkills.map((s) => (
                <span key={s.skillId} className="chip">{s.name}</span>
              ))}
            </div>
            <div>
              <Button size="sm" variant="secondary" onClick={() => verPostulaciones(n.id)}>
                {recibidas?.needId === n.id ? 'Ocultar postulaciones' : 'Ver postulaciones'}
              </Button>
            </div>
            {recibidas?.needId === n.id && (
              <div>
                {recibidas.items.length === 0 && <EmptyState message="Todavía nadie postuló." />}
                {recibidas.items.map((p) => (
                  <div key={p.id} className="candidato">
                    <div className="flex between" style={{ gap: '0.5rem', flexWrap: 'wrap' }}>
                      <div>
                        <strong>{p.applicant?.name}</strong>
                        {p.applicant?.semester && <span className="muted"> · {p.applicant.semester}.º semestre</span>}
                        {p.applicant?.availability && (
                          <span className="muted"> · {DISPONIBILIDAD[p.applicant.availability] ?? p.applicant.availability}</span>
                        )}
                      </div>
                      <Badge tone={ESTADO_POSTULACION[p.status]?.tone}>{ESTADO_POSTULACION[p.status]?.label}</Badge>
                    </div>
                    {p.message && <p className="muted" style={{ margin: '0.3rem 0' }}>«{p.message}»</p>}
                    <div className="chip-row">
                      {(p.coversSkills ?? []).map((s) => <span key={s.skillId} className="chip on">{s.name}</span>)}
                      {(p.coversSkills ?? []).length === 0 && (
                        <span className="muted">No tiene respaldada ninguna de las habilidades que faltan.</span>
                      )}
                    </div>
                    {p.status === 'rejected' && (
                      <p className="muted" style={{ margin: 0 }}>{p.rejectionReasonLabel}{p.rejectionComment ? `: ${p.rejectionComment}` : ''}</p>
                    )}
                    {p.status === 'pending' && (rechazo?.id === p.id ? (
                      <div className="mt">
                        <div className="field">
                          <label htmlFor={`motivo-${p.id}`}>Motivo</label>
                          <select
                            id={`motivo-${p.id}`}
                            value={rechazo.reason}
                            onChange={(e) => setRechazo({ ...rechazo, reason: e.target.value })}
                          >
                            <option value="">Elige un motivo…</option>
                            {MOTIVOS_RECHAZO.map((m) => <option key={m.code} value={m.code}>{m.label}</option>)}
                          </select>
                        </div>
                        <div className="field">
                          <label htmlFor={`comentario-${p.id}`}>
                            Comentario {rechazo.reason === 'other' ? '(obligatorio)' : '(opcional)'}
                          </label>
                          <input
                            id={`comentario-${p.id}`}
                            maxLength={200}
                            value={rechazo.comment}
                            onChange={(e) => setRechazo({ ...rechazo, comment: e.target.value })}
                          />
                        </div>
                        <div className="flex" style={{ gap: '0.4rem' }}>
                          <Button
                            size="sm"
                            loading={ocupado === p.id}
                            disabled={!rechazo.reason || (rechazo.reason === 'other' && !rechazo.comment.trim())}
                            onClick={() => decidirPostulacion(n.id, p.id, {
                              decision: 'reject', reason: rechazo.reason, comment: rechazo.comment.trim() || undefined,
                            })}
                          >
                            Enviar respuesta
                          </Button>
                          <Button size="sm" variant="ghost" onClick={() => setRechazo(null)}>Cancelar</Button>
                        </div>
                      </div>
                    ) : (
                      <div className="flex mt" style={{ gap: '0.4rem' }}>
                        <Button
                          size="sm"
                          icon={<FiCheck size={13} />}
                          loading={ocupado === p.id}
                          onClick={() => decidirPostulacion(n.id, p.id, { decision: 'accept' })}
                        >
                          Aceptar
                        </Button>
                        <Button size="sm" variant="secondary" icon={<FiX size={13} />} onClick={() => setRechazo({ id: p.id, reason: '', comment: '' })}>
                          No aceptar
                        </Button>
                      </div>
                    ))}
                  </div>
                ))}
              </div>
            )}
            {!equipoDe(n.id) && (
              <div className="flex mt" style={{ gap: '0.4rem', flexWrap: 'wrap' }}>
                <input
                  aria-label="Nombre del equipo"
                  placeholder="Nombre del equipo"
                  maxLength={60}
                  value={nombres[n.id] ?? ''}
                  onChange={(e) => setNombres({ ...nombres, [n.id]: e.target.value })}
                  style={{ maxWidth: 280 }}
                />
                <Button
                  size="sm"
                  icon={<FiUsers size={13} />}
                  loading={ocupado === n.id}
                  disabled={(nombres[n.id] ?? '').trim().length < 3}
                  onClick={() => formarEquipo(n.id)}
                >
                  Formar equipo
                </Button>
              </div>
            )}
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
                      <div className="flex" style={{ gap: '0.4rem' }}>
                        <Badge tone="bordo">{Math.round(c.score)}/100</Badge>
                        {equipoDe(n.id) && equipoDe(n.id)!.nameStatus === 'ok' && (
                          <Button
                            size="sm"
                            variant="secondary"
                            icon={<FiUserPlus size={13} />}
                            loading={ocupado === c.profileId}
                            onClick={() => invitar(equipoDe(n.id)!.id, c.profileId)}
                          >
                            Invitar
                          </Button>
                        )}
                      </div>
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
            {t.nameStatus === 'flagged' && (
              <p className="notice-error" role="alert">
                <FiAlertTriangle size={13} /> El nombre quedó marcado para revisión y no se muestra a otras
                personas hasta corregirlo.{t.nameFlagReason ? ` ${t.nameFlagReason}` : ''}
              </p>
            )}
            {t.isOwner && (renombrando === t.id ? (
              <div className="flex mt" style={{ gap: '0.4rem', flexWrap: 'wrap' }}>
                <input
                  aria-label="Nuevo nombre del equipo"
                  maxLength={60}
                  value={nombres[t.id] ?? t.name}
                  onChange={(e) => setNombres({ ...nombres, [t.id]: e.target.value })}
                  style={{ maxWidth: 280 }}
                />
                <Button size="sm" loading={ocupado === t.id} onClick={() => renombrar(t)}>Guardar</Button>
                <Button size="sm" variant="ghost" onClick={() => setRenombrando(null)}>Cancelar</Button>
              </div>
            ) : (
              <Button size="sm" variant="ghost" icon={<FiEdit2 size={13} />} onClick={() => setRenombrando(t.id)}>
                {t.nameStatus === 'flagged' ? 'Corregir nombre' : 'Cambiar nombre'}
              </Button>
            ))}
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
