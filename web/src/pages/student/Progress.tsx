import { useEffect, useState } from 'react';
import { FiAward, FiDownload, FiFileText, FiInfo } from 'react-icons/fi';
import { apiError } from '../../api/client';
import {
  gamificationService,
  trajectoryService,
  type GamificationSummary,
  type TrajectorySectionOption,
} from '../../services';
import { useAsync } from '../../hooks/useAsync';
import { useToast } from '../../components/feedback';
import {
  AsyncView, Badge, Button, Card, EmptyState, PageHeader, SkeletonCards, Tabs,
} from '../../components/ui';

const FECHA = (v: string | null) =>
  v ? new Date(v).toLocaleDateString('es-BO', { day: 'numeric', month: 'short', year: 'numeric' }) : '';

/**
 * Progreso y resumen de trayectoria (§66, §67).
 *
 * Las dos cosas comparten pantalla porque responden a la misma pregunta desde
 * dos lados: qué he hecho, y cómo se lo cuento a alguien de fuera.
 */
export default function StudentProgressPage() {
  const [tab, setTab] = useState<'progreso' | 'resumen'>('progreso');

  return (
    <div>
      <PageHeader
        title="Mi progreso"
        description="Lo que has hecho en la plataforma, y el resumen que puedes llevarte."
      />
      <Tabs
        value={tab}
        onChange={(k) => setTab(k as typeof tab)}
        items={[
          { key: 'progreso', label: 'Puntos e insignias' },
          { key: 'resumen', label: 'Resumen de trayectoria' },
        ]}
      />
      {tab === 'progreso' ? <Progreso /> : <Resumen />}
    </div>
  );
}

// ---------------------------------------------------------------------------
// §66 · Puntos e insignias
// ---------------------------------------------------------------------------

function Progreso() {
  const state = useAsync(() => gamificationService.myProgress(), []);

  return (
    <AsyncView
      loading={state.loading}
      error={state.error}
      data={state.data}
      skeleton={<SkeletonCards count={2} />}
    >
      {(p: GamificationSummary) => (
        <>
          <Card>
            <div className="flex between" style={{ alignItems: 'flex-start' }}>
              <div>
                <div className="puntos-total">{p.totalPoints}</div>
                <span className="muted">
                  {p.eventsCount} {p.eventsCount === 1 ? 'reconocimiento' : 'reconocimientos'}
                </span>
              </div>
              <Badge tone="bordo">
                <FiAward size={11} /> {p.badges.filter((b) => b.earned).length} insignias
              </Badge>
            </div>
            {/* §66 es explícito en que la gamificación es independiente de la
                afinidad. Si el sistema lo cumple pero no lo dice, el estudiante
                seguirá creyendo que acumular puntos le mejora el perfil. */}
            <p className="inline-note" style={{ marginTop: '1rem' }}>
              <FiInfo size={13} /> {p.note}
            </p>
          </Card>

          <Card title="Insignias">
            <div className="insignias">
              {p.badges.map((b) => (
                <div key={b.code} className={`insignia ${b.earned ? 'obtenida' : ''}`}>
                  <div className="flex between">
                    <strong>{b.name}</strong>
                    {b.earned
                      ? <Badge tone="green">{FECHA(b.earnedAt)}</Badge>
                      : <span className="muted">{b.progress} de {b.threshold}</span>}
                  </div>
                  <p className="muted">{b.description}</p>
                  {!b.earned && (
                    <div className="progress">
                      <div style={{ width: `${Math.round((b.progress / b.threshold) * 100)}%` }} />
                    </div>
                  )}
                </div>
              ))}
            </div>
          </Card>

          <Card title="Qué se reconoce">
            <p className="muted" style={{ marginTop: 0 }}>
              Solo cosas hechas. Declarar un interés, adjuntar un archivo o registrar un proyecto
              vacío no suman: son declaraciones, no trayectoria.
            </p>
            <div className="scroll-x">
              <table>
                <thead>
                  <tr><th>Acción</th><th style={{ textAlign: 'right' }}>Puntos</th></tr>
                </thead>
                <tbody>
                  {p.rules.map((r) => (
                    <tr key={r.trigger}>
                      <td>{r.label}</td>
                      <td style={{ textAlign: 'right' }}>{r.points}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Card>

          <Card title="Historial">
            {p.events.length === 0 && (
              <EmptyState message="Todavía no hay nada reconocido. Participa en una actividad o consigue respaldo para un proyecto." />
            )}
            {p.events.map((e) => (
              <div key={e.id} className="flex between evento">
                <div>
                  <strong>{e.reason}</strong>
                  <div className="muted" style={{ fontSize: '0.78rem' }}>
                    {e.triggerLabel} · {FECHA(e.occurredAt)}
                  </div>
                </div>
                <Badge tone="gray">+{e.points}</Badge>
              </div>
            ))}
          </Card>
        </>
      )}
    </AsyncView>
  );
}

// ---------------------------------------------------------------------------
// §67 · Resumen de trayectoria
// ---------------------------------------------------------------------------

function Resumen() {
  const [opciones, setOpciones] = useState<TrajectorySectionOption[]>([]);
  const [disclaimer, setDisclaimer] = useState('');
  const [elegidas, setElegidas] = useState<string[]>(['basic', 'areas', 'projects', 'activities']);
  const [vista, setVista] = useState<Record<string, unknown> | null>(null);
  const [cargando, setCargando] = useState(false);
  const [descargando, setDescargando] = useState(false);
  const toast = useToast();

  useEffect(() => {
    trajectoryService
      .sections()
      .then((r) => { setOpciones(r.sections); setDisclaimer(r.disclaimer); })
      .catch((e) => toast.error(apiError(e)));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const alternar = (key: string) =>
    setElegidas((prev) =>
      prev.includes(key) ? prev.filter((k) => k !== key) : [...prev, key]);

  const previsualizar = async () => {
    setCargando(true);
    try {
      setVista(await trajectoryService.preview(elegidas));
    } catch (e) {
      toast.error(apiError(e));
    } finally {
      setCargando(false);
    }
  };

  const descargar = async () => {
    setDescargando(true);
    try {
      const { blob, filename } = await trajectoryService.pdf(elegidas);
      const url = URL.createObjectURL(blob);
      const enlace = document.createElement('a');
      enlace.href = url;
      enlace.download = filename;
      enlace.click();
      URL.revokeObjectURL(url);
    } catch (e) {
      toast.error(apiError(e));
    } finally {
      setDescargando(false);
    }
  };

  return (
    <>
      <Card title="Qué quieres incluir">
        <p className="muted" style={{ marginTop: 0 }}>
          Tú decides qué entra. Los datos básicos van siempre: un resumen sin nombre no es de nadie.
        </p>
        <div className="chip-row">
          {opciones.map((o) => {
            const on = elegidas.includes(o.key) || o.key === 'basic';
            return (
              <button
                type="button"
                key={o.key}
                className={`chip ${on ? 'on' : ''}`}
                aria-pressed={on}
                disabled={o.key === 'basic'}
                onClick={() => alternar(o.key)}
              >
                {o.label}
              </button>
            );
          })}
        </div>

        <div className="flex mt" style={{ gap: '0.6rem', flexWrap: 'wrap' }}>
          <Button
            variant="secondary"
            loading={cargando}
            icon={<FiFileText size={15} />}
            onClick={previsualizar}
          >
            Ver antes de descargar
          </Button>
          <Button loading={descargando} icon={<FiDownload size={15} />} onClick={descargar}>
            Descargar en PDF
          </Button>
        </div>

        {/* La advertencia se muestra aquí y va además dentro del PDF: el archivo
            circula solo, y quien lo reciba no habrá visto esta pantalla. */}
        {disclaimer && (
          <p className="inline-note mt">
            <FiInfo size={13} /> {disclaimer}
          </p>
        )}
      </Card>

      {vista && (
        <Card title="Vista previa">
          <pre className="vista-resumen">{JSON.stringify(vista, null, 2)}</pre>
        </Card>
      )}
    </>
  );
}
