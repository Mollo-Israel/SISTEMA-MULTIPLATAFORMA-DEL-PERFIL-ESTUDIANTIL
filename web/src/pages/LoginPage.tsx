import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { AnimatePresence, motion } from 'framer-motion';
import {
  FiArrowRight, FiAward, FiAlertCircle, FiEye, FiEyeOff, FiLock, FiMail, FiTarget, FiUser,
} from 'react-icons/fi';
import { useAuth } from '../auth/AuthContext';
import { HOME_BY_ROLE } from '../navigation';
import { authFieldErrors } from '../api/client';
import '../login.css';

const UNIVALLE_RE = /^[a-z0-9._%+-]+@(?:[a-z0-9-]+\.)*univalle\.edu$/i;

function validateEmail(v: string): string | null {
  const t = v.trim();
  if (!t) return 'El correo es obligatorio.';
  if (t.length > 160) return 'El correo es demasiado largo.';
  if (/\s/.test(t)) return 'El correo no debe contener espacios.';
  if ((t.match(/@/g) || []).length !== 1) return 'El correo debe contener un único “@”.';
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(t)) return 'El correo no tiene un formato válido.';
  if (!UNIVALLE_RE.test(t)) return 'Debe ser correo institucional (terminar en univalle.edu).';
  return null;
}

/**
 * Inicio de sesión (§9).
 *
 * No hay registro público: las cuentas las provisiona la administración por
 * alta individual o por importación de padrón, y su titular las activa con el
 * enlace que recibe. Por eso esta pantalla ofrece activar y recuperar, pero
 * nunca crear.
 */
export default function LoginPage() {
  const { login } = useAuth();
  const navigate = useNavigate();
  const [form, setForm] = useState({ email: '', password: '' });
  const [showPwd, setShowPwd] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [serverError, setServerError] = useState<string | null>(null);
  const [errorKey, setErrorKey] = useState(0);
  const [busy, setBusy] = useState(false);

  const set = (k: string, v: string) => {
    setForm((f) => ({ ...f, [k]: v }));
    setErrors((e) => ({ ...e, [k]: '' }));
  };

  const submit = async (ev: React.FormEvent) => {
    ev.preventDefault();
    setServerError(null);

    const e: Record<string, string> = {};
    const em = validateEmail(form.email);
    if (em) e.email = em;
    if (!form.password) e.password = 'La contraseña es obligatoria.';
    setErrors(e);
    if (Object.keys(e).length) {
      setErrorKey((k) => k + 1);
      return;
    }

    setBusy(true);
    try {
      const user = await login(form.email.trim(), form.password);
      navigate(HOME_BY_ROLE[user.role] ?? '/login', { replace: true });
    } catch (err) {
      const { message, fields } = authFieldErrors(err);
      if (Object.keys(fields).length) setErrors((x) => ({ ...x, ...fields }));
      setServerError(message);
      setErrorKey((k) => k + 1);
    } finally {
      setBusy(false);
    }
  };

  const Err = ({ name }: { name: string }) =>
    errors[name] ? <div className="li-err"><FiAlertCircle /> {errors[name]}</div> : null;

  return (
    <div className="li">
      <motion.div className="li-card" initial={{ opacity: 0, y: 24, scale: 0.98 }} animate={{ opacity: 1, y: 0, scale: 1 }} transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1] }}>
        <aside className="li-aside">
          <span className="blob a" /><span className="blob b" /><span className="grid" />
          <div className="li-aside-top">
            <div className="li-brand"><img src="/afiniaapp2Login.png" alt="Afinia" className="li-logo-img" /> Afinia</div>
            <motion.h2 initial={{ opacity: 0, x: -16 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 0.15, duration: 0.5 }}>
              Tu perfil académico, en evolución.
            </motion.h2>
            <p className="t">Intereses, habilidades, proyectos y actividades que revelan tus áreas de afinidad.</p>
            <div className="li-feat">
              {[{ ic: <FiUser />, t: 'Perfil dinámico y portafolio' }, { ic: <FiTarget />, t: 'Áreas de afinidad calculadas' }, { ic: <FiAward />, t: 'Evidencias y certificados' }].map((f, i) => (
                <motion.div key={f.t} initial={{ opacity: 0, x: -14 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 0.25 + i * 0.1 }}>
                  <span className="ic">{f.ic}</span> {f.t}
                </motion.div>
              ))}
            </div>
          </div>
          <p className="li-quote">"Complementa SIU y Teams; no los reemplaza. Orienta, no califica."</p>
        </aside>

        <div className="li-form">
          <div className="head">
            <h1>Bienvenido de vuelta</h1>
            <p>Ingresa con tu cuenta institucional para construir tu perfil dinámico.</p>
          </div>

          <AnimatePresence>
            {serverError && (
              <motion.div className="li-alert" key={errorKey} initial={{ opacity: 0 }} animate={{ opacity: 1, x: [0, -8, 8, -5, 5, 0] }} exit={{ opacity: 0 }} transition={{ duration: 0.4 }}>
                ⚠ {serverError}
              </motion.div>
            )}
          </AnimatePresence>

          <form onSubmit={submit} noValidate>
            <div className="li-field">
              <span className="field-label" id="login-page-correo-institucional">Correo institucional</span>
              <div role="group" aria-labelledby="login-page-correo-institucional" className={`li-input-wrap ${errors.email ? 'bad' : ''}`}>
                <input type="email" value={form.email} onChange={(e) => set('email', e.target.value)} placeholder="nombre.apellido@univalle.edu" maxLength={160} autoComplete="username" />
                <span className="ic"><FiMail /></span>
              </div>
              <Err name="email" />
            </div>

            <div className="li-field">
              <span className="field-label" id="login-page-contrasena">Contraseña</span>
              <div role="group" aria-labelledby="login-page-contrasena" className={`li-input-wrap ${errors.password ? 'bad' : ''}`}>
                <input type={showPwd ? 'text' : 'password'} value={form.password} onChange={(e) => set('password', e.target.value)} placeholder="••••••••" maxLength={128} autoComplete="current-password" />
                <span className="ic"><FiLock /></span>
                <button type="button" className="li-eye" onClick={() => setShowPwd((s) => !s)} aria-label="Mostrar u ocultar contraseña">
                  {showPwd ? <FiEyeOff /> : <FiEye />}
                </button>
              </div>
              <Err name="password" />
            </div>

            <div className="li-links">
              <Link to="/recuperar">¿Olvidaste tu contraseña?</Link>
            </div>

            <motion.button className="li-btn" disabled={busy} whileTap={{ scale: 0.98 }}>
              {busy ? <><span className="li-spin" /> Procesando…</> : <>Ingresar <FiArrowRight /></>}
            </motion.button>
          </form>

          <div className="li-switch">
            ¿Tu cuenta es nueva? <Link to="/activar">Actívala aquí</Link>
            <p className="li-hint" style={{ textAlign: 'center' }}>
              Las cuentas las crea la carrera a partir del padrón institucional.
            </p>
          </div>

          <div className="li-back"><Link to="/">← Volver al inicio</Link></div>
        </div>
      </motion.div>
    </div>
  );
}
