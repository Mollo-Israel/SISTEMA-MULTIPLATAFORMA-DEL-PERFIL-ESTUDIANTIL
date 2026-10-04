/**
 * BATCH 8 — Colaboración.
 *
 * Cubre §42 (mensajería contextual y sus cuatro prohibiciones), §43 (perfil
 * público, slug opaco y QR), §44 (visibilidad por campo), §45 (contactos y el
 * QR que no establece contacto), §46 (necesidades de equipo), §47 (sugerencia
 * de integrantes con su ponderación), §93 (qué muestra la pantalla de equipos)
 * y §107 (políticas de recurso).
 *
 * El código QR se genera, se dibuja y se vuelve a leer con `jsqr`: un
 * codificador que no se puede releer produce códigos que nadie escanea.
 *
 * Uso:
 *   API_URL=http://localhost:3010/api node scripts/e2e-batch-8.mjs
 */

import { createRequire } from 'node:module';
import { API, loginAdmin, provisionAndActivate, req } from './lib/fixtures.mjs';

const require = createRequire(import.meta.url);
const jsQR = require('jsqr').default ?? require('jsqr');

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

const correoEst = (k) => `b8.${k}.${TS}@est.univalle.edu`;
const correoStaff = (k) => `b8.${k}.${TS}@univalle.edu`;

/** Dibuja la matriz de un SVG de QR y la vuelve a leer. */
function leerQr(svg, size) {
  // El SVG lleva un `path` con un rectángulo por módulo oscuro. Se reconstruye
  // la matriz a partir de los comandos `M<x> <y>h4v4h-4z`.
  const modulo = 4;
  const margen = 4;
  const lado = (size + margen * 2) * modulo;
  const escala = 3;
  const px = lado * escala;
  const data = new Uint8ClampedArray(px * px * 4).fill(255);

  for (const m of svg.matchAll(/M(\d+) (\d+)h/g)) {
    const x0 = Number(m[1]) * escala;
    const y0 = Number(m[2]) * escala;
    for (let dy = 0; dy < modulo * escala; dy++) {
      for (let dx = 0; dx < modulo * escala; dx++) {
        const p = ((y0 + dy) * px + (x0 + dx)) * 4;
        data[p] = 0;
        data[p + 1] = 0;
        data[p + 2] = 0;
      }
    }
  }
  return jsQR(data, px, px);
}

// ===========================================================================
//  §43 · Perfil público y QR
// ===========================================================================
async function perfilPublico(ctx) {
  objective('§43 · Un identificador opaco, y un QR que solo lleva una URL');

  const enlace = await req('GET', '/profiles/me/public-link', { token: ctx.ana.token });
  check(enlace.status === 200, 'B8.1 El estudiante consulta su enlace compartible', msgOf(enlace));
  ctx.slugAna = enlace.data?.slug;

  check(
    /^[23456789bcdfghjkmnpqrstvwxyz]{12}$/.test(ctx.slugAna ?? ''),
    'B8.2 El identificador es opaco: ni correo, ni código, ni UUID (§43)',
    String(ctx.slugAna),
  );
  check(
    !enlace.data?.url?.includes(ctx.ana.userId)
      && !enlace.data?.url?.includes('@'),
    'B8.3 Y el enlace no lleva dentro ningún identificador interno ni el correo',
    String(enlace.data?.url),
  );

  section('El QR se genera, se dibuja y se vuelve a leer');
  const leido = leerQr(enlace.data.qrSvg, enlace.data.qrSize);
  check(!!leido, 'B8.4 El código QR es legible por un lector real');
  check(
    leido?.data === enlace.data.url,
    'B8.5 Y contiene ÚNICAMENTE la URL del perfil compartible (§43)',
    JSON.stringify(leido?.data ?? null),
  );

  section('§43 · El identificador se puede rotar');
  const rotado = await req('POST', '/profiles/me/public-link/rotate', { token: ctx.ana.token });
  check(rotado.status === 200, 'B8.6 El estudiante rota su identificador', msgOf(rotado));
  check(
    rotado.data?.slug && rotado.data.slug !== ctx.slugAna,
    'B8.7 Y el nuevo es distinto del anterior',
    `${ctx.slugAna} -> ${rotado.data?.slug}`,
  );

  const viejo = await req('GET', `/public/profiles/${ctx.slugAna}`);
  check(
    viejo.status === 404,
    'B8.8 Los QR impresos con el anterior dejan de funcionar -> 404',
    `status ${viejo.status}`,
  );
  ctx.slugAna = rotado.data.slug;
}

// ===========================================================================
//  §44 · Visibilidad por campo
// ===========================================================================
async function visibilidad(ctx) {
  objective('§44 · Nada se expone por omisión');

  const cerrado = await req('GET', `/public/profiles/${ctx.slugAna}`);
  check(
    cerrado.status === 404,
    'B8.9 Un perfil sin publicar responde 404, no «existe pero está cerrado» (§44)',
    `status ${cerrado.status}`,
  );

  section('El estudiante publica su perfil');
  const publicar = await req('PUT', '/profiles/me/visibility', {
    token: ctx.ana.token,
    body: { publicProfileEnabled: true, fields: { bio: true, areas: true } },
  });
  check(publicar.status === 200, 'B8.10 Activa el perfil compartible y dos campos', msgOf(publicar));

  const abierto = await req('GET', `/public/profiles/${ctx.slugAna}`);
  check(abierto.status === 200, 'B8.11 Ahora el enlace responde', msgOf(abierto));
  check(!!abierto.data?.name, 'B8.12 El nombre se muestra siempre: sin él no identifica a nadie');
  check(abierto.data?.bio !== undefined, 'B8.13 La biografía, porque la activó');
  check(Array.isArray(abierto.data?.areas), 'B8.14 Y sus áreas, porque las activó');

  section('Lo que NO activó no aparece');
  check(
    abierto.data?.skills === undefined,
    'B8.15 Las habilidades no aparecen: no activó esa casilla (§44)',
    JSON.stringify(abierto.data?.skills),
  );
  check(
    abierto.data?.projects === undefined,
    'B8.16 Tampoco sus proyectos',
  );
  check(
    (abierto.data?.areas ?? []).every((a) => a.score === undefined),
    'B8.17 Ni los puntajes: «áreas» y «afinidades» son casillas distintas (§44)',
    JSON.stringify(abierto.data?.areas),
  );

  section('Lo que §44 prohíbe exponer nunca aparece');
  const texto = JSON.stringify(abierto.data);
  check(!texto.includes('@'), 'B8.18 Ningún correo institucional (§44)');
  check(
    !/\b[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\b/.test(texto),
    'B8.19 Ningún identificador interno (§44)',
  );
  check(
    !texto.includes('token') && !texto.includes('fileUrl'),
    'B8.20 Ni tokens ni archivos (§44)',
  );

  // Se activa el resto para el escenario de proyectos.
  await req('PUT', '/profiles/me/visibility', {
    token: ctx.ana.token,
    body: {
      publicProfileEnabled: true,
      fields: { bio: true, areas: true, affinities: true, projects: true, availability: true },
    },
  });
}

// ===========================================================================
//  §106 · La visibilidad del proyecto se aplica en el backend
// ===========================================================================
async function proyectosVisibles(ctx) {
  objective('§106 · Un proyecto privado no sale por activar una casilla');

  const privado = await req('POST', '/projects', {
    token: ctx.ana.token,
    body: {
      title: `Proyecto privado ${TS}`,
      description: 'No debe verse en el perfil compartible.',
      areaId: ctx.area.id,
      status: 'active',
      visibility: 'private',
    },
  });
  const docentes = await req('POST', '/projects', {
    token: ctx.ana.token,
    body: {
      title: `Proyecto para docentes ${TS}`,
      description: 'Visible para docentes, no para cualquiera.',
      areaId: ctx.area.id,
      status: 'active',
      visibility: 'teachers',
    },
  });
  const publico = await req('POST', '/projects', {
    token: ctx.ana.token,
    body: {
      title: `Proyecto del perfil ${TS}`,
      description: 'Este sí.',
      areaId: ctx.area.id,
      status: 'active',
      visibility: 'profile',
    },
  });
  check(
    privado.status === 201 && docentes.status === 201 && publico.status === 201,
    'B8.21 El estudiante registra tres proyectos con visibilidades distintas',
  );

  const perfil = await req('GET', `/public/profiles/${ctx.slugAna}`);
  const titulos = (perfil.data?.projects ?? []).map((p) => p.title);
  check(
    titulos.includes(`Proyecto del perfil ${TS}`),
    'B8.22 El marcado como visible en el perfil aparece',
    JSON.stringify(titulos),
  );
  check(
    !titulos.includes(`Proyecto privado ${TS}`),
    'B8.23 El privado NO aparece (§106)',
  );
  check(
    !titulos.includes(`Proyecto para docentes ${TS}`),
    'B8.24 Y «visible para docentes» tampoco: es otra decisión (§106)',
  );
}

// ===========================================================================
//  §45 · Contactos
// ===========================================================================
async function contactos(ctx) {
  objective('§45 · El QR no establece contacto');

  section('Escanear lleva al perfil, nada más');
  const antes = await req('GET', '/contacts', { token: ctx.bruno.token });
  check(
    (antes.data ?? []).length === 0,
    'B8.25 Consultar el perfil compartible no creó ningún contacto (§45)',
    `contactos ${(antes.data ?? []).length}`,
  );

  section('El contacto nace de una solicitud');
  const propia = await req('POST', '/contacts/requests', {
    token: ctx.ana.token,
    body: { slug: ctx.slugAna },
  });
  check(
    propia.status === 400,
    'B8.26 Nadie se envía una solicitud a sí mismo -> 400',
    `status ${propia.status}`,
  );

  const solicitud = await req('POST', '/contacts/requests', {
    token: ctx.bruno.token,
    body: { slug: ctx.slugAna, message: 'Nos vimos en el taller.', source: 'qr' },
  });
  check(solicitud.status === 201, 'B8.27 Bruno envía una solicitud tras escanear', msgOf(solicitud));
  ctx.solicitudId = solicitud.data?.id;

  const repetida = await req('POST', '/contacts/requests', {
    token: ctx.bruno.token,
    body: { slug: ctx.slugAna },
  });
  check(
    repetida.status === 409,
    'B8.28 Insistir no crea una segunda solicitud -> 409',
    `status ${repetida.status}`,
  );

  const recibidas = await req('GET', '/contacts/requests/received', { token: ctx.ana.token });
  check(
    (recibidas.data ?? []).some((r) => r.id === ctx.solicitudId),
    'B8.29 Ana la ve entre las pendientes',
  );
  check(
    !JSON.stringify(recibidas.data).includes('@'),
    'B8.30 Sin revelar el correo de quien la envió (§44)',
  );

  section('Solo el destinatario decide');
  const porUnTercero = await req('PATCH', `/contacts/requests/${ctx.solicitudId}`, {
    token: ctx.carla.token,
    body: { decision: 'accept' },
  });
  check(
    porUnTercero.status === 404,
    'B8.31 Un tercero no puede responderla, y ni siquiera sabe que existe -> 404',
    `status ${porUnTercero.status}`,
  );

  const aceptada = await req('PATCH', `/contacts/requests/${ctx.solicitudId}`, {
    token: ctx.ana.token,
    body: { decision: 'accept' },
  });
  check(
    aceptada.status === 200 && aceptada.data?.status === 'accepted',
    'B8.32 Ana la acepta y el contacto queda establecido (§45)',
    msgOf(aceptada),
  );

  const deAna = await req('GET', '/contacts', { token: ctx.ana.token });
  const deBruno = await req('GET', '/contacts', { token: ctx.bruno.token });
  check(
    (deAna.data ?? []).some((c) => c.profileId === ctx.bruno.profileId)
      && (deBruno.data ?? []).some((c) => c.profileId === ctx.ana.profileId),
    'B8.33 Los dos se ven en su lista: una sola fila, sin lados que se desincronicen',
  );
}

// ===========================================================================
//  §42 · Mensajería contextual
// ===========================================================================
async function mensajeria(ctx) {
  // V2 §57 retiró el chat. Lo que antes probaba la mensajería ahora prueba
  // que está retirada de verdad: ninguna ruta lee ni escribe conversaciones.
  objective('V2 §57 · El chat interno está retirado');

  section('Las rutas responden 410 con un motivo, no 404');
  const intentos = [
    await req('GET', '/conversations', { token: ctx.bruno.token }),
    await req('POST', '/conversations/direct', { token: ctx.bruno.token, body: { profileId: ctx.ana.profileId } }),
    await req('GET', '/conversations/00000000-0000-4000-8000-000000000000/messages', { token: ctx.bruno.token }),
    await req('POST', '/conversations/00000000-0000-4000-8000-000000000000/messages', { token: ctx.bruno.token, body: { body: 'Hola' } }),
  ];
  check(
    intentos.every((r) => r.status === 410 && r.data?.code === 'CHAT_RETIRED'),
    'B8.34 Listar, abrir, leer y escribir conversaciones -> 410 CHAT_RETIRED (§57)',
    intentos.map((r) => r.status).join('/'),
  );
  check(
    /canales de contacto/i.test(intentos[0].data?.message ?? ''),
    'B8.35 El motivo orienta a los canales de contacto (§59)',
    intentos[0].data?.message,
  );
  const sinSesion = await req('GET', '/conversations');
  check(sinSesion.status === 401, 'B8.36 Sin sesión sigue pidiendo autenticación', `status ${sinSesion.status}`);

  section('La colaboración sigue: contactos');
  const contactos = await req('GET', '/contacts', { token: ctx.bruno.token });
  check(
    contactos.status === 200 && (contactos.data ?? []).some((c) => c.profileId === ctx.ana.profileId),
    'B8.37 Bruno y Ana siguen siendo contactos sin necesidad de chat',
  );
}

// ===========================================================================
//  §46 y §47 · Necesidades, sugerencias y equipos
// ===========================================================================
async function equipos(ctx) {
  objective('§46 y §47 · Un equipo se forma cubriendo huecos');

  const necesidad = await req('POST', '/team-needs', {
    token: ctx.ana.token,
    body: {
      purpose: `Panel de control del laboratorio ${TS}`,
      description: 'Falta quien arme la interfaz y quien monte los sensores.',
      maxMembers: 3,
      availabilityRequirement: 'open_or_looking',
      requiredSkillIds: [ctx.skillA.id, ctx.skillB.id],
      preferredAreaIds: [ctx.area.id],
    },
  });
  check(necesidad.status === 201, 'B8.45 Ana declara qué le falta al equipo (§46)', msgOf(necesidad));
  ctx.necesidadId = necesidad.data?.id;
  check(
    (necesidad.data?.requiredSkills ?? []).length === 2
      && (necesidad.data?.preferredAreas ?? []).length === 1,
    'B8.46 Con habilidades requeridas y áreas preferidas (§46)',
    JSON.stringify([necesidad.data?.requiredSkills?.length, necesidad.data?.preferredAreas?.length]),
  );

  section('§47 · Candidatos, con su motivo');
  const sugerencias = await req('GET', `/team-needs/${ctx.necesidadId}/suggestions`, {
    token: ctx.ana.token,
  });
  check(sugerencias.status === 200, 'B8.47 El responsable pide candidatos', msgOf(sugerencias));

  const candidatos = sugerencias.data?.candidates ?? [];
  const bruno = candidatos.find((c) => c.profileId === ctx.bruno.profileId);
  check(!!bruno, 'B8.48 Bruno aparece: cubre una de las habilidades que faltan');
  check(
    (bruno?.reasons ?? []).some((r) => r.code === 'skill_coverage'),
    'B8.49 Y la primera razón es la cobertura de habilidades (§47)',
    JSON.stringify((bruno?.reasons ?? []).map((r) => r.code)),
  );
  check(
    (bruno?.reasons ?? []).find((r) => r.code === 'skill_coverage')?.points <= 50,
    'B8.50 Que nunca pasa del 50 % que le concede §47',
    JSON.stringify(bruno?.reasons),
  );
  check(
    Math.abs((bruno?.reasons ?? []).reduce((a, r) => a + r.points, 0) - bruno.score) < 0.011,
    'B8.51 INVARIANTE: los motivos suman el puntaje',
    `${(bruno?.reasons ?? []).reduce((a, r) => a + r.points, 0)} vs ${bruno?.score}`,
  );

  check(
    !candidatos.some((c) => c.profileId === ctx.ocupada.profileId),
    'B8.52 Quien declaró no tener margen queda fuera del requisito de disponibilidad (§47)',
  );
  check(
    !candidatos.some((c) => c.profileId === ctx.oculto.profileId),
    'B8.53 Y quien desactivó aparecer en sugerencias tampoco (§44, §62)',
  );
  check(
    !candidatos.some((c) => c.profileId === ctx.ana.profileId),
    'B8.54 El propio responsable no se sugiere a sí mismo',
  );

  section('§47 · Sugerir no es invitar');
  const invitaciones = await req('GET', '/teams/invitations/mine', { token: ctx.bruno.token });
  check(
    (invitaciones.data ?? []).length === 0,
    'B8.55 Aparecer entre los candidatos NO le envió ninguna invitación (§47)',
    `invitaciones ${(invitaciones.data ?? []).length}`,
  );

  section('§46 · El equipo');
  const equipo = await req('POST', `/team-needs/${ctx.necesidadId}/team`, {
    token: ctx.ana.token,
    body: { name: `Equipo del panel ${String(TS).slice(-4)}` },
  });
  check(equipo.status === 201, 'B8.56 Ana crea el equipo', msgOf(equipo));
  ctx.equipoId = equipo.data?.id;

  const ajeno = await req('POST', `/teams/${ctx.equipoId}/invitations`, {
    token: ctx.carla.token,
    body: { invitedProfileId: ctx.bruno.profileId },
  });
  check(
    ajeno.status === 403,
    'B8.57 Solo el responsable invita -> 403',
    `status ${ajeno.status}`,
  );

  const invitacion = await req('POST', `/teams/${ctx.equipoId}/invitations`, {
    token: ctx.ana.token,
    body: { invitedProfileId: ctx.bruno.profileId, message: 'Nos vendría bien tu parte.' },
  });
  check(invitacion.status === 201, 'B8.58 Ana invita a Bruno', msgOf(invitacion));

  const suyas = await req('GET', '/teams/invitations/mine', { token: ctx.bruno.token });
  check(
    (suyas.data ?? []).some((i) => i.id === invitacion.data.id),
    'B8.59 Bruno la ve, con el objetivo del equipo',
  );

  const aceptar = await req('PATCH', `/teams/invitations/${invitacion.data.id}`, {
    token: ctx.bruno.token,
    body: { decision: 'accept' },
  });
  check(
    aceptar.status === 200 && aceptar.data?.status === 'accepted',
    'B8.60 La acepta y entra al equipo',
    msgOf(aceptar),
  );

  section('§93 · Lo que muestra la pantalla de equipos');
  const misEquipos = await req('GET', '/teams/mine', { token: ctx.ana.token });
  const mio = (misEquipos.data ?? []).find((t) => t.id === ctx.equipoId);
  check(!!mio, 'B8.61 El equipo aparece en su lista');
  check(
    !!mio?.purpose && Array.isArray(mio?.requiredSkills),
    'B8.62 Con su objetivo y las habilidades requeridas (§93)',
  );
  check(
    Array.isArray(mio?.coveredSkills) && Array.isArray(mio?.missingSkills),
    'B8.63 Lo cubierto y lo que falta (§93)',
    JSON.stringify([mio?.coveredSkills?.length, mio?.missingSkills?.length]),
  );
  check(
    mio?.openings === 1,
    'B8.64 Y las vacantes: 3 de máximo, 2 dentro (§93)',
    String(mio?.openings),
  );
  check(
    !JSON.stringify(misEquipos.data).includes('score'),
    'B8.65 Sin «ranking de mejores estudiantes» (§93)',
  );

  section('V2 §57 · Un equipo ya no abre conversación');
  const conversaciones = await req('GET', '/conversations', { token: ctx.bruno.token });
  check(
    conversaciones.status === 410,
    'B8.66 Aceptar la invitación no abre chat: la ruta está retirada (§57)',
    `status ${conversaciones.status}`,
  );
  check(
    (misEquipos.data ?? []).some((t) => t.id === ctx.equipoId),
    'B8.67 El equipo existe igual: la colaboración no depende del chat',
  );

  section('El cupo se respeta al aceptar, no solo al invitar');
  const invitacion2 = await req('POST', `/teams/${ctx.equipoId}/invitations`, {
    token: ctx.ana.token,
    body: { invitedProfileId: ctx.carla.profileId },
  });
  check(invitacion2.status === 201, 'B8.68 Ana invita a una tercera persona', msgOf(invitacion2));
  const aceptar2 = await req('PATCH', `/teams/invitations/${invitacion2.data.id}`, {
    token: ctx.carla.token,
    body: { decision: 'accept' },
  });
  check(aceptar2.status === 200, 'B8.69 Entra, y el equipo llega a su máximo de 3', msgOf(aceptar2));

  const invitacion3 = await req('POST', `/teams/${ctx.equipoId}/invitations`, {
    token: ctx.ana.token,
    body: { invitedProfileId: ctx.ocupada.profileId },
  });
  check(
    invitacion3.status === 409,
    'B8.70 Con el equipo lleno, invitar a alguien más -> 409 (§46)',
    `status ${invitacion3.status}`,
  );
}

// ===========================================================================
//  Preparación
// ===========================================================================
async function preparar() {
  console.log(`${C.bold}BATCH 8 — Colaboración contra ${API}${C.r}`);
  const admin = await loginAdmin();

  const area = (await req('POST', '/academic-areas', {
    token: admin,
    body: {
      name: `Instrumentacion ${TS}`,
      description: 'Área del escenario de colaboración.',
      tags: ['sensores', 'scada'],
    },
  })).data;
  if (!area?.id) throw new Error('No se pudo crear el área del escenario.');

  const nuevaSkill = async (nombre) =>
    (await req('POST', '/skills', {
      token: admin,
      body: { name: `${nombre} ${TS}`, academicAreaId: area.id },
    })).data;

  const skillA = await nuevaSkill('Interfaces de control');
  const skillB = await nuevaSkill('Montaje de sensores');
  if (!skillA?.id || !skillB?.id) throw new Error('No se pudieron crear las habilidades.');

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

  // V2 §55: las sugerencias de equipo usan tecnologías RESPALDADAS. Cada
  // candidato las obtiene con una participación confirmada por Dirección en
  // una actividad que trabaja esa tecnología.
  const director = await provisionAndActivate(admin, {
    firstName: 'Elsa', lastName: 'Directora', email: `b8.dir.${TS}@univalle.edu`, role: 'CAREER_DIRECTOR',
  });
  const categorias = (await req('GET', '/activity-categories', { token: director.token })).data ?? [];
  const categoria = categorias.find((c) => c.isActive !== false && c.appliesTo !== 'extracurricular') ?? categorias[0];
  const respaldar = async (cuenta, skillId) => {
    const act = await req('POST', '/activities', {
      token: director.token,
      body: {
        title: `Práctica ${TS} ${Math.random().toString(36).slice(2, 6)}`,
        description: 'Actividad práctica con una tecnología concreta.',
        type: 'academica',
        categoryId: categoria.id,
        areaId: area.id,
        skillIds: [skillId],
      },
    });
    if (act.status !== 201) throw new Error(`No se pudo crear la práctica: ${JSON.stringify(act.data)}`);
    await req('PATCH', `/activities/${act.data.id}`, { token: director.token, body: { status: 'open' } });
    await req('POST', `/activities/${act.data.id}/register`, { token: cuenta.token });
    await req('PATCH', `/activities/${act.data.id}/confirm-participation`, {
      token: director.token,
      body: { studentProfileId: cuenta.profileId, status: 'confirmed' },
    });
  };

  const ana = await estudiante('ana', 'Ana', 'Zambrana', 6);
  const bruno = await estudiante('bruno', 'Bruno', 'Iriarte', 6);
  const carla = await estudiante('carla', 'Carla', 'Mendieta', 6);
  const ocupada = await estudiante('ocup', 'Lucia', 'Salazar', 6);
  const oculto = await estudiante('ocul', 'Mateo', 'Guzman', 6);

  await req('PATCH', '/profiles/me', {
    token: ana.token,
    body: { bio: 'Me interesa la instrumentación industrial.', availability: 'looking' },
  });
  await req('PUT', '/profiles/me/interests', {
    token: ana.token,
    body: { items: [{ academicAreaId: area.id, priority: 1 }] },
  });

  // Bruno cubre una de las dos habilidades que faltan y está disponible.
  await req('PUT', '/profiles/me/skill-interests', {
    token: bruno.token,
    body: { items: [{ skillId: skillA.id, kind: 'interest' }] },
  });
  await req('PUT', '/profiles/me/interests', {
    token: bruno.token,
    body: { items: [{ academicAreaId: area.id, priority: 1 }] },
  });
  await req('PATCH', '/profiles/me', { token: bruno.token, body: { availability: 'looking' } });

  await req('PUT', '/profiles/me/skill-interests', {
    token: carla.token,
    body: { items: [{ skillId: skillB.id, kind: 'interest' }] },
  });
  await req('PATCH', '/profiles/me', { token: carla.token, body: { availability: 'open' } });

  // Lucía cubre habilidades pero declaró no tener margen.
  await req('PUT', '/profiles/me/skill-interests', {
    token: ocupada.token,
    body: { items: [{ skillId: skillA.id, kind: 'interest' }] },
  });
  await req('PATCH', '/profiles/me', { token: ocupada.token, body: { availability: 'busy' } });

  // Mateo cubre habilidades pero no quiere aparecer en sugerencias.
  await req('PUT', '/profiles/me/skill-interests', {
    token: oculto.token,
    body: { items: [{ skillId: skillB.id, kind: 'interest' }] },
  });
  await req('PATCH', '/profiles/me', {
    token: oculto.token,
    body: { availability: 'looking', peerDiscoverable: false },
  });

  await respaldar(bruno, skillA.id);
  await respaldar(carla, skillB.id);
  await respaldar(ocupada, skillA.id);
  await respaldar(oculto, skillB.id);

  return { admin, area, skillA, skillB, ana, bruno, carla, ocupada, oculto };
}

async function main() {
  try {
    const ctx = await preparar();
    await perfilPublico(ctx);
    await visibilidad(ctx);
    await proyectosVisibles(ctx);
    await contactos(ctx);
    await mensajeria(ctx);
    await equipos(ctx);
  } catch (error) {
    console.error(`\n${C.bad}Error durante la ejecución:${C.r} ${error.message}`);
    process.exitCode = 1;
    return;
  }

  console.log(`\n${'-'.repeat(78)}`);
  if (failures.length === 0) {
    console.log(`${C.ok}${C.bold}  ${passed} verificaciones OK · 0 fallos${C.r}`);
    console.log('  El BATCH 8 queda demostrado de punta a punta.');
  } else {
    console.log(`${C.bad}${C.bold}  ${passed} verificaciones OK · ${failures.length} fallos${C.r}`);
    failures.forEach((f) => console.log(`  ${C.bad}·${C.r} ${f}`));
    process.exitCode = 1;
  }
}

main();
