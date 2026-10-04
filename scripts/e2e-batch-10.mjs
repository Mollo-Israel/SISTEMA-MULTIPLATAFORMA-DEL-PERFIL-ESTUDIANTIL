/**
 * BATCH 10 — Reportes y analítica.
 *
 * Cubre §63 (evolución descriptiva), §64 (tendencias sin lenguaje predictivo),
 * §65 (umbral de privacidad y qué ve cada rol), §68 (TeacherScope restringe el
 * contenido, no solo el endpoint) y §69 (reportes de dirección).
 *
 * Uso:
 *   API_URL=http://localhost:3010/api node scripts/e2e-batch-10.mjs
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

const correoEst = (k) => `b10.${k}.${TS}@est.univalle.edu`;
const correoStaff = (k) => `b10.${k}.${TS}@univalle.edu`;

/** Palabras que §63 y §64 prohíben en un reporte descriptivo. */
const PREDICTIVAS = [
  'predic', 'proyecc', 'pronóstic', 'pronostic', 'estimación futura',
  'abandono', 'deserción', 'desercion', 'probabilidad de aprobar',
  'rendimiento académico esperado', 'éxito profesional',
];

// ===========================================================================
//  §63 · Evolución del estudiante
// ===========================================================================
async function evolucion(ctx) {
  objective('§63 · La evolución describe lo que pasó, no lo que va a pasar');

  const propia = await req('GET', '/reports/me/evolution', { token: ctx.est.token });
  check(propia.status === 200, 'B10.1 El estudiante consulta su evolución', msgOf(propia));

  const periodos = propia.data?.periods ?? [];
  check(
    periodos.length >= 2,
    'B10.2 Hay al menos dos cálculos registrados: sin eso no hay evolución',
    `periodos ${periodos.length}`,
  );

  // El primer cálculo de un perfil puede no tener áreas todavía; lo que
  // interesa comprobar es la forma de un punto que sí las tiene.
  const primero = periodos.find((p) => (p.areas ?? []).length > 0) ?? periodos[0];
  const area = (primero?.areas ?? [])[0];
  check(
    !!area
      && area.affinityScore !== undefined
      && area.supportScore !== undefined
      && area.supportLevel !== undefined,
    'B10.3 Cada punto trae lo que §63 enumera: área, afinidad, respaldo y nivel',
    JSON.stringify(area),
  );
  check(
    !!primero?.period,
    'B10.4 Y su periodo',
    String(primero?.period),
  );

  check(
    Array.isArray(propia.data?.areas) && propia.data.areas.length > 0,
    'B10.5 También se puede leer por área, que es como se mira una evolución',
    String(propia.data?.areas?.length),
  );

  section('§63 · Sin lenguaje predictivo');
  // La nota se examina aparte: es justo donde la palabra «predicen» tiene que
  // aparecer, porque su trabajo es decir que esto no predice nada.
  const { note: _nota, ...datos } = propia.data ?? {};
  const texto = JSON.stringify(datos).toLowerCase();
  const encontradas = PREDICTIVAS.filter((p) => texto.includes(p));
  check(
    encontradas.length === 0,
    'B10.6 No aparece ninguna palabra predictiva (§63)',
    encontradas.join(', '),
  );
  check(
    (propia.data?.note?.scope ?? '').includes('no predicen'),
    'B10.7 Y la respuesta dice explícitamente qué no es',
    String(propia.data?.note?.scope),
  );

  section('§68 · La evolución ajena, solo dentro del alcance');
  const suyo = await req('GET', `/reports/student/${ctx.est.profileId}/evolution`, {
    token: ctx.docente.token,
  });
  check(
    suyo.status === 200,
    'B10.8 El docente ve la evolución de un estudiante de su semestre',
    msgOf(suyo),
  );

  const ajeno = await req('GET', `/reports/student/${ctx.estOtro.profileId}/evolution`, {
    token: ctx.docente.token,
  });
  check(
    ajeno.status === 403 || ajeno.status === 404,
    'B10.9 Y NO la de uno fuera de su alcance (§68)',
    `status ${ajeno.status}`,
  );

  const porEstudiante = await req('GET', `/reports/student/${ctx.estOtro.profileId}/evolution`, {
    token: ctx.est.token,
  });
  check(
    porEstudiante.status === 403,
    'B10.10 Un estudiante no consulta la evolución de otro -> 403',
    `status ${porEstudiante.status}`,
  );
}

// ===========================================================================
//  §65 · Umbral de privacidad
// ===========================================================================
async function umbral(ctx) {
  objective('§65 · Un agregado de dos personas no es un agregado');

  const mapa = await req('GET', '/reports/director/affinity-map', {
    token: ctx.director.token,
  });
  check(mapa.status === 200, 'B10.11 La dirección consulta el mapa de áreas', msgOf(mapa));
  check(
    mapa.data?.note?.minGroupSize === 5,
    'B10.12 El umbral configurado viaja en la respuesta (§65)',
    String(mapa.data?.note?.minGroupSize),
  );

  section('El área del escenario tiene dos estudiantes');
  const areas = mapa.data?.areas ?? [];
  const nuestra = areas.find((a) => a.area === ctx.area.name);
  check(!!nuestra, 'B10.13 El área aparece en el mapa', JSON.stringify(areas.slice(0, 2)));
  check(
    nuestra?.suppressed === true,
    'B10.14 Pero su desglose NO se publica: son menos de cinco (§65)',
    JSON.stringify(nuestra),
  );
  check(
    nuestra?.students === 2 && nuestra?.area === ctx.area.name,
    'B10.15 Se conserva el grupo y su tamaño: la dirección necesita saber que existe',
    JSON.stringify(nuestra),
  );
  check(
    nuestra?.averageAffinity === undefined && nuestra?.bySupportLevel === undefined,
    'B10.16 Y se suprime lo que permitiría deducir a una persona (§65)',
    JSON.stringify(Object.keys(nuestra ?? {})),
  );
  check(
    typeof nuestra?.reason === 'string' && nuestra.reason.includes('5'),
    'B10.17 Con el motivo escrito, en vez de un hueco sin explicar',
    String(nuestra?.reason),
  );

  section('Un área con muchos estudiantes sí se desglosa');
  const grande = areas.find((a) => !a.suppressed && a.students >= 5);
  check(
    !!grande && grande.averageAffinity !== undefined,
    'B10.18 Por encima del umbral, el desglose se publica normalmente',
    JSON.stringify(grande ?? null),
  );
  check(
    !!grande?.bySupportLevel,
    'B10.19 Con afinidad y respaldo juntos (§69)',
    JSON.stringify(grande?.bySupportLevel),
  );
}

// ===========================================================================
//  §64 · Tendencias descriptivas
// ===========================================================================
async function tendencias(ctx) {
  objective('§64 · Las cinco tendencias, y ninguna predicción');

  const t = await req('GET', '/reports/director/trends', { token: ctx.director.token });
  check(t.status === 200, 'B10.20 La dirección consulta las tendencias', msgOf(t));

  check(Array.isArray(t.data?.interestByArea), 'B10.21 Evolución de interés por área (§64)');
  check(Array.isArray(t.data?.participation), 'B10.22 Evolución de participación (§64)');
  check(Array.isArray(t.data?.areasBySemester), 'B10.23 Áreas predominantes por semestre (§64)');
  check(Array.isArray(t.data?.technologies), 'B10.24 Tecnologías más presentes (§64)');
  check(Array.isArray(t.data?.activities), 'B10.25 Actividades con mayor participación (§64)');

  const { note: _n, ...datosTendencias } = t.data ?? {};
  const texto = JSON.stringify(datosTendencias).toLowerCase();
  const encontradas = PREDICTIVAS.filter((p) => texto.includes(p));
  check(
    encontradas.length === 0,
    'B10.26 Ninguna palabra predictiva en todo el reporte (§64)',
    encontradas.join(', '),
  );

  section('§65 · El umbral también aquí');
  const semestres = t.data?.areasBySemester ?? [];
  const pequenos = semestres.filter((s) => s.students < 5);
  check(
    pequenos.every((s) => s.suppressed === true),
    'B10.27 Los semestres con menos de cinco estudiantes no se desglosan (§65)',
    JSON.stringify(pequenos.map((s) => [s.semester, s.students, s.suppressed])),
  );
  check(
    pequenos.every((s) => s.areas === undefined),
    'B10.28 Sus áreas predominantes no viajan: con dos, dicen quién es quién',
  );

  section('Quién puede pedirlas');
  const porDocente = await req('GET', '/reports/director/trends', { token: ctx.docente.token });
  check(
    porDocente.status === 403,
    'B10.29 Un docente no consulta las tendencias de la carrera -> 403',
    `status ${porDocente.status}`,
  );
  const porEstudiante = await req('GET', '/reports/director/trends', { token: ctx.est.token });
  check(
    porEstudiante.status === 403,
    'B10.30 Un estudiante tampoco -> 403',
    `status ${porEstudiante.status}`,
  );
}

// ===========================================================================
//  §68 · El alcance restringe el contenido
// ===========================================================================
async function alcanceDocente(ctx) {
  objective('§68 · No basta con proteger el endpoint: hay que restringir el contenido');

  const conAlcance = await req('GET', '/reports/teacher/support-summary', {
    token: ctx.docente.token,
  });
  check(conAlcance.status === 200, 'B10.31 El docente consulta el respaldo de su grupo',
    msgOf(conAlcance));
  check(
    JSON.stringify(conAlcance.data?.semesters) === JSON.stringify([6]),
    'B10.32 Y la respuesta declara a qué semestres se limita (§68)',
    JSON.stringify(conAlcance.data?.semesters),
  );

  const sinAlcance = await req('GET', '/reports/teacher/support-summary', {
    token: ctx.docenteSinAlcance.token,
  });
  check(
    sinAlcance.status === 200,
    'B10.33 Un docente sin semestres asignados recibe respuesta, no un error',
    `status ${sinAlcance.status}`,
  );
  check(
    (sinAlcance.data?.areas ?? []).length === 0
      && sinAlcance.data?.projects?.total === 0,
    'B10.34 Pero vacía: sin alcance no ve la carrera entera (§68)',
    JSON.stringify(sinAlcance.data?.projects),
  );

  section('El panel del docente ya filtraba, y se comprueba');
  const overview = await req('GET', '/reports/teacher/overview', { token: ctx.docente.token });
  const overviewSin = await req('GET', '/reports/teacher/overview', {
    token: ctx.docenteSinAlcance.token,
  });
  check(
    overviewSin.data?.students?.total === 0,
    'B10.35 Sin alcance, el panel no cuenta ningún estudiante (§68)',
    String(overviewSin.data?.students?.total),
  );
  check(
    (overview.data?.students?.total ?? 0) > 0
      && overview.data.students.total < 900,
    'B10.36 Con alcance, cuenta los suyos y no los 869 de la carrera',
    String(overview.data?.students?.total),
  );
}

// ===========================================================================
//  §65 · Sociedad científica
// ===========================================================================
async function sociedad(ctx) {
  objective('§65 · La sociedad ve las métricas de sus actividades, y nada más');

  const suyas = await req('GET', '/reports/society/activities', { token: ctx.sociedad.token });
  check(suyas.status === 200, 'B10.37 La sociedad consulta sus métricas', msgOf(suyas));
  check(
    suyas.data?.totals?.activities === 1,
    'B10.38 Aparece la actividad que organizó',
    String(suyas.data?.totals?.activities),
  );
  check(
    !(suyas.data?.activities ?? []).some((a) => a.title?.includes('Taller del docente')),
    'B10.39 Y NO las de otros: §65 le concede las suyas (§65)',
    JSON.stringify((suyas.data?.activities ?? []).map((a) => a.title)),
  );

  const texto = JSON.stringify(suyas.data);
  check(
    !texto.includes('affinity') && !texto.includes('afinidad'),
    'B10.40 Sin afinidades: no forman parte de lo que §65 le concede',
  );
  check(
    !texto.includes('@'),
    'B10.41 Ni correos de quienes se inscribieron',
  );

  const porDocente = await req('GET', '/reports/society/activities', { token: ctx.docente.token });
  check(
    porDocente.status === 403,
    'B10.42 Un docente no entra por esta puerta -> 403',
    `status ${porDocente.status}`,
  );
}

// ===========================================================================
//  Preparación
// ===========================================================================
async function preparar() {
  console.log(`${C.bold}BATCH 10 — Reportes y analítica contra ${API}${C.r}`);
  const admin = await loginAdmin();

  const area = (await req('POST', '/academic-areas', {
    token: admin,
    body: {
      name: `Vision por Computadora ${TS}`,
      description: 'Área del escenario de analítica.',
      tags: ['opencv'],
    },
  })).data;
  if (!area?.id) throw new Error('No se pudo crear el área del escenario.');

  const categorias = (await req('GET', '/activity-categories', { token: admin })).data ?? [];
  const taller = categorias.find((c) => c.code === 'taller_academico');
  const convocatoria = categorias.find((c) => c.code === 'convocatoria');
  if (!taller || !convocatoria) throw new Error('Faltan categorías del catálogo.');

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

  const docente = await staff('doc', 'Elena', 'Antezana', 'TEACHER', [6]);
  const docenteSinAlcance = await staff('docSin', 'Raul', 'Camacho', 'TEACHER', null);
  const director = await staff('dir', 'Teresa', 'Ovando', 'CAREER_DIRECTOR', null);
  const sociedad = await staff('soc', 'Ignacio', 'Prado', 'SCIENTIFIC_SOCIETY', null);

  const est = await estudiante('est', 'Rocio', 'Calderon', 6);
  const estOtro = await estudiante('otro', 'Fabian', 'Murillo', 3);

  const crearActividad = async (token, body) => {
    const creada = await req('POST', '/activities', { token, body });
    if (creada.status !== 201) {
      throw new Error(`No se pudo crear «${body.title}»: ${JSON.stringify(creada.data)}`);
    }
    await req('PATCH', `/activities/${creada.data.id}`, { token, body: { status: 'open' } });
    return creada.data;
  };
  // V2 §45.1: la afinidad sale de trayectoria respaldada. Dos estudiantes en
  // el área nueva —por debajo del umbral de cinco que §65 protege— con una
  // participación confirmada por Dirección cada uno.
  const participar = async (quien, actividad) => {
    await req('POST', `/activities/${actividad.id}/register`, { token: quien.token });
    await req('PATCH', `/activities/${actividad.id}/confirm-participation`, {
      token: director.token,
      body: { studentProfileId: quien.profileId, status: 'confirmed' },
    });
  };
  const practica1 = await crearActividad(director.token, {
    title: `Práctica de visión 1 ${TS}`, description: 'Actividad del escenario.', type: 'academica', categoryId: taller.id, areaId: area.id,
  });
  const practica2 = await crearActividad(director.token, {
    title: `Práctica de visión 2 ${TS}`, description: 'Actividad del escenario.', type: 'academica', categoryId: taller.id, areaId: area.id,
  });
  for (const quien of [est, estOtro]) await participar(quien, practica1);

  // Un segundo cálculo distinto, para que haya evolución que mirar.
  await req('POST', '/affinity/recalculate/me', { token: est.token });
  await participar(est, practica2);

  await crearActividad(docente.token, {
    title: `Taller del docente ${TS}`,
    description: 'Actividad académica del escenario.',
    type: 'academica',
    categoryId: taller.id,
    areaId: area.id,
    semesterScope: [6],
  });

  await crearActividad(sociedad.token, {
    title: `Convocatoria de la sociedad ${TS}`,
    description: 'Actividad extracurricular del escenario.',
    type: 'extracurricular',
    categoryId: convocatoria.id,
    areaId: area.id,
  });

  return { admin, area, docente, docenteSinAlcance, director, sociedad, est, estOtro };
}

async function main() {
  try {
    const ctx = await preparar();
    await evolucion(ctx);
    await umbral(ctx);
    await tendencias(ctx);
    await alcanceDocente(ctx);
    await sociedad(ctx);
  } catch (error) {
    console.error(`\n${C.bad}Error durante la ejecución:${C.r} ${error.message}`);
    process.exitCode = 1;
    return;
  }

  console.log(`\n${'-'.repeat(78)}`);
  if (failures.length === 0) {
    console.log(`${C.ok}${C.bold}  ${passed} verificaciones OK · 0 fallos${C.r}`);
    console.log('  El BATCH 10 queda demostrado de punta a punta.');
  } else {
    console.log(`${C.bad}${C.bold}  ${passed} verificaciones OK · ${failures.length} fallos${C.r}`);
    failures.forEach((f) => console.log(`  ${C.bad}·${C.r} ${f}`));
    process.exitCode = 1;
  }
}

main();
