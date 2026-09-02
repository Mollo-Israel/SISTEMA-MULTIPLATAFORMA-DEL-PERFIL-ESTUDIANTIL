// =============================================================================
//  Prueba integral del Objetivo 5 — Portafolio de proyectos estudiantiles
//  RF13 · RF14 · RF15 · RF16
// =============================================================================
//
//  Ejecuta de punta a punta, contra la API real, el quinto objetivo especifico.
//  Cubre el camino de exito y los rechazos esperados.
//
//  Uso:  node scripts/e2e-objective-5.mjs
//        API_URL=http://localhost:3010/api node scripts/e2e-objective-5.mjs
//
//  Requiere: API corriendo + migraciones aplicadas + `npm run seed:populate`.
//  Las cuentas que crea llevan sufijo de tiempo, por lo que puede repetirse.
// =============================================================================

import { Buffer } from 'node:buffer';

const API = process.env.API_URL ?? 'http://localhost:3000/api';
const TS = Date.now();
const PWD = 'Afinia2026*';
const email = (n) => `o5.${n}.${TS}@univalle.edu`;
const studentEmail = (n) => `o5.${n}.${TS}@est.univalle.edu`;

let pass = 0;
let fail = 0;
const failures = [];

const C = { ok: '[32m', bad: '[31m', dim: '[90m', b: '[1m', m: '[35m', r: '[0m' };
const ok = (l) => { pass++; console.log(`  ${C.ok}✓${C.r} ${l}`); };
const bad = (l, d) => {
  fail++;
  failures.push(`${l}${d ? ' -> ' + d : ''}`);
  console.log(`  ${C.bad}✗${C.r} ${l}${d ? ` ${C.dim}-> ${d}${C.r}` : ''}`);
};
const check = (cond, label, detail) => (cond ? ok(label) : bad(label, detail));
const section = (t) => console.log(`\n${C.b}${t}${C.r}`);
const objective = (t) =>
  console.log(`\n${C.b}${C.m}${'='.repeat(78)}\n ${t}\n${'='.repeat(78)}${C.r}`);

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
  const text = await res.text();
  let data = null;
  try {
    data = text ? JSON.parse(text) : null;
  } catch {
    data = text;
  }
  return { status: res.status, data };
}

const msgOf = (r) => {
  const m = r?.data?.message;
  return Array.isArray(m) ? m.join(' | ') : (m ?? JSON.stringify(r?.data ?? '').slice(0, 140));
};

// ---------------------------------------------------------------------------

async function main() {
  console.log(`\n${C.b}Prueba integral del Objetivo 5 contra ${API}${C.r}`);

  const adminLogin = await req('POST', '/auth/login', {
    body: { email: 'admin@univalle.edu', password: 'Admin123*' },
  });
  const admin = adminLogin.data?.accessToken;
  if (!admin) {
    console.error(
      `\n${C.bad}No se pudo iniciar sesion como administrador.${C.r}\n` +
        'Ejecute primero: npm run api:migrate && npm run seed:populate\n',
    );
    process.exit(1);
  }

  const areas = (await req('GET', '/academic-areas', { token: admin })).data ?? [];
  const webArea = areas.find((a) => a.name === 'Desarrollo Web') ?? areas[0];
  const dataArea = areas.find((a) => a.name === 'Bases de Datos') ?? areas[1] ?? areas[0];

  const ctx = { admin, webArea, dataArea };
  await prepararActores(ctx);
  await rf13(ctx);
  await rf14(ctx);
  await rf15(ctx);
  await rf16(ctx);

  console.log(`\n${'-'.repeat(78)}`);
  if (fail === 0) {
    console.log(`${C.ok}${C.b}  ${pass} verificaciones OK · 0 fallos${C.r}`);
    console.log('  El Objetivo 5 queda demostrado de punta a punta.\n');
  } else {
    console.log(`${C.bad}${C.b}  ${pass} OK · ${fail} FALLOS${C.r}`);
    failures.forEach((f) => console.log(`   ${C.bad}·${C.r} ${f}`));
    console.log('');
    process.exitCode = 1;
  }
}

/**
 * Actores del escenario:
 *   A  estudiante responsable, 4o semestre
 *   B  estudiante invitado, 4o semestre
 *   C  estudiante ajeno, 7o semestre
 *   docenteEnAlcance   habilitado en 4o  -> ve los proyectos de A
 *   docenteFueraAlcance habilitado en 2o -> no ve nada de A
 */
async function prepararActores(ctx) {
  objective('PREPARACION · Actores del escenario');
  section('Cuentas y alcances');

  const nuevoEstudiante = async (key, first, last, semester) => {
    const reg = await req('POST', '/auth/register', {
      body: { firstName: first, lastName: last, email: studentEmail(key), password: PWD },
    });
    const token = reg.data?.accessToken;
    const profile = await req('POST', '/profiles/me', {
      token,
      body: { semester, bio: `Estudiante de ${semester}o semestre.` },
    });
    return { token, profileId: profile.data?.id, userId: reg.data?.user?.id, name: `${first} ${last}` };
  };

  ctx.A = await nuevoEstudiante('estA', 'Ariana', 'Peredo', 4);
  ctx.B = await nuevoEstudiante('estB', 'Bruno', 'Callisaya', 4);
  ctx.C = await nuevoEstudiante('estC', 'Carla', 'Nogales', 7);
  check(!!ctx.A.token && !!ctx.B.token && !!ctx.C.token, 'P.1 Tres estudiantes registrados con perfil');
  check(!!ctx.A.profileId && !!ctx.B.profileId, 'P.2 Los perfiles quedan creados');

  const nuevoDocente = async (key, first, last, semesters) => {
    const created = await req('POST', '/users', {
      token: ctx.admin,
      body: { firstName: first, lastName: last, email: email(key), password: PWD, role: 'TEACHER' },
    });
    await req('PUT', `/users/${created.data?.id}/semesters`, {
      token: ctx.admin,
      body: { semesters },
    });
    const login = await req('POST', '/auth/login', { body: { email: email(key), password: PWD } });
    return { token: login.data?.accessToken, id: created.data?.id, name: `${first} ${last}` };
  };

  ctx.docente = await nuevoDocente('docente', 'Ruben', 'Ledezma', [4]);
  ctx.docenteFuera = await nuevoDocente('docenteFuera', 'Silvia', 'Arce', [2]);
  ctx.otroDocente = await nuevoDocente('otroDocente', 'Nestor', 'Rivas', [4]);
  check(!!ctx.docente.token, 'P.3 Docente habilitado en 4o semestre');
  check(!!ctx.docenteFuera.token, 'P.4 Docente habilitado solo en 2o semestre');

  const director = await req('POST', '/users', {
    token: ctx.admin,
    body: {
      firstName: 'Elsa',
      lastName: 'Montano',
      email: email('director'),
      password: PWD,
      role: 'CAREER_DIRECTOR',
    },
  });
  ctx.directorToken = (
    await req('POST', '/auth/login', { body: { email: email('director'), password: PWD } })
  ).data?.accessToken;
  check(director.status === 201 && !!ctx.directorToken, 'P.5 Director de carrera disponible');
}

// ===========================================================================
//  RF13 · Gestionar proyecto del portafolio
// ===========================================================================
async function rf13(ctx) {
  objective('RF13 · Gestionar proyecto del portafolio');
  const { A, B, webArea, dataArea } = ctx;

  section('Registro del proyecto');
  const created = await req('POST', '/projects', {
    token: A.token,
    body: {
      title: `Sistema de monitoreo IoT para laboratorios ${TS}`,
      description: 'Sensores de temperatura y humedad con panel de control en tiempo real.',
      areaId: dataArea.id,
      technologies: ['Python', 'Docker', 'PostgreSQL'],
      status: 'active',
      repositoryUrl: 'https://github.com/afinia/iot-labs',
      demoUrl: 'https://iot-labs.demo.example.com',
      visibility: 'teachers',
    },
  });
  check(created.status === 201, '13.1 El estudiante crea un proyecto', `status ${created.status} ${msgOf(created)}`);
  const projectId = created.data?.id;
  ctx.projectId = projectId;

  check(created.data?.createdByProfileId === A.profileId, '13.2 El proyecto queda a nombre del responsable');
  check(created.data?.visibility === 'teachers', '13.3 La visibilidad se registra');
  check(created.data?.status === 'active', '13.4 El estado se registra');
  check(created.data?.academicAreaId === dataArea.id, '13.5 El area academica se registra');
  check(
    JSON.stringify(created.data?.technologies) === JSON.stringify(['Python', 'Docker', 'PostgreSQL']),
    '13.6 Las tecnologias se registran',
  );
  check(
    created.data?.repositoryUrl?.includes('github') && !!created.data?.demoUrl,
    '13.7 Los enlaces de repositorio y demostracion se registran',
  );

  section('Persistencia y portafolio');
  const mine = await req('GET', '/projects/my', { token: A.token });
  check(mine.status === 200 && mine.data.some((p) => p.id === projectId), '13.8 El proyecto aparece en el portafolio');
  check(
    mine.data.find((p) => p.id === projectId)?.isOwner === true,
    '13.9 El portafolio lo marca como proyecto propio',
  );

  const detail = await req('GET', `/projects/${projectId}`, { token: A.token });
  check(detail.status === 200 && detail.data.title.includes('IoT'), '13.10 El detalle persiste tras releer');

  section('Edicion');
  const edited = await req('PATCH', `/projects/${projectId}`, {
    token: A.token,
    body: {
      description: 'Sensores de temperatura, humedad y consumo eléctrico, con alertas por umbral.',
      technologies: ['Python', 'Docker', 'PostgreSQL', 'Grafana'],
      areaId: webArea.id,
      status: 'active',
    },
  });
  check(edited.status === 200, '13.11 El responsable edita su proyecto', msgOf(edited));
  check(edited.data?.technologies?.length === 4, '13.12 Las tecnologias editadas persisten');
  check(edited.data?.academicAreaId === webArea.id, '13.13 El area editada persiste');

  const visibilityChange = await req('PATCH', `/projects/${projectId}`, {
    token: A.token,
    body: { visibility: 'private' },
  });
  check(visibilityChange.data?.visibility === 'private', '13.14 La visibilidad se puede cambiar');
  await req('PATCH', `/projects/${projectId}`, { token: A.token, body: { visibility: 'teachers' } });

  section('Validaciones y permisos');
  const foreignEdit = await req('PATCH', `/projects/${projectId}`, {
    token: B.token,
    body: { title: 'Proyecto secuestrado' },
  });
  check(
    foreignEdit.status === 403,
    '13.15 Otro estudiante NO edita un proyecto ajeno -> 403',
    `status ${foreignEdit.status}`,
  );

  const shortTitle = await req('POST', '/projects', { token: A.token, body: { title: 'x' } });
  check(shortTitle.status === 400, '13.16 Titulo demasiado corto -> 400', `status ${shortTitle.status}`);

  const badUrl = await req('POST', '/projects', {
    token: A.token,
    body: { title: `Proyecto con enlace invalido ${TS}`, repositoryUrl: 'no-es-una-url' },
  });
  check(badUrl.status === 400, '13.17 Enlace invalido -> 400', `status ${badUrl.status}`);

  const badVisibility = await req('POST', '/projects', {
    token: A.token,
    body: { title: `Proyecto con visibilidad invalida ${TS}`, visibility: 'publico_mundial' },
  });
  check(badVisibility.status === 400, '13.18 Visibilidad inexistente -> 400', `status ${badVisibility.status}`);

  const dupTech = await req('POST', '/projects', {
    token: A.token,
    body: { title: `Proyecto con tecnologias repetidas ${TS}`, technologies: ['React', 'React'] },
  });
  check(
    dupTech.status === 201 && dupTech.data?.technologies?.length === 1,
    '13.19 Las tecnologias duplicadas se depuran',
    msgOf(dupTech),
  );

  const teacherCreates = await req('POST', '/projects', {
    token: ctx.docente.token,
    body: { title: `Proyecto del docente ${TS}` },
  });
  check(teacherCreates.status === 403, '13.20 El docente NO registra proyectos -> 403');

  section('Evidencias del proyecto (almacenamiento real)');
  const pdf = Buffer.from('%PDF-1.4\n1 0 obj<</Type/Catalog>>endobj\ntrailer<</Root 1 0 R>>\n%%EOF\n', 'utf8');
  const form = new FormData();
  form.append('file', new Blob([pdf], { type: 'application/pdf' }), 'informe-avance.pdf');
  const upload = await req('POST', '/uploads', { token: A.token, raw: form });
  check(upload.status === 201, '13.21 El estudiante sube un archivo real', msgOf(upload));

  const fileEvidence = await req('POST', '/evidences', {
    token: A.token,
    body: {
      evidenceType: 'file',
      description: 'Informe de avance del proyecto',
      fileUrl: upload.data?.url,
      fileName: upload.data?.originalName,
      mimeType: upload.data?.mimeType,
      fileSize: upload.data?.size,
      projectId,
    },
  });
  check(fileEvidence.status === 201, '13.22 Evidencia de archivo asociada al proyecto', msgOf(fileEvidence));

  const linkEvidence = await req('POST', '/evidences', {
    token: A.token,
    body: {
      evidenceType: 'link',
      description: 'Repositorio del proyecto',
      externalUrl: 'https://github.com/afinia/iot-labs',
      projectId,
    },
  });
  check(linkEvidence.status === 201, '13.23 Evidencia de enlace asociada al proyecto');

  const withEvidences = await req('GET', `/projects/${projectId}`, { token: A.token });
  check(
    (withEvidences.data?.evidences ?? []).length >= 2,
    '13.24 Las evidencias quedan vinculadas al proyecto',
  );

  const foreignEvidence = await req('POST', '/evidences', {
    token: B.token,
    body: { evidenceType: 'link', externalUrl: 'https://example.com/ajeno', projectId },
  });
  check(
    foreignEvidence.status === 403,
    '13.25 Un estudiante ajeno NO adjunta evidencia al proyecto -> 403',
    `status ${foreignEvidence.status}`,
  );
}

// ===========================================================================
//  RF14 · Gestionar integrantes de proyecto
// ===========================================================================
async function rf14(ctx) {
  objective('RF14 · Gestionar integrantes de proyecto');
  const { A, B, C, projectId } = ctx;

  section('Envio de la invitacion');
  const selfInvite = await req('POST', `/projects/${projectId}/invitations`, {
    token: A.token,
    body: { invitedProfileId: A.profileId, proposedRole: 'Líder Técnico' },
  });
  check(selfInvite.status === 400, '14.1 El responsable NO se invita a si mismo -> 400', `status ${selfInvite.status}`);

  const noRole = await req('POST', `/projects/${projectId}/invitations`, {
    token: A.token,
    body: { invitedProfileId: B.profileId, proposedRole: '' },
  });
  check(noRole.status === 400, '14.2 Invitacion sin rol propuesto -> 400');

  const invite = await req('POST', `/projects/${projectId}/invitations`, {
    token: A.token,
    body: { invitedProfileId: B.profileId, proposedRole: 'Desarrollador Backend' },
  });
  check(invite.status === 201, '14.3 El responsable invita a otro estudiante', msgOf(invite));
  check(invite.data?.status === 'pending', '14.4 La invitacion nace PENDIENTE');
  check(invite.data?.proposedRole === 'Desarrollador Backend', '14.5 El rol propuesto queda registrado');
  const invitationId = invite.data?.id;

  const duplicate = await req('POST', `/projects/${projectId}/invitations`, {
    token: A.token,
    body: { invitedProfileId: B.profileId, proposedRole: 'Tester' },
  });
  check(duplicate.status === 409, '14.6 Invitacion pendiente duplicada -> 409', `status ${duplicate.status}`);

  const notAStudent = await req('POST', `/projects/${projectId}/invitations`, {
    token: A.token,
    body: { invitedProfileId: '00000000-0000-0000-0000-000000000000', proposedRole: 'Analista' },
  });
  check(notAStudent.status === 400, '14.7 Invitar a un perfil inexistente -> 400');

  const foreignInvite = await req('POST', `/projects/${projectId}/invitations`, {
    token: C.token,
    body: { invitedProfileId: B.profileId, proposedRole: 'Tester' },
  });
  check(
    foreignInvite.status === 403,
    '14.8 Un estudiante ajeno NO invita a un proyecto que no es suyo -> 403',
    `status ${foreignInvite.status}`,
  );

  section('Antes de aceptar no hay pertenencia');
  const membersBefore = await req('GET', `/projects/${projectId}/members`, { token: A.token });
  check(
    membersBefore.status === 200 && membersBefore.data.length === 0,
    '14.9 Con la invitacion pendiente el proyecto NO tiene integrantes',
  );
  const portfolioB = await req('GET', '/projects/my', { token: B.token });
  check(
    !portfolioB.data.some((p) => p.id === projectId),
    '14.10 El proyecto NO aparece en el portafolio del invitado mientras esta pendiente',
  );

  section('Consulta y respuesta del invitado');
  const inbox = await req('GET', '/projects/invitations/mine?pending=true', { token: B.token });
  check(inbox.status === 200 && inbox.data.some((i) => i.id === invitationId), '14.11 El invitado ve su invitacion');
  const own = inbox.data.find((i) => i.id === invitationId);
  check(own?.project?.title?.includes('IoT'), '14.12 La invitacion muestra la informacion del proyecto');
  check(own?.proposedRole === 'Desarrollador Backend', '14.13 La invitacion muestra el rol propuesto');

  const otherAccepts = await req('PATCH', `/projects/invitations/${invitationId}`, {
    token: C.token,
    body: { decision: 'accept' },
  });
  check(
    otherAccepts.status === 403,
    '14.14 Otro estudiante NO acepta una invitacion ajena -> 403',
    `status ${otherAccepts.status}`,
  );

  section('Rechazo: no genera pertenencia');
  const inviteC = await req('POST', `/projects/${projectId}/invitations`, {
    token: A.token,
    body: { invitedProfileId: C.profileId, proposedRole: 'Analista' },
  });
  const rejected = await req('PATCH', `/projects/invitations/${inviteC.data?.id}`, {
    token: C.token,
    body: { decision: 'reject' },
  });
  check(rejected.status === 200 && rejected.data?.status === 'rejected', '14.15 El invitado rechaza la invitacion');
  const membersAfterReject = await req('GET', `/projects/${projectId}/members`, { token: A.token });
  check(
    membersAfterReject.data.length === 0,
    '14.16 Rechazar NO crea integrante',
  );
  const portfolioC = await req('GET', '/projects/my', { token: C.token });
  check(
    !portfolioC.data.some((p) => p.id === projectId),
    '14.17 El proyecto rechazado NO aparece en el portafolio de quien rechazo',
  );
  const respondTwice = await req('PATCH', `/projects/invitations/${inviteC.data?.id}`, {
    token: C.token,
    body: { decision: 'accept' },
  });
  check(
    respondTwice.status === 400,
    '14.18 No se responde dos veces la misma invitacion -> 400',
    `status ${respondTwice.status}`,
  );

  section('Aceptacion: nace la pertenencia');
  const accepted = await req('PATCH', `/projects/invitations/${invitationId}`, {
    token: B.token,
    body: { decision: 'accept' },
  });
  check(accepted.status === 200 && accepted.data?.status === 'accepted', '14.19 El invitado acepta', msgOf(accepted));

  const membersAfter = await req('GET', `/projects/${projectId}/members`, { token: A.token });
  check(membersAfter.data.length === 1, '14.20 Se crea el integrante al aceptar');
  check(
    membersAfter.data[0]?.role === 'Desarrollador Backend',
    '14.21 El rol propuesto queda persistido en la pertenencia',
  );

  const portfolioBAfter = await req('GET', '/projects/my', { token: B.token });
  const sharedEntry = portfolioBAfter.data.find((p) => p.id === projectId);
  check(!!sharedEntry, '14.22 El proyecto aparece en el portafolio del nuevo integrante');
  check(sharedEntry?.isOwner === false, '14.23 Se distingue como proyecto colaborativo, no propio');
  check(sharedEntry?.myRole === 'Desarrollador Backend', '14.24 El portafolio muestra su rol');

  const inviteAgain = await req('POST', `/projects/${projectId}/invitations`, {
    token: A.token,
    body: { invitedProfileId: B.profileId, proposedRole: 'Tester' },
  });
  check(
    inviteAgain.status === 409,
    '14.25 No se invita a quien ya es integrante -> 409',
    `status ${inviteAgain.status}`,
  );

  section('Gestion desde el proyecto');
  const projectInvites = await req('GET', `/projects/${projectId}/invitations`, { token: A.token });
  check(projectInvites.status === 200 && projectInvites.data.length >= 2, '14.26 El responsable ve sus invitaciones');
  check(
    projectInvites.data.some((i) => i.status === 'accepted') &&
      projectInvites.data.some((i) => i.status === 'rejected'),
    '14.27 El responsable distingue aceptadas de rechazadas',
  );
  const invitesAsMember = await req('GET', `/projects/${projectId}/invitations`, { token: B.token });
  check(
    invitesAsMember.status === 403,
    '14.28 Un integrante NO gestiona las invitaciones del proyecto -> 403',
    `status ${invitesAsMember.status}`,
  );

  // El integrante tampoco realiza acciones de responsable
  const memberEdits = await req('PATCH', `/projects/${projectId}`, {
    token: B.token,
    body: { visibility: 'private' },
  });
  check(
    memberEdits.status === 403,
    '14.29 Un integrante NO cambia la visibilidad del proyecto -> 403',
    `status ${memberEdits.status}`,
  );

  ctx.invitationAcceptedId = invitationId;
}

// ===========================================================================
//  RF15 · Consultar portafolio de proyectos
// ===========================================================================
async function rf15(ctx) {
  objective('RF15 · Consultar portafolio de proyectos');
  const { A, B, C, projectId, docente, docenteFuera, dataArea } = ctx;

  section('Portafolio del estudiante');
  const mine = await req('GET', '/projects/my', { token: A.token });
  check(mine.data.filter((p) => p.isOwner).length >= 1, '15.1 El responsable ve sus proyectos propios');
  const bPortfolio = await req('GET', '/projects/my', { token: B.token });
  check(
    bPortfolio.data.some((p) => p.id === projectId && p.isOwner === false),
    '15.2 El integrante ve el proyecto colaborativo',
  );
  check(
    !(await req('GET', '/projects/my', { token: C.token })).data.some((p) => p.id === projectId),
    '15.3 Quien rechazo la invitacion NO lo ve en su portafolio',
  );

  section('Consulta docente: proyecto visible dentro del alcance');
  const portfolio = await req('GET', '/projects/institutional', { token: docente.token });
  check(portfolio.status === 200, '15.4 El docente consulta el portafolio institucional', msgOf(portfolio));
  check(portfolio.data?.scope?.restricted === true, '15.5 El portafolio informa que el alcance esta restringido');
  check(
    JSON.stringify(portfolio.data?.scope?.semesters) === '[4]',
    '15.6 El alcance corresponde a sus semestres habilitados',
  );
  check(
    portfolio.data?.projects?.some((p) => p.id === projectId),
    '15.7 El proyecto visible aparece en su portafolio institucional',
  );
  check(
    portfolio.data?.projects?.every((p) => p.semester === 4),
    '15.8 Solo trae proyectos de estudiantes de sus semestres',
  );

  const detail = await req('GET', `/projects/${projectId}`, { token: docente.token });
  check(detail.status === 200, '15.9 El docente abre el detalle del proyecto', msgOf(detail));
  check(
    (detail.data?.technologies ?? []).length > 0,
    '15.10 El detalle incluye las tecnologias',
  );
  const membersView = await req('GET', `/projects/${projectId}/members`, { token: docente.token });
  check(membersView.status === 200 && membersView.data.length === 1, '15.11 El docente ve los integrantes');

  section('Filtros del portafolio institucional');
  const byTech = await req('GET', '/projects/institutional?technology=Docker', { token: docente.token });
  check(
    byTech.status === 200 && byTech.data.projects.some((p) => p.id === projectId),
    '15.12 Filtro por tecnologia',
  );
  const byStatus = await req('GET', '/projects/institutional?status=active', { token: docente.token });
  check(
    byStatus.status === 200 && byStatus.data.projects.every((p) => p.status === 'active'),
    '15.13 Filtro por estado',
  );
  const bySearch = await req('GET', '/projects/institutional?search=Ariana', { token: docente.token });
  check(
    bySearch.status === 200 && bySearch.data.projects.some((p) => p.id === projectId),
    '15.14 Busqueda por nombre del estudiante',
  );
  const noHits = await req('GET', '/projects/institutional?technology=Cobol', { token: docente.token });
  check(
    noHits.status === 200 && noHits.data.projects.length === 0,
    '15.15 Una busqueda sin coincidencias devuelve lista vacia, no error',
  );
  const badArea = await req('GET', '/projects/institutional?areaId=no-es-uuid', { token: docente.token });
  check(badArea.status === 400, '15.16 Filtro con area invalida -> 400');

  section('Consulta docente: casos negativos');
  const outOfScope = await req('GET', '/projects/institutional', { token: docenteFuera.token });
  check(
    !outOfScope.data?.projects?.some((p) => p.id === projectId),
    '15.17 Un docente de otro semestre NO ve el proyecto en su listado',
  );
  const bypass = await req('GET', `/projects/${projectId}`, { token: docenteFuera.token });
  check(
    bypass.status === 403,
    '15.18 Tampoco accede escribiendo el ID directamente -> 403',
    `status ${bypass.status}`,
  );

  // Proyecto privado: ni siquiera el docente de su alcance lo ve
  const priv = await req('POST', '/projects', {
    token: A.token,
    body: {
      title: `Prototipo personal ${TS}`,
      description: 'Trabajo en curso que el estudiante todavia no comparte.',
      areaId: dataArea.id,
      visibility: 'private',
    },
  });
  ctx.privateProjectId = priv.data?.id;
  const privList = await req('GET', '/projects/institutional', { token: docente.token });
  check(
    !privList.data?.projects?.some((p) => p.id === ctx.privateProjectId),
    '15.19 Un proyecto privado NO aparece para el docente',
  );
  const privDetail = await req('GET', `/projects/${ctx.privateProjectId}`, { token: docente.token });
  check(
    privDetail.status === 403,
    '15.20 El docente NO abre un proyecto privado -> 403',
    `status ${privDetail.status}`,
  );

  // Visibilidad "en mi perfil": aparece en el perfil pero no en el portafolio docente
  const profileOnly = await req('POST', '/projects', {
    token: A.token,
    body: { title: `Proyecto solo de perfil ${TS}`, visibility: 'profile' },
  });
  const profileOnlyList = await req('GET', '/projects/institutional', { token: docente.token });
  check(
    !profileOnlyList.data?.projects?.some((p) => p.id === profileOnly.data?.id),
    '15.21 Un proyecto de visibilidad "perfil" NO entra al portafolio docente',
  );
  check(
    (await req('GET', `/projects/${profileOnly.data?.id}`, { token: docente.token })).status === 403,
    '15.22 Y su detalle tampoco es accesible para el docente -> 403',
  );

  const foreignStudent = await req('GET', `/projects/${projectId}`, { token: C.token });
  check(
    foreignStudent.status === 403,
    '15.23 Un estudiante ajeno NO abre el proyecto -> 403',
    `status ${foreignStudent.status}`,
  );

  const directorAccess = await req('GET', `/projects/${projectId}`, { token: ctx.directorToken });
  check(
    directorAccess.status === 403,
    '15.24 El director de carrera NO consulta el detalle individual (ningun RF se lo concede) -> 403',
    `status ${directorAccess.status}`,
  );

  section('Integracion con el perfil dinamico');
  const summaryB = await req('GET', '/profiles/me/summary', { token: B.token });
  check(
    summaryB.data?.projects?.some((p) => p.id === projectId && p.isOwner === false),
    '15.25 El perfil dinamico del integrante incluye el proyecto colaborativo',
  );
  const summaryC = await req('GET', '/profiles/me/summary', { token: C.token });
  check(
    !summaryC.data?.projects?.some((p) => p.id === projectId),
    '15.26 El perfil de quien rechazo NO lo incluye',
  );

  const allowed = await req('GET', `/profiles/${A.profileId}/allowed`, { token: docente.token });
  check(
    allowed.status === 200 &&
      !allowed.data?.projects?.some((p) => p.title.includes('Prototipo personal')),
    '15.27 La vista permitida del perfil oculta los proyectos privados',
  );

  section('Afinidad del integrante aceptado');
  const affinityB = await req('GET', '/affinity/me', { token: B.token });
  check(
    affinityB.status === 200 && affinityB.data.length > 0,
    '15.28 El proyecto colaborativo alimenta la afinidad del integrante',
    msgOf(affinityB),
  );
  const affinityC = await req('GET', '/affinity/me', { token: C.token });
  check(
    affinityC.status === 200 && affinityC.data.length === 0,
    '15.29 Una invitacion rechazada NO influye en la afinidad',
    `areas ${affinityC.data?.length}`,
  );
}

// ===========================================================================
//  RF16 · Registrar retroalimentacion sobre proyecto
// ===========================================================================
async function rf16(ctx) {
  objective('RF16 · Registrar retroalimentacion sobre proyecto');
  const { A, B, C, projectId, docente, docenteFuera, otroDocente } = ctx;

  section('Registro por el docente autorizado');
  const empty = await req('POST', `/projects/${projectId}/feedback`, {
    token: docente.token,
    body: { comment: '   ' },
  });
  check(empty.status === 400, '16.1 Comentario vacio -> 400', `status ${empty.status}`);

  const tooShort = await req('POST', `/projects/${projectId}/feedback`, {
    token: docente.token,
    body: { comment: 'Bien' },
  });
  check(tooShort.status === 400, '16.2 Comentario demasiado corto -> 400');

  const tooLong = await req('POST', `/projects/${projectId}/feedback`, {
    token: docente.token,
    body: { comment: 'x'.repeat(1200) },
  });
  check(tooLong.status === 400, '16.3 Comentario demasiado largo -> 400');

  const created = await req('POST', `/projects/${projectId}/feedback`, {
    token: docente.token,
    body: {
      comment:
        'Buen avance en la capa de adquisición de datos. Sugiero documentar el modelo entidad-relación y añadir pruebas al módulo de alertas.',
    },
  });
  check(created.status === 201, '16.4 El docente registra retroalimentacion', msgOf(created));
  const feedbackId = created.data?.id;
  check(created.data?.comment?.includes('entidad-relación'), '16.5 El comentario se guarda tal como se escribio');

  const list = await req('GET', `/projects/${projectId}/feedback`, { token: docente.token });
  check(list.status === 200 && list.data.length === 1, '16.6 La retroalimentacion persiste');
  check(list.data[0]?.teacher === docente.name, '16.7 Queda asociada al docente que la escribio');

  section('Visibilidad para los estudiantes del proyecto');
  const ownerSees = await req('GET', `/projects/${projectId}/feedback`, { token: A.token });
  check(
    ownerSees.status === 200 && ownerSees.data.length === 1,
    '16.8 El estudiante responsable la ve',
    msgOf(ownerSees),
  );
  const memberSees = await req('GET', `/projects/${projectId}/feedback`, { token: B.token });
  check(memberSees.status === 200 && memberSees.data.length === 1, '16.9 El integrante aceptado tambien la ve');
  check(ownerSees.data[0]?.canEdit === false, '16.10 El estudiante no puede editarla');
  const strangerSees = await req('GET', `/projects/${projectId}/feedback`, { token: C.token });
  check(
    strangerSees.status === 403,
    '16.11 Un estudiante ajeno NO ve la retroalimentacion -> 403',
    `status ${strangerSees.status}`,
  );

  section('Casos negativos');
  const studentWrites = await req('POST', `/projects/${projectId}/feedback`, {
    token: A.token,
    body: { comment: 'Intento de comentario escrito por el propio estudiante.' },
  });
  check(
    studentWrites.status === 403,
    '16.12 El estudiante NO registra retroalimentacion docente -> 403',
    `status ${studentWrites.status}`,
  );

  const outOfScopeWrites = await req('POST', `/projects/${projectId}/feedback`, {
    token: docenteFuera.token,
    body: { comment: 'Intento de un docente fuera de su alcance academico.' },
  });
  check(
    outOfScopeWrites.status === 403,
    '16.13 Un docente fuera de alcance NO comenta -> 403',
    `status ${outOfScopeWrites.status}`,
  );

  const privateWrites = await req('POST', `/projects/${ctx.privateProjectId}/feedback`, {
    token: docente.token,
    body: { comment: 'Intento de comentario sobre un proyecto privado.' },
  });
  check(
    privateWrites.status === 403,
    '16.14 No se comenta un proyecto privado -> 403',
    `status ${privateWrites.status}`,
  );

  const directorWrites = await req('POST', `/projects/${projectId}/feedback`, {
    token: ctx.directorToken,
    body: { comment: 'Intento del director de carrera sobre el proyecto.' },
  });
  check(
    directorWrites.status === 403,
    '16.15 El director de carrera NO registra retroalimentacion -> 403',
    `status ${directorWrites.status}`,
  );

  section('Edicion de la propia retroalimentacion');
  const edited = await req('PATCH', `/projects/${projectId}/feedback/${feedbackId}`, {
    token: docente.token,
    body: {
      comment:
        'Buen avance en la capa de adquisición de datos. Documenten el modelo entidad-relación, añadan pruebas al módulo de alertas y comparen con soluciones existentes.',
    },
  });
  check(edited.status === 200, '16.16 El docente edita su propio comentario', msgOf(edited));
  check(!!edited.data?.editedAt, '16.17 Queda registrada la fecha de edicion');

  const otherEdits = await req('PATCH', `/projects/${projectId}/feedback/${feedbackId}`, {
    token: otroDocente.token,
    body: { comment: 'Intento de edicion por parte de otro docente distinto.' },
  });
  check(
    otherEdits.status === 403,
    '16.18 Otro docente NO edita retroalimentacion ajena -> 403',
    `status ${otherEdits.status}`,
  );

  section('Varios docentes sobre el mismo proyecto');
  const second = await req('POST', `/projects/${projectId}/feedback`, {
    token: otroDocente.token,
    body: { comment: 'Recomiendo incluir evidencia del despliegue y describir el rol de cada integrante.' },
  });
  check(second.status === 201, '16.19 Otro docente del mismo alcance tambien puede comentar');
  const finalList = await req('GET', `/projects/${projectId}/feedback`, { token: A.token });
  check(finalList.data.length === 2, '16.20 El proyecto acumula la retroalimentacion de ambos docentes');
  check(
    finalList.data.every((f) => f.canEdit === false),
    '16.21 El estudiante sigue sin poder editar ninguna',
  );
}

main().catch((e) => {
  console.error(`\n${C.bad}Error inesperado:${C.r}`, e);
  process.exit(1);
});
