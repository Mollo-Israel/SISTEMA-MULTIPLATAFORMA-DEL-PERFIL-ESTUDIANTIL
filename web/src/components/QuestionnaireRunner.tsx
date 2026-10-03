import { useEffect, useMemo, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { FiArrowLeft, FiArrowRight, FiCheck, FiCheckCircle, FiCompass, FiStar } from 'react-icons/fi';
import { apiError } from '../api/client';
import { onboardingService } from '../services';
import type { OnboardingQuestion, OnboardingRun, Questionnaire } from '../services/types';
import { areaVisual } from '../lib/areaIcons';
import { useToast } from './feedback';
import '../welcome.css';

type Respuestas = Record<string, string[]>;

/**
 * El cuestionario de orientación, una pregunta por pantalla.
 *
 * Es opcional y se puede dejar a medias: a partir del mínimo que fija la API
 * aparece «Terminar aquí», y las sugerencias se calculan con lo respondido.
 * Al final el estudiante elige cuáles de las áreas sugeridas quiere sumar a
 * sus intereses; responder no añade nada por sí solo (§16).
 */
export default function QuestionnaireRunner({
  onFinished,
  onCancel,
  cancelLabel = 'Salir del cuestionario',
}: {
  onFinished: (resultado: { confirmed: number; run: OnboardingRun }) => void;
  onCancel?: () => void;
  cancelLabel?: string;
}) {
  const [questionnaire, setQuestionnaire] = useState<Questionnaire | null>(null);
  const [cargando, setCargando] = useState(true);
  const [indice, setIndice] = useState(0);
  const [dir, setDir] = useState(1);
  const [respuestas, setRespuestas] = useState<Respuestas>({});
  const [enviando, setEnviando] = useState(false);
  const [run, setRun] = useState<OnboardingRun | null>(null);
  const [elegidas, setElegidas] = useState<string[]>([]);
  const [confirmando, setConfirmando] = useState(false);
  const toast = useToast();

  useEffect(() => {
    onboardingService
      .questionnaire()
      .then(setQuestionnaire)
      .catch((e) => toast.error(apiError(e)))
      .finally(() => setCargando(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const preguntas = questionnaire?.questions ?? [];
  const minimo = questionnaire?.minAnswers ?? preguntas.length;
  const pregunta: OnboardingQuestion | undefined = preguntas[indice];
  const respondidas = useMemo(
    () => preguntas.filter((q) => (respuestas[q.code] ?? []).length > 0).length,
    [preguntas, respuestas],
  );
  const actual = pregunta ? respuestas[pregunta.code] ?? [] : [];

  const ir = (n: number) => {
    setDir(n > indice ? 1 : -1);
    setIndice(Math.max(0, Math.min(n, preguntas.length - 1)));
  };

  const elegir = (q: OnboardingQuestion, code: string) => {
    setRespuestas((prev) => {
      const ya = prev[q.code] ?? [];
      if (q.type === 'single') return { ...prev, [q.code]: [code] };
      if (ya.includes(code)) return { ...prev, [q.code]: ya.filter((c) => c !== code) };
      const tope = q.maxChoices ?? q.options.length;
      return ya.length >= tope ? prev : { ...prev, [q.code]: [...ya, code] };
    });
    // Las de una sola respuesta avanzan solas: pulsar «Siguiente» después de
    // elegir es un paso que no aporta nada.
    if (q.type === 'single' && indice < preguntas.length - 1) {
      setTimeout(() => ir(indice + 1), 260);
    }
  };

  const enviar = async () => {
    setEnviando(true);
    try {
      const r = await onboardingService.submit(
        preguntas
          .filter((q) => (respuestas[q.code] ?? []).length > 0)
          .map((q) => ({ questionCode: q.code, optionCodes: respuestas[q.code] })),
      );
      setRun(r);
      setElegidas(r.suggestedAreas.map((a) => a.academicAreaId));
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
      await onboardingService.confirm(run.id, elegidas);
      onFinished({ confirmed: elegidas.length, run });
    } catch (e) {
      toast.error(apiError(e));
    } finally {
      setConfirmando(false);
    }
  };

  if (cargando) {
    return (
      <div className="qz-loading">
        <span className="qz-spinner" /> Preparando tus preguntas…
      </div>
    );
  }

  // ------------------------------------------------------------ sugerencias
  if (run) {
    return (
      <motion.div className="qz-result" initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }}>
        <div className="qz-result-head">
          <span className="qz-badge"><FiStar /></span>
          <div>
            <h3>{run.suggestedAreas.length > 0 ? 'Esto es lo que vemos en tus respuestas' : 'Gracias por responder'}</h3>
            <p>
              {run.suggestedAreas.length > 0
                ? 'Marca las áreas que quieras sumar a tus intereses. Puedes cambiarlas cuando quieras.'
                : 'No encontramos áreas que sugerirte esta vez. Tus intereses declarados siguen igual.'}
            </p>
          </div>
        </div>
        <div className="qz-suggestions">
          {run.suggestedAreas.map((a, i) => {
            const on = elegidas.includes(a.academicAreaId);
            const { icono: Icono, color } = areaVisual(a.name);
            return (
              <motion.button
                type="button"
                key={a.academicAreaId}
                className={`qz-sugg ${on ? 'on' : ''}`}
                onClick={() =>
                  setElegidas((prev) =>
                    prev.includes(a.academicAreaId)
                      ? prev.filter((x) => x !== a.academicAreaId)
                      : [...prev, a.academicAreaId],
                  )
                }
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.06 }}
                aria-pressed={on}
              >
                <span className="ico" style={{ background: `${color}1a`, color }}><Icono /></span>
                <span className="nm">{a.name}</span>
                <span className="chk">{on && <FiCheck size={13} />}</span>
              </motion.button>
            );
          })}
        </div>
        <div className="qz-actions">
          <button type="button" className="wz-btn" onClick={confirmar} disabled={confirmando}>
            {confirmando ? 'Guardando…' : run.suggestedAreas.length > 0 ? 'Guardar y continuar' : 'Continuar'}
            <FiArrowRight />
          </button>
        </div>
      </motion.div>
    );
  }

  if (!pregunta) return null;

  // ---------------------------------------------------------------- pregunta
  return (
    <div className="qz">
      <div className="qz-top">
        <span className="qz-count">
          <FiCompass /> Pregunta {indice + 1} de {preguntas.length}
        </span>
        <div className="qz-bar" aria-hidden>
          <motion.span animate={{ width: `${(respondidas / preguntas.length) * 100}%` }} transition={{ duration: 0.3 }} />
        </div>
      </div>
      {questionnaire?.basedOn && questionnaire.basedOn.length > 0 && indice === 0 && (
        <p className="qz-based">
          Las primeras preguntas parten de lo que ya nos contaste: {questionnaire.basedOn.join(', ')}.
        </p>
      )}

      <AnimatePresence mode="wait" custom={dir}>
        <motion.div
          key={pregunta.code}
          custom={dir}
          initial={{ opacity: 0, x: 28 * dir }}
          animate={{ opacity: 1, x: 0 }}
          exit={{ opacity: 0, x: -28 * dir }}
          transition={{ duration: 0.22, ease: 'easeOut' }}
        >
          <h3 className="qz-q">{pregunta.text}</h3>
          <p className="qz-help">
            {pregunta.help ?? (pregunta.type === 'single' ? 'Elige una.' : 'Puedes elegir varias.')}
          </p>
          <div className="qz-options">
            {pregunta.options.map((o) => {
              const on = actual.includes(o.code);
              return (
                <button
                  type="button"
                  key={o.code}
                  className={`qz-opt ${on ? 'on' : ''}`}
                  onClick={() => elegir(pregunta, o.code)}
                  aria-pressed={on}
                >
                  <span className={`qz-mark ${pregunta.type}`}>{on && <FiCheck size={12} />}</span>
                  {o.label}
                </button>
              );
            })}
          </div>
        </motion.div>
      </AnimatePresence>

      <div className="qz-nav">
        <button type="button" className="wz-btn ghost" onClick={() => (indice === 0 ? onCancel?.() : ir(indice - 1))}>
          <FiArrowLeft /> {indice === 0 ? cancelLabel : 'Anterior'}
        </button>
        <div className="qz-nav-right">
          {respondidas >= minimo && indice < preguntas.length - 1 && (
            <button type="button" className="wz-btn soft" onClick={enviar} disabled={enviando}>
              <FiCheckCircle /> Terminar aquí
            </button>
          )}
          {indice < preguntas.length - 1 ? (
            <button type="button" className="wz-btn" onClick={() => ir(indice + 1)}>
              {actual.length > 0 ? 'Siguiente' : 'Saltar pregunta'} <FiArrowRight />
            </button>
          ) : (
            <button
              type="button"
              className="wz-btn"
              onClick={enviar}
              disabled={enviando || respondidas < minimo}
              title={respondidas < minimo ? `Responde al menos ${minimo} preguntas` : undefined}
            >
              {enviando ? 'Calculando…' : 'Ver mis resultados'} <FiArrowRight />
            </button>
          )}
        </div>
      </div>
      {indice === preguntas.length - 1 && respondidas < minimo && (
        <p className="qz-min">Responde al menos {minimo} preguntas para ver resultados (llevas {respondidas}).</p>
      )}
    </div>
  );
}
