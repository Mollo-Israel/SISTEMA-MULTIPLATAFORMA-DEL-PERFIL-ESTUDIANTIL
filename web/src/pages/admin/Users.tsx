import { memo, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  FiAlertTriangle, FiCheck, FiClock, FiEdit2, FiMail, FiPlus, FiSearch, FiSend, FiSliders, FiSlash,
  FiUserPlus, FiUsers, FiXCircle,
} from 'react-icons/fi';
import { apiError } from '../../api/client';
import { adminService, mailService } from '../../services';
import { useAsync } from '../../hooks/useAsync';
import { useParametrosUrl } from '../../hooks/useFiltroUrl';
import {
  AsyncView, Badge, Button, Card, EmptyState, FiltroEstado, GrillaEnCarga, Modal, PageHeader, SearchInput, SkeletonTable,
  FILAS_POR_PAGINA, Paginacion, ThOrden,
} from '../../components/ui';
import { FormAlert, FormField, useFormErrors } from '../../components/form';
import { useConfirm, useToast } from '../../components/feedback';
import {
  ROLE_LABEL, RolNombre, INSTITUTIONAL_ROLES, PROVISIONABLE_ROLES, SEMESTER_ROLES, SEMESTERS,
  UNIVERSITY_CODE_PREFIX, universityCodeExample,
} from '../../constants';
import { USER_STATUS_LABEL } from '../../services/types';
import type { InvitationView, PublicUser, UserStatus } from '../../services/types';
import {
  institutionalEmail, normalizeUniversityCode, personName, universityCodeFor, validate,
} from '../../lib/validators';

/** Color del estado en la tabla (§12). */
const STATUS_TONE: Record<UserStatus, string> = {
  pending_activation: 'amber',
  active: 'green',
  suspended: 'red',
  inactive: 'gray',
};

// V5-04: primer apellido obligatorio y segundo opcional, en campos separados.
const CAMPOS = ['firstName', 'firstSurname', 'secondSurname', 'email', 'role', 'semester', 'universityCode'] as const;
/** V6 §5.3: además, los semestres que dicta un docente (solo al crear). */
const CAMPOS_ALTA = [...CAMPOS, 'teacherSemesters'] as const;
type Campo = (typeof CAMPOS)[number];

// Sin contraseña a propósito (§12): la elige el titular al activar.
const emptyForm: Record<Campo, string> = {
  firstName: '',
  firstSurname: '',
  secondSurname: '',
  email: '',
  role: RolNombre.STUDENT,
  semester: '',
  universityCode: `${UNIVERSITY_CODE_PREFIX[RolNombre.STUDENT]}-`,
};

/**
 * V6 §5.3: dominio institucional que se agrega a la parte local según el rol.
 * Para la Sociedad científica no se asume ninguno: se escribe el correo
 * completo. Nunca se arma un correo a partir del nombre (hay homónimos).
 */
const DOMINIO_POR_ROL: Partial<Record<RolNombre, string>> = {
  [RolNombre.STUDENT]: 'est.univalle.edu',
  [RolNombre.TEACHER]: 'univalle.edu',
  [RolNombre.CAREER_DIRECTOR]: 'univalle.edu',
};

/** Ayuda del campo de correo según el rol tenga o no un dominio propio. */
function ayudaDelCorreo(conDominio: boolean, dominio?: string | null): string {
  if (conDominio) return 'Escribe lo que va antes de la @, tal como figura en el padrón; el dominio lo pone el rol.';
  return dominio ? 'Escribe el correo institucional exacto.' : 'Escribe el correo institucional exacto: para este rol no se asume un dominio.';
}

/** El correo que se enviará: parte local + dominio del rol, o el completo escrito a mano. */
function correoFinal(valor: string, rol: RolNombre, completo: boolean): string {
  const limpio = valor.trim().toLowerCase().replace(/\s+/g, '');
  const dominio = DOMINIO_POR_ROL[rol];
  if (!dominio || completo || limpio.includes('@')) return limpio;
  return limpio ? `${limpio}@${dominio}` : '';
}

/**
 * Al cambiar de rol, el código toma el prefijo del rol nuevo si todavía no se
 * escribió nada más que un prefijo. Lo ya escrito no se toca.
 */
function codigoParaRol(actual: string, rol: RolNombre): string {
  const limpio = actual.trim().toUpperCase();
  return !limpio || /^[A-Z]{0,3}-?$/.test(limpio) ? `${UNIVERSITY_CODE_PREFIX[rol]}-` : actual;
}

function reglas(form: Record<Campo, string>, completo: boolean) {
  return validate(form, {
    firstName: personName('nombre'),
    firstSurname: personName('apellido'),
    secondSurname: (v) => (v.trim() ? personName('apellido')(v) : null),
    email: (v) => {
      const local = v.trim().toLowerCase();
      if (DOMINIO_POR_ROL[form.role as RolNombre] && !completo && local && !local.includes('@') && !/^[a-z0-9._%+-]+$/.test(local)) {
        return 'Solo letras sin tilde, números, punto, guion o guion bajo, antes de la @.';
      }
      return institutionalEmail(correoFinal(v, form.role as RolNombre, completo));
    },
    semester: (v) => (SEMESTER_ROLES.includes(form.role as RolNombre) && !v ? 'Elige el semestre que cursa.' : null),
    universityCode: universityCodeFor(form.role as RolNombre),
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

/** V7.1 §4.1: un estado a la vez; por omisión, las activas. */
const ESTADOS_DE_CUENTA = [
  { value: 'active', label: 'Activas' },
  { value: 'pending_activation', label: 'Pendientes de activación' },
  { value: 'suspended', label: 'Suspendidas' },
  { value: 'inactive', label: 'Inactivas' },
  { value: 'all', label: 'Todas' },
] as const;
type EstadoFiltro = (typeof ESTADOS_DE_CUENTA)[number]['value'];
const ESTADOS_VALIDOS: readonly EstadoFiltro[] = ESTADOS_DE_CUENTA.map((o) => o.value);
const ROLES_VALIDOS: readonly string[] = ['', ...Object.keys(ROLE_LABEL)];
const ORDENES_VALIDOS = ['', 'name', 'email', 'role', 'semester', 'status'] as const;
type OrdenUsuarios = (typeof ORDENES_VALIDOS)[number];

/** Qué decir cuando el filtro no trae ninguna cuenta. */
const VACIO_POR_ESTADO: Record<EstadoFiltro, string> = {
  active: 'No hay cuentas activas.',
  pending_activation: 'No hay cuentas pendientes de activación.',
  suspended: 'No hay cuentas suspendidas.',
  inactive: 'No hay cuentas inactivas.',
  all: 'Todavía no hay usuarios registrados.',
};

export default function AdminUsersPage() {
  /*
   * V7.1 §4.1: los filtros viven en la URL (búsqueda, estado, rol, apellidos
   * por separar, orden y página). Se conservan al recargar y al volver, y el
   * Inicio puede traer aquí la grilla ya filtrada. El servidor filtra antes de
   * paginar: el total es siempre el del filtro.
   */
  const { leer, actualizar } = useParametrosUrl();
  const q = leer<string>('q', '');
  const estado = leer<EstadoFiltro>('status', 'active', ESTADOS_VALIDOS);
  // V3 §8.2: ?role=TEACHER filtra los docentes y cada docente muestra y edita sus semestres.
  const rol = leer<string>('role', '', ROLES_VALIDOS);
  const soloApellidos = leer<string>('surnames', '', ['', 'pending']) === 'pending';
  const sort = leer<OrdenUsuarios>('sort', '', ORDENES_VALIDOS);
  const dir = leer<'asc' | 'desc'>('dir', 'asc', ['asc', 'desc']);
  const pagina = Math.max(1, Math.trunc(Number(leer<string>('page', '1'))) || 1);
  const [search, setSearch] = useState(q);
  // Si la URL cambia desde fuera (Limpiar, un enlace), el buscador la sigue.
  useEffect(() => {
    if (q !== search.trim()) setSearch(q);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [q]);
  const { data, loading, error, reload } = useAsync(
    () => adminService.usersPage({
      search: q || undefined,
      role: rol || undefined,
      status: estado,
      surnames: soloApellidos ? 'pending' : undefined,
      sort: sort || undefined,
      dir: sort ? dir : undefined,
      limit: FILAS_POR_PAGINA,
      offset: (pagina - 1) * FILAS_POR_PAGINA,
    }),
    [q, rol, estado, soloApellidos, sort, dir, pagina],
  );
  const correo = useAsync(() => mailService.status(), []);

  /** Cambiar un filtro vuelve a la página 1. */
  const filtrar = (cambios: Record<string, string | null>) =>
    actualizar({ ...cambios, page: null }, { status: 'active' });
  const hayFiltros = !!q || estado !== 'active' || !!rol || soloApellidos;
  const limpiar = () => {
    setSearch('');
    actualizar({ q: null, status: null, role: null, surnames: null, sort: null, dir: null, page: null });
  };
  // Si la página quedó vacía (por ejemplo, tras suspender su última cuenta), se vuelve a la última que tiene filas.
  useEffect(() => {
    if (data && data.items.length === 0 && data.total > 0 && pagina > 1) {
      actualizar({ page: String(Math.ceil(data.total / FILAS_POR_PAGINA)) });
    }
  }, [data, pagina, actualizar]);

  const [form, setForm] = useState(emptyForm);
  /** V6 §5.3: escribir el correo completo en vez de la parte local. */
  const [correoCompleto, setCorreoCompleto] = useState(false);
  /** V6 §5.3: semestres que dicta un docente, desde la creación. */
  const [dicta, setDicta] = useState<number[]>([]);
  const [creating, setCreating] = useState(false);
  const errores = useFormErrors(CAMPOS_ALTA);
  const [editing, setEditing] = useState<PublicUser | null>(null);
  const [semesterTarget, setSemesterTarget] = useState<PublicUser | null>(null);
  const toast = useToast();
  const confirm = useConfirm();

  const rolElegido = form.role as RolNombre;
  const llevaSemestre = SEMESTER_ROLES.includes(rolElegido);
  const dominio = DOMINIO_POR_ROL[rolElegido];
  const conDominio = !!dominio && !correoCompleto;
  const vistaPrevia = correoFinal(form.email, rolElegido, correoCompleto);

  const set = (campo: Campo, valor: string) => {
    setForm((f) =>
      campo === 'role'
        ? { ...f, role: valor, universityCode: codigoParaRol(f.universityCode, valor as RolNombre) }
        : { ...f, [campo]: valor },
    );
    errores.clear(campo);
  };

  const create = async (e: React.FormEvent) => {
    e.preventDefault();
    const locales = reglas(form, correoCompleto);
    if (Object.keys(locales).length > 0) {
      errores.setErrors(locales);
      errores.setGeneral(null);
      return;
    }
    setCreating(true);
    try {
      const body: Record<string, unknown> = {
        firstName: form.firstName.trim(),
        firstSurname: form.firstSurname.trim(),
        ...(form.secondSurname.trim() ? { secondSurname: form.secondSurname.trim() } : {}),
        email: vistaPrevia,
        role: form.role,
        universityCode: normalizeUniversityCode(form.universityCode),
      };
      if (llevaSemestre) body.semester = Number(form.semester);
      if (rolElegido === RolNombre.TEACHER) body.teacherSemesters = dicta;
      const creado = await adminService.createUser(body);
      setForm({ ...emptyForm, role: form.role, universityCode: `${UNIVERSITY_CODE_PREFIX[rolElegido]}-` });
      setDicta([]);
      errores.reset();
      const aviso = describirInvitacion(creado.invitation);
      const titulo = `Cuenta creada: ${creado.firstName} ${creado.lastName}`;
      // V7.1 §4.1: una cuenta nueva está pendiente; con otro filtro no se ve en la grilla.
      const donde = estado === 'pending_activation' || estado === 'all'
        ? ''
        : ' Mientras no la active, está en «Pendientes de activación».';
      if (aviso.tono === 'error') toast.error(titulo, aviso.texto + donde);
      else if (aviso.tono === 'warn') toast.info(titulo, aviso.texto + donde);
      else toast.success(titulo, aviso.texto + donde);
      reload();
    } catch (error_) {
      errores.fromApi(error_);
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
    } catch (error_) {
      toast.error(apiError(error_));
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
    } catch (error_) {
      // 429: el reenvío está en pausa antispam; el mensaje dice cuánto falta.
      toast.info('Todavía no', apiError(error_));
    }
  };

  // La tabla no se vuelve a dibujar al escribir en el formulario: recibe
  // acciones con identidad estable que siempre llaman a la versión vigente.
  const vigentes = useRef({ editar: setEditing, docente: setSemesterTarget, reenviar, cambiarEstado });
  vigentes.current = { editar: setEditing, docente: setSemesterTarget, reenviar, cambiarEstado };
  const acciones = useMemo<AccionesTabla>(() => ({
    editar: (u) => vigentes.current.editar(u),
    docente: (u) => vigentes.current.docente(u),
    reenviar: (u) => vigentes.current.reenviar(u),
    cambiarEstado: (u, st) => vigentes.current.cambiarEstado(u, st),
  }), []);
  /** Un clic en la columna ordena; otro invierte el sentido. Vuelve a la página 1. */
  const alternarOrden = useCallback((clave: string) => {
    const misma = sort === clave;
    actualizar({ sort: clave, dir: misma && dir === 'asc' ? 'desc' : 'asc', page: null });
  }, [sort, dir, actualizar]);
  const orden = useMemo(() => (sort ? { clave: sort, dir } : null), [sort, dir]);
  const total = data?.total ?? 0;
  const paginas = Math.max(1, Math.ceil(total / FILAS_POR_PAGINA));
  const pie = {
    pagina,
    paginas,
    total,
    desde: total === 0 ? 0 : (pagina - 1) * FILAS_POR_PAGINA + 1,
    hasta: Math.min(pagina * FILAS_POR_PAGINA, total),
    ir: (n: number) => actualizar({ page: n <= 1 ? null : String(Math.min(n, paginas)) }),
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
              hint={ayudaDelCorreo(conDominio, dominio)}
            >
              <div className="correo-asistido">
                <input
                  type={conDominio ? 'text' : 'email'}
                  value={form.email}
                  onChange={(e) => {
                    // Si pega un correo completo, se respeta tal cual.
                    if (conDominio && e.target.value.includes('@')) setCorreoCompleto(true);
                    set('email', e.target.value);
                  }}
                  placeholder={conDominio ? 'nombre.apellido' : 'nombre.apellido@univalle.edu'}
                  aria-invalid={!!errores.errors.email}
                  aria-describedby="correo-vista-previa"
                  autoCapitalize="none"
                  spellCheck={false}
                />
                {conDominio && <span className="correo-dominio" aria-hidden>@{dominio}</span>}
              </div>
              <span id="correo-vista-previa" className="muted small" data-testid="correo-vista-previa">
                {vistaPrevia ? <>Se invitará a <strong>{vistaPrevia}</strong></> : 'Aquí verás el correo completo antes de crear la cuenta.'}
              </span>
              {dominio && (
                <label className="flex small" style={{ gap: '0.35rem', alignItems: 'center' }}>
                  <input type="checkbox" checked={correoCompleto} onChange={(e) => { setCorreoCompleto(e.target.checked); errores.clear('email'); }} />
                  <span>Escribir el correo completo</span>
                </label>
              )}
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
            <FormField label="Primer apellido" required error={errores.errors.firstSurname}>
              <input
                value={form.firstSurname}
                onChange={(e) => set('firstSurname', e.target.value)}
                placeholder="Pérez"
                aria-invalid={!!errores.errors.firstSurname}
              />
            </FormField>
            <FormField label="Segundo apellido" error={errores.errors.secondSurname} hint="Opcional.">
              <input
                value={form.secondSurname}
                onChange={(e) => set('secondSurname', e.target.value)}
                placeholder="Rojas"
                aria-invalid={!!errores.errors.secondSurname}
              />
            </FormField>
          </div>
          <div className="row">
            {llevaSemestre && (
              <FormField
                label="Semestre que cursa"
                required
                error={errores.errors.semester}
                hint="Lo fija la universidad: la persona no puede cambiarlo."
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
            )}
            {rolElegido === RolNombre.TEACHER && (
              <FormField
                label="Semestres que dicta"
                error={errores.errors.teacherSemesters}
                hint="Opcional. Sin semestres, la cuenta queda pendiente de configuración y no gestiona ningún semestre."
              >
                <fieldset className="semester-grid" aria-label="Semestres que dicta" data-testid="dicta">
                  {SEMESTERS.map((s) => {
                    const on = dicta.includes(s);
                    return (
                      <button
                        type="button"
                        key={s}
                        className={`semester-opt ${on ? 'on' : ''}`}
                        aria-pressed={on}
                        onClick={() => { setDicta(on ? dicta.filter((x) => x !== s) : [...dicta, s].sort((a, b) => a - b)); errores.clear('teacherSemesters'); }}
                      >
                        <span className="n">{s}º</span>
                        <span className="chk">{on && <FiCheck size={12} />}</span>
                      </button>
                    );
                  })}
                </fieldset>
              </FormField>
            )}
            <FormField
              label="Código universitario"
              required
              error={errores.errors.universityCode}
              hint={`${UNIVERSITY_CODE_PREFIX[rolElegido]}- y 7 letras o números. No puede repetirse.`}
            >
              <input
                value={form.universityCode}
                onChange={(e) => set('universityCode', e.target.value.toUpperCase())}
                placeholder={universityCodeExample(rolElegido)}
                maxLength={11}
                autoCapitalize="characters"
                spellCheck={false}
                aria-invalid={!!errores.errors.universityCode}
              />
            </FormField>
          </div>
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
          <div className="flex" style={{ gap: '0.5rem', flexWrap: 'wrap' }}>
            {/* V3.2 §6.2 y §7.7: filtra al dejar de escribir, sin Enter. */}
            <SearchInput
              value={search}
              onChange={setSearch}
              onDebouncedChange={(v) => { if (v.trim() !== q) filtrar({ q: v.trim() }); }}
              placeholder="Buscar por nombre, correo o código…"
            />
            <Button type="button" variant="secondary" size="sm" disabled={!hayFiltros && !search} onClick={limpiar}>
              Limpiar
            </Button>
          </div>
        }
      >
        <div className="flex" style={{ marginBottom: '0.6rem', gap: '0.6rem', flexWrap: 'wrap', alignItems: 'center' }}>
          <FiltroEstado
            etiqueta="Estado de la cuenta"
            valor={estado}
            opciones={ESTADOS_DE_CUENTA}
            onChange={(v) => filtrar({ status: v })}
          />
          <select
            value={rol}
            aria-label="Filtrar por rol"
            onChange={(e) => filtrar({ role: e.target.value })}
            style={{ maxWidth: 220 }}
          >
            <option value="">Todos los roles</option>
            {Object.entries(ROLE_LABEL).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
          </select>
          {/* V6 §5.2 (V5-04): solo si quedan apellidos heredados por separar en este filtro. La
              corrección sigue disponible en cada cuenta que lo necesite. */}
          {((data?.surnamesPending ?? 0) > 0 || soloApellidos) && (
            <label className="flex" style={{ gap: '0.35rem', alignItems: 'center' }} data-testid="apellidos-por-separar">
              <input type="checkbox" checked={soloApellidos} onChange={(e) => filtrar({ surnames: e.target.checked ? 'pending' : null })} />
              Apellidos por separar ({data?.surnamesPending ?? 0})
            </label>
          )}
          {rol === RolNombre.TEACHER && (
            <span className="muted small">Cada docente ve solo a los estudiantes de los semestres que tiene habilitados.</span>
          )}
        </div>
        <GrillaEnCarga cargando={loading && !!data}>
          <AsyncView
            loading={loading}
            error={error}
            data={data}
            skeleton={<SkeletonTable rows={6} columns={6} />}
            isEmpty={(d) => d.items.length === 0}
            empty={
              q || rol || soloApellidos ? (
                <EmptyState
                  icon={<FiSearch size={22} />}
                  message={q ? `Ninguna cuenta coincide con “${q}” en este filtro.` : 'Ninguna cuenta coincide con los filtros.'}
                  action={<Button variant="secondary" size="sm" onClick={limpiar}>Limpiar filtros</Button>}
                />
              ) : undefined
            }
            emptyMessage={VACIO_POR_ESTADO[estado]}
          >
            {(p) => (
              <>
                <TablaUsuarios usuarios={p.items} orden={orden} alternar={alternarOrden} acciones={acciones} />
                <Paginacion {...pie} noun="usuarios" />
              </>
            )}
          </AsyncView>
        </GrillaEnCarga>
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

interface AccionesTabla {
  editar: (u: PublicUser) => void;
  docente: (u: PublicUser) => void;
  reenviar: (u: PublicUser) => void;
  cambiarEstado: (u: PublicUser, status: UserStatus) => void;
}

/**
 * La página de cuentas, aparte del formulario.
 *
 * V7.1 §4.1: filtrar, ordenar y paginar lo hace el servidor; aquí solo se
 * dibujan las diez filas que llegan. Memorizada, no se vuelve a dibujar en
 * cada tecla que se escribe en «Crear una cuenta».
 */
const TablaUsuarios = memo(function TablaUsuarios({
  usuarios,
  orden,
  alternar,
  acciones,
}: {
  usuarios: PublicUser[];
  orden: { clave: string; dir: 'asc' | 'desc' } | null;
  alternar: (clave: string) => void;
  acciones: AccionesTabla;
}) {
  return (
    <>
      <div className="table-scroll">
        <table>
          <thead>
            <tr>
              <ThOrden clave="name" orden={orden} alternar={alternar}>Nombre</ThOrden>
              <ThOrden clave="email" orden={orden} alternar={alternar}>Correo</ThOrden>
              <ThOrden clave="role" orden={orden} alternar={alternar}>Rol</ThOrden>
              <ThOrden clave="semester" orden={orden} alternar={alternar}>Semestre</ThOrden>
              <ThOrden clave="status" orden={orden} alternar={alternar}>Estado</ThOrden>
              <th><span className="sr-only">Acciones</span></th>
            </tr>
          </thead>
          <tbody>
            {usuarios.map((u) => (
              <tr key={u.id}>
                <td>
                  {u.firstName} {u.lastName}
                  {u.universityCode && <div className="muted small">{u.universityCode}</div>}
                </td>
                <td className="muted">{u.email}</td>
                <td>{ROLE_LABEL[u.role] ?? u.role}</td>
                <td>
                  <SemestreCelda user={u} onTeacher={() => acciones.docente(u)} onStudent={() => acciones.editar(u)} />
                </td>
                <td>
                  <Badge tone={estadoCuenta(u).tone}>{estadoCuenta(u).label}</Badge>
                  {u.status === 'pending_activation' && <InvitacionLinea inv={u.invitation} />}
                </td>
                <td>
                  <div className="flex" style={{ gap: '0.35rem' }}>
                    <button
                      className="btn btn-secondary btn-sm"
                      onClick={() => acciones.editar(u)}
                      title="Editar datos"
                      aria-label={`Editar a ${u.firstName} ${u.lastName}`}
                    >
                      <FiEdit2 />
                    </button>
                    {u.status === 'pending_activation' ? (
                      <Button variant="secondary" size="sm" onClick={() => acciones.reenviar(u)} icon={<FiMail size={13} />}>
                        Reenviar invitación
                      </Button>
                    ) : (
                      <Button
                        variant="secondary"
                        size="sm"
                        onClick={() => acciones.cambiarEstado(u, u.status === 'active' ? 'suspended' : 'active')}
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
  );
});

/* ------------------------------------------------------------------ */

function SemestreCelda({
  user,
  onTeacher,
  onStudent,
}: Readonly<{
  user: PublicUser;
  onTeacher: () => void;
  onStudent: () => void;
}>) {
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
  if (SEMESTER_ROLES.includes(user.role as RolNombre)) {
    return user.semester ? (
      <span className="flex" style={{ gap: '0.3rem', flexWrap: 'wrap' }}>
        <Badge tone="bordo">{user.semester}º semestre</Badge>
        {(user.academicScopeSemesters ?? []).length > 0 && (
          <Badge tone="gray">+ {user.academicScopeSemesters!.map((s) => `${s}º`).join(', ')}</Badge>
        )}
      </span>
    ) : (
      <button type="button" className="link-warn" onClick={onStudent} title="Falta el semestre que cursa">
        <FiAlertTriangle size={13} /> Asignar semestre
      </button>
    );
  }
  return <span className="muted">—</span>;
}

/** Una línea bajo el estado: en qué quedó la invitación de una cuenta pendiente. */
/**
 * V3.2 §8.6: el estado que el administrador necesita leer de un vistazo.
 * Una cuenta pendiente cuyo último enlace venció es «Caducada»: hay que
 * reenviar la invitación.
 */
function estadoCuenta(u: PublicUser): { label: string; tone: string } {
  if (u.status === 'pending_activation') {
    return u.invitation?.expired ? { label: 'Caducada', tone: 'red' } : { label: 'Pendiente', tone: 'amber' };
  }
  return { label: USER_STATUS_LABEL[u.status] ?? u.status, tone: STATUS_TONE[u.status] ?? 'gray' };
}

function InvitacionLinea({ inv }: Readonly<{ inv?: InvitationView }>) {
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
  // V3.2 §8.6: cuándo se envió, cuándo expira y si ya caducó.
  const expira = inv.expiresAt ? new Date(inv.expiresAt).toLocaleString('es-BO', { dateStyle: 'short', timeStyle: 'short' }) : null;
  if (inv.expired) {
    return (
      <div className="inv-line inv-error">
        <FiXCircle size={12} /> Invitación caducada{expira ? ` el ${expira}` : ''}: reenvíala
      </div>
    );
  }
  return (
    <div className="inv-line inv-ok">
      <FiSend size={12} /> Invitación enviada {cuando && `· ${cuando}`}
      {expira && <span className="muted"> · Expira: {expira}</span>}
    </div>
  );
}

function EditUserDialog({
  user,
  onClose,
  onSaved,
}: Readonly<{
  user: PublicUser;
  onClose: () => void;
  onSaved: () => void;
}>) {
  const [form, setForm] = useState<Record<Campo, string>>({
    firstName: user.firstName,
    // V5-04 (A02): un apellido heredado sin separar se muestra aparte y se separa aquí.
    firstSurname: user.firstSurname ?? '',
    secondSurname: user.secondSurname ?? '',
    email: user.email,
    role: user.role,
    semester: user.semester ? String(user.semester) : '',
    universityCode: user.universityCode ?? '',
  });
  const [arrastre, setArrastre] = useState<number[]>(user.academicScopeSemesters ?? []);
  const [saving, setSaving] = useState(false);
  const errores = useFormErrors(CAMPOS);
  const rolEditado = form.role as RolNombre;
  const llevaSemestre = SEMESTER_ROLES.includes(rolEditado);

  const set = (campo: Campo, valor: string) => {
    setForm((f) => ({ ...f, [campo]: valor }));
    errores.clear(campo);
  };

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    const locales = reglas(form, true);
    if (Object.keys(locales).length > 0) {
      errores.setErrors(locales);
      return;
    }
    setSaving(true);
    try {
      const body: Record<string, unknown> = {
        firstName: form.firstName.trim(),
        firstSurname: form.firstSurname.trim(),
        secondSurname: form.secondSurname.trim() || null,
        email: form.email.trim().toLowerCase(),
      };
      if (canChangeRole) body.role = form.role;
      body.universityCode = normalizeUniversityCode(form.universityCode);
      if (llevaSemestre) body.semester = Number(form.semester);
      if (rolEditado === RolNombre.STUDENT) {
        body.academicScopeSemesters = arrastre.filter((x) => x !== Number(form.semester));
      }
      await adminService.updateUser(user.id, body);
      onSaved();
    } catch (error_) {
      errores.fromApi(error_);
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
          <FormField label="Primer apellido" required error={errores.errors.firstSurname}>
            <input value={form.firstSurname} onChange={(e) => set('firstSurname', e.target.value)} />
          </FormField>
          <FormField label="Segundo apellido" error={errores.errors.secondSurname} hint="Opcional.">
            <input value={form.secondSurname} onChange={(e) => set('secondSurname', e.target.value)} />
          </FormField>
        </div>
        {user.surnamesPending && (
          <output className="inline-note">
            Apellido registrado: <strong>{user.lastName}</strong>. No se separó automáticamente para no
            confundir un apellido compuesto con dos; indica cuál es el primero y cuál el segundo.
          </output>
        )}
        <FormField label="Correo institucional" required error={errores.errors.email}>
          <input type="email" value={form.email} onChange={(e) => set('email', e.target.value)} />
        </FormField>
        <div className="row">
          {llevaSemestre && (
            <FormField
              label="Semestre que cursa"
              required
              error={errores.errors.semester}
              hint="Cambiarlo puede mover a la persona de alcance docente."
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
          )}
          <FormField
            label="Código universitario"
            required
            error={errores.errors.universityCode}
            hint={`${UNIVERSITY_CODE_PREFIX[rolEditado]}- y 7 letras o números.`}
          >
            <input
              value={form.universityCode}
              onChange={(e) => set('universityCode', e.target.value.toUpperCase())}
              placeholder={universityCodeExample(rolEditado)}
              maxLength={11}
              spellCheck={false}
            />
          </FormField>
        </div>
        {rolEditado === RolNombre.STUDENT && (
          <FormField
            label="Semestres adicionales (arrastre o repetición)"
            hint="Solo en casos excepcionales. El docente de esos semestres también podrá acompañar a este estudiante."
          >
            <div className="flex" style={{ gap: '0.35rem', flexWrap: 'wrap' }}>
              {SEMESTERS.filter((x) => x !== Number(form.semester)).map((x) => {
                const marcado = arrastre.includes(x);
                return (
                  <button
                    key={x}
                    type="button"
                    className={`chip ${marcado ? 'on' : ''}`}
                    aria-pressed={marcado}
                    onClick={() => setArrastre((a) => (marcado ? a.filter((y) => y !== x) : [...a, x].sort((p, q) => p - q)))}
                  >
                    {x}º
                  </button>
                );
              })}
            </div>
          </FormField>
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
}: Readonly<{
  teacher: PublicUser;
  onClose: () => void;
  onSaved: (count: number) => void;
  onError: (msg: string) => void;
}>) {
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
    setSelected((prev) => (prev.includes(s) ? prev.filter((x) => x !== s) : [...prev, s].sort((a, b) => a - b)));

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
