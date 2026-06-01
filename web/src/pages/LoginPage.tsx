import { useMemo, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { AnimatePresence, motion } from 'framer-motion';
import {
  FiArrowRight, FiAward, FiAlertCircle, FiCheck, FiEye, FiEyeOff, FiLock, FiMail, FiTarget, FiUser,
} from 'react-icons/fi';
import { useAuth } from '../auth/AuthContext';
import { HOME_BY_ROLE } from '../navigation';
import { authFieldErrors } from '../api/client';
import '../login.css';

const NAME_RE = /^[A-Za-zÀ-ÿ]+(?:[ '-][A-Za-zÀ-ÿ]+)*$/;
const UNIVALLE_RE = /^[a-z0-9._%+-]+@(?:[a-z0-9-]+\.)*univalle\.edu$/i;

function validateName(v: string, label: string): string | null {
  const t = v.trim();
  if (!t) return `${label} es obligatorio.`;
  if (t.length < 2) return `${label} debe tener al menos 2 caracteres.`;
  if (t.length > 50) return `${label} no puede superar 50 caracteres.`;
  if (!NAME_RE.test(t)) return `${label} solo admite letras, espacios, apóstrofo o guion.`;
  return null;
}
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

export default function LoginPage() {
  const { login, register } = useAuth();
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const [mode, setMode] = useState<'login' | 'register'>(params.get('registro') === '1' ? 'register' : 'login');
  const [form, setForm] = useState({ firstName: '', lastName: '', email: '', password: '', confirm: '' });
  const [showPwd, setShowPwd] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [serverError, setServerError] = useState<string | null>(null);
  const [errorKey, setErrorKey] = useState(0);
  const [busy, setBusy] = useState(false);

  const set = (k: string, v: string) => {
    setForm((f) => ({ ...f, [k]: v }));
    setErrors((e) => ({ ...e, [k]: '' }));
  };

  const reqs = useMemo(() => {
    const p = form.password;
    return [
      { t: '8+ caracteres', ok: p.length >= 8 && p.length <= 72 },
      { t: 'Una mayúscula', ok: /[A-Z]/.test(p) },
      { t: 'Una minúscula', ok: /[a-z]/.test(p) },
      { t: 'Un número', ok: /\d/.test(p) },
      { t: 'Un símbolo', ok: /[^A-Za-z0-9\s]/.test(p) },
      { t: 'Sin espacios', ok: p.length > 0 && !/\s/.test(p) },
    ];
  }, [form.password]);

  const validateRegister = (): boolean => {
    const e: Record<string, string> = {};
    const fn = validateName(form.firstName, 'El nombre');
    if (fn) e.firstName = fn;
    const ln = validateName(form.lastName, 'El apellido');
    if (ln) e.lastName = ln;
    const em = validateEmail(form.email);
    if (em) e.email = em;
    if (!reqs.every((r) => r.ok)) e.password = 'La contraseña no cumple los requisitos.';
    if (form.confirm !== form.password) e.confirm = 'Las contraseñas no coinciden.';
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  const submit = async (ev: React.FormEvent) => {
    ev.preventDefault();
    setServerError(null);
    if (mode === 'register' && !validateRegister()) {
      setErrorKey((k) => k + 1);
      return;
    }
    setBusy(true);
    try {
      const user = mode === 'login'
        ? await login(form.email.trim(), form.password)
        : await register({
            firstName: form.firstName.trim(),
            lastName: form.lastName.trim(),
            email: form.email.trim().toLowerCase(),
            password: form.password,
          });
      navigate(HOME_BY_ROLE[user.role] ?? '/login', { replace: true });
    } catch (err) {
      const { message, fields } = authFieldErrors(err);
      if (Object.keys(fields).length) setErrors((e) => ({ ...e, ...fields }));
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
            <AnimatePresence mode="wait">
              <motion.div key={mode} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }} transition={{ duration: 0.25 }}>
                <h1>{mode === 'login' ? 'Bienvenido de vuelta' : 'Crea tu cuenta'}</h1>
                <p>{mode === 'login' ? 'Ingresa para construir tu perfil dinámico.' : 'Regístrate con tu correo institucional (univalle.edu).'}</p>
              </motion.div>
            </AnimatePresence>
          </div>

          <AnimatePresence>
            {serverError && (
              <motion.div className="li-alert" key={errorKey} initial={{ opacity: 0 }} animate={{ opacity: 1, x: [0, -8, 8, -5, 5, 0] }} exit={{ opacity: 0 }} transition={{ duration: 0.4 }}>
                ⚠ {serverError}
              </motion.div>
            )}
          </AnimatePresence>

          <form onSubmit={submit} noValidate>
            <AnimatePresence initial={false}>
              {mode === 'register' && (
                <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }} transition={{ duration: 0.3 }} style={{ overflow: 'hidden' }}>
                  <div className="li-row">
                    <div className="li-field">
                      <label>Nombres</label>
                      <div className={`li-input-wrap ${errors.firstName ? 'bad' : ''}`}>
                        <input value={form.firstName} onChange={(e) => set('firstName', e.target.value)} placeholder="Tus nombres" maxLength={50} style={{ paddingLeft: '0.9rem' }} />
                      </div>
                      <Err name="firstName" />
                    </div>
                    <div className="li-field">
                      <label>Apellidos</label>
                      <div className={`li-input-wrap ${errors.lastName ? 'bad' : ''}`}>
                        <input value={form.lastName} onChange={(e) => set('lastName', e.target.value)} placeholder="Tus apellidos" maxLength={50} style={{ paddingLeft: '0.9rem' }} />
                      </div>
                      <Err name="lastName" />
                    </div>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>

            <div className="li-field">
              <label>Correo {mode === 'register' && <span className="muted" style={{ fontWeight: 400 }}>· institucional</span>}</label>
              <div className={`li-input-wrap ${errors.email ? 'bad' : ''}`}>
                <input type="email" value={form.email} onChange={(e) => set('email', e.target.value)} placeholder={mode === 'register' ? 'nombre.apellido@univalle.edu' : 'tu correo'} maxLength={160} />
                <span className="ic"><FiMail /></span>
              </div>
              <Err name="email" />
            </div>

            <div className="li-field">
              <label>Contraseña</label>
              <div className={`li-input-wrap ${errors.password ? 'bad' : ''}`}>
                <input type={showPwd ? 'text' : 'password'} value={form.password} onChange={(e) => set('password', e.target.value)} placeholder="••••••••" maxLength={72} />
                <span className="ic"><FiLock /></span>
                <button type="button" className="li-eye" onClick={() => setShowPwd((s) => !s)} aria-label="Mostrar u ocultar contraseña">
                  {showPwd ? <FiEyeOff /> : <FiEye />}
                </button>
              </div>
              <Err name="password" />
              {mode === 'register' && (
                <ul className="li-reqs">
                  {reqs.map((r) => (
                    <li key={r.t} className={r.ok ? 'ok' : ''}>{r.ok ? <FiCheck /> : <span style={{ width: 14 }}>•</span>} {r.t}</li>
                  ))}
                </ul>
              )}
            </div>

            <AnimatePresence initial={false}>
              {mode === 'register' && (
                <motion.div className="li-field" initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }} transition={{ duration: 0.3 }} style={{ overflow: 'hidden' }}>
                  <label>Confirmar contraseña</label>
                  <div className={`li-input-wrap ${errors.confirm ? 'bad' : ''}`}>
                    <input type={showPwd ? 'text' : 'password'} value={form.confirm} onChange={(e) => set('confirm', e.target.value)} placeholder="Repite la contraseña" maxLength={72} />
                    <span className="ic"><FiLock /></span>
                  </div>
                  <Err name="confirm" />
                </motion.div>
              )}
            </AnimatePresence>

            <motion.button className="li-btn" disabled={busy} whileTap={{ scale: 0.98 }}>
              {busy ? <><span className="li-spin" /> Procesando…</> : <>{mode === 'login' ? 'Ingresar' : 'Crear cuenta'} <FiArrowRight /></>}
            </motion.button>
          </form>

          <div className="li-switch">
            {mode === 'login' ? '¿Eres estudiante nuevo? ' : '¿Ya tienes cuenta? '}
            <button onClick={() => { setMode(mode === 'login' ? 'register' : 'login'); setErrors({}); setServerError(null); }}>
              {mode === 'login' ? 'Crear cuenta' : 'Iniciar sesión'}
            </button>
          </div>

          <div className="li-back"><Link to="/">← Volver al inicio</Link></div>
        </div>
      </motion.div>
    </div>
  );
}
