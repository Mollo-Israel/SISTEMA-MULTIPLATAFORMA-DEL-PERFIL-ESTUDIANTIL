import { useSearchParams } from 'react-router-dom';
import { useEffect, useState } from 'react';
import {
  FiArrowDown, FiArrowUp, FiAward, FiCheckCircle, FiDownload, FiFileText, FiGift, FiInfo,
} from 'react-icons/fi';
import { apiError } from '../../api/client';
import {
  gamificationService,
  trajectoryService,
  type CvItemsSection,
  type CvRequest,
  type CvSectionOption,
  type CvTemplateOption,
  type TrajectoryEntry,
  type TrajectoryHistory,
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
  type Pestana = 'trayectoria' | 'progreso' | 'recompensas' | 'resumen';
  const tab: Pestana = (['trayectoria', 'progreso', 'recompensas', 'resumen'] as string[]).includes(pedida ?? '') ? (pedida as Pestana) : 'trayectoria';
  const setTab = (k: Pestana) => setParams(k === 'trayectoria' ? {} : { tab: k }, { replace: true });

  return (
    <div>
      <PageHeader
        title="Mi progreso"
        description="Tu trayectoria completa, tus puntos y el currículo que puedes llevarte."
      />
      <Tabs
        value={tab}
        onChange={(k) => setTab(k as Pestana)}
        items={[
          { key: 'trayectoria', label: 'Mi trayectoria' },
          { key: 'progreso', label: 'Puntos e insignias' },
          { key: 'recompensas', label: 'Recompensas' },
          { key: 'resumen', label: 'Currículo' },
        ]}
      />
      {tab === 'trayectoria' ? <Trayectoria /> : tab === 'progreso' ? <Progreso /> : tab === 'recompensas' ? <Recompensas /> : <Resumen />}
    </div>
  );
}

// ---------------------------------------------------------------------------
// V3 §42 · Mi trayectoria
// ---------------------------------------------------------------------------

const TONO_NIVEL: Record<string, string> = {
  declared: 'gray', supported: 'blue', corroborated: 'green', reviewed: 'bordo', incomplete: 'amber',
};
const TIPO_ENTRADA: Record<TrajectoryEntry['kind'], string> = {
  project: 'Proyecto',
  activity: 'Actividad interna',
  external_opportunity: 'Oportunidad externa',
  constancy: 'Constancia',
  credential: 'Credencial externa',
  team: 'Equipo',
  feedback: 'Retroalimentación',
};

/**
 * Todo lo que el estudiante hizo, con el nivel de cada cosa en palabras
 * (V3 §42). Incluye lo que no entra al currículo, para que sepa qué le falta.
 */
function Trayectoria() {
  const state = useAsync(() => trajectoryService.history(), []);
  const [filtro, setFiltro] = useState<string>('todos');
  return (
    <AsyncView loading={state.loading} error={state.error} data={state.data} skeleton={<SkeletonCards count={3} />}>
      {(h: TrajectoryHistory) => {
        const entradas = filtro === 'todos' ? h.entries : h.entries.filter((e) => e.level === filtro);
        return (
          <>
            <Card title="Cómo leer tu trayectoria">
              <ul className="nivel-leyenda">
                {h.levels.map((l) => (
                  <li key={l.key}>
                    <Badge tone={TONO_NIVEL[l.key]}>{l.label}</Badge> <span className="muted">{l.explain}</span>
                  </li>
                ))}
              </ul>
            </Card>
            <Card title="Histórico">
              <div className="chip-row" role="group" aria-label="Filtrar por nivel">
                <button type="button" className={`chip ${filtro === 'todos' ? 'on' : ''}`} aria-pressed={filtro === 'todos'} onClick={() => setFiltro('todos')}>
                  Todo ({h.entries.length})
                </button>
                {h.levels.map((l) => (
                  <button key={l.key} type="button" className={`chip ${filtro === l.key ? 'on' : ''}`} aria-pressed={filtro === l.key} onClick={() => setFiltro(l.key)}>
                    {l.label} ({l.count})
                  </button>
                ))}
              </div>
              {entradas.length === 0 ? (
                <EmptyState message={h.entries.length === 0
                  ? 'Todavía no hay nada en tu trayectoria. Inscríbete a una actividad o registra un proyecto.'
                  : 'Nada en este nivel.'}
                />
              ) : (
                <ul className="trayectoria-lista">
                  {entradas.map((e) => (
                    <li key={`${e.kind}-${e.id}`}>
                      <div className="flex between" style={{ gap: '0.5rem', flexWrap: 'wrap' }}>
                        <span>
                          <span className="muted">{TIPO_ENTRADA[e.kind]} · </span>
                          <strong>{e.title}</strong>
                        </span>
                        <span className="flex" style={{ gap: '0.35rem' }}>
                          {e.levelLabel && <Badge tone={TONO_NIVEL[e.level ?? 'declared']}>{e.levelLabel}</Badge>}
                          {e.cvEligible && <Badge tone="green"><FiCheckCircle size={11} /> Puede ir al currículo</Badge>}
                        </span>
                      </div>
                      <p className="muted" style={{ margin: '0.2rem 0 0' }}>
                        {e.date ? `${FECHA(e.date)} · ` : ''}{e.detail}
                      </p>
                    </li>
                  ))}
                </ul>
              )}
            </Card>
            {h.evolution.length > 0 && (
              <Card title="Evolución por área">
                <p className="muted" style={{ marginTop: 0 }}>Afinidad y respaldo actuales. El historial completo está en «Afinidad».</p>
                <ul className="plain-list">
                  {h.evolution.map((a, i) => (
                    <li key={i}>
                      <strong>{a.area}</strong> · afinidad {Math.round(a.score)}/100
                      {a.supportScore !== null ? ` · respaldo ${Math.round(a.supportScore)}/100` : ''}
                    </li>
                  ))}
                </ul>
              </Card>
            )}
          </>
        );
      }}
    </AsyncView>
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
            <div className="table-scroll">
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

/** V3 §44: la constancia va en la misma línea de la actividad. */
const actividadCv = (a: any) =>
  `Participación confirmada en ${a.title}${a.date ? ` (${FECHA(a.date)})` : ''}${a.constancy ? ' · Constancia interna disponible' : ''}`;

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
                <strong>{p.title}</strong> — {p.role}{p.level ? <span className="muted"> · {p.level}</span> : null}
                {p.contribution && <div>Contribución: {p.contribution}</div>}
                {(p.technologies ?? []).length > 0 && <div className="muted">Tecnologías: {p.technologies.join(', ')}</div>}
              </li>
            ))}
          </ul>
        </section>
      )}
      {(d.skills ?? []).length > 0 && (
        <section><h4>Habilidades respaldadas</h4><p>{d.skills.map((x: any) => x.name).join(' · ')}</p></section>
      )}
      {lista('Actividades con participación confirmada', (d.activities ?? []).map(actividadCv))}
      {lista('Actividades académicas internas', (d.academicActivities ?? []).map(actividadCv))}
      {lista('Actividades extracurriculares internas', (d.extracurricularActivities ?? []).map(actividadCv))}
      {lista('Credenciales y cursos externos', (d.certificates ?? []).map((c: any) => `${c.name} — ${c.issuer}`))}
      {lista('Constancias internas', (d.constancies ?? []).map((c: any) => c.description))}
      {lista('Evidencias', (d.evidences ?? []).map((e: any) => (e.context ? `${e.description ?? 'Evidencia'} — ${e.context}` : e.description)))}
      {lista('Insignias de Afinia', (d.badges ?? []).map((b: any) => `${b.name} (${FECHA(b.awardedAt)})`))}
      {lista('Contacto', (d.contact ?? []).map((c: any) => `${c.label}: ${c.value}`))}
      <p className="cv-disclaimer">{d.disclaimer}</p>
    </article>
  );
}

function Resumen() {
  const [opciones, setOpciones] = useState<CvSectionOption[]>([]);
  const [plantillas, setPlantillas] = useState<CvTemplateOption[]>([]);
  const [plantilla, setPlantilla] = useState<CvTemplateOption['key']>('classic');
  const [disclaimer, setDisclaimer] = useState('');
  /** Paso 1 (V3 §43.1): secciones marcadas. */
  const [elegidas, setElegidas] = useState<string[]>(['bio', 'projects', 'academic_activities', 'extracurricular_activities', 'certificates']);
  /** Paso 2 (V3 §43.2): ítems elegibles por sección y los marcados, en orden. */
  const [disponibles, setDisponibles] = useState<CvItemsSection[]>([]);
  const [marcados, setMarcados] = useState<Record<string, string[]>>({});
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
      .then((r) => { setOpciones(r.cvSections ?? []); setDisclaimer(r.disclaimer); setPlantillas(r.templates ?? []); })
      .catch((e) => toast.error(apiError(e)));
    trajectoryService
      .items()
      .then((r) => {
        setDisponibles(r.sections);
        // Por omisión, todo lo elegible queda marcado: el estudiante quita, no busca.
        setMarcados(Object.fromEntries(r.sections.map((s) => [s.key, s.items.map((i) => i.id)])));
      })
      .catch((e) => toast.error(apiError(e)));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const alternarSeccion = (key: string) => {
    setVista(null);
    setElegidas((prev) => (prev.includes(key) ? prev.filter((k) => k !== key) : [...prev, key]));
  };
  const alternarItem = (seccion: string, id: string) => {
    setVista(null);
    setMarcados((prev) => {
      const actual = prev[seccion] ?? [];
      return { ...prev, [seccion]: actual.includes(id) ? actual.filter((x) => x !== id) : [...actual, id] };
    });
  };
  /** V3 §43.4: cambiar el orden permitido, nunca los hechos. */
  const mover = (seccion: string, id: string, paso: -1 | 1) => {
    setVista(null);
    setMarcados((prev) => {
      const lista = [...(prev[seccion] ?? [])];
      const i = lista.indexOf(id);
      const j = i + paso;
      if (i < 0 || j < 0 || j >= lista.length) return prev;
      [lista[i], lista[j]] = [lista[j], lista[i]];
      return { ...prev, [seccion]: lista };
    });
  };

  const pedido = (): CvRequest => {
    const conItems = new Set(opciones.filter((o) => o.hasItems).map((o) => o.key));
    const items: Record<string, string[]> = {};
    for (const k of elegidas) if (conItems.has(k)) items[k] = marcados[k] ?? [];
    return {
      // Los datos básicos van siempre; con proyectos, su rol y contribución confirmada.
      sections: ['basic', ...elegidas, ...(elegidas.includes('projects') ? ['contributions'] : [])],
      template: plantilla,
      summaryText: presentacion.trim() || undefined,
      summaryAiRunId: presentacion.trim() ? runId : undefined,
      items,
    };
  };

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

  const seccionesConItems = disponibles.filter((d) => elegidas.includes(d.key));

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

      <Card title="Paso 1 · Qué secciones incluir">
        <p className="muted" style={{ marginTop: 0 }}>
          Tu nombre, semestre y carrera van siempre. Todo sale de lo registrado y respaldado en Afinia;
          nada se agrega por su cuenta.
        </p>
        <ul className="cv-pasos">
          {opciones.map((o) => (
            <li key={o.key}>
              <label>
                <input type="checkbox" checked={elegidas.includes(o.key)} onChange={() => alternarSeccion(o.key)} />
                {o.label}
              </label>
            </li>
          ))}
        </ul>
      </Card>

      {seccionesConItems.length > 0 && (
        <Card title="Paso 2 · Qué ítems de cada sección">
          <p className="muted" style={{ marginTop: 0 }}>
            Solo aparecen los elegibles para un currículo verificado. Lo demás sigue en «Mi trayectoria».
            Puedes cambiar el orden con las flechas.
          </p>
          {seccionesConItems.map((sec) => {
            const orden = marcados[sec.key] ?? [];
            // Los marcados primero, en su orden; luego los desmarcados.
            const lista = [
              ...orden.map((id) => sec.items.find((i) => i.id === id)).filter((x): x is CvItemsSection['items'][number] => !!x),
              ...sec.items.filter((i) => !orden.includes(i.id)),
            ];
            return (
              <fieldset key={sec.key} className="field">
                <legend>{sec.label}</legend>
                {lista.length === 0 && <p className="muted" style={{ margin: 0 }}>Todavía no hay ítems elegibles.</p>}
                {lista.map((it) => {
                  const on = orden.includes(it.id);
                  const pos = orden.indexOf(it.id);
                  return (
                    <div key={it.id} className="cv-item">
                      <label>
                        <input type="checkbox" checked={on} onChange={() => alternarItem(sec.key, it.id)} />
                        <span>
                          {it.title}
                          {it.detail && <span className="detalle">{it.detail}</span>}
                        </span>
                      </label>
                      {on && orden.length > 1 && (
                        <span className="cv-orden">
                          <button type="button" aria-label={`Subir «${it.title}»`} disabled={pos === 0} onClick={() => mover(sec.key, it.id, -1)}>
                            <FiArrowUp size={13} />
                          </button>
                          <button type="button" aria-label={`Bajar «${it.title}»`} disabled={pos === orden.length - 1} onClick={() => mover(sec.key, it.id, 1)}>
                            <FiArrowDown size={13} />
                          </button>
                        </span>
                      )}
                    </div>
                  );
                })}
                {sec.excluded && (
                  <p className="inline-note mt"><FiInfo size={13} /> {sec.excluded.count} fuera: {sec.excluded.reason}</p>
                )}
              </fieldset>
            );
          })}
        </Card>
      )}

      {elegidas.includes('bio') && (
        <Card title="Presentación">
          <p className="muted" style={{ marginTop: 0 }}>
            Opcional. Si la dejas vacía se usa la biografía de tu perfil. Si pides ayuda, la propuesta
            no entra al CV hasta que la elijas, y luego puedes editarla. La ayuda mejora la redacción;
            nunca agrega cargos, tecnologías, actividades, certificados ni fechas.
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
