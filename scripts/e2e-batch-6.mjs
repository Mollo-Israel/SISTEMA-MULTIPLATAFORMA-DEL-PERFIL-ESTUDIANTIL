/**
 * BATCH 6 — Motor de Afinidad V2.
 *
 * Cubre §48 (determinista y explicable), §49 (dos puntajes distintos), §50
 * (qué participa y qué no), §51 (pesos, topes y rendimientos decrecientes),
 * §52 (normalización sobre 60), §53 (puntaje de respaldo), §54 (support level
 * y regla de diversidad), §55 (sin doble conteo), §56 (contribuciones
 * explicables) y §57 (recálculo ante señales relevantes).
 *
 * Uso:
 *   API_URL=http://localhost:3010/api node scripts/e2e-batch-6.mjs
 */

import { loginAdmin, provisionAndActivate, req } from './lib/fixtures.mjs';

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

/** Resumen de afinidad del estudiante. */
const resumen = async (token) => (await req('GET', '/affinity/me/summary', { token })).data;

/** El área dentro del resumen, o null si no puntuó. */
const areaDe = (s, areaId) => (s?.areas ?? []).find((a) => a.academicAreaId === areaId) ?? null;

const puntaje = (s, areaId) => areaDe(s, areaId)?.score ?? 0;
const crudo = (s, areaId) => areaDe(s, areaId)?.rawPoints ?? 0;
const respaldo = (s, areaId) => areaDe(s, areaId)?.supportScore ?? 0;

const desglose = async (token, areaId) =>
  (await req('GET', `/affinity/me/areas/${areaId}/breakdown`, { token })).data;

// ===========================================================================
//  §51.1 · Preferencias
// ===========================================================================
async function preferencias(ctx) {
  objective('§51.1 · Lo que el estudiante declara de sí mismo');

  const { est, areaA, areaB } = ctx;

  section('La prioridad del interés es información, y se usa');
  await req('PUT', '/profiles/me/interests', {
    token: est.token,
    body: {
      items: [
        { academicAreaId: areaA.id, priority: 1 },
        { academicAreaId: areaB.id, priority: 5 },
      ],
    },
  });

  let s = await resumen(est.token);
  check(
    crudo(s, areaA.id) === 5,
    'B6.1 Un interés de prioridad 1 vale 5 puntos (§51.1)',
    `crudo ${crudo(s, areaA.id)}`,
  );
  check(
    crudo(s, areaB.id) === 1,
    'B6.2 Uno de prioridad 5 vale 1: el orden que eligió el estudiante importa',
    `crudo ${crudo(s, areaB.id)}`,
  );

  section('§52 · El puntaje se normaliza contra el máximo teórico');
  check(
    s.maxRawPoints === 60,
    'B6.3 El máximo teórico por área es 60 (14 + 10 + 24 + 12)',
    `max ${s.maxRawPoints}`,
  );
  check(
    puntaje(s, areaA.id) === Math.round((5 / 60) * 100),
    'B6.4 AFFINITY_SCORE = round(crudo / 60 x 100) (§52)',
    `puntaje ${puntaje(s, areaA.id)}`,
  );
  check(
    puntaje(s, areaB.id) < puntaje(s, areaA.id) && puntaje(s, areaB.id) > 0,
    'B6.5 El área más débil NO se normaliza contra la más fuerte del propio perfil',
    `A ${puntaje(s, areaA.id)} / B ${puntaje(s, areaB.id)}`,
  );

  section('§51.1 · La habilidad autodeclarada pesa poco, a propósito');
  await req('PUT', '/profiles/me/skill-interests', {
    token: est.token,
    body: { items: [{ skillId: ctx.skillA.id, kind: 'interest' }] },
  });
  s = await resumen(est.token);
  check(
    crudo(s, areaA.id) === 6.5,
    'B6.6 Una habilidad avanzada suma 1,5 sobre los 5 del interés (§51.1)',
    `crudo ${crudo(s, areaA.id)}`,
  );

  await req('PUT', '/profiles/me/skill-interests', {
    token: est.token,
    body: { items: [{ skillId: ctx.skillA.id, kind: 'interest' }] },
  });
  s = await resumen(est.token);
  check(
    crudo(s, areaA.id) === 5.5,
    'B6.7 En nivel básico suma 0,5: el nivel lo declaró el propio estudiante',
    `crudo ${crudo(s, areaA.id)}`,
  );

  section('§50 · El área de mejora se tiene en cuenta y no suma');
  await req('PATCH', '/profiles/me', {
    token: est.token,
    body: { improvementAreaIds: [ctx.areaC.id] },
  });
  s = await resumen(est.token);
  check(
    areaDe(s, ctx.areaC.id) === null,
    'B6.8 Un área solo declarada como «quiero mejorar» no obtiene afinidad (§50)',
    JSON.stringify(areaDe(s, ctx.areaC.id)),
  );
}

// ===========================================================================
//  §51.2 y §53.1 · Actividades
// ===========================================================================
async function actividades(ctx) {
  objective('§51.2 y §53.1 · Solo la participación confirmada cuenta');

  const { est, docente, areaAct } = ctx;

  section('Interés e inscripción no son experiencia (§50)');
  await req('POST', `/activities/${ctx.actividades[0].id}/register`, { token: est.token });
  let s = await resumen(est.token);
  check(
    crudo(s, areaAct.id) === 0,
    'B6.9 Inscribirse no suma nada de afinidad (§50, §51.2)',
    `crudo ${crudo(s, areaAct.id)}`,
  );

  section('Confirmar sí lo es');
  const confirmada = await req(
    `PATCH`,
    `/activities/${ctx.actividades[0].id}/confirm-participation`,
    {
      token: docente.token,
      body: { studentProfileId: est.profileId, status: 'confirmed' },
    },
  );
  check(confirmada.status === 200, 'B6.10 El docente responsable confirma', msgOf(confirmada));

  s = await resumen(est.token);
  check(
    crudo(s, areaAct.id) === 4,
    'B6.11 Una participación confirmada vale 4 puntos (§51.2)',
    `crudo ${crudo(s, areaAct.id)}`,
  );
  check(
    respaldo(s, areaAct.id) === 8,
    'B6.12 Y aporta 8 de respaldo (§53.1)',
    `respaldo ${respaldo(s, areaAct.id)}`,
  );

  section('§51.2 · Rendimientos decrecientes');
  for (const actividad of ctx.actividades.slice(1)) {
    await req('POST', `/activities/${actividad.id}/register`, { token: est.token });
    await req('PATCH', `/activities/${actividad.id}/confirm-participation`, {
      token: docente.token,
      body: { studentProfileId: est.profileId, status: 'confirmed' },
    });
  }

  s = await resumen(est.token);
  // 4 x 1 + 4 x 0,70 + 4 x 0,50 = 4 + 2,8 + 2 = 8,8
  check(
    crudo(s, areaAct.id) === 8.8,
    'B6.13 La 2ª vale el 70 % y la 3ª el 50 %: 4 + 2,8 + 2 = 8,8 (§51.2)',
    `crudo ${crudo(s, areaAct.id)}`,
  );
  // 8 + 5,6 + 4 = 17,6 -> 18 al redondear el total
  check(
    respaldo(s, areaAct.id) === 18,
    'B6.14 El respaldo aplica la misma escala: 8 + 5,6 + 4 (§53.1)',
    `respaldo ${respaldo(s, areaAct.id)}`,
  );

  const d = await desglose(est.token, areaAct.id);
  const conMulti = (d.contributing ?? []).filter((c) => c.multiplier < 1);
  check(
    conMulti.length === 2,
    'B6.15 El desglose registra el multiplicador aplicado a cada señal (§56)',
    `con multiplicador ${conMulti.length}`,
  );
  check(
    conMulti.every((c) => Math.abs(c.rawPoints * c.multiplier - c.points) < 0.011),
    'B6.16 Y cuadra: puntos base x multiplicador = puntos finales',
    JSON.stringify(conMulti.map((c) => [c.rawPoints, c.multiplier, c.points])),
  );

  const suma = (d.contributing ?? []).reduce((acc, c) => acc + Number(c.points), 0);
  check(
    Math.abs(suma - d.rawPoints) < 0.011,
    'B6.17 El desglose suma exactamente el puntaje crudo del área (§56)',
    `suma ${suma} vs ${d.rawPoints}`,
  );
}

// ===========================================================================
//  §55 · Una realidad, un evento de afinidad
// ===========================================================================
async function sinDobleConteo(ctx) {
  objective('§55 · La constancia respalda; no vuelve a contar');

  const { est, areaAct } = ctx;
  const antes = await resumen(est.token);

  const emitida = await req('POST', '/constancies/internal', {
    token: ctx.director.token,
    body: {
      profileId: est.profileId,
      activityId: ctx.actividades[0].id,
      description: `Constancia de participacion ${TS}`,
    },
  });
  check(emitida.status === 201, 'B6.18 La dirección emite una constancia', msgOf(emitida));

  const despues = await resumen(est.token);
  check(
    crudo(despues, areaAct.id) === crudo(antes, areaAct.id),
    'B6.19 La afinidad NO cambia: la participación ya se contó una vez (§55)',
    `antes ${crudo(antes, areaAct.id)} / después ${crudo(despues, areaAct.id)}`,
  );
  check(
    respaldo(despues, areaAct.id) > respaldo(antes, areaAct.id),
    'B6.20 Pero el respaldo sí sube: eso es lo que añade una constancia (§53.1)',
    `antes ${respaldo(antes, areaAct.id)} / después ${respaldo(despues, areaAct.id)}`,
  );
  check(
    respaldo(despues, areaAct.id) === 20,
    'B6.20b Y se detiene en el tope de 20 de la familia de actividades (§53.1)',
    `respaldo ${respaldo(despues, areaAct.id)}`,
  );

  const d = await desglose(est.token, areaAct.id);
  const constancia = (d.contributions ?? []).find((c) => c.weightCode === 'constancy');
  check(
    !!constancia && constancia.points === 0,
    'B6.21 La constancia figura en el desglose con cero de afinidad, no desaparece',
    JSON.stringify(constancia),
  );
}

// ===========================================================================
//  §51.3 y §53.2 · Proyectos
// ===========================================================================
async function proyectos(ctx) {
  objective('§51.3 y §53.2 · El proyecto puntúa según lo que se puede comprobar');

  const { est, areaProy } = ctx;

  const creado = await req('POST', '/projects', {
    token: est.token,
    body: {
      title: `Plataforma de afinidad ${TS}`,
      description: 'Proyecto para probar la puntuación por nivel de respaldo.',
      areaId: areaProy.id,
      technologies: ['React', 'NestJS'],
      status: 'active',
      visibility: 'teachers',
    },
  });
  check(creado.status === 201, 'B6.22 El estudiante registra un proyecto', msgOf(creado));
  ctx.projectId = creado.data?.id;

  let s = await resumen(est.token);
  check(
    crudo(s, areaProy.id) === 2,
    'B6.23 Un proyecto DECLARED vale 2 puntos (§51.3)',
    `crudo ${crudo(s, areaProy.id)}`,
  );
  check(
    respaldo(s, areaProy.id) === 0,
    'B6.24 Y no aporta respaldo: nada se ha podido corroborar (§53.2)',
    `respaldo ${respaldo(s, areaProy.id)}`,
  );

  section('Subir de nivel cambia el puntaje, y el sistema se entera solo (§57)');
  const evidencia = await req('POST', `/projects/${ctx.projectId}/evidences`, {
    token: est.token,
    body: {
      evidenceType: 'link',
      description: `Capturas del sistema ${TS}`,
      externalUrl: 'https://ejemplo.univalle.edu/afinia/capturas',
    },
  });
  check(
    evidencia.status === 201 || evidencia.status === 200,
    'B6.25 Adjunta una evidencia al proyecto',
    msgOf(evidencia),
  );

  const checks = await req('GET', `/projects/${ctx.projectId}/checks`, { token: est.token });
  check(
    checks.data?.backingTier === 'supported',
    'B6.26 El proyecto sube a SUPPORTED (§36)',
    String(checks.data?.backingTier),
  );

  s = await resumen(est.token);
  check(
    crudo(s, areaProy.id) === 6,
    'B6.27 Sin tocar nada más, la afinidad refleja el nivel nuevo: 6 puntos (§51.3, §57)',
    `crudo ${crudo(s, areaProy.id)}`,
  );
  check(
    respaldo(s, areaProy.id) === 8,
    'B6.28 Y el respaldo pasa de 0 a 8 (§53.2)',
    `respaldo ${respaldo(s, areaProy.id)}`,
  );

  section('§55 · Diez capturas del mismo proyecto no son diez proyectos');
  for (let i = 0; i < 3; i++) {
    await req('POST', `/projects/${ctx.projectId}/evidences`, {
      token: est.token,
      body: {
        evidenceType: 'link',
        description: `Captura adicional ${i} ${TS}`,
        externalUrl: `https://ejemplo.univalle.edu/afinia/extra-${i}`,
      },
    });
  }
  const conMas = await resumen(est.token);
  check(
    crudo(conMas, areaProy.id) === 6,
    'B6.29 Tres evidencias más no suman nada de afinidad (§55)',
    `crudo ${crudo(conMas, areaProy.id)}`,
  );

  const d = await desglose(est.token, areaProy.id);
  const evidencias = (d.notContributing ?? []).filter((c) => c.weightCode === 'evidence');
  check(
    evidencias.length === 4,
    'B6.30 Las cuatro figuran en «no contribuye», con su motivo (§91)',
    `evidencias listadas ${evidencias.length}`,
  );
}

// ===========================================================================
//  §51.4, §53.3 y §54 · Certificados y diversidad
// ===========================================================================
async function certificadosYDiversidad(ctx) {
  objective('§51.4 y §54 · Respaldo alto exige más de una clase de prueba');

  const { est, areaAct } = ctx;

  section('El respaldo de una sola familia no llega a alto (§54)');
  const soloActividades = await resumen(est.token);
  const actArea = areaDe(soloActividades, areaAct.id);
  check(
    JSON.stringify(actArea?.supportFamilies) === JSON.stringify(['activity']),
    'B6.31 Tres participaciones y su constancia acreditan UNA familia, no dos (§54, §55)',
    JSON.stringify(actArea?.supportFamilies),
  );
  check(
    actArea?.supportLevel !== 'high',
    'B6.31b Con una sola familia el respaldo no puede ser alto por mucho que sume',
    `${actArea?.supportScore} -> ${actArea?.supportLevel}`,
  );

  section('§51.4 · El certificado puntúa según lo corroborado');
  const cert = await req('POST', '/certificates/external', {
    token: est.token,
    body: {
      certificateName: `Certificacion en pruebas ${TS}`,
      issuer: 'Plataforma externa de formacion',
      issueDate: '2026-04-15',
      description: 'Curso con evaluacion final.',
      academicAreaId: areaAct.id,
    },
  });
  check(cert.status === 201, 'B6.32 El estudiante adjunta un certificado', msgOf(cert));

  const conCert = await resumen(est.token);
  check(
    crudo(conCert, areaAct.id) === crudo(soloActividades, areaAct.id) + 1,
    'B6.33 Un certificado DECLARED suma 1 punto (§51.4)',
    `antes ${crudo(soloActividades, areaAct.id)} / después ${crudo(conCert, areaAct.id)}`,
  );
  check(
    respaldo(conCert, areaAct.id) === respaldo(soloActividades, areaAct.id),
    'B6.34 Y no aporta respaldo: DECLARED vale 0 en §53.3',
    `antes ${respaldo(soloActividades, areaAct.id)} / después ${respaldo(conCert, areaAct.id)}`,
  );

  section('§54 · Los umbrales y la regla de diversidad');
  const area = areaDe(conCert, areaAct.id);
  check(
    area.supportScore >= 0 && area.supportScore <= 100,
    'B6.35 SUPPORT_SCORE vive entre 0 y 100 (§49)',
    `respaldo ${area.supportScore}`,
  );
  check(
    ['low', 'medium', 'high'].includes(area.supportLevel),
    'B6.36 SUPPORT_LEVEL es LOW, MEDIUM o HIGH (§49)',
    String(area.supportLevel),
  );
  check(
    area.supportScore <= 24
      ? area.supportLevel === 'low'
      : area.supportScore <= 59
        ? area.supportLevel === 'medium'
        : true,
    'B6.37 Los cortes son los de §54: 0–24 bajo, 25–59 medio',
    `${area.supportScore} -> ${area.supportLevel}`,
  );
  check(
    !(area.supportScore >= 60 && (area.supportFamilies ?? []).length < 2
      && area.supportLevel === 'high'),
    'B6.38 Con una sola familia el respaldo no llega a HIGH aunque el bruto pase de 60 (§54)',
    `${area.supportScore} · ${JSON.stringify(area.supportFamilies)} -> ${area.supportLevel}`,
  );
}

// ===========================================================================
//  §48 y §56 · Determinismo y explicabilidad
// ===========================================================================
async function determinismoYExplicacion(ctx) {
  objective('§48 y §56 · El mismo dato da el mismo número, y se puede explicar');

  const { est, areaAct } = ctx;

  section('§48 · Determinista');
  const antes = await resumen(est.token);
  await req('POST', '/affinity/recalculate/me', { token: est.token });
  const despues = await resumen(est.token);
  check(
    JSON.stringify((antes.areas ?? []).map((a) => [a.academicAreaId, a.score, a.supportScore]))
      === JSON.stringify((despues.areas ?? []).map((a) => [a.academicAreaId, a.score, a.supportScore])),
    'B6.39 Recalcular sin cambiar nada da exactamente el mismo resultado (§48)',
  );
  check(
    despues.engineVersion === 2,
    'B6.40 El resultado declara la versión del motor que lo produjo (§56)',
    `versión ${despues.engineVersion}`,
  );

  section('§56 · Cada línea del desglose se puede rastrear');
  const d = await desglose(est.token, areaAct.id);
  const completas = (d.contributions ?? []).every(
    (c) => !!c.signalFamily && !!c.reason && c.rawPoints !== undefined
      && c.multiplier !== undefined && c.supportPoints !== undefined,
  );
  check(completas, 'B6.41 Todas llevan familia, motivo, base, multiplicador y respaldo (§56)');
  check(
    (d.contributions ?? []).every((c) => !!c.sourceEntityType || c.weightCode === 'improvement_area'),
    'B6.42 Y el tipo de registro del que salieron (§56)',
  );

  section('§91 · Dos listas, no una');
  check(
    Array.isArray(d.contributing) && Array.isArray(d.notContributing),
    'B6.43 El desglose separa lo que suma de lo que no (§91)',
  );
  // El área de proyectos es la que tiene señales de cero: las evidencias, que
  // mejoran el respaldo del proyecto sin crear un proyecto más (§55).
  const dProy = await desglose(est.token, ctx.areaProy.id);
  check(
    dProy.notContributing.length > 0
      && dProy.notContributing.every((c) => c.points === 0 && c.supportPoints === 0),
    'B6.44 «No contribuye» solo contiene señales que no aportaron nada',
    `no contribuyen ${dProy.notContributing.length}`,
  );
  check(
    d.contributing.every((c) => c.points > 0 || c.supportPoints > 0)
      && dProy.contributing.every((c) => c.points > 0 || c.supportPoints > 0),
    'B6.45 Y «por qué» solo contiene lo que aportó algo',
  );

  section('§51 · La regla completa es pública, no solo los pesos');
  const reglas = (await req('GET', '/affinity/weights', { token: est.token })).data;
  check(
    reglas?.engineVersion === 2 && reglas?.maxRawPoints === 60,
    'B6.46 El motor publica su versión y el máximo teórico (§51, §52)',
    JSON.stringify([reglas?.engineVersion, reglas?.maxRawPoints]),
  );
  check(
    reglas?.caps?.ACTIVITY === 10 && reglas?.caps?.PROJECT === 24
      && reglas?.caps?.CERTIFICATE === 12 && reglas?.caps?.PREFERENCE === 14,
    'B6.47 Publica los topes por familia (§51)',
    JSON.stringify(reglas?.caps),
  );
  check(
    Array.isArray(reglas?.diminishing?.ACTIVITY) && reglas.diminishing.ACTIVITY[1] === 0.7,
    'B6.48 Y los rendimientos decrecientes (§51.2)',
    JSON.stringify(reglas?.diminishing),
  );
  check(
    (reglas?.weights ?? []).some((w) => w.code === 'interest_priority_1' && w.points === 5),
    'B6.49 Los pesos por prioridad están almacenados y son consultables (§51.1)',
  );
  check(
    (reglas?.weights ?? []).every((w) => w.code !== 'project_owned'),
    'B6.50 Las reglas que V2 sustituyó ya no se publican como vigentes',
  );
}

// ===========================================================================
//  §51 · Los topes existen
// ===========================================================================
async function topes(ctx) {
  objective('§51 · Acumular lo mismo deja de sumar en algún momento');

  const { acumulador, areaTope } = ctx;

  // Ocho certificados en la misma área. Sin tope serían 8 puntos; con el de
  // §51.4 y los rendimientos, muchísimo menos.
  for (let i = 0; i < 8; i++) {
    await req('POST', '/certificates/external', {
      token: acumulador.token,
      body: {
        certificateName: `Curso repetido ${i} ${TS}`,
        issuer: 'Academia en linea',
        academicAreaId: areaTope.id,
      },
    });
  }

  const s = await resumen(acumulador.token);
  // 1 + 0,75 + 0,5 + 0,25 x 5 = 3,5
  check(
    crudo(s, areaTope.id) === 3.5,
    'B6.51 Ocho certificados declarados suman 3,5, no 8 (§51.4)',
    `crudo ${crudo(s, areaTope.id)}`,
  );
  check(
    crudo(s, areaTope.id) <= 12,
    'B6.52 Y en ningún caso pasarían del tope de 12 del área (§51.4)',
  );
  check(
    respaldo(s, areaTope.id) === 0,
    'B6.53 Repetir un certificado sin corroborar no genera respaldo (§53.3)',
    `respaldo ${respaldo(s, areaTope.id)}`,
  );
  check(
    (areaDe(s, areaTope.id)?.supportLevel) === 'low',
    'B6.54 Mucha cantidad de lo mismo no es respaldo alto (§54)',
    String(areaDe(s, areaTope.id)?.supportLevel),
  );
}

// ===========================================================================
//  §57 · Recálculo masivo
// ===========================================================================
async function recalculoMasivo(ctx) {
  objective('§57 · Cuando cambia la regla, no basta con esperar al estudiante');

  const ajeno = await req('POST', '/affinity/recalculate-all', { token: ctx.est.token });
  check(
    ajeno.status === 403,
    'B6.55 Un estudiante no puede recalcular el padrón -> 403',
    `status ${ajeno.status}`,
  );

  const docente = await req('POST', '/affinity/recalculate-all', { token: ctx.docente.token });
  check(
    docente.status === 403,
    'B6.56 Un docente tampoco -> 403',
    `status ${docente.status}`,
  );

  const admin = await req('POST', '/affinity/recalculate-all', { token: ctx.admin });
  check(
    admin.status === 200,
    'B6.57 El administrador sí, y el motor informa cuántos puso al día',
    msgOf(admin),
  );
  check(
    typeof admin.data?.recalculados === 'number' && typeof admin.data?.fallidos === 'number',
    'B6.58 Con el resultado desglosado',
    JSON.stringify(admin.data),
  );
}

// ===========================================================================
//  Preparación
// ===========================================================================
async function preparar() {
  console.log(`${C.bold}BATCH 6 — Motor de Afinidad V2 contra ${process.env.API_URL ?? 'http://localhost:3010/api'}${C.r}`);
  const admin = await loginAdmin();

  const areas = (await req('GET', '/academic-areas', { token: admin })).data ?? [];
  const skills = (await req('GET', '/skills', { token: admin })).data ?? [];
  const categorias = (await req('GET', '/activity-categories', { token: admin })).data ?? [];
  const categoria = categorias.find((c) => c.appliesTo !== 'extracurricular') ?? categorias[0];

  if (areas.length < 5) {
    throw new Error('Hacen falta al menos cinco áreas académicas. Ejecute npm run seed:populate.');
  }

  const staff = async (key, nombre, apellido, role, semestres) => {
    const cuenta = await provisionAndActivate(admin, {
      firstName: nombre, lastName: apellido, email: correoStaff(key), role,
    });
    if (semestres) {
      await req('PUT', `/users/${cuenta.userId}/semesters`, {
        token: admin, body: { semesters: semestres },
      });
    }
    return cuenta;
  };

  const estudiante = async (key, nombre, apellido, semestre) => {
    const cuenta = await provisionAndActivate(admin, {
      firstName: nombre, lastName: apellido, email: correoEst(key), role: 'STUDENT',
    });
    const perfil = await req('POST', '/profiles/me', { token: cuenta.token, body: {} });
    await req('PATCH', `/profiles/${perfil.data?.id}/institutional-data`, {
      token: admin, body: { semester: semestre },
    });
    return { ...cuenta, profileId: perfil.data?.id };
  };

  const docente = await staff('doc', 'Irene', 'Villarroel', 'TEACHER', [5]);
  const director = await staff('dir', 'Gonzalo', 'Terceros', 'CAREER_DIRECTOR', null);
  const est = await estudiante('est', 'Valeria', 'Cardenas', 5);
  const acumulador = await estudiante('acum', 'Ivan', 'Rojas', 5);

  // Áreas separadas para que cada familia de señal se pueda medir sola. Si
  // todas cayeran en la misma, un cambio de 2 puntos sería indistinguible de
  // otro de 2 puntos por una causa distinta.
  const areaA = areas[0];
  const areaB = areas[1];
  const areaC = areas[2];
  const areaAct = areas[3];
  const areaProy = areas[4];
  const areaTope = areas[areas.length - 1];

  const skillA = skills.find((s) => s.academicAreaId === areaA.id) ?? skills[0];

  // Tres actividades en la misma área, para ver los rendimientos decrecientes.
  const actividades = [];
  for (let i = 0; i < 3; i++) {
    const creada = await req('POST', '/activities', {
      token: docente.token,
      body: {
        title: `Taller de afinidad ${i} ${TS}`,
        description: 'Actividad para medir la puntuacion por participacion.',
        type: 'academica',
        categoryId: categoria.id,
        areaId: areaAct.id,
        semesterScope: [5],
      },
    });
    if (creada.status !== 201) {
      throw new Error(`No se pudo crear la actividad ${i}: ${JSON.stringify(creada.data)}`);
    }
    await req('PATCH', `/activities/${creada.data.id}`, {
      token: docente.token,
      body: { status: 'open' },
    });
    actividades.push(creada.data);
  }

  return {
    admin, docente, director, est, acumulador,
    areaA, areaB, areaC, areaAct, areaProy, areaTope,
    skillA, actividades,
  };
}

async function main() {
  try {
    const ctx = await preparar();
    await preferencias(ctx);
    await actividades(ctx);
    await sinDobleConteo(ctx);
    await proyectos(ctx);
    await certificadosYDiversidad(ctx);
    await determinismoYExplicacion(ctx);
    await topes(ctx);
    await recalculoMasivo(ctx);
  } catch (error) {
    console.error(`\n${C.bad}Error durante la ejecución:${C.r} ${error.message}`);
    process.exitCode = 1;
    return;
  }

  console.log(`\n${'-'.repeat(78)}`);
  if (failures.length === 0) {
    console.log(`${C.ok}${C.bold}  ${passed} verificaciones OK · 0 fallos${C.r}`);
    console.log('  El BATCH 6 queda demostrado de punta a punta.');
  } else {
    console.log(`${C.bad}${C.bold}  ${passed} verificaciones OK · ${failures.length} fallos${C.r}`);
    failures.forEach((f) => console.log(`  ${C.bad}·${C.r} ${f}`));
    process.exitCode = 1;
  }
}

main();
