import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  FiAlertTriangle, FiCheck, FiClock, FiEdit2, FiMail, FiPlus, FiSearch, FiSend, FiSliders, FiSlash,
  FiUserPlus, FiUsers, FiXCircle,
} from 'react-icons/fi';
import { apiError } from '../../api/client';
import { adminService, mailService } from '../../services';
import { useAsync } from '../../hooks/useAsync';
import {
  AsyncView, Badge, Button, Card, EmptyState, Modal, PageHeader, ResultCount, SearchInput,
  SkeletonTable,
} from '../../components/ui';
import { FormAlert, FormField, useFormErrors } from '../../components/form';
import { useConfirm, useToast } from '../../components/feedback';
import { ROLE_LABEL, RolNombre, INSTITUTIONAL_ROLES, PROVISIONABLE_ROLES, SEMESTERS } from '../../constants';
import { USER_STATUS_LABEL } from '../../services/types';
import type { InvitationView, PublicUser, UserStatus } from '../../services/types';
import {
  institutionalEmail, personName, requiredUniversityCode, universityCode, validate,
} from '../../lib/validators';

/** Color del estado en la tabla (§12). */
const STATUS_TONE: Record<UserStatus, string> = {
  pending_activation: 'amber',
  active: 'green',
  suspended: 'red',
  inactive: 'gray',
};

const CAMPOS = ['firstName', 'lastName', 'email', 'role', 'semester', 'universityCode'] as const;
type Campo = (typeof CAMPOS)[number];

// Sin contraseña a propósito (§12): la elige el titular al activar.
const emptyForm: Record<Campo, string> = {
  firstName: '',
  lastName: '',
  email: '',
  role: RolNombre.STUDENT,
  semester: '',
  universityCode: '',
};

function reglas(form: Record<Campo, string>) {
  return validate(form, {
    firstName: personName('nombre'),
    lastName: personName('apellido'),
    email: institutionalEmail,
    semester: (v) => (form.role === RolNombre.STUDENT && !v ? 'Elige el semestre que cursa.' : null),
    universityCode: form.role === RolNombre.STUDENT ? requiredUniversityCode : undefined,
  });
}

/** Qué decirle al administrador sobre la invitación que acaba de salir. */
function describirInvitacion(inv?: InvitationView): { tono: 'ok' | 'warn' | 'error'; texto: string } {
  if (!inv) return { tono: 'ok', texto: 'La cuenta quedó creada.' };
  if (inv.status === 'failed') {
    return { tono: 'error', texto: `La cuenta se creó, pero el correo no salió: ${inv.error ?? 'error del servidor de correo'}. Puede reenviarlo desde la lista.` };
  }
  if (inv.simulated) {
    return {
      tono: 'warn',
      texto: 'El correo está en modo simulado: la invitación no llegó a ningún buzón. Configure el correo real en «Correo».',
    };
  }
  if (inv.status === 'queued') return { tono: 'ok', texto: `La invitación para ${inv.sentTo} está en cola y saldrá en unos segundos.` };
  return { tono: 'ok', texto: `Invitación enviada a ${inv.sentTo}. El titular elegirá su contraseña desde ese correo.` };
}

export default function AdminUsersPage() {
  const [search, setSearch] = useState('');
  const [applied, setApplied] = useState('');
  const { data, loading, error, reload } = useAsync(
    () => adminService.listUsers(applied || undefined),
    [applied],
  );
  const correo = useAsync(() => mailService.status(), []);

  const [form, setForm] = useState(emptyForm);
  const [creating, setCreating] = useState(false);
  const errores = useFormErrors(CAMPOS);
  const [editing, setEditing] = useState<PublicUser | null>(null);
  const [semesterTarget, setSemesterTarget] = useState<PublicUser | null>(null);
  const toast = useToast();
  const confirm = useConfirm();

  const esEstudiante = form.role === RolNombre.STUDENT;

  const set = (campo: Campo, valor: string) => {
    setForm((f) => ({ ...f, [campo]: valor }));
    errores.clear(campo);
  };

  const create = async (e: React.FormEvent) => {
    e.preventDefault();
    const locales = reglas(form);
    if (Object.keys(locales).length > 0) {
      errores.setErrors(locales);
      errores.setGeneral(null);
      return;
    }
    setCreating(true);
    try {
      const body: Record<string, unknown> = {
        firstName: form.firstName.trim(),
        lastName: form.lastName.trim(),
        email: form.email.trim().toLowerCase(),
        role: form.role,
      };
      if (esEstudiante) {
        body.semester = Number(form.semester);
        if (form.universityCode.trim()) body.universityCode = form.universityCode.trim();
      }
      const creado = await adminService.createUser(body);
      setForm({ ...emptyForm, role: form.role });
      errores.reset();
      const aviso = describirInvitacion(creado.invitation);
      const titulo = `Cuenta creada: ${creado.firstName} ${creado.lastName}`;
      if (aviso.tono === 'error') toast.error(titulo, aviso.texto);
      else if (aviso.tono === 'warn') toast.info(titulo, aviso.texto);
      else toast.success(titulo, aviso.texto);
      reload();
    } catch (e2) {
      errores.fromApi(e2);
    } finally {
      setCreating(false);
    }
  };

  /**
   * Suspende o reactiva una cuenta (§12).
   *
   * Una cuenta pendiente no se puede "activar" desde aquí: activarla es un
   * acto de su titular, que demuestra control del correo. Lo que sí puede
   * hacer el administrador es reenviarle la invitación.
   */
  const cambiarEstado = async (user: PublicUser, status: UserStatus) => {
    if (status !== 'active') {
      const ok = await confirm({
        title: `Suspender a ${user.firstName} ${user.lastName}`,
        message:
          'Perderá el acceso de inmediato y se cerrarán todas sus sesiones abiertas. '
          + 'No se borra nada: puede reactivar la cuenta cuando quiera.',
        confirmLabel: 'Suspender cuenta',
        tone: 'danger',
      });
      if (!ok) return;
    }
    try {
      await adminService.setStatus(user.id, status);
      toast.success(
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
      const aviso = describirInvitacion(res.invitation);
      if (aviso.tono === 'error') toast.error('No se pudo reenviar', aviso.texto);
      else if (aviso.tono === 'warn') toast.info('Invitación generada', aviso.texto);
      else toast.success('Invitación reenviada', aviso.texto);
      reload();
    } catch (e2) {
      // 429: el reenvío está en pausa antispam; el mensaje dice cuánto falta.
      toast.info('Todavía no', apiError(e2));
    }
  };

  const simulado = correo.data?.transport === 'console';

  return (
    <div>
      <PageHeader
        title="Gestión de usuarios"
        description="Crea las cuentas de la universidad y controla su acceso. Nadie se registra solo: cada persona recibe una invitación en su correo institucional y desde ahí elige su contraseña."
      />

      {simulado && (
        <div className="notice notice-warn">
          <FiAlertTriangle size={18} />
          <div>
            <strong>El correo está en modo simulado.</strong> Las invitaciones no llegan a los
            buzones: se guardan en el registro de la API. <Link to="/admin/mail">Configurar el correo real</Link>
          </div>
        </div>
      )}

      <Card title="Crear una cuenta">
        <form onSubmit={create} noValidate>
          <FormAlert message={errores.general} />
          <div className="row">
            <FormField label="Rol" required error={errores.errors.role}>
              <select value={form.role} onChange={(e) => set('role', e.target.value)}>
                {PROVISIONABLE_ROLES.map((r) => (
                  <option key={r} value={r}>
                    {ROLE_LABEL[r]}
                  </option>
                ))}
              </select>
            </FormField>
            <FormField
              label="Correo institucional"
              required
              error={errores.errors.email}
              hint={esEstudiante ? 'Termina en @est.univalle.edu' : 'Termina en @univalle.edu'}
            >
              <input
                type="email"
                value={form.email}
                onChange={(e) => set('email', e.target.value)}
                placeholder={esEstudiante ? 'ana.quispe@est.univalle.edu' : 'carlos.perez@univalle.edu'}
                aria-invalid={!!errores.errors.email}
              />
            </FormField>
          </div>
          <div className="row">
            <FormField label="Nombres" required error={errores.errors.firstName}>
              <input
                value={form.firstName}
                onChange={(e) => set('firstName', e.target.value)}
                placeholder="Carlos"
                aria-invalid={!!errores.errors.firstName}
              />
            </FormField>
            <FormField
              label="Apellidos"
              required
              error={errores.errors.lastName}
              hint="Uno o dos apellidos."
            >
              <input
                value={form.lastName}
                onChange={(e) => set('lastName', e.target.value)}
                placeholder="Pérez Rojas"
                aria-invalid={!!errores.errors.lastName}
              />
            </FormField>
          </div>
          {esEstudiante && (
            <div className="row">
              <FormField
                label="Semestre que cursa"
                required
                error={errores.errors.semester}
                hint="Lo fija la universidad: el estudiante no puede cambiarlo."
              >
                <select
                  value={form.semester}
                  onChange={(e) => set('semester', e.target.value)}
                  aria-invalid={!!errores.errors.semester}
                >
                  <option value="">Elige el semestre…</option>
                  {SEMESTERS.map((s) => (
                    <option key={s} value={s}>
                      {s}º semestre
                    </option>
                  ))}
                </select>
              </FormField>
              <FormField
                label="Código universitario"
                required
                error={errores.errors.universityCode}
                hint="Identifica al estudiante en el padrón; no puede repetirse."
              >
                <input
                  value={form.universityCode}
                  onChange={(e) => set('universityCode', e.target.value)}
                  placeholder="202100123"
                  aria-invalid={!!errores.errors.universityCode}
                />
              </FormField>
            </div>
          )}
          <p className="muted" style={{ fontSize: '0.8rem', marginTop: 0 }}>
            No se define contraseña: la persona recibe una invitación en su correo institucional
            y elige la suya. Usted nunca ve el enlace ni el código de activación.
          </p>
          <Button type="submit" loading={creating} icon={<FiUserPlus size={15} />}>
            Crear cuenta y enviar invitación
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
            <SearchInput value={search} onChange={setSearch} placeholder="Buscar por nombre o correo…" />
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
              <div className="table-scroll">
                <table>
                  <thead>
                    <tr>
                      <th>Nombre</th>
                      <th>Correo</th>
                      <th>Rol</th>
                      <th>Semestre</th>
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
                          <SemestreCelda user={u} onTeacher={() => setSemesterTarget(u)} onStudent={() => setEditing(u)} />
                        </td>
                        <td>
                          <Badge tone={STATUS_TONE[u.status] ?? 'gray'}>
                            {USER_STATUS_LABEL[u.status] ?? u.status}
                          </Badge>
                          {u.status === 'pending_activation' && <InvitacionLinea inv={u.invitation} />}
                        </td>
                        <td>
                          <div className="flex" style={{ gap: '0.35rem' }}>
                            <button
                              className="btn btn-secondary btn-sm"
                              onClick={() => setEditing(u)}
                              title="Editar datos"
                              aria-label={`Editar a ${u.firstName} ${u.lastName}`}
                            >
                              <FiEdit2 />
                            </button>
                            {u.status === 'pending_activation' ? (
                              <Button variant="secondary" size="sm" onClick={() => reenviar(u)} icon={<FiMail size={13} />}>
                                Reenviar invitación
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
              </div>
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
            toast.success('Usuario actualizado.');
            reload();
          }}
        />
      )}

      {semesterTarget && (
        <SemesterDialog
          teacher={semesterTarget}
          onClose={() => setSemesterTarget(null)}
          onSaved={(count) => {
            setSemesterTarget(null);
            toast.success(
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

function SemestreCelda({
  user,
  onTeacher,
  onStudent,
}: {
  user: PublicUser;
  onTeacher: () => void;
  onStudent: () => void;
}) {
  if (user.role === RolNombre.TEACHER) {
    return (
      <div className="flex" style={{ gap: '0.4rem', flexWrap: 'wrap' }}>
        {user.semesters && user.semesters.length > 0 ? (
          user.semesters.map((s) => (
            <Badge key={s} tone="bordo">
              {s}º
            </Badge>
          ))
        ) : (
          <span className="muted">Sin semestres</span>
        )}
        <Button variant="ghost" size="sm" onClick={onTeacher} icon={<FiSliders size={13} />}>
          Configurar
        </Button>
      </div>
    );
  }
  if (user.role === RolNombre.STUDENT) {
    return user.semester ? (
      <Badge tone="bordo">{user.semester}º semestre</Badge>
    ) : (
      <button type="button" className="link-warn" onClick={onStudent} title="Sin semestre, el perfil no puede completarse">
        <FiAlertTriangle size={13} /> Asignar semestre
      </button>
    );
  }
  return <span className="muted">—</span>;
}

/** Una línea bajo el estado: en qué quedó la invitación de una cuenta pendiente. */
function InvitacionLinea({ inv }: { inv?: InvitationView }) {
  if (!inv) return <div className="inv-line muted">Sin invitación enviada</div>;
  const cuando = inv.at ? new Date(inv.at).toLocaleString('es-BO', { dateStyle: 'short', timeStyle: 'short' }) : '';
  if (inv.status === 'failed') {
    return (
      <div className="inv-line inv-error" title={inv.error ?? undefined}>
        <FiXCircle size={12} /> El correo falló{inv.error ? `: ${inv.error}` : ''}
      </div>
    );
  }
  if (inv.status === 'queued') {
    return (
      <div className="inv-line muted">
        <FiClock size={12} /> Invitación en cola
      </div>
    );
  }
  if (inv.simulated) {
    return (
      <div className="inv-line inv-warn">
        <FiAlertTriangle size={12} /> Invitación simulada {cuando && `· ${cuando}`}
      </div>
    );
  }
  return (
    <div className="inv-line inv-ok">
      <FiSend size={12} /> Invitación enviada {cuando && `· ${cuando}`}
    </div>
  );
}

function EditUserDialog({
  user,
  onClose,
  onSaved,
}: {
  user: PublicUser;
  onClose: () => void;
  onSaved: () => void;
}) {
  const esEstudiante = user.role === RolNombre.STUDENT;
  const [form, setForm] = useState<Record<Campo, string>>({
    firstName: user.firstName,
    lastName: user.lastName,
    email: user.email,
    role: user.role,
    semester: user.semester ? String(user.semester) : '',
    universityCode: user.universityCode ?? '',
  });
  const [saving, setSaving] = useState(false);
  const errores = useFormErrors(CAMPOS);

  const set = (campo: Campo, valor: string) => {
    setForm((f) => ({ ...f, [campo]: valor }));
    errores.clear(campo);
  };

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    const locales = reglas(form);
    if (Object.keys(locales).length > 0) {
      errores.setErrors(locales);
      return;
    }
    setSaving(true);
    try {
      const body: Record<string, unknown> = {
        firstName: form.firstName.trim(),
        lastName: form.lastName.trim(),
        email: form.email.trim().toLowerCase(),
      };
      if (canChangeRole) body.role = form.role;
      if (esEstudiante) {
        body.semester = Number(form.semester);
        body.universityCode = form.universityCode.trim() || undefined;
      }
      await adminService.updateUser(user.id, body);
      onSaved();
    } catch (e2) {
      errores.fromApi(e2);
      setSaving(false);
    }
  };

  const canChangeRole = INSTITUTIONAL_ROLES.includes(user.role as RolNombre);

  return (
    <Modal title="Editar usuario" subtitle={user.email} onClose={onClose}>
      <form onSubmit={submit} noValidate>
        <FormAlert message={errores.general} />
        <div className="row">
          <FormField label="Nombres" required error={errores.errors.firstName}>
            <input value={form.firstName} onChange={(e) => set('firstName', e.target.value)} />
          </FormField>
          <FormField label="Apellidos" required error={errores.errors.lastName}>
            <input value={form.lastName} onChange={(e) => set('lastName', e.target.value)} />
          </FormField>
        </div>
        <FormField label="Correo institucional" required error={errores.errors.email}>
          <input type="email" value={form.email} onChange={(e) => set('email', e.target.value)} />
        </FormField>
        {esEstudiante && (
          <div className="row">
            <FormField
              label="Semestre que cursa"
              required
              error={errores.errors.semester}
              hint="Cambiarlo mueve al estudiante de alcance docente."
            >
              <select value={form.semester} onChange={(e) => set('semester', e.target.value)}>
                <option value="">Elige el semestre…</option>
                {SEMESTERS.map((s) => (
                  <option key={s} value={s}>
                    {s}º semestre
                  </option>
                ))}
              </select>
            </FormField>
            <FormField label="Código universitario" error={errores.errors.universityCode}>
              <input value={form.universityCode} onChange={(e) => set('universityCode', e.target.value)} />
            </FormField>
          </div>
        )}
        <FormField label="Rol" error={errores.errors.role}>
          {canChangeRole ? (
            <select value={form.role} onChange={(e) => set('role', e.target.value)}>
              {INSTITUTIONAL_ROLES.map((r) => (
                <option key={r} value={r}>
                  {ROLE_LABEL[r]}
                </option>
              ))}
            </select>
          ) : (
            <>
              <input value={ROLE_LABEL[user.role] ?? user.role} disabled />
              <span className="field-hint">
                El rol de estudiante y el de administrador no se cambian desde esta pantalla.
              </span>
            </>
          )}
        </FormField>
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
