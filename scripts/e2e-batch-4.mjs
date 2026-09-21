/**
 * BATCH 4 — Actividades.
 *
 * Cubre §22 (gestores, campos y máquina de estados), §23 (participación y
 * confirmación), §24 y §55 (constancias sin doble conteo) y §73.3 (habilidades
 * por actividad).
 *
 * Uso:
 *   API_URL=http://localhost:3010/api node scripts/e2e-batch-4.mjs
 */

import { API, loginAdmin, provisionAndActivate, req } from './lib/fixtures.mjs';

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

const correoEst = (k) => `b4.${k}.${TS}@est.univalle.edu`;
const correoStaff = (k) => `b4.${k}.${TS}@univalle.edu`;

// ===========================================================================
//  §22 · Quién gestiona, y hasta dónde
// ===========================================================================
async function gestores(ctx) {
  objective('§22 · El docente gestiona actividades académicas dentro de su alcance');

  section('Crear dentro del alcance');
  const propia = await req('POST', '/activities', {
    token: ctx.docente4.token,
    body: {
      title: `Taller del docente ${TS}`,
      type: 'academica',
      categoryId: ctx.categoria.id,
      areaId: ctx.area.id,
      semesterScope: [4],
    },
  });
  check(propia.status === 201, 'B4.1 El docente crea una actividad académica en su semestre', msgOf(propia));
  ctx.actividadDocente = propia.data;
  check(
    JSON.stringify(propia.data?.semesterScope) === '[4]',
    'B4.2 El alcance por semestre queda registrado (§22)',
    JSON.stringify(propia.data?.semesterScope),
  );
  check(
    propia.data?.responsibleUserId === ctx.docente4.userId,
    'B4.3 Queda como responsable, no solo como creador (§22)',
    String(propia.data?.responsibleUserId),
  );

  section('El alcance es un límite, no una etiqueta');
  const fuera = await req('POST', '/activities', {
    token: ctx.docente4.token,
    body: {
      title: `Fuera de alcance ${TS}`,
      type: 'academica',
      categoryId: ctx.categoria.id,
      semesterScope: [8],
    },
  });
  check(
    fuera.status === 403,
    'B4.4 No puede dirigirla a un semestre fuera de su alcance -> 403',
    `status ${fuera.status}`,
  );

  const mezclado = await req('POST', '/activities', {
    token: ctx.docente4.token,
    body: {
      title: `Mitad y mitad ${TS}`,
      type: 'academica',
      categoryId: ctx.categoria.id,
      semesterScope: [4, 8],
    },
  });
  check(
    mezclado.status === 403,
    'B4.5 Tampoco si mezcla uno suyo con uno ajeno -> 403',
    `status ${mezclado.status}`,
  );

  const extracurricular = await req('POST', '/activities', {
    token: ctx.docente4.token,
    body: {
      title: `Extra del docente ${TS}`,
      type: 'extracurricular',
      categoryId: ctx.categoriaExtra.id,
    },
  });
  check(
    extracurricular.status === 403,
    'B4.6 Las extracurriculares son de la sociedad científica -> 403',
    `status ${extracurricular.status}`,
  );

  const sinAlcance = await req('POST', '/activities', {
    token: ctx.docenteSin.token,
    body: {
      title: `Sin alcance ${TS}`,
      type: 'academica',
      categoryId: ctx.categoria.id,
      semesterScope: [4],
    },
  });
  check(
    sinAlcance.status === 403,
    'B4.7 Un docente sin semestres habilitados no gestiona nada -> 403',
    `status ${sinAlcance.status}`,
  );

  section('Gestionar lo ajeno');
  const delDirector = await req('POST', '/activities', {
    token: ctx.director.token,
    body: {
      title: `De carrera ${TS}`,
      type: 'academica',
      categoryId: ctx.categoria.id,
      areaId: ctx.area.id,
    },
  });
  check(delDirector.status === 201, 'B4.8 El director crea una actividad de carrera', msgOf(delDirector));
  ctx.actividadCarrera = delDirector.data;
  check(
    delDirector.data?.semesterScope === null,
    'B4.9 Una actividad de carrera no declara semestres: es de toda la carrera',
    JSON.stringify(delDirector.data?.semesterScope),
  );

  const intento = await req('PATCH', `/activities/${ctx.actividadCarrera.id}`, {
    token: ctx.docente4.token,
    body: { title: 'Secuestrada' },
  });
  check(
    intento.status === 403,
    'B4.10 Un docente NO gestiona una actividad de toda la carrera -> 403',
    `status ${intento.status}`,
  );

  const otroDocente = await req('PATCH', `/activities/${ctx.actividadDocente.id}`, {
    token: ctx.docente7.token,
    body: { title: 'De otro semestre' },
  });
  check(
    otroDocente.status === 403,
    'B4.11 Un docente de otro semestre tampoco la gestiona -> 403',
    `status ${otroDocente.status}`,
  );

  const mismoAlcance = await req('PATCH', `/activities/${ctx.actividadDocente.id}`, {
    token: ctx.docenteTambien4.token,
    body: { requirements: 'Traer computadora.' },
  });
  check(
    mismoAlcance.status === 200,
    'B4.12 Otro docente del mismo semestre sí la gestiona: el alcance es compartido',
    `status ${mismoAlcance.status} ${msgOf(mismoAlcance)}`,
  );

  const ampliar = await req('PATCH', `/activities/${ctx.actividadDocente.id}`, {
    token: ctx.docente4.token,
    body: { semesterScope: [4, 7] },
  });
  check(
    ampliar.status === 403,
    'B4.13 No puede ampliar el alcance hasta abarcar semestres ajenos -> 403',
    `status ${ampliar.status}`,
  );
}

// ===========================================================================
//  §22 · Campos y máquina de estados
// ===========================================================================
async function maquinaDeEstados(ctx) {
  objective('§22 · Máquina de estados explícita');

  const id = ctx.actividadDocente.id;
  const cambiar = (token, status) =>
    req('PATCH', `/activities/${id}`, { token, body: { status } });

  section('Transiciones válidas');
  const abierta = await cambiar(ctx.docente4.token, 'open');
  check(
    abierta.status === 200 && abierta.data?.status === 'open',
    'B4.14 De borrador a inscripciones abiertas',
    msgOf(abierta),
  );

  const cerrada = await cambiar(ctx.docente4.token, 'closed');
  check(cerrada.data?.status === 'closed', 'B4.15 Se cierran las inscripciones');

  const reabierta = await cambiar(ctx.docente4.token, 'open');
  check(
    reabierta.data?.status === 'open',
    'B4.16 Se pueden reabrir: cerrar y reabrir es una decisión ordinaria',
  );

  section('Transiciones que no existen');
  const borrador = await cambiar(ctx.docente4.token, 'draft');
  check(
    borrador.status === 400,
    'B4.17 De inscripciones abiertas NO se vuelve a borrador -> 400',
    `status ${borrador.status} ${msgOf(borrador)}`,
  );
  check(
    msgOf(borrador).includes('No se puede pasar'),
    'B4.18 El rechazo dice exactamente qué transición no existe',
    msgOf(borrador),
  );

  section('Estados finales');
  const otra = await req('POST', '/activities', {
    token: ctx.director.token,
    body: {
      title: `Para cancelar ${TS}`,
      type: 'academica',
      categoryId: ctx.categoria.id,
    },
  });
  const cancelada = await req('PATCH', `/activities/${otra.data.id}`, {
    token: ctx.director.token,
    body: { status: 'cancelled' },
  });
  check(cancelada.data?.status === 'cancelled', 'B4.19 Una actividad se puede cancelar');

  const resucitar = await req('PATCH', `/activities/${otra.data.id}`, {
    token: ctx.director.token,
    body: { status: 'open' },
  });
  check(
    resucitar.status === 400,
    'B4.20 Una actividad cancelada ya no cambia de estado -> 400',
    `status ${resucitar.status} ${msgOf(resucitar)}`,
  );

  section('Ventana de fechas (§22)');
  const alReves = await req('POST', '/activities', {
    token: ctx.director.token,
    body: {
      title: `Fechas al reves ${TS}`,
      type: 'academica',
      categoryId: ctx.categoria.id,
      activityDate: '2026-05-10T10:00:00.000Z',
      endAt: '2026-05-09T10:00:00.000Z',
    },
  });
  check(
    alReves.status === 400,
    'B4.21 El fin no puede ser anterior al inicio -> 400',
    `status ${alReves.status}`,
  );
}

// ===========================================================================
//  §73.3 · Habilidades por actividad
// ===========================================================================
async function habilidades(ctx) {
  objective('§73.3 · La actividad declara qué habilidades trabaja');

  const conSkills = await req('POST', '/activities', {
    token: ctx.director.token,
    body: {
      title: `Taller con habilidades ${TS}`,
      type: 'academica',
      categoryId: ctx.categoria.id,
      areaId: ctx.area.id,
      skillIds: ctx.skills.slice(0, 2).map((s) => s.id),
      // Publicada: un estudiante no ve borradores, y es el estudiante
      // quien necesita saber que trabaja la actividad.
      status: 'open',
    },
  });
  check(conSkills.status === 201, 'B4.22 Se crea declarando habilidades', msgOf(conSkills));
  ctx.actividadConSkills = conSkills.data;

  const detalle = await req('GET', `/activities/${conSkills.data.id}`, {
    token: ctx.est.token,
  });
  const declaradas = detalle.data?.activitySkills ?? detalle.data?.skills ?? [];
  check(
    declaradas.length === 2,
    'B4.23 El detalle publica las habilidades declaradas',
    `declaradas ${declaradas.length}`,
  );

  const inventada = await req('POST', '/activities', {
    token: ctx.director.token,
    body: {
      title: `Habilidad inventada ${TS}`,
      type: 'academica',
      categoryId: ctx.categoria.id,
      skillIds: ['00000000-0000-4000-8000-000000000000'],
    },
  });
  check(
    inventada.status === 400,
    'B4.24 Una habilidad que no existe se rechaza -> 400',
    `status ${inventada.status}`,
  );

  const reemplazo = await req('PATCH', `/activities/${conSkills.data.id}`, {
    token: ctx.director.token,
    body: { skillIds: [ctx.skills[0].id] },
  });
  check(reemplazo.status === 200, 'B4.25 Se pueden cambiar las habilidades', msgOf(reemplazo));

  const tras = await req('GET', `/activities/${conSkills.data.id}`, { token: ctx.est.token });
  const ahora = tras.data?.activitySkills ?? tras.data?.skills ?? [];
  check(
    ahora.length === 1,
    'B4.26 El cambio reemplaza, no acumula',
    `declaradas ${ahora.length}`,
  );
}

// ===========================================================================
//  §23 · Participación
// ===========================================================================
async function participacion(ctx) {
  objective('§23 · Intención, inscripción y experiencia son cosas distintas');

  const id = ctx.actividadDocente.id;

  section('El estudiante se inscribe');
  const interes = await req('POST', `/activities/${id}/register-interest`, { token: ctx.est.token });
  check(interes.status === 201 || interes.status === 200, 'B4.27 Manifiesta interés', msgOf(interes));

  const inscripcion = await req('POST', `/activities/${id}/register`, { token: ctx.est.token });
  check(
    (inscripcion.status === 201 || inscripcion.status === 200)
      && inscripcion.data?.status === 'registered',
    'B4.28 Se inscribe',
    msgOf(inscripcion),
  );

  section('Inscribirse no es haber ido (§23)');
  const antes = await req('GET', '/profiles/me/summary', { token: ctx.est.token });
  const puntajeAntes = (antes.data?.affinities ?? []).find(
    (a) => a.academicAreaId === ctx.area.id,
  )?.score ?? 0;

  section('El estudiante se da de baja');
  const baja = await req('POST', `/activities/${id}/cancel-registration`, { token: ctx.est.token });
  check(
    (baja.status === 201 || baja.status === 200) && baja.data?.status === 'cancelled',
    'B4.29 Puede darse de baja antes de que le confirmen (§23)',
    msgOf(baja),
  );

  const otraVez = await req('POST', `/activities/${id}/register`, { token: ctx.est.token });
  check(
    otraVez.status === 201 || otraVez.status === 200,
    'B4.30 Y volver a inscribirse después',
    msgOf(otraVez),
  );

  section('Solo el responsable confirma (§23)');
  const porOtro = await req('PATCH', `/activities/${id}/confirm-participation`, {
    token: ctx.docente7.token,
    body: { studentProfileId: ctx.est.profileId, status: 'confirmed' },
  });
  check(
    porOtro.status === 403,
    'B4.31 Un docente fuera del alcance no confirma -> 403',
    `status ${porOtro.status}`,
  );

  const porElEstudiante = await req('PATCH', `/activities/${id}/confirm-participation`, {
    token: ctx.est.token,
    body: { studentProfileId: ctx.est.profileId, status: 'confirmed' },
  });
  check(
    porElEstudiante.status === 403,
    'B4.32 Un estudiante no se confirma a sí mismo -> 403',
    `status ${porElEstudiante.status}`,
  );

  const confirmada = await req('PATCH', `/activities/${id}/confirm-participation`, {
    token: ctx.docente4.token,
    body: { studentProfileId: ctx.est.profileId, status: 'confirmed' },
  });
  check(
    confirmada.status === 200 && confirmada.data?.status === 'confirmed',
    'B4.33 El docente responsable sí confirma',
    msgOf(confirmada),
  );

  section('Confirmar sí es experiencia');
  const despues = await req('GET', '/profiles/me/summary', { token: ctx.est.token });
  const puntajeDespues = (despues.data?.affinities ?? []).find(
    (a) => a.academicAreaId === ctx.area.id,
  )?.score ?? 0;
  check(
    puntajeDespues > puntajeAntes,
    'B4.34 La participación confirmada sí alimenta la afinidad (§23)',
    `antes ${puntajeAntes} / después ${puntajeDespues}`,
  );
  ctx.puntajeConParticipacion = puntajeDespues;

  const bajaTardia = await req('POST', `/activities/${id}/cancel-registration`, {
    token: ctx.est.token,
  });
  check(
    bajaTardia.status === 400,
    'B4.35 Ya confirmada, el estudiante no puede borrar su experiencia -> 400',
    `status ${bajaTardia.status}`,
  );

  section('Queda constancia de quién confirmó (§23)');
  const bitacora = await req(
    'GET',
    `/audit/events?eventType=PARTICIPATION_CONFIRMED&entityType=activity_registration&limit=20`,
    { token: ctx.admin },
  );
  check(
    (bitacora.data ?? []).some((e) => e.actorUserId === ctx.docente4.userId),
    'B4.36 La confirmación queda auditada con su autor',
    `eventos ${(bitacora.data ?? []).length}`,
  );
}

// ===========================================================================
//  §24 y §55 · La constancia respalda, no duplica
// ===========================================================================
async function constancias(ctx) {
  objective('§24 y §55 · Una constancia respalda la participación, no la repite');

  const registros = await req('GET', `/activities/${ctx.actividadDocente.id}/participants`, {
    token: ctx.docente4.token,
  });
  const registro = (registros.data ?? []).find((r) => r.studentProfileId === ctx.est.profileId);
  check(!!registro, 'B4.37 El responsable ve el registro del estudiante');

  const emitida = await req('POST', '/constancies/internal', {
    token: ctx.director.token,
    body: {
      profileId: ctx.est.profileId,
      activityId: ctx.actividadDocente.id,
      description: `Constancia de participación ${TS}`,
    },
  });
  check(
    emitida.status === 201,
    'B4.38 La dirección emite la constancia interna',
    msgOf(emitida),
  );
  check(
    emitida.data?.activityRegistrationId === registro.id,
    'B4.39 Queda vinculada a la inscripción concreta, no solo a la actividad (§24)',
    `esperado ${registro.id} / recibido ${emitida.data?.activityRegistrationId}`,
  );

  const tras = await req('GET', '/profiles/me/summary', { token: ctx.est.token });
  const puntajeTras = (tras.data?.affinities ?? []).find(
    (a) => a.academicAreaId === ctx.area.id,
  )?.score ?? 0;
  check(
    puntajeTras === ctx.puntajeConParticipacion,
    'B4.40 La constancia NO vuelve a sumar lo que la participación ya aportó (§24, §55)',
    `con participación ${ctx.puntajeConParticipacion} / con constancia ${puntajeTras}`,
  );

  const desglose = await req('GET', `/affinity/me/areas/${ctx.area.id}/breakdown`, { token: ctx.est.token });
  const lineas = desglose.data?.contributions ?? [];
  check(
    lineas.some((c) => c.signalType === 'constancy'),
    'B4.41 Pero sí aparece en el desglose: aumenta trazabilidad (§24)',
    lineas.map((c) => c.signalType).join(','),
  );
  check(
    lineas.filter((c) => c.signalType === 'constancy').every((c) => c.points === 0),
    'B4.42 Con cero puntos, que es exactamente lo que significa «respalda, no suma»',
    JSON.stringify(lineas.filter((c) => c.signalType === 'constancy').map((c) => c.points)),
  );

  const suma = lineas.reduce((acc, c) => acc + c.points, 0);
  check(
    suma === desglose.data?.score,
    'B4.43 INVARIANTE: la suma del desglose sigue siendo el puntaje del área',
    `suma ${suma} vs puntaje ${desglose.data?.score}`,
  );
}

// ===========================================================================
//  §23 · Interés e inscripción valen cero
// ===========================================================================
async function intencionNoEsExperiencia(ctx) {
  objective('§23 · Interés e inscripción no son experiencia');

  // Un estudiante limpio y un área limpia: así el efecto se aísla.
  const actividad = await req('POST', '/activities', {
    token: ctx.director.token,
    body: {
      title: `Solo intención ${TS}`,
      type: 'academica',
      categoryId: ctx.categoria.id,
      areaId: ctx.areaAislada.id,
      status: 'open',
    },
  });
  check(actividad.status === 201, 'B4.44 Se publica una actividad en un área aislada', msgOf(actividad));

  const antes = await req('GET', '/profiles/me/summary', { token: ctx.est2.token });
  const antesPts = (antes.data?.affinities ?? []).find(
    (a) => a.academicAreaId === ctx.areaAislada.id,
  )?.score ?? 0;

  await req('POST', `/activities/${actividad.data.id}/register-interest`, { token: ctx.est2.token });
  const conInteres = await req('GET', '/profiles/me/summary', { token: ctx.est2.token });
  const interesPts = (conInteres.data?.affinities ?? []).find(
    (a) => a.academicAreaId === ctx.areaAislada.id,
  )?.score ?? 0;
  check(
    interesPts === antesPts,
    'B4.45 Manifestar interés no suma afinidad: es intención (§23)',
    `antes ${antesPts} / con interés ${interesPts}`,
  );

  await req('POST', `/activities/${actividad.data.id}/register`, { token: ctx.est2.token });
  const conInscripcion = await req('GET', '/profiles/me/summary', { token: ctx.est2.token });
  const inscripcionPts = (conInscripcion.data?.affinities ?? []).find(
    (a) => a.academicAreaId === ctx.areaAislada.id,
  )?.score ?? 0;
  check(
    inscripcionPts === antesPts,
    'B4.46 Inscribirse tampoco: sigue sin haber ido (§23)',
    `antes ${antesPts} / inscrito ${inscripcionPts}`,
  );

  const confirmada = await req('PATCH', `/activities/${actividad.data.id}/confirm-participation`, {
    token: ctx.director.token,
    body: { studentProfileId: ctx.est2.profileId, status: 'confirmed' },
  });
  check(confirmada.status === 200, 'B4.47 El director confirma la participación', msgOf(confirmada));

  const conParticipacion = await req('GET', '/profiles/me/summary', { token: ctx.est2.token });
  const finalPts = (conParticipacion.data?.affinities ?? []).find(
    (a) => a.academicAreaId === ctx.areaAislada.id,
  )?.score ?? 0;
  check(
    finalPts > antesPts,
    'B4.48 Confirmar sí suma: ahí hubo experiencia (§23)',
    `antes ${antesPts} / confirmado ${finalPts}`,
  );
}

// ===========================================================================
async function preparar() {
  console.log(`${C.bold}BATCH 4 — Actividades contra ${API}${C.r}`);
  const admin = await loginAdmin();

  const categorias = (await req('GET', '/activity-categories', { token: admin })).data ?? [];
  const categoria = categorias.find((c) => c.appliesTo !== 'extracurricular') ?? categorias[0];
  const categoriaExtra = categorias.find((c) => c.appliesTo !== 'academica') ?? categorias[0];

  const areas = (await req('GET', '/academic-areas', { token: admin })).data ?? [];
  const skills = (await req('GET', '/skills', { token: admin })).data ?? [];

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

  return {
    admin,
    categoria,
    categoriaExtra,
    area: areas[0],
    // Un área distinta de la principal, para poder aislar el efecto de una
    // sola señal sin que lo tape lo que el estudiante ya tenga.
    areaAislada: areas[areas.length - 1],
    skills,
    docente4: await staff('doc4', 'Nuria', 'Ballivian', 'TEACHER', [4]),
    docenteTambien4: await staff('doc4b', 'Ramiro', 'Soliz', 'TEACHER', [4]),
    docente7: await staff('doc7', 'Cecilia', 'Aramayo', 'TEACHER', [7]),
    docenteSin: await staff('docSin', 'Hugo', 'Peredo', 'TEACHER', null),
    director: await staff('dir', 'Elsa', 'Montano', 'CAREER_DIRECTOR', null),
    est: await estudiante('est', 'Renata', 'Bustillos', 4),
    est2: await estudiante('est2', 'Tomas', 'Zeballos', 4),
  };
}

async function main() {
  try {
    const ctx = await preparar();
    await gestores(ctx);
    await maquinaDeEstados(ctx);
    await habilidades(ctx);
    await participacion(ctx);
    await constancias(ctx);
    await intencionNoEsExperiencia(ctx);
  } catch (error) {
    console.error(`\n${C.bad}Error durante la ejecución:${C.r} ${error.message}`);
    process.exitCode = 1;
    return;
  }

  console.log(`\n${'-'.repeat(78)}`);
  if (failures.length === 0) {
    console.log(`${C.ok}${C.bold}  ${passed} verificaciones OK · 0 fallos${C.r}`);
    console.log('  El BATCH 4 queda demostrado de punta a punta.');
  } else {
    console.log(`${C.bad}${C.bold}  ${passed} verificaciones OK · ${failures.length} fallos${C.r}`);
    failures.forEach((f) => console.log(`  ${C.bad}·${C.r} ${f}`));
    process.exitCode = 1;
  }
}

main();
