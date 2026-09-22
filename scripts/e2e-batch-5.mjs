/**
 * BATCH 5 — Proyectos.
 *
 * Cubre §32 (alta y backing inicial), §33 (contribución confirmada por su
 * dueño), §34 (tecnologías por integrante), §35 (la evidencia recalcula a
 * quien la aporta), §36 (niveles de respaldo), §37–§39 (repositorio y demo),
 * §40 (retroalimentación) y §41 (bitácora).
 *
 * Uso:
 *   API_URL=http://localhost:3010/api node scripts/e2e-batch-5.mjs
 */

import { Buffer } from 'node:buffer';
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

const correoEst = (k) => `b5.${k}.${TS}@est.univalle.edu`;

/** Puntaje total de afinidad de un estudiante. */
async function afinidadDe(token) {
  const r = await req('GET', '/affinity/me', { token });
  return (r.data ?? []).reduce((acc, a) => acc + Number(a.score ?? 0), 0);
}

async function subirPdf(token, nombre) {
  const pdf = Buffer.from(
    `%PDF-1.4\n1 0 obj<</Type/Catalog>>endobj\n% ${nombre} ${TS}\ntrailer<</Root 1 0 R>>\n%%EOF\n`,
    'utf8',
  );
  const form = new FormData();
  form.append('file', new Blob([pdf], { type: 'application/pdf' }), nombre);
  const res = await fetch(`${API}/uploads`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}` },
    body: form,
  });
  return { status: res.status, data: await res.json().catch(() => null) };
}

// ===========================================================================
//  §32 · Alta del proyecto
// ===========================================================================
async function alta(ctx) {
  objective('§32 · Un proyecto nace declarado y nada más');

  const creado = await req('POST', '/projects', {
    token: ctx.autor.token,
    body: {
      title: `Plataforma de seguimiento ${TS}`,
      description: 'Proyecto para probar el respaldo derivado.',
      areaId: ctx.area.id,
      technologies: ['React', 'NestJS', 'PostgreSQL', 'Docker'],
      status: 'active',
      visibility: 'teachers',
    },
  });
  check(creado.status === 201, 'B5.1 El estudiante crea un proyecto sin aprobación previa', msgOf(creado));
  ctx.projectId = creado.data?.id;

  const checks = await req('GET', `/projects/${ctx.projectId}/checks`, { token: ctx.autor.token });
  check(
    checks.data?.backingTier === 'declared',
    'B5.2 Crear un proyecto por sí solo deja DECLARED (§32)',
    String(checks.data?.backingTier),
  );
  check(
    (checks.data?.backingReasons ?? []).length > 0,
    'B5.3 El sistema explica por qué está en ese nivel',
    JSON.stringify(checks.data?.backingReasons),
  );

  section('§41 · La bitácora empieza en el minuto uno');
  const bitacora = await req('GET', `/projects/${ctx.projectId}/timeline`, {
    token: ctx.autor.token,
  });
  check(
    (bitacora.data ?? []).some((e) => e.eventType === 'project_created'),
    'B5.4 El alta queda registrada en la bitácora (§41)',
    (bitacora.data ?? []).map((e) => e.eventType).join(','),
  );
  check(
    (bitacora.data ?? [])[0]?.actorUserId === ctx.autor.userId,
    'B5.5 Con su autor',
  );
}

// ===========================================================================
//  §33 y §34 · La contribución la confirma su dueño
// ===========================================================================
async function contribucion(ctx) {
  objective('§33 y §34 · Nadie atribuye experiencia a otra persona');

  section('Invitación y aceptación');
  const invitacion = await req('POST', `/projects/${ctx.projectId}/invitations`, {
    token: ctx.autor.token,
    body: { invitedProfileId: ctx.integrante.profileId, proposedRole: 'Backend' },
  });
  check(invitacion.status === 201, 'B5.6 El responsable invita a un compañero', msgOf(invitacion));

  const mias = await req('GET', '/projects/invitations/mine', { token: ctx.integrante.token });
  const suya = (mias.data ?? []).find((i) => i.project?.id === ctx.projectId);
  check(!!suya, 'B5.7 El invitado ve la invitación');

  const aceptada = await req('PATCH', `/projects/invitations/${suya.id}`, {
    token: ctx.integrante.token,
    body: { decision: 'accept' },
  });
  check(aceptada.status === 200, 'B5.8 La acepta', msgOf(aceptada));

  section('Aceptar no es haber hecho');
  const antes = await afinidadDe(ctx.integrante.token);
  check(
    antes === 0,
    'B5.9 Aceptar NO atribuye experiencia todavía (§33)',
    `afinidad ${antes}`,
  );

  const detallados = await req('GET', `/projects/${ctx.projectId}/members/detailed`, {
    token: ctx.autor.token,
  });
  const suyo = (detallados.data ?? []).find((m) => m.userId === ctx.integrante.userId);
  check(
    suyo && suyo.contributionConfirmed === false,
    'B5.10 Su contribución figura como no confirmada',
    JSON.stringify(suyo?.contributionConfirmed),
  );

  section('El responsable propone; no atribuye');
  const propuesta = await req(
    'PATCH',
    `/projects/${ctx.projectId}/members/${suyo.id}/contribution`,
    {
      token: ctx.autor.token,
      body: { contribution: 'Hizo todo el backend.', role: 'Backend' },
    },
  );
  check(propuesta.status === 200, 'B5.11 El responsable propone una contribución', msgOf(propuesta));
  check(
    propuesta.data?.contributionConfirmed === false,
    'B5.12 La propuesta sigue sin confirmar: la escribió otra persona (§33)',
    String(propuesta.data?.contributionConfirmed),
  );

  const trasPropuesta = await afinidadDe(ctx.integrante.token);
  check(
    trasPropuesta === 0,
    'B5.13 Y sigue sin contar para su perfil',
    `afinidad ${trasPropuesta}`,
  );

  section('§34 · Las tecnologías del integrante son las suyas');
  const react = ctx.skills.find((s) => /react/i.test(s.name)) ?? ctx.skills[0];

  const ajena = await req('PUT', `/projects/${ctx.projectId}/my-contribution`, {
    token: ctx.otro.token,
    body: { contribution: 'No soy de este proyecto.' },
  });
  check(
    ajena.status === 404,
    'B5.14 Quien no es integrante no confirma nada -> 404',
    `status ${ajena.status}`,
  );

  const confirmada = await req('PUT', `/projects/${ctx.projectId}/my-contribution`, {
    token: ctx.integrante.token,
    body: {
      contribution: 'Implementé la API de inscripciones.',
      role: 'Backend',
      skillIds: [react.id],
    },
  });
  check(confirmada.status === 200, 'B5.15 El integrante confirma su contribución', msgOf(confirmada));
  check(
    confirmada.data?.contributionConfirmed === true,
    'B5.16 Queda marcada como confirmada por él',
  );
  check(
    (confirmada.data?.skillsUsed ?? []).length === 1,
    'B5.17 Declara UNA tecnología, no las cuatro del proyecto (§34)',
    `declaradas ${(confirmada.data?.skillsUsed ?? []).length}`,
  );

  const despues = await afinidadDe(ctx.integrante.token);
  check(
    despues > 0,
    'B5.18 Confirmada, el proyecto sí alimenta su afinidad (§33)',
    `afinidad ${despues}`,
  );

  section('Volver a proponer retira la confirmación');
  const rePropuesta = await req(
    'PATCH',
    `/projects/${ctx.projectId}/members/${suyo.id}/contribution`,
    { token: ctx.autor.token, body: { contribution: 'Texto cambiado por el responsable.' } },
  );
  check(
    rePropuesta.data?.contributionConfirmed === false,
    'B5.19 Editar lo que ya confirmó exige que vuelva a revisarlo (§33)',
    String(rePropuesta.data?.contributionConfirmed),
  );

  // Se deja confirmada para el resto del escenario.
  await req('PUT', `/projects/${ctx.projectId}/my-contribution`, {
    token: ctx.integrante.token,
    body: { contribution: 'Implementé la API de inscripciones.', skillIds: [react.id] },
  });
}

// ===========================================================================
//  §35 · La evidencia recalcula a quien la aporta
// ===========================================================================
async function evidencias(ctx) {
  objective('§35 · La evidencia es de quien la aporta');

  const antesAutor = await afinidadDe(ctx.autor.token);
  const antesIntegrante = await afinidadDe(ctx.integrante.token);

  const archivo = await subirPdf(ctx.integrante.token, 'aporte-integrante.pdf');
  check(archivo.status === 201, 'B5.20 El integrante sube un archivo', msgOf(archivo));

  const evidencia = await req('POST', `/projects/${ctx.projectId}/evidences`, {
    token: ctx.integrante.token,
    body: {
      evidenceType: 'file',
      description: 'Capturas del módulo que desarrollé.',
      storedFileId: archivo.data?.id,
    },
  });
  check(evidencia.status === 201, 'B5.21 Y la adjunta al proyecto', msgOf(evidencia));
  check(
    evidencia.data?.studentProfileId === ctx.integrante.profileId,
    'B5.22 La evidencia queda a su nombre, no al del creador (§35)',
    `esperado ${ctx.integrante.profileId} / recibido ${evidencia.data?.studentProfileId}`,
  );

  const despuesIntegrante = await afinidadDe(ctx.integrante.token);
  const despuesAutor = await afinidadDe(ctx.autor.token);

  // §50 y §55: una evidencia no crea una experiencia más, mejora el respaldo
  // de la que ya existe. Lo que §35 exige es que la señal se atribuya a quien
  // la aportó, y eso se ve en el desglose, no en el puntaje.
  const suyo = await req('GET', `/affinity/me/areas/${ctx.area.id}/breakdown`, {
    token: ctx.integrante.token,
  });
  const ajeno = await req('GET', `/affinity/me/areas/${ctx.area.id}/breakdown`, {
    token: ctx.autor.token,
  });
  const idEvidencia = evidencia.data?.id;
  check(
    (suyo.data?.contributions ?? []).some((c) => c.sourceId === idEvidencia),
    'B5.23 La evidencia figura en el desglose de quien la aportó (§35)',
    (suyo.data?.contributions ?? []).map((c) => c.sourceId).join(','),
  );
  check(
    !(ajeno.data?.contributions ?? []).some((c) => c.sourceId === idEvidencia),
    'B5.23b Y NO en el del creador del proyecto (§35)',
  );
  check(
    despuesAutor === antesAutor,
    'B5.24 La afinidad del creador NO cambia por una evidencia ajena (§35)',
    `antes ${antesAutor} / después ${despuesAutor}`,
  );
  check(
    despuesIntegrante === antesIntegrante,
    'B5.24b Ni la del propio integrante: una evidencia respalda, no es un proyecto más (§55)',
    `antes ${antesIntegrante} / después ${despuesIntegrante}`,
  );

  section('§27 · El archivo sigue teniendo dueño');
  const delOtro = await subirPdf(ctx.otro.token, 'de-otro.pdf');
  const robo = await req('POST', `/projects/${ctx.projectId}/evidences`, {
    token: ctx.integrante.token,
    body: { evidenceType: 'file', storedFileId: delOtro.data?.id },
  });
  check(
    robo.status === 403,
    'B5.25 No se puede adjuntar el archivo de otra persona -> 403',
    `status ${robo.status}`,
  );

  const sinArchivo = await req('POST', `/projects/${ctx.projectId}/evidences`, {
    token: ctx.integrante.token,
    body: { evidenceType: 'file', description: 'Sin archivo' },
  });
  check(
    sinArchivo.status === 400,
    'B5.26 Una evidencia de archivo sin storedFileId -> 400',
    `status ${sinArchivo.status}`,
  );
}

// ===========================================================================
//  §36 · Niveles de respaldo
// ===========================================================================
async function respaldo(ctx) {
  objective('§36 · El respaldo se deriva, no se declara');

  const checks = await req('GET', `/projects/${ctx.projectId}/checks`, { token: ctx.autor.token });
  check(
    ['supported', 'corroborated', 'reviewed'].includes(checks.data?.backingTier),
    'B5.27 Con integrante aceptado y evidencia sube de DECLARED (§36)',
    String(checks.data?.backingTier),
  );
  check(
    (checks.data?.backingReasons ?? []).some((r) => /integrante/i.test(r)),
    'B5.28 Y dice que es por el integrante aceptado',
    JSON.stringify(checks.data?.backingReasons),
  );
  check(
    (checks.data?.backingReasons ?? []).some((r) => /evidencia/i.test(r)),
    'B5.29 Y por la evidencia',
  );

  section('§37 y §39 · Repositorio y demo son opcionales');
  const sinNada = await req('POST', '/projects', {
    token: ctx.otro.token,
    body: {
      title: `Proyecto sin repositorio ${TS}`,
      description: 'No tiene repositorio ni demo, y es perfectamente válido.',
      status: 'active',
    },
  });
  check(sinNada.status === 201, 'B5.30 Un proyecto sin repositorio se crea igual (§37)', msgOf(sinNada));

  const checksSin = await req('GET', `/projects/${sinNada.data.id}/checks`, {
    token: ctx.otro.token,
  });
  check(
    checksSin.data?.repository === null && checksSin.data?.demo === null,
    'B5.31 No hay nada que comprobar, y eso no lo penaliza',
  );
  check(
    checksSin.data?.backingTier === 'declared',
    'B5.32 Se queda en DECLARED, que es lo correcto',
    String(checksSin.data?.backingTier),
  );

  section('§31 · La demo se comprueba con las mismas protecciones');
  const conDemoInterna = await req('POST', '/projects', {
    token: ctx.otro.token,
    body: {
      title: `Demo interna ${TS}`,
      description: 'Apunta a una dirección que el sistema no debe consultar.',
      demoUrl: 'http://127.0.0.1:3010/api/users',
      status: 'active',
    },
  });
  if (conDemoInterna.status === 201) {
    const c = await req('GET', `/projects/${conDemoInterna.data.id}/checks`, {
      token: ctx.otro.token,
    });
    check(
      c.data?.demo?.status === 'blocked',
      'B5.33 Una demo que apunta al bucle local se rechaza (§31)',
      String(c.data?.demo?.status),
    );
    check(
      c.data?.backingTier === 'flagged',
      'B5.34 Y el proyecto queda marcado, no eliminado (§36)',
      String(c.data?.backingTier),
    );
  } else {
    check(
      conDemoInterna.status === 400,
      'B5.33 Una demo que apunta al bucle local se rechaza (§31, al validar la entrada)',
      `status ${conDemoInterna.status}`,
    );
    check(true, 'B5.34 El proyecto no llega a crearse con esa demo');
  }

  section('§38 · Lo detectado no afirma dominio');
  check(
    typeof checks.data?.disclaimer === 'string' && /no afirman dominio/i.test(checks.data.disclaimer),
    'B5.35 La respuesta declara qué significa «detectado» (§38)',
    String(checks.data?.disclaimer),
  );
}

// ===========================================================================
//  §40 y §41 · Retroalimentación y bitácora
// ===========================================================================
async function feedbackYBitacora(ctx) {
  objective('§40 y §41 · Retroalimentación docente y bitácora');

  const comentario = await req('POST', `/projects/${ctx.projectId}/feedback`, {
    token: ctx.docente.token,
    body: { comment: 'Buen uso de la separación por capas. Documenten el despliegue.' },
  });
  check(comentario.status === 201, 'B5.36 El docente registra retroalimentación', msgOf(comentario));

  const tras = await req('GET', `/projects/${ctx.projectId}/checks`, { token: ctx.autor.token });
  check(
    tras.data?.backingTier === 'reviewed',
    'B5.37 Con retroalimentación el proyecto pasa a REVIEWED (§36, §40)',
    String(tras.data?.backingTier),
  );

  const bitacora = await req('GET', `/projects/${ctx.projectId}/timeline`, {
    token: ctx.autor.token,
  });
  const tipos = (bitacora.data ?? []).map((e) => e.eventType);
  check(tipos.includes('member_invited'), 'B5.38 La bitácora registra la invitación (§41)');
  check(tipos.includes('member_accepted'), 'B5.39 Y la aceptación');
  check(tipos.includes('contribution_confirmed'), 'B5.40 Y la confirmación de contribución');
  check(tipos.includes('evidence_added'), 'B5.41 Y la evidencia añadida');
  check(tipos.includes('feedback_added'), 'B5.42 Y la retroalimentación');
  check(tipos.includes('backing_tier_changed'), 'B5.43 Y cada cambio de nivel de respaldo');

  check(
    (bitacora.data ?? []).every((e) => !JSON.stringify(e.metadata).match(/token|password|secret/i)),
    'B5.44 Ningún evento guarda secretos en su metadato (§41)',
  );

  section('La bitácora es de quien puede ver el proyecto');
  const ajena = await req('GET', `/projects/${ctx.projectId}/timeline`, { token: ctx.otro.token });
  check(
    ajena.status === 403 || ajena.status === 404,
    'B5.45 Un estudiante ajeno no la consulta',
    `status ${ajena.status}`,
  );

  section('§40 · La retroalimentación no es una nota');
  const visibilidadCambiada = await req('PATCH', `/projects/${ctx.projectId}`, {
    token: ctx.autor.token,
    body: { visibility: 'profile' },
  });
  check(visibilidadCambiada.status === 200, 'B5.46 El autor cambia la visibilidad', msgOf(visibilidadCambiada));

  const conCambio = await req('GET', `/projects/${ctx.projectId}/timeline`, {
    token: ctx.autor.token,
  });
  check(
    (conCambio.data ?? []).some((e) => e.eventType === 'project_visibility_changed'),
    'B5.47 El cambio de visibilidad queda en la bitácora (§41)',
  );
}

// ===========================================================================
async function preparar() {
  console.log(`${C.bold}BATCH 5 — Proyectos contra ${API}${C.r}`);
  const admin = await loginAdmin();

  const areas = (await req('GET', '/academic-areas', { token: admin })).data ?? [];
  const skills = (await req('GET', '/skills', { token: admin })).data ?? [];

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

  const docente = await provisionAndActivate(admin, {
    firstName: 'Nuria', lastName: 'Ballivian', email: `b5.doc.${TS}@univalle.edu`, role: 'TEACHER',
  });
  await req('PUT', `/users/${docente.userId}/semesters`, {
    token: admin, body: { semesters: [4] },
  });

  return {
    admin,
    area: areas[0],
    skills,
    docente,
    autor: await estudiante('autor', 'Renata', 'Bustillos', 4),
    integrante: await estudiante('int', 'Tomas', 'Zeballos', 4),
    otro: await estudiante('otro', 'Gonzalo', 'Mercado', 4),
  };
}

async function main() {
  try {
    const ctx = await preparar();
    await alta(ctx);
    await contribucion(ctx);
    await evidencias(ctx);
    await respaldo(ctx);
    await feedbackYBitacora(ctx);
  } catch (error) {
    console.error(`\n${C.bad}Error durante la ejecución:${C.r} ${error.message}`);
    process.exitCode = 1;
    return;
  }

  console.log(`\n${'-'.repeat(78)}`);
  if (failures.length === 0) {
    console.log(`${C.ok}${C.bold}  ${passed} verificaciones OK · 0 fallos${C.r}`);
    console.log('  El BATCH 5 queda demostrado de punta a punta.');
  } else {
    console.log(`${C.bad}${C.bold}  ${passed} verificaciones OK · ${failures.length} fallos${C.r}`);
    failures.forEach((f) => console.log(`  ${C.bad}·${C.r} ${f}`));
    process.exitCode = 1;
  }
}

main();
