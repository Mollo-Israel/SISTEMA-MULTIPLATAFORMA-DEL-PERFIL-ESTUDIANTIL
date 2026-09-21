import { useState } from 'react';
import { Link } from 'react-router-dom';
import { AnimatePresence, motion } from 'framer-motion';
import { FiAlertCircle, FiArrowRight, FiMail, FiSend } from 'react-icons/fi';
import { activationService } from '../../services';
import { apiError } from '../../api/client';
import '../../login.css';

type Mode = 'activation' | 'reset';

const COPY: Record<Mode, { title: string; lead: string; cta: string; next: string }> = {
  activation: {
    title: 'Reenviar enlace de activación',
    lead:
      'Si tu cuenta existe y todavía está pendiente de activación, te enviaremos '
      + 'un enlace nuevo a tu correo institucional.',
    cta: 'Enviarme el enlace',
    next: '/activar',
  },
  reset: {
    title: 'Recuperar el acceso',
    lead:
      'Indica tu correo institucional. Si hay una cuenta asociada, recibirás un '
      + 'enlace para definir una contraseña nueva.',
    cta: 'Enviarme el enlace',
    next: '/restablecer',
  },
};

/**
 * Solicita un token por correo, para activar o para recuperar (§12, §13).
 *
 * La respuesta es siempre la misma exista o no la cuenta: si cambiara, esta
 * pantalla se convertiría en un verificador de qué correos están registrados.
 * Por eso el mensaje de éxito está redactado en condicional.
 */
export default function RequestTokenPage({ mode }: { mode: Mode }) {
  const copy = COPY[mode];
  const [email, setEmail] = useState('');
  const [sent, setSent] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [errorKey, setErrorKey] = useState(0);
  const [busy, setBusy] = useState(false);

  const submit = async (ev: React.FormEvent) => {
    ev.preventDefault();
    setError(null);
    const value = email.trim().toLowerCase();
    if (!value) {
      setError('Escribe tu correo institucional.');
      setErrorKey((k) => k + 1);
      return;
    }
    setBusy(true);
    try {
      const res = mode === 'activation'
        ? await activationService.request(value)
        : await activationService.forgotPassword(value);
      setSent(res.message);
    } catch (err) {
      setError(apiError(err, 'No se pudo enviar la solicitud.'));
      setErrorKey((k) => k + 1);
    } finally {
      setBusy(false);
    }
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
                  <strong>Solicitud enviada</strong>
                  <p>{sent}</p>
                </div>
              </div>
              <Link className="li-btn" to={copy.next}>
                Ya tengo el código <FiArrowRight />
              </Link>
            </motion.div>
          ) : (
            <form onSubmit={submit} noValidate>
              <div className="li-field">
                <label>Correo institucional</label>
                <div className={`li-input-wrap ${error ? 'bad' : ''}`}>
                  <input
                    type="email"
                    value={email}
                    onChange={(e) => { setEmail(e.target.value); setError(null); }}
                    placeholder="nombre.apellido@univalle.edu"
                    maxLength={160}
                    autoComplete="email"
                  />
                  <span className="ic"><FiMail /></span>
                </div>
                {!error && (
                  <div className="li-err" style={{ color: '#9a8a8f' }}>
                    <FiAlertCircle /> Por seguridad, la respuesta es la misma exista o no la cuenta.
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
