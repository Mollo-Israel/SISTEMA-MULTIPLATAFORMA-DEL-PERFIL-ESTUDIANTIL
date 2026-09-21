import { useEffect, useState } from 'react';
import {
  FiCheck, FiEdit2, FiMail, FiPlus, FiSearch, FiSliders, FiSlash, FiUserPlus, FiUsers,
} from 'react-icons/fi';
import { apiError } from '../../api/client';
import { adminService } from '../../services';
import { useAsync } from '../../hooks/useAsync';
import {
  AsyncView, Badge, Button, Card, CopyButton, EmptyState, Modal, PageHeader, ResultCount,
  SearchInput, SkeletonTable,
} from '../../components/ui';
import { useConfirm, useToast } from '../../components/feedback';
import { ROLE_LABEL, RolNombre, INSTITUTIONAL_ROLES, PROVISIONABLE_ROLES, SEMESTERS } from '../../constants';
import { USER_STATUS_LABEL } from '../../services/types';
import type { PublicUser, UserStatus } from '../../services/types';

/** Color del estado en la tabla (§12). */
const STATUS_TONE: Record<UserStatus, string> = {
  pending_activation: 'amber',
  active: 'green',
  suspended: 'red',
  inactive: 'gray',
};

// Sin contraseña a propósito (§12): la define el titular al activar.
const emptyForm = {
  firstName: '',
  lastName: '',
  email: '',
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
  const [activationToken, setActivationToken] = useState<{ email: string; token: string } | null>(null);
  const toast = useToast();

  const notify = (text: string, detail?: string) => toast.success(text, detail);

  const create = async (e: React.FormEvent) => {
    e.preventDefault();
    setCreating(true);
    try {
      const creado = await adminService.createUser(form);
      setForm(emptyForm);
      notify(
        'Cuenta provisionada.',
        `${form.email} recibió su enlace de activación y podrá definir su contraseña.`,
      );
      // Solo llega en desarrollo sin SMTP: permite continuar sin correo.
      if (creado.activationToken) setActivationToken({ email: creado.email, token: creado.activationToken });
      reload();
    } catch (e2) {
      toast.error(apiError(e2));
    } finally {
      setCreating(false);
    }
  };

  const confirm = useConfirm();

  /**
   * Suspende o reactiva una cuenta (§12).
   *
   * Una cuenta pendiente no se puede "activar" desde aquí: activarla es un
   * acto de su titular, que demuestra control del correo. Lo que sí puede
   * hacer el administrador es reenviarle el enlace.
   */
  const cambiarEstado = async (user: PublicUser, status: UserStatus) => {
    if (status !== 'active') {
      const ok = await confirm({
        title: `Suspender a ${user.firstName} ${user.lastName}`,
        message:
          'Perderá el acceso de inmediato y se cerrarán todas sus sesiones abiertas. ' +
          'Puede reactivar la cuenta cuando quiera.',
        confirmLabel: 'Suspender cuenta',
        tone: 'danger',
      });
      if (!ok) return;
    }
    try {
      await adminService.setStatus(user.id, status);
      notify(
        status === 'active' ? 'Cuenta reactivada.' : 'Cuenta suspendida.',
        `${user.firstName} ${user.lastName}`,
      );
      reload();
    } catch (e2) {
      toast.error(apiError(e2));
    }
  };

  const reenviar = async (user: PublicUser) => {
    try {
      const res = await adminService.resendActivation(user.id);
      notify('Enlace reenviado.', res.message);
      if (res.activationToken) setActivationToken({ email: user.email, token: res.activationToken });
    } catch (e2) {
      toast.error(apiError(e2));
    }
  };

  return (
    <div>
      <PageHeader
        title="Gestión de usuarios"
        description="Alta y control de acceso de las cuentas institucionales. No existe registro público: toda cuenta se provisiona aquí o por importación de padrón, y su titular la activa desde el enlace que recibe."
      />

      <Card title="Provisionar cuenta">
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
              <label>Rol</label>
              <select value={form.role} onChange={(e) => setForm({ ...form, role: e.target.value })}>
                {PROVISIONABLE_ROLES.map((r) => (
                  <option key={r} value={r}>
                    {ROLE_LABEL[r]}
                  </option>
                ))}
              </select>
            </div>
          </div>
          <p className="muted" style={{ fontSize: '0.8rem', marginTop: 0 }}>
            No se define contraseña: la cuenta queda pendiente de activación y su titular
            elige la suya desde el enlace que recibe por correo.
          </p>
          <Button type="submit" loading={creating} icon={<FiUserPlus size={15} />}>
            Provisionar cuenta
          </Button>
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
            <SearchInput
              value={search}
              onChange={setSearch}
              placeholder="Buscar por nombre o correo…"
            />
            <Button type="submit" variant="secondary" size="sm" icon={<FiSearch size={14} />}>
              Buscar
            </Button>
            {applied && (
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => {
                  setSearch('');
                  setApplied('');
                }}
              >
                Limpiar
              </Button>
            )}
          </form>
        }
      >
        <AsyncView
          loading={loading}
          error={error}
          data={data}
          skeleton={<SkeletonTable rows={6} columns={6} />}
          isEmpty={(d) => d.length === 0}
          empty={
            applied ? (
              <EmptyState
                icon={<FiSearch size={22} />}
                message={`Ningún usuario coincide con “${applied}”.`}
                action={
                  <Button
                    variant="secondary"
                    size="sm"
                    onClick={() => {
                      setSearch('');
                      setApplied('');
                    }}
                  >
                    Limpiar búsqueda
                  </Button>
                }
              />
            ) : undefined
          }
          emptyMessage="Todavía no hay usuarios registrados."
        >
          {(users) => (
            <>
            <div style={{ marginBottom: '0.6rem' }}>
              <ResultCount shown={users.length} total={users.length} noun="usuarios" />
            </div>
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
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => setSemesterTarget(u)}
                            icon={<FiSliders size={13} />}
                          >
                            Configurar
                          </Button>
                        </div>
                      ) : (
                        <span className="muted">—</span>
                      )}
                    </td>
                    <td>
                      <Badge tone={STATUS_TONE[u.status] ?? 'gray'}>
                        {USER_STATUS_LABEL[u.status] ?? u.status}
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
                        {u.status === 'pending_activation' ? (
                          <Button
                            variant="secondary"
                            size="sm"
                            onClick={() => reenviar(u)}
                            icon={<FiMail size={13} />}
                          >
                            Reenviar enlace
                          </Button>
                        ) : (
                          <Button
                            variant="secondary"
                            size="sm"
                            onClick={() => cambiarEstado(u, u.status === 'active' ? 'suspended' : 'active')}
                            icon={u.status === 'active' ? <FiSlash size={13} /> : <FiCheck size={13} />}
                          >
                            {u.status === 'active' ? 'Suspender' : 'Reactivar'}
                          </Button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            </>
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
          onError={(m) => toast.error(m)}
        />
      )}

      {activationToken && (
        <Modal
          title="Enlace de activación"
          subtitle={activationToken.email}
          onClose={() => setActivationToken(null)}
        >
          <p className="muted" style={{ marginTop: 0 }}>
            No hay servidor de correo configurado en este entorno, así que el enlace se
            muestra aquí. En producción llega únicamente al correo institucional y esta
            ventana no aparece.
          </p>
          <div className="token-box">
            <code>{activationToken.token}</code>
            <CopyButton text={activationToken.token} label="Copiar código" />
          </div>
          <p className="muted" style={{ fontSize: '0.78rem' }}>
            Debe pegarse en <strong>/activar</strong> para definir la contraseña.
          </p>
          <div className="flex" style={{ justifyContent: 'flex-end' }}>
            <Button variant="secondary" onClick={() => setActivationToken(null)}>
              Cerrar
            </Button>
          </div>
        </Modal>
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
          onError={(m) => toast.error(m)}
        />
      )}
    </div>
  );
}

/* ------------------------------------------------------------------ */

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
    <Modal title="Editar usuario" subtitle={user.email} onClose={onClose}>
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
          <Button type="button" variant="secondary" onClick={onClose}>
            Cancelar
          </Button>
          <Button type="submit" loading={saving}>
            Guardar cambios
          </Button>
        </div>
      </form>
    </Modal>
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
    <Modal
      title="Semestres habilitados"
      subtitle={`${teacher.firstName} ${teacher.lastName} · Docente`}
      onClose={onClose}
    >
      <p className="muted" style={{ marginBottom: '0.9rem' }}>
        El docente solo podrá consultar los perfiles de estudiantes que cursan los semestres
        seleccionados. Sin ninguna selección, no verá ningún perfil.
      </p>

      {loading ? (
        <SkeletonTable rows={2} columns={4} />
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
        <Button
          type="button"
          variant="ghost"
          size="sm"
          onClick={() => setSelected(selected.length === SEMESTERS.length ? [] : [...SEMESTERS])}
          icon={selected.length === SEMESTERS.length ? undefined : <FiPlus size={13} />}
        >
          {selected.length === SEMESTERS.length ? 'Quitar todos' : 'Seleccionar todos'}
        </Button>
        <div className="flex" style={{ gap: '0.5rem' }}>
          <Button type="button" variant="secondary" onClick={onClose}>
            Cancelar
          </Button>
          <Button onClick={submit} loading={saving} disabled={loading} icon={<FiUsers size={15} />}>
            Guardar
          </Button>
        </div>
      </div>
    </Modal>
  );
}
