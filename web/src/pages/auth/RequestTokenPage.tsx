import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { AnimatePresence, motion } from 'framer-motion';
import { FiAlertCircle, FiArrowRight, FiClock, FiInfo, FiMail, FiRefreshCw, FiSend } from 'react-icons/fi';
import { activationService } from '../../services';
import { apiError } from '../../api/client';
import { institutionalEmail } from '../../lib/validators';
import '../../login.css';

type Mode = 'activation' | 'reset';

const COPY: Record<Mode, { title: string; lead: string; cta: string; next: string }> = {
  activation: {
    title: 'Recibir el correo de activación',
    lead:
      'Escribe tu correo institucional. Si tu cuenta todavía no está activada, te '
      + 'enviaremos un enlace y un código nuevos para elegir tu contraseña.',
    cta: 'Enviarme el correo',
    next: '/activar',
  },
  reset: {
    title: 'Recuperar el acceso',
    lead:
      'Escribe tu correo institucional. Si hay una cuenta con ese correo, recibirás un '
      + 'enlace y un código para elegir una contraseña nueva.',
    cta: 'Enviarme el correo',
    next: '/restablecer',
  },
};

/** 125 → «2:05». */
function reloj(segundos: number): string {
  const m = Math.floor(segundos / 60);
  const s = segundos % 60;
  return `${m}:${String(s).padStart(2, '0')}`;
}

/**
 * Pide el correo de activación o de recuperación (§12, §13).
 *
 * La respuesta es la misma exista o no la cuenta: si cambiara, esta pantalla
 * serviría para averiguar qué correos están registrados. Por eso el aviso de
 * éxito está en condicional.
 *
 * Tras cada envío hay una espera antes de poder pedir otro, con su cuenta
 * atrás a la vista. Sin ella, pulsar «reenviar» diez veces seguidas mandaba
 * diez correos al mismo buzón, y eso es justo lo que lleva a Outlook a marcar
 * a Afinia como spam y a dejar de entregar sus correos a todo el mundo.
 */
export default function RequestTokenPage({ mode }: { mode: Mode }) {
  const copy = COPY[mode];
  const [email, setEmail] = useState('');
  const [sent, setSent] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [errorKey, setErrorKey] = useState(0);
  const [busy, setBusy] = useState(false);
  const [espera, setEspera] = useState(0);

  useEffect(() => {
    if (espera <= 0) return;
    const t = setTimeout(() => setEspera((s) => s - 1), 1000);
    return () => clearTimeout(t);
  }, [espera]);

  const enviar = async () => {
    setError(null);
    const value = email.trim().toLowerCase();
    const malo = institutionalEmail(value);
    if (malo) {
      setError(malo);
      setErrorKey((k) => k + 1);
      return;
    }
    setBusy(true);
    try {
      const res = mode === 'activation'
        ? await activationService.request(value)
        : await activationService.forgotPassword(value);
      setSent(res.message);
      setEspera(res.retryAfterSeconds ?? 120);
    } catch (err) {
      setError(apiError(err, 'No se pudo enviar la solicitud.'));
      setErrorKey((k) => k + 1);
    } finally {
      setBusy(false);
    }
  };

  const submit = (ev: React.FormEvent) => {
    ev.preventDefault();
    void enviar();
  };

  return (
    <div className="li">
      <motion.div
        className="li-card li-card-slim"
        initial={{ opacity: 0, y: 24, scale: 0.98 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
      >
        <div className="li-form">
          <div className="li-brand li-brand-dark">
            <img src="/afiniaapp2Login.png" alt="Afinia" className="li-logo-img" /> Afinia
          </div>

          <div className="head">
            <h1>{copy.title}</h1>
            <p>{copy.lead}</p>
          </div>

          <AnimatePresence>
            {error && (
              <motion.div
                className="li-alert"
                key={errorKey}
                initial={{ opacity: 0 }}
                animate={{ opacity: 1, x: [0, -8, 8, -5, 5, 0] }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.4 }}
              >
                ⚠ {error}
              </motion.div>
            )}
          </AnimatePresence>

          {sent ? (
            <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}>
              <div className="li-ok">
                <span className="ic"><FiSend size={18} /></span>
                <div>
                  <strong>Revisa tu correo</strong>
                  <p>{sent}</p>
                </div>
              </div>
              <div className="li-tip">
                <FiInfo /> El correo trae un botón y un código de 6 dígitos. Si no aparece en un par de
                minutos, busca en «Correo no deseado» o «Otros».
              </div>
              <Link className="li-btn" to={`${copy.next}?email=${encodeURIComponent(email.trim().toLowerCase())}`}>
                Ya tengo el código <FiArrowRight />
              </Link>
              <div className="li-resend">
                {espera > 0 ? (
                  <span><FiClock /> Podrás pedir otro en {reloj(espera)}</span>
                ) : (
                  <button type="button" className="li-link-btn" onClick={() => void enviar()} disabled={busy}>
                    <FiRefreshCw /> Volver a enviar
                  </button>
                )}
              </div>
            </motion.div>
          ) : (
            <form onSubmit={submit} noValidate>
              <div className="li-field">
                <span className="field-label" id="request-token-page-correo-institucional">Correo institucional</span>
                <div role="group" aria-labelledby="request-token-page-correo-institucional" className={`li-input-wrap ${error ? 'bad' : ''}`}>
                  <input
                    type="email"
                    value={email}
                    onChange={(e) => { setEmail(e.target.value); setError(null); }}
                    placeholder="nombre.apellido@est.univalle.edu"
                    maxLength={160}
                    autoComplete="email"
                  />
                  <span className="ic"><FiMail /></span>
                </div>
                {!error && (
                  <div className="li-err" style={{ color: '#9a8a8f' }}>
                    <FiAlertCircle /> Solo enviamos a correos @univalle.edu y @est.univalle.edu.
                  </div>
                )}
              </div>

              <motion.button className="li-btn" disabled={busy} whileTap={{ scale: 0.98 }}>
                {busy ? <><span className="li-spin" /> Enviando…</> : <>{copy.cta} <FiArrowRight /></>}
              </motion.button>
            </form>
          )}

          <div className="li-back"><Link to="/login">← Volver a iniciar sesión</Link></div>
        </div>
      </motion.div>
    </div>
  );
}
