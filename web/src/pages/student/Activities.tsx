import { useCallback, useEffect, useState } from 'react';
import {
  FiAlertCircle,
  FiCalendar,
  FiCheckCircle,
  FiExternalLink,
  FiBookmark,
  FiMapPin,
  FiSearch,
  FiTag,
  FiUserMinus, FiUserPlus,
  FiUsers,
} from 'react-icons/fi';
import { apiError } from '../../api/client';
import { activityService } from '../../services';
import { useSearchParams } from 'react-router-dom';
import ParaTi from '../../components/ParaTi';
import { ActivityCard, ActivityDetail } from '../../components/ActivityCard';
import type { Activity } from '../../services/types';
import { useAsync } from '../../hooks/useAsync';
import {
  Badge,
  Button,
  Card,
  EmptyState,
  PageHeader,
  ResultCount,
  SearchInput,
  SkeletonCards,
  Diferido,
  Stagger,
  Tabs,
} from '../../components/ui';
import { useConfirm, useToast } from '../../components/feedback';
import { ACTIVITY_STATUS_LABEL, ACTIVITY_TYPE_LABEL, REGISTRATION_STATUS_LABEL, lbl } from '../../constants';

const formatDate = (value: string | null) =>
  value
    ? new Date(value).toLocaleDateString('es-BO', { day: 'numeric', month: 'long', year: 'numeric' })
    : null;

/** V3.2 §36: ya empezó, cerró o terminó: no se ofrece inscribirse. */
const yaPaso = (a: Activity) =>
  a.status === 'closed' || a.status === 'finished' || (!!a.eventDate && new Date(a.eventDate).getTime() < Date.now());

export default function StudentActivitiesPage() {
  const [query, setQuery] = useState('');
  /** Lo que se busca en el servidor: espera a que se deje de escribir. */
  const [buscado, setBuscado] = useState('');
  // V5-02: filtrar por quien responde por la actividad.
  const [responsable, setResponsable] = useState<{ id: string; name: string } | null>(null);
  const [buscarResp, setBuscarResp] = useState('');
  const [candidatos, setCandidatos] = useState<{ id: string; name: string }[]>([]);
  useEffect(() => {
    const t = buscarResp.trim();
    if (!t) { setCandidatos([]); return; }
    const id = window.setTimeout(() => {
      activityService.responsibles(t).then(setCandidatos).catch(() => setCandidatos([]));
    }, 250);
    return () => window.clearTimeout(id);
  }, [buscarResp]);
  // V4.1 A41-012 (§4.1): dos ejes (origen × carácter) en tres pestañas amigables.
  const [type, setType] = useState<'todas' | 'academica' | 'extracurricular' | 'externas'>('todas');
  const [busy, setBusy] = useState<string | null>(null);
  const toast = useToast();
  const confirm = useConfirm();
  /** V3.2 §37: el detalle completo, aparte de la tarjeta. */
  const [detalle, setDetalle] = useState<Activity | null>(null);

  // V6 §9.1: [Para ti] [Todas] [Inscritas] [Guardadas] [Historial]. «Interesadas»
  // se retiró; un marcador antiguo lleva a «Todas».
  const [params, setParams] = useSearchParams();
  const pedidaTab = params.get('tab') ?? 'para-ti';
  const tab = pedidaTab === 'interesadas' ? 'todas' : pedidaTab;
  // V5 BATCH 14: llegar desde la fuente de una afinidad abre esa actividad.
  const actividadPedida = params.get('actividad');
  useEffect(() => {
    if (actividadPedida) activityService.get(actividadPedida).then(setDetalle).catch(() => {});
  }, [actividadPedida]);
  const cambiarTab = (k: string) => setParams(k === 'para-ti' ? {} : { tab: k }, { replace: true });
  // Sus inscripciones: dan el historial y los contadores de las pestañas.
  const historial = useAsync(() => activityService.myRegistrations(), []);
  const regs = historial.data ?? [];

  /*
   * V3 B23: el listado llega por páginas, con lo más próximo primero. Antes
   * se descargaban todas las actividades de la carrera en cada visita y se
   * filtraban aquí; con miles de filas, eso eran megas por pantalla.
   */
  const PASO = 24;
  const lista = tab === 'todas' || tab === 'guardadas' || tab === 'inscritas';
  const mine = tab === 'inscritas' ? 'enrolled' as const : undefined;
  const favorites = tab === 'guardadas' ? 'true' as const : undefined;
  const [items, setItems] = useState<Activity[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [cargado, setCargado] = useState(false);
  const pedir = useCallback(async (offset: number) => {
    setLoading(true);
    try {
      const r = await activityService.page({
        limit: PASO, offset, q: buscado.trim() || undefined, mine, favorites, responsibleId: responsable?.id,
        ...(type === 'externas' ? { originType: 'external' as const }
          : type === 'todas' ? {} : { type, originType: 'internal' as const }),
      });
      setItems((prev) => (offset === 0 ? r.items : [...prev, ...r.items]));
      setTotal(r.total);
      setError(null);
    } catch (e) {
      setError(apiError(e));
    } finally {
      setLoading(false);
      setCargado(true);
    }
  }, [buscado, type, mine, favorites, responsable]);
  useEffect(() => { if (lista) void pedir(0); }, [pedir, lista]);
  const reload = () => { void pedir(0); historial.reload(); };
  const data = cargado ? items : null;
  const visible = items;

  const run = async (fn: () => Promise<unknown>, id: string, success: string, detail?: string) => {
    setBusy(id);
    try {
      await fn();
      toast.success(success, detail);
      reload();
    } catch (e) {
      toast.error(apiError(e));
    } finally {
      setBusy(null);
    }
  };

  /** V6 §9.1: «Guardar» es acceso rápido; no cambia recomendaciones, puntos ni trayectoria. */
  const alternarGuardada = (a: Activity) => (a.isFavorite
    ? run(() => activityService.unfavorite(a.id), a.id, 'Quitada de guardadas')
    : run(() => activityService.favorite(a.id), a.id, 'Guardada', 'La encuentras en «Guardadas». No cambia lo que te sugerimos.'));

  /*
   * V5 §6: pedir un lugar, tenerlo y asistir son tres cosas. Una interna
   * abierta y sin cupo admite sola; las demás las admite el responsable. En
   * ningún caso cuenta en la trayectoria hasta que registren tu asistencia.
   */
  const requestSeat = async (a: Activity) => {
    // V6 §4.1: abierta (con o sin cupo) admite sola; con cupo, por orden de solicitud.
    const auto = a.originType !== 'external' && (a.registrationMode ?? 'open') === 'open';
    const ok = await confirm({
      title: 'Solicitar inscripción',
      message: (
        <>
          Vas a pedir un lugar en <strong>{a.title}</strong>.{' '}
          {!auto
            ? 'Inscripción sujeta a aprobación: el responsable decide si te admite.'
            : a.capacity
              ? `Admisión abierta con ${a.capacity} plazas: se asignan por orden de solicitud; si quedan, tienes la tuya al instante.`
              : 'Admisión abierta: quedarás admitido al instante.'}
          {' '}Cuenta en tu trayectoria cuando el responsable registre tu asistencia.
        </>
      ),
      confirmLabel: 'Solicitar inscripción',
    });
    if (!ok) return;
    run(
      () => activityService.register(a.id),
      a.id,
      auto ? 'Inscripción admitida' : 'Solicitud enviada',
      auto ? 'Tienes un lugar. La asistencia la registra el responsable el día del evento.' : 'Queda pendiente de que el responsable la admita.',
    );
  };

  /**
   * Baja voluntaria (§23).
   *
   * Solo antes de que confirmen: después ya es experiencia registrada y
   * borrarla sería falsear la trayectoria.
   */
  const cancelSeat = async (a: Activity) => {
    const ok = await confirm({
      title: 'Darte de baja',
      message: (
        <>
          Dejarás de estar inscrito en <strong>{a.title}</strong>. Puedes volver a
          inscribirte mientras la actividad siga admitiendo inscripciones.
        </>
      ),
      confirmLabel: 'Darme de baja',
      tone: 'danger',
    });
    if (!ok) return;
    run(
      () => activityService.cancelRegistration(a.id),
      a.id,
      'Inscripción dada de baja',
      `Ya no estás inscrito en “${a.title}”.`,
    );
  };

  return (
    <div>
      <PageHeader
        title="Actividades y oportunidades"
        description="Lo que te sugerimos, todo lo abierto, lo que te interesa y lo que ya hiciste. La participación confirmada alimenta tu perfil y tu afinidad."
      />

      <Tabs
        value={tab}
        onChange={cambiarTab}
        items={[
          { key: 'para-ti', label: 'Para ti' },
          { key: 'todas', label: 'Todas' },
          { key: 'inscritas', label: 'Inscritas', count: regs.filter((r) => ['registered', 'accepted', 'confirmed'].includes(r.status)).length },
          { key: 'guardadas', label: 'Guardadas' },
          { key: 'historial', label: 'Historial' },
        ]}
      />

      {tab === 'para-ti' && <ParaTi onChanged={reload} />}

      {tab === 'historial' && (
        <Card title="Tu historial">
          {!historial.data ? (
            <SkeletonCards count={2} />
          ) : historial.data.length === 0 ? (
            <EmptyState icon={<FiCalendar size={22} />} message="Todavía no participas en ninguna actividad." />
          ) : (
            <div className="scroll-x">
              <table>
                <thead><tr><th>Actividad</th><th>Fecha</th><th>Estado</th></tr></thead>
                <tbody>
                  {historial.data.map((r) => (
                    <tr key={r.registrationId}>
                      <td>{r.activity?.title}</td>
                      <td className="muted">{formatDate(r.activity?.eventDate ?? null) ?? '—'}</td>
                      <td>{lbl(REGISTRATION_STATUS_LABEL, r.status)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Card>
      )}

      {(tab === 'todas' || tab === 'guardadas' || tab === 'inscritas') && (<>
      <div className="filters">
        <SearchInput
          value={query}
          onChange={setQuery}
          onDebouncedChange={setBuscado}
          placeholder="Buscar por título, descripción o lugar…"
        />
        <div className="chip-row">
          {([
            { key: 'todas', label: 'Todas' },
            { key: 'academica', label: 'Académicas internas' },
            { key: 'extracurricular', label: 'Extracurriculares internas' },
            { key: 'externas', label: 'Oportunidades externas' },
          ] as const).map((opt) => (
            <button
              key={opt.key}
              type="button"
              className={`chip ${type === opt.key ? 'on' : ''}`}
              onClick={() => setType(opt.key)}
            >
              {opt.label}
            </button>
          ))}
        </div>
        <div className="field">
          <label htmlFor="est-responsable">Responsable</label>
          {responsable ? (
            <div className="flex" style={{ gap: '0.4rem', alignItems: 'center' }}>
              <strong>{responsable.name}</strong>
              <Button variant="ghost" size="sm" onClick={() => { setResponsable(null); setBuscarResp(''); }}>Quitar</Button>
            </div>
          ) : (
            <div>
              <input
                id="est-responsable"
                value={buscarResp}
                onChange={(e) => setBuscarResp(e.target.value)}
                placeholder="Busca por nombre…"
                role="combobox"
                aria-expanded={candidatos.length > 0}
                aria-controls="est-responsable-lista"
                autoComplete="off"
              />
              {candidatos.length > 0 && (
                <ul id="est-responsable-lista" className="plain-list" role="listbox">
                  {candidatos.map((c) => (
                    <li key={c.id} role="option" aria-selected={false}>
                      <button type="button" className="link-button" onClick={() => { setResponsable(c); setCandidatos([]); }}>
                        {c.name}
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          )}
        </div>
        <ResultCount shown={visible.length} total={total} noun="actividades" />
      </div>

      {loading && !data ? (
        <Diferido><SkeletonCards count={4} /></Diferido>
      ) : error && !data ? (
        <div className="alert alert-error">{error}</div>
      ) : items.length === 0 && !buscado && type === 'todas' ? (
        <EmptyState
          icon={<FiCalendar size={22} />}
          message={tab === 'guardadas' ? 'Todavía no guardaste ninguna actividad.'
            : tab === 'inscritas' ? 'Todavía no te inscribiste en ninguna actividad.'
              : 'Todavía no hay actividades publicadas. Vuelve a consultar más adelante.'}
        />
      ) : visible.length === 0 ? (
        <EmptyState
          icon={<FiSearch size={22} />}
          message={`Ninguna actividad coincide con los filtros aplicados.`}
          action={
            <Button
              variant="secondary"
              size="sm"
              onClick={() => {
                setQuery('');
                setBuscado('');
                setType('todas');
              }}
            >
              Quitar filtros
            </Button>
          }
        />
      ) : (
        <div className="activity-grid">
          {visible.map((a, index) => {
            const blocked = a.registrationBlockReason;
            const full = a.capacity != null && a.seatsLeft === 0;
            const acciones = (
                  <>
                    {/*
                      §23: los tres estados significan cosas distintas, así que
                      la pantalla ofrece cosas distintas. Confirmada ya es
                      experiencia registrada y solo el responsable la corrige.
                    */}
                    {a.myRegistration?.status === 'confirmed'
                      || (a.myRegistration?.status === 'accepted' && a.originType === 'external')
                      || a.myRegistration?.status === 'absent'
                      || a.myRegistration?.status === 'rejected' ? (
                        <p className="inline-note" style={{ margin: 0 }}>
                          <FiAlertCircle size={13} />{' '}
                          {a.myRegistration.status === 'accepted'
                            ? a.myRegistration.evidenceEligible
                              ? 'Terminó y fuiste aceptado: ya puedes adjuntar tu credencial en Evidencias.'
                              : 'Fuiste aceptado. Cuando termine, podrás adjuntar la credencial que emita el proveedor.'
                            : a.myRegistration.status === 'confirmed'
                              ? a.myRegistration.evidenceEligible
                                ? 'Asistencia registrada. Ya puedes adjuntar en Evidencias la credencial del proveedor.'
                                : 'El responsable registró tu asistencia. Si hay un error, avísale.'
                              : a.myRegistration.status === 'rejected'
                                ? `Tu solicitud no fue admitida${a.myRegistration.decisionReason ? `: ${a.myRegistration.decisionReason}` : '.'}`
                                : 'El responsable registró tu ausencia.'}
                        </p>
                      ) : (
                        <>
                          <Button
                            variant="secondary"
                            size="sm"
                            loading={busy === a.id}
                            onClick={() => alternarGuardada(a)}
                            icon={<FiBookmark size={14} />}
                            aria-pressed={a.isFavorite === true}
                          >
                            {/* V6 §9.1: «Me interesa» se retiró de actividades; queda «Guardar». */}
                            {a.isFavorite ? 'Quitar de guardadas' : 'Guardar'}
                          </Button>
                          {a.myRegistration?.status === 'accepted' && (
                            <span className="inline-note" style={{ margin: 0 }}>
                              <FiAlertCircle size={13} /> Tienes un lugar. La asistencia la registra el responsable el día del evento.
                            </span>
                          )}
                          {a.myRegistration?.status === 'registered' && a.originType !== 'external' && (
                            <span className="inline-note" style={{ margin: 0 }}>
                              <FiAlertCircle size={13} /> Solicitud pendiente: el responsable decide si te admite.
                            </span>
                          )}
                          {yaPaso(a) || a.status === 'cancelled' ? null : a.myRegistration?.status === 'registered' || a.myRegistration?.status === 'accepted' ? (
                            <Button
                              variant="secondary"
                              size="sm"
                              loading={busy === a.id}
                              onClick={() => cancelSeat(a)}
                              icon={<FiUserMinus size={14} />}
                            >
                              Darme de baja
                            </Button>
                          ) : (
                            <Button
                              size="sm"
                              loading={busy === a.id}
                              onClick={() => requestSeat(a)}
                              icon={<FiUserPlus size={14} />}
                            >
                              Solicitar inscripción
                            </Button>
                          )}
                        </>
                      )}
                  </>
            );
            return (
              <Stagger key={a.id} index={index}>
                <ActivityCard
                  a={a}
                  onDetalle={() => setDetalle(a)}
                  aviso={blocked ?? (full ? 'La actividad ya no tiene lugares disponibles.' : null)}
                  acciones={acciones}
                />
              </Stagger>
            );
          })}
        </div>
      )}
      {lista && items.length < total && (
        <div style={{ textAlign: 'center', marginTop: '1rem' }}>
          <Button variant="secondary" loading={loading} onClick={() => pedir(items.length)}>
            Ver más ({total - items.length} restantes)
          </Button>
        </div>
      )}
      </>)}
      {detalle && (
        <ActivityDetail
          a={visible.find((x) => x.id === detalle.id) ?? detalle}
          onClose={() => setDetalle(null)}
        />
      )}
    </div>
  );
}
