import { useMemo, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { AnimatePresence, motion } from 'framer-motion';
import {
  FiAlertCircle, FiArrowRight, FiCheck, FiCheckCircle, FiEye, FiEyeOff, FiKey, FiLock,
} from 'react-icons/fi';
import { activationService } from '../../services';
import { apiError } from '../../api/client';
import { passwordRequirements, passwordStrength, PASSWORD_MAX } from './passwordPolicy';
import '../../login.css';

type Mode = 'activate' | 'reset';

const COPY: Record<Mode, { title: string; lead: string; cta: string; done: string; doneLead: string }> = {
  activate: {
    title: 'Activa tu cuenta',
    lead:
      'Tu cuenta la creó la administración con tus datos institucionales. '
      + 'Define tu contraseña para empezar a usarla.',
    cta: 'Activar cuenta',
    done: 'Cuenta activada',
    doneLead: 'Ya puedes iniciar sesión con tu correo institucional y la contraseña que acabas de definir.',
  },
  reset: {
    title: 'Define una nueva contraseña',
    lead: 'Elige una contraseña nueva. Se cerrarán todas las sesiones abiertas de tu cuenta.',
    cta: 'Guardar contraseña',
    done: 'Contraseña actualizada',
    doneLead: 'Inicia sesión con tu nueva contraseña. Las sesiones anteriores quedaron cerradas.',
  },
};

/**
 * Pantalla compartida por la activación (§12) y la recuperación (§13).
 *
 * Ambas hacen exactamente lo mismo desde el punto de vista del usuario —canjear
 * un token de un solo uso por una contraseña— y solo cambian el endpoint y el
 * texto, así que comparten implementación en lugar de duplicarla.
 */
export default function SetPasswordPage({ mode }: { mode: Mode }) {
  const copy = COPY[mode];
  const navigate = useNavigate();
  const [params] = useSearchParams();

  // El token llega en el enlace del correo; se deja editable por si el usuario
  // tuvo que copiarlo a mano desde un cliente de correo que rompió el enlace.
  const [token, setToken] = useState(params.get('token') ?? '');
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [showPwd, setShowPwd] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [serverError, setServerError] = useState<string | null>(null);
  const [errorKey, setErrorKey] = useState(0);
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);

  const reqs = useMemo(() => passwordRequirements(password), [password]);
  const strength = passwordStrength(password);

  const submit = async (ev: React.FormEvent) => {
    ev.preventDefault();
    setServerError(null);

    const e: Record<string, string> = {};
    if (!token.trim()) e.token = 'Pega el código que recibiste por correo.';
    if (!reqs.every((r) => r.ok)) e.password = 'La contraseña no cumple los requisitos.';
    if (confirm !== password) e.confirm = 'Las contraseñas no coinciden.';
    setErrors(e);
    if (Object.keys(e).length) {
      setErrorKey((k) => k + 1);
      return;
    }

    setBusy(true);
    try {
      if (mode === 'activate') await activationService.activate(token.trim(), password);
      else await activationService.resetPassword(token.trim(), password);
      setDone(true);
    } catch (err) {
      setServerError(apiError(err, 'No se pudo completar la operación.'));
      setErrorKey((k) => k + 1);
    } finally {
      setBusy(false);
    }
  };

  const Err = ({ name }: { name: string }) =>
    errors[name] ? <div className="li-err"><FiAlertCircle /> {errors[name]}</div> : null;

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

          {done ? (
            <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}>
              <div className="li-done">
                <span className="ic"><FiCheckCircle size={30} /></span>
                <h1>{copy.done}</h1>
                <p>{copy.doneLead}</p>
              </div>
              <button className="li-btn" onClick={() => navigate('/login', { replace: true })}>
                Ir a iniciar sesión <FiArrowRight />
              </button>
            </motion.div>
          ) : (
            <>
              <div className="head">
                <h1>{copy.title}</h1>
                <p>{copy.lead}</p>
              </div>

              <AnimatePresence>
                {serverError && (
                  <motion.div
                    className="li-alert"
                    key={errorKey}
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1, x: [0, -8, 8, -5, 5, 0] }}
                    exit={{ opacity: 0 }}
                    transition={{ duration: 0.4 }}
                  >
                    ⚠ {serverError}
                  </motion.div>
                )}
              </AnimatePresence>

              <form onSubmit={submit} noValidate>
                <div className="li-field">
                  <label>Código del correo</label>
                  <div className={`li-input-wrap ${errors.token ? 'bad' : ''}`}>
                    <input
                      value={token}
                      onChange={(e) => { setToken(e.target.value); setErrors((x) => ({ ...x, token: '' })); }}
                      placeholder="Pega aquí el código del enlace"
                      autoComplete="off"
                      spellCheck={false}
                    />
                    <span className="ic"><FiKey /></span>
                  </div>
                  <Err name="token" />
                </div>

                <div className="li-field">
                  <label>Nueva contraseña</label>
                  <div className={`li-input-wrap ${errors.password ? 'bad' : ''}`}>
                    <input
                      type={showPwd ? 'text' : 'password'}
                      value={password}
                      onChange={(e) => { setPassword(e.target.value); setErrors((x) => ({ ...x, password: '' })); }}
                      placeholder="••••••••••••"
                      maxLength={PASSWORD_MAX}
                      autoComplete="new-password"
                    />
                    <span className="ic"><FiLock /></span>
                    <button
                      type="button"
                      className="li-eye"
                      onClick={() => setShowPwd((s) => !s)}
                      aria-label="Mostrar u ocultar contraseña"
                    >
                      {showPwd ? <FiEyeOff /> : <FiEye />}
                    </button>
                  </div>
                  <Err name="password" />
                  {password.length > 0 && (
                    <div className="li-strength" aria-hidden>
                      <motion.span
                        animate={{ width: `${strength}%` }}
                        transition={{ duration: 0.25 }}
                        data-level={strength >= 85 ? 'alta' : strength >= 55 ? 'media' : 'baja'}
                      />
                    </div>
                  )}
                  <ul className="li-reqs">
                    {reqs.map((r) => (
                      <li key={r.t} className={r.ok ? 'ok' : ''}>
                        {r.ok ? <FiCheck /> : <span style={{ width: 14 }}>•</span>} {r.t}
                      </li>
                    ))}
                  </ul>
                  <p className="li-hint">
                    No uses tu correo ni tu código universitario dentro de la contraseña.
                  </p>
                </div>

                <div className="li-field">
                  <label>Confirmar contraseña</label>
                  <div className={`li-input-wrap ${errors.confirm ? 'bad' : ''}`}>
                    <input
                      type={showPwd ? 'text' : 'password'}
                      value={confirm}
                      onChange={(e) => { setConfirm(e.target.value); setErrors((x) => ({ ...x, confirm: '' })); }}
                      placeholder="Repite la contraseña"
                      maxLength={PASSWORD_MAX}
                      autoComplete="new-password"
                    />
                    <span className="ic"><FiLock /></span>
                  </div>
                  <Err name="confirm" />
                </div>

                <motion.button className="li-btn" disabled={busy} whileTap={{ scale: 0.98 }}>
                  {busy ? <><span className="li-spin" /> Procesando…</> : <>{copy.cta} <FiArrowRight /></>}
                </motion.button>
              </form>

              <div className="li-switch">
                {mode === 'activate' ? '¿El código caducó? ' : '¿No recibiste el correo? '}
                <Link to={mode === 'activate' ? '/activar/solicitar' : '/recuperar'}>
                  Solicitar uno nuevo
                </Link>
              </div>
            </>
          )}

          <div className="li-back"><Link to="/login">← Volver a iniciar sesión</Link></div>
        </div>
      </motion.div>
    </div>
  );
}
