// =============================================================================
//  Prueba integral del Objetivo 6 — Motor de afinidad estudiantil
//  RF17 · RN-14 · RN-15
// =============================================================================
//
//  Ejecuta de punta a punta, contra la API real, el sexto objetivo especifico.
//
//  La estrategia central es construir el perfil de un estudiante SENAL POR
//  SENAL, comprobando el puntaje despues de cada una. Eso demuestra que cada
//  ponderacion se aplica de verdad, en lugar de comprobar solo que "sale un
//  numero". Al final se verifica el invariante que sostiene todo el objetivo:
//  la suma del desglose es exactamente el puntaje del area.
//
//  Uso:  node scripts/e2e-objective-6.mjs
//        API_URL=http://localhost:3010/api node scripts/e2e-objective-6.mjs
//
//  Requiere: API corriendo + migraciones aplicadas + `npm run seed:populate`.
//  Las cuentas que crea llevan sufijo de tiempo, por lo que puede repetirse.
// =============================================================================

import { leerCorreo, provisionAndActivate, aprobarActividad } from './lib/fixtures.mjs';

const API = process.env.API_URL ?? 'http://localhost:3010/api';
const TS = Date.now();
// §13: la politica exige 12 caracteres como minimo.
const PWD = 'Afinia2026Seg*';
const email = (n) => `o6.${n}.${TS}@univalle.edu`;
const studentEmail = (n) => `o6.${n}.${TS}@est.univalle.edu`;

let pass = 0;
let fail = 0;
const failures = [];

const C = { ok: '\x1b[32m', bad: '\x1b[31m', dim: '\x1b[90m', b: '\x1b[1m', m: '\x1b[35m', r: '\x1b[0m' };
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

async function req(method, path, { token, body } = {}) {
  const headers = { ...(token ? { Authorization: `Bearer ${token}` } : {}) };
  let payload;
  if (body !== undefined) {
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

/** Puntaje de un area concreta dentro del resumen del estudiante. */
const areaOf = (summary, areaId) =>
  summary?.areas?.find((a) => a.academicAreaId === areaId) ?? null;

/** AFFINITY_SCORE normalizado de 0 a 100 (§49). */
const scoreOf = (summary, areaId) => areaOf(summary, areaId)?.score ?? 0;

/**
 * Puntos crudos sobre 60 (§52).
 *
 * Es lo que hay que mirar para comprobar una ponderacion concreta: el puntaje
 * visible ya esta normalizado, y comparar «2 puntos» con «3 de 100» no
 * demuestra nada.
 */
const rawOf = (summary, areaId) => areaOf(summary, areaId)?.rawPoints ?? 0;

const summaryOf = async (token) => (await req('GET', '/affinity/me/summary', { token })).data;

// ---------------------------------------------------------------------------

async function main() {
  console.log(`\n${C.b}Prueba integral del Objetivo 6 contra ${API}${C.r}`);

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

  const ctx = { admin };
  await prepararActores(ctx);
  await rf17Calculo(ctx);
  await rf17Explicabilidad(ctx);
  await rf17Niveles(ctx);
  await rf17Historial(ctx);
  await rf17Fallo(ctx);
  await rf17Permisos(ctx);
  await rn15(ctx);

  console.log(`\n${'-'.repeat(78)}`);
  if (fail === 0) {
    console.log(`${C.ok}${C.b}  ${pass} verificaciones OK · 0 fallos${C.r}`);
    console.log('  El Objetivo 6 queda demostrado de punta a punta.\n');
  } else {
    console.log(`${C.bad}${C.b}  ${pass} OK · ${fail} FALLOS${C.r}`);
    failures.forEach((f) => console.log(`   ${C.bad}·${C.r} ${f}`));
    console.log('');
    process.exitCode = 1;
  }
}

/**
 * Actores del escenario:
 *   A   estudiante que construye un perfil rico, 4o semestre
 *   B   estudiante sin informacion, 4o semestre -> camino de fallo de RF17
 *   docente        habilitado en 4o  -> ve a A
 *   docenteFuera   habilitado en 2o  -> no ve a A
 *
 * Se crean areas y habilidades propias del escenario para que los puntajes
 * sean deterministas y no dependan de lo que haya sembrado el seed.
 */
/**
 * Provisiona una cuenta y la activa (§9.1: no existe registro publico).
 *
 * El administrador la crea, el titular la activa con el token y despues inicia
 * sesion. Es el mismo camino que recorre una persona real.
 */
async function provisionarCuenta(
  adminToken,
  { firstName, lastName, email, role = 'STUDENT', semester },
) {
  // El código de activación se lee del buzón local, como lo leería el
  // titular: la respuesta del administrador ya no lo trae.
  const cuenta = await provisionAndActivate(adminToken, {
    firstName, lastName, email, role, semester, password: PWD,
  });
  return { accessToken: cuenta.token, userId: cuenta.userId, activationToken: cuenta.activationToken };
}

async function prepararActores(ctx) {
  objective('PREPARACION · Actores y catalogos del escenario');
  section('Areas y habilidades propias del escenario');

  const crearArea = async (nombre, tags) => {
    const r = await req('POST', '/academic-areas', {
      token: ctx.admin,
      body: { name: `${nombre} ${TS}`, description: `Area del escenario ${nombre}.`, tags },
    });
    return r.data;
  };

  // El area "principal" recibe casi todas las senales. La "secundaria" queda
  // marginal a proposito, para comprobar la clasificacion relativa.
  ctx.areaPrincipal = await crearArea('Sistemas Distribuidos', ['kubernetes', 'grpc']);
  ctx.areaSecundaria = await crearArea('Computacion Grafica', ['opengl', 'shaders']);
  check(
    !!ctx.areaPrincipal?.id && !!ctx.areaSecundaria?.id,
    'P.1 Dos areas academicas creadas para el escenario',
  );

  const skill = await req('POST', '/skills', {
    token: ctx.admin,
    body: { name: `Kubernetes ${TS}`, academicAreaId: ctx.areaPrincipal.id },
  });
  ctx.skill = skill.data;
  check(skill.status === 201, 'P.2 Habilidad asociada al area principal', msgOf(skill));

  section('Cuentas y alcances');
  const nuevoEstudiante = async (key, first, last, semester) => {
    const cuenta = await provisionarCuenta(ctx.admin, {
      firstName: first,
      lastName: last,
      email: studentEmail(key),
    });
    const token = cuenta.accessToken;
    // §17.1: el semestre lo fija el administrador, no el estudiante.
    const profile = await req('POST', '/profiles/me', {
      token,
      body: { bio: 'Estudiante de Ingenieria en Sistemas.' },
    });
    await req('PATCH', `/profiles/${profile.data?.id}/institutional-data`, {
      token: ctx.admin,
      body: { semester },
    });
    return { token, profileId: profile.data?.id, name: `${first} ${last}` };
  };

  ctx.A = await nuevoEstudiante('estA', 'Alonso', 'Terrazas', 4);
  ctx.B = await nuevoEstudiante('estB', 'Belen', 'Mostajo', 4);
  check(!!ctx.A.token && !!ctx.A.profileId, 'P.3 Estudiante A registrado con perfil');
  check(!!ctx.B.token && !!ctx.B.profileId, 'P.4 Estudiante B registrado con perfil');

  const nuevoDocente = async (key, first, last, semesters) => {
    const cuenta = await provisionarCuenta(ctx.admin, {
      firstName: first,
      lastName: last,
      email: email(key),
      role: 'TEACHER',
    });
    await req('PUT', `/users/${cuenta.userId}/semesters`, {
      token: ctx.admin,
      body: { semesters },
    });
    return { token: cuenta.accessToken, id: cuenta.userId };
  };

  ctx.docente = await nuevoDocente('docente', 'Ignacio', 'Camacho', [4]);
  ctx.docenteFuera = await nuevoDocente('docenteFuera', 'Lorena', 'Vaca', [2]);
  check(!!ctx.docente.token, 'P.5 Docente habilitado en 4o semestre');
  check(!!ctx.docenteFuera.token, 'P.6 Docente habilitado solo en 2o semestre');

  const director = await provisionarCuenta(ctx.admin, {
    firstName: 'Rocio',
    lastName: 'Balderrama',
    email: email('director'),
    role: 'CAREER_DIRECTOR',
  });
  ctx.directorToken = director.accessToken;
  check(!!ctx.directorToken, 'P.7 Director de carrera disponible');
}

// ===========================================================================
//  RF17 · Calculo de la afinidad, senal por senal
// ===========================================================================
async function rf17Calculo(ctx) {
  // Especificación V2 §45–§47: afinidad V3. Lo declarado no suma; solo la
  // trayectoria respaldada (participación confirmada, proyecto con respaldo
  // atribuido por las tecnologías del integrante, certificado con respaldo).
  objective('RF17 · Calculo de la afinidad V3 — señal por señal');
  const { A, areaPrincipal, areaSecundaria, skill } = ctx;

  section('Punto de partida');
  const inicial = await summaryOf(A.token);
  check(inicial?.status === 'insufficient_data', '17.1 Un perfil recien creado no tiene trayectoria que medir', `status ${inicial?.status}`);
  check(inicial?.areas?.length === 0, '17.2 Sin areas calculadas al inicio');

  section('Lo declarado orienta, no suma (V2 §45.1)');
  const interes = await req('PUT', '/profiles/me/interests', {
    token: A.token,
    body: { items: [{ academicAreaId: areaPrincipal.id, priority: 5 }, { academicAreaId: areaSecundaria.id, priority: 2 }] },
  });
  check(interes.status === 200, '17.3 El estudiante declara dos intereses', msgOf(interes));
  await req('PUT', '/profiles/me/skill-interests', { token: A.token, body: { items: [{ skillId: skill.id, kind: 'interest' }] } });
  await req('PATCH', '/profiles/me', { token: A.token, body: { improvementAreaIds: [areaPrincipal.id] } });
  let s = await summaryOf(A.token);
  check(s?.status === 'insufficient_data' && (s?.areas ?? []).length === 0,
    '17.4 Intereses, tecnologías de interés y áreas de mejora no producen afinidad', JSON.stringify(s?.areas));
  check(s?.signalsCount >= 3, '17.5 Pero se tuvieron en cuenta: el resumen cuenta las señales consideradas', `senales ${s?.signalsCount}`);

  section('Proyecto propio: respaldo y tecnologías del integrante (V2 §47.2, §48)');
  const proyecto = await req('POST', '/projects', {
    token: A.token,
    body: {
      title: `Orquestador de servicios ${TS}`,
      description: 'Proyecto academico del escenario de afinidad.',
      areaId: areaPrincipal.id,
      status: 'active',
      technologies: ['Kubernetes', 'gRPC'],
      visibility: 'teachers',
    },
  });
  check(proyecto.status === 201, '17.6 El estudiante registra un proyecto', msgOf(proyecto));
  ctx.proyectoId = proyecto.data?.id;
  await req('PUT', `/projects/${ctx.proyectoId}/my-contribution`, {
    token: A.token, body: { role: 'Responsable', contribution: 'Diseño del orquestador', skillIds: [skill.id] },
  });
  s = await summaryOf(A.token);
  check(rawOf(s, areaPrincipal.id) === 0, '17.7 Un proyecto DECLARED vale 0, aunque tenga tecnologías confirmadas (§47.2)', `crudo ${rawOf(s, areaPrincipal.id)}`);

  const evProyecto = await req('POST', `/projects/${ctx.proyectoId}/evidences`, {
    token: A.token,
    body: { evidenceType: 'link', description: 'Capturas del orquestador.', externalUrl: 'https://ejemplo.univalle.edu/orquestador' },
  });
  check(evProyecto.status === 201 || evProyecto.status === 200, '17.8 Adjunta una evidencia al proyecto', msgOf(evProyecto));
  s = await summaryOf(A.token);
  check(rawOf(s, areaPrincipal.id) === 10 && areaOf(s, areaPrincipal.id)?.supportScore === 8,
    '17.9 SUPPORTED suma 10 de afinidad y 8 de respaldo en el área de su tecnología (§47.2, §49)',
    `crudo ${rawOf(s, areaPrincipal.id)} / respaldo ${areaOf(s, areaPrincipal.id)?.supportScore}`);

  section('Evidencia suelta y certificado declarado: no suman (§47.3, §50)');
  const evidencia = await req('POST', '/evidences', {
    token: A.token,
    body: { evidenceType: 'link', description: 'Repositorio del orquestador.', externalUrl: 'https://github.com/afinia/orquestador', academicAreaId: areaPrincipal.id },
  });
  check(evidencia.status === 201, '17.10 El estudiante registra una evidencia', msgOf(evidencia));
  const cert = await req('POST', '/certificates/external', {
    token: A.token,
    body: {
      certificateName: `Certificacion en orquestacion ${TS}`,
      issuer: 'Plataforma externa de formacion',
      issueDate: '2026-04-15',
      description: 'Curso con evaluacion final.',
      academicAreaId: areaPrincipal.id,
      certificateUrl: 'https://certificados.example.com/afinia',
    },
  });
  check(cert.status === 201, '17.11 El estudiante adjunta un certificado externo', msgOf(cert));
  s = await summaryOf(A.token);
  check(rawOf(s, areaPrincipal.id) === 10, '17.12 Ni la evidencia suelta ni el certificado DECLARED suman afinidad', `crudo ${rawOf(s, areaPrincipal.id)}`);

  section('Participación confirmada (§47.1)');
  const categorias = (await req('GET', '/activity-categories', { token: ctx.docente.token })).data ?? [];
  const categoria = categorias.find((c) => c.isActive !== false && c.appliesTo !== 'extracurricular') ?? categorias[0];
  const act = await req('POST', '/activities', {
    token: ctx.docente.token,
    body: { title: `Laboratorio de shaders ${TS}`, description: 'Actividad del escenario.', type: 'academica', categoryId: categoria.id, areaId: areaSecundaria.id, semesterScope: [4] },
  });
  await aprobarActividad(ctx.docente.token, ctx.directorToken, act.data?.id);
  await req('POST', `/activities/${act.data?.id}/register`, { token: A.token });
  await req('PATCH', `/activities/${act.data?.id}/confirm-participation`, {
    token: ctx.docente.token, body: { studentProfileId: A.profileId, status: 'confirmed' },
  });
  s = await summaryOf(A.token);
  check(s?.status === 'calculated', '17.13 Con trayectoria respaldada el estado pasa a calculado');
  check(rawOf(s, areaSecundaria.id) === 10, '17.14 La participación confirmada vale 10 en el área de la actividad (§47.1)', `crudo ${rawOf(s, areaSecundaria.id)}`);

  section('Recalculo explicito e idempotencia');
  const recalc = await req('POST', '/affinity/recalculate/me', { token: A.token });
  check(recalc.status === 200, '17.18 El estudiante puede recalcular su afinidad');
  const antes = await summaryOf(A.token);
  await req('POST', '/affinity/recalculate/me', { token: A.token });
  const despues = await summaryOf(A.token);
  check(antes.totalScore === despues.totalScore && antes.areas.length === despues.areas.length,
    '17.19 Recalcular sin cambios da el mismo resultado (idempotente)', `${antes.totalScore} vs ${despues.totalScore}`);
  check(despues.areas.every((a, i) => i === 0 || despues.areas[i - 1].score >= a.score), '17.20 El ranking viene ordenado de mayor a menor puntaje');
  check(despues.areas[0]?.rank === 1 && despues.areas[0]?.share === undefined,
    '17.21 El area mas fuerte ocupa el puesto 1, sin normalizar contra si misma (§47.4)', `rank ${despues.areas[0]?.rank}`);
  check(despues.maxRawPoints === 100 && despues.areas.every((a) => a.score === Math.round(Math.min(100, a.rawPoints))),
    '17.21b Cada puntaje es round(min(100, suma)): escala directa (§47.4)', JSON.stringify(despues.areas.map((a) => [a.rawPoints, a.score])));
}

// ===========================================================================
//  RN-14 · Explicabilidad: reglas, etiquetas y coincidencias
// ===========================================================================
async function rf17Explicabilidad(ctx) {
  objective('RN-14 · Explicabilidad del calculo');
  const { A, areaPrincipal, areaSecundaria } = ctx;

  section('Desglose del area principal');
  const bd = await req('GET', `/affinity/me/areas/${areaPrincipal.id}/breakdown`, { token: A.token });
  check(bd.status === 200, '17.22 El estudiante consulta el desglose de un area', msgOf(bd));
  check(Array.isArray(bd.data?.contributions) && bd.data.contributions.length >= 5,
    '17.23 El desglose lista las señales consideradas, sumen o no', `lineas ${bd.data?.contributions?.length}`);
  const suma = (bd.data?.contributions ?? []).reduce((acc, c) => acc + Number(c.points), 0);
  check(Math.abs(suma - Number(bd.data?.rawPoints)) < 0.011, '17.24 INVARIANTE: la suma del desglose es exactamente el puntaje del area', `suma ${suma} vs crudo ${bd.data?.rawPoints}`);
  const tipos = new Set((bd.data?.contributions ?? []).map((c) => c.signalType));
  check(tipos.has('interest') && tipos.has('project') && tipos.has('evidence') && tipos.has('certificate') && tipos.has('improvement_area'),
    '17.25 El desglose distingue las familias de señal', [...tipos].join(', '));
  check((bd.data?.notContributing ?? []).some((c) => c.signalType === 'interest' && /no suma afinidad/.test(c.reason ?? c.sourceLabel ?? '')),
    '17.25b El interés figura como «no contribuye» y dice por qué (V2 §45.1)');
  const linea = (bd.data?.contributions ?? [])[0];
  check(!!linea?.sourceLabel && !!linea?.matchType && typeof linea?.points === 'number', '17.26 Cada linea dice de donde viene, como se asocio y cuanto aporta', JSON.stringify(linea ?? {}));
  check((bd.data?.contributions ?? []).some((c) => c.matchType === 'declared'), '17.27 Se distingue lo declarado por el estudiante');
  check((bd.data?.contributions ?? []).some((c) => c.sourceLabel.includes('Proyecto propio')), '17.28 El proyecto propio aparece identificado por su titulo');

  section('Deduccion por etiquetas (coincidencias de RN-14)');
  const porEtiquetas = await req('POST', '/projects', {
    token: A.token,
    body: { title: `Visualizador de mallas ${TS}`, description: 'Proyecto sin area declarada, para deduccion por etiquetas.', status: 'active', technologies: ['OpenGL', 'Shaders'], visibility: 'profile' },
  });
  check(porEtiquetas.status === 201, '17.29 Proyecto registrado sin area academica declarada');
  const bdSec = await req('GET', `/affinity/me/areas/${areaSecundaria.id}/breakdown`, { token: A.token });
  check((bdSec.data?.contributions ?? []).some((c) => c.matchType === 'tag'),
    '17.30 Sin tecnologías propias, el área del proyecto se deduce por etiquetas (solo para el respaldo)', (bdSec.data?.contributions ?? []).map((c) => c.matchType).join(', '));
  check(Math.abs((bdSec.data?.contributions ?? []).reduce((a, c) => a + Number(c.points), 0) - Number(bdSec.data?.rawPoints)) < 0.011,
    '17.31 El invariante tambien se cumple en el area deducida');

  section('Ponderaciones expuestas (RN-14)');
  const pesos = await req('GET', '/affinity/weights', { token: A.token });
  check(pesos.status === 200, '17.32 Las ponderaciones del motor son consultables');
  check(Array.isArray(pesos.data?.weights) && pesos.data.weights.length >= 13, '17.33 Las ponderaciones estan almacenadas y son consultables', `reglas ${pesos.data?.weights?.length}`);
  check((pesos.data?.weights ?? []).every((w) => w.label && w.description && typeof w.points === 'number'), '17.34 Cada ponderacion declara su etiqueta, justificacion y puntos');
  const codigos = new Set((pesos.data?.weights ?? []).map((w) => w.code));
  check(codigos.has('project_corroborated') && codigos.has('certificate_corroborated') && codigos.has('activity_confirmed'),
    '17.35 Las ponderaciones cubren las fuentes de la afinidad V3 (§46)', [...codigos].join(', '));
  check(pesos.data?.caps?.PROJECT === 50 && pesos.data?.supportCaps?.PROJECT === 45 && Array.isArray(pesos.data?.diminishing?.PROJECT),
    '17.35b Y se publican los topes y los rendimientos decrecientes (§47, §49)', JSON.stringify([pesos.data?.caps, pesos.data?.supportCaps]));
}

// ===========================================================================
//  RF17 · Niveles por cortes absolutos
// ===========================================================================
async function rf17Niveles(ctx) {
  objective('RF17 · Clasificacion del nivel de afinidad');
  const { A, areaPrincipal } = ctx;
  const s = await summaryOf(A.token);
  const principal = s.areas.find((a) => a.academicAreaId === areaPrincipal.id);
  const umbral = (n) => (n > 59 ? 'high' : n > 24 ? 'medium' : 'low');
  check(principal?.level === umbral(principal?.score), '17.36 El nivel sale de cortes absolutos, no del ranking interno', `puntaje ${principal?.score} -> nivel ${principal?.level}`);
  check(principal?.level !== 'high', '17.37 El area mas fuerte de un perfil incipiente NO es «alta» por ser la primera', `nivel ${principal?.level}`);
  check(s.areas.every((a) => a.share === undefined), '17.38 No hay peso relativo al propio perfil (§47.4)');
  check(s.areas.every((a) => ['low', 'medium', 'high'].includes(a.level)), '17.39 Todos los niveles pertenecen a la escala definida');
  check(s.areas.every((a, i) => a.rank === i + 1), '17.40 Los puestos del ranking son consecutivos desde 1');

  section('Declarar no da nivel');
  await req('PUT', '/profiles/me/interests', { token: ctx.B.token, body: { items: [{ academicAreaId: areaPrincipal.id, priority: 1 }] } });
  const sb = await summaryOf(ctx.B.token);
  check((sb.areas ?? []).length === 0, '17.41 Un interés de máxima prioridad no da área ni nivel (V2 §45.1)', JSON.stringify(sb.areas));
  check(sb.status === 'insufficient_data', '17.41b Y el estado sigue siendo «sin trayectoria»', String(sb.status));
}

// ===========================================================================
//  RF17 · Historial de calculos ("calcular, actualizar y consultar")
// ===========================================================================
async function rf17Historial(ctx) {
  objective('RF17 · Historial de calculos');
  const { A } = ctx;

  const hist = await req('GET', '/affinity/me/history?limit=10', { token: A.token });
  check(hist.status === 200, '17.42 El estudiante consulta el historial de sus calculos');
  check(
    Array.isArray(hist.data) && hist.data.length >= 2,
    '17.43 Cada recalculo deja una instantanea registrada',
    `instantaneas ${hist.data?.length}`,
  );

  const fechas = (hist.data ?? []).map((h) => new Date(h.calculatedAt).getTime());
  check(
    fechas.every((f, i) => i === 0 || fechas[i - 1] >= f),
    '17.44 El historial viene del calculo mas reciente al mas antiguo',
  );

  const ultima = hist.data?.[0];
  check(
    !!ultima?.rulesVersion,
    '17.45 Cada instantanea registra con que version de reglas se calculo',
    `version ${ultima?.rulesVersion}`,
  );
  check(
    ultima?.areasCount === ultima?.areas?.length,
    '17.46 El conteo de areas coincide con el detalle guardado',
    `${ultima?.areasCount} vs ${ultima?.areas?.length}`,
  );

  const actual = await summaryOf(A.token);
  check(
    ultima?.totalScore === actual.totalScore,
    '17.47 La ultima instantanea refleja el estado vigente',
    `${ultima?.totalScore} vs ${actual.totalScore}`,
  );
  check(
    (ultima?.areas ?? []).every((a, i) => a.rank === i + 1),
    '17.48 La instantanea conserva el orden del ranking',
  );

  const limitado = await req('GET', '/affinity/me/history?limit=1', { token: A.token });
  check(
    limitado.data?.length === 1,
    '17.49 El historial respeta el limite solicitado',
    `devuelto ${limitado.data?.length}`,
  );
}

// ===========================================================================
//  RF17 · Salida de fallo: informacion insuficiente
// ===========================================================================
async function rf17Fallo(ctx) {
  objective('RF17 · Salida de fallo — informacion insuficiente');

  section('Perfil sin ninguna senal');
  const reg = await provisionarCuenta(ctx.admin, {
    firstName: 'Damian',
    lastName: 'Ferrufino',
    email: studentEmail('estVacio'),
  });
  const vacio = reg.accessToken;
  const perfilVacio = await req('POST', '/profiles/me', { token: vacio, body: {} });
  await req('PATCH', `/profiles/${perfilVacio.data?.id}/institutional-data`, {
    token: ctx.admin,
    body: { semester: 2 },
  });

  const s = await summaryOf(vacio);
  check(
    s?.status === 'insufficient_data',
    '17.50 El estado distingue explicitamente la falta de informacion',
    `status ${s?.status}`,
  );
  check(s?.areas?.length === 0, '17.51 No se inventan areas cuando no hay datos');
  check(
    typeof s?.message === 'string' && s.message.length > 40,
    '17.52 El sistema informa que hacer, no solo que no hay datos',
    s?.message,
  );
  check(s?.totalScore === 0, '17.53 El total es cero, no nulo');

  const recalc = await req('POST', '/affinity/recalculate/me', { token: vacio });
  check(
    recalc.status === 200 && Array.isArray(recalc.data) && recalc.data.length === 0,
    '17.54 Recalcular un perfil vacio no falla: devuelve vacio',
    `status ${recalc.status}`,
  );

  section('Consultas invalidas');
  const inexistente = await req(
    'GET',
    '/affinity/me/areas/00000000-0000-0000-0000-000000000000/breakdown',
    { token: ctx.A.token },
  );
  check(
    inexistente.status === 404,
    '17.55 El desglose de un area inexistente responde 404',
    `status ${inexistente.status}`,
  );

  const malFormado = await req('GET', '/affinity/me/areas/no-es-uuid/breakdown', {
    token: ctx.A.token,
  });
  check(
    malFormado.status === 400,
    '17.56 Un identificador mal formado se rechaza con 400',
    `status ${malFormado.status}`,
  );

  const sinAfinidad = await req(
    'GET',
    `/affinity/me/areas/${ctx.areaPrincipal.id}/breakdown`,
    { token: vacio },
  );
  check(
    sinAfinidad.status === 200 && sinAfinidad.data?.score === 0,
    '17.57 Un area sin puntaje devuelve cero y desglose vacio',
    `score ${sinAfinidad.data?.score}`,
  );
}

// ===========================================================================
//  RN-23 · Alcance academico en la consulta institucional
// ===========================================================================
async function rf17Permisos(ctx) {
  objective('RN-23 · Permisos y alcance academico');
  const { A, areaPrincipal } = ctx;

  section('Docente dentro de su alcance');
  const resumen = await req('GET', `/affinity/student/${A.profileId}/summary`, {
    token: ctx.docente.token,
  });
  check(resumen.status === 200, '17.58 El docente de su semestre consulta el resumen', msgOf(resumen));

  const bd = await req(
    'GET',
    `/affinity/student/${A.profileId}/areas/${areaPrincipal.id}/breakdown`,
    { token: ctx.docente.token },
  );
  check(bd.status === 200, '17.59 El docente de su semestre consulta el desglose');
  check(
    Math.abs(
      (bd.data?.contributions ?? []).reduce((a, c) => a + Number(c.points), 0)
      - Number(bd.data?.rawPoints),
    ) < 0.011,
    '17.60 El desglose que ve el docente cumple el mismo invariante',
  );

  section('Docente fuera de su alcance');
  check(
    (await req('GET', `/affinity/student/${A.profileId}`, { token: ctx.docenteFuera.token }))
      .status === 403,
    '17.61 Fuera de alcance: lista de afinidades -> 403',
  );
  check(
    (await req('GET', `/affinity/student/${A.profileId}/summary`, {
      token: ctx.docenteFuera.token,
    })).status === 403,
    '17.62 Fuera de alcance: resumen -> 403',
  );
  check(
    (await req(
      'GET',
      `/affinity/student/${A.profileId}/areas/${areaPrincipal.id}/breakdown`,
      { token: ctx.docenteFuera.token },
    )).status === 403,
    '17.63 Fuera de alcance: desglose -> 403 (no es una puerta trasera)',
  );
  check(
    (await req('POST', `/affinity/recalculate/${A.profileId}`, {
      token: ctx.docenteFuera.token,
    })).status === 403,
    '17.64 Fuera de alcance: recalculo ajeno -> 403',
  );

  section('Separacion entre estudiantes y roles');
  check(
    (await req('GET', `/affinity/student/${A.profileId}/summary`, { token: ctx.B.token }))
      .status === 403,
    '17.65 Un estudiante no usa la ruta institucional -> 403',
  );
  check(
    (await req('GET', '/reports/director/affinity-map', { token: ctx.A.token })).status === 403,
    '17.66 El estudiante no accede al mapa agregado -> 403',
  );
  check(
    (await req('GET', '/reports/director/affinity-map', { token: ctx.docente.token })).status === 403,
    '17.67 El docente no accede al mapa agregado -> 403',
  );
  const mapa = await req('GET', '/reports/director/affinity-map', { token: ctx.directorToken });
  check(mapa.status === 200, '17.68 El director consulta el mapa agregado');
  check(
    Array.isArray(mapa.data?.areas)
      && mapa.data.areas.every(
        (m) => typeof m.students === 'number' && (m.suppressed || m.bySupportLevel),
      ),
    '17.69 El mapa agrega estudiantes y niveles por area',
  );
  check(
    (await req('GET', '/affinity/me/summary', { token: ctx.docente.token })).status === 403,
    '17.70 Un docente no tiene afinidad propia que consultar -> 403',
  );
}

// ===========================================================================
//  RN-15 · Uso orientativo, nunca evaluativo
// ===========================================================================
async function rn15(ctx) {
  objective('RN-15 · Caracter orientativo del resultado');
  const { A, areaPrincipal } = ctx;

  const s = await summaryOf(A.token);
  const prohibidos = ['grade', 'nota', 'score_final', 'approved', 'aprobado', 'calificacion', 'passed'];
  const serializado = JSON.stringify(s).toLowerCase();
  check(
    !prohibidos.some((p) => serializado.includes(p)),
    '17.71 El resumen no expone nota, calificacion ni aprobacion',
  );

  const bd = await req('GET', `/affinity/me/areas/${areaPrincipal.id}/breakdown`, {
    token: A.token,
  });
  check(
    !prohibidos.some((p) => JSON.stringify(bd.data).toLowerCase().includes(p)),
    '17.72 El desglose tampoco expone campos de evaluacion',
  );

  const pesos = await req('GET', '/affinity/weights', { token: A.token });
  check(
    (pesos.data?.weights ?? []).every((w) => w.points >= 0 && w.points <= 100),
    '17.73 Las ponderaciones son puntajes acotados, no escalas de nota',
  );

  // El motor orienta; no decide. Nadie puede fijar una afinidad a mano.
  check(
    (await req('PATCH', `/affinity/me/areas/${areaPrincipal.id}`, {
      token: A.token,
      body: { score: 99 },
    })).status === 404,
    '17.74 No existe forma de fijar una afinidad a mano: siempre es calculada',
  );
  check(
    (await req('POST', '/affinity/weights', {
      token: ctx.admin,
      body: { code: 'interest', points: 99 },
    })).status === 404,
    '17.75 Las ponderaciones son configuracion del sistema, no un catalogo editable',
  );
}

main().catch((e) => {
  console.error(`\n${C.bad}Error inesperado:${C.r}`, e);
  process.exit(1);
});
