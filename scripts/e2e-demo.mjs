// Flujo e2e del 30% inicial contra la API real.
// Ejecuta los 14 pasos del flujo principal y deja datos de demo en la BD.
// Uso: node scripts/e2e-demo.mjs   (requiere API corriendo y seeds base aplicados)

const API = process.env.API_URL ?? 'http://localhost:3000/api';
const PWD = 'Demo123*';

let pass = 0;
let fail = 0;
const ok = (label) => { pass++; console.log(`  ✓ ${label}`); };
const bad = (label, detail) => { fail++; console.log(`  ✗ ${label}${detail ? ' -> ' + detail : ''}`); };

async function req(method, path, { token, body } = {}) {
  const res = await fetch(`${API}${path}`, {
    method,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  let data = null;
  try { data = await res.json(); } catch { /* sin cuerpo */ }
  return { status: res.status, data };
}

// Crea (admin) o reutiliza un usuario con rol; devuelve token.
async function ensureUser(adminToken, role, email, firstName) {
  const created = await req('POST', '/users', {
    token: adminToken,
    body: { firstName, lastName: 'Demo', email, password: PWD, role },
  });
  if (created.status !== 201 && created.status !== 409) {
    throw new Error(`No se pudo crear ${role} (${created.status}): ${JSON.stringify(created.data)}`);
  }
  const login = await req('POST', '/auth/login', { body: { email, password: PWD } });
  return login.data.accessToken;
}

async function ensureStudent(email, firstName) {
  const reg = await req('POST', '/auth/register', {
    body: { firstName, lastName: 'Demo', email, password: PWD },
  });
  if (reg.status === 201) return reg.data.accessToken;
  const login = await req('POST', '/auth/login', { body: { email, password: PWD } });
  return login.data.accessToken;
}

async function ensureProfile(token, data) {
  const create = await req('POST', '/profiles/me', { token, body: data });
  if (create.status === 409) {
    await req('PATCH', '/profiles/me', { token, body: { semester: data.semester, bio: data.bio, improvementAreaIds: data.improvementAreaIds } });
  }
  const me = await req('GET', '/profiles/me', { token });
  return me.data.id;
}

async function findOrCreateActivity(token, title, body) {
  const list = await req('GET', '/activities', { token, params: '' });
  const existing = (list.data ?? []).find((a) => a.title === title);
  if (existing) return existing.id;
  const created = await req('POST', '/activities', { token, body: { ...body, title } });
  return created.data?.id;
}

async function main() {
  console.log(`\n== Flujo e2e del 30% contra ${API} ==\n`);

  // health
  const health = await req('GET', '/health');
  health.status === 200 && health.data.database === 'up'
    ? ok('API y base de datos arriba')
    : bad('API/BD', JSON.stringify(health.data));

  // 1) Admin: roles y áreas académicas
  const admin = await req('POST', '/auth/login', { body: { email: 'admin@univalle.edu', password: 'Admin123*' } });
  const adminToken = admin.data?.accessToken;
  adminToken ? ok('1. Admin inicia sesión') : bad('1. Admin login', JSON.stringify(admin.data));

  const roles = await req('GET', '/roles', { token: adminToken });
  roles.data?.length >= 5 ? ok(`1. Roles confirmados (${roles.data.length})`) : bad('1. Roles', JSON.stringify(roles.data));

  const areasRes = await req('GET', '/academic-areas', { token: adminToken });
  const areas = areasRes.data ?? [];
  areas.length >= 8 ? ok(`1. Áreas académicas confirmadas (${areas.length})`) : bad('1. Áreas académicas', JSON.stringify(areasRes.data));
  const web = areas.find((a) => a.name === 'Desarrollo Web');
  const ia = areas.find((a) => a.name === 'Inteligencia Artificial');

  const skillsRes = await req('GET', '/skills', { token: adminToken });
  const react = (skillsRes.data ?? []).find((s) => s.name === 'React');
  const python = (skillsRes.data ?? []).find((s) => s.name === 'Python');
  react ? ok('1. Catálogo de habilidades disponible') : bad('1. Skills', 'sin React');

  // crear staff
  const teacherToken = await ensureUser(adminToken, 'TEACHER', 'demo.docente@univalle.edu', 'Docente');
  const societyToken = await ensureUser(adminToken, 'SCIENTIFIC_SOCIETY', 'demo.sociedad@univalle.edu', 'Sociedad');
  const directorToken = await ensureUser(adminToken, 'CAREER_DIRECTOR', 'demo.director@univalle.edu', 'Director');
  (teacherToken && societyToken && directorToken) ? ok('1. Docente, sociedad y director listos') : bad('1. Staff', 'faltan tokens');

  // 2) Estudiante se registra e inicia sesión
  const s1 = await ensureStudent('demo.est1@univalle.edu', 'Ana');
  const s2 = await ensureStudent('demo.est2@univalle.edu', 'Beto');
  (s1 && s2) ? ok('2. Estudiantes registrados e inician sesión') : bad('2. Estudiantes', 'faltan tokens');

  // 3) Estudiante crea perfil
  const p1 = await ensureProfile(s1, { universityCode: 'SIS-DEMO-1', semester: 5, bio: 'Interés en desarrollo web', improvementAreaIds: web ? [web.id] : [] });
  const p2 = await ensureProfile(s2, { universityCode: 'SIS-DEMO-2', semester: 7, bio: 'Interés en datos e IA', improvementAreaIds: ia ? [ia.id] : [] });
  (p1 && p2) ? ok(`3. Perfiles creados (p1=${p1.slice(0, 8)}…)`) : bad('3. Perfiles', 'sin id');

  // 4) Intereses y habilidades
  if (web && ia) {
    await req('PUT', '/profiles/me/interests', { token: s1, body: { items: [{ academicAreaId: web.id, priority: 5 }, { academicAreaId: ia.id, priority: 2 }] } });
    await req('PUT', '/profiles/me/interests', { token: s2, body: { items: [{ academicAreaId: ia.id, priority: 5 }] } });
  }
  if (react) await req('PUT', '/profiles/me/skills', { token: s1, body: { items: [{ skillId: react.id, level: 4 }] } });
  if (python) await req('PUT', '/profiles/me/skills', { token: s2, body: { items: [{ skillId: python.id, level: 3 }] } });
  ok('4. Intereses y habilidades registrados');

  // 5) Docente y sociedad publican actividad
  const actAcad = await findOrCreateActivity(teacherToken, 'Taller de Desarrollo Web (demo)', {
    type: 'academica', category: 'taller_academico', modality: 'presencial', areaId: web?.id, capacity: 30, status: 'open',
  });
  const actExtra = await findOrCreateActivity(societyToken, 'Hackathon de IA (demo)', {
    type: 'extracurricular', category: 'hackathon', modality: 'hibrida', areaId: ia?.id, capacity: 50, status: 'open',
  });
  (actAcad && actExtra) ? ok('5. Actividad académica y extracurricular publicadas') : bad('5. Actividades', `acad=${actAcad} extra=${actExtra}`);

  // verificar regla de rol: docente NO publica extracurricular
  const forbiddenPub = await req('POST', '/activities', { token: teacherToken, body: { title: 'x', type: 'extracurricular', category: 'hackathon' } });
  forbiddenPub.status === 403 ? ok('5. Regla de rol: docente no publica extracurricular (403)') : bad('5. Regla rol publicación', `status ${forbiddenPub.status}`);

  // 6) Estudiante consulta actividades
  const visible = await req('GET', '/activities', { token: s1 });
  (visible.data ?? []).some((a) => a.id === actAcad) ? ok(`6. Estudiante consulta actividades (${visible.data.length})`) : bad('6. Consulta actividades', 'no ve la actividad');

  // 7) Estudiante registra interés / inscripción
  await req('POST', `/activities/${actExtra}/register-interest`, { token: s1 });
  const reg = await req('POST', `/activities/${actAcad}/register`, { token: s1 });
  [200, 201].includes(reg.status) ? ok('7. Estudiante registra interés e inscripción') : bad('7. Inscripción', `status ${reg.status}`);

  // 8) Docente confirma participación
  const confirm = await req('PATCH', `/activities/${actAcad}/confirm-participation`, { token: teacherToken, body: { studentProfileId: p1, status: 'confirmed' } });
  confirm.status === 200 && confirm.data.status === 'confirmed' ? ok('8. Docente confirma participación') : bad('8. Confirmación', JSON.stringify(confirm.data));

  // regla: estudiante no confirma
  const selfConfirm = await req('PATCH', `/activities/${actAcad}/confirm-participation`, { token: s1, body: { studentProfileId: p1, status: 'confirmed' } });
  selfConfirm.status === 403 ? ok('8. Regla: estudiante no confirma su participación (403)') : bad('8. Regla confirmación', `status ${selfConfirm.status}`);

  // 9) Estudiante registra proyecto
  const project = await req('POST', '/projects', { token: s1, body: { title: 'Plataforma Web (demo)', description: 'Proyecto demo', areaId: web?.id, technologies: ['React', 'Node.js'], status: 'active', repositoryUrl: 'https://github.com/demo/web' } });
  const projectId = project.data?.id;
  projectId ? ok('9. Estudiante registra proyecto académico') : bad('9. Proyecto', JSON.stringify(project.data));

  // 10) Adjunta evidencia
  const evidence = await req('POST', `/projects/${projectId}/evidences`, { token: s1, body: { evidenceType: 'link', description: 'Repositorio', externalUrl: 'https://github.com/demo/web' } });
  evidence.status === 201 ? ok('10. Estudiante adjunta evidencia (enlace)') : bad('10. Evidencia', JSON.stringify(evidence.data));

  // 11) Motor de afinidad recalcula (los hooks ya dispararon; forzamos explícito)
  const recalc = await req('POST', '/affinity/recalculate/me', { token: s1 });
  recalc.status === 200 ? ok(`11. Motor de afinidad recalcula (${recalc.data.length} áreas)`) : bad('11. Recalculo', `status ${recalc.status}`);

  // 12) Estudiante visualiza afinidades
  const affinity = await req('GET', '/affinity/me', { token: s1 });
  const topWeb = (affinity.data ?? []).find((a) => a.academicArea?.name === 'Desarrollo Web');
  topWeb ? ok(`12. Estudiante visualiza afinidades (Desarrollo Web = ${topWeb.score}, ${topWeb.level})`) : bad('12. Afinidades', JSON.stringify(affinity.data));

  // 13) Docente consulta perfil permitido
  const allowed = await req('GET', `/profiles/${p1}/allowed`, { token: teacherToken });
  const noEmail = allowed.data && !('email' in allowed.data) && !('internalConstancies' in allowed.data);
  allowed.status === 200 && noEmail ? ok('13. Docente consulta perfil permitido (sin datos sensibles)') : bad('13. Perfil permitido', JSON.stringify(allowed.data));

  // 14) Director: reporte básico y mapa de afinidad
  const overview = await req('GET', '/reports/director/overview', { token: directorToken });
  overview.status === 200 && overview.data.totals.students >= 2 ? ok(`14. Director ve reporte (est=${overview.data.totals.students}, proy=${overview.data.totals.projects})`) : bad('14. Reporte director', JSON.stringify(overview.data));
  const map = await req('GET', '/reports/director/affinity-map', { token: directorToken });
  (map.data ?? []).length >= 1 ? ok(`14. Director ve mapa de afinidad (${map.data.length} áreas)`) : bad('14. Mapa afinidad', JSON.stringify(map.data));
  const semester = await req('GET', '/reports/director/participation-by-semester', { token: directorToken });
  semester.status === 200 ? ok(`14. Participación por semestre (${semester.data.length} grupos)`) : bad('14. Participación/semestre', `status ${semester.status}`);

  // Seguridad transversal: estudiante no accede a gestión de usuarios
  const forbidden = await req('GET', '/users', { token: s1 });
  forbidden.status === 403 ? ok('Roles: estudiante no accede a /users (403)') : bad('Roles', `status ${forbidden.status}`);

  console.log(`\n== Resultado: ${pass} OK, ${fail} fallos ==\n`);
  process.exit(fail === 0 ? 0 : 1);
}

main().catch((e) => { console.error('Error e2e:', e.message); process.exit(1); });
