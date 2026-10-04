import { useSearchParams } from 'react-router-dom';
import { useEffect, useState } from 'react';
import { FiAward, FiDownload, FiFileText, FiGift, FiInfo } from 'react-icons/fi';
import { apiError } from '../../api/client';
import {
  gamificationService,
  trajectoryService,
  type CvRequest,
  type CvTemplateOption,
  type GamificationSummary,
  type TrajectorySectionOption,
} from '../../services';
import AiAssist from '../../components/AiAssist';
import { useAsync } from '../../hooks/useAsync';
import { useConfirm, useToast } from '../../components/feedback';
import type { RewardItem, Wallet } from '../../services/types';
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
  // La pestaña viaja en la URL (?tab=): el menú lleva directo a «Equipos» o
  // a «CV / Exportar» (V2 §77), y volver atrás deja donde estaba.
  const [params, setParams] = useSearchParams();
  const pedida = params.get('tab');
  const tab: 'progreso' | 'recompensas' | 'resumen' = (['progreso', 'recompensas', 'resumen'] as string[]).includes(pedida ?? '') ? (pedida as 'progreso' | 'recompensas' | 'resumen') : 'progreso';
  const setTab = (k: 'progreso' | 'recompensas' | 'resumen') => setParams(k === 'progreso' ? {} : { tab: k }, { replace: true });

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
          { key: 'recompensas', label: 'Recompensas' },
          { key: 'resumen', label: 'Resumen de trayectoria' },
        ]}
      />
      {tab === 'progreso' ? <Progreso /> : tab === 'recompensas' ? <Recompensas /> : <Resumen />}
    </div>
  );
}

// ---------------------------------------------------------------------------
// §66 · Puntos e insignias
// ---------------------------------------------------------------------------

function Periodos() {
  const w = useAsync(() => gamificationService.wallet(), []);
  if (!w.data) return null;
  const { balance, periods } = w.data;
  return (
    <div className="wallet-grid" style={{ marginBottom: '1rem' }}>
      <div className="wallet-stat main">
        <div className="n">{balance.available}</div>
        <span className="muted">puntos para canjear</span>
      </div>
      <div className="wallet-stat"><div className="n">{periods.week}</div><span className="muted">esta semana</span></div>
      <div className="wallet-stat"><div className="n">{periods.month}</div><span className="muted">este mes</span></div>
      <div className="wallet-stat"><div className="n">{periods.year}</div><span className="muted">este año</span></div>
    </div>
  );
}

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
          <Periodos />
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
// Recompensas: los puntos se canjean por lo que ofrecen los docentes
// ---------------------------------------------------------------------------

const ESTADO_CANJE: Record<string, { label: string; tone: 'amber' | 'green' | 'gray' }> = {
  pending: { label: 'Por entregar', tone: 'amber' },
  delivered: { label: 'Entregado', tone: 'green' },
  rejected: { label: 'Rechazado: puntos devueltos', tone: 'gray' },
};

function Recompensas() {
  const wallet = useAsync(() => gamificationService.wallet(), []);
  const catalogo = useAsync(() => gamificationService.rewards(), []);
  const [canjeando, setCanjeando] = useState<string | null>(null);
  const toast = useToast();
  const confirm = useConfirm();

  const canjear = async (r: RewardItem) => {
    const ok = await confirm({
      title: `Canjear «${r.name}»`,
      message: `Se descontarán ${r.cost} puntos de tu saldo. ${r.offeredBy ?? 'Quien la ofrece'} te la entregará; si la rechaza, los puntos vuelven.`,
      confirmLabel: 'Canjear',
    });
    if (!ok) return;
    setCanjeando(r.id);
    try {
      await gamificationService.redeem(r.id);
      toast.success('¡Canje solicitado!', 'Verás aquí cuándo te la entregan.');
      wallet.reload();
      catalogo.reload();
    } catch (e) {
      toast.error(apiError(e));
    } finally {
      setCanjeando(null);
    }
  };

  const saldo = wallet.data?.balance.available ?? 0;

  return (
    <>
      <AsyncView loading={wallet.loading} error={wallet.error} data={wallet.data} skeleton={<SkeletonCards count={1} />}>
        {(w: Wallet) => (
          <div className="wallet-grid" style={{ marginBottom: '1rem' }}>
            <div className="wallet-stat main">
              <div className="n">{w.balance.available}</div>
              <span className="muted">disponibles</span>
            </div>
            <div className="wallet-stat"><div className="n">{w.balance.earned}</div><span className="muted">ganados en total</span></div>
            <div className="wallet-stat"><div className="n">{w.balance.spent}</div><span className="muted">usados en canjes</span></div>
          </div>
        )}
      </AsyncView>

      <Card title="Qué puedes conseguir">
        <AsyncView
          loading={catalogo.loading}
          error={catalogo.error}
          data={catalogo.data}
          skeleton={<SkeletonCards count={3} />}
          isEmpty={(d) => d.length === 0}
          empty={<EmptyState icon={<FiGift size={22} />} message="Tus docentes todavía no ofrecen recompensas. ¡Sigue sumando puntos!" />}
        >
          {(lista: RewardItem[]) => (
            <div className="reward-grid">
              {lista.map((r) => {
                const agotada = r.stock !== null && r.stock <= 0;
                const falta = r.cost - saldo;
                return (
                  <div key={r.id} className="reward-card">
                    <div className="flex between" style={{ alignItems: 'flex-start' }}>
                      <strong>{r.name}</strong>
                      <span className="points-pill">{r.cost}</span>
                    </div>
                    <p className="muted small grow">{r.description}</p>
                    <span className="muted small">
                      {r.offeredBy ? `Ofrece ${r.offeredBy}` : ''}
                      {r.stock !== null ? ` · quedan ${r.stock}` : ''}
                    </span>
                    <Button
                      size="sm"
                      icon={<FiGift size={13} />}
                      disabled={agotada || falta > 0}
                      loading={canjeando === r.id}
                      onClick={() => canjear(r)}
                    >
                      {agotada ? 'Agotada' : falta > 0 ? `Te faltan ${falta} puntos` : 'Canjear'}
                    </Button>
                  </div>
                );
              })}
            </div>
          )}
        </AsyncView>
      </Card>

      <Card title="Mis canjes">
        {(wallet.data?.redemptions ?? []).length === 0 ? (
          <EmptyState message="Todavía no canjeaste nada." />
        ) : (
          wallet.data!.redemptions.map((c) => (
            <div key={c.id} className="flex between evento">
              <div>
                <strong>{c.reward}</strong>
                <div className="muted" style={{ fontSize: '0.78rem' }}>
                  {FECHA(c.createdAt)} · {c.cost} puntos{c.note ? ` · ${c.note}` : ''}
                </div>
              </div>
              <Badge tone={ESTADO_CANJE[c.status].tone}>{ESTADO_CANJE[c.status].label}</Badge>
            </div>
          ))
        )}
      </Card>
    </>
  );
}

// ---------------------------------------------------------------------------
// §67 y V2 §61 · CV / Resumen de trayectoria
// ---------------------------------------------------------------------------

const NIVEL: Record<string, string> = { high: 'alto', medium: 'medio', low: 'bajo' };

/**
 * La vista previa se dibuja con la misma información que irá al PDF, y con el
 * aire de la plantilla elegida. Antes se mostraba el JSON crudo: correcto,
 * pero nadie revisa un CV leyendo llaves y comillas.
 */
function CvPreview({ d }: { d: Record<string, any> }) {
  const lista = (titulo: string, items: (string | null | undefined)[]) =>
    items.filter(Boolean).length > 0 && (
      <section>
        <h4>{titulo}</h4>
        <ul>{items.filter(Boolean).map((t, i) => <li key={i}>{t}</li>)}</ul>
      </section>
    );
  return (
    <article className={`cv-preview cv-${d.template ?? 'classic'}`} aria-label="Vista previa del CV">
      <h3>Resumen de Trayectoria Académica Complementaria</h3>
      <p className="cv-sub">
        {d.student?.name}{d.student?.semester ? ` · ${d.student.semester}.º semestre` : ''} · {d.student?.career}
      </p>
      {d.bio && (<section><h4>Presentación</h4><p>{d.bio}</p></section>)}
      {lista('Áreas principales', (d.areas ?? []).map((a: any) => [
        a.area,
        a.score !== undefined ? `afinidad ${a.score}/100` : null,
        a.supportLevel ? `respaldo ${NIVEL[a.supportLevel] ?? a.supportLevel} (${a.supportScore}/100)` : null,
      ].filter(Boolean).join(' · ')))}
      {(d.projects ?? []).length > 0 && (
        <section>
          <h4>Proyectos</h4>
          <ul>
            {d.projects.map((p: any, i: number) => (
              <li key={i}>
                <strong>{p.title}</strong> — {p.role}
                {p.contribution && <div>Contribución: {p.contribution}</div>}
                {(p.technologies ?? []).length > 0 && <div className="muted">Tecnologías: {p.technologies.join(', ')}</div>}
              </li>
            ))}
          </ul>
        </section>
      )}
      {(d.skills ?? []).length > 0 && (
        <section><h4>Tecnologías y habilidades</h4><p>{d.skills.map((x: any) => x.name).join(' · ')}</p></section>
      )}
      {lista('Actividades con participación confirmada', (d.activities ?? []).map((a: any) => (a.date ? `${a.title} (${FECHA(a.date)})` : a.title)))}
      {lista('Certificados externos', (d.certificates ?? []).map((c: any) => `${c.name} — ${c.issuer}`))}
      {lista('Constancias internas', (d.constancies ?? []).map((c: any) => c.description))}
      {lista('Evidencias', (d.evidences ?? []).map((e: any) => (e.context ? `${e.description ?? 'Evidencia'} — ${e.context}` : e.description)))}
      {lista('Insignias de Afinia', (d.badges ?? []).map((b: any) => `${b.name} (${FECHA(b.awardedAt)})`))}
      {lista('Contacto', (d.contact ?? []).map((c: any) => `${c.label}: ${c.value}`))}
      <p className="cv-disclaimer">{d.disclaimer}</p>
    </article>
  );
}

function Resumen() {
  const [opciones, setOpciones] = useState<TrajectorySectionOption[]>([]);
  const [plantillas, setPlantillas] = useState<CvTemplateOption[]>([]);
  const [plantilla, setPlantilla] = useState<CvTemplateOption['key']>('classic');
  const [disclaimer, setDisclaimer] = useState('');
  const [elegidas, setElegidas] = useState<string[]>(['basic', 'bio', 'areas', 'projects', 'activities']);
  const [presentacion, setPresentacion] = useState('');
  /** Ejecución de IA aceptada de la que salió la presentación, si salió de una. */
  const [runId, setRunId] = useState<string | undefined>(undefined);
  const [modo, setModo] = useState<'improve' | 'summarize' | 'alternatives'>('improve');
  const [vista, setVista] = useState<Record<string, any> | null>(null);
  const [cargando, setCargando] = useState(false);
  const [descargando, setDescargando] = useState(false);
  const toast = useToast();

  useEffect(() => {
    trajectoryService
      .sections()
      .then((r) => { setOpciones(r.sections); setDisclaimer(r.disclaimer); setPlantillas(r.templates ?? []); })
      .catch((e) => toast.error(apiError(e)));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const alternar = (key: string) =>
    setElegidas((prev) =>
      prev.includes(key) ? prev.filter((k) => k !== key) : [...prev, key]);

  const pedido = (): CvRequest => ({
    sections: elegidas,
    template: plantilla,
    summaryText: presentacion.trim() || undefined,
    summaryAiRunId: presentacion.trim() ? runId : undefined,
  });

  const previsualizar = async () => {
    setCargando(true);
    try {
      setVista(await trajectoryService.preview(pedido()));
    } catch (e) {
      toast.error(apiError(e));
    } finally {
      setCargando(false);
    }
  };

  const descargar = async () => {
    setDescargando(true);
    try {
      const { blob, filename } = await trajectoryService.pdf(pedido());
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
      <Card title="Plantilla">
        <div className="cv-templates" role="radiogroup" aria-label="Plantilla del CV">
          {plantillas.map((t) => (
            <button
              type="button"
              key={t.key}
              role="radio"
              aria-checked={plantilla === t.key}
              className={`cv-template cv-template-${t.key} ${plantilla === t.key ? 'on' : ''}`}
              onClick={() => { setPlantilla(t.key); setVista(null); }}
            >
              <span className="cv-template-sample" aria-hidden="true"><i /><i /><i /></span>
              <strong>{t.label}</strong>
              <small className="muted">{t.description}</small>
            </button>
          ))}
        </div>
      </Card>

      <Card title="Qué quieres incluir">
        <p className="muted" style={{ marginTop: 0 }}>
          Tú decides qué entra. Los datos básicos van siempre: un resumen sin nombre no es de nadie.
          Todo sale de lo registrado en Afinia; nada se agrega por su cuenta.
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
      </Card>

      {elegidas.includes('bio') && (
        <Card title="Presentación">
          <p className="muted" style={{ marginTop: 0 }}>
            Opcional. Si la dejas vacía se usa la biografía de tu perfil. Si pides ayuda, la propuesta
            no entra al CV hasta que la elijas, y luego puedes editarla.
          </p>
          <div className="field">
            <label htmlFor="cv-presentacion">Texto de presentación</label>
            <textarea
              id="cv-presentacion"
              rows={5}
              maxLength={1200}
              value={presentacion}
              onChange={(e) => setPresentacion(e.target.value)}
              placeholder="Estudiante de Ingeniería de Sistemas con interés en desarrollo web…"
            />
            <small className="muted">{presentacion.length}/1200</small>
          </div>
          <div className="flex" style={{ gap: '0.5rem', alignItems: 'center', flexWrap: 'wrap' }}>
            <select value={modo} onChange={(e) => setModo(e.target.value as typeof modo)} aria-label="Tipo de ayuda" style={{ maxWidth: 220 }}>
              <option value="improve">Mejorar redacción</option>
              <option value="summarize">Resumir</option>
              <option value="alternatives">Proponer alternativas</option>
            </select>
            <AiAssist
              task="CV_TEXT_ASSIST"
              label="Pedir ayuda de redacción"
              request={() => {
                if (presentacion.trim().length < 20) {
                  toast.error('Escribe al menos un par de oraciones para que la ayuda tenga de dónde partir.');
                  return null;
                }
                return { text: presentacion, mode: modo };
              }}
              render={(r) => <p style={{ margin: 0 }}>{(r.texts as string[])[0]}</p>}
              choices={(r) => r.texts as string[]}
              onUse={(r, id, i) => {
                setPresentacion((r.texts as string[])[i] ?? '');
                setRunId(id);
              }}
              useLabel="Usar esta"
            />
          </div>
        </Card>
      )}

      <Card>
        <div className="flex" style={{ gap: '0.6rem', flexWrap: 'wrap' }}>
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
          <CvPreview d={vista} />
        </Card>
      )}
    </>
  );
}
