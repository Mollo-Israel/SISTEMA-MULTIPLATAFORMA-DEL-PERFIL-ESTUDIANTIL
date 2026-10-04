/**
 * BATCH 7 — Recomendaciones.
 *
 * Cubre §58 (consume afinidad, respaldo, intereses, mejora, actividades,
 * recursos y disponibilidad), §59 (los dos regímenes), §60 (el reparto del
 * ranking), §61 (catálogo controlado), §62 (prioridades para sugerir
 * compañeros), §92 (qué, por qué, qué área y qué señal) y §109 (recomputación
 * centralizada).
 *
 * Uso:
 *   API_URL=http://localhost:3010/api node scripts/e2e-batch-7.mjs
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

const correoEst = (k) => `b7.${k}.${TS}@est.univalle.edu`;
const correoStaff = (k) => `b7.${k}.${TS}@univalle.edu`;

const dias = (n) => new Date(Date.now() + n * 86400000).toISOString();

/** Todas las recomendaciones vigentes, en una sola lista. */
async function recomendaciones(token) {
  const r = await req('GET', '/recommendations/me', { token });
  return { data: r.data, items: (r.data?.groups ?? []).flatMap((g) => g.items) };
}

const porObjetivo = (items, targetId) => items.find((i) => i.targetId === targetId) ?? null;
const codigos = (item) => (item?.reasons ?? []).map((x) => x.code);

const afinidadDe = async (token, areaId) => {
  const s = (await req('GET', '/affinity/me/summary', { token })).data;
  return (s?.areas ?? []).find((a) => a.academicAreaId === areaId) ?? null;
};

// ===========================================================================
//  §61 · Catálogo controlado
// ===========================================================================
async function catalogo(ctx) {
  objective('§61 · Un recurso entra porque alguien lo revisó, no porque exista');

  section('Quién puede tocar el catálogo');
  const porEstudiante = await req('POST', '/learning-resources', {
    token: ctx.est.token,
    body: {
      title: `Recurso del estudiante ${TS}`,
      provider: 'Cualquiera',
      url: `https://example.org/estudiante-${TS}`,
      academicAreaId: ctx.areaFuerte.id,
      resourceType: 'guide',
    },
  });
  check(
    porEstudiante.status === 403,
    'B7.1 Un estudiante no incorpora recursos al catálogo -> 403',
    `status ${porEstudiante.status}`,
  );

  const porDocente = await req('POST', '/learning-resources', {
    token: ctx.docente.token,
    body: {
      title: `Recurso del docente ${TS}`,
      provider: 'Cualquiera',
      url: `https://example.org/docente-${TS}`,
      academicAreaId: ctx.areaFuerte.id,
      resourceType: 'guide',
    },
  });
  check(
    porDocente.status === 403,
    'B7.2 Un docente tampoco: el catálogo lo cura la dirección -> 403',
    `status ${porDocente.status}`,
  );

  section('§61 · Nada de URLs arbitrarias');
  const peligrosa = await req('POST', '/learning-resources', {
    token: ctx.director.token,
    body: {
      title: `Enlace peligroso ${TS}`,
      provider: 'Origen desconocido',
      url: 'javascript:alert(document.cookie)',
      academicAreaId: ctx.areaFuerte.id,
      resourceType: 'guide',
    },
  });
  check(
    peligrosa.status === 400,
    'B7.3 Un enlace que no es http ni https se rechaza -> 400',
    `status ${peligrosa.status}`,
  );

  section('Alta real');
  const practica = await req('POST', '/learning-resources', {
    token: ctx.director.token,
    body: {
      title: `Laboratorio de prácticas ${TS}`,
      provider: 'Laboratorio de la carrera',
      url: `https://example.org/practica-${TS}`,
      description: 'Ejercicios guiados para construir experiencia.',
      academicAreaId: ctx.areaFuerte.id,
      resourceType: 'practice',
      skillIds: [ctx.skillFuerte.id],
    },
  });
  check(practica.status === 201, 'B7.4 La dirección incorpora un recurso', msgOf(practica));
  ctx.practica = practica.data;
  check(
    practica.data?.createdBy === ctx.director.userId,
    'B7.5 Y queda registrado quién lo incorporó (§61)',
    String(practica.data?.createdBy),
  );
  check(
    (practica.data?.resourceSkills ?? []).length === 1,
    'B7.6 Con las habilidades que trabaja (§61, skills[])',
    `habilidades ${(practica.data?.resourceSkills ?? []).length}`,
  );

  const repetida = await req('POST', '/learning-resources', {
    token: ctx.director.token,
    body: {
      title: `Otro título ${TS}`,
      provider: 'Otro proveedor',
      url: `https://example.org/practica-${TS}`,
      academicAreaId: ctx.areaFuerte.id,
      resourceType: 'guide',
    },
  });
  check(
    repetida.status === 409,
    'B7.7 El mismo enlace dos veces se rechaza -> 409',
    `status ${repetida.status}`,
  );

  const documentacion = await req('POST', '/learning-resources', {
    token: ctx.director.token,
    body: {
      title: `Documentación de referencia ${TS}`,
      provider: 'Documentación oficial',
      url: `https://example.org/doc-${TS}`,
      academicAreaId: ctx.areaFuerte.id,
      resourceType: 'documentation',
    },
  });
  ctx.documentacion = documentacion.data;

  const retirado = await req('POST', '/learning-resources', {
    token: ctx.director.token,
    body: {
      title: `Recurso que se retirará ${TS}`,
      provider: 'Editorial',
      url: `https://example.org/retirado-${TS}`,
      academicAreaId: ctx.areaFuerte.id,
      resourceType: 'book',
    },
  });
  ctx.retirado = retirado.data;
}

// ===========================================================================
//  §60 · El reparto del ranking
// ===========================================================================
async function reparto(ctx) {
  objective('§60 · Cada recomendación dice cuánto encaja, no solo en qué orden va');

  const { items, data } = await recomendaciones(ctx.est.token);
  ctx.items = items;

  check(
    data?.outcome === 'available' && items.length > 0,
    'B7.8 El estudiante recibe recomendaciones',
    `${data?.outcome} · ${items.length}`,
  );

  const taller = porObjetivo(items, ctx.tallerFuerte.id);
  check(!!taller, 'B7.9 El taller de su área más fuerte está entre ellas');

  check(
    taller.score > 0 && taller.score <= 100,
    'B7.10 El puntaje vive entre 0 y 100 (§60)',
    String(taller.score),
  );
  check(
    Math.abs(
      taller.reasons.reduce((a, x) => a + Number(x.points), 0) - Number(taller.score),
    ) < 0.011,
    'B7.11 INVARIANTE: los motivos suman exactamente el puntaje',
    `${taller.reasons.reduce((a, x) => a + Number(x.points), 0)} vs ${taller.score}`,
  );

  // V2 §54: 35 interés explícito, 25 área de mejora, 20 orientación,
  // 10 afinidad/respaldo, 10 contexto.
  const afinidad = taller.reasons.find((x) => x.code === 'affinity_area');
  check(
    !afinidad || afinidad.points <= 10.011,
    'B7.12 La afinidad y el respaldo nunca aportan más del 10 % (V2 §54)',
    JSON.stringify(afinidad),
  );
  const interes = taller.reasons
    .filter((x) => ['preferred_area', 'free_interest_match', 'skill_match'].includes(x.code))
    .reduce((a, x) => a + Number(x.points), 0);
  check(
    interes > 0 && interes <= 35.011,
    'B7.13 El interés explícito, venga por donde venga, no pasa del 35 % (V2 §54)',
    `interés ${interes}`,
  );
  const mejora = taller.reasons
    .filter((x) => ['improvement_area', 'improve_skill_match'].includes(x.code))
    .reduce((a, x) => a + Number(x.points), 0);
  check(
    mejora <= 25.011,
    'B7.14 El área o tecnología a mejorar no pasa del 25 % (V2 §54)',
    `mejora ${mejora}`,
  );
  const contexto = taller.reasons.find((x) => x.code === 'context_match');
  check(
    !contexto || contexto.points <= 10.011,
    'B7.15 Y el contexto no pasa del 10 % (V2 §54)',
    JSON.stringify(contexto),
  );

  section('§60 y §92 · Siempre se muestra la razón');
  check(
    items.every((i) => (i.reasons ?? []).length > 0),
    'B7.16 Ninguna recomendación aparece sin motivos (§60)',
  );
  check(
    items.every((i) => i.title && i.type && typeof i.score === 'number'),
    'B7.17 Todas dicen qué se recomienda y cuánto encaja (§92)',
  );
  check(
    items
      .filter((i) => i.type !== 'teammate')
      .every((i) => i.area?.id || i.type === 'strengthening_area'),
    'B7.18 Y con qué área se relacionan (§92)',
  );
  check(
    items.every((i) => (i.reasons ?? []).every((x) => !!x.code && !!x.label)),
    'B7.19 Cada motivo declara qué señal lo originó (§92)',
  );
}

// ===========================================================================
//  §59 · Los dos regímenes
// ===========================================================================
async function regimenes(ctx) {
  objective('§59 · Con la misma afinidad, lo que conviene cambia según el respaldo');

  const fuerte = await afinidadDe(ctx.est.token, ctx.areaFuerte.id);
  const respaldada = await afinidadDe(ctx.est.token, ctx.areaRespaldada.id);

  check(
    !fuerte,
    'B7.20 En su área solo declarada no hay afinidad: lo declarado no suma (V2 §45.1)',
    JSON.stringify(fuerte),
  );
  check(
    respaldada && respaldada.supportLevel !== 'low',
    'B7.21 En la otra, ya construyó respaldo',
    `${respaldada?.supportScore} / ${respaldada?.supportLevel}`,
  );

  const { items } = await recomendaciones(ctx.est.token);

  section('V2 §54 · Lo que recomienda es lo que el estudiante quiere');
  const taller = porObjetivo(items, ctx.tallerFuerte.id);
  check(
    codigos(taller).includes('preferred_area'),
    'B7.22 Un taller de su área de interés se recomienda por ese interés (V2 §54)',
    JSON.stringify(codigos(taller)),
  );
  const practica = porObjetivo(items, ctx.practica.id);
  check(
    !!practica && codigos(practica).includes('preferred_area'),
    'B7.23 Y también un laboratorio de prácticas del catálogo (§25)',
    JSON.stringify(codigos(practica)),
  );
  check(
    items.every((i) => !codigos(i).includes('build_experience')),
    'B7.24 Ya no hay refuerzo de «construir experiencia»: V2 §54 no lo contempla',
  );

  section('V2 §54 · El refuerzo de oportunidades avanzadas exige afinidad Y respaldo altos');
  const reto = porObjetivo(items, ctx.retoRespaldado.id);
  check(
    !!reto && codigos(reto).includes('affinity_area'),
    'B7.25 En el área con trayectoria, el reto cita esa trayectoria como motivo',
    JSON.stringify(codigos(reto)),
  );
  check(
    !codigos(reto).includes('advance_level'),
    'B7.26 Con afinidad o respaldo todavía no altos, no recibe refuerzo de nivel',
    JSON.stringify(codigos(reto)),
  );

  section('§59 · El área de mejora se fortalece, pero no suma afinidad');
  const fortalecer = porObjetivo(items, ctx.areaMejora.id);
  check(
    fortalecer?.type === 'strengthening_area',
    'B7.27 El área de mejora se propone como área de fortalecimiento',
    fortalecer?.type,
  );
  const enAfinidad = await afinidadDe(ctx.est.token, ctx.areaMejora.id);
  check(
    !enAfinidad,
    'B7.28 Marcarla NO aumentó su afinidad (§59, §20)',
    JSON.stringify(enAfinidad),
  );
}

// ===========================================================================
//  §61 · Un recurso retirado no se recomienda, pero se conserva
// ===========================================================================
async function retiroDeRecurso(ctx) {
  objective('§61 · Retirar un recurso no es borrarlo');

  const antes = (await recomendaciones(ctx.est.token)).items;
  check(
    !!porObjetivo(antes, ctx.retirado.id),
    'B7.29 El recurso se recomienda mientras está vigente',
  );

  const retirar = await req('PATCH', `/learning-resources/${ctx.retirado.id}`, {
    token: ctx.director.token,
    body: { status: 'inactive' },
  });
  check(retirar.status === 200, 'B7.30 La dirección lo retira', msgOf(retirar));

  const despues = (await recomendaciones(ctx.est.token)).items;
  check(
    !porObjetivo(despues, ctx.retirado.id),
    'B7.31 Deja de recomendarse (§61)',
  );

  const visibleParaEstudiante = await req('GET', '/learning-resources', {
    token: ctx.est.token,
  });
  check(
    !(visibleParaEstudiante.data ?? []).some((r) => r.id === ctx.retirado.id),
    'B7.32 Y el estudiante ya no lo ve en el catálogo',
  );

  const conRetirados = await req('GET', '/learning-resources?includeInactive=true', {
    token: ctx.director.token,
  });
  check(
    (conRetirados.data ?? []).some((r) => r.id === ctx.retirado.id),
    'B7.33 Pero se conserva históricamente para quien administra (§61)',
  );

  const paraElEstudiante = await req('GET', '/learning-resources?includeInactive=true', {
    token: ctx.est.token,
  });
  check(
    !(paraElEstudiante.data ?? []).some((r) => r.id === ctx.retirado.id),
    'B7.34 Pedir los retirados sin ser dirección no los revela',
  );
}

// ===========================================================================
//  §62 · Compañeros
// ===========================================================================
async function companeros(ctx) {
  objective('§62 · Un equipo se forma por lo que le falta');

  const { items } = await recomendaciones(ctx.est.token);
  const mates = items.filter((i) => i.type === 'teammate');
  check(mates.length > 0, 'B7.35 Se sugieren posibles compañeros', `sugeridos ${mates.length}`);

  const complementario = porObjetivo(items, ctx.complementario.profileId);
  check(
    !!complementario,
    'B7.36 Entre ellos, quien domina lo que al estudiante le falta',
  );
  check(
    codigos(complementario).includes('missing_skill'),
    'B7.37 Y la primera razón es la habilidad faltante (§62)',
    JSON.stringify(codigos(complementario)),
  );
  check(
    complementario.reasons.some(
      (x) => x.code === 'missing_skill' && x.label.includes(ctx.skillAjena.name),
    ),
    'B7.38 Con la habilidad nombrada, para que se entienda por qué',
    JSON.stringify(complementario.reasons.map((x) => x.label)),
  );
  check(
    codigos(complementario).includes('availability'),
    'B7.39 La disponibilidad declarada también cuenta (§58, §62)',
    JSON.stringify(codigos(complementario)),
  );

  section('§62 · Visibilidad y consentimiento');
  check(
    !porObjetivo(items, ctx.oculto.profileId),
    'B7.40 Quien desactivó aparecer en sugerencias no aparece (§62)',
  );
  check(
    !JSON.stringify(mates).includes('@'),
    'B7.41 Ninguna tarjeta de compañero revela un correo',
  );
  check(
    mates.every((m) => m.reasons.every((x) => !/\d+\s*\/\s*100/.test(x.label))),
    'B7.42 Ni el puntaje del compañero',
    JSON.stringify(mates.flatMap((m) => m.reasons.map((x) => x.label))),
  );
}

// ===========================================================================
//  §109 · Recomputación centralizada
// ===========================================================================
async function recomputacion(ctx) {
  objective('§109 · Una acción, y todo lo que depende de ella queda al día');

  section('Antes de declarar el interés');
  const antesAfinidad = await afinidadDe(ctx.est.token, ctx.areaNueva.id);
  const antes = (await recomendaciones(ctx.est.token)).items;
  check(
    !antesAfinidad,
    'B7.43 No hay afinidad con el área nueva',
    JSON.stringify(antesAfinidad),
  );
  check(
    !porObjetivo(antes, ctx.tallerNuevo.id),
    'B7.44 Ni se recomienda su taller',
  );

  section('El estudiante declara el interés');
  const declarar = await req('PUT', '/profiles/me/interests', {
    token: ctx.est.token,
    body: {
      items: [
        { academicAreaId: ctx.areaFuerte.id, priority: 1 },
        { academicAreaId: ctx.areaRespaldada.id, priority: 2 },
        { academicAreaId: ctx.areaNueva.id, priority: 3 },
      ],
    },
  });
  check(declarar.status === 200, 'B7.45 Declara un interés más', msgOf(declarar));

  const despuesAfinidad = await afinidadDe(ctx.est.token, ctx.areaNueva.id);
  check(
    !despuesAfinidad,
    'B7.46 Declarar el interés no crea afinidad (V2 §45.1)',
    JSON.stringify(despuesAfinidad),
  );

  const despues = (await recomendaciones(ctx.est.token)).items;
  const nuevo = porObjetivo(despues, ctx.tallerNuevo.id);
  check(
    !!nuevo,
    'B7.47 Y las recomendaciones también, en la misma acción (§109)',
  );
  check(
    codigos(nuevo).includes('preferred_area') && !codigos(nuevo).includes('affinity_area'),
    'B7.48 La recomendación nueva cita su motivo real: el interés, no una afinidad que no existe',
    JSON.stringify(codigos(nuevo)),
  );

  section('RN-16 · Lo que el estudiante decidió es suyo');
  const guardada = await req('PATCH', `/recommendations/me/${nuevo.id}`, {
    token: ctx.est.token,
    body: { status: 'saved' },
  });
  check(guardada.status === 200, 'B7.49 El estudiante guarda una recomendación', msgOf(guardada));

  await req('PUT', '/profiles/me/interests', {
    token: ctx.est.token,
    body: {
      items: [
        { academicAreaId: ctx.areaFuerte.id, priority: 1 },
        { academicAreaId: ctx.areaRespaldada.id, priority: 2 },
        { academicAreaId: ctx.areaNueva.id, priority: 4 },
      ],
    },
  });
  const guardadas = await req('GET', '/recommendations/me/history?status=saved', {
    token: ctx.est.token,
  });
  check(
    (guardadas.data ?? []).some((r) => r.id === nuevo.id),
    'B7.50 Un recálculo no le quita lo que guardó (RN-16)',
  );
}

// ===========================================================================
//  §58 · El motor no opera aislado
// ===========================================================================
async function noAislado(ctx) {
  objective('§58 · Lo que el motor consume está a la vista');

  const reglas = await req('GET', '/recommendations/rules', { token: ctx.est.token });
  check(reglas.status === 200, 'B7.51 Las reglas se consultan de solo lectura', msgOf(reglas));

  const pesos = reglas.data?.ranking ?? [];
  check(
    pesos.reduce((a, r) => a + r.weight, 0) === 100,
    'B7.52 El reparto publicado suma 100 (V2 §54)',
    JSON.stringify(pesos.map((r) => [r.code, r.weight])),
  );
  check(
    pesos.find((r) => r.code === 'preferred_area')?.weight === 35
      && pesos.find((r) => r.code === 'improvement_area')?.weight === 25
      && pesos.find((r) => r.code === 'orientation_confirmed')?.weight === 20
      && pesos.find((r) => r.code === 'affinity_area')?.weight === 10
      && pesos.find((r) => r.code === 'context_match')?.weight === 10,
    'B7.53 Y es exactamente el de V2 §54: 35 / 25 / 20 / 10 / 10',
    JSON.stringify(pesos.map((r) => [r.code, r.weight])),
  );
  check(
    JSON.stringify((reglas.data?.regimes ?? []).map((r) => r.code)) === JSON.stringify(['advance_level']),
    'B7.54 El único refuerzo publicado es el de oportunidades avanzadas (V2 §54)',
    JSON.stringify((reglas.data?.regimes ?? []).map((r) => r.code)),
  );
  check(
    (reglas.data?.teammate ?? []).some((r) => r.code === 'missing_skill'),
    'B7.55 Y las prioridades de §62, empezando por la habilidad faltante',
    JSON.stringify((reglas.data?.teammate ?? []).map((r) => r.code)),
  );

  section('El detalle de un recurso apunta al catálogo, no a una actividad');
  const { items } = await recomendaciones(ctx.est.token);
  const practica = porObjetivo(items, ctx.practica.id);
  const detalle = await req('GET', `/recommendations/me/${practica.id}`, {
    token: ctx.est.token,
  });
  check(
    detalle.status === 200 && detalle.data?.detail?.resourceId === ctx.practica.id,
    'B7.56 El detalle resuelve contra learning_resources (§61)',
    JSON.stringify(detalle.data?.detail ?? null),
  );
  check(
    detalle.data?.detail?.provider === 'Laboratorio de la carrera',
    'B7.57 Y dice quién publica el material',
    String(detalle.data?.detail?.provider),
  );
}

// ===========================================================================
//  Preparación
// ===========================================================================
async function preparar() {
  console.log(
    `${C.bold}BATCH 7 — Recomendaciones contra `
    + `${process.env.API_URL ?? 'http://localhost:3010/api'}${C.r}`,
  );
  const admin = await loginAdmin();

  const categorias = (await req('GET', '/activity-categories', { token: admin })).data ?? [];
  const cat = (code) => categorias.find((c) => c.code === code);
  const taller = cat('taller_academico');
  const reto = cat('reto');
  if (!taller || !reto) {
    throw new Error('Faltan las categorías taller_academico y reto. Ejecute npm run seed:populate.');
  }

  /*
   * Áreas propias del escenario.
   *
   * Con las áreas sembradas, el compañero complementario competía por los cinco
   * puestos de sugerencia con cientos de estudiantes del padrón y quedaba fuera.
   * Lo que se mediría entonces sería el tamaño de la base, no la regla de §62.
   */
  const crearArea = async (nombre, tags) =>
    (await req('POST', '/academic-areas', {
      token: admin,
      body: { name: `${nombre} ${TS}`, description: `Área del escenario ${nombre}.`, tags },
    })).data;

  const areaFuerte = await crearArea('Computacion Grafica', ['shaders', 'render']);
  const areaRespaldada = await crearArea('Redes Industriales', ['modbus', 'scada']);
  const areaMejora = await crearArea('Criptografia Aplicada', ['cifrado']);
  const areaNueva = await crearArea('Bioinformatica', ['genoma']);
  if (!areaFuerte?.id || !areaRespaldada?.id || !areaMejora?.id || !areaNueva?.id) {
    throw new Error('No se pudieron crear las áreas del escenario.');
  }

  const nuevaSkill = async (nombre, areaId) =>
    (await req('POST', '/skills', {
      token: admin,
      body: { name: `${nombre} ${TS}`, academicAreaId: areaId },
    })).data;

  const skillFuerte = await nuevaSkill('OpenGL', areaFuerte.id);
  const skillAjena = await nuevaSkill('Trazado de rayos', areaFuerte.id);
  if (!skillFuerte?.id || !skillAjena?.id) {
    throw new Error('No se pudieron crear las habilidades del escenario.');
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

  const docente = await staff('doc', 'Lorena', 'Quiroga', 'TEACHER', [6]);
  const director = await staff('dir', 'Marcelo', 'Vaca', 'CAREER_DIRECTOR', null);
  // Las extracurriculares las gestiona la sociedad cientifica (§22).
  const sociedad = await staff('soc', 'Ariel', 'Encinas', 'SCIENTIFIC_SOCIETY', null);
  const est = await estudiante('est', 'Camila', 'Ferrufino', 6);
  const complementario = await estudiante('comp', 'Diego', 'Arispe', 6);
  const oculto = await estudiante('ocul', 'Paola', 'Nogales', 6);

  // ---------------------------------------------------------- el estudiante
  await req('PUT', '/profiles/me/interests', {
    token: est.token,
    body: {
      items: [
        { academicAreaId: areaFuerte.id, priority: 1 },
        { academicAreaId: areaRespaldada.id, priority: 2 },
      ],
    },
  });
  await req('PUT', '/profiles/me/skill-interests', {
    token: est.token,
    body: { items: [{ skillId: skillFuerte.id, kind: 'interest' }] },
  });
  await req('PATCH', '/profiles/me', {
    token: est.token,
    body: {
      improvementAreaIds: [areaMejora.id],
      availability: 'looking',
      collaborationPreferences: { modes: ['remote', 'hybrid'], interests: ['projects'] },
    },
  });

  // Un proyecto declarado en el área fuerte: hay afinidad y no hay respaldo.
  await req('POST', '/projects', {
    token: est.token,
    body: {
      title: `Prototipo del área fuerte ${TS}`,
      description: 'Proyecto declarado, sin nada que corroborar todavía.',
      areaId: areaFuerte.id,
      status: 'active',
      visibility: 'profile',
    },
  });

  // ------------------------------------------------------------ actividades
  const crearActividad = async (token, body, abrir = true) => {
    const creada = await req('POST', '/activities', { token, body });
    if (creada.status !== 201) {
      throw new Error(`No se pudo crear «${body.title}»: ${JSON.stringify(creada.data)}`);
    }
    if (abrir) {
      await req('PATCH', `/activities/${creada.data.id}`, {
        token, body: { status: 'open' },
      });
    }
    return creada.data;
  };

  const tallerFuerte = await crearActividad(director.token, {
    title: `Taller práctico del área fuerte ${TS}`,
    description: 'Actividad práctica para construir experiencia.',
    type: 'academica',
    categoryId: taller.id,
    areaId: areaFuerte.id,
    activityDate: dias(10),
    semesterScope: [6],
    modality: 'virtual',
  });

  const tallerNuevo = await crearActividad(director.token, {
    title: `Taller del área nueva ${TS}`,
    description: 'Actividad del área que todavía no le interesa.',
    type: 'academica',
    categoryId: taller.id,
    areaId: areaNueva.id,
    activityDate: dias(12),
  });

  const retoRespaldado = await crearActividad(sociedad.token, {
    title: `Reto avanzado del área respaldada ${TS}`,
    description: 'Un reto para quien ya demostró.',
    type: 'extracurricular',
    categoryId: reto.id,
    areaId: areaRespaldada.id,
    activityDate: dias(16),
  });

  // Tres participaciones confirmadas y un proyecto respaldado en el área
  // respaldada: así su SUPPORT_SCORE sube por encima de 24 y §59 cambia de
  // régimen para esa área.
  for (let i = 0; i < 3; i++) {
    const a = await crearActividad(director.token, {
      title: `Actividad respaldada ${i} ${TS}`,
      description: 'Participación confirmada.',
      type: 'academica',
      categoryId: taller.id,
      areaId: areaRespaldada.id,
    });
    await req('POST', `/activities/${a.id}/register`, { token: est.token });
    await req('PATCH', `/activities/${a.id}/confirm-participation`, {
      token: director.token,
      body: { studentProfileId: est.profileId, status: 'confirmed' },
    });
  }

  const proyectoRespaldado = await req('POST', '/projects', {
    token: est.token,
    body: {
      title: `Proyecto del área respaldada ${TS}`,
      description: 'Con evidencia adjunta.',
      areaId: areaRespaldada.id,
      status: 'active',
      visibility: 'profile',
    },
  });
  await req('POST', `/projects/${proyectoRespaldado.data.id}/evidences`, {
    token: est.token,
    body: {
      evidenceType: 'link',
      description: `Evidencia del proyecto ${TS}`,
      externalUrl: `https://ejemplo.univalle.edu/b7-${TS}`,
    },
  });

  // ------------------------------------------------------- los compañeros
  // V2 §55: de un compañero cuentan las tecnologías RESPALDADAS. El
  // complementario las obtiene como se obtienen de verdad: participando —con
  // confirmación del responsable— en una actividad que las trabaja.
  const practica = await crearActividad(director.token, {
    title: `Práctica de tecnologías ${TS}`,
    description: 'Actividad con tecnologías concretas.',
    type: 'academica',
    categoryId: taller.id,
    areaId: areaFuerte.id,
    skillIds: [skillFuerte.id, skillAjena.id],
  });
  await req('POST', `/activities/${practica.id}/register`, { token: complementario.token });
  await req('PATCH', `/activities/${practica.id}/confirm-participation`, {
    token: director.token,
    body: { studentProfileId: complementario.profileId, status: 'confirmed' },
  });
  await req('PUT', '/profiles/me/skill-interests', {
    token: complementario.token,
    body: {
      items: [
        { skillId: skillFuerte.id, kind: 'interest' },
        { skillId: skillAjena.id, kind: 'interest' },
      ],
    },
  });
  await req('PUT', '/profiles/me/interests', {
    token: complementario.token,
    body: { items: [{ academicAreaId: areaFuerte.id, priority: 1 }] },
  });
  await req('PATCH', '/profiles/me', {
    token: complementario.token,
    body: { availability: 'looking' },
  });

  await req('PUT', '/profiles/me/skill-interests', {
    token: oculto.token,
    body: { items: [{ skillId: skillAjena.id, kind: 'interest' }] },
  });
  await req('PUT', '/profiles/me/interests', {
    token: oculto.token,
    body: { items: [{ academicAreaId: areaFuerte.id, priority: 1 }] },
  });
  await req('PATCH', '/profiles/me', {
    token: oculto.token,
    body: { peerDiscoverable: false },
  });

  return {
    admin, docente, director, sociedad, est, complementario, oculto,
    areaFuerte, areaRespaldada, areaMejora, areaNueva,
    skillFuerte, skillAjena,
    tallerFuerte, tallerNuevo, retoRespaldado,
  };
}

async function main() {
  try {
    const ctx = await preparar();
    await catalogo(ctx);
    await reparto(ctx);
    await regimenes(ctx);
    await retiroDeRecurso(ctx);
    await companeros(ctx);
    await recomputacion(ctx);
    await noAislado(ctx);
  } catch (error) {
    console.error(`\n${C.bad}Error durante la ejecución:${C.r} ${error.message}`);
    process.exitCode = 1;
    return;
  }

  console.log(`\n${'-'.repeat(78)}`);
  if (failures.length === 0) {
    console.log(`${C.ok}${C.bold}  ${passed} verificaciones OK · 0 fallos${C.r}`);
    console.log('  El BATCH 7 queda demostrado de punta a punta.');
  } else {
    console.log(`${C.bad}${C.bold}  ${passed} verificaciones OK · ${failures.length} fallos${C.r}`);
    failures.forEach((f) => console.log(`  ${C.bad}·${C.r} ${f}`));
    process.exitCode = 1;
  }
}

main();
