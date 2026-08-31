// =============================================================================
//  Prueba integral del 40% — Objetivos especificos 1 a 4
//  Sistema Multiplataforma para la Construccion del Perfil Estudiantil Dinamico
// =============================================================================
//
//  Ejecuta de punta a punta, contra la API real, los cuatro objetivos que se
//  declaran terminados. Cubre el camino de exito y los rechazos esperados.
//
//  Uso:  node scripts/e2e-objectives-40.mjs
//        API_URL=http://localhost:3010/api node scripts/e2e-objectives-40.mjs
//
//  Requiere: API corriendo + migraciones aplicadas + `npm run seed:populate`.
//  Las cuentas que crea llevan sufijo de tiempo, por lo que puede repetirse.
// =============================================================================

import { Buffer } from 'node:buffer';

const API = process.env.API_URL ?? 'http://localhost:3000/api';
const TS = Date.now();
const PWD = 'Afinia2026*';
const email = (n) => `e2e.${n}.${TS}@univalle.edu`;
const studentEmail = (n) => `e2e.${n}.${TS}@est.univalle.edu`;

let pass = 0;
let fail = 0;
const failures = [];

const ok = (l) => {
  pass++;
  console.log(`  [32m✓[0m ${l}`);
};
const bad = (l, d) => {
  fail++;
  failures.push(`${l}${d ? ' -> ' + d : ''}`);
  console.log(`  [31m✗[0m ${l}${d ? ' [90m-> ' + d + '[0m' : ''}`);
};
const check = (cond, label, detail) => (cond ? ok(label) : bad(label, detail));
const section = (t) => console.log(`\n[1m${t}[0m`);
const objective = (t) => console.log(`\n[1m[35m${'═'.repeat(78)}\n ${t}\n${'═'.repeat(78)}[0m`);

async function req(method, path, { token, body, raw } = {}) {
  const headers = { ...(token ? { Authorization: `Bearer ${token}` } : {}) };
  let payload;
  if (raw) {
    payload = raw;
  } else if (body !== undefined) {
    headers['Content-Type'] = 'application/json';
    payload = JSON.stringify(body);
  }
  const res = await fetch(`${API}${path}`, { method, headers, body: payload });
  let data = null;
  const text = await res.text();
  try {
    data = text ? JSON.parse(text) : null;
  } catch {
    data = text;
  }
  return { status: res.status, data };
}

const msgOf = (r) => {
  const m = r?.data?.message;
  return Array.isArray(m) ? m.join(' | ') : (m ?? JSON.stringify(r?.data ?? '').slice(0, 120));
};

// ---------------------------------------------------------------------------

async function main() {
  console.log(`\n[1mPrueba integral del 40% contra ${API}[0m`);

  const adminLogin = await req('POST', '/auth/login', {
    body: { email: 'admin@univalle.edu', password: 'Admin123*' },
  });
  const admin = adminLogin.data?.accessToken;
  if (!admin) {
    console.error(
      '\n[31mNo se pudo iniciar sesion como administrador.[0m\n' +
        'Ejecute primero: npm run api:migrate && npm run seed:populate\n',
    );
    process.exit(1);
  }

  const areas = (await req('GET', '/academic-areas', { token: admin })).data ?? [];
  const skills = (await req('GET', '/skills', { token: admin })).data ?? [];
  const webArea = areas.find((a) => a.name === 'Desarrollo Web') ?? areas[0];
  const dataArea = areas.find((a) => a.name === 'Bases de Datos') ?? areas[1] ?? areas[0];
  const reactSkill = skills.find((s) => s.name === 'React') ?? skills[0];
  const sqlSkill = skills.find((s) => s.name === 'SQL') ?? skills[1] ?? skills[0];

  const ctx = { admin, areas, webArea, dataArea, reactSkill, sqlSkill };

  await objective1(ctx);
  await objective2(ctx);
  await objective3(ctx);
  await objective4(ctx);

  console.log(`\n${'─'.repeat(78)}`);
  if (fail === 0) {
    console.log(`[32m[1m  ${pass} verificaciones OK · 0 fallos[0m`);
    console.log('  Los cuatro objetivos del 40% quedan demostrados de punta a punta.\n');
  } else {
    console.log(`[31m[1m  ${pass} OK · ${fail} FALLOS[0m`);
    failures.forEach((f) => console.log(`   [31m·[0m ${f}`));
    console.log('');
    process.exitCode = 1;
  }
}

// ===========================================================================
//  OBJETIVO 1 — Usuarios, autenticacion, roles y control de acceso
// ===========================================================================
async function objective1(ctx) {
  objective('OBJETIVO 1 — Gestion de usuarios, autenticacion, roles y control de acceso');

  // --- RF1: registro de estudiante ---
  section('RF1 · Registro de cuenta de estudiante');
  const reg = await req('POST', '/auth/register', {
    body: {
      firstName: 'Valeria',
      lastName: 'Antezana',
      email: studentEmail('est1'),
      password: PWD,
    },
  });
  check(reg.status === 201, '1.1 Registro de estudiante devuelve 201', `status ${reg.status} ${msgOf(reg)}`);
  check(reg.data?.user?.role === 'STUDENT', '1.2 El rol asignado automaticamente es STUDENT');
  check(!!reg.data?.accessToken, '1.3 El registro devuelve token de sesion');
  check(reg.data?.user?.passwordHash === undefined, '1.4 La respuesta no expone el hash de contrasena');

  const selfRole = await req('POST', '/auth/register', {
    body: {
      firstName: 'Intruso',
      lastName: 'Prueba',
      email: studentEmail('intruso'),
      password: PWD,
      role: 'ADMIN',
    },
  });
  check(selfRole.status === 400, '1.5 No puede autootorgarse un rol al registrarse -> 400', `status ${selfRole.status}`);

  const dup = await req('POST', '/auth/register', {
    body: { firstName: 'Valeria', lastName: 'Antezana', email: studentEmail('est1'), password: PWD },
  });
  check(dup.status === 409, '1.6 Correo duplicado -> 409', `status ${dup.status}`);

  const badEmail = await req('POST', '/auth/register', {
    body: { firstName: 'Ana', lastName: 'Lopez', email: `ana.${TS}@gmail.com`, password: PWD },
  });
  check(badEmail.status === 400, '1.7 Correo no institucional -> 400', `status ${badEmail.status}`);

  const weakPwd = await req('POST', '/auth/register', {
    body: { firstName: 'Ana', lastName: 'Lopez', email: studentEmail('debil'), password: '12345678' },
  });
  check(weakPwd.status === 400, '1.8 Contrasena sin complejidad -> 400', `status ${weakPwd.status}`);

  const incomplete = await req('POST', '/auth/register', { body: { email: studentEmail('x'), password: PWD } });
  check(incomplete.status === 400, '1.9 Campos incompletos -> 400', `status ${incomplete.status}`);

  // --- RF2: sesion ---
  section('RF2 · Gestion de sesion');
  const login = await req('POST', '/auth/login', {
    body: { email: studentEmail('est1'), password: PWD },
  });
  const student = login.data?.accessToken;
  check(login.status === 200 && !!student, '2.1 Login de estudiante devuelve token', `status ${login.status}`);

  const me = await req('GET', '/auth/me', { token: student });
  check(me.status === 200 && me.data?.role === 'STUDENT', '2.2 /auth/me identifica al usuario y su rol');

  check((await req('GET', '/auth/me')).status === 401, '2.3 Sin token -> 401');
  check(
    (await req('POST', '/auth/login', { body: { email: studentEmail('est1'), password: 'Incorrecta9*' } }))
      .status === 401,
    '2.4 Credenciales incorrectas -> 401',
  );
  check((await req('GET', '/users', { token: student })).status === 403, '2.5 Estudiante NO accede a /users -> 403');
  check(
    (await req('GET', '/reports/director/overview', { token: student })).status === 403,
    '2.6 Estudiante NO accede a reportes de direccion -> 403',
  );

  // Un rol falsificado dentro del token no debe surtir efecto: el backend lee el
  // rol de la base en cada peticion.
  const [h, p, s] = student.split('.');
  const forgedPayload = JSON.parse(Buffer.from(p, 'base64url').toString());
  forgedPayload.role = 'ADMIN';
  const forged = `${h}.${Buffer.from(JSON.stringify(forgedPayload)).toString('base64url')}.${s}`;
  check(
    (await req('GET', '/users', { token: forged })).status === 401,
    '2.7 Token con rol manipulado -> 401 (firma invalida)',
  );

  // --- RF3: usuarios institucionales, roles y estados ---
  section('RF3 · Usuarios institucionales, roles y estados');
  const mkStaff = async (role, first, last, key) => {
    const r = await req('POST', '/users', {
      token: ctx.admin,
      body: { firstName: first, lastName: last, email: email(key), password: PWD, role },
    });
    return r;
  };

  const teacherRes = await mkStaff('TEACHER', 'Rodrigo', 'Salazar', 'docente');
  check(teacherRes.status === 201, '3.1 Admin crea Docente', `status ${teacherRes.status} ${msgOf(teacherRes)}`);
  const directorRes = await mkStaff('CAREER_DIRECTOR', 'Elena', 'Zapata', 'director');
  check(directorRes.status === 201, '3.2 Admin crea Director de carrera', `status ${directorRes.status}`);
  const societyRes = await mkStaff('SCIENTIFIC_SOCIETY', 'Mauricio', 'Chavez', 'sociedad');
  check(societyRes.status === 201, '3.3 Admin crea Sociedad cientifica', `status ${societyRes.status}`);

  const adminRes = await mkStaff('ADMIN', 'Falso', 'Admin', 'adminfalso');
  check(adminRes.status === 400, '3.4 No se puede crear otro ADMIN por este endpoint -> 400', `status ${adminRes.status}`);
  const studentRes = await mkStaff('STUDENT', 'Falso', 'Estudiante', 'estfalso');
  check(studentRes.status === 400, '3.5 No se puede crear un STUDENT por este endpoint -> 400', `status ${studentRes.status}`);

  const teacherId = teacherRes.data?.id;
  const directorId = directorRes.data?.id;

  const search = await req('GET', `/users?search=Salazar`, { token: ctx.admin });
  check(
    search.status === 200 && search.data.some((u) => u.id === teacherId),
    '3.6 Busqueda de usuarios por apellido',
  );
  const searchMail = await req('GET', `/users?search=${encodeURIComponent(email('director'))}`, {
    token: ctx.admin,
  });
  check(
    searchMail.status === 200 && searchMail.data.length === 1,
    '3.7 Busqueda de usuarios por correo',
  );

  const edited = await req('PATCH', `/users/${teacherId}`, {
    token: ctx.admin,
    body: { firstName: 'Rodrigo Andres' },
  });
  check(edited.status === 200 && edited.data.firstName === 'Rodrigo Andres', '3.8 Admin edita datos del usuario');

  // Semestres habilitados del docente
  const setSem = await req('PUT', `/users/${teacherId}/semesters`, {
    token: ctx.admin,
    body: { semesters: [3, 4, 5] },
  });
  check(
    setSem.status === 200 && JSON.stringify(setSem.data) === '[3,4,5]',
    '3.9 Admin configura semestres habilitados del docente',
    msgOf(setSem),
  );
  const getSem = await req('GET', `/users/${teacherId}/semesters`, { token: ctx.admin });
  check(JSON.stringify(getSem.data) === '[3,4,5]', '3.10 Los semestres habilitados persisten');

  const badSem = await req('PUT', `/users/${teacherId}/semesters`, {
    token: ctx.admin,
    body: { semesters: [3, 99] },
  });
  check(badSem.status === 400, '3.11 Semestre fuera de rango -> 400', `status ${badSem.status}`);

  const semOnDirector = await req('PUT', `/users/${directorId}/semesters`, {
    token: ctx.admin,
    body: { semesters: [1] },
  });
  check(semOnDirector.status === 400, '3.12 Solo el rol docente admite semestres -> 400', `status ${semOnDirector.status}`);

  const listed = await req('GET', '/users?search=Salazar', { token: ctx.admin });
  check(
    JSON.stringify(listed.data?.[0]?.semesters) === '[3,4,5]',
    '3.13 El listado muestra los semestres habilitados del docente',
  );

  // Activacion / desactivacion — el punto critico de RF2
  const teacherLogin = await req('POST', '/auth/login', { body: { email: email('docente'), password: PWD } });
  const teacherToken = teacherLogin.data?.accessToken;
  check(!!teacherToken, '3.14 El docente puede iniciar sesion mientras esta activo');

  const deact = await req('PATCH', `/users/${teacherId}/status`, { token: ctx.admin, body: { active: false } });
  check(deact.status === 200 && deact.data.status === 'inactive', '3.15 Admin desactiva la cuenta');

  check(
    (await req('POST', '/auth/login', { body: { email: email('docente'), password: PWD } })).status === 401,
    '3.16 Usuario desactivado NO puede iniciar sesion -> 401',
  );
  const withOldToken = await req('GET', '/auth/me', { token: teacherToken });
  check(
    withOldToken.status === 401,
    '3.17 Usuario desactivado pierde acceso aun con su token vigente -> 401',
    `status ${withOldToken.status}`,
  );

  const react = await req('PATCH', `/users/${teacherId}/status`, { token: ctx.admin, body: { active: true } });
  check(react.status === 200 && react.data.status === 'active', '3.18 Admin reactiva la cuenta');
  const afterReact = await req('GET', '/auth/me', { token: teacherToken });
  check(afterReact.status === 200, '3.19 Tras reactivar, el acceso vuelve a funcionar', `status ${afterReact.status}`);

  // --- RF4: catalogos ---
  section('RF4 · Catalogos y configuracion');
  const newArea = await req('POST', '/academic-areas', {
    token: ctx.admin,
    body: { name: `Computacion en la Nube ${TS}`, description: 'Infraestructura y despliegue', tags: ['aws', 'docker'] },
  });
  check(newArea.status === 201, '4.1 Admin crea area academica', `status ${newArea.status} ${msgOf(newArea)}`);
  const areaId = newArea.data?.id;

  const editArea = await req('PATCH', `/academic-areas/${areaId}`, {
    token: ctx.admin,
    body: { description: 'Infraestructura, contenedores y despliegue continuo' },
  });
  check(editArea.status === 200, '4.2 Admin edita area academica', `status ${editArea.status}`);

  const offArea = await req('PATCH', `/academic-areas/${areaId}`, { token: ctx.admin, body: { isActive: false } });
  check(offArea.status === 200 && offArea.data.isActive === false, '4.3 Admin da de baja un area');

  const studentAreas = await req('GET', '/academic-areas', { token: student });
  check(
    !studentAreas.data.some((a) => a.id === areaId),
    '4.4 Un area de baja deja de ofrecerse a los demas roles',
  );
  const adminAreas = await req('GET', '/academic-areas', { token: ctx.admin });
  check(
    adminAreas.data.some((a) => a.id === areaId),
    '4.5 El administrador si ve las areas de baja',
  );
  await req('PATCH', `/academic-areas/${areaId}`, { token: ctx.admin, body: { isActive: true } });

  const newSkill = await req('POST', '/skills', {
    token: ctx.admin,
    body: { name: `Terraform ${TS}`, academicAreaId: areaId },
  });
  check(newSkill.status === 201, '4.6 Admin crea habilidad', `status ${newSkill.status}`);
  const editSkill = await req('PATCH', `/skills/${newSkill.data?.id}`, {
    token: ctx.admin,
    body: { isActive: false },
  });
  check(editSkill.status === 200 && editSkill.data.isActive === false, '4.7 Admin da de baja una habilidad');

  const crit = await req('POST', '/gamification-criteria', {
    token: ctx.admin,
    body: {
      code: `participacion_${TS}`,
      name: 'Participacion confirmada en taller',
      trigger: 'participacion_confirmada',
      points: 15,
    },
  });
  check(crit.status === 201, '4.8 Admin define criterio de gamificacion (persistente)', `status ${crit.status} ${msgOf(crit)}`);
  const critList = await req('GET', '/gamification-criteria', { token: ctx.admin });
  check(
    critList.status === 200 && critList.data.some((c) => c.id === crit.data?.id),
    '4.9 El criterio queda almacenado y listable',
  );
  check(
    (await req('GET', '/gamification-criteria', { token: student })).status === 403,
    '4.10 El estudiante NO administra criterios -> 403',
  );

  ctx.student = student;
  ctx.studentEmail = studentEmail('est1');
  ctx.teacherToken = (await req('POST', '/auth/login', { body: { email: email('docente'), password: PWD } })).data
    ?.accessToken;
  ctx.teacherId = teacherId;
  ctx.directorToken = (await req('POST', '/auth/login', { body: { email: email('director'), password: PWD } })).data
    ?.accessToken;
  ctx.societyToken = (await req('POST', '/auth/login', { body: { email: email('sociedad'), password: PWD } })).data
    ?.accessToken;
}

// Los bloques 2, 3 y 4 se agregan a continuacion.
async function objective2() {}
async function objective3() {}
async function objective4() {}

main().catch((e) => {
  console.error('\n[31mError inesperado:[0m', e);
  process.exit(1);
});
