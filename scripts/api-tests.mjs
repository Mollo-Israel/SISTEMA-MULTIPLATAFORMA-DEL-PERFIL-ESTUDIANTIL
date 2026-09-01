// Pruebas de validación del backend del 30% inicial (contra la API real).
// Cubre los 13 puntos solicitados + reglas de roles/permisos.
// Actualizado al documento vigente: las actividades academicas las publica el
// director de carrera y las extracurriculares la sociedad cientifica.
// Usa cuentas efímeras (sufijo de tiempo) para poder ejecutarse de forma repetida.
// Uso: node scripts/api-tests.mjs   (requiere API corriendo + seeds base)

const API = process.env.API_URL ?? 'http://localhost:3000/api';
const TS = Date.now();
const PWD = 'Test123*';
const email = (n) => `test.${n}.${TS}@univalle.edu`;

let pass = 0, fail = 0;
const ok = (l) => { pass++; console.log(`  ✓ ${l}`); };
const bad = (l, d) => { fail++; console.log(`  ✗ ${l}${d ? ' -> ' + d : ''}`); };
const check = (cond, label, detail) => (cond ? ok(label) : bad(label, detail));

async function req(method, path, { token, body } = {}) {
  const res = await fetch(`${API}${path}`, {
    method,
    headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
    body: body ? JSON.stringify(body) : undefined,
  });
  let data = null;
  try { data = await res.json(); } catch { /* sin cuerpo */ }
  return { status: res.status, data };
}

async function section(title) { console.log(`\n${title}`); }

async function main() {
  console.log(`\n== Pruebas de backend del 30% contra ${API} ==`);

  const adminLogin = await req('POST', '/auth/login', { body: { email: 'admin@univalle.edu', password: 'Admin123*' } });
  const admin = adminLogin.data?.accessToken;
  if (!admin) { console.error('No se pudo iniciar sesión como admin. ¿Corriste los seeds base?'); process.exit(1); }

  const areas = (await req('GET', '/academic-areas', { token: admin })).data ?? [];
  const cats = (await req('GET', '/activity-categories', { token: admin })).data ?? [];
  const catId = (code) => cats.find((c) => c.code === code)?.id;
  const skills = (await req('GET', '/skills', { token: admin })).data ?? [];
  const web = areas.find((a) => a.name === 'Desarrollo Web') ?? areas[0];
  const react = skills.find((s) => s.name === 'React') ?? skills[0];

  // ---------- 1. Registro / Login ----------
  await section('1. Registro / Login');
  const reg = await req('POST', '/auth/register', { body: { firstName: 'Test', lastName: 'Est', email: email('est1'), password: PWD } });
  check(reg.status === 201 && reg.data.user.role === 'STUDENT' && !!reg.data.accessToken, '1. Registro de estudiante (201, rol STUDENT, token)', `status ${reg.status}`);
  const login = await req('POST', '/auth/login', { body: { email: email('est1'), password: PWD } });
  const est1 = login.data?.accessToken;
  check(login.status === 200 && !!est1, '1. Login devuelve token', `status ${login.status}`);
  const me = await req('GET', '/auth/me', { token: est1 });
  check(me.status === 200 && me.data.email === email('est1'), '1. /auth/me con token');
  const badLogin = await req('POST', '/auth/login', { body: { email: email('est1'), password: 'incorrecta123' } });
  check(badLogin.status === 401, '1. Login con credenciales inválidas -> 401', `status ${badLogin.status}`);

  // ---------- 2. Roles y permisos ----------
  await section('2. Roles y permisos');
  const roles = await req('GET', '/roles', { token: admin });
  check(roles.status === 200 && roles.data.length >= 5, '2. Admin lista roles (>=5)');
  check((await req('GET', '/users', { token: est1 })).status === 403, '2. Estudiante NO accede a /users (403)');
  check((await req('GET', '/reports/teacher/overview', { token: est1 })).status === 403, '2. Estudiante NO ve reporte docente (403)');
  check((await req('GET', '/auth/me')).status === 401, '2. Sin token -> 401');
  // crear staff
  const LAST_NAME = { TEACHER: 'Docente', SCIENTIFIC_SOCIETY: 'Sociedad', CAREER_DIRECTOR: 'Director' };
  const mkStaff = async (role, n) => {
    const r = await req('POST', '/users', { token: admin, body: { firstName: 'Test', lastName: LAST_NAME[role] ?? 'Staff', email: email(n), password: PWD, role } });
    if (r.status !== 201) return null;
    return (await req('POST', '/auth/login', { body: { email: email(n), password: PWD } })).data.accessToken;
  };
  const teacher = await mkStaff('TEACHER', 'doc');
  const society = await mkStaff('SCIENTIFIC_SOCIETY', 'soc');
  const director = await mkStaff('CAREER_DIRECTOR', 'dir');
  check(!!teacher && !!society && !!director, '2. Admin crea usuarios con rol (docente/sociedad/director)');

  // ---------- 3. Crear perfil ----------
  await section('3. Perfil');
  const createProfile = await req('POST', '/profiles/me', { token: est1, body: { semester: 5, bio: 'demo', improvementAreaIds: web ? [web.id] : [] } });
  check(createProfile.status === 201, '3. Crear perfil (201)', `status ${createProfile.status}`);
  const p1 = createProfile.data?.id;
  check((await req('POST', '/profiles/me', { token: est1, body: { semester: 5 } })).status === 409, '3. Perfil duplicado -> 409');

  // ---------- 4. Intereses ----------
  await section('4. Intereses');
  if (web) {
    check((await req('PUT', '/profiles/me/interests', { token: est1, body: { items: [{ academicAreaId: web.id, priority: 5 }] } })).status === 200, '4. Registrar intereses (200)');
    check((await req('POST', '/profiles/me/interests', { token: est1, body: { items: [{ academicAreaId: web.id, priority: 9 }] } })).status === 400, '4. Prioridad inválida -> 400');
    check((await req('POST', '/profiles/me/interests', { token: est1, body: { items: [{ academicAreaId: '00000000-0000-0000-0000-000000000000', priority: 3 }] } })).status === 400, '4. Área inexistente -> 400');
  }

  // ---------- 5. Habilidades ----------
  await section('5. Habilidades');
  if (react) {
    check((await req('PUT', '/profiles/me/skills', { token: est1, body: { items: [{ skillId: react.id, level: 4 }] } })).status === 200, '5. Registrar habilidades (200)');
    check((await req('POST', '/profiles/me/skills', { token: est1, body: { items: [{ skillId: react.id, level: 9 }] } })).status === 400, '5. Nivel inválido -> 400');
  }

  // ---------- 6. Crear actividad ----------
  await section('6. Actividad');
  const actAcad = await req('POST', '/activities', { token: director, body: { title: `Taller ${TS}`, type: 'academica', categoryId: catId('taller_academico'), areaId: web?.id, capacity: 10, status: 'open' } });
  check(actAcad.status === 201, '6. Director crea actividad académica (201)', `status ${actAcad.status}`);
  const actId = actAcad.data?.id;
  check((await req('POST', '/activities', { token: director, body: { title: `Intento extracurricular ${TS}`, type: 'extracurricular', categoryId: catId('hackathon') } })).status === 403, '6. Director NO publica extracurricular -> 403');
  check((await req('POST', '/activities', { token: society, body: { title: `Hack ${TS}`, type: 'extracurricular', categoryId: catId('hackathon'), status: 'open' } })).status === 201, '6. Sociedad crea extracurricular (201)');
  check((await req('POST', '/activities', { token: society, body: { title: `Intento academica ${TS}`, type: 'academica', categoryId: catId('charla') } })).status === 403, '6. Sociedad NO publica académica -> 403');
  check((await req('POST', '/activities', { token: teacher, body: { title: `Intento docente ${TS}`, type: 'academica', categoryId: catId('charla') } })).status === 403, '6. Docente NO publica actividades -> 403');
  check((await req('POST', '/activities', { token: est1, body: { title: `Intento estudiante ${TS}`, type: 'academica', categoryId: catId('charla') } })).status === 403, '6. Estudiante NO publica -> 403');

  // ---------- 7. Inscripción / interés ----------
  await section('7. Inscripción / interés');
  check((await req('POST', `/activities/${actId}/register-interest`, { token: est1 })).status === 201, '7. Registrar interés (201)');
  const register = await req('POST', `/activities/${actId}/register`, { token: est1 });
  check([200, 201].includes(register.status) && register.data.status === 'registered', '7. Inscripción (status registered)');

  // ---------- 8. Confirmar participación ----------
  await section('8. Confirmar participación');
  const confirm = await req('PATCH', `/activities/${actId}/confirm-participation`, { token: director, body: { studentProfileId: p1, status: 'confirmed' } });
  check(confirm.status === 200 && confirm.data.status === 'confirmed', '8. Director registra la participación');
  check((await req('PATCH', `/activities/${actId}/confirm-participation`, { token: teacher, body: { studentProfileId: p1, status: 'confirmed' } })).status === 403, '8. Docente NO registra participación -> 403');
  check((await req('PATCH', `/activities/${actId}/confirm-participation`, { token: est1, body: { studentProfileId: p1, status: 'confirmed' } })).status === 403, '8. Estudiante NO confirma su participación -> 403');

  // ---------- 9. Crear proyecto ----------
  await section('9. Proyecto');
  const project = await req('POST', '/projects', { token: est1, body: { title: `Proyecto ${TS}`, areaId: web?.id, technologies: ['React', 'Node.js'], status: 'active' } });
  check(project.status === 201, '9. Crear proyecto (201)', `status ${project.status}`);
  const projectId = project.data?.id;
  // estudiante sin perfil no puede crear proyecto
  await req('POST', '/auth/register', { body: { firstName: 'Test', lastName: 'Sinperfil', email: email('np'), password: PWD } });
  const noProfile = (await req('POST', '/auth/login', { body: { email: email('np'), password: PWD } })).data.accessToken;
  check((await req('POST', '/projects', { token: noProfile, body: { title: 'x' } })).status === 400, '9. Proyecto sin perfil -> 400');

  // ---------- 10. Evidencia ----------
  await section('10. Evidencia');
  check((await req('POST', `/projects/${projectId}/evidences`, { token: est1, body: { evidenceType: 'link', description: 'repo', externalUrl: 'https://github.com/demo/x' } })).status === 201, '10. Adjuntar evidencia (enlace, 201)');
  check((await req('POST', `/projects/${projectId}/evidences`, { token: est1, body: { evidenceType: 'file', description: 'x' } })).status === 400, '10. Evidencia file sin fileUrl -> 400');

  // ---------- 11. Certificado externo ----------
  await section('11. Certificado externo');
  check((await req('POST', '/certificates/external', { token: est1, body: { certificateName: 'Cert Demo', issuer: 'Externa Demo', certificateUrl: 'https://cert.example.com/x', issueDate: '2026-01-10' } })).status === 201, '11. Registrar certificado externo (201)');
  check((await req('GET', '/certificates/external/my', { token: est1 })).data.length >= 1, '11. Listar mis certificados');
  check((await req('POST', '/certificates/external', { token: teacher, body: { certificateName: 'x', issuer: 'y' } })).status === 403, '11. Docente NO registra certificado de estudiante -> 403');

  // ---------- 12. Recalcular afinidad ----------
  await section('12. Afinidad');
  const recalc = await req('POST', '/affinity/recalculate/me', { token: est1 });
  check(recalc.status === 200 && Array.isArray(recalc.data), '12. Recalcular afinidad (200)');
  const aff = await req('GET', '/affinity/me', { token: est1 });
  const webAff = (aff.data ?? []).find((a) => a.academicArea?.name === (web?.name));
  check(!!webAff && ['low', 'medium', 'high'].includes(webAff.level), `12. Afinidad calculada con nivel (${webAff?.academicArea?.name}=${webAff?.score}/${webAff?.level})`);

  // ---------- 13. Reportes ----------
  await section('13. Reportes');
  const tOver = await req('GET', '/reports/teacher/overview', { token: teacher });
  // El reporte del docente no depende del alcance por semestre: es agregado.
  check(tOver.status === 200 && tOver.data.students.total > 0, '13. Reporte docente (overview)');
  check((await req('GET', '/reports/teacher/affinity-summary', { token: teacher })).status === 200, '13. Reporte docente (afinidad del grupo)');
  check((await req('GET', '/reports/director/overview', { token: director })).status === 200, '13. Reporte director (overview)');
  check((await req('GET', '/reports/director/participation-by-semester', { token: director })).status === 200, '13. Director: participación por semestre');
  check((await req('GET', '/reports/director/affinity-map', { token: director })).status === 200, '13. Director: mapa de afinidad');
  check((await req('GET', '/reports/director/overview', { token: teacher })).status === 403, '13. Docente NO ve reporte de director -> 403');

  console.log(`\n== Resultado: ${pass} OK, ${fail} fallos ==\n`);
  process.exit(fail === 0 ? 0 : 1);
}

main().catch((e) => { console.error('Error en pruebas:', e.message); process.exit(1); });
