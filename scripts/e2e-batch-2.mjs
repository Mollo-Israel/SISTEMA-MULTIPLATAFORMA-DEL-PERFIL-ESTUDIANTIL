/**
 * BATCH 2 — Perfil y onboarding.
 *
 * Cubre §16 (cuestionario), §17 (datos institucionales frente a editables),
 * §18 (intereses y su origen), §20 (área de mejora = 0 puntos), §21
 * (autoevaluación de tres niveles y experiencia respaldada) y §44
 * (privacidad).
 *
 * Uso:
 *   API_URL=http://localhost:3010/api node scripts/e2e-batch-2.mjs
 */

import {
  API,
  PWD,
  loginAdmin,
  provisionAndActivate,
  req,
} from './lib/fixtures.mjs';

const TS = Date.now();

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
const msgOf = (r) =>
  Array.isArray(r?.data?.message) ? r.data.message.join(' | ') : (r?.data?.message ?? '');

const correo = (k) => `b2.${k}.${TS}@est.univalle.edu`;

/** Responde el cuestionario entero eligiendo siempre la opción indicada. */
function responder(questionnaire, elegir) {
  return questionnaire.questions.map((q) => ({
    questionCode: q.code,
    optionCodes: elegir(q),
  }));
}

// ===========================================================================
//  §17 · Datos institucionales frente a datos propios
// ===========================================================================
async function datosInstitucionales(ctx) {
  objective('§17 · El estudiante edita lo suyo, no lo institucional');

  section('Alta del perfil');
  const creado = await req('POST', '/profiles/me', {
    token: ctx.est.token,
    body: { bio: 'Estudiante interesada en desarrollo web.' },
  });
  check(creado.status === 201, 'B2.1 El estudiante crea su perfil', msgOf(creado));
  ctx.profileId = creado.data?.id;
  check(creado.data?.semester === null, 'B2.2 El perfil nace sin semestre: es dato del padrón');

  section('§17.1 · Lo institucional no lo toca el estudiante');
  const intentoSemestre = await req('PATCH', '/profiles/me', {
    token: ctx.est.token,
    body: { semester: 6 },
  });
  check(
    intentoSemestre.status === 400,
    'B2.3 El estudiante NO puede declarar su semestre -> 400',
    `status ${intentoSemestre.status}`,
  );

  const intentoCodigo = await req('PATCH', '/profiles/me', {
    token: ctx.est.token,
    body: { universityCode: 'FALSO123' },
  });
  check(
    intentoCodigo.status === 400,
    'B2.4 Tampoco su código universitario -> 400',
    `status ${intentoCodigo.status}`,
  );

  const ajeno = await req('PATCH', `/profiles/${ctx.profileId}/institutional-data`, {
    token: ctx.est.token,
    body: { semester: 6 },
  });
  check(
    ajeno.status === 403,
    'B2.5 Ni por el endpoint del administrador -> 403',
    `status ${ajeno.status}`,
  );

  section('El administrador sí');
  const asignado = await req('PATCH', `/profiles/${ctx.profileId}/institutional-data`, {
    token: ctx.admin,
    body: { semester: 4, universityCode: `B2${TS}` },
  });
  check(asignado.status === 200, 'B2.6 El administrador fija semestre y código', msgOf(asignado));
  check(asignado.data?.semester === 4, 'B2.7 El semestre queda registrado');

  const fuera = await req('PATCH', `/profiles/${ctx.profileId}/institutional-data`, {
    token: ctx.admin,
    body: { semester: 12 },
  });
  check(fuera.status === 400, 'B2.8 Un semestre fuera de 1-8 se rechaza -> 400', `status ${fuera.status}`);

  section('§17.2 · Lo propio sí lo edita');
  const propio = await req('PATCH', '/profiles/me', {
    token: ctx.est.token,
    body: {
      bio: 'Ahora enfocada en backend.',
      availability: 'looking',
      collaborationPreferences: {
        modes: ['hybrid'],
        interests: ['projects', 'competitions'],
        hoursPerWeek: 8,
        notes: 'Disponible por las tardes.',
      },
    },
  });
  check(propio.status === 200, 'B2.9 Edita biografía, disponibilidad y preferencias', msgOf(propio));
  check(propio.data?.availability === 'looking', 'B2.10 La disponibilidad persiste (§17.2)');
  check(
    propio.data?.collaborationPreferences?.hoursPerWeek === 8
      && propio.data?.collaborationPreferences?.interests?.length === 2,
    'B2.11 Las preferencias de colaboración persisten',
    JSON.stringify(propio.data?.collaborationPreferences ?? {}),
  );

  const malaDisponibilidad = await req('PATCH', '/profiles/me', {
    token: ctx.est.token,
    body: { availability: 'cuando-pueda' },
  });
  check(
    malaDisponibilidad.status === 400,
    'B2.12 Una disponibilidad inventada se rechaza -> 400',
    `status ${malaDisponibilidad.status}`,
  );
}

// ===========================================================================
//  §16 · Cuestionario Inicial de Orientación Académica
// ===========================================================================
async function cuestionario(ctx) {
  objective('§16 · Cuestionario Inicial de Orientación Académica');

  section('El cuestionario');
  const q = await req('GET', '/onboarding/questionnaire', { token: ctx.est.token });
  check(q.status === 200, 'B2.13 El estudiante obtiene el cuestionario', msgOf(q));
  ctx.questionnaire = q.data;

  const total = q.data?.questions?.length ?? 0;
  check(
    total >= 10 && total <= 15,
    'B2.14 Tiene entre 10 y 15 preguntas, como exige §16',
    `preguntas ${total}`,
  );
  check(
    (q.data?.questions ?? []).every((x) => x.type === 'single' || x.type === 'multiple'),
    'B2.15 Todas son de selección simple o múltiple',
  );
  check(
    (q.data?.questions ?? []).every((x) => (x.options ?? []).length >= 2),
    'B2.16 Ninguna pregunta se queda sin opciones',
  );
  check(typeof q.data?.version === 'number', 'B2.17 El cuestionario declara su versión');

  const sinSesion = await req('GET', '/onboarding/questionnaire');
  check(sinSesion.status === 401, 'B2.18 Sin sesión no se obtiene -> 401', `status ${sinSesion.status}`);

  const docente = await req('GET', '/onboarding/questionnaire', { token: ctx.docente.token });
  check(
    docente.status === 403,
    'B2.19 El cuestionario es del estudiante: un docente no entra -> 403',
    `status ${docente.status}`,
  );

  section('Respuestas inválidas');
  const incompleto = await req('POST', '/onboarding/runs', {
    token: ctx.est.token,
    body: { answers: [{ questionCode: q.data.questions[0].code, optionCodes: [q.data.questions[0].options[0].code] }] },
  });
  check(
    incompleto.status === 400,
    'B2.20 Un cuestionario a medias se rechaza -> 400',
    `status ${incompleto.status}`,
  );

  const inventada = await req('POST', '/onboarding/runs', {
    token: ctx.est.token,
    body: {
      answers: responder(q.data, (x) => [x.options[0].code]).map((a, i) =>
        (i === 0 ? { ...a, optionCodes: ['opcion-que-no-existe'] } : a)),
    },
  });
  check(
    inventada.status === 400,
    'B2.21 Una opción inventada se rechaza -> 400',
    `status ${inventada.status}`,
  );

  const preguntaFalsa = await req('POST', '/onboarding/runs', {
    token: ctx.est.token,
    body: {
      answers: [
        ...responder(q.data, (x) => [x.options[0].code]),
        { questionCode: 'q99_inexistente', optionCodes: ['x'] },
      ],
    },
  });
  check(
    preguntaFalsa.status === 400,
    'B2.22 Una pregunta inventada se rechaza -> 400',
    `status ${preguntaFalsa.status}`,
  );

  const multipleDesbordada = q.data.questions.find((x) => x.type === 'multiple');
  if (multipleDesbordada) {
    const exceso = await req('POST', '/onboarding/runs', {
      token: ctx.est.token,
      body: {
        answers: responder(q.data, (x) =>
          (x.code === multipleDesbordada.code
            ? x.options.map((o) => o.code)
            : [x.options[0].code])),
      },
    });
    check(
      exceso.status === 400,
      'B2.23 Marcar más opciones de las permitidas se rechaza -> 400',
      `status ${exceso.status}`,
    );
  }

  const simple = q.data.questions.find((x) => x.type === 'single');
  const dobleEnSimple = await req('POST', '/onboarding/runs', {
    token: ctx.est.token,
    body: {
      answers: responder(q.data, (x) =>
        (x.code === simple.code
          ? [x.options[0].code, x.options[1].code]
          : [x.options[0].code])),
    },
  });
  check(
    dobleEnSimple.status === 400,
    'B2.24 Dos respuestas en una pregunta simple se rechazan -> 400',
    `status ${dobleEnSimple.status}`,
  );

  section('Respuesta válida');
  const enviado = await req('POST', '/onboarding/runs', {
    token: ctx.est.token,
    body: { answers: responder(q.data, (x) => [x.options[0].code]) },
  });
  check(enviado.status === 201 || enviado.status === 200, 'B2.25 El cuestionario se registra', msgOf(enviado));
  ctx.runId = enviado.data?.id;
  check(enviado.data?.status === 'completed', 'B2.26 Queda pendiente de confirmación');
  check(
    Array.isArray(enviado.data?.suggestedAreas) && enviado.data.suggestedAreas.length > 0,
    'B2.27 Produce áreas sugeridas',
    `sugeridas ${enviado.data?.suggestedAreas?.length}`,
  );
  check(
    enviado.data.suggestedAreas.every((a, i, arr) => i === 0 || arr[i - 1].score >= a.score),
    'B2.28 Las sugerencias vienen de mayor a menor afinidad aparente',
  );
  check(
    enviado.data?.version === ctx.questionnaire.version,
    'B2.29 Se guarda con qué versión del cuestionario se respondió (§16)',
  );

  section('Responder NO crea intereses (§16)');
  const interesesTras = await req('GET', '/profiles/me/summary', { token: ctx.est.token });
  check(
    (interesesTras.data?.preferredAreas ?? []).length === 0,
    'B2.30 Tras responder, el estudiante sigue sin intereses: solo la confirmación los crea',
    `intereses ${(interesesTras.data?.preferredAreas ?? []).length}`,
  );

  const vigente = await req('GET', '/onboarding/me', { token: ctx.est.token });
  check(vigente.data?.pendingConfirmation === true, 'B2.31 El sistema sabe que falta confirmar');
  check(
    (vigente.data?.run?.answers ?? []).length === ctx.questionnaire.questions.length,
    'B2.32 Se guardaron todas las respuestas, no solo el resultado (§16)',
  );
}

// ===========================================================================
//  §16, §18 · Confirmación e intereses
// ===========================================================================
async function confirmacion(ctx) {
  objective('§16 y §18 · Solo la confirmación crea intereses');

  section('No se puede confirmar lo que no se sugirió');
  const areas = await req('GET', '/academic-areas', { token: ctx.est.token });
  const sugeridas = new Set(
    (await req('GET', '/onboarding/me', { token: ctx.est.token })).data?.run?.suggestedAreas?.map(
      (a) => a.academicAreaId,
    ) ?? [],
  );
  const noSugerida = (areas.data ?? []).find((a) => !sugeridas.has(a.id));

  const intruso = await req('POST', `/onboarding/runs/${ctx.runId}/confirm`, {
    token: ctx.est.token,
    body: { academicAreaIds: [noSugerida.id] },
  });
  check(
    intruso.status === 400,
    'B2.33 Confirmar un área que el cuestionario no sugirió se rechaza -> 400',
    `status ${intruso.status}`,
  );

  section('Confirmación válida');
  const elegidas = [...sugeridas].slice(0, 2);
  const confirmado = await req('POST', `/onboarding/runs/${ctx.runId}/confirm`, {
    token: ctx.est.token,
    body: { academicAreaIds: elegidas },
  });
  check(confirmado.status === 201 || confirmado.status === 200, 'B2.34 La confirmación se acepta', msgOf(confirmado));
  check(
    confirmado.data?.confirmedAreaIds?.length === elegidas.length,
    'B2.35 Se incorporan exactamente las áreas elegidas',
    `confirmadas ${confirmado.data?.confirmedAreaIds?.length}`,
  );

  const resumen = await req('GET', '/profiles/me/summary', { token: ctx.est.token });
  check(
    (resumen.data?.preferredAreas ?? []).length === elegidas.length,
    'B2.36 Ahora sí existen intereses efectivos',
    `intereses ${(resumen.data?.preferredAreas ?? []).length}`,
  );

  const lista = resumen.data?.preferredAreas ?? [];
  check(
    lista.length > 0 && lista.every((i) => i.source === 'onboarding'),
    'B2.37 Quedan marcados como venidos del cuestionario (§18)',
    lista.map((i) => i.source).join(',') || 'sin intereses',
  );
  check(
    lista.every((i) => typeof i.priority === 'number' && i.priority >= 1 && i.priority <= 5),
    'B2.37b Entran con prioridad válida, la más sugerida primero (§18)',
    lista.map((i) => i.priority).join(','),
  );

  section('Repetir la confirmación');
  const otraVez = await req('POST', `/onboarding/runs/${ctx.runId}/confirm`, {
    token: ctx.est.token,
    body: { academicAreaIds: elegidas },
  });
  check(
    otraVez.status === 400,
    'B2.38 Un cuestionario ya confirmado no se confirma dos veces -> 400',
    `status ${otraVez.status}`,
  );

  section('El cuestionario puede repetirse (§16)');
  const segunda = await req('POST', '/onboarding/runs', {
    token: ctx.est.token,
    body: { answers: responder(ctx.questionnaire, (x) => [x.options[x.options.length - 1].code]) },
  });
  check(
    segunda.status === 201 || segunda.status === 200,
    'B2.39 Se puede volver a responder',
    msgOf(segunda),
  );

  const historial = await req('GET', '/onboarding/me/history', { token: ctx.est.token });
  check(
    (historial.data ?? []).length === 2,
    'B2.40 El historial conserva la pasada anterior, no la pisa',
    `pasadas ${(historial.data ?? []).length}`,
  );
  check(
    (historial.data ?? []).filter((r) => r.status === 'superseded').length === 1,
    'B2.41 La anterior queda marcada como sustituida',
  );

  const viejo = await req('POST', `/onboarding/runs/${ctx.runId}/confirm`, {
    token: ctx.est.token,
    body: { academicAreaIds: [] },
  });
  check(
    viejo.status === 400,
    'B2.42 Una pasada sustituida ya no se confirma -> 400',
    `status ${viejo.status}`,
  );

  const ninguna = await req('POST', `/onboarding/runs/${segunda.data?.id}/confirm`, {
    token: ctx.est.token,
    body: { academicAreaIds: [] },
  });
  check(
    ninguna.status === 201 || ninguna.status === 200,
    'B2.43 «Ninguna de estas» es una respuesta válida y cierra el cuestionario',
    msgOf(ninguna),
  );

  section('El cuestionario es privado');
  const otroEstudiante = await req('POST', `/onboarding/runs/${segunda.data?.id}/confirm`, {
    token: ctx.otro.token,
    body: { academicAreaIds: [] },
  });
  check(
    otroEstudiante.status === 404,
    'B2.44 Otro estudiante no puede confirmar un cuestionario ajeno -> 404',
    `status ${otroEstudiante.status}`,
  );
}

// ===========================================================================
//  §21 · Autoevaluación y experiencia respaldada
// ===========================================================================
async function habilidades(ctx) {
  objective('§21 · Autoevaluación de tres niveles y experiencia respaldada');

  const catalogo = await req('GET', '/skills', { token: ctx.est.token });
  const skill = (catalogo.data ?? [])[0];
  check(!!skill, 'B2.45 Hay catálogo de habilidades');

  section('§21.1 · Tres niveles');
  const valido = await req('PUT', '/profiles/me/skills', {
    token: ctx.est.token,
    body: { items: [{ skillId: skill.id, level: 'intermediate' }] },
  });
  check(valido.status === 200, 'B2.46 Se acepta un nivel del vocabulario', msgOf(valido));

  const numerico = await req('PUT', '/profiles/me/skills', {
    token: ctx.est.token,
    body: { items: [{ skillId: skill.id, level: 4 }] },
  });
  check(
    numerico.status === 400,
    'B2.47 La escala numérica anterior ya no se acepta -> 400',
    `status ${numerico.status}`,
  );

  const inventado = await req('PUT', '/profiles/me/skills', {
    token: ctx.est.token,
    body: { items: [{ skillId: skill.id, level: 'experto' }] },
  });
  check(
    inventado.status === 400,
    'B2.48 Un nivel inventado se rechaza -> 400',
    `status ${inventado.status}`,
  );

  section('§21.2 · Lo declarado no se confunde con lo respaldado');
  const resumen = await req('GET', '/profiles/me/summary', { token: ctx.est.token });
  const fila = (resumen.data?.skills ?? [])[0];
  check(!!fila, 'B2.49 El resumen incluye la habilidad declarada');
  check(fila?.selfAssessed === true, 'B2.50 Va etiquetada como autodeclarada (§21.1)');
  check(
    fila?.backing && typeof fila.backing.total === 'number',
    'B2.51 Junto a ella viaja la experiencia que la respalda (§21.2)',
    JSON.stringify(fila?.backing ?? {}),
  );
  check(
    fila?.backing?.total === 0,
    'B2.52 Sin proyectos ni actividades, el respaldo es cero aunque el nivel sea alto',
    `respaldo ${fila?.backing?.total}`,
  );

  const proyecto = await req('POST', '/projects', {
    token: ctx.est.token,
    body: {
      title: `Proyecto de respaldo ${TS}`,
      description: 'Proyecto que usa explícitamente la tecnología declarada.',
      status: 'active',
      technologies: [skill.name],
      visibility: 'teachers',
    },
  });
  check(proyecto.status === 201, 'B2.53 El estudiante registra un proyecto con esa tecnología', msgOf(proyecto));

  const conRespaldo = await req('GET', '/profiles/me/summary', { token: ctx.est.token });
  const filaTras = (conRespaldo.data?.skills ?? []).find((s) => s.skillId === skill.id);
  check(
    (filaTras?.backing?.projects ?? 0) >= 1,
    'B2.54 El proyecto cuenta como respaldo de esa habilidad',
    `proyectos ${filaTras?.backing?.projects}`,
  );
  check(
    filaTras?.level === 'intermediate',
    'B2.55 El respaldo no altera la autoevaluación: son dos cosas distintas',
    `nivel ${filaTras?.level}`,
  );
}

// ===========================================================================
//  §20 · El área de mejora no suma afinidad
// ===========================================================================
async function areasDeMejora(ctx) {
  objective('§20 · Un área de mejora vale 0 puntos de afinidad');

  const areas = await req('GET', '/academic-areas', { token: ctx.est.token });
  const aislada = (areas.data ?? []).find(
    (a) => !(ctx.interesesActuales ?? []).includes(a.id),
  ) ?? (areas.data ?? [])[0];

  const antes = await req('GET', '/profiles/me/summary', { token: ctx.est.token });
  const puntajeAntes = (antes.data?.affinities ?? []).find(
    (a) => a.academicAreaId === aislada.id,
  )?.score ?? 0;

  await req('PATCH', '/profiles/me', {
    token: ctx.est.token,
    body: { improvementAreaIds: [aislada.id] },
  });

  const despues = await req('GET', '/profiles/me/summary', { token: ctx.est.token });
  const puntajeDespues = (despues.data?.affinities ?? []).find(
    (a) => a.academicAreaId === aislada.id,
  )?.score ?? 0;

  check(
    puntajeDespues === puntajeAntes,
    'B2.56 Declarar un área de mejora no mueve el puntaje de afinidad (§20)',
    `antes ${puntajeAntes} / después ${puntajeDespues}`,
  );
  check(
    (despues.data?.improvementAreas ?? []).some((a) => a.id === aislada.id),
    'B2.57 Pero el área sí queda registrada como objetivo personal',
  );
}

// ===========================================================================
//  §44 · Privacidad
// ===========================================================================
async function privacidad(ctx) {
  objective('§44 · El estudiante decide qué comparte');

  section('Por defecto no se comparte nada');
  const inicial = await req('GET', '/profiles/me/visibility', { token: ctx.est.token });
  check(inicial.status === 200, 'B2.58 El estudiante consulta su configuración', msgOf(inicial));
  check(
    inicial.data?.publicProfileEnabled === false,
    'B2.59 El perfil compartible nace desactivado: compartir es una decisión',
  );
  check(
    Object.values(inicial.data?.fields ?? {}).every((v) => v === false),
    'B2.60 Ningún campo se comparte por omisión',
    JSON.stringify(inicial.data?.fields ?? {}),
  );

  section('Cambiar la configuración');
  const activado = await req('PUT', '/profiles/me/visibility', {
    token: ctx.est.token,
    body: { publicProfileEnabled: true, fields: { bio: true, areas: true } },
  });
  check(activado.status === 200, 'B2.61 Activa su perfil compartible y elige campos', msgOf(activado));
  check(
    activado.data?.fields?.bio === true && activado.data?.fields?.areas === true,
    'B2.62 Los campos elegidos quedan activos',
  );
  check(
    activado.data?.fields?.projects === false,
    'B2.63 Los que no eligió siguen apagados',
  );

  section('Lo que nunca se comparte');
  const prohibido = await req('PUT', '/profiles/me/visibility', {
    token: ctx.est.token,
    body: { fields: { institutional_email: true, files: true } },
  });
  check(
    prohibido.status === 400,
    'B2.64 No existe forma de activar el correo institucional ni los archivos -> 400',
    `status ${prohibido.status}`,
  );
  check(
    Array.isArray(inicial.data?.neverShared) && inicial.data.neverShared.length > 0,
    'B2.65 El sistema declara explícitamente qué queda siempre fuera',
  );

  const ajena = await req('GET', '/profiles/me/visibility', { token: ctx.docente.token });
  check(
    ajena.status === 403,
    'B2.66 La privacidad es del estudiante: un docente no la consulta -> 403',
    `status ${ajena.status}`,
  );
}

// ===========================================================================
//  Preparación
// ===========================================================================
async function preparar() {
  console.log(`${C.bold}BATCH 2 — Perfil y onboarding contra ${API}${C.r}`);
  const admin = await loginAdmin();

  const est = await provisionAndActivate(admin, {
    firstName: 'Renata',
    lastName: 'Bustillos',
    email: correo('est'),
    role: 'STUDENT',
  });
  const otro = await provisionAndActivate(admin, {
    firstName: 'Tomas',
    lastName: 'Zeballos',
    email: correo('otro'),
    role: 'STUDENT',
  });
  await req('POST', '/profiles/me', { token: otro.token, body: {} });

  const docente = await provisionAndActivate(admin, {
    firstName: 'Nuria',
    lastName: 'Ballivian',
    email: `b2.doc.${TS}@univalle.edu`,
    role: 'TEACHER',
  });

  return { admin, est, otro, docente };
}

async function main() {
  try {
    const ctx = await preparar();
    await datosInstitucionales(ctx);
    await cuestionario(ctx);
    await confirmacion(ctx);
    await habilidades(ctx);
    await areasDeMejora(ctx);
    await privacidad(ctx);
  } catch (error) {
    console.error(`\n${C.bad}Error durante la ejecución:${C.r} ${error.message}`);
    process.exitCode = 1;
    return;
  }

  console.log(`\n${'-'.repeat(78)}`);
  if (failures.length === 0) {
    console.log(`${C.ok}${C.bold}  ${passed} verificaciones OK · 0 fallos${C.r}`);
    console.log('  El BATCH 2 queda demostrado de punta a punta.');
  } else {
    console.log(`${C.bad}${C.bold}  ${passed} verificaciones OK · ${failures.length} fallos${C.r}`);
    failures.forEach((f) => console.log(`  ${C.bad}·${C.r} ${f}`));
    process.exitCode = 1;
  }
}

void PWD;
main();
