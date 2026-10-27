import { useEffect, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { useAsync } from '../../hooks/useAsync';
import { BandejaDireccion } from '../staff/StudentPoints';
import { FiAlertCircle, FiCheck, FiClock, FiX } from 'react-icons/fi';
import { apiError } from '../../api/client';
import { useCachedState } from '../../hooks/viewCache';
import { activityService, gamificationService, learningResourceService } from '../../services';
import {
  Badge, Button, Card, Diferido, EmptyState, PageHeader, SkeletonCards, Stagger, Tabs,
} from '../../components/ui';
import { useToast } from '../../components/feedback';
import type { Activity } from '../../services/types';

type Decision = 'approve' | 'observe' | 'reject';
type Historia = Awaited<ReturnType<typeof activityService.reviewHistory>>;

const ACCION: Record<string, string> = {
  submitted: 'Enviada a revisión',
  approved: 'Aprobada',
  observed: 'Observada',
  rejected: 'Rechazada',
};

const fecha = (v: string | null) =>
  v ? new Date(v).toLocaleString('es-BO', { dateStyle: 'medium', timeStyle: 'short' }) : 'Sin fecha';

/**
 * Aprobaciones de Dirección (V2 §27). Docentes y Sociedad proponen; aquí se
 * aprueba, se observa (vuelve a quien la propuso con el comentario) o se
 * rechaza. La API es la que decide: esta página solo la usa.
 */
export default function DirectorApprovalsPage() {
  // V4.1 §9.4: una sola bandeja con Actividades, Recursos y Gamificación.
  const [params, setParams] = useSearchParams();
  const tab = (['recursos', 'gamificacion'].includes(params.get('tab') ?? '') ? params.get('tab') : 'actividades') as string;
  const actividades = useAsync(() => activityService.pendingReviews(), [], { cache: false });
  const recursos = useAsync(() => learningResourceService.pending(), [], { cache: false });
  const puntos = useAsync(() => gamificationService.proposals('pending'), [], { cache: false });
  return (
    <div>
      <PageHeader
        title="Aprobaciones"
        description="Lo que docentes y la sociedad científica enviaron a Dirección: actividades, recursos propuestos y propuestas de puntos. Cada pendiente se aprueba, se observa o se rechaza con motivo."
      />
      <Tabs
        items={[
          { key: 'actividades', label: 'Pendientes — Actividades', count: actividades.data?.length },
          { key: 'recursos', label: 'Pendientes — Recursos', count: recursos.data?.length },
          { key: 'gamificacion', label: 'Pendientes — Gamificación', count: puntos.data?.length },
        ]}
        value={tab}
        onChange={(k) => setParams(k === 'actividades' ? {} : { tab: k }, { replace: true })}
      />
      {tab === 'actividades' ? (
        <ActividadesPendientes />
      ) : tab === 'recursos' ? (
        <Card title="Recursos propuestos por docentes">
          <p className="muted" style={{ marginTop: 0 }}>
            {recursos.data?.length
              ? `Hay ${recursos.data.length} recurso${recursos.data.length === 1 ? '' : 's'} esperando revisión.`
              : 'No hay recursos esperando revisión.'}{' '}
            Se revisan con su contenido completo en <Link to="/director/resources">Recursos</Link>.
          </p>
        </Card>
      ) : (
        <BandejaDireccion />
      )}
    </div>
  );
}

function ActividadesPendientes() {
  const [items, setItems] = useCachedState<Activity[] | null>('pendientes', null);
  const [abierta, setAbierta] = useState<string | null>(null);
  const [historia, setHistoria] = useState<Record<string, Historia>>({});
  const [comentario, setComentario] = useState('');
  const [busy, setBusy] = useState(false);
  const [errorCampo, setErrorCampo] = useState<string | null>(null);
  const toast = useToast();

  const load = () =>
    activityService
      .pendingReviews()
      .then(setItems)
      .catch((e) => {
        setItems([]);
        toast.error(apiError(e));
      });

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const abrir = async (a: Activity) => {
    const otra = abierta === a.id ? null : a.id;
    setAbierta(otra);
    setComentario('');
    setErrorCampo(null);
    if (otra && !historia[a.id]) {
      try {
        const h = await activityService.reviewHistory(a.id);
        setHistoria((prev) => ({ ...prev, [a.id]: h }));
      } catch (e) {
        toast.error(apiError(e));
      }
    }
  };

  const decidir = async (a: Activity, decision: Decision) => {
    if (decision !== 'approve' && !comentario.trim()) {
      setErrorCampo('Escribe la observación para quien la propuso.');
      return;
    }
    setBusy(true);
    try {
      await activityService.review(a.id, decision, comentario.trim() || undefined);
      toast.success(
        { approve: 'Actividad aprobada.', observe: 'Observación enviada.', reject: 'Actividad rechazada.' }[decision],
        decision === 'approve' ? 'Quien la propuso ya puede publicarla.' : undefined,
      );
      setAbierta(null);
      setComentario('');
      await load();
    } catch (e) {
      toast.error(apiError(e));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div>
      <p className="muted">Solo las actividades aprobadas pueden publicarse; el criterio de puntos se aprueba junto con ellas.</p>

      {items === null ? (
        <Diferido><SkeletonCards count={3} /></Diferido>
      ) : items.length === 0 ? (
        <EmptyState
          icon={<FiCheck size={28} />}
          message="No hay nada pendiente. Cuando alguien envíe una actividad a revisión, aparecerá aquí."
        />
      ) : (
        <Stagger>
          {items.map((a) => {
            const puntos = a.gamificationRules?.find((r) => r.trigger === 'participacion_confirmada')?.points;
            const open = abierta === a.id;
            return (
              <Card
                key={a.id}
                title={a.title}
                actions={<Badge tone="amber"><FiClock size={12} /> En revisión</Badge>}
              >
                <p className="muted small" style={{ marginTop: 0 }}>
                  {a.type === 'academica' ? 'Académica' : 'Extracurricular'}
                  {a.category?.name ? ` · ${a.category.name}` : ''}
                  {a.academicArea?.name ? ` · ${a.academicArea.name}` : ''}
                  {' · '}Propuesta por {a.creator ? `${a.creator.firstName} ${a.creator.lastName}` : 'sin dato'}
                  {' · '}Enviada {fecha(a.submittedAt ?? null)}
                </p>
                {a.description && <p style={{ whiteSpace: 'pre-line' }}>{a.description}</p>}

                <div className="chip-row" style={{ marginBottom: '0.6rem' }}>
                  <Badge tone="gray">Fecha: {fecha(a.eventDate)}</Badge>
                  <Badge tone="gray">
                    Semestres: {a.semesterScope?.length ? a.semesterScope.map((n) => `${n}º`).join(', ') : 'toda la carrera'}
                  </Badge>
                  <Badge tone="gray">Cupo: {a.capacity ?? 'sin límite'}</Badge>
                  <Badge tone={puntos ? 'bordo' : 'gray'}>
                    {puntos ? `${puntos} puntos por participar` : 'Puntos del criterio general'}
                  </Badge>
                </div>
                {!!a.activitySkills?.length && (
                  <p className="muted small">
                    Trabaja: {a.activitySkills.map((s) => s.skill?.name).filter(Boolean).join(', ')}
                  </p>
                )}

                <Button variant="ghost" size="sm" onClick={() => abrir(a)}>
                  {open ? 'Cerrar' : 'Decidir'}
                </Button>

                {open && (
                  <div style={{ marginTop: '0.8rem' }}>
                    {!!historia[a.id]?.length && (
                      <ul className="muted small" style={{ paddingLeft: '1.1rem' }}>
                        {historia[a.id].map((h) => (
                          <li key={h.id}>
                            {ACCION[h.action] ?? h.action} · {h.by ?? 'sin dato'} · {fecha(h.at)}
                            {h.comment ? ` — «${h.comment}»` : ''}
                          </li>
                        ))}
                      </ul>
                    )}
                    <div className="field">
                      <label htmlFor={`c-${a.id}`}>Comentario (obligatorio para observar o rechazar)</label>
                      <textarea
                        id={`c-${a.id}`}
                        rows={3}
                        maxLength={1000}
                        value={comentario}
                        aria-invalid={!!errorCampo}
                        onChange={(e) => {
                          setComentario(e.target.value);
                          setErrorCampo(null);
                        }}
                      />
                      {errorCampo && (
                        <small className="field-error"><FiAlertCircle size={12} /> {errorCampo}</small>
                      )}
                    </div>
                    <div className="flex" style={{ gap: '0.5rem', flexWrap: 'wrap' }}>
                      <Button icon={<FiCheck size={14} />} disabled={busy} onClick={() => decidir(a, 'approve')}>
                        Aprobar
                      </Button>
                      <Button variant="ghost" icon={<FiAlertCircle size={14} />} disabled={busy} onClick={() => decidir(a, 'observe')}>
                        Observar
                      </Button>
                      <Button variant="danger" icon={<FiX size={14} />} disabled={busy} onClick={() => decidir(a, 'reject')}>
                        Rechazar
                      </Button>
                    </div>
                  </div>
                )}
              </Card>
            );
          })}
        </Stagger>
      )}
    </div>
  );
}
