import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { AnimatePresence, motion } from 'framer-motion';
import {
  FiArrowLeft, FiArrowRight, FiCheck, FiCheckCircle, FiCompass, FiRefreshCw,
} from 'react-icons/fi';
import { apiError } from '../../api/client';
import { onboardingService } from '../../services';
import { useToast } from '../../components/feedback';
import {
  Badge, Button, Card, EmptyState, PageHeader, ProgressBar, SkeletonCards,
} from '../../components/ui';
import type { OnboardingQuestion, OnboardingRun, Questionnaire } from '../../services/types';

type Respuestas = Record<string, string[]>;

/**
 * Cuestionario Inicial de Orientación Académica (§16).
 *
 * Orienta preferencias; no evalúa conocimiento. Por eso no hay respuestas
 * correctas, no se puntúa y lo que produce son sugerencias que el estudiante
 * acepta o descarta: hasta que confirma, no existe ningún interés.
 */
export default function StudentOnboardingPage() {
  const toast = useToast();
  const navigate = useNavigate();

  const [questionnaire, setQuestionnaire] = useState<Questionnaire | null>(null);
  const [run, setRun] = useState<OnboardingRun | null>(null);
  const [pendiente, setPendiente] = useState(false);
  const [loading, setLoading] = useState(true);

  const [respondiendo, setRespondiendo] = useState(false);
  const [indice, setIndice] = useState(0);
  const [respuestas, setRespuestas] = useState<Respuestas>({});
  const [enviando, setEnviando] = useState(false);

  const [elegidas, setElegidas] = useState<string[]>([]);
  const [confirmando, setConfirmando] = useState(false);

  useEffect(() => {
    Promise.all([onboardingService.questionnaire(), onboardingService.current()])
      .then(([q, actual]) => {
        setQuestionnaire(q);
        setRun(actual.run);
        setPendiente(actual.pendingConfirmation);
        if (actual.run && actual.pendingConfirmation) {
          setElegidas(actual.run.suggestedAreas.map((a) => a.academicAreaId));
        }
      })
      .catch((e) => toast.error(apiError(e)))
      .finally(() => setLoading(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const preguntas = questionnaire?.questions ?? [];
  const pregunta: OnboardingQuestion | undefined = preguntas[indice];
  const respondidas = useMemo(
    () => preguntas.filter((q) => (respuestas[q.code] ?? []).length > 0).length,
    [preguntas, respuestas],
  );
  const actualRespondida = pregunta ? (respuestas[pregunta.code] ?? []).length > 0 : false;
  const completo = preguntas.length > 0 && respondidas === preguntas.length;

  const elegir = (q: OnboardingQuestion, code: string) => {
    setRespuestas((prev) => {
      const actuales = prev[q.code] ?? [];
      if (q.type === 'single') return { ...prev, [q.code]: [code] };

      if (actuales.includes(code)) {
        return { ...prev, [q.code]: actuales.filter((c) => c !== code) };
      }
      const tope = q.maxChoices ?? q.options.length;
      if (actuales.length >= tope) {
        toast.info(`Puedes elegir hasta ${tope} opciones.`);
        return prev;
      }
      return { ...prev, [q.code]: [...actuales, code] };
    });
  };

  // Avanza sola en las preguntas de una sola respuesta: obligar a pulsar
  // «siguiente» tras cada clic alarga un cuestionario que debe ser rapido.
  const elegirYAvanzar = (q: OnboardingQuestion, code: string) => {
    elegir(q, code);
    if (q.type === 'single' && indice < preguntas.length - 1) {
      setTimeout(() => setIndice((i) => Math.min(i + 1, preguntas.length - 1)), 220);
    }
  };

  const enviar = async () => {
    setEnviando(true);
    try {
      const resultado = await onboardingService.submit(
        preguntas.map((q) => ({ questionCode: q.code, optionCodes: respuestas[q.code] ?? [] })),
      );
      setRun(resultado);
      setPendiente(true);
      setElegidas(resultado.suggestedAreas.map((a) => a.academicAreaId));
      setRespondiendo(false);
      toast.success('Cuestionario completado.', resultado.message);
    } catch (e) {
      toast.error(apiError(e));
    } finally {
      setEnviando(false);
    }
  };

  const confirmar = async () => {
    if (!run) return;
    setConfirmando(true);
    try {
      const res = await onboardingService.confirm(run.id, elegidas);
      toast.success('Intereses actualizados.', res.message);
      const actual = await onboardingService.current();
      setRun(actual.run);
      setPendiente(actual.pendingConfirmation);
      if (elegidas.length > 0) navigate('/student/interests');
    } catch (e) {
      toast.error(apiError(e));
    } finally {
      setConfirmando(false);
    }
  };

  const empezar = () => {
    setRespuestas({});
    setIndice(0);
    setRespondiendo(true);
  };

  if (loading) {
    return (
      <div>
        <PageHeader title="Orientación académica" description="Cargando el cuestionario…" />
        <Card><SkeletonCards count={3} /></Card>
      </div>
    );
  }

  return (
    <div>
      <PageHeader
        title="Orientación académica"
        description="Un cuestionario corto para orientar tus preferencias. No evalúa conocimiento y no hay respuestas correctas."
      />

      {/* ---------------------------------------------------------------- */}
      {respondiendo && pregunta && (
        <Card
          title={`Pregunta ${indice + 1} de ${preguntas.length}`}
          actions={<Badge tone="bordo">{respondidas} respondidas</Badge>}
        >
          <ProgressBar
            value={Math.round((respondidas / preguntas.length) * 100)}
            label="Avance del cuestionario"
          />

          <AnimatePresence mode="wait">
            <motion.div
              key={pregunta.code}
              initial={{ opacity: 0, x: 24 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -24 }}
              transition={{ duration: 0.22 }}
            >
              <h3 className="onb-pregunta">{pregunta.text}</h3>
              {pregunta.help && <p className="muted onb-ayuda">{pregunta.help}</p>}

              <div className="onb-opciones">
                {pregunta.options.map((o) => {
                  const marcada = (respuestas[pregunta.code] ?? []).includes(o.code);
                  return (
                    <button
                      type="button"
                      key={o.code}
                      className={`onb-opcion ${marcada ? 'on' : ''}`}
                      onClick={() => elegirYAvanzar(pregunta, o.code)}
                      aria-pressed={marcada}
                    >
                      <span className="chk">{marcada && <FiCheck size={13} />}</span>
                      <span>{o.label}</span>
                    </button>
                  );
                })}
              </div>
            </motion.div>
          </AnimatePresence>

          <div className="flex between mt" style={{ flexWrap: 'wrap', gap: '0.6rem' }}>
            <Button
              variant="ghost"
              onClick={() => setIndice((i) => Math.max(0, i - 1))}
              disabled={indice === 0}
              icon={<FiArrowLeft size={14} />}
            >
              Anterior
            </Button>

            {indice < preguntas.length - 1 ? (
              <Button
                onClick={() => setIndice((i) => i + 1)}
                disabled={!actualRespondida}
                icon={<FiArrowRight size={15} />}
              >
                Siguiente
              </Button>
            ) : (
              <Button onClick={enviar} loading={enviando} disabled={!completo} icon={<FiCompass size={15} />}>
                Ver mis áreas sugeridas
              </Button>
            )}
          </div>

          {!completo && indice === preguntas.length - 1 && (
            <p className="muted" style={{ marginTop: '0.6rem' }}>
              Faltan {preguntas.length - respondidas} pregunta(s) por responder.
            </p>
          )}
        </Card>
      )}

      {/* ---------------------------------------------------------------- */}
      {!respondiendo && pendiente && run && (
        <Card
          title="Áreas que sugiere tu cuestionario"
          actions={<Badge tone="amber">Pendiente de confirmar</Badge>}
        >
          <p className="muted" style={{ marginTop: 0 }}>
            Esto es una propuesta, no una decisión. Elige las que quieras incorporar como
            intereses; las demás no se guardan. Puedes cambiarlas cuando quieras desde
            «Intereses y habilidades».
          </p>

          {run.suggestedAreas.length === 0 ? (
            <EmptyState
              icon={<FiCompass size={22} />}
              message="El cuestionario no encontró áreas que sugerirte. Puedes elegir tus intereses directamente del catálogo."
              action={
                <Button variant="secondary" size="sm" onClick={() => navigate('/student/interests')}>
                  Ir al catálogo
                </Button>
              }
            />
          ) : (
            <>
              <div className="onb-sugeridas">
                {run.suggestedAreas.map((a, i) => {
                  const on = elegidas.includes(a.academicAreaId);
                  return (
                    <button
                      type="button"
                      key={a.academicAreaId}
                      className={`onb-sugerida ${on ? 'on' : ''}`}
                      onClick={() =>
                        setElegidas((prev) =>
                          (prev.includes(a.academicAreaId)
                            ? prev.filter((x) => x !== a.academicAreaId)
                            : [...prev, a.academicAreaId]))}
                      aria-pressed={on}
                    >
                      <span className="pos">{i + 1}</span>
                      <span className="nom">{a.name}</span>
                      <span className="chk">{on && <FiCheckCircle size={16} />}</span>
                    </button>
                  );
                })}
              </div>

              <div className="flex between mt" style={{ flexWrap: 'wrap', gap: '0.6rem' }}>
                <Button variant="ghost" size="sm" onClick={empezar} icon={<FiRefreshCw size={14} />}>
                  Responder de nuevo
                </Button>
                <Button onClick={confirmar} loading={confirmando} icon={<FiCheck size={15} />}>
                  {elegidas.length > 0
                    ? `Incorporar ${elegidas.length} área(s)`
                    : 'No incorporar ninguna'}
                </Button>
              </div>
            </>
          )}
        </Card>
      )}

      {/* ---------------------------------------------------------------- */}
      {!respondiendo && !pendiente && (
        <Card title={run ? 'Tu orientación' : 'Aún no has respondido'}>
          {run ? (
            <>
              <div className="flex" style={{ gap: '0.5rem', flexWrap: 'wrap', marginBottom: '0.8rem' }}>
                <Badge tone="green">Confirmado</Badge>
                <Badge tone="gray">Versión {run.version}</Badge>
                <Badge tone="gray">
                  {new Date(run.confirmedAt ?? run.createdAt).toLocaleDateString('es-BO')}
                </Badge>
              </div>
              <p className="muted" style={{ marginTop: 0 }}>
                Incorporaste {run.confirmedAreaIds.length} de {run.suggestedAreas.length} área(s)
                sugeridas. El cuestionario puede repetirse cuando tus intereses cambien: tus
                respuestas anteriores se conservan.
              </p>
              <div className="onb-sugeridas" style={{ marginTop: '0.8rem' }}>
                {run.suggestedAreas.map((a) => (
                  <div
                    key={a.academicAreaId}
                    className={`onb-sugerida ${run.confirmedAreaIds.includes(a.academicAreaId) ? 'on' : 'off'}`}
                  >
                    <span className="nom">{a.name}</span>
                    <span className="chk">
                      {run.confirmedAreaIds.includes(a.academicAreaId)
                        ? <FiCheckCircle size={16} />
                        : <span className="muted" style={{ fontSize: '0.72rem' }}>no incorporada</span>}
                    </span>
                  </div>
                ))}
              </div>
            </>
          ) : (
            <p className="muted" style={{ marginTop: 0 }}>
              Son {preguntas.length} preguntas cortas sobre lo que te gusta y cómo trabajas.
              No hay respuestas correctas y nadie más las ve.
            </p>
          )}

          <div className="mt">
            <Button onClick={empezar} icon={<FiCompass size={15} />}>
              {run ? 'Responder de nuevo' : 'Empezar el cuestionario'}
            </Button>
          </div>
        </Card>
      )}
    </div>
  );
}
