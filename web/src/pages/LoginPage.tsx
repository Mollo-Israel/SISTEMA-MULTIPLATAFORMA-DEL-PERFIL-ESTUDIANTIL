import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../auth/AuthContext';
import { HOME_BY_ROLE } from '../navigation';
import { apiError } from '../api/client';

export default function LoginPage() {
  const { login, register } = useAuth();
  const navigate = useNavigate();
  const [mode, setMode] = useState<'login' | 'register'>('login');
  const [form, setForm] = useState({ firstName: '', lastName: '', email: '', password: '' });
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const user =
        mode === 'login'
          ? await login(form.email, form.password)
          : await register(form);
      navigate(HOME_BY_ROLE[user.role] ?? '/login', { replace: true });
    } catch (err) {
      setError(apiError(err, 'No se pudo iniciar sesión.'));
    } finally {
      setBusy(false);
    }
  };

  const set = (k: string, v: string) => setForm((f) => ({ ...f, [k]: v }));

  return (
    <div className="login-wrap">
      <form className="login-card" onSubmit={submit}>
        <div className="logo">
          <strong>Perfil Estudiantil Dinámico</strong>
          <span>Ingeniería en Sistemas Informáticos · Univalle</span>
        </div>
        {error && <div className="alert alert-error">{error}</div>}
        {mode === 'register' && (
          <div className="row">
            <div className="field">
              <label>Nombres</label>
              <input value={form.firstName} onChange={(e) => set('firstName', e.target.value)} required />
            </div>
            <div className="field">
              <label>Apellidos</label>
              <input value={form.lastName} onChange={(e) => set('lastName', e.target.value)} required />
            </div>
          </div>
        )}
        <div className="field">
          <label>Correo</label>
          <input type="email" value={form.email} onChange={(e) => set('email', e.target.value)} required />
        </div>
        <div className="field">
          <label>Contraseña</label>
          <input type="password" value={form.password} onChange={(e) => set('password', e.target.value)} required />
        </div>
        <button className="btn btn-primary" style={{ width: '100%' }} disabled={busy}>
          {busy ? 'Procesando…' : mode === 'login' ? 'Ingresar' : 'Registrarme como estudiante'}
        </button>
        <p className="muted" style={{ textAlign: 'center', marginTop: '1rem', fontSize: '0.8rem' }}>
          {mode === 'login' ? '¿Eres estudiante nuevo? ' : '¿Ya tienes cuenta? '}
          <a
            href="#"
            onClick={(e) => {
              e.preventDefault();
              setMode(mode === 'login' ? 'register' : 'login');
              setError(null);
            }}
          >
            {mode === 'login' ? 'Crear cuenta' : 'Iniciar sesión'}
          </a>
        </p>
      </form>
    </div>
  );
}
