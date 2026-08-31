import { useEffect, useState } from 'react';
import { FiSearch, FiEdit2, FiX, FiCheck } from 'react-icons/fi';
import { apiError } from '../../api/client';
import { adminService } from '../../services';
import { useAsync } from '../../hooks/useAsync';
import { AsyncView, Card, Badge } from '../../components/ui';
import { ROLE_LABEL, RolNombre, INSTITUTIONAL_ROLES, SEMESTERS } from '../../constants';
import type { PublicUser } from '../../services/types';

const emptyForm = {
  firstName: '',
  lastName: '',
  email: '',
  password: '',
  role: RolNombre.TEACHER as string,
};

export default function AdminUsersPage() {
  const [search, setSearch] = useState('');
  const [applied, setApplied] = useState('');
  const { data, loading, error, reload } = useAsync(
    () => adminService.listUsers(applied || undefined),
    [applied],
  );

  const [form, setForm] = useState(emptyForm);
  const [creating, setCreating] = useState(false);
  const [editing, setEditing] = useState<PublicUser | null>(null);
  const [semesterTarget, setSemesterTarget] = useState<PublicUser | null>(null);
  const [msg, setMsg] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);

  const notify = (text: string) => {
    setMsg(text);
    setErr(null);
    window.setTimeout(() => setMsg(null), 4000);
  };

  const create = async (e: React.FormEvent) => {
    e.preventDefault();
    setMsg(null);
    setErr(null);
    setCreating(true);
    try {
      await adminService.createUser(form);
      setForm(emptyForm);
      notify('Usuario institucional creado.');
      reload();
    } catch (e2) {
      setErr(apiError(e2));
    } finally {
      setCreating(false);
    }
  };

  const toggle = async (user: PublicUser) => {
    const activate = user.status !== 'active';
    if (
      !activate &&
      !window.confirm(
        `Desactivar a ${user.firstName} ${user.lastName}. Perderá el acceso al sistema de inmediato. ¿Continuar?`,
      )
    ) {
      return;
    }
    setErr(null);
    try {
      await adminService.setActive(user.id, activate);
      notify(activate ? 'Cuenta activada.' : 'Cuenta desactivada.');
      reload();
    } catch (e2) {
      setErr(apiError(e2));
    }
  };

  return (
    <div>
      <h1>Gestión de usuarios</h1>
      <p className="muted">
        Alta y control de acceso de los usuarios institucionales. Los estudiantes se registran
        por su cuenta desde la aplicación móvil.
      </p>

      {msg && <div className="alert alert-success">{msg}</div>}
      {err && <div className="alert alert-error">{err}</div>}

      <Card title="Crear usuario institucional">
        <form onSubmit={create}>
          <div className="row">
            <div className="field">
              <label>Nombres</label>
              <input
                value={form.firstName}
                onChange={(e) => setForm({ ...form, firstName: e.target.value })}
                placeholder="Carlos"
                required
              />
            </div>
            <div className="field">
              <label>Apellidos</label>
              <input
                value={form.lastName}
                onChange={(e) => setForm({ ...form, lastName: e.target.value })}
                placeholder="Pérez"
                required
              />
            </div>
          </div>
          <div className="row">
            <div className="field">
              <label>Correo institucional</label>
              <input
                type="email"
                value={form.email}
                onChange={(e) => setForm({ ...form, email: e.target.value })}
                placeholder="carlos.perez@univalle.edu"
                required
              />
            </div>
            <div className="field">
              <label>Contraseña</label>
              <input
                type="password"
                value={form.password}
                onChange={(e) => setForm({ ...form, password: e.target.value })}
                placeholder="Mayúscula, minúscula, número y símbolo"
                required
              />
            </div>
            <div className="field">
              <label>Rol</label>
              <select value={form.role} onChange={(e) => setForm({ ...form, role: e.target.value })}>
                {INSTITUTIONAL_ROLES.map((r) => (
                  <option key={r} value={r}>
                    {ROLE_LABEL[r]}
                  </option>
                ))}
              </select>
            </div>
          </div>
          <button className="btn btn-primary" disabled={creating}>
            {creating ? 'Creando…' : 'Crear usuario'}
          </button>
        </form>
      </Card>

      <Card
        title="Usuarios registrados"
        actions={
          <form
            className="flex"
            onSubmit={(e) => {
              e.preventDefault();
              setApplied(search);
            }}
          >
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Buscar por nombre o correo"
              style={{ minWidth: 240 }}
            />
            <button className="btn btn-secondary btn-sm" type="submit">
              <FiSearch /> Buscar
            </button>
            {applied && (
              <button
                type="button"
                className="btn btn-ghost btn-sm"
                onClick={() => {
                  setSearch('');
                  setApplied('');
                }}
              >
                Limpiar
              </button>
            )}
          </form>
        }
      >
        <AsyncView
          loading={loading}
          error={error}
          data={data}
          isEmpty={(d) => d.length === 0}
          emptyMessage={
            applied
              ? `Ningún usuario coincide con “${applied}”.`
              : 'Todavía no hay usuarios registrados.'
          }
        >
          {(users) => (
            <table>
              <thead>
                <tr>
                  <th>Nombre</th>
                  <th>Correo</th>
                  <th>Rol</th>
                  <th>Semestres habilitados</th>
                  <th>Estado</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {users.map((u) => (
                  <tr key={u.id}>
                    <td>
                      {u.firstName} {u.lastName}
                    </td>
                    <td className="muted">{u.email}</td>
                    <td>{ROLE_LABEL[u.role] ?? u.role}</td>
                    <td>
                      {u.role === RolNombre.TEACHER ? (
                        <div className="flex" style={{ gap: '0.4rem', flexWrap: 'wrap' }}>
                          {u.semesters && u.semesters.length > 0 ? (
                            u.semesters.map((s) => (
                              <Badge key={s} tone="bordo">
                                {s}º
                              </Badge>
                            ))
                          ) : (
                            <span className="muted">Sin semestres</span>
                          )}
                          <button
                            className="btn btn-ghost btn-sm"
                            onClick={() => setSemesterTarget(u)}
                          >
                            Configurar
                          </button>
                        </div>
                      ) : (
                        <span className="muted">—</span>
                      )}
                    </td>
                    <td>
                      <Badge tone={u.status === 'active' ? 'green' : 'red'}>
                        {u.status === 'active' ? 'Activo' : 'Inactivo'}
                      </Badge>
                    </td>
                    <td>
                      <div className="flex" style={{ gap: '0.35rem' }}>
                        <button
                          className="btn btn-secondary btn-sm"
                          onClick={() => setEditing(u)}
                          title="Editar datos"
                        >
                          <FiEdit2 />
                        </button>
                        <button className="btn btn-secondary btn-sm" onClick={() => toggle(u)}>
                          {u.status === 'active' ? 'Desactivar' : 'Activar'}
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </AsyncView>
      </Card>

      {editing && (
        <EditUserDialog
          user={editing}
          onClose={() => setEditing(null)}
          onSaved={() => {
            setEditing(null);
            notify('Usuario actualizado.');
            reload();
          }}
          onError={setErr}
        />
      )}

      {semesterTarget && (
        <SemesterDialog
          teacher={semesterTarget}
          onClose={() => setSemesterTarget(null)}
          onSaved={(count) => {
            setSemesterTarget(null);
            notify(
              count === 0
                ? 'El docente quedó sin semestres habilitados.'
                : `Semestres habilitados actualizados (${count}).`,
            );
            reload();
          }}
          onError={setErr}
        />
      )}
    </div>
  );
}

/* ------------------------------------------------------------------ */

function Dialog({
  title,
  subtitle,
  onClose,
  children,
}: {
  title: string;
  subtitle?: string;
  onClose: () => void;
  children: React.ReactNode;
}) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  return (
    <div className="modal-backdrop" onClick={onClose} role="presentation">
      <div
        className="modal"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-label={title}
      >
        <div className="modal-head">
          <div>
            <h3>{title}</h3>
            {subtitle && <span className="muted">{subtitle}</span>}
          </div>
          <button className="btn btn-ghost btn-sm" onClick={onClose} aria-label="Cerrar">
            <FiX />
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}

function EditUserDialog({
  user,
  onClose,
  onSaved,
  onError,
}: {
  user: PublicUser;
  onClose: () => void;
  onSaved: () => void;
  onError: (msg: string) => void;
}) {
  const [form, setForm] = useState({
    firstName: user.firstName,
    lastName: user.lastName,
    email: user.email,
    role: user.role,
  });
  const [saving, setSaving] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      await adminService.updateUser(user.id, form);
      onSaved();
    } catch (e2) {
      onError(apiError(e2));
      setSaving(false);
    }
  };

  const canChangeRole = INSTITUTIONAL_ROLES.includes(user.role as RolNombre);

  return (
    <Dialog title="Editar usuario" subtitle={user.email} onClose={onClose}>
      <form onSubmit={submit}>
        <div className="row">
          <div className="field">
            <label>Nombres</label>
            <input
              value={form.firstName}
              onChange={(e) => setForm({ ...form, firstName: e.target.value })}
              required
            />
          </div>
          <div className="field">
            <label>Apellidos</label>
            <input
              value={form.lastName}
              onChange={(e) => setForm({ ...form, lastName: e.target.value })}
              required
            />
          </div>
        </div>
        <div className="field">
          <label>Correo institucional</label>
          <input
            type="email"
            value={form.email}
            onChange={(e) => setForm({ ...form, email: e.target.value })}
            required
          />
        </div>
        <div className="field">
          <label>Rol</label>
          {canChangeRole ? (
            <select value={form.role} onChange={(e) => setForm({ ...form, role: e.target.value })}>
              {INSTITUTIONAL_ROLES.map((r) => (
                <option key={r} value={r}>
                  {ROLE_LABEL[r]}
                </option>
              ))}
            </select>
          ) : (
            <>
              <input value={ROLE_LABEL[user.role] ?? user.role} disabled />
              <span className="muted" style={{ fontSize: '0.76rem' }}>
                El rol de estudiante y el de administrador no se cambian desde esta pantalla.
              </span>
            </>
          )}
        </div>
        <div className="flex" style={{ justifyContent: 'flex-end', gap: '0.5rem' }}>
          <button type="button" className="btn btn-secondary" onClick={onClose}>
            Cancelar
          </button>
          <button className="btn btn-primary" disabled={saving}>
            {saving ? 'Guardando…' : 'Guardar cambios'}
          </button>
        </div>
      </form>
    </Dialog>
  );
}

function SemesterDialog({
  teacher,
  onClose,
  onSaved,
  onError,
}: {
  teacher: PublicUser;
  onClose: () => void;
  onSaved: (count: number) => void;
  onError: (msg: string) => void;
}) {
  const [selected, setSelected] = useState<number[]>(teacher.semesters ?? []);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    adminService
      .getSemesters(teacher.id)
      .then(setSelected)
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [teacher.id]);

  const toggle = (s: number) =>
    setSelected((prev) => (prev.includes(s) ? prev.filter((x) => x !== s) : [...prev, s].sort()));

  const submit = async () => {
    setSaving(true);
    try {
      const saved = await adminService.setSemesters(teacher.id, selected);
      onSaved(saved.length);
    } catch (e) {
      onError(apiError(e));
      setSaving(false);
    }
  };

  return (
    <Dialog
      title="Semestres habilitados"
      subtitle={`${teacher.firstName} ${teacher.lastName} · Docente`}
      onClose={onClose}
    >
      <p className="muted" style={{ marginBottom: '0.9rem' }}>
        El docente solo podrá consultar los perfiles de estudiantes que cursan los semestres
        seleccionados. Sin ninguna selección, no verá ningún perfil.
      </p>

      {loading ? (
        <div className="state">Cargando…</div>
      ) : (
        <div className="semester-grid">
          {SEMESTERS.map((s) => {
            const on = selected.includes(s);
            return (
              <button
                type="button"
                key={s}
                className={`semester-opt ${on ? 'on' : ''}`}
                onClick={() => toggle(s)}
                aria-pressed={on}
              >
                <span className="n">{s}º</span>
                <span className="chk">{on && <FiCheck size={12} />}</span>
              </button>
            );
          })}
        </div>
      )}

      <div className="flex between mt">
        <button
          type="button"
          className="btn btn-ghost btn-sm"
          onClick={() => setSelected(selected.length === SEMESTERS.length ? [] : [...SEMESTERS])}
        >
          {selected.length === SEMESTERS.length ? 'Quitar todos' : 'Seleccionar todos'}
        </button>
        <div className="flex" style={{ gap: '0.5rem' }}>
          <button type="button" className="btn btn-secondary" onClick={onClose}>
            Cancelar
          </button>
          <button className="btn btn-primary" onClick={submit} disabled={saving || loading}>
            {saving ? 'Guardando…' : 'Guardar'}
          </button>
        </div>
      </div>
    </Dialog>
  );
}
