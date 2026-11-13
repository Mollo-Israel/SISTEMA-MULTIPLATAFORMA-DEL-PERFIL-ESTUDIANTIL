import { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { AnimatePresence, motion } from 'framer-motion';
import {
  FiAlertCircle, FiArrowRight, FiCheck, FiCheckCircle, FiClock, FiEye, FiEyeOff, FiHash, FiLink,
  FiLock, FiMail, FiRefreshCw,
} from 'react-icons/fi';
import { activationService } from '../../services';
import { apiError, formErrors } from '../../api/client';
import type { TokenCheck } from '../../services/types';
import { passwordRequirements, passwordStrength, passwordVerdict, PASSWORD_MAX } from './passwordPolicy';
import { institutionalEmail } from '../../lib/validators';
import '../../login.css';

type Mode = 'activate' | 'reset';
type Via = 'code' | 'link';

const COPY: Record<Mode, {
  title: string; lead: string; cta: string; done: string; doneLead: string; again: string;
}> = {
  activate: {
    title: 'Activa tu cuenta',
    lead: 'La universidad ya creó tu cuenta. Solo falta que elijas tu contraseña.',
    cta: 'Activar mi cuenta',
    done: '¡Tu cuenta está lista!',
    doneLead: 'Ya puedes entrar con tu correo institucional y la contraseña que acabas de elegir.',
    again: '/activar/solicitar',
  },
  reset: {
    title: 'Elige una contraseña nueva',
    lead: 'Al guardarla se cerrarán las sesiones abiertas de tu cuenta, en cualquier equipo.',
    cta: 'Guardar contraseña',
    done: 'Contraseña actualizada',
    doneLead: 'Inicia sesión con tu nueva contraseña. Las sesiones anteriores quedaron cerradas.',
    again: '/recuperar',
  },
};

/**
 * V3.2 §8.2: con el sistema hosteado, la pantalla muestra solo «Tengo el
 * código»; quien llega desde el botón del correo trae el token en la URL y
 * solo elige su contraseña. Pegar el enlace a mano queda para desarrollo (o si
 * se habilita explícitamente con `VITE_ACTIVATION_PASTE_LINK=true`).
 */
const PEGAR_ENLACE = import.meta.env.DEV || import.meta.env.VITE_ACTIVATION_PASTE_LINK === 'true';

/** Acepta el enlace completo o solo el token, por si el correo partió el enlace. */
function extraerToken(valor: string): string {
  const t = valor.trim();
  const m = /[?&]token=([A-Za-z0-9_-]+)/.exec(t);
  return m ? m[1] : t;
}

/**
 * Activación (§12) y recuperación (§13): canjear un enlace o un código por una
 * contraseña.
 *
 * Hay dos caminos y los dos llegan en el mismo correo. El **enlace** abre esta
 * pantalla ya preparada: quien lo pulsa no tiene que copiar nada. El **código**
 * de seis dígitos sirve a quien lee el correo en el teléfono y activa desde
 * otro equipo. Antes solo existía un token de 43 caracteres que había que
 * copiar a mano.
 */
export default function SetPasswordPage({ mode }: Readonly<{ mode: Mode }>) {
  const copy = COPY[mode];
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const tokenUrl = params.get('token') ?? '';

  const [via, setVia] = useState<Via>(tokenUrl ? 'link' : 'code');
  const [token, setToken] = useState(tokenUrl);
  const [email, setEmail] = useState(params.get('email') ?? '');
  const [code, setCode] = useState('');
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [showPwd, setShowPwd] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [serverError, setServerError] = useState<string | null>(null);
  const [errorKey, setErrorKey] = useState(0);
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);

  // Con el enlace del correo, se comprueba antes de pedir la contraseña: si ya
  // no sirve, se dice ahora y no después de que la persona escriba dos veces.
  const [check, setCheck] = useState<TokenCheck | null>(null);
  const [checking, setChecking] = useState(!!tokenUrl);
  useEffect(() => {
    if (!tokenUrl) return;
    activationService
      .check(tokenUrl, mode === 'activate' ? 'activation' : 'reset')
      .then(setCheck)
      .catch(() => setCheck(null))
      .finally(() => setChecking(false));
  }, [tokenUrl, mode]);

  // Con el código, la persona escribió su correo: se aplica la misma regla
  // que el servidor («no contener tu correo»). Con el enlace solo se conoce
  // enmascarado, y esa comprobación la hace el servidor.
  const contexto = via === 'code' ? { email } : {};
  const reqs = useMemo(() => passwordRequirements(password, contexto), [password, via, email]); // eslint-disable-line react-hooks/exhaustive-deps
  const strength = passwordStrength(password, contexto);
  const verdict = passwordVerdict(password, contexto);

  const limpiar = (campo: string) => {
    setErrors((x) => ({ ...x, [campo]: '' }));
    setServerError(null);
  };

  const submit = async (ev: React.FormEvent) => {
    ev.preventDefault();
    setServerError(null);

    const e = erroresDelFormulario({ via, token, email, code, password, confirm, cumple: reqs.every((r) => r.ok) });
    setErrors(e);
    if (Object.values(e).some(Boolean)) {
      setErrorKey((k) => k + 1);
      return;
    }

    const input =
      via === 'link'
        ? { token: extraerToken(token), password }
        : { email: email.trim().toLowerCase(), code: code.replace(/\s+/g, ''), password };

    setBusy(true);
    try {
      if (mode === 'activate') await activationService.activate(input);
      else await activationService.resetPassword(input);
      setDone(true);
    } catch (err) {
      const { general, fields } = formErrors(err, ['token', 'email', 'code', 'password']);
      if (Object.keys(fields).length) setErrors(fields);
      setServerError(general ?? (Object.keys(fields).length ? null : apiError(err)));
      setErrorKey((k) => k + 1);
    } finally {
      setBusy(false);
    }
  };

  const irAlLogin = () => navigate('/login', { replace: true });

  // ---------------------------------------------------------------- enlace muerto
  const enlaceNoSirve = !!tokenUrl && !checking && check && check.state !== 'valid';

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
            <ContrasenaLista titulo={copy.done} texto={copy.doneLead} onIr={irAlLogin} />
          ) : <>{checking ? (
            <div className="li-checking">
              <span className="li-spin dark" /> Comprobando tu enlace…
            </div>
          ) : <>{enlaceNoSirve ? (
            <EnlaceQueNoSirve check={check!} mode={mode} pedirOtro={copy.again} onIr={irAlLogin} />
          ) : (
            <>
              <div className="head">
                <h1>
                  {check?.firstName ? `Hola, ${check.firstName}` : copy.title}
                </h1>
                <p>
                  {copy.lead}
                  {check?.email && (
                    <span className="li-who"> Cuenta: <strong>{check.email}</strong></span>
                  )}
                </p>
                {check?.expiresAt && (
                  <p className="li-expiry">
                    <FiClock size={13} /> El enlace sirve hasta el{' '}
                    {new Date(check.expiresAt).toLocaleString('es-BO', { dateStyle: 'full', timeStyle: 'short' })}.
                  </p>
                )}
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
                {!tokenUrl && PEGAR_ENLACE && (
                  <div className="li-tabs" role="tablist" aria-label="Cómo quieres continuar">
                    <button
                      type="button"
                      role="tab"
                      aria-selected={via === 'code'}
                      className={via === 'code' ? 'on' : ''}
                      onClick={() => setVia('code')}
                    >
                      <FiHash /> Tengo el código
                    </button>
                    <button
                      type="button"
                      role="tab"
                      aria-selected={via === 'link'}
                      className={via === 'link' ? 'on' : ''}
                      onClick={() => setVia('link')}
                    >
                      <FiLink /> Tengo el enlace
                    </button>
                  </div>
                )}

                {via === 'code' && !tokenUrl && (
                  <CamposDeCodigo
                    email={email}
                    code={code}
                    errors={errors}
                    onEmail={(v) => { setEmail(v); limpiar('email'); }}
                    onCode={(v) => { setCode(v); limpiar('code'); }}
                  />
                )}
                {via === 'link' && !tokenUrl && (
                  <div className="li-field">
                    <span className="field-label" id="set-password-page-enlace-del-correo">Enlace del correo</span>
                    <fieldset aria-labelledby="set-password-page-enlace-del-correo" className={`li-input-wrap ${errors.token ? 'bad' : ''}`}>
                      <input
                        value={token}
                        onChange={(e) => { setToken(e.target.value); limpiar('token'); }}
                        placeholder="Pega aquí el enlace completo"
                        autoComplete="off"
                        spellCheck={false}
                      />
                      <span className="ic"><FiLink /></span>
                    </fieldset>
                    <ErrorDeCampo mensaje={errors.token} />
                  </div>
                )}

                <div className="li-field">
                  <span className="field-label" id="set-password-page-nueva-contrasena">Nueva contraseña</span>
                  <fieldset aria-labelledby="set-password-page-nueva-contrasena" className={`li-input-wrap ${errors.password ? 'bad' : ''}`}>
                    <input
                      type={showPwd ? 'text' : 'password'}
                      value={password}
                      onChange={(e) => { setPassword(e.target.value); limpiar('password'); }}
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
                  </fieldset>
                  <ErrorDeCampo mensaje={errors.password} />
                  <IndicadoresDeContrasena escrita={password.length > 0} strength={strength} verdict={verdict} reqs={reqs} />
                  <p className="li-hint">
                    No uses tu correo ni tu código universitario dentro de la contraseña.
                  </p>
                </div>

                <div className="li-field">
                  <span className="field-label" id="set-password-page-confirmar-contrasena">Confirmar contraseña</span>
                  <fieldset aria-labelledby="set-password-page-confirmar-contrasena" className={`li-input-wrap ${errors.confirm ? 'bad' : ''}`}>
                    <input
                      type={showPwd ? 'text' : 'password'}
                      value={confirm}
                      onChange={(e) => { setConfirm(e.target.value); limpiar('confirm'); }}
                      placeholder="Repite la contraseña"
                      maxLength={PASSWORD_MAX}
                      autoComplete="new-password"
                    />
                    <span className="ic"><FiLock /></span>
                  </fieldset>
                  <ErrorDeCampo mensaje={errors.confirm} />
                </div>

                <motion.button className="li-btn" disabled={busy} whileTap={{ scale: 0.98 }}>
                  {busy ? <><span className="li-spin" /> Procesando…</> : <>{copy.cta} <FiArrowRight /></>}
                </motion.button>
              </form>

              <div className="li-switch">
                {mode === 'activate' ? '¿No te llegó el correo o venció? ' : '¿No recibiste el correo? '}
                <Link to={copy.again}>Pedir uno nuevo</Link>
              </div>
            </>
          )}</>}</>}

          <div className="li-back"><Link to="/login">← Volver a iniciar sesión</Link></div>
        </div>
      </motion.div>
    </div>
  );
}

/** El nivel de la barra de fuerza de la contraseña. */
function nivelDeFuerza(strength: number): 'alta' | 'media' | 'baja' {
  if (strength === 100) return 'alta';
  return strength >= 50 ? 'media' : 'baja';
}

/** El error de un campo, si lo hay. */
function ErrorDeCampo({ mensaje }: Readonly<{ mensaje?: string }>) {
  return mensaje ? <div className="li-err"><FiAlertCircle /> {mensaje}</div> : null;
}

/** Qué falta o está mal en el formulario, campo por campo. */
function erroresDelFormulario(f: {
  via: Via; token: string; email: string; code: string; password: string; confirm: string; cumple: boolean;
}): Record<string, string> {
  const e: Record<string, string> = {};
  if (f.via === 'link') {
    if (!extraerToken(f.token)) e.token = 'Pega el enlace que recibiste por correo.';
  } else {
    const errCorreo = institutionalEmail(f.email);
    if (errCorreo) e.email = errCorreo;
    if (!/^\d{6}$/.test(f.code.replace(/\s+/g, ''))) e.code = 'El código tiene 6 dígitos.';
  }
  if (!f.cumple) e.password = 'La contraseña todavía no cumple todos los requisitos.';
  if (f.confirm !== f.password) e.confirm = 'Las dos contraseñas no coinciden.';
  return e;
}

/** La contraseña quedó guardada: aviso y botón para iniciar sesión. */
function ContrasenaLista({ titulo, texto, onIr }: Readonly<{ titulo: string; texto: string; onIr: () => void }>) {
  return (
    <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}>
      <div className="li-done">
        <motion.span
          className="ic"
          initial={{ scale: 0.4, rotate: -20 }}
          animate={{ scale: 1, rotate: 0 }}
          transition={{ type: 'spring', stiffness: 260, damping: 14 }}
        >
          <FiCheckCircle size={30} />
        </motion.span>
        <h1>{titulo}</h1>
        <p>{texto}</p>
      </div>
      <button className="li-btn" onClick={onIr}>
        Ir a iniciar sesión <FiArrowRight />
      </button>
    </motion.div>
  );
}

/** El enlace del correo ya se usó o venció: se dice antes de pedir la contraseña. */
function EnlaceQueNoSirve({ check, mode, pedirOtro, onIr }: Readonly<{
  check: TokenCheck; mode: Mode; pedirOtro: string; onIr: () => void;
}>) {
  const usado = check.state === 'used';
  const yaActiva = usado && mode === 'activate';
  let titulo = 'Este enlace ya no sirve';
  if (usado) titulo = mode === 'activate' ? 'Tu cuenta ya está activa' : 'Este enlace ya se usó';
  return (
    <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}>
      <div className="li-done li-done-warn">
        <span className="ic">{usado ? <FiCheckCircle size={28} /> : <FiClock size={28} />}</span>
        <h1>{titulo}</h1>
        <p>{check.message}</p>
      </div>
      {yaActiva ? (
        <button className="li-btn" onClick={onIr}>
          Iniciar sesión <FiArrowRight />
        </button>
      ) : (
        <Link className="li-btn" to={pedirOtro}>
          <FiRefreshCw /> Pedir un enlace nuevo
        </Link>
      )}
    </motion.div>
  );
}

/** Fuerza, veredicto y requisitos de la contraseña mientras se escribe. */
function IndicadoresDeContrasena({ escrita, strength, verdict, reqs }: Readonly<{
  escrita: boolean; strength: number; verdict: string | null; reqs: { t: string; ok: boolean }[];
}>) {
  return (
    <>
      {escrita && (
        <div className="li-strength" aria-hidden>
          <motion.span
            animate={{ width: `${strength}%` }}
            transition={{ duration: 0.25 }}
            data-level={nivelDeFuerza(strength)}
          />
        </div>
      )}
      {verdict && <div className="li-verdict"><FiCheckCircle /> {verdict}</div>}
      <ul className="li-reqs">
        {reqs.map((r) => (
          <li key={r.t} className={r.ok ? 'ok' : ''}>
            {r.ok ? <FiCheck /> : <span style={{ width: 14 }}>•</span>} {r.t}
          </li>
        ))}
      </ul>
    </>
  );
}

/** Correo y código de seis dígitos, para quien no trae el enlace. */
function CamposDeCodigo({ email, code, errors, onEmail, onCode }: Readonly<{
  email: string; code: string; errors: Record<string, string>;
  onEmail: (v: string) => void; onCode: (v: string) => void;
}>) {
  return (
    <>
      <div className="li-field">
        <span className="field-label" id="set-password-page-correo-institucional">Correo institucional</span>
        <fieldset aria-labelledby="set-password-page-correo-institucional" className={`li-input-wrap ${errors.email ? 'bad' : ''}`}>
          <input
            type="email"
            value={email}
            onChange={(e) => onEmail(e.target.value)}
            placeholder="tu.nombre@est.univalle.edu"
            autoComplete="email"
          />
          <span className="ic"><FiMail /></span>
        </fieldset>
        <ErrorDeCampo mensaje={errors.email} />
      </div>
      <div className="li-field">
        <span className="field-label" id="set-password-page-codigo-de-6-digitos">Código de 6 dígitos</span>
        <fieldset aria-labelledby="set-password-page-codigo-de-6-digitos" className={`li-input-wrap li-code ${errors.code ? 'bad' : ''}`}>
          <input
            value={code}
            onChange={(e) => onCode(e.target.value.replace(/[^\d ]/g, '').slice(0, 7))}
            placeholder="000 000"
            inputMode="numeric"
            autoComplete="one-time-code"
          />
          <span className="ic"><FiHash /></span>
        </fieldset>
        <ErrorDeCampo mensaje={errors.code} />
        <p className="li-hint">Está en el mismo correo que el enlace, debajo del botón.</p>
      </div>
    </>
  );
}
