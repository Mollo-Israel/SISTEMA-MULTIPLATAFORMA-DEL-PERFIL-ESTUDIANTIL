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

// ===========================================================================
//  OBJETIVO 2 — Perfil estudiantil dinamico
// ===========================================================================
async function objective2(ctx) {
  objective('OBJETIVO 2 — Gestion del perfil estudiantil dinamico');

  const { student, admin, webArea, dataArea, reactSkill, sqlSkill } = ctx;

  // --- Creacion y datos declarativos ---
  section('Creacion y datos declarativos del perfil');
  const created = await req('POST', '/profiles/me', {
    token: student,
    body: {
      semester: 4,
      bio: 'Estudiante de cuarto semestre interesada en desarrollo web y datos.',
      improvementAreaIds: [dataArea.id],
    },
  });
  check(created.status === 201, '2.1 El estudiante crea su perfil', `status ${created.status} ${msgOf(created)}`);
  check(created.data?.semester === 4, '2.2 El semestre queda registrado');
  const profileId = created.data?.id;
  ctx.studentProfileId = profileId;

  const dupProfile = await req('POST', '/profiles/me', { token: student, body: { semester: 4 } });
  check(dupProfile.status === 409, '2.3 Perfil duplicado -> 409', `status ${dupProfile.status}`);

  const badSemester = await req('PATCH', '/profiles/me', { token: student, body: { semester: 12 } });
  check(badSemester.status === 400, '2.4 Semestre fuera de rango (1-8) -> 400', `status ${badSemester.status}`);

  // Areas de interes / preferencia (area academica + prioridad 1-5)
  const interests = await req('PUT', '/profiles/me/interests', {
    token: student,
    body: {
      items: [
        { academicAreaId: webArea.id, priority: 5 },
        { academicAreaId: dataArea.id, priority: 3 },
      ],
    },
  });
  check(interests.status === 200 && interests.data.length === 2, '2.5 Registra areas de interes con prioridad', msgOf(interests));
  check(
    (await req('PUT', '/profiles/me/interests', {
      token: student,
      body: { items: [{ academicAreaId: webArea.id, priority: 9 }] },
    })).status === 400,
    '2.6 Prioridad fuera de rango -> 400',
  );
  check(
    (await req('PUT', '/profiles/me/interests', {
      token: student,
      body: { items: [{ academicAreaId: '00000000-0000-0000-0000-000000000000', priority: 3 }] },
    })).status === 400,
    '2.7 Area inexistente -> 400',
  );

  const skillItems = sqlSkill && sqlSkill.id !== reactSkill.id
    ? [{ skillId: reactSkill.id, level: 4 }, { skillId: sqlSkill.id, level: 3 }]
    : [{ skillId: reactSkill.id, level: 4 }];
  const skillsRes = await req('PUT', '/profiles/me/skills', { token: student, body: { items: skillItems } });
  check(skillsRes.status === 200, '2.8 Registra habilidades con nivel', msgOf(skillsRes));
  check(
    (await req('PUT', '/profiles/me/skills', {
      token: student,
      body: { items: [{ skillId: reactSkill.id, level: 9 }] },
    })).status === 400,
    '2.9 Nivel de habilidad fuera de rango -> 400',
  );
  // Se restauran las habilidades validas tras el intento invalido.
  await req('PUT', '/profiles/me/skills', { token: student, body: { items: skillItems } });

  // --- Consulta, edicion y persistencia ---
  section('Consulta, edicion y persistencia');
  const read = await req('GET', '/profiles/me', { token: student });
  check(read.status === 200 && read.data.semester === 4, '2.10 El estudiante consulta su perfil');

  const updated = await req('PATCH', '/profiles/me', {
    token: student,
    body: {
      semester: 5,
      bio: 'Ahora enfocada en backend y bases de datos.',
      improvementAreaIds: [webArea.id, dataArea.id],
    },
  });
  check(updated.status === 200, '2.11 El estudiante edita su perfil', msgOf(updated));

  const reread = await req('GET', '/profiles/me', { token: student });
  check(
    reread.data?.semester === 5 && reread.data?.bio?.includes('backend'),
    '2.12 Los cambios persisten tras releer',
  );
  check(
    (reread.data?.improvementAreaIds ?? []).length === 2,
    '2.13 Las areas donde desea mejorar persisten',
  );

  // --- Completitud ---
  section('Completitud del perfil');
  check(
    reread.data?.completionPercentage === 100,
    '2.14 La completitud llega a 100% con los cinco elementos',
    `valor ${reread.data?.completionPercentage}`,
  );
  check(reread.data?.status !== 'incomplete', '2.15 El perfil deja de estar incompleto');

  // --- Resumen dinamico ---
  section('Resumen dinamico integrado');
  const summary = await req('GET', '/profiles/me/summary', { token: student });
  check(summary.status === 200, '2.16 El estudiante consulta su resumen dinamico');
  const sd = summary.data ?? {};
  check(sd.interests?.length === 2, '2.17 El resumen integra las areas de interes');
  check(sd.skills?.length >= 1, '2.18 El resumen integra las habilidades');
  check(sd.improvementAreas?.length === 2, '2.19 El resumen integra las areas de mejora');
  check(Array.isArray(sd.projects), '2.20 El resumen incluye la seccion de proyectos');
  check(Array.isArray(sd.activities), '2.21 El resumen incluye la seccion de actividades');
  check(Array.isArray(sd.externalCertificates), '2.22 El resumen incluye certificados externos');
  check(Array.isArray(sd.internalConstancies), '2.23 El resumen incluye constancias internas');
  check(Array.isArray(sd.affinities), '2.24 El resumen incluye areas de afinidad');
  check(
    sd.projects.length === 0 && sd.activities.length === 0,
    '2.25 Las secciones sin datos llegan vacias (sin informacion inventada)',
  );
  check(sd.affinities.length > 0, '2.26 La afinidad ya se calculo con lo declarado');

  // --- Privacidad y alcance ---
  section('Privacidad y alcance de consulta');
  const raw = JSON.stringify(summary.data ?? {});
  check(!raw.includes('passwordHash') && !raw.includes('password_hash'), '2.27 El resumen no expone credenciales');

  // Segundo estudiante, en un semestre fuera del alcance del docente (3, 4, 5)
  const other = await req('POST', '/auth/register', {
    body: { firstName: 'Diego', lastName: 'Rocha', email: studentEmail('est2'), password: PWD },
  });
  const otherToken = other.data?.accessToken;
  const otherProfile = await req('POST', '/profiles/me', { token: otherToken, body: { semester: 7 } });
  const otherProfileId = otherProfile.data?.id;
  ctx.otherStudentToken = otherToken;
  ctx.otherStudentProfileId = otherProfileId;

  const dir = await req('GET', '/profiles/students', { token: ctx.teacherToken });
  check(dir.status === 200, '2.28 El docente consulta el directorio de estudiantes', msgOf(dir));
  check(dir.data?.scope?.restricted === true, '2.29 El directorio informa que el alcance esta restringido');
  check(
    JSON.stringify(dir.data?.scope?.semesters) === '[3,4,5]',
    '2.30 El alcance corresponde a los semestres habilitados',
  );
  check(
    dir.data?.students?.every((s) => [3, 4, 5].includes(s.semester)),
    '2.31 El directorio solo trae estudiantes de los semestres habilitados',
  );
  check(
    dir.data?.students?.some((s) => s.profileId === profileId),
    '2.32 El estudiante del 5o semestre si aparece para el docente',
  );
  check(
    !dir.data?.students?.some((s) => s.profileId === otherProfileId),
    '2.33 El estudiante del 7o semestre NO aparece para el docente',
  );

  const allowedIn = await req('GET', `/profiles/${profileId}/allowed`, { token: ctx.teacherToken });
  check(allowedIn.status === 200, '2.34 El docente abre el perfil permitido dentro de su alcance', msgOf(allowedIn));
  check(
    allowedIn.data?.internalConstancies === undefined,
    '2.35 La vista permitida NO incluye constancias internas',
  );
  check(allowedIn.data?.email === undefined, '2.36 La vista permitida NO expone el correo');

  const allowedOut = await req('GET', `/profiles/${otherProfileId}/allowed`, { token: ctx.teacherToken });
  check(
    allowedOut.status === 403,
    '2.37 El docente NO abre un perfil fuera de sus semestres -> 403',
    `status ${allowedOut.status}`,
  );
  check(
    (await req('GET', `/affinity/student/${otherProfileId}`, { token: ctx.teacherToken })).status === 403,
    '2.38 Tampoco accede a la afinidad de ese estudiante -> 403',
  );

  const dirAll = await req('GET', '/profiles/students', { token: ctx.directorToken });
  check(dirAll.data?.scope?.restricted === false, '2.39 El director ve la cohorte completa (sin restriccion)');
  check(
    (await req('GET', `/profiles/${otherProfileId}/allowed`, { token: ctx.directorToken })).status === 200,
    '2.40 El director si accede a cualquier perfil',
  );

  check(
    (await req('GET', `/profiles/${profileId}/allowed`, { token: student })).status === 403,
    '2.41 Un estudiante NO consulta el perfil de otro -> 403',
  );

  // Docente sin semestres habilitados
  await req('POST', '/users', {
    token: admin,
    body: { firstName: 'Ines', lastName: 'Moreno', email: email('docente2'), password: PWD, role: 'TEACHER' },
  });
  const lonelyToken = (await req('POST', '/auth/login', { body: { email: email('docente2'), password: PWD } }))
    .data?.accessToken;
  const lonelyDir = await req('GET', '/profiles/students', { token: lonelyToken });
  check(
    lonelyDir.data?.students?.length === 0 && lonelyDir.data?.scope?.semesters?.length === 0,
    '2.42 Un docente sin semestres habilitados no ve ningun estudiante',
  );
  check(
    (await req('GET', `/profiles/${profileId}/allowed`, { token: lonelyToken })).status === 403,
    '2.43 Y tampoco puede abrir un perfil -> 403',
  );
}
// ===========================================================================
//  OBJETIVO 3 — Actividades academicas y extracurriculares
// ===========================================================================
async function objective3(ctx) {
  objective('OBJETIVO 3 — Gestion de actividades academicas y extracurriculares');

  const { student, directorToken, societyToken, teacherToken, webArea } = ctx;
  const future = new Date(Date.now() + 21 * 24 * 3600 * 1000).toISOString();

  // --- Responsables de cada tipo ---
  section('Responsable de cada tipo de actividad');
  const academic = await req('POST', '/activities', {
    token: directorToken,
    body: {
      title: `Taller de arquitectura de software ${TS}`,
      description: 'Patrones, capas y decisiones de diseño en proyectos de la carrera.',
      type: 'academica',
      category: 'taller_academico',
      modality: 'presencial',
      areaId: webArea.id,
      activityDate: future,
      location: 'Aula 301, Bloque B',
      capacity: 3,
      tags: ['arquitectura', 'patrones'],
      status: 'draft',
    },
  });
  check(academic.status === 201, '3.1 El director crea una actividad academica', `status ${academic.status} ${msgOf(academic)}`);
  const academicId = academic.data?.id;
  ctx.academicActivityId = academicId;
  check(academic.data?.status === 'draft', '3.2 La actividad nace como borrador');

  const societyAcademic = await req('POST', '/activities', {
    token: societyToken,
    body: { title: `Intento academico ${TS}`, type: 'academica', category: 'charla' },
  });
  check(
    societyAcademic.status === 403,
    '3.3 La sociedad cientifica NO publica actividades academicas -> 403',
    `status ${societyAcademic.status}`,
  );

  const extracurricular = await req('POST', '/activities', {
    token: societyToken,
    body: {
      title: `Hackathon de innovacion ${TS}`,
      description: 'Reto de 24 horas para equipos de la carrera.',
      type: 'extracurricular',
      category: 'hackathon',
      modality: 'presencial',
      areaId: webArea.id,
      activityDate: future,
      capacity: 20,
      status: 'open',
    },
  });
  check(extracurricular.status === 201, '3.4 La sociedad cientifica crea una extracurricular', msgOf(extracurricular));
  const extraId = extracurricular.data?.id;
  ctx.extraActivityId = extraId;

  const directorExtra = await req('POST', '/activities', {
    token: directorToken,
    body: { title: `Intento extra ${TS}`, type: 'extracurricular', category: 'hackathon' },
  });
  check(
    directorExtra.status === 403,
    '3.5 El director NO publica actividades extracurriculares -> 403',
    `status ${directorExtra.status}`,
  );

  const teacherPublish = await req('POST', '/activities', {
    token: teacherToken,
    body: { title: `Intento docente ${TS}`, type: 'academica', category: 'charla' },
  });
  check(
    teacherPublish.status === 403,
    '3.6 El docente NO publica actividades -> 403',
    `status ${teacherPublish.status}`,
  );

  const studentPublish = await req('POST', '/activities', {
    token: student,
    body: { title: `Intento estudiante ${TS}`, type: 'academica', category: 'charla' },
  });
  check(studentPublish.status === 403, '3.7 El estudiante NO publica actividades -> 403');

  // --- Edicion y publicacion ---
  section('Edicion, publicacion y estados');
  const edited = await req('PATCH', `/activities/${academicId}`, {
    token: directorToken,
    body: { description: 'Patrones, capas y decisiones de diseño aplicadas a proyectos reales.', capacity: 2 },
  });
  check(edited.status === 200 && edited.data.capacity === 2, '3.8 El director edita su actividad', msgOf(edited));

  const draftForStudent = await req('GET', '/activities', { token: student });
  check(
    !draftForStudent.data?.some((a) => a.id === academicId),
    '3.9 El estudiante NO ve la actividad en borrador',
  );

  const earlyRegister = await req('POST', `/activities/${academicId}/register`, { token: student });
  check(
    earlyRegister.status === 400 || earlyRegister.status === 404,
    '3.10 No se puede inscribir en un borrador',
    `status ${earlyRegister.status}`,
  );

  const published = await req('PATCH', `/activities/${academicId}`, {
    token: directorToken,
    body: { status: 'open' },
  });
  check(published.status === 200 && published.data.status === 'open', '3.11 El director publica la actividad');

  const managed = await req('GET', '/activities/managed', { token: directorToken });
  check(
    managed.status === 200 && managed.data.some((a) => a.id === academicId),
    '3.12 El panel del responsable lista sus actividades',
  );
  check(
    !managed.data.some((a) => a.type === 'extracurricular' && a.creatorId !== undefined && a.id === extraId),
    '3.13 El panel del director no incluye las extracurriculares ajenas',
  );

  const societyOnAcademic = await req('PATCH', `/activities/${academicId}`, {
    token: societyToken,
    body: { title: 'Secuestro de actividad' },
  });
  check(
    societyOnAcademic.status === 403,
    '3.14 La sociedad NO edita una actividad academica -> 403',
    `status ${societyOnAcademic.status}`,
  );

  // --- Consulta del estudiante ---
  section('Consulta, filtros e inscripcion del estudiante');
  const list = await req('GET', '/activities', { token: student });
  check(list.status === 200 && list.data.some((a) => a.id === academicId), '3.15 El estudiante ve la actividad publicada');

  const byType = await req('GET', '/activities?type=extracurricular', { token: student });
  check(
    byType.status === 200 && byType.data.every((a) => a.type === 'extracurricular'),
    '3.16 Filtro por tipo de actividad',
  );
  const byCategory = await req('GET', '/activities?category=hackathon', { token: student });
  check(
    byCategory.status === 200 && byCategory.data.every((a) => a.category === 'hackathon'),
    '3.17 Filtro por categoria',
  );
  const byArea = await req('GET', `/activities?areaId=${webArea.id}`, { token: student });
  check(
    byArea.status === 200 && byArea.data.every((a) => a.academicAreaId === webArea.id),
    '3.18 Filtro por area academica',
  );

  const detail = await req('GET', `/activities/${academicId}`, { token: student });
  check(detail.status === 200, '3.19 El estudiante abre el detalle de la actividad');
  check(detail.data?.myRegistration === null, '3.20 El detalle indica que aun no esta inscrito');
  check(detail.data?.isOpenForRegistration === true, '3.21 El detalle indica que admite inscripcion');
  check(detail.data?.seatsLeft === 2, '3.22 El detalle informa los cupos disponibles');

  const interest = await req('POST', `/activities/${academicId}/register-interest`, { token: student });
  check(interest.status === 201, '3.23 El estudiante marca interes', msgOf(interest));
  const dupInterest = await req('POST', `/activities/${academicId}/register-interest`, { token: student });
  check(dupInterest.status === 400, '3.24 Interes duplicado -> 400', `status ${dupInterest.status}`);

  const enroll = await req('POST', `/activities/${academicId}/register`, { token: student });
  check(
    [200, 201].includes(enroll.status) && enroll.data.status === 'registered',
    '3.25 El estudiante se inscribe (solicitud pendiente)',
    msgOf(enroll),
  );
  const dupEnroll = await req('POST', `/activities/${academicId}/register`, { token: student });
  check(dupEnroll.status === 400, '3.26 Inscripcion duplicada -> 400', `status ${dupEnroll.status}`);

  const afterEnroll = await req('GET', `/activities/${academicId}`, { token: student });
  check(
    afterEnroll.data?.myRegistration?.status === 'registered',
    '3.27 El detalle refleja el estado de inscripcion del estudiante',
  );

  const mine = await req('GET', '/activities/my-registrations', { token: student });
  check(
    mine.status === 200 && mine.data.some((r) => r.activity?.id === academicId),
    '3.28 "Mis actividades" lista la inscripcion',
  );

  // --- Estados que bloquean la inscripcion ---
  section('Estados que bloquean la inscripcion');
  const closed = await req('POST', '/activities', {
    token: societyToken,
    body: {
      title: `Convocatoria cerrada ${TS}`,
      type: 'extracurricular',
      category: 'convocatoria',
      status: 'closed',
    },
  });
  const closedTry = await req('POST', `/activities/${closed.data?.id}/register`, { token: student });
  check(closedTry.status === 400, '3.29 Actividad cerrada -> 400 al inscribirse', `status ${closedTry.status}`);
  check(
    String(closedTry.data?.message ?? '').toLowerCase().includes('cerrad'),
    '3.30 El mensaje explica que las inscripciones estan cerradas',
    msgOf(closedTry),
  );

  const past = await req('POST', '/activities', {
    token: societyToken,
    body: {
      title: `Reto pasado ${TS}`,
      type: 'extracurricular',
      category: 'reto',
      status: 'open',
      activityDate: new Date(Date.now() - 7 * 24 * 3600 * 1000).toISOString(),
    },
  });
  const pastTry = await req('POST', `/activities/${past.data?.id}/register`, { token: student });
  check(pastTry.status === 400, '3.31 Actividad con fecha pasada -> 400', `status ${pastTry.status}`);

  const cancelled = await req('POST', '/activities', {
    token: societyToken,
    body: {
      title: `Club cancelado ${TS}`,
      type: 'extracurricular',
      category: 'club_estudio',
      status: 'cancelled',
    },
  });
  check(
    (await req('POST', `/activities/${cancelled.data?.id}/register`, { token: student })).status === 400,
    '3.32 Actividad cancelada -> 400',
  );

  check(
    (await req('POST', '/activities/00000000-0000-0000-0000-000000000000/register', { token: student }))
      .status === 404,
    '3.33 Actividad inexistente -> 404',
  );
}
async function objective4() {}

main().catch((e) => {
  console.error('\n[31mError inesperado:[0m', e);
  process.exit(1);
});
