import { useState } from 'react';
import { apiError } from '../../api/client';
import { adminService } from '../../services';
import { useAsync } from '../../hooks/useAsync';
import { AsyncView, Card, Badge } from '../../components/ui';
import { ROLE_LABEL, RolNombre } from '../../constants';

export default function AdminUsersPage() {
  const { data, loading, error, reload } = useAsync(() => adminService.listUsers(), []);
  const [form, setForm] = useState({ firstName: '', lastName: '', email: '', password: '', role: RolNombre.TEACHER });
  const [msg, setMsg] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);

  const create = async (e: React.FormEvent) => {
    e.preventDefault();
    setMsg(null); setErr(null);
    try {
      await adminService.createUser(form);
      setForm({ ...form, firstName: '', lastName: '', email: '', password: '' });
      setMsg('Usuario creado.');
      reload();
    } catch (e2) { setErr(apiError(e2)); }
  };

  const toggle = async (id: string, active: boolean) => {
    try { await adminService.setActive(id, active); reload(); } catch (e2) { setErr(apiError(e2)); }
  };

  return (
    <div>
      <h1>Gestión de usuarios</h1>
      {msg && <div className="alert alert-success">{msg}</div>}
      {err && <div className="alert alert-error">{err}</div>}

      <Card title="Crear usuario">
        <form onSubmit={create}>
          <div className="row">
            <div className="field"><label>Nombres</label><input value={form.firstName} onChange={(e) => setForm({ ...form, firstName: e.target.value })} required /></div>
            <div className="field"><label>Apellidos</label><input value={form.lastName} onChange={(e) => setForm({ ...form, lastName: e.target.value })} required /></div>
          </div>
          <div className="row">
            <div className="field"><label>Correo</label><input type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} required /></div>
            <div className="field"><label>Contraseña</label><input type="password" value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} required /></div>
            <div className="field"><label>Rol</label>
              <select value={form.role} onChange={(e) => setForm({ ...form, role: e.target.value as RolNombre })}>
                {Object.values(RolNombre).map((r) => <option key={r} value={r}>{ROLE_LABEL[r]}</option>)}
              </select>
            </div>
          </div>
          <button className="btn btn-primary">Crear usuario</button>
        </form>
      </Card>

      <Card title="Usuarios">
        <AsyncView loading={loading} error={error} data={data} isEmpty={(d) => d.length === 0}>
          {(users) => (
            <table>
              <thead><tr><th>Nombre</th><th>Correo</th><th>Rol</th><th>Estado</th><th></th></tr></thead>
              <tbody>
                {users.map((u) => (
                  <tr key={u.id}>
                    <td>{u.firstName} {u.lastName}</td>
                    <td className="muted">{u.email}</td>
                    <td>{ROLE_LABEL[u.role] ?? u.role}</td>
                    <td><Badge tone={u.status === 'active' ? 'green' : 'red'}>{u.status}</Badge></td>
                    <td>
                      <button className="btn btn-secondary btn-sm" onClick={() => toggle(u.id, u.status !== 'active')}>
                        {u.status === 'active' ? 'Desactivar' : 'Activar'}
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </AsyncView>
      </Card>
    </div>
  );
}
