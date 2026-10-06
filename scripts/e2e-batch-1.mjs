/**
 * BATCH 1 — Identidad y seguridad.
 *
 * Cubre lo que la especificación exige probar en §87.2 (importación) y §87.3
 * (activación), más las sesiones de §14 y el alcance docente de §68.
 *
 * Uso:
 *   API_URL=http://localhost:3010/api node scripts/e2e-batch-1.mjs
 */

import { asegurarCorreoDePrueba, leerCorreo, codigoUniversitario } from './lib/fixtures.mjs';

const API = process.env.API_URL ?? 'http://localhost:3010/api';
const TS = Date.now();
const PWD = 'Afinia2026Seg*';
const OTRA_PWD = 'Afinia2026Otra*';

const C = {
  r: '\x1b[0m',
  bold: '\x1b[1m',
  dim: '\x1b[90m',
  ok: '\x1b[32m',
  bad: '\x1b[31m',
  head: '\x1b[36m',
};

let passed = 0;
const failures = [];

function check(condition, label, detail = '') {
  if (condition) {
    passed++;
    console.log(`  ${C.ok}✓${C.r} ${label}`);
  } else {
    failures.push(label + (detail ? ` -> ${detail}` : ''));
    console.log(`  ${C.bad}✗${C.r} ${label}${detail ? ` ${C.dim}-> ${detail}${C.r}` : ''}`);
  }
}

const objective = (t) => console.log(`\n${C.head}${C.bold}${t}${C.r}`);
const section = (t) => console.log(`\n${C.bold}${t}${C.r}`);

async function req(method, path, { token, body, raw } = {}) {
  const res = await fetch(`${API}${path}`, {
    method,
    headers: {
      ...(raw ? {} : { 'Content-Type': 'application/json' }),
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: raw ?? (body ? JSON.stringify(body) : undefined),
  });
  let data = null;
  try {
    data = await res.json();
  } catch {
    /* sin cuerpo */
  }
  return { status: res.status, data };
}

const msgOf = (r) =>
  Array.isArray(r?.data?.message) ? r.data.message.join(' | ') : (r?.data?.message ?? '');

// Formato EST-XXXXXXX: 4 caracteres de esta ejecución y 3 del número de fila.
const RUN = (TS % 1679616).toString(36).toUpperCase().padStart(4, '0');
const codigo = (n) => `EST-${RUN}${String(n).padStart(3, '0')}`;
const correo = (k) => `b1.${k}.${TS}@est.univalle.edu`;

/** Construye un CSV de padrón a partir de filas. */
function csv(rows) {
  const header = 'university_code,first_name,last_name,institutional_email,semester';
  const body = rows
    .map((r) =>
      [r.code ?? '', r.first ?? '', r.last ?? '', r.email ?? '', r.semester ?? ''].join(','),
    )
    .join('\n');
  return `${header}\n${body}\n`;
}

/** Sube un CSV como multipart, sin dependencias externas. */
async function subirCsv(token, contenido, filename = 'padron.csv') {
  const form = new FormData();
  form.append('file', new Blob([contenido], { type: 'text/csv' }), filename);
  const res = await fetch(`${API}/imports/students/preview`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}` },
    body: form,
  });
  let data = null;
  try {
    data = await res.json();
  } catch {
    /* sin cuerpo */
  }
  return { status: res.status, data };
}

// ===========================================================================
//  RF01 · Importación de padrón (§10, §87.2)
// ===========================================================================
async function importacion(ctx) {
  objective('RF01 · Importación de padrón institucional');

  section('Previsualización: los cinco veredictos');

  const nuevoA = { code: codigo(1), first: 'Lucia', last: 'Ferrer', email: correo('imp1'), semester: 3 };
  const nuevoB = { code: codigo(2), first: 'Marco', last: 'Rios', email: correo('imp2'), semester: 5 };

  const base = await subirCsv(
    ctx.admin,
    csv([
      nuevoA,
      nuevoB,
      { code: codigo(3), first: '', last: 'SinNombre', email: correo('imp3'), semester: 2 },
      { code: codigo(4), first: 'Dominio', last: 'Ajeno', email: `x.${TS}@gmail.com`, semester: 2 },
      { code: codigo(5), first: 'Semestre', last: 'Malo', email: correo('imp5'), semester: 99 },
    ]),
  );
  check(base.status === 201 || base.status === 200, 'B1.1 La previsualización responde', `status ${base.status} ${msgOf(base)}`);
  check(base.data?.counts?.new === 2, 'B1.2 Dos filas válidas se marcan como NEW', `new=${base.data?.counts?.new}`);
  check(base.data?.counts?.invalid === 3, 'B1.3 Tres filas defectuosas se marcan como INVALID', `invalid=${base.data?.counts?.invalid}`);
  check(
    base.data?.rows?.some((r) => (r.message ?? '').includes('nombre')),
    'B1.4 El rechazo explica el motivo fila por fila',
  );
  check(
    base.data?.rows?.some((r) => (r.message ?? '').includes('dominio institucional')),
    'B1.5 Un correo fuera del dominio institucional se rechaza (§11)',
  );

  section('La previsualización no escribe nada');
  const antes = await req('GET', `/users?search=${encodeURIComponent('Ferrer')}`, { token: ctx.admin });
  check(
    !(antes.data ?? []).some((u) => u.email === nuevoA.email),
    'B1.6 Previsualizar NO crea cuentas',
  );

  section('Aplicar');
  const aplicado = await req('POST', `/imports/students/${base.data?.batchId}/apply`, {
    token: ctx.admin,
  });
  check(aplicado.status === 201 || aplicado.status === 200, 'B1.7 Aplicar responde', `status ${aplicado.status} ${msgOf(aplicado)}`);
  check(aplicado.data?.created === 2, 'B1.8 Se crean exactamente las dos cuentas válidas', `created=${aplicado.data?.created}`);

  const creados = await req('GET', `/users?search=${encodeURIComponent(nuevoA.email)}`, { token: ctx.admin });
  const cuentaA = (creados.data ?? [])[0];
  check(!!cuentaA, 'B1.9 La cuenta importada existe');
  check(
    cuentaA?.status === 'pending_activation',
    'B1.10 Nace en PENDING_ACTIVATION, no utilizable',
    `status=${cuentaA?.status}`,
  );
  check(cuentaA?.role === 'STUDENT', 'B1.11 El padrón produce estudiantes');

  section('Idempotencia (§10.1)');
  const segunda = await subirCsv(ctx.admin, csv([nuevoA, nuevoB]));
  check(
    segunda.data?.counts?.unchanged === 2,
    'B1.12 Reimportar el mismo archivo no cambia nada: UNCHANGED',
    `unchanged=${segunda.data?.counts?.unchanged}`,
  );
  const reAplicado = await req('POST', `/imports/students/${segunda.data?.batchId}/apply`, {
    token: ctx.admin,
  });
  check(
    reAplicado.data?.created === 0,
    'B1.13 Aplicar la reimportación no duplica cuentas',
    `created=${reAplicado.data?.created}`,
  );

  section('Actualización segura (§10.2)');
  const conCambio = await subirCsv(
    ctx.admin,
    csv([{ ...nuevoA, semester: 7 }]),
  );
  check(
    conCambio.data?.counts?.update === 1,
    'B1.14 Un semestre distinto se marca como UPDATE',
    `update=${conCambio.data?.counts?.update}`,
  );
  await req('POST', `/imports/students/${conCambio.data?.batchId}/apply`, { token: ctx.admin });
  const tras = await req('GET', `/users?search=${encodeURIComponent(nuevoA.email)}`, { token: ctx.admin });
  check(!!(tras.data ?? [])[0], 'B1.15 La cuenta sigue existiendo tras actualizar');

  section('Conflicto de identidad (§10.1)');
  const conflicto = await subirCsv(
    ctx.admin,
    csv([{ code: codigo(90), first: 'Otra', last: 'Persona', email: nuevoA.email, semester: 4 }]),
  );
  check(
    conflicto.data?.counts?.conflict === 1,
    'B1.16 Un correo ya asignado a otro código es CONFLICT, no se resuelve solo',
    `conflict=${conflicto.data?.counts?.conflict}`,
  );

  const duplicadoInterno = await subirCsv(
    ctx.admin,
    csv([
      { code: codigo(91), first: 'Uno', last: 'Repetido', email: correo('rep'), semester: 3 },
      { code: codigo(91), first: 'Dos', last: 'Repetido', email: correo('rep2'), semester: 3 },
    ]),
  );
  check(
    duplicadoInterno.data?.counts?.conflict === 1,
    'B1.17 Un código repetido dentro del propio archivo es CONFLICT',
    `conflict=${duplicadoInterno.data?.counts?.conflict}`,
  );

  section('Ausencia no desactiva (§10.3)');
  const soloB = await subirCsv(ctx.admin, csv([nuevoB]));
  await req('POST', `/imports/students/${soloB.data?.batchId}/apply`, { token: ctx.admin });
  const aSigue = await req('GET', `/users?search=${encodeURIComponent(nuevoA.email)}`, { token: ctx.admin });
  check(
    (aSigue.data ?? [])[0]?.status === 'pending_activation',
    'B1.18 Una cuenta ausente del archivo nuevo NO se desactiva',
    `status=${(aSigue.data ?? [])[0]?.status}`,
  );

  section('Auditoría del lote (§10.4)');
  const historial = await req('GET', '/imports/students', { token: ctx.admin });
  check(historial.status === 200 && (historial.data ?? []).length > 0, 'B1.19 El historial de importaciones queda registrado');
  const detalle = await req('GET', `/imports/students/${base.data?.batchId}`, { token: ctx.admin });
  check(
    detalle.status === 200 && (detalle.data?.rows ?? []).length === 5,
    'B1.20 El detalle conserva las cinco filas con su veredicto',
    `rows=${(detalle.data?.rows ?? []).length}`,
  );

  section('Solo el administrador importa');
  const ajeno = await subirCsv(ctx.estudiante, csv([nuevoA]));
  check(ajeno.status === 403, 'B1.21 Un estudiante NO puede importar padrón -> 403', `status ${ajeno.status}`);

  ctx.importado = { ...nuevoA, id: cuentaA?.id };
}

// ===========================================================================
//  RF02 · Activación (§12, §87.3)
// ===========================================================================
async function activacion(ctx) {
  objective('RF02 · Activación de cuenta');

  section('El enlace llega al buzón del titular, no al administrador');
  // La invitación de la importación ya salió: se lee del buzón, como lo haría
  // el estudiante.
  const original = await leerCorreo(ctx.importado.email, { tipo: 'account_activation' });
  const token1 = original.token;
  check(!!token1, 'B2.1 La importación envió la invitación al correo institucional');

  const reenvio = await req('POST', `/users/${ctx.importado.id}/resend-activation`, {
    token: ctx.admin,
  });
  check(
    reenvio.status === 429 && (reenvio.data?.retryAfterSeconds ?? 0) > 0,
    'B2.2 Reenviar enseguida se frena: evita llenar el buzón y caer en spam -> 429',
    `status ${reenvio.status} · espera ${reenvio.data?.retryAfterSeconds}`,
  );

  section('Un token nuevo invalida el anterior (§12)');
  const espera = Math.min(Number(reenvio.data?.retryAfterSeconds ?? 0), 130);
  if (espera > 0) {
    console.log(`    … esperando ${espera} s, la pausa antispam entre envíos`);
    await new Promise((r) => setTimeout(r, espera * 1000 + 300));
  }
  const desde = Date.now();
  const reenvio2 = await req('POST', `/users/${ctx.importado.id}/resend-activation`, {
    token: ctx.admin,
  });
  check(
    reenvio2.status === 200 && !JSON.stringify(reenvio2.data ?? {}).includes('token'),
    'B2.2b Pasada la pausa, el reenvío funciona y no le entrega el código al administrador',
    `status ${reenvio2.status}`,
  );
  const token2 = (await leerCorreo(ctx.importado.email, { tipo: 'account_activation', desde })).token;
  check(!!token2 && token2 !== token1, 'B2.2c El reenvío emite un token distinto');

  const conAnterior = await req('POST', '/activation/activate', {
    body: { token: token1, password: PWD },
  });
  check(
    conAnterior.status === 400 && /reciente|anulado/i.test(msgOf(conAnterior)),
    'B2.3 El token anterior queda revocado, y se dice por qué -> 400',
    `status ${conAnterior.status} · ${msgOf(conAnterior)}`,
  );

  section('Política de contraseña (§13)');
  const corta = await req('POST', '/activation/activate', {
    body: { token: token2, password: 'Corta1*' },
  });
  check(corta.status === 400, 'B2.4 Menos de 12 caracteres -> 400', `status ${corta.status}`);

  const conCorreo = await req('POST', '/activation/activate', {
    body: { token: token2, password: `B1.${ctx.importado.email.split('@')[0]}X9*` },
  });
  check(
    conCorreo.status === 400,
    'B2.5 La contraseña no puede contener el correo -> 400',
    `status ${conCorreo.status}`,
  );

  section('Activación válida');
  const ok = await req('POST', '/activation/activate', {
    body: { token: token2, password: PWD },
  });
  check(ok.status === 200, 'B2.6 Activación con token válido -> 200', `status ${ok.status} ${msgOf(ok)}`);

  const reuso = await req('POST', '/activation/activate', {
    body: { token: token2, password: PWD },
  });
  check(reuso.status === 400, 'B2.7 El token usado no vuelve a servir -> 400', `status ${reuso.status}`);

  const login = await req('POST', '/auth/login', {
    body: { email: ctx.importado.email, password: PWD },
  });
  check(login.status === 200 && !!login.data?.accessToken, 'B2.8 Tras activar, la cuenta inicia sesión');
  check(!!login.data?.refreshToken, 'B2.9 El login entrega también un refresh token (§14)');
  ctx.importadoSesion = login.data;

  const yaActivada = await req('POST', `/users/${ctx.importado.id}/resend-activation`, {
    token: ctx.admin,
  });
  check(
    yaActivada.status === 400,
    'B2.10 No se reenvía activación de una cuenta ya activada -> 400',
    `status ${yaActivada.status}`,
  );

  section('No se pueden enumerar cuentas (§12)');
  const existe = await req('POST', '/activation/forgot-password', {
    body: { email: ctx.importado.email },
  });
  const noExiste = await req('POST', '/activation/forgot-password', {
    body: { email: `fantasma.${TS}@univalle.edu` },
  });
  check(
    existe.status === noExiste.status && existe.data?.message === noExiste.data?.message,
    'B2.11 La respuesta es idéntica exista o no la cuenta',
    `${existe.status} vs ${noExiste.status}`,
  );
}

// ===========================================================================
//  RF03 · Sesiones (§14)
// ===========================================================================
async function sesiones(ctx) {
  objective('RF03 · Sesiones revocables y refresh rotatorio');

  section('Rotación');
  const primer = ctx.importadoSesion.refreshToken;
  const refrescado = await req('POST', '/auth/refresh', { body: { refreshToken: primer } });
  check(refrescado.status === 200 && !!refrescado.data?.accessToken, 'B3.1 El refresh entrega un access token nuevo');
  check(
    refrescado.data?.refreshToken && refrescado.data.refreshToken !== primer,
    'B3.2 El refresh token rota en cada uso',
  );

  // Recargar la página en medio de una renovación descarta la respuesta con el
  // token nuevo: el cliente vuelve a presentar el anterior. Dentro de la gracia
  // (REFRESH_TOKEN_REUSE_GRACE_SECONDS) sirve, pero una sola vez.
  const reutilizado = await req('POST', '/auth/refresh', { body: { refreshToken: primer } });
  check(
    reutilizado.status === 200 && !!reutilizado.data?.refreshToken && reutilizado.data.refreshToken !== refrescado.data?.refreshToken,
    'B3.3 Recarga en medio de la renovación: el token recién reemplazado sirve una vez y emite otro',
    `status ${reutilizado.status}`,
  );
  const otraVez = await req('POST', '/auth/refresh', { body: { refreshToken: primer } });
  check(
    otraVez.status === 401,
    'B3.3c Usado otra vez, el token anterior ya no sirve -> 401',
    `status ${otraVez.status}`,
  );

  // Dos renovaciones a la vez con el mismo token (dos pestañas, o un 401 en
  // varias peticiones juntas): ninguna puede tumbar la sesión de la otra.
  const actual = reutilizado.data?.refreshToken;
  const [a1, a2] = await Promise.all([
    req('POST', '/auth/refresh', { body: { refreshToken: actual } }),
    req('POST', '/auth/refresh', { body: { refreshToken: actual } }),
  ]);
  check(
    a1.status === 200 && a2.status === 200,
    'B3.3d Dos renovaciones simultáneas con el mismo token: las dos responden 200',
    `status ${a1.status} y ${a2.status}`,
  );

  // El access token renovado tiene que servir de verdad. Los clientes web y
  // móvil dependen de esto para recuperar la sesión al arrancar sin obligar a
  // escribir la contraseña otra vez.
  const conNuevo = await req('GET', '/auth/me', { token: refrescado.data.accessToken });
  check(
    conNuevo.status === 200 && conNuevo.data?.id === ctx.importadoSesion.user?.id,
    'B3.3b El access token renovado identifica al mismo usuario',
    `status ${conNuevo.status}`,
  );

  section('Revocación');
  // El que quedó vigente: la segunda rotación de la carrera anterior.
  const vigente = a2.data?.refreshToken ?? a1.data?.refreshToken;
  const sesiones = await req('GET', '/auth/sessions', { token: refrescado.data.accessToken });
  check(sesiones.status === 200 && (sesiones.data ?? []).length >= 1, 'B3.4 El usuario ve sus sesiones abiertas');

  const logout = await req('POST', '/auth/logout', { body: { refreshToken: vigente } });
  check(logout.status === 200, 'B3.5 Cerrar sesión responde 200');
  const trasLogout = await req('POST', '/auth/refresh', { body: { refreshToken: vigente } });
  check(
    trasLogout.status === 401,
    'B3.6 Tras cerrar sesión, su refresh token no sirve -> 401',
    `status ${trasLogout.status}`,
  );

  section('Cambiar la contraseña cierra todas las sesiones (§14)');
  const relogin = await req('POST', '/auth/login', {
    body: { email: ctx.importado.email, password: PWD },
  });
  const antes = relogin.data?.refreshToken;

  const solicitud = await req('POST', '/activation/forgot-password', {
    body: { email: ctx.importado.email },
  });
  check(solicitud.status === 200, 'B3.7 Se solicita el restablecimiento');

  // El token de recuperación no se expone por la API: se obtiene reenviando
  // desde el administrador, que es el único camino disponible sin SMTP.
  const suspension = await req('PATCH', `/users/${ctx.importado.id}/status`, {
    token: ctx.admin,
    body: { status: 'suspended' },
  });
  check(suspension.status === 200 && suspension.data?.status === 'suspended', 'B3.8 El administrador suspende la cuenta');

  const trasSuspender = await req('POST', '/auth/refresh', { body: { refreshToken: antes } });
  check(
    trasSuspender.status === 401,
    'B3.9 Suspender revoca las sesiones abiertas de inmediato -> 401',
    `status ${trasSuspender.status}`,
  );

  const loginSuspendido = await req('POST', '/auth/login', {
    body: { email: ctx.importado.email, password: PWD },
  });
  check(
    loginSuspendido.status === 401,
    'B3.10 Una cuenta suspendida no inicia sesión -> 401',
    `status ${loginSuspendido.status}`,
  );

  await req('PATCH', `/users/${ctx.importado.id}/status`, {
    token: ctx.admin,
    body: { status: 'active' },
  });
  const reactivado = await req('POST', '/auth/login', {
    body: { email: ctx.importado.email, password: PWD },
  });
  check(reactivado.status === 200, 'B3.11 Reactivar devuelve el acceso');
}

// ===========================================================================
//  §68 · El alcance docente también rige los reportes
// ===========================================================================
async function alcanceReportes(ctx) {
  objective('§68 · Alcance académico del docente en los reportes');

  section('Docente sin semestres habilitados');
  const sinAlcance = await req('GET', '/reports/teacher/overview', { token: ctx.docenteSinAlcance });
  check(sinAlcance.status === 200, 'B4.1 El endpoint responde');
  check(
    sinAlcance.data?.students?.total === 0,
    'B4.2 Un docente sin semestres NO recibe el conteo de la carrera',
    `total=${sinAlcance.data?.students?.total}`,
  );
  check(
    (sinAlcance.data?.incompleteStudents?.list ?? []).length === 0,
    'B4.3 Tampoco recibe la lista nominal de estudiantes incompletos',
  );

  const afinidadSin = await req('GET', '/reports/teacher/affinity-summary', {
    token: ctx.docenteSinAlcance,
  });
  check(
    (afinidadSin.data?.groupAffinity ?? []).length === 0,
    'B4.4 Ni el mapa de afinidad de la carrera',
  );

  section('Docente con un semestre habilitado');
  const conAlcance = await req('GET', '/reports/teacher/overview', { token: ctx.docenteConAlcance });
  check(conAlcance.status === 200, 'B4.5 El endpoint responde');
  check(
    Array.isArray(conAlcance.data?.group?.semesters)
      && conAlcance.data.group.semesters.length === 1,
    'B4.6 El reporte declara los semestres a los que se limita',
    JSON.stringify(conAlcance.data?.group?.semesters),
  );

  const director = await req('GET', '/reports/director/overview', { token: ctx.directorToken });
  check(
    director.status === 200 && director.data?.totals?.students > 0,
    'B4.7 El director sí ve el agregado de toda la carrera',
    `total=${director.data?.totals?.students}`,
  );
  check(
    conAlcance.data.students.total <= director.data.totals.students,
    'B4.8 El docente nunca ve más estudiantes que el total de la carrera',
    `${conAlcance.data.students.total} <= ${director.data.totals.students}`,
  );
}

// ===========================================================================
//  §83 · Los archivos no se sirven como estáticos
// ===========================================================================
async function archivos(ctx) {
  objective('§83 · Descarga de archivos autorizada');

  const anonimo = await fetch(`${API.replace(/\/api$/, '')}/api/files/inexistente.pdf`);
  check(
    anonimo.status === 401,
    'B5.1 Sin sesión, la descarga se rechaza antes de mirar el archivo -> 401',
    `status ${anonimo.status}`,
  );

  const recorrido = await fetch(`${API.replace(/\/api$/, '')}/api/files/..%2F..%2Fpackage.json`, {
    headers: { Authorization: `Bearer ${ctx.admin}` },
  });
  check(
    recorrido.status === 404 || recorrido.status === 400,
    'B5.2 Un intento de recorrido de rutas no alcanza nada fuera del almacén',
    `status ${recorrido.status}`,
  );
}

// ===========================================================================

async function main() {
  console.log(`${C.bold}BATCH 1 — Identidad y seguridad · ${API}${C.r}`);

  const adminLogin = await req('POST', '/auth/login', {
    body: {
      email: process.env.ADMIN_EMAIL ?? 'admin@univalle.edu',
      password: process.env.ADMIN_PASSWORD ?? 'Admin123*',
    },
  });
  if (adminLogin.status !== 200) {
    console.error(`\n${C.bad}No se pudo iniciar sesión como administrador.${C.r}`);
    console.error('Ejecute primero: npm run api:migrate && npm run seed:populate');
    process.exit(1);
  }
  const admin = adminLogin.data.accessToken;
  await asegurarCorreoDePrueba(admin);

  // Actores auxiliares.
  const provisionar = async (key, first, last, role) => {
    const desde = Date.now();
    const creado = await req('POST', '/users', {
      token: admin,
      body: {
        firstName: first,
        lastName: last,
        email: correo(key),
        password: PWD,
        role,
        universityCode: codigoUniversitario(role),
        ...(role === 'STUDENT' || role === 'SCIENTIFIC_SOCIETY' ? { semester: 1 } : {}),
      },
    });
    const invitacion = await leerCorreo(correo(key), { tipo: 'account_activation', desde });
    await req('POST', '/activation/activate', {
      body: { token: invitacion.token, password: PWD },
    });
    const login = await req('POST', '/auth/login', { body: { email: correo(key), password: PWD } });
    return { token: login.data.accessToken, id: creado.data.id };
  };

  const estudiante = await provisionar('estBase', 'Base', 'Estudiante', 'STUDENT');
  const perfilBase = await req('POST', '/profiles/me', { token: estudiante.token, body: {} });
  await req('PATCH', `/profiles/${perfilBase.data?.id}/institutional-data`, {
    token: admin,
    body: { semester: 4 },
  });

  const docenteSin = await provisionar('docSin', 'Sin', 'Alcance', 'TEACHER');
  const docenteCon = await provisionar('docCon', 'Con', 'Alcance', 'TEACHER');
  await req('PUT', `/users/${docenteCon.id}/semesters`, { token: admin, body: { semesters: [4] } });
  const director = await provisionar('dir', 'Dir', 'Carrera', 'CAREER_DIRECTOR');

  const ctx = {
    admin,
    estudiante: estudiante.token,
    docenteSinAlcance: docenteSin.token,
    docenteConAlcance: docenteCon.token,
    directorToken: director.token,
  };

  await importacion(ctx);
  await activacion(ctx);
  await sesiones(ctx);
  await alcanceReportes(ctx);
  await archivos(ctx);

  console.log(`\n${'-'.repeat(78)}`);
  if (failures.length === 0) {
    console.log(`${C.ok}${C.bold}  ${passed} verificaciones OK · 0 fallos${C.r}`);
    console.log('  El BATCH 1 queda demostrado de punta a punta.\n');
  } else {
    console.log(`${C.bad}${C.bold}  ${passed} OK · ${failures.length} FALLOS${C.r}`);
    failures.forEach((f) => console.log(`   ${C.bad}·${C.r} ${f}`));
    console.log('');
    process.exitCode = 1;
  }
}

main().catch((e) => {
  console.error(`\n${C.bad}Error inesperado:${C.r}`, e);
  process.exit(1);
});
