// =============================================================================
//  Prueba integral del Objetivo 7 — Recomendaciones academicas ligeras
//  RF18 · RN-16
// =============================================================================
//
//  Ejecuta de punta a punta, contra la API real, el septimo objetivo especifico.
//
//  El escenario se construye entero: areas propias, actividades propias con sus
//  casos limite (fecha pasada, sin cupo, en borrador, de otra area) y varios
//  estudiantes con perfiles distintos. Asi cada recomendacion que aparece -y
//  cada una que NO aparece- es consecuencia de algo que la prueba hizo, y no de
//  lo que hubiera sembrado el seed.
//
//  Uso:  node scripts/e2e-objective-7.mjs
//        API_URL=http://localhost:3010/api node scripts/e2e-objective-7.mjs
//
//  Requiere: API corriendo + migraciones aplicadas + `npm run seed:populate`.
//  Las cuentas que crea llevan sufijo de tiempo, por lo que puede repetirse.
// =============================================================================

const API = process.env.API_URL ?? 'http://localhost:3000/api';
const TS = Date.now();
const PWD = 'Afinia2026*';
const email = (n) => `o7.${n}.${TS}@univalle.edu`;
const studentEmail = (n) => `o7.${n}.${TS}@est.univalle.edu`;

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
  try { data = text ? JSON.parse(text) : null; } catch { data = text; }
  return { status: res.status, data };
}

const msgOf = (r) => {
  const m = r?.data?.message;
  return Array.isArray(m) ? m.join(' | ') : (m ?? JSON.stringify(r?.data ?? '').slice(0, 140));
};

/** Todas las recomendaciones de una respuesta, sin agrupar. */
const flat = (rec) => (rec?.groups ?? []).flatMap((g) => g.items);
const sumOf = (item) => Number(item.reasons.reduce((a, r) => a + r.points, 0).toFixed(2));
const recsOf = async (token) => (await req('GET', '/recommendations/me', { token })).data;
const byTarget = (rec, targetId) => flat(rec).find((i) => i.targetId === targetId);

const LIMITS = {
  activity: 8, opportunity: 5, external_course: 5,
  resource: 5, strengthening_area: 3, teammate: 5,
};

// ---------------------------------------------------------------------------

async function main() {
  console.log(`\n${C.b}Prueba integral del Objetivo 7 contra ${API}${C.r}`);

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
  await prepararEscenario(ctx);
  await rf18Generacion(ctx);
  await rf18Exclusiones(ctx);
  await rn16Decisiones(ctx);
  await rf18Validaciones(ctx);
  await rf18Fallos(ctx);
  await rf14Directorio(ctx);

  console.log(`\n${'-'.repeat(78)}`);
  if (fail === 0) {
    console.log(`${C.ok}${C.b}  ${pass} verificaciones OK · 0 fallos${C.r}`);
    console.log('  El Objetivo 7 queda demostrado de punta a punta.\n');
  } else {
    console.log(`${C.bad}${C.b}  ${pass} OK · ${fail} FALLOS${C.r}`);
    failures.forEach((f) => console.log(`   ${C.bad}·${C.r} ${f}`));
    console.log('');
    process.exitCode = 1;
  }
}

/**
 * Escenario:
 *   areaPrincipal   el estudiante la declara como area de preferencia
 *   areaSecundaria  quiere mejorar en ella; no tiene trayectoria
 *   areaAjena       nada la relaciona con el estudiante
 *
 *   S1  perfil rico: preferencia, mejora, proyecto e interes en texto libre
 *   S2  sin ninguna informacion -> flujo 2a
 *   S3  solo un interes que no coincide con nada -> flujo 3a
 *   S4  companero con trayectoria en ambas areas
 *   S5  igual que S4, pero desactivo aparecer en sugerencias
 *   Z   ocupa el unico cupo de una actividad
 */
async function prepararEscenario(ctx) {
  objective('PREPARACION · Escenario propio de la prueba');

  section('Areas y catalogo');
  const crearArea = async (nombre, tags) =>
    (await req('POST', '/academic-areas', {
      token: ctx.admin,
      body: { name: `${nombre} ${TS}`, description: `Area de la prueba ${nombre}.`, tags },
    })).data;

  ctx.areaPrincipal = await crearArea('Ingenieria de Datos', ['etl', 'datawarehouse']);
  ctx.areaSecundaria = await crearArea('Sistemas Embebidos', ['arduino', 'iot']);
  ctx.areaAjena = await crearArea('Gestion Documental', ['archivistica']);
  check(
    !!ctx.areaPrincipal?.id && !!ctx.areaSecundaria?.id && !!ctx.areaAjena?.id,
    'P.1 Tres areas academicas creadas para el escenario',
  );

  const categorias = (await req('GET', '/activity-categories', { token: ctx.admin })).data ?? [];
  const catId = (code) => categorias.find((c) => c.code === code)?.id;
  ctx.cat = {
    taller: catId('taller_academico'),
    curso: catId('curso_externo_recomendado'),
    recurso: catId('recurso_de_apoyo'),
    convocatoria: catId('convocatoria'),
  };
  check(
    Object.values(ctx.cat).every(Boolean),
    'P.2 El catalogo tiene taller, curso externo, recurso de apoyo y convocatoria',
    JSON.stringify(ctx.cat),
  );

  section('Responsables de actividades');
  const crearStaff = async (key, first, last, role) => {
    await req('POST', '/users', {
      token: ctx.admin,
      body: { firstName: first, lastName: last, email: email(key), password: PWD, role },
    });
    const login = await req('POST', '/auth/login', { body: { email: email(key), password: PWD } });
    return login.data?.accessToken;
  };
  ctx.director = await crearStaff('director', 'Aurora', 'Paz', 'CAREER_DIRECTOR');
  ctx.sociedad = await crearStaff('sociedad', 'Benito', 'Lara', 'SCIENTIFIC_SOCIETY');
  ctx.docente = await crearStaff('docente', 'Celia', 'Ortuno', 'TEACHER');
  check(!!ctx.director && !!ctx.sociedad && !!ctx.docente, 'P.3 Director, sociedad cientifica y docente disponibles');

  section('Estudiantes');
  const nuevoEstudiante = async (key, first, last, semester) => {
    const reg = await req('POST', '/auth/register', {
      body: { firstName: first, lastName: last, email: studentEmail(key), password: PWD },
    });
    const token = reg.data?.accessToken;
    const profile = await req('POST', '/profiles/me', { token, body: { semester } });
    return { token, profileId: profile.data?.id, name: `${first} ${last}` };
  };
  ctx.S1 = await nuevoEstudiante('s1', 'Ines', 'Zapata', 5);
  ctx.S2 = await nuevoEstudiante('s2', 'Omar', 'Bejarano', 5);
  ctx.S3 = await nuevoEstudiante('s3', 'Nadia', 'Chumacero', 5);
  ctx.S4 = await nuevoEstudiante('s4', 'Ramiro', 'Ledezma', 5);
  ctx.S5 = await nuevoEstudiante('s5', 'Sofia', 'Encinas', 5);
  ctx.Z = await nuevoEstudiante('z', 'Zulema', 'Arispe', 5);
  check(
    [ctx.S1, ctx.S2, ctx.S3, ctx.S4, ctx.S5, ctx.Z].every((s) => s.token && s.profileId),
    'P.4 Seis estudiantes registrados con perfil',
  );

  section('Actividades disponibles y casos limite');
  const dias = (n) => new Date(Date.now() + n * 24 * 60 * 60 * 1000).toISOString();
  const crearActividad = async (token, body, publicar = true) => {
    const creada = await req('POST', '/activities', { token, body });
    if (publicar && creada.data?.id) {
      await req('PATCH', `/activities/${creada.data.id}`, { token, body: { status: 'open' } });
    }
    return creada;
  };

  ctx.aTaller = (await crearActividad(ctx.director, {
    title: `Taller de canalizacion de datos ${TS}`,
    description: 'Construccion de procesos de carga y transformacion.',
    type: 'academica', categoryId: ctx.cat.taller, areaId: ctx.areaPrincipal.id,
    capacity: 10, activityDate: dias(15),
  })).data;

  ctx.aCurso = (await crearActividad(ctx.director, {
    title: `Curso externo de modelado dimensional ${TS}`,
    description: 'Curso abierto de una plataforma externa.',
    type: 'academica', categoryId: ctx.cat.curso, areaId: ctx.areaPrincipal.id,
    externalUrl: 'https://example.org/curso-modelado',
  })).data;

  ctx.aRecurso = (await crearActividad(ctx.director, {
    title: `Guia de referencia de bodegas de datos ${TS}`,
    description: 'Material de consulta permanente.',
    type: 'academica', categoryId: ctx.cat.recurso, areaId: ctx.areaPrincipal.id,
    externalUrl: 'https://example.org/guia-bodegas',
  })).data;

  ctx.aConvocatoria = (await crearActividad(ctx.sociedad, {
    title: `Convocatoria de proyectos de datos ${TS}`,
    description: 'Llamado abierto con plazo.',
    type: 'extracurricular', categoryId: ctx.cat.convocatoria, areaId: ctx.areaPrincipal.id,
    activityDate: dias(20),
  })).data;

  ctx.aPasada = (await crearActividad(ctx.director, {
    title: `Taller ya realizado ${TS}`,
    description: 'Su fecha ya paso.',
    type: 'academica', categoryId: ctx.cat.taller, areaId: ctx.areaPrincipal.id,
    activityDate: dias(-10),
  })).data;

  ctx.aLlena = (await crearActividad(ctx.director, {
    title: `Taller sin cupo ${TS}`,
    description: 'Un solo lugar, ya confirmado.',
    type: 'academica', categoryId: ctx.cat.taller, areaId: ctx.areaPrincipal.id,
    capacity: 1, activityDate: dias(12),
  })).data;

  ctx.aBorrador = (await crearActividad(ctx.director, {
    title: `Taller en borrador ${TS}`,
    description: 'Todavia no se publica.',
    type: 'academica', categoryId: ctx.cat.taller, areaId: ctx.areaPrincipal.id,
    activityDate: dias(18),
  }, false)).data;

  ctx.aAjena = (await crearActividad(ctx.director, {
    title: `Taller de archivo historico ${TS}`,
    description: 'De un area sin relacion con el estudiante.',
    type: 'academica', categoryId: ctx.cat.taller, areaId: ctx.areaAjena.id,
    activityDate: dias(14),
  })).data;

  const creadas = [ctx.aTaller, ctx.aCurso, ctx.aRecurso, ctx.aConvocatoria, ctx.aPasada, ctx.aLlena, ctx.aBorrador, ctx.aAjena];
  check(creadas.every((a) => a?.id), 'P.5 Ocho actividades creadas, con sus casos limite');

  // Z ocupa el unico cupo confirmable de la actividad llena.
  await req('POST', `/activities/${ctx.aLlena.id}/register`, { token: ctx.Z.token });
  const confirmada = await req('PATCH', `/activities/${ctx.aLlena.id}/confirm-participation`, {
    token: ctx.director,
    body: { studentProfileId: ctx.Z.profileId, status: 'confirmed' },
  });
  check(confirmada.status === 200, 'P.6 La actividad de un solo cupo queda llena', msgOf(confirmada));

  section('Perfiles de los estudiantes');
  // S1: area de preferencia, area de mejora, proyecto e interes en texto libre.
  await req('PUT', '/profiles/me/preferred-areas', {
    token: ctx.S1.token,
    body: { items: [{ academicAreaId: ctx.areaPrincipal.id, priority: 5 }] },
  });
  await req('PATCH', '/profiles/me', {
    token: ctx.S1.token,
    body: { improvementAreaIds: [ctx.areaSecundaria.id] },
  });
  await req('POST', '/projects', {
    token: ctx.S1.token,
    body: {
      title: `Tablero de indicadores ${TS}`,
      description: 'Proyecto propio en el area principal.',
      areaId: ctx.areaPrincipal.id, status: 'active', visibility: 'profile',
    },
  });
  const interes = await req('POST', '/profiles/me/free-interests', {
    token: ctx.S1.token,
    body: { name: 'Canalizacion de datos' },
  });
  check(interes.status === 201, 'P.7 S1 declara preferencia, mejora, proyecto e interes', msgOf(interes));

  // S4 y S5: trayectoria en ambas areas. S5 ademas se excluye de las sugerencias.
  for (const s of [ctx.S4, ctx.S5]) {
    await req('PUT', '/profiles/me/preferred-areas', {
      token: s.token,
      body: {
        items: [
          { academicAreaId: ctx.areaPrincipal.id, priority: 5 },
          { academicAreaId: ctx.areaSecundaria.id, priority: 5 },
        ],
      },
    });
    for (const area of [ctx.areaPrincipal, ctx.areaSecundaria]) {
      await req('POST', '/projects', {
        token: s.token,
        body: {
          title: `Proyecto ${area.name} de ${s.name} ${TS}`,
          description: 'Proyecto que aporta trayectoria.',
          areaId: area.id, status: 'active', visibility: 'profile',
        },
      });
    }
  }
  const oculta = await req('PATCH', '/profiles/me', {
    token: ctx.S5.token,
    body: { peerDiscoverable: false },
  });
  check(
    oculta.status === 200 && oculta.data.peerDiscoverable === false,
    'P.8 S5 desactiva aparecer en sugerencias de companeros',
    msgOf(oculta),
  );

  // S3: un interes que no coincide con nada disponible.
  await req('POST', '/profiles/me/free-interests', {
    token: ctx.S3.token,
    body: { name: 'Arqueologia submarina' },
  });
}

// ===========================================================================
//  RF18 · Generacion de recomendaciones
// ===========================================================================
async function rf18Generacion(ctx) {
  objective('RF18 · Consultar recomendaciones academicas');

  section('Flujo basico de la Tabla 2.27');
  const r = await req('GET', '/recommendations/me', { token: ctx.S1.token });
  check(r.status === 200, '18.1 El estudiante consulta sus recomendaciones', msgOf(r));
  const rec = r.data;
  ctx.rec = rec;
  check(rec?.outcome === 'available', '18.2 Resultado: hay recomendaciones disponibles', rec?.outcome);

  const items = flat(rec);
  check(items.length > 0 && rec.counts.total === items.length, '18.3 El total coincide con lo agrupado', `${rec?.counts?.total} vs ${items.length}`);
  check(items.every((i) => i.reasons.length > 0), '18.4 Ninguna recomendacion sin motivo');
  check(
    items.every((i) => i.score === sumOf(i)),
    '18.5 INVARIANTE: el puntaje es exactamente la suma de sus motivos',
    JSON.stringify(items.filter((i) => i.score !== sumOf(i)).map((i) => [i.title, i.score, sumOf(i)])),
  );
  check(
    rec.groups.every((g) => g.items.every((it, i) => i === 0 || g.items[i - 1].score >= it.score)),
    '18.6 Cada grupo viene ordenado de mayor a menor relevancia',
  );
  check(rec.groups.every((g) => !!g.label && g.items.every((i) => i.type === g.type)), '18.7 Cada grupo tiene nombre y solo elementos de su tipo');
  check(
    rec.groups.every((g) => g.items.length <= LIMITS[g.type]),
    '18.8 Cada tipo respeta su limite de elementos',
    rec.groups.map((g) => `${g.type}:${g.items.length}`).join(' '),
  );

  section('Los seis elementos que nombra RN-16');
  const taller = byTarget(rec, ctx.aTaller.id);
  check(taller?.type === 'activity', '18.9 Recomienda la actividad del area de preferencia', taller?.type);
  const curso = byTarget(rec, ctx.aCurso.id);
  check(curso?.type === 'external_course' && /^https?:/.test(curso?.targetLink ?? ''), '18.10 Recomienda el curso externo, con su enlace', JSON.stringify([curso?.type, curso?.targetLink]));
  const recurso = byTarget(rec, ctx.aRecurso.id);
  check(recurso?.type === 'resource' && /^https?:/.test(recurso?.targetLink ?? ''), '18.11 Recomienda el recurso de apoyo, con su enlace', JSON.stringify([recurso?.type, recurso?.targetLink]));
  const convocatoria = byTarget(rec, ctx.aConvocatoria.id);
  check(convocatoria?.type === 'opportunity', '18.12 Recomienda la convocatoria como oportunidad', convocatoria?.type);
  const fortalecer = byTarget(rec, ctx.areaSecundaria.id);
  check(fortalecer?.type === 'strengthening_area', '18.13 Propone el area de mejora como area de fortalecimiento', fortalecer?.type);
  const companero = byTarget(rec, ctx.S4.profileId);
  check(companero?.type === 'teammate', '18.14 Sugiere un posible companero de equipo', companero?.type);

  section('Motivos (RN-16: a partir del perfil y de las afinidades)');
  check(
    taller?.reasons.some((x) => x.code === 'preferred_area' && x.points === 6),
    '18.15 Area de preferencia con prioridad 5 aporta 6 puntos',
    JSON.stringify(taller?.reasons),
  );
  check(
    taller?.reasons.some((x) => x.code === 'affinity_area'),
    '18.16 La afinidad calculada por el motor del Objetivo 6 tambien es motivo',
  );
  check(
    taller?.reasons.some((x) => x.code === 'free_interest_match' && /Canalizacion de datos/.test(x.label)),
    '18.17 Un interes en texto libre coincide con el titulo de la actividad',
    JSON.stringify(taller?.reasons.map((x) => x.code)),
  );
  check(
    fortalecer?.reasons.some((x) => x.code === 'improvement_area') &&
      fortalecer?.reasons.some((x) => x.code === 'low_trajectory'),
    '18.18 El area de fortalecimiento explica que la declaro y que aun no tiene trayectoria',
    JSON.stringify(fortalecer?.reasons.map((x) => x.code)),
  );
  check(
    companero?.reasons.some((x) => x.code === 'shared_affinity' || x.code === 'complementary_profile'),
    '18.19 El companero se sugiere por trayectoria compartida o complementaria',
    JSON.stringify(companero?.reasons.map((x) => x.code)),
  );
  check(items.every((i) => typeof i.typeLabel === 'string' && i.typeLabel.length > 0), '18.20 Cada recomendacion trae el nombre de su tipo en español');
}

// ===========================================================================
//  RF18 · Lo que NO se recomienda
// ===========================================================================
async function rf18Exclusiones(ctx) {
  objective('RF18 · Exclusiones y privacidad');

  section('Actividades que no se pueden aprovechar');
  const rec = ctx.rec;
  check(!byTarget(rec, ctx.aPasada.id), '18.21 No recomienda una actividad cuya fecha ya paso');
  check(!byTarget(rec, ctx.aLlena.id), '18.22 No recomienda una actividad sin cupo confirmable');
  check(!byTarget(rec, ctx.aBorrador.id), '18.23 No recomienda una actividad en borrador');
  check(!byTarget(rec, ctx.aAjena.id), '18.24 No recomienda algo de un area sin relacion con el perfil');

  section('Privacidad de los companeros');
  const mates = flat(rec).filter((i) => i.type === 'teammate');
  check(!mates.some((m) => m.targetId === ctx.S1.profileId), '18.25 El estudiante no se sugiere a si mismo');
  check(!mates.some((m) => m.targetId === ctx.S5.profileId), '18.26 No sugiere a quien desactivo aparecer en sugerencias');
  check(!JSON.stringify(mates).includes('@'), '18.27 Ninguna tarjeta de companero incluye correo');

  const areas = (await req('GET', '/academic-areas', { token: ctx.admin })).data ?? [];
  const nombres = new Set(areas.map((a) => a.name));
  const plantillaValida = (label) => {
    const compartida = /^Comparten trayectoria en (.+)$/.exec(label);
    if (compartida) return nombres.has(compartida[1]);
    const complementaria = /^Puede aportar en (.+), donde quieres fortalecerte$/.exec(label);
    return complementaria ? nombres.has(complementaria[1]) : false;
  };
  check(
    mates.every((m) => m.reasons.every((x) => plantillaValida(x.label))),
    '18.28 Los motivos de un companero solo nombran areas, sin niveles ni puntajes suyos',
    JSON.stringify(mates.flatMap((m) => m.reasons.map((x) => x.label))),
  );

  section('Lo que el estudiante ya conoce');
  // Se abre antes de inscribirse: una recomendacion ya vista debe conservarse
  // cuando deja de aplicar, en lugar de desaparecer sin rastro.
  ctx.tallerRecId = byTarget(rec, ctx.aTaller.id)?.id;
  await req('GET', `/recommendations/me/${ctx.tallerRecId}`, { token: ctx.S1.token });
  const inscripcion = await req('POST', `/activities/${ctx.aTaller.id}/register`, { token: ctx.S1.token });
  check([200, 201].includes(inscripcion.status), '18.29 El estudiante se inscribe en la actividad recomendada', msgOf(inscripcion));
  const despues = await recsOf(ctx.S1.token);
  check(!byTarget(despues, ctx.aTaller.id), '18.30 Ya inscrito, deja de recomendarse');
  ctx.rec2 = despues;
}

// ===========================================================================
//  RN-16 · La decision es del estudiante
// ===========================================================================
async function rn16Decisiones(ctx) {
  objective('RN-16 · Las recomendaciones no son obligatorias');

  const items = flat(ctx.rec2);
  const guardar = items[0];
  const descartar = items[1];

  section('Detalle y estado');
  const detalle = await req('GET', `/recommendations/me/${guardar.id}`, { token: ctx.S1.token });
  check(detalle.status === 200 && 'detail' in detalle.data, '18.31 El estudiante abre el detalle del elemento (Tabla 2.27, paso 7)', msgOf(detalle));
  check(detalle.data.status !== 'new', '18.32 Abrir el detalle la marca como vista (markAsViewed)', detalle.data?.status);
  check(detalle.data.reasons.length > 0, '18.33 El detalle repite los motivos');

  section('Guardar y descartar');
  const guardada = await req('PATCH', `/recommendations/me/${guardar.id}`, { token: ctx.S1.token, body: { status: 'saved' } });
  check(guardada.status === 200 && guardada.data.status === 'saved' && !!guardada.data.decidedAt, '18.34 La guarda, con la fecha de la decision', msgOf(guardada));
  const descartada = await req('PATCH', `/recommendations/me/${descartar.id}`, { token: ctx.S1.token, body: { status: 'dismissed' } });
  check(descartada.status === 200 && descartada.data.status === 'dismissed', '18.35 Descarta otra', msgOf(descartada));

  section('La decision sobrevive a un nuevo calculo');
  const nueva = await recsOf(ctx.S1.token);
  const vigentes = flat(nueva);
  check(!vigentes.some((i) => i.id === descartar.id), '18.36 La descartada NO vuelve a proponerse');
  check(vigentes.find((i) => i.id === guardar.id)?.status === 'saved', '18.37 La guardada sigue guardada');
  check(nueva.counts.saved >= 1 && nueva.counts.dismissed >= 1, '18.38 Los conteos reflejan las decisiones', JSON.stringify(nueva.counts));

  section('Historial y deshacer');
  const guardadas = await req('GET', '/recommendations/me/history?status=saved', { token: ctx.S1.token });
  check(guardadas.status === 200 && guardadas.data.some((i) => i.id === guardar.id), '18.39 El historial de guardadas la incluye');
  const descartadas = await req('GET', '/recommendations/me/history?status=dismissed', { token: ctx.S1.token });
  check(descartadas.status === 200 && descartadas.data.some((i) => i.id === descartar.id), '18.40 El historial de descartadas la incluye');
  const restaurada = await req('PATCH', `/recommendations/me/${descartar.id}`, { token: ctx.S1.token, body: { status: 'viewed' } });
  check(restaurada.status === 200 && restaurada.data.decidedAt === null, '18.41 Puede deshacer el descarte');
  const trasRestaurar = await recsOf(ctx.S1.token);
  check(flat(trasRestaurar).some((i) => i.id === descartar.id), '18.42 Restaurada, vuelve a la lista');

  section('Un elemento que deja de estar disponible');
  const retirada = await req('GET', `/recommendations/me/${ctx.tallerRecId}`, { token: ctx.S1.token });
  check(
    retirada.status === 200 && retirada.data.isCurrent === false,
    '18.43 La recomendacion que dejo de aplicar se conserva, marcada como no vigente',
    `${retirada.status} ${retirada.data?.isCurrent}`,
  );
  check(
    retirada.data?.detail?.available === false,
    '18.44 Su detalle avisa que el elemento ya no esta disponible',
    JSON.stringify(retirada.data?.detail),
  );
}

// ===========================================================================
//  RF18 · Validaciones y permisos
// ===========================================================================
async function rf18Validaciones(ctx) {
  objective('RF18 · Validaciones y permisos');

  const alguna = flat(ctx.rec2)[0];

  section('Estados admitidos');
  check((await req('PATCH', `/recommendations/me/${alguna.id}`, { token: ctx.S1.token, body: { status: 'new' } })).status === 400, '18.45 No se puede devolver a "nueva" -> 400');
  check((await req('PATCH', `/recommendations/me/${alguna.id}`, { token: ctx.S1.token, body: { status: 'aprobada' } })).status === 400, '18.46 Un estado inexistente -> 400');
  check((await req('PATCH', `/recommendations/me/${alguna.id}`, { token: ctx.S1.token, body: { status: 'saved', score: 99 } })).status === 400, '18.47 Fijar el puntaje a mano -> 400');
  check((await req('GET', '/recommendations/me/history?status=viewed', { token: ctx.S1.token })).status === 400, '18.48 El historial solo admite guardadas o descartadas -> 400');

  section('Identificadores');
  check((await req('GET', '/recommendations/me/no-es-uuid', { token: ctx.S1.token })).status === 400, '18.49 Identificador mal formado -> 400');
  check((await req('GET', '/recommendations/me/00000000-0000-4000-8000-000000000000', { token: ctx.S1.token })).status === 404, '18.50 Recomendacion inexistente -> 404');

  section('Separacion entre estudiantes y roles');
  check((await req('GET', `/recommendations/me/${alguna.id}`, { token: ctx.S2.token })).status === 404, '18.51 La recomendacion de otro estudiante -> 404, sin revelar que existe');
  check((await req('PATCH', `/recommendations/me/${alguna.id}`, { token: ctx.S2.token, body: { status: 'dismissed' } })).status === 404, '18.52 Tampoco puede decidir sobre ella -> 404');
  check((await req('GET', '/recommendations/me', { token: ctx.docente })).status === 403, '18.53 Un docente no tiene recomendaciones -> 403');
  check((await req('GET', '/recommendations/me', { token: ctx.director })).status === 403, '18.54 El director tampoco -> 403');
  check((await req('GET', '/recommendations/me')).status === 401, '18.55 Sin sesion -> 401');

  section('Reglas visibles');
  const reglas = await req('GET', '/recommendations/rules', { token: ctx.S1.token });
  check(reglas.status === 200 && !!reglas.data.rulesVersion, '18.56 Las reglas se consultan de solo lectura', reglas.status);
  check(Array.isArray(reglas.data.rules) && reglas.data.rules.length >= 8, '18.57 Estan publicadas todas las reglas de puntuacion', reglas.data?.rules?.length);
  check(!!reglas.data.limits && !!reglas.data.minimumScore, '18.58 Tambien los limites y el puntaje minimo');
}

// ===========================================================================
//  RF18 · Salidas de fallo de la Tabla 2.27
// ===========================================================================
async function rf18Fallos(ctx) {
  objective('RF18 · Flujos alternativos 2a y 3a');

  section('2a · Informacion insuficiente en el perfil');
  const vacio = await recsOf(ctx.S2.token);
  check(vacio.outcome === 'insufficient_profile', '18.59 Un perfil sin informacion no recibe recomendaciones', vacio.outcome);
  check(vacio.groups.length === 0 && vacio.counts.total === 0, '18.60 Sin grupos ni elementos');
  check(/datos suficientes/.test(vacio.message), '18.61 El mensaje es el que define la Tabla 2.27', vacio.message);

  section('3a · Perfil sin coincidencias');
  const sinCoincidencias = await recsOf(ctx.S3.token);
  check(sinCoincidencias.outcome === 'no_matches', '18.62 Un perfil con informacion pero sin coincidencias recibe otro resultado', sinCoincidencias.outcome);
  check(/no existen recomendaciones disponibles/.test(sinCoincidencias.message), '18.63 Con su propio mensaje, distinto del anterior', sinCoincidencias.message);
  check(vacio.outcome !== sinCoincidencias.outcome, '18.64 Los dos flujos alternativos no se confunden entre si');
}

// ===========================================================================
//  RF14 · Directorio entre estudiantes (defecto corregido en este objetivo)
// ===========================================================================
async function rf14Directorio(ctx) {
  objective('RF14 · Busqueda de companeros para invitar');

  section('Consulta del estudiante');
  const encontrados = await req('GET', '/profiles/peers?search=Ledezma', { token: ctx.S1.token });
  check(encontrados.status === 200 && Array.isArray(encontrados.data), '18.65 El estudiante busca companeros (antes respondia 403)', encontrados.status);
  const ramiro = (encontrados.data ?? []).find((p) => p.profileId === ctx.S4.profileId);
  check(!!ramiro, '18.66 Encuentra al companero buscado por su apellido');
  check(
    ramiro && Object.keys(ramiro).sort().join(',') === 'profileId,semester,studentName',
    '18.67 Tarjeta minima: solo identificador, nombre y semestre',
    ramiro && Object.keys(ramiro).join(','),
  );
  check(!JSON.stringify(encontrados.data).includes('@'), '18.68 Sin correos en la respuesta');

  section('Limites de la busqueda');
  check((await req('GET', '/profiles/peers?search=L', { token: ctx.S1.token })).status === 400, '18.69 Un solo caracter -> 400');
  check((await req('GET', '/profiles/peers', { token: ctx.S1.token })).status === 400, '18.70 Sin termino de busqueda -> 400');
  const comodin = await req('GET', `/profiles/peers?search=${encodeURIComponent('%%')}`, { token: ctx.S1.token });
  check(comodin.status === 200 && comodin.data.length === 0, '18.71 Los comodines no listan a todos los estudiantes', comodin.data?.length);
  const propio = await req('GET', '/profiles/peers?search=Zapata', { token: ctx.S1.token });
  check(!(propio.data ?? []).some((p) => p.profileId === ctx.S1.profileId), '18.72 No se incluye a si mismo');
  check((await req('GET', '/profiles/peers?search=Ledezma', { token: ctx.docente })).status === 403, '18.73 Un docente usa su propio directorio, no este -> 403');

  section('La invitacion funciona con lo encontrado');
  const mios = await req('GET', '/projects/my', { token: ctx.S1.token });
  const proyecto = (mios.data ?? []).find((p) => p.isOwner);
  const invitacion = await req('POST', `/projects/${proyecto.id}/invitations`, {
    token: ctx.S1.token,
    body: { invitedProfileId: ctx.S4.profileId, proposedRole: 'Analista de datos' },
  });
  check(invitacion.status === 201, '18.74 Invitar al companero encontrado funciona de punta a punta', msgOf(invitacion));

  section('Aparecer en sugerencias es reversible');
  const vuelve = await req('PATCH', '/profiles/me', { token: ctx.S5.token, body: { peerDiscoverable: true } });
  check(vuelve.status === 200 && vuelve.data.peerDiscoverable === true, '18.75 El estudiante puede volver a activarla', msgOf(vuelve));
  const conS5 = await recsOf(ctx.S1.token);
  check(
    flat(conS5).some((i) => i.type === 'teammate' && i.targetId === ctx.S5.profileId),
    '18.76 Reactivada, vuelve a aparecer como posible companera',
  );
}

main().catch((e) => {
  console.error(`\n${C.bad}Error inesperado:${C.r}`, e);
  process.exit(1);
});
