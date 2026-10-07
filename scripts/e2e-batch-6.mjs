/**
 * Motor de Afinidad V3 (Especificación Maestra V2, §45 a §52, §81).
 *
 * Esta suite verificaba el motor V2 (intereses y habilidades autodeclaradas
 * sumaban puntos; escala sobre 60). La V2 de la especificación lo sustituye:
 * lo declarado ya no suma afinidad y la escala es directa sobre 100 con tres
 * familias (actividades 25, proyectos 50, certificados 25). Las cifras del
 * motor anterior se conservan como historia en las instantáneas con
 * `engine_version = 2`; aquí se verifica el motor vigente.
 *
 * Cubre: §45.1 (lo declarado no suma), §46 (fuentes), §47 (puntos,
 * multiplicadores y topes), §48 (proyecto atribuido por las tecnologías del
 * integrante), §49 (respaldo y diversidad), §50 (sin doble conteo), §51
 * (contribuciones explicables), §52 (recálculo) y §81 (versionado).
 *
 * Uso:
 *   API_URL=http://localhost:3010/api node scripts/e2e-batch-6.mjs
 */

import { loginAdmin, provisionAndActivate, req, aprobarActividad, crearProyectoActivo, crearProyectoBorrador, repoQueCorrobora } from './lib/fixtures.mjs';

const TS = Date.now();

const C = {
  r: '\x1b[0m', bold: '\x1b[1m', dim: '\x1b[90m',
  ok: '\x1b[32m', bad: '\x1b[31m', head: '\x1b[36m',
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
const msgOf = (r) =>
  Array.isArray(r?.data?.message) ? r.data.message.join(' | ') : (r?.data?.message ?? '');

const correoEst = (k) => `b6.${k}.${TS}@est.univalle.edu`;
const correoStaff = (k) => `b6.${k}.${TS}@univalle.edu`;

const resumen = async (token) => (await req('GET', '/affinity/me/summary', { token })).data;
const areaDe = (s, areaId) => (s?.areas ?? []).find((a) => a.academicAreaId === areaId) ?? null;
const puntaje = (s, areaId) => areaDe(s, areaId)?.score ?? 0;
const crudo = (s, areaId) => areaDe(s, areaId)?.rawPoints ?? 0;
const respaldo = (s, areaId) => areaDe(s, areaId)?.supportScore ?? 0;
const desglose = async (token, areaId) =>
  (await req('GET', `/affinity/me/areas/${areaId}/breakdown`, { token })).data;

const confirmar = async (ctx, cuenta, actividad) => {
  await req('POST', `/activities/${actividad.id}/register`, { token: cuenta.token });
  return req('PATCH', `/activities/${actividad.id}/confirm-participation`, {
    token: ctx.docente.token,
    body: { studentProfileId: cuenta.profileId, status: 'confirmed' },
  });
};

// ===========================================================================
//  §45.1 · Lo declarado no suma
// ===========================================================================
async function declarado(ctx) {
  objective('§45.1 · Intereses, áreas de mejora y tecnologías de interés no suman afinidad');
  const { est, areaA, areaB, areaC } = ctx;

  await req('PUT', '/profiles/me/interests', {
    token: est.token,
    body: { items: [{ academicAreaId: areaA.id, priority: 1 }, { academicAreaId: areaB.id, priority: 5 }] },
  });
  await req('PATCH', '/profiles/me', { token: est.token, body: { improvementAreaIds: [areaC.id] } });
  await req('PUT', '/profiles/me/skill-interests', {
    token: est.token, body: { items: [{ skillId: ctx.skillA.id, kind: 'interest' }] },
  });

  const s = await resumen(est.token);
  check(areaDe(s, areaA.id) === null && areaDe(s, areaB.id) === null,
    'B6.1 Un interés declarado no produce afinidad, sea cual sea su prioridad (§45.1)', JSON.stringify(s?.areas));
  check(areaDe(s, areaC.id) === null, 'B6.2 Un área de mejora tampoco (§45.1)');
  check(s?.status === 'insufficient_data', 'B6.3 Sin trayectoria respaldada, el estado lo dice', String(s?.status));
  check(s?.maxRawPoints === 100, 'B6.4 La escala es directa sobre 100 (§47)', `max ${s?.maxRawPoints}`);
  check(s?.engineVersion === 4, 'B6.5 El motor vigente es la versión 4 (V3.1 §35)', `versión ${s?.engineVersion}`);
}

// ===========================================================================
//  §47.1 · Actividades
// ===========================================================================
async function actividades(ctx) {
  objective('§47.1 · Solo la participación confirmada cuenta: 10, con rendimientos y tope de 25');
  const { est, areaAct } = ctx;

  await req('POST', `/activities/${ctx.actividades[0].id}/register`, { token: est.token });
  let s = await resumen(est.token);
  check(crudo(s, areaAct.id) === 0, 'B6.6 Inscribirse no suma afinidad (§29)', `crudo ${crudo(s, areaAct.id)}`);

  const confirmada = await req('PATCH', `/activities/${ctx.actividades[0].id}/confirm-participation`, {
    token: ctx.docente.token,
    body: { studentProfileId: est.profileId, status: 'confirmed' },
  });
  check(confirmada.status === 200, 'B6.7 El docente responsable confirma', msgOf(confirmada));
  s = await resumen(est.token);
  check(crudo(s, areaAct.id) === 10 && puntaje(s, areaAct.id) === 10,
    'B6.8 Una participación confirmada vale 10 (§47.1)', `crudo ${crudo(s, areaAct.id)}`);
  check(respaldo(s, areaAct.id) === 12, 'B6.9 Y aporta 8 de respaldo más 4 de la constancia que V3 §14.1 emite sola (§49)', `respaldo ${respaldo(s, areaAct.id)}`);

  for (const a of ctx.actividades.slice(1, 3)) await confirmar(ctx, est, a);
  s = await resumen(est.token);
  check(crudo(s, areaAct.id) === 22, 'B6.10 La 2.ª vale el 70 % y la 3.ª el 50 %: 10 + 7 + 5 = 22 (§47.1)', `crudo ${crudo(s, areaAct.id)}`);
  check(respaldo(s, areaAct.id) === 20, 'B6.11 El respaldo sigue su escala con las constancias automáticas y topa en 20 (§49)', `respaldo ${respaldo(s, areaAct.id)}`);

  const d = await desglose(est.token, areaAct.id);
  const conMulti = (d.contributing ?? []).filter((c) => c.multiplier < 1);
  check(conMulti.length === 2, 'B6.12 El desglose registra el multiplicador de cada señal (§51)', `con multiplicador ${conMulti.length}`);
  check(conMulti.every((c) => Math.abs(c.rawPoints * c.multiplier - c.points) < 0.011),
    'B6.13 Y cuadra: base x multiplicador = puntos finales', JSON.stringify(conMulti.map((c) => [c.rawPoints, c.multiplier, c.points])));

  await confirmar(ctx, est, ctx.actividades[3]);
  s = await resumen(est.token);
  check(crudo(s, areaAct.id) === 25, 'B6.14 La 4.ª vale el 30 %: 22 + 3 = 25 (§47.1)', `crudo ${crudo(s, areaAct.id)}`);
  await confirmar(ctx, est, ctx.actividades[4]);
  s = await resumen(est.token);
  check(crudo(s, areaAct.id) === 25, 'B6.15 Y ahí se detiene: el tope de actividades es 25 (§47.1)', `crudo ${crudo(s, areaAct.id)}`);
  const d5 = await desglose(est.token, areaAct.id);
  const suma = (d5.contributing ?? []).reduce((acc, c) => acc + Number(c.points), 0);
  check(Math.abs(suma - d5.rawPoints) < 0.011, 'B6.16 El desglose suma exactamente el puntaje del área (§51)', `suma ${suma} vs ${d5.rawPoints}`);
}

// ===========================================================================
//  §50 · Una realidad, un evento de afinidad
// ===========================================================================
async function sinDobleConteo(ctx) {
  objective('§50 · La constancia respalda; no vuelve a contar');
  const { est, areaAct } = ctx;
  const antes = await resumen(est.token);

  const emitida = await req('POST', '/constancies/internal', {
    token: ctx.director.token,
    body: { profileId: est.profileId, activityId: ctx.actividades[0].id, description: `Constancia de participacion ${TS}` },
  });
  check(emitida.status === 201, 'B6.17 La dirección emite una constancia', msgOf(emitida));

  const despues = await resumen(est.token);
  check(crudo(despues, areaAct.id) === crudo(antes, areaAct.id),
    'B6.18 La afinidad NO cambia: la participación ya se contó (§46, §50)', `antes ${crudo(antes, areaAct.id)} / después ${crudo(despues, areaAct.id)}`);
  check(respaldo(despues, areaAct.id) === 20,
    'B6.19 El respaldo sube y se detiene en el tope de 20 de actividades (§49)', `respaldo ${respaldo(despues, areaAct.id)}`);

  const d = await desglose(est.token, areaAct.id);
  const constancia = (d.contributions ?? []).find((c) => c.weightCode === 'constancy');
  check(!!constancia && constancia.points === 0, 'B6.20 La constancia figura en el desglose con cero de afinidad', JSON.stringify(constancia));
}

// ===========================================================================
//  §47.2 y §48 · Proyectos
// ===========================================================================
async function proyectos(ctx) {
  objective('§47.2 y §48 · El proyecto puntúa por respaldo, en las áreas de las tecnologías del integrante');
  const { est, areaProy, areaOtra } = ctx;

  const creado = await crearProyectoBorrador(est.token, {
      title: `Plataforma de afinidad ${TS}`,
      description: 'Proyecto para probar la puntuación V4.',
      areaId: areaProy.id,
      technologies: ['React', 'NestJS'],
      visibility: 'teachers',
  });
  check(creado.status === 201, 'B6.21 El estudiante registra un proyecto', msgOf(creado));
  ctx.projectId = creado.data?.id;

  let s = await resumen(est.token);
  check(crudo(s, areaProy.id) === 0 && respaldo(s, areaProy.id) === 0,
    'B6.22 Un proyecto vacío (DECLARED) no suma afinidad ni respaldo (§36, §47.2)', `crudo ${crudo(s, areaProy.id)} / respaldo ${respaldo(s, areaProy.id)}`);

  await req('POST', `/projects/${ctx.projectId}/evidences`, {
    token: est.token,
    body: { evidenceType: 'link', description: `Capturas del sistema ${TS}`, externalUrl: 'https://ejemplo.univalle.edu/afinia/capturas' },
  });
  const checks = await req('GET', `/projects/${ctx.projectId}/checks`, { token: est.token });
  check(checks.data?.backingTier === 'supported', 'B6.23 Con una evidencia sube a SUPPORTED (§36)', String(checks.data?.backingTier));

  s = await resumen(est.token);
  check(crudo(s, areaProy.id) === 0,
    'B6.24 Sin tecnologías confirmadas por el integrante, el proyecto no suma afinidad (§48)', `crudo ${crudo(s, areaProy.id)}`);
  check(respaldo(s, areaProy.id) === 0,
    'B6.25 V4 §35.1 Un borrador no es trayectoria: tampoco suma respaldo', `respaldo ${respaldo(s, areaProy.id)}`);

  // V3 §22: se activa con su tecnología del catálogo y un repositorio que la
  // corrobora (lenguaje informado por GitHub, §24.2).
  const activo = await req('PATCH', `/projects/${ctx.projectId}`, {
    token: est.token,
    body: { skillIds: [ctx.skillProy.id], repositoryUrl: repoQueCorrobora(ctx.skillProy.name), status: 'active' },
  });
  check(activo.status === 200 && activo.data?.status === 'active' && activo.data?.backingTier === 'corroborated',
    'B6.25b §28 Activo, con la tecnología corroborada y una evidencia de contexto: CORROBORATED', JSON.stringify({ s: activo.status, t: activo.data?.backingTier, c: activo.data?.code }));
  s = await resumen(est.token);
  check(crudo(s, areaProy.id) === 0 && respaldo(s, areaProy.id) === 15,
    'B6.25c V4 §35.3 Sin tecnologías confirmadas por el integrante no suma afinidad; su respaldo sí cuenta (15)', `crudo ${crudo(s, areaProy.id)} / respaldo ${respaldo(s, areaProy.id)}`);

  const mia = await req('PUT', `/projects/${ctx.projectId}/my-contribution`, {
    token: est.token,
    body: { role: 'Responsable', contribution: 'Diseño y backend', skillIds: [ctx.skillProy.id] },
  });
  check(mia.status === 200, 'B6.26 El responsable confirma las tecnologías que usó (§34)', msgOf(mia));
  s = await resumen(est.token);
  check(crudo(s, areaProy.id) === 18, 'B6.27 V4 §35.3 Ahora el proyecto CORROBORATED suma 18 en esa área', `crudo ${crudo(s, areaProy.id)}`);

  for (let i = 0; i < 3; i++) {
    await req('POST', `/projects/${ctx.projectId}/evidences`, {
      token: est.token,
      body: { evidenceType: 'link', description: `Captura adicional ${i} ${TS}`, externalUrl: `https://ejemplo.univalle.edu/afinia/extra-${i}` },
    });
  }
  s = await resumen(est.token);
  check(crudo(s, areaProy.id) === 18, 'B6.28 Tres evidencias más no multiplican el proyecto (§38)', `crudo ${crudo(s, areaProy.id)}`);
  const d = await desglose(est.token, areaProy.id);
  const evidencias = (d.notContributing ?? []).filter((c) => c.weightCode === 'evidence');
  check(evidencias.length === 4, 'B6.29 Las cuatro evidencias figuran en «no contribuye», con su motivo', `listadas ${evidencias.length}`);

  section('§48 · Cada integrante, en las áreas de SUS tecnologías');
  const inv = await req('POST', `/projects/${ctx.projectId}/invitations`, {
    token: est.token, body: { invitedProfileId: ctx.companero.profileId, proposedRole: 'Frontend' },
  });
  await req('PATCH', `/projects/invitations/${inv.data?.id}`, { token: ctx.companero.token, body: { decision: 'accept' } });
  let sc = await resumen(ctx.companero.token);
  check(crudo(sc, areaProy.id) === 0 && crudo(sc, areaOtra.id) === 0,
    'B6.30 Aceptar no atribuye experiencia por sí solo: falta confirmar su contribución (§33)', JSON.stringify(sc?.areas));
  await req('PUT', `/projects/${ctx.projectId}/my-contribution`, {
    token: ctx.companero.token, body: { role: 'Frontend', contribution: 'Interfaz', skillIds: [ctx.skillOtra.id] },
  });
  sc = await resumen(ctx.companero.token);
  check(crudo(sc, areaOtra.id) === 0 && crudo(sc, areaProy.id) === 0,
    'B6.31 V4 §35.3 Su tecnología no está corroborada en el proyecto: no suma, y no se le reparten las del proyecto', JSON.stringify(sc?.areas?.map((a) => [a.area, a.rawPoints])));
  await req('PUT', `/projects/${ctx.projectId}/my-contribution`, {
    token: ctx.companero.token, body: { role: 'Frontend', contribution: 'Interfaz y pruebas', skillIds: [ctx.skillOtra.id, ctx.skillProy.id] },
  });
  sc = await resumen(ctx.companero.token);
  check(crudo(sc, areaProy.id) === 18 && crudo(sc, areaOtra.id) === 0,
    'B6.31b V4 §35.3 Suma en el área de la tecnología que confirmó y está corroborada', JSON.stringify(sc?.areas?.map((a) => [a.area, a.rawPoints])));
  s = await resumen(est.token);
  check(crudo(s, areaOtra.id) === 0, 'B6.32 Y al responsable no se le atribuye la tecnología del compañero (§34)', `crudo ${crudo(s, areaOtra.id)}`);
}

// ===========================================================================
//  §47.3 y §49 · Certificados y diversidad
// ===========================================================================
async function certificadosYDiversidad(ctx) {
  objective('§47.3 y §49 · El certificado declarado no suma; respaldo alto exige dos familias');
  const { est, areaAct } = ctx;

  const solo = await resumen(est.token);
  const actArea = areaDe(solo, areaAct.id);
  check(JSON.stringify(actArea?.supportFamilies) === JSON.stringify(['activity']),
    'B6.33 Participaciones y su constancia acreditan UNA familia, no dos (§49, §50)', JSON.stringify(actArea?.supportFamilies));
  check(actArea?.supportLevel !== 'high', 'B6.34 Con una sola familia el respaldo no es alto', `${actArea?.supportScore} -> ${actArea?.supportLevel}`);

  const cert = await req('POST', '/certificates/external', {
    token: est.token,
    body: { certificateName: `Certificacion en pruebas ${TS}`, issuer: 'Plataforma externa de formacion', issueDate: '2026-04-15', academicAreaId: areaAct.id },
  });
  check(cert.status === 201, 'B6.35 El estudiante adjunta un certificado', msgOf(cert));
  const conCert = await resumen(est.token);
  check(crudo(conCert, areaAct.id) === crudo(solo, areaAct.id) && respaldo(conCert, areaAct.id) === respaldo(solo, areaAct.id),
    'B6.36 Un certificado DECLARED no suma afinidad ni respaldo (§47.3, §49)', `antes ${crudo(solo, areaAct.id)} / después ${crudo(conCert, areaAct.id)}`);

  const area = areaDe(conCert, areaAct.id);
  check(area.supportScore >= 0 && area.supportScore <= 100 && ['low', 'medium', 'high'].includes(area.supportLevel),
    'B6.37 SUPPORT_SCORE 0–100 y SUPPORT_LEVEL LOW/MEDIUM/HIGH (§49)', `${area.supportScore} -> ${area.supportLevel}`);
  check(area.supportScore <= 24 ? area.supportLevel === 'low' : area.supportScore <= 59 ? area.supportLevel === 'medium' : true,
    'B6.38 Cortes de §49: 0–24 bajo, 25–59 medio', `${area.supportScore} -> ${area.supportLevel}`);
}

// ===========================================================================
//  §45, §51 y §81 · Determinismo, explicación y versionado
// ===========================================================================
async function determinismoYExplicacion(ctx) {
  objective('§45 y §51 · El mismo dato da el mismo número, y se puede explicar');
  const { est, areaAct } = ctx;

  const antes = await resumen(est.token);
  await req('POST', '/affinity/recalculate/me', { token: est.token });
  const despues = await resumen(est.token);
  check(JSON.stringify((antes.areas ?? []).map((a) => [a.academicAreaId, a.score, a.supportScore]))
    === JSON.stringify((despues.areas ?? []).map((a) => [a.academicAreaId, a.score, a.supportScore])),
  'B6.39 Recalcular sin cambiar nada da exactamente el mismo resultado (§45)');

  const d = await desglose(est.token, areaAct.id);
  check((d.contributions ?? []).every((c) => !!c.signalFamily && !!c.reason && c.rawPoints !== undefined
    && c.multiplier !== undefined && c.supportPoints !== undefined),
  'B6.40 Cada contribución lleva familia, motivo, base, multiplicador y respaldo (§51)');
  check(d.engineVersion === 4, 'B6.41 Y la versión del motor que la produjo (§51)', `versión ${d.engineVersion}`);

  const dA = await desglose(est.token, ctx.areaA.id);
  check((dA.notContributing ?? []).some((c) => c.weightCode?.startsWith('interest') && c.points === 0 && /no suma afinidad/.test(c.reason ?? '')),
    'B6.42 El interés declarado figura como «no contribuye» con su motivo (§45.1)', JSON.stringify(dA.notContributing?.slice(0, 2)));

  const reglas = (await req('GET', '/affinity/weights', { token: est.token })).data;
  check(reglas?.engineVersion === 4 && reglas?.maxRawPoints === 100,
    'B6.43 El motor publica versión 4 y máximo 100', JSON.stringify([reglas?.engineVersion, reglas?.maxRawPoints]));
  check(reglas?.caps?.ACTIVITY === 25 && reglas?.caps?.PROJECT === 50 && reglas?.caps?.CERTIFICATE === 25 && reglas?.caps?.PREFERENCE === 0,
    'B6.44 Topes por familia 25 / 50 / 25 y 0 para lo declarado (§47)', JSON.stringify(reglas?.caps));
  check(Array.isArray(reglas?.diminishing?.ACTIVITY) && reglas.diminishing.ACTIVITY.join() === '1,0.7,0.5,0.3'
    && reglas.diminishing.PROJECT.join() === '1,0.75,0.5,0.25',
  'B6.45 Multiplicadores de §47', JSON.stringify(reglas?.diminishing));
  check((reglas?.weights ?? []).some((w) => w.code === 'activity_confirmed' && w.points === 10)
    && (reglas?.weights ?? []).some((w) => w.code === 'project_reviewed' && w.points === 22)
    && (reglas?.weights ?? []).some((w) => w.code === 'certificate_corroborated' && w.points === 15)
    && (reglas?.weights ?? []).filter((w) => w.code.startsWith('interest_priority')).every((w) => w.points === 0),
  'B6.46 Los pesos almacenados son los de §47 y lo declarado vale 0');

  section('§81 · La historia V2 no se sobrescribe');
  const ana = await req('POST', '/auth/login', { body: { email: 'ana.quispe@est.univalle.edu', password: 'Univalle2026*' } });
  if (ana.status === 200) {
    const hist = (await req('GET', '/affinity/me/history?limit=30', { token: ana.data.accessToken })).data ?? [];
    const versiones = new Set(hist.map((h) => h.engineVersion));
    check(versiones.has(2) && versiones.has(3),
      'B6.47 El historial conserva instantáneas V2 junto a las V3, cada una con su versión', JSON.stringify([...versiones]));
  } else {
    check(true, 'B6.47 (sin datos de ejemplo: se omite la comprobación de historia V2)');
  }
}

// ===========================================================================
//  §52 · Recálculo masivo
// ===========================================================================
async function recalculoMasivo(ctx) {
  objective('§52 · Cuando cambia la regla, no basta con esperar al estudiante');
  const ajeno = await req('POST', '/affinity/recalculate-all', { token: ctx.est.token });
  check(ajeno.status === 403, 'B6.48 Un estudiante no puede recalcular el padrón -> 403', `status ${ajeno.status}`);
  const docente = await req('POST', '/affinity/recalculate-all', { token: ctx.docente.token });
  check(docente.status === 403, 'B6.49 Un docente tampoco -> 403', `status ${docente.status}`);
  const admin = await req('POST', '/affinity/recalculate-all', { token: ctx.admin });
  check(admin.status === 200 && typeof admin.data?.recalculados === 'number',
    'B6.50 El administrador sí, y el motor informa cuántos puso al día', JSON.stringify(admin.data));
}

// ===========================================================================
//  Preparación
// ===========================================================================
async function preparar() {
  console.log(`${C.bold}Afinidad V3 contra ${process.env.API_URL ?? 'http://localhost:3010/api'}${C.r}`);
  const admin = await loginAdmin();

  const areas = ((await req('GET', '/academic-areas', { token: admin })).data ?? []).filter((a) => a.isActive !== false);
  const skills = ((await req('GET', '/skills', { token: admin })).data ?? []).filter((s) => s.isActive !== false);
  const categorias = (await req('GET', '/activity-categories', { token: admin })).data ?? [];
  const categoria = categorias.find((c) => c.appliesTo !== 'extracurricular') ?? categorias[0];
  const conSkill = areas.filter((a) => skills.some((s) => s.academicAreaId === a.id));
  if (areas.length < 5 || conSkill.length < 2) {
    throw new Error('Hacen falta áreas con habilidades en el catálogo. Ejecute npm run seed:populate.');
  }

  const staff = async (key, nombre, apellido, role, semestres) => {
    const cuenta = await provisionAndActivate(admin, { firstName: nombre, lastName: apellido, email: correoStaff(key), role });
    if (semestres) await req('PUT', `/users/${cuenta.userId}/semesters`, { token: admin, body: { semesters: semestres } });
    return cuenta;
  };
  const estudiante = async (key, nombre, apellido, semestre) => {
    const cuenta = await provisionAndActivate(admin, { firstName: nombre, lastName: apellido, email: correoEst(key), role: 'STUDENT', semester: semestre });
    const perfil = await req('POST', '/profiles/me', { token: cuenta.token, body: {} });
    return { ...cuenta, profileId: perfil.data?.id };
  };

  const docente = await staff('doc', 'Irene', 'Villarroel', 'TEACHER', [5]);
  const director = await staff('dir', 'Gonzalo', 'Terceros', 'CAREER_DIRECTOR', null);
  const est = await estudiante('est', 'Valeria', 'Cardenas', 5);
  const companero = await estudiante('comp', 'Mateo', 'Ibanez', 5);

  const areaProy = conSkill[0];
  const areaOtra = conSkill[1];
  const resto = areas.filter((a) => a.id !== areaProy.id && a.id !== areaOtra.id);
  const [areaA, areaB, areaC, areaAct] = resto;
  const skillA = skills.find((s) => s.academicAreaId === areaA.id) ?? skills[0];
  const skillProy = skills.find((s) => s.academicAreaId === areaProy.id);
  const skillOtra = skills.find((s) => s.academicAreaId === areaOtra.id);

  // Cinco actividades en la misma área: rendimientos decrecientes y tope.
  const actividades = [];
  for (let i = 0; i < 5; i++) {
    const creada = await req('POST', '/activities', {
      token: docente.token,
      body: {
        title: `Taller de afinidad ${i} ${TS}`,
        description: 'Actividad para medir la puntuacion por participacion.',
        type: 'academica',
        categoryId: categoria.id,
        areaId: areaAct.id,
        semesterScope: [5],
        internalConstancyEnabled: true,
      },
    });
    if (creada.status !== 201) throw new Error(`No se pudo crear la actividad ${i}: ${JSON.stringify(creada.data)}`);
    // V2 §27: la actividad del docente la aprueba Dirección antes de abrirse.
    await aprobarActividad(docente.token, director.token, creada.data.id);
    actividades.push(creada.data);
  }

  return {
    admin, docente, director, est, companero,
    areaA, areaB, areaC, areaAct, areaProy, areaOtra,
    skillA, skillProy, skillOtra, actividades,
  };
}

async function main() {
  try {
    const ctx = await preparar();
    await declarado(ctx);
    await actividades(ctx);
    await sinDobleConteo(ctx);
    await proyectos(ctx);
    await certificadosYDiversidad(ctx);
    await determinismoYExplicacion(ctx);
    await recalculoMasivo(ctx);
  } catch (error) {
    console.error(`\n${C.bad}Error durante la ejecución:${C.r} ${error.message}`);
    process.exitCode = 1;
    return;
  }

  console.log(`\n${'-'.repeat(78)}`);
  if (failures.length === 0) {
    console.log(`${C.ok}${C.bold}  ${passed} verificaciones OK · 0 fallos${C.r}`);
  } else {
    console.log(`${C.bad}${C.bold}  ${passed} verificaciones OK · ${failures.length} fallos${C.r}`);
    failures.forEach((f) => console.log(`  ${C.bad}·${C.r} ${f}`));
    process.exitCode = 1;
  }
}

main();
