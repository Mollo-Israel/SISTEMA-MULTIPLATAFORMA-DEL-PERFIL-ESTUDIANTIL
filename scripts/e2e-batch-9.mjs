/**
 * BATCH 9 — Gamificación y resumen de trayectoria.
 *
 * Cubre §66 (independencia de la afinidad, acciones válidas, idempotencia, sin
 * ranking obligatorio), §67 (resumen seleccionable, PDF y advertencia
 * obligatoria), §73.8 y §109 (la gamificación colgada del coordinador).
 *
 * El PDF se genera y se vuelve a leer con el extractor del BATCH 3: un archivo
 * que no se puede releer es uno que nadie sabe si sirve hasta que lo abre.
 *
 * Uso:
 *   API_URL=http://localhost:3010/api node scripts/e2e-batch-9.mjs
 */

import { createRequire } from 'node:module';
import { API, loginAdmin, provisionAndActivate, req, aprobarActividad } from './lib/fixtures.mjs';

const require = createRequire(import.meta.url);
const { extractPdfText, esPdf } = require('../api/dist/validation/pdf-text.js');

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

const correoEst = (k) => `b9.${k}.${TS}@est.univalle.edu`;
const correoStaff = (k) => `b9.${k}.${TS}@univalle.edu`;

const progreso = async (token) => (await req('GET', '/gamification/me', { token })).data;
const eventosCon = (p, trigger) => (p?.events ?? []).filter((e) => e.trigger === trigger);
const insignia = (p, code) => (p?.badges ?? []).find((b) => b.code === code) ?? null;

/** Descarga el PDF como Buffer. */
async function descargarPdf(token, sections) {
  const res = await fetch(
    `${API}/trajectory-summary/pdf${sections ? `?sections=${sections}` : ''}`,
    { headers: { Authorization: `Bearer ${token}` } },
  );
  const buffer = Buffer.from(await res.arrayBuffer());
  return { status: res.status, headers: res.headers, buffer };
}

// ===========================================================================
//  §66 · Qué se premia y qué no
// ===========================================================================
async function accionesValidas(ctx) {
  objective('§66 · Se reconoce lo que hiciste, no lo que declaraste');

  section('Punto de partida');
  const inicial = await progreso(ctx.est.token);
  check(inicial?.totalPoints === 0, 'B9.1 Un perfil recién creado no tiene puntos',
    String(inicial?.totalPoints));

  section('Lo que §66 excluye');
  await req('PUT', '/profiles/me/interests', {
    token: ctx.est.token,
    body: { items: [{ academicAreaId: ctx.area.id, priority: 1 }] },
  });
  await req('PUT', '/profiles/me/skill-interests', {
    token: ctx.est.token,
    body: { items: [{ skillId: ctx.skill.id, kind: 'interest' }] },
  });
  const trasDeclarar = await progreso(ctx.est.token);
  check(
    trasDeclarar.totalPoints === 0,
    'B9.2 Declarar intereses y habilidades NO da puntos (§66)',
    String(trasDeclarar.totalPoints),
  );

  const proyecto = await req('POST', '/projects', {
    token: ctx.est.token,
    body: {
      title: `Proyecto vacío ${TS}`,
      description: 'Recién registrado, sin nada que lo respalde.',
      areaId: ctx.area.id,
      status: 'active',
      visibility: 'profile',
    },
  });
  check(proyecto.status === 201, 'B9.3 El estudiante registra un proyecto', msgOf(proyecto));
  ctx.proyectoId = proyecto.data.id;

  const trasProyecto = await progreso(ctx.est.token);
  check(
    trasProyecto.totalPoints === 0,
    'B9.4 Un proyecto recién registrado tampoco: es un proyecto vacío (§66)',
    String(trasProyecto.totalPoints),
  );

  const cert = await req('POST', '/certificates/external', {
    token: ctx.est.token,
    body: {
      certificateName: `Curso declarado ${TS}`,
      issuer: 'Plataforma externa',
      academicAreaId: ctx.area.id,
    },
  });
  check(cert.status === 201, 'B9.5 Y adjunta un certificado', msgOf(cert));
  const trasCert = await progreso(ctx.est.token);
  check(
    trasCert.totalPoints === 0,
    'B9.6 Adjuntar un certificado es una autodeclaración: no da puntos (§66)',
    String(trasCert.totalPoints),
  );

  section('Lo que §66 sí admite');
  await req('POST', `/activities/${ctx.actividades[0].id}/register`, { token: ctx.est.token });
  const confirmada = await req(
    'PATCH',
    `/activities/${ctx.actividades[0].id}/confirm-participation`,
    {
      token: ctx.docente.token,
      body: { studentProfileId: ctx.est.profileId, status: 'confirmed' },
    },
  );
  check(confirmada.status === 200, 'B9.7 El docente confirma su participación', msgOf(confirmada));

  const trasParticipar = await progreso(ctx.est.token);
  check(
    trasParticipar.totalPoints === 10,
    'B9.8 Una participación confirmada sí da puntos (§66)',
    String(trasParticipar.totalPoints),
  );
  check(
    eventosCon(trasParticipar, 'participacion_confirmada').length === 1,
    'B9.9 Con su evento y su motivo legible',
    JSON.stringify(eventosCon(trasParticipar, 'participacion_confirmada')),
  );

  section('El primer proyecto respaldado');
  await req('POST', `/projects/${ctx.proyectoId}/evidences`, {
    token: ctx.est.token,
    body: {
      evidenceType: 'link',
      description: `Capturas ${TS}`,
      externalUrl: `https://ejemplo.univalle.edu/b9-${TS}`,
    },
  });
  const trasRespaldo = await progreso(ctx.est.token);
  check(
    eventosCon(trasRespaldo, 'primer_proyecto_respaldado').length === 1,
    'B9.10 Cuando el proyecto deja de ser una declaración, eso sí se reconoce (§66)',
    JSON.stringify(eventosCon(trasRespaldo, 'primer_proyecto_respaldado').map((e) => e.reason)),
  );
  check(
    trasRespaldo.totalPoints === 35,
    'B9.11 Diez de la participación más veinticinco del respaldo',
    String(trasRespaldo.totalPoints),
  );
}

// ===========================================================================
//  §66 · Idempotencia
// ===========================================================================
async function idempotencia(ctx) {
  objective('§66 · Correr esto dos veces da lo mismo que correrlo una');

  const antes = await progreso(ctx.est.token);

  // Cada consulta sincroniza; además se fuerzan recálculos que pasan por el
  // coordinador de §109, que a su vez llama a la gamificación.
  await req('POST', '/affinity/recalculate/me', { token: ctx.est.token });
  await progreso(ctx.est.token);
  await req('POST', '/affinity/recalculate/me', { token: ctx.est.token });
  const despues = await progreso(ctx.est.token);

  check(
    antes.totalPoints === despues.totalPoints,
    'B9.12 Tres sincronizaciones más no cambian el total (§66)',
    `${antes.totalPoints} -> ${despues.totalPoints}`,
  );
  check(
    antes.eventsCount === despues.eventsCount,
    'B9.13 Ni el número de eventos',
    `${antes.eventsCount} -> ${despues.eventsCount}`,
  );

  const claves = (despues.events ?? []).map((e) => `${e.trigger}|${e.reason}`);
  check(
    new Set(claves).size === claves.length,
    'B9.14 No hay dos eventos que reconozcan el mismo hecho',
    JSON.stringify(claves),
  );

  section('El «primer proyecto respaldado» es uno, no uno por proyecto');
  const otro = await req('POST', '/projects', {
    token: ctx.est.token,
    body: {
      title: `Segundo proyecto ${TS}`,
      description: 'También llegará a tener respaldo.',
      areaId: ctx.area.id,
      status: 'active',
      visibility: 'profile',
    },
  });
  await req('POST', `/projects/${otro.data.id}/evidences`, {
    token: ctx.est.token,
    body: {
      evidenceType: 'link',
      description: `Capturas del segundo ${TS}`,
      externalUrl: `https://ejemplo.univalle.edu/b9b-${TS}`,
    },
  });
  const conDos = await progreso(ctx.est.token);
  check(
    eventosCon(conDos, 'primer_proyecto_respaldado').length === 1,
    'B9.15 Un segundo proyecto respaldado no vuelve a dar el punto del primero',
    String(eventosCon(conDos, 'primer_proyecto_respaldado').length),
  );
}

// ===========================================================================
//  §66 · Independiente de la afinidad
// ===========================================================================
async function independencia(ctx) {
  objective('§66 · Los puntos nunca alimentan la afinidad');

  const afinidadAntes = (await req('GET', '/affinity/me/summary', { token: ctx.est.token }))
    .data?.totalScore ?? 0;
  const puntosAntes = (await progreso(ctx.est.token)).totalPoints;

  // Más colaboraciones aceptadas: suben los puntos sin tocar ninguna señal de
  // afinidad, que es exactamente el caso que §66 quiere aislar.
  await req('PUT', '/profiles/me/visibility', {
    token: ctx.otro.token,
    body: { publicProfileEnabled: true, fields: { bio: true } },
  });
  const enlace = await req('GET', '/profiles/me/public-link', { token: ctx.otro.token });
  const solicitud = await req('POST', '/contacts/requests', {
    token: ctx.est.token,
    body: { slug: enlace.data.slug },
  });
  await req('PATCH', `/contacts/requests/${solicitud.data.id}`, {
    token: ctx.otro.token,
    body: { decision: 'accept' },
  });

  const puntosDespues = (await progreso(ctx.est.token)).totalPoints;
  const afinidadDespues = (await req('GET', '/affinity/me/summary', { token: ctx.est.token }))
    .data?.totalScore ?? 0;

  check(
    puntosDespues > puntosAntes,
    'B9.16 Una colaboración aceptada da puntos (§66)',
    `${puntosAntes} -> ${puntosDespues}`,
  );
  check(
    afinidadAntes === afinidadDespues,
    'B9.17 Y NO cambia la afinidad: nunca puntos → afinidad (§66)',
    `${afinidadAntes} -> ${afinidadDespues}`,
  );

  const desglose = await req('GET', `/affinity/me/areas/${ctx.area.id}/breakdown`, {
    token: ctx.est.token,
  });
  check(
    !(desglose.data?.contributions ?? []).some((c) =>
      JSON.stringify(c).toLowerCase().includes('punto')
      || JSON.stringify(c).toLowerCase().includes('insignia')),
    'B9.18 Los puntos no aparecen como señal en el desglose de afinidad (§66)',
  );

  const progresoActual = await progreso(ctx.est.token);
  check(
    !!progresoActual.note && progresoActual.note.includes('No influyen'),
    'B9.19 La pantalla lo dice, no solo el código',
    String(progresoActual.note),
  );
}

// ===========================================================================
//  §66 · Insignias y progreso
// ===========================================================================
async function insignias(ctx) {
  objective('§66 · Insignias por hechos, no por acumular');

  const p = await progreso(ctx.est.token);
  check((p.badges ?? []).length >= 7, 'B9.20 El catálogo de insignias está publicado',
    String((p.badges ?? []).length));

  const primera = insignia(p, 'primera_participacion');
  check(primera?.earned === true, 'B9.21 La primera participación se reconoce con insignia');
  check(!!primera?.earnedAt, 'B9.22 Con la fecha en que se obtuvo');

  const cinco = insignia(p, 'cinco_participaciones');
  check(
    cinco?.earned === false && cinco?.threshold === 5,
    'B9.23 La de cinco participaciones todavía no, y dice cuántas faltan',
    JSON.stringify([cinco?.progress, cinco?.threshold]),
  );
  check(
    cinco?.progress === 1,
    'B9.24 El progreso se mide en hechos, no en puntos (§66)',
    String(cinco?.progress),
  );

  section('Cuatro participaciones más');
  for (const actividad of ctx.actividades.slice(1)) {
    await req('POST', `/activities/${actividad.id}/register`, { token: ctx.est.token });
    await req('PATCH', `/activities/${actividad.id}/confirm-participation`, {
      token: ctx.docente.token,
      body: { studentProfileId: ctx.est.profileId, status: 'confirmed' },
    });
  }
  const conCinco = await progreso(ctx.est.token);
  check(
    insignia(conCinco, 'cinco_participaciones')?.earned === true,
    'B9.25 Al llegar a cinco, la insignia se otorga',
  );
  check(
    eventosCon(conCinco, 'participacion_confirmada').length === 5,
    'B9.26 Con cinco eventos, uno por participación',
    String(eventosCon(conCinco, 'participacion_confirmada').length),
  );

  section('§66 · Sin ranking público obligatorio');
  const ajeno = await req('GET', `/gamification/student/${ctx.otro.profileId}`, {
    token: ctx.est.token,
  });
  check(
    ajeno.status === 404,
    'B9.27 No existe forma de consultar los puntos de otra persona (§66)',
    `status ${ajeno.status}`,
  );
  check(
    !JSON.stringify(conCinco).includes('rank') && !JSON.stringify(conCinco).includes('posicion'),
    'B9.28 Ni tabla de posiciones en la respuesta propia',
  );
}

// ===========================================================================
//  §67 · Resumen de trayectoria
// ===========================================================================
async function resumen(ctx) {
  objective('§67 · El estudiante decide qué entra en su resumen');

  const secciones = await req('GET', '/trajectory-summary/sections', { token: ctx.est.token });
  check(secciones.status === 200, 'B9.29 Las secciones disponibles se consultan', msgOf(secciones));
  check(
    // V2 §61.1 suma insignias y contacto autorizado a las doce de §67.
    (secciones.data?.sections ?? []).length === 14,
    'B9.30 Son las doce de §67 más insignias y contacto (V2 §61.1)',
    String((secciones.data?.sections ?? []).length),
  );
  check(
    !!secciones.data?.disclaimer
      && secciones.data.disclaimer.includes('No constituye historial académico oficial'),
    'B9.31 Y la advertencia obligatoria viaja con ellas (§67)',
  );

  section('Solo lo elegido');
  const minimo = await req('POST', '/trajectory-summary/preview', {
    token: ctx.est.token,
    body: { sections: ['basic'] },
  });
  check(minimo.status === 201 || minimo.status === 200,
    'B9.32 Un resumen con solo los datos básicos', msgOf(minimo));
  check(
    minimo.data?.projects === undefined && minimo.data?.certificates === undefined,
    'B9.33 No incluye lo que no se pidió (§67)',
    JSON.stringify(Object.keys(minimo.data ?? {})),
  );
  check(
    !!minimo.data?.student?.name,
    'B9.34 Los datos básicos siempre están: un resumen sin nombre no es de nadie',
  );

  const completo = await req('POST', '/trajectory-summary/preview', {
    token: ctx.est.token,
    body: {
      sections: [
        'basic', 'bio', 'areas', 'projects', 'contributions', 'technologies',
        'activities', 'certificates', 'affinity', 'support',
      ],
    },
  });
  check(
    Array.isArray(completo.data?.projects) && completo.data.projects.length >= 2,
    'B9.35 Con todo marcado, aparecen sus proyectos',
    String(completo.data?.projects?.length),
  );
  check(
    Array.isArray(completo.data?.activities) && completo.data.activities.length === 5,
    'B9.36 Y sus cinco actividades confirmadas',
    String(completo.data?.activities?.length),
  );
  check(
    (completo.data?.areas ?? []).every((a) => a.score !== undefined && a.supportScore !== undefined),
    'B9.37 Afinidad y respaldo, porque se marcaron las dos secciones (§67)',
    JSON.stringify(completo.data?.areas),
  );

  section('§105 · El archivo del certificado no viaja en el resumen');
  const texto = JSON.stringify(completo.data);
  check(
    !texto.includes('fileUrl') && !texto.includes('storedFileId'),
    'B9.38 Solo la metadata del certificado, nunca el archivo (§105)',
  );
}

// ===========================================================================
//  §67 · El PDF
// ===========================================================================
async function pdf(ctx) {
  objective('§67 · Exportable a PDF, y legible de verdad');

  const descarga = await descargarPdf(
    ctx.est.token,
    'basic,bio,areas,projects,activities,certificates,affinity,support',
  );
  check(descarga.status === 200, 'B9.39 El estudiante descarga su resumen en PDF',
    `status ${descarga.status}`);
  check(
    descarga.headers.get('content-type')?.includes('application/pdf'),
    'B9.40 Con el tipo de contenido correcto',
    String(descarga.headers.get('content-type')),
  );
  check(
    (descarga.headers.get('content-disposition') ?? '').includes('.pdf'),
    'B9.41 Y como descarga, con nombre de archivo',
    String(descarga.headers.get('content-disposition')),
  );
  check(esPdf(descarga.buffer), 'B9.42 El archivo es un PDF de verdad');

  section('Se vuelve a leer con el extractor del BATCH 3');
  const leido = extractPdfText(descarga.buffer);
  check(
    leido.text.length > 100,
    'B9.43 Del PDF se puede extraer su texto',
    `caracteres ${leido.text.length}`,
  );
  check(
    leido.text.includes('Resumen de Trayectoria'),
    'B9.44 Contiene el título del documento',
  );
  check(
    leido.text.includes(ctx.est.name.split(' ')[0]),
    'B9.45 Y el nombre del estudiante',
  );
  check(
    leido.text.includes('No constituye historial')
      && leido.text.includes('acreditaci'),
    'B9.46 La advertencia obligatoria va DENTRO del documento (§67)',
    leido.text.slice(-220),
  );

  section('Lo no elegido tampoco sale en el papel');
  const soloBasico = await descargarPdf(ctx.est.token, 'basic');
  const textoBasico = extractPdfText(soloBasico.buffer).text;
  check(
    !textoBasico.includes('Proyecto vac'),
    'B9.47 Un PDF de solo datos básicos no lleva los proyectos (§67)',
  );
  check(
    textoBasico.includes('No constituye historial'),
    'B9.48 Pero la advertencia sí: no es opcional (§67)',
  );

  section('Cada quien descarga el suyo');
  const sinPerfil = await descargarPdf(ctx.docente.token, 'basic');
  check(
    sinPerfil.status === 403 || sinPerfil.status === 404,
    'B9.49 Un docente no tiene resumen de trayectoria que descargar',
    `status ${sinPerfil.status}`,
  );
}

// ===========================================================================
//  Preparación
// ===========================================================================
async function preparar() {
  console.log(`${C.bold}BATCH 9 — Gamificación y resumen contra ${API}${C.r}`);
  const admin = await loginAdmin();

  const area = (await req('POST', '/academic-areas', {
    token: admin,
    body: {
      name: `Automatizacion ${TS}`,
      description: 'Área del escenario de gamificación.',
      tags: ['plc', 'robotica'],
    },
  })).data;
  const skill = (await req('POST', '/skills', {
    token: admin,
    body: { name: `Control de procesos ${TS}`, academicAreaId: area.id },
  })).data;
  if (!area?.id || !skill?.id) throw new Error('No se pudo preparar el área del escenario.');

  const categorias = (await req('GET', '/activity-categories', { token: admin })).data ?? [];
  const taller = categorias.find((c) => c.code === 'taller_academico');
  if (!taller) throw new Error('Falta la categoría taller_academico.');

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
    const perfil = await req('POST', '/profiles/me', {
      token: cuenta.token,
      body: { bio: `Estudiante de ${nombre}.` },
    });
    await req('PATCH', `/profiles/${perfil.data?.id}/institutional-data`, {
      token: admin, body: { semester: semestre },
    });
    return { ...cuenta, profileId: perfil.data?.id };
  };

  const docente = await staff('doc', 'Silvia', 'Rocabado', 'TEACHER', [7]);
  const director = await staff('dir', 'Hernan', 'Quiroga', 'CAREER_DIRECTOR', null);
  const est = await estudiante('est', 'Joaquin', 'Villegas', 7);
  const otro = await estudiante('otro', 'Nadia', 'Careaga', 7);

  const actividades = [];
  for (let i = 0; i < 5; i++) {
    const creada = await req('POST', '/activities', {
      token: docente.token,
      body: {
        title: `Taller de automatizacion ${i} ${TS}`,
        description: 'Actividad del escenario de gamificación.',
        type: 'academica',
        categoryId: taller.id,
        areaId: area.id,
        semesterScope: [7],
      },
    });
    if (creada.status !== 201) {
      throw new Error(`No se pudo crear la actividad ${i}: ${JSON.stringify(creada.data)}`);
    }
    await aprobarActividad(docente.token, director.token, creada.data.id);
    actividades.push(creada.data);
  }

  return { admin, area, skill, docente, est, otro, actividades };
}

async function main() {
  try {
    const ctx = await preparar();
    await accionesValidas(ctx);
    await idempotencia(ctx);
    await independencia(ctx);
    await insignias(ctx);
    await resumen(ctx);
    await pdf(ctx);
  } catch (error) {
    console.error(`\n${C.bad}Error durante la ejecución:${C.r} ${error.message}`);
    process.exitCode = 1;
    return;
  }

  console.log(`\n${'-'.repeat(78)}`);
  if (failures.length === 0) {
    console.log(`${C.ok}${C.bold}  ${passed} verificaciones OK · 0 fallos${C.r}`);
    console.log('  El BATCH 9 queda demostrado de punta a punta.');
  } else {
    console.log(`${C.bad}${C.bold}  ${passed} verificaciones OK · ${failures.length} fallos${C.r}`);
    failures.forEach((f) => console.log(`  ${C.bad}·${C.r} ${f}`));
    process.exitCode = 1;
  }
}

main();
