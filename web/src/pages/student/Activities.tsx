import { useCallback, useEffect, useState } from 'react';
import {
  FiAlertCircle,
  FiCalendar,
  FiCheckCircle,
  FiExternalLink,
  FiHeart,
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

export default function StudentActivitiesPage() {
  const [query, setQuery] = useState('');
  /** Lo que se busca en el servidor: espera a que se deje de escribir. */
  const [buscado, setBuscado] = useState('');
  const [type, setType] = useState<'todas' | 'academica' | 'extracurricular'>('todas');
  const [busy, setBusy] = useState<string | null>(null);
  const toast = useToast();
  const confirm = useConfirm();

  // V3 §34.2: [Para ti] [Todas] [Interesadas] [Inscritas] [Historial].
  const [params, setParams] = useSearchParams();
  const tab = params.get('tab') ?? 'para-ti';
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
  const lista = tab === 'todas' || tab === 'interesadas' || tab === 'inscritas';
  const mine = tab === 'interesadas' ? 'interested' as const : tab === 'inscritas' ? 'enrolled' as const : undefined;
  const [items, setItems] = useState<Activity[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [cargado, setCargado] = useState(false);
  const pedir = useCallback(async (offset: number) => {
    setLoading(true);
    try {
      const r = await activityService.page({
        limit: PASO, offset, q: buscado.trim() || undefined, type: type === 'todas' ? undefined : type, mine,
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
  }, [buscado, type, mine]);
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

  const markInterest = (a: Activity) =>
    run(() => activityService.registerInterest(a.id), a.id, 'Interés registrado', `“${a.title}” quedó marcada como de tu interés.`);

  const requestSeat = async (a: Activity) => {
    const ok = await confirm({
      title: 'Solicitar inscripción',
      message: (
        <>
          Vas a solicitar un lugar en <strong>{a.title}</strong>. El responsable de la actividad
          debe aprobarlo, y tu participación solo cuenta cuando te la confirmen.
        </>
      ),
      confirmLabel: 'Solicitar inscripción',
    });
    if (!ok) return;
    run(
      () => activityService.register(a.id),
      a.id,
      'Solicitud enviada',
      'Queda pendiente de aprobación del responsable.',
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
          { key: 'interesadas', label: 'Interesadas', count: regs.filter((r) => r.status === 'interested').length },
          { key: 'inscritas', label: 'Inscritas', count: regs.filter((r) => ['registered', 'accepted', 'confirmed'].includes(r.status)).length },
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

      {(tab === 'todas' || tab === 'interesadas' || tab === 'inscritas') && (<>
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
            { key: 'academica', label: 'Académicas' },
            { key: 'extracurricular', label: 'Extracurriculares' },
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
        <ResultCount shown={visible.length} total={total} noun="actividades" />
      </div>

      {loading && !data ? (
        <Diferido><SkeletonCards count={4} /></Diferido>
      ) : error && !data ? (
        <div className="alert alert-error">{error}</div>
      ) : items.length === 0 && !buscado && type === 'todas' ? (
        <EmptyState
          icon={<FiCalendar size={22} />}
          message={tab === 'interesadas' ? 'Todavía no marcaste interés en ninguna actividad.'
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
        <div className="grid cols-2">
          {visible.map((a, index) => {
            const date = formatDate(a.eventDate);
            const blocked = a.registrationBlockReason;
            const full = a.capacity != null && a.seatsLeft === 0;
            return (
              <Stagger key={a.id} index={index}>
                <Card
                  title={a.title}
                  actions={<Badge tone="bordo">{lbl(ACTIVITY_TYPE_LABEL, a.type)}</Badge>}
                >
                  <div className="activity-meta" style={{ marginTop: 0 }}>
                    {a.originType === 'external' && (
                      <span className="badge-externa">Externa{a.provider ? ` · ${a.provider}` : ''}</span>
                    )}
                    <span><FiTag size={13} /> {a.category?.name ?? 'Sin categoría'}</span>
                    <span><FiCheckCircle size={13} /> {lbl(ACTIVITY_STATUS_LABEL, a.status)}</span>
                    {a.academicArea?.name && <span><FiHeart size={13} /> {a.academicArea.name}</span>}
                  </div>

                  {a.description && <p style={{ marginTop: '0.7rem' }}>{a.description}</p>}

                  <div className="activity-meta">
                    {date && <span><FiCalendar size={13} /> {date}</span>}
                    {a.location && <span><FiMapPin size={13} /> {a.location}</span>}
                    <span><FiUsers size={13} /> {a.modality}</span>
                    {a.capacity != null && (
                      <span>
                        <FiUsers size={13} />
                        {a.seatsLeft != null ? `${a.seatsLeft} de ${a.capacity} lugares` : `Cupo ${a.capacity}`}
                      </span>
                    )}
                    {a.externalUrl && (
                      <a href={a.externalUrl} target="_blank" rel="noreferrer">
                        <FiExternalLink size={13} /> Enlace
                      </a>
                    )}
                  </div>

                  {(blocked || full) && (
                    <p className="inline-note">
                      <FiAlertCircle size={13} /> {blocked ?? 'La actividad ya no tiene lugares disponibles.'}
                    </p>
                  )}

                  <div className="flex mt" style={{ gap: '0.5rem', flexWrap: 'wrap' }}>
                    {/*
                      §23: los tres estados significan cosas distintas, así que
                      la pantalla ofrece cosas distintas. Confirmada ya es
                      experiencia registrada y solo el responsable la corrige.
                    */}
                    {a.myRegistration?.status === 'confirmed'
                      || a.myRegistration?.status === 'accepted'
                      || a.myRegistration?.status === 'absent' ? (
                        <p className="inline-note" style={{ margin: 0 }}>
                          <FiAlertCircle size={13} />{' '}
                          {a.myRegistration.status === 'accepted'
                            ? a.myRegistration.evidenceEligible
                              ? 'Terminó y fuiste aceptado: ya puedes adjuntar tu credencial en Evidencias.'
                              : 'Fuiste aceptado. Cuando termine, podrás adjuntar la credencial que emita el proveedor.'
                            : a.myRegistration.status === 'confirmed'
                              ? a.myRegistration.evidenceEligible
                                ? 'Participación confirmada. Ya puedes adjuntar en Evidencias la credencial del proveedor.'
                                : 'Tu participación ya fue confirmada. Si hay un error, avisa al responsable.'
                              : 'El responsable registró tu ausencia.'}
                        </p>
                      ) : (
                        <>
                          <Button
                            variant="secondary"
                            size="sm"
                            loading={busy === a.id}
                            disabled={a.myRegistration?.status === 'interested'}
                            onClick={() => markInterest(a)}
                            icon={<FiHeart size={14} />}
                          >
                            {a.myRegistration?.status === 'interested' ? 'Te interesa' : 'Me interesa'}
                          </Button>
                          {a.myRegistration?.status === 'registered' ? (
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
                  </div>
                </Card>
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
    </div>
  );
}
