/**
 * Especificación Maestra Final V2 — verificación contra la API en marcha.
 *
 * Una sección por batch de la V2 (§86). Cada comprobación cita la sección
 * que verifica. Se ejecuta con la API en modo de correo simulado.
 *
 * Uso:
 *   API_URL=http://localhost:3010/api node scripts/e2e-v2.mjs
 */

import {
  API, PWD, codigoUniversitario, loginAdmin, provisionAndActivate, req,
} from './lib/fixtures.mjs';

const TS = Date.now();

const C = {
  r: '\x1b[0m', bold: '\x1b[1m', dim: '\x1b[90m',
  ok: '\x1b[32m', bad: '\x1b[31m', head: '\x1b[36m',
};

let passed = 0;
const failures = [];

export function check(condition, label, detail = '') {
  if (condition) {
    passed++;
    console.log(`  ${C.ok}✓${C.r} ${label}`);
  } else {
    failures.push(label + (detail ? ` -> ${detail}` : ''));
    console.log(`  ${C.bad}✗${C.r} ${label}${detail ? ` ${C.dim}-> ${detail}${C.r}` : ''}`);
  }
}

const objective = (t) => console.log(`\n${C.head}${C.bold}${t}${C.r}`);
const correoEst = (k) => `v2.${k}.${TS}@est.univalle.edu`;
const correoStaff = (k) => `v2.${k}.${TS}@univalle.edu`;
const json = (x) => JSON.stringify(x ?? null).slice(0, 180);

/** Petición cruda: deja ver cabeceras (Set-Cookie) y mandar cookies. */
async function crudo(method, path, { body, headers = {}, cookie } = {}) {
  const res = await fetch(`${API}${path}`, {
    method,
    headers: {
      ...(body ? { 'Content-Type': 'application/json' } : {}),
      ...(cookie ? { Cookie: cookie } : {}),
      ...headers,
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  let data = null;
  try { data = await res.json(); } catch { /* sin cuerpo */ }
  const setCookie = res.headers.getSetCookie?.() ?? [];
  return { status: res.status, data, setCookie };
}

const cookieDe = (setCookie) => setCookie.find((c) => c.startsWith('afinia_rt='))?.split(';')[0] ?? null;

// ===========================================================================
//  BATCH 2 — Identidad, activación y correo
// ===========================================================================
async function batch2(ctx) {
  objective('BATCH 2 · Identidad, sesión y correo');

  const sinCodigo = await req('POST', '/users', {
    token: ctx.admin,
    body: { firstName: 'Iris', lastName: 'Nava', email: correoEst('sincod'), role: 'STUDENT', semester: 2 },
  });
  check(sinCodigo.status === 400 && sinCodigo.data?.fields?.universityCode,
    'V2.2.1 §12 Alta manual sin código universitario -> 400 en ese campo', json(sinCodigo.data?.fields));

  const est = await provisionAndActivate(ctx.admin, {
    firstName: 'Iris', lastName: 'Nava', email: correoEst('sesion'), role: 'STUDENT', semester: 2,
  });
  check(Boolean(est.created?.invitation?.deliveryState),
    'V2.2.2 §19 La invitación informa el estado del intento (QUEUED/SENT_TO_SMTP/FAILED)', json(est.created?.invitation));

  const vaciar = await req('PATCH', `/users/${est.userId}`, { token: ctx.admin, body: { universityCode: '' } });
  check(vaciar.status === 400, 'V2.2.3 §12 El código universitario no se puede dejar vacío al editar', `status ${vaciar.status}`);

  // ----- Sesión web: refresh token en cookie HttpOnly (§18)
  const web = await crudo('POST', '/auth/login', {
    body: { email: est.email, password: PWD },
    headers: { 'X-Session-Transport': 'cookie' },
  });
  const cookie = cookieDe(web.setCookie);
  const atributos = web.setCookie.find((c) => c.startsWith('afinia_rt=')) ?? '';
  check(web.status === 200 && Boolean(web.data?.accessToken), 'V2.2.4 §18 Login web devuelve el access token', `status ${web.status}`);
  check(web.data && !('refreshToken' in web.data), 'V2.2.5 §18 En la web el refresh token NO viaja en el cuerpo', json(Object.keys(web.data ?? {})));
  check(Boolean(cookie) && /HttpOnly/i.test(atributos) && /Path=\/api\/auth/i.test(atributos) && /SameSite=Lax/i.test(atributos),
    'V2.2.6 §18 Va en una cookie HttpOnly, SameSite, limitada a /api/auth', atributos.replace(/afinia_rt=[^;]+/, 'afinia_rt=…'));

  const renovada = await crudo('POST', '/auth/refresh', {
    body: {}, cookie, headers: { 'X-Session-Transport': 'cookie' },
  });
  const cookie2 = cookieDe(renovada.setCookie);
  check(renovada.status === 200 && Boolean(renovada.data?.accessToken) && Boolean(cookie2) && cookie2 !== cookie,
    'V2.2.7 §18 Con la cookie se renueva y la cookie rota', `status ${renovada.status}`);
  const vieja = await crudo('POST', '/auth/refresh', { body: {}, cookie, headers: { 'X-Session-Transport': 'cookie' } });
  check(vieja.status === 401, 'V2.2.8 §18 La cookie anterior ya no sirve (rotación)', `status ${vieja.status}`);

  const salir = await crudo('POST', '/auth/logout', { body: {}, cookie: cookie2, headers: { 'X-Session-Transport': 'cookie' } });
  check(salir.status === 200 && salir.setCookie.some((c) => /^afinia_rt=;/.test(c) || /Expires=Thu, 01 Jan 1970/i.test(c)),
    'V2.2.9 §18 Logout revoca la sesión y borra la cookie', `status ${salir.status}`);
  const trasSalir = await crudo('POST', '/auth/refresh', { body: {}, cookie: cookie2, headers: { 'X-Session-Transport': 'cookie' } });
  check(trasSalir.status === 401, 'V2.2.10 §18 Tras logout la cookie no renueva', `status ${trasSalir.status}`);

  // ----- Móvil: sin la cabecera, el refresh token sigue en el cuerpo (SecureStore)
  const movil = await req('POST', '/auth/login', { body: { email: est.email, password: PWD } });
  check(typeof movil.data?.refreshToken === 'string', 'V2.2.11 §18 Sin la cabecera (móvil) el refresh token va en el cuerpo', json(Object.keys(movil.data ?? {})));
  const sinNada = await crudo('POST', '/auth/refresh', { body: {} });
  check(sinNada.status === 401, 'V2.2.12 §18 Renovar sin token ni cookie -> 401', `status ${sinNada.status}`);

  // ----- Política de contraseña (§17): ni el correo ni el código universitario
  const codigo = codigoUniversitario();
  const otro = correoEst('clave');
  const desde = Date.now();
  await req('POST', '/users', {
    token: ctx.admin,
    body: { firstName: 'Ciro', lastName: 'Rada', email: otro, role: 'STUDENT', semester: 3, universityCode: codigo },
  });
  const { leerCorreo } = await import('./lib/fixtures.mjs');
  const inv = await leerCorreo(otro, { tipo: 'account_activation', desde });
  const conCodigo = await req('POST', '/activation/activate', { body: { token: inv.token, password: `Aa1*${codigo.toLowerCase()}xyz` } });
  check(conCodigo.status === 400 && /código universitario/i.test(JSON.stringify(conCodigo.data)),
    'V2.2.13 §17 La contraseña no puede contener el código universitario', json(conCodigo.data));
  const local = otro.split('@')[0];
  const conCorreo = await req('POST', '/activation/activate', { body: { token: inv.token, password: `Aa1*${local}` } });
  check(conCorreo.status === 400 && /correo/i.test(JSON.stringify(conCorreo.data)),
    'V2.2.14 §17 Ni el correo institucional', json(conCorreo.data));
  const larga = await req('POST', '/activation/activate', { body: { token: inv.token, password: `Aa1*${'x'.repeat(130)}` } });
  check(larga.status === 400, 'V2.2.15 §17 Más de 128 caracteres -> 400', `status ${larga.status}`);
}

// ===========================================================================
//  BATCH 3 — Bienvenida V2 y datos declarados
// ===========================================================================
async function batch3(ctx) {
  objective('BATCH 3 · Bienvenida guiada, intereses por tecnología, sin nivel autodeclarado');

  const est = await provisionAndActivate(ctx.admin, {
    firstName: 'Lara', lastName: 'Saavedra', email: correoEst('bienvenida'), role: 'STUDENT', semester: 5,
  });
  const t = est.token;

  let estado = await req('GET', '/profiles/me/onboarding', { token: t });
  check(estado.data?.completed === false && estado.data?.missing?.length === 4,
    'V2.3.1 §20.2 Una cuenta nueva tiene pendientes los 4 obligatorios', json(estado.data?.missing));
  check(estado.data?.semester === 5 && typeof estado.data?.universityCode === 'string',
    'V2.3.2 §20.2 La bienvenida muestra semestre y código para confirmarlos', json(estado.data));

  const temprano = await req('POST', '/profiles/me/onboarding/complete', { token: t });
  check(temprano.status === 400 && /confirmar tus datos/.test(temprano.data?.message ?? '') && /privacidad/.test(temprano.data?.message ?? ''),
    'V2.3.3 §20.2 No se puede terminar sin lo obligatorio, y dice qué falta', json(temprano.data));

  const pasoViejo = await req('PATCH', '/profiles/me/onboarding', { token: t, body: { step: 'skills' } });
  check(pasoViejo.status === 400 || pasoViejo.status === 404,
    'V2.3.4 §20.1 El paso «habilidades» ya no existe', `status ${pasoViejo.status}`);

  const confirmado = await req('POST', '/profiles/me/onboarding/institutional-confirmation', {
    token: t, body: { bio: 'Me gusta el desarrollo web.' },
  });
  check(confirmado.status === 200 && confirmado.data?.institutionalConfirmed === true,
    'V2.3.5 §20.2 Paso 1: confirma sus datos institucionales', json(confirmado.data));

  const catalogo = (await req('GET', '/skills', { token: t })).data ?? [];
  const [s1, s2] = catalogo.filter((s) => s.isActive !== false);
  const viejo = await req('PUT', '/profiles/me/skills', { token: t, body: { items: [{ skillId: s1.id, level: 'advanced' }] } });
  check(viejo.status === 410, 'V2.3.6 §22 El nivel autodeclarado se retiró -> 410', `status ${viejo.status}`);

  const malTipo = await req('PUT', '/profiles/me/skill-interests', { token: t, body: { items: [{ skillId: s1.id, kind: 'advanced' }] } });
  check(malTipo.status === 400, 'V2.3.7 §21 Solo «me interesa» o «quiero mejorar»', `status ${malTipo.status}`);

  const antes = (await req('GET', '/affinity/me/summary', { token: t })).data;
  const techs = await req('PUT', '/profiles/me/skill-interests', {
    token: t,
    body: { items: [{ skillId: s1.id, kind: 'interest' }, { skillId: s2.id, kind: 'improve' }, { skillId: s1.id, kind: 'interest' }] },
  });
  check(techs.status === 200 && techs.data?.length === 2
    && techs.data.some((x) => x.skillId === s1.id && x.kind === 'interest')
    && techs.data.some((x) => x.skillId === s2.id && x.kind === 'improve'),
  'V2.3.8 §21 Tecnologías de interés y de mejora, sin duplicados', json(techs.data));
  await new Promise((r) => setTimeout(r, 600));
  const despues = (await req('GET', '/affinity/me/summary', { token: t })).data;
  const suma = (r) => (r?.areas ?? []).reduce((a, x) => a + Number(x.score ?? 0), 0);
  check(suma(despues) === suma(antes), 'V2.3.9 §21 Declarar tecnologías no cambia la afinidad', `${suma(antes)} -> ${suma(despues)}`);

  const resumen = (await req('GET', '/profiles/me/summary', { token: t })).data;
  check(Array.isArray(resumen?.skillInterests) && resumen.skillInterests.length === 2,
    'V2.3.10 §21 El resumen trae las tecnologías de interés', json(resumen?.skillInterests));
  check(Array.isArray(resumen?.skills) && resumen.skills.every((x) => !('level' in x)),
    'V2.3.11 §22 «skills» son las respaldadas, sin nivel autodeclarado', json(resumen?.skills));

  await req('PATCH', '/profiles/me', { token: t, body: { availability: 'unspecified' } });
  estado = await req('GET', '/profiles/me/onboarding', { token: t });
  check(estado.data?.availabilityDecided === true,
    'V2.3.12 §20.2 Elegir «prefiero no decirlo» cuenta como decisión de disponibilidad', json(estado.data));

  const privacidad = await req('POST', '/profiles/me/onboarding/privacy', {
    token: t, body: { peerDiscoverable: true, publicProfileEnabled: false },
  });
  check(privacidad.status === 200 && privacidad.data?.privacyReviewed === true,
    'V2.3.13 §20.2 Paso 4: privacidad básica revisada', json(privacidad.data));

  const fin = await req('POST', '/profiles/me/onboarding/complete', { token: t });
  check(fin.status === 200 && fin.data?.completed === true && fin.data?.missing?.length === 0,
    'V2.3.14 §20 Con lo obligatorio, la bienvenida termina (cuestionario opcional)', json(fin.data));

  // Solo una tecnología de interés, sin áreas: también vale (§20.2 «al menos un interés»).
  const otro = await provisionAndActivate(ctx.admin, {
    firstName: 'Ivo', lastName: 'Cuellar', email: correoEst('soloTech'), role: 'STUDENT', semester: 1,
  });
  await req('POST', '/profiles/me/onboarding/institutional-confirmation', { token: otro.token, body: {} });
  await req('PUT', '/profiles/me/skill-interests', { token: otro.token, body: { items: [{ skillId: s2.id, kind: 'interest' }] } });
  await req('PATCH', '/profiles/me', { token: otro.token, body: { availability: 'looking' } });
  await req('POST', '/profiles/me/onboarding/privacy', { token: otro.token, body: { peerDiscoverable: false, publicProfileEnabled: false } });
  const finOtro = await req('POST', '/profiles/me/onboarding/complete', { token: otro.token });
  check(finOtro.status === 200, 'V2.3.15 §20.2 Basta un interés por tecnología (sin áreas)', json(finOtro.data));

  const semestre = await req('PATCH', '/profiles/me', { token: t, body: { semester: 8 } });
  const tras = (await req('GET', '/profiles/me', { token: t })).data;
  check(tras?.semester === 5, 'V2.3.16 §6.1 El estudiante no puede cambiar su semestre', `status ${semestre.status}, semestre ${tras?.semester}`);
}

// ===========================================================================
//  BATCH 10 — Recomendaciones (§53, §54)
// ===========================================================================
async function batch10(ctx) {
  objective('BATCH 10 · Recomendaciones: 35 interés · 25 mejora · 20 orientación · 10 afinidad · 10 contexto');

  const est = await provisionAndActivate(ctx.admin, {
    firstName: 'Olga', lastName: 'Rivero', email: correoEst('rec'), role: 'STUDENT', semester: 3,
  });
  await req('POST', '/profiles/me', { token: est.token, body: {} });
  const director = await provisionAndActivate(ctx.admin, {
    firstName: 'Hugo', lastName: 'Director', email: correoStaff('recdir'), role: 'CAREER_DIRECTOR',
  });

  const categorias = (await req('GET', '/activity-categories', { token: director.token })).data ?? [];
  const taller = categorias.find((c) => c.code === 'taller_academico') ?? categorias[0];

  // Áreas y tecnologías propias del escenario: así ninguna actividad ajena
  // compite por los mismos puestos de la lista.
  const letras = (n) => String.fromCharCode(...String(TS + n).slice(-6).split('').map((d) => 65 + Number(d)));
  const nuevaArea = async (nombre, tag) =>
    (await req('POST', '/academic-areas', { token: ctx.admin, body: { name: `${nombre} ${letras(nombre.length)}`, tags: [tag] } })).data;
  const nuevaSkill = async (nombre, area) =>
    (await req('POST', '/skills', { token: ctx.admin, body: { name: `${nombre} ${letras(nombre.length + 7)}`, academicAreaId: area.id } })).data;
  const aInteres = await nuevaArea('Robotica Movil', 'rosbot');
  const aMejora = await nuevaArea('Teledeteccion', 'satelital');
  const aTecInt = await nuevaArea('Bioinformatica Aplicada', 'genomica');
  const aTecMej = await nuevaArea('Domotica', 'hogarintel');
  const sInt = await nuevaSkill('Biopython', aTecInt);
  const sMej = await nuevaSkill('Zigbee', aTecMej);

  await req('PUT', '/profiles/me/interests', { token: est.token, body: { items: [{ academicAreaId: aInteres.id, priority: 1 }] } });
  await req('PATCH', '/profiles/me', { token: est.token, body: { improvementAreaIds: [aMejora.id] } });
  await req('PUT', '/profiles/me/skill-interests', {
    token: est.token, body: { items: [{ skillId: sInt.id, kind: 'interest' }, { skillId: sMej.id, kind: 'improve' }] },
  });

  const crear = async (titulo, area, extra = {}) => {
    const r = await req('POST', '/activities', {
      token: director.token,
      body: { title: `${titulo} ${TS}`, description: 'Actividad del escenario de recomendaciones.', type: 'academica', categoryId: taller.id, areaId: area.id, ...extra },
    });
    await req('PATCH', `/activities/${r.data?.id}`, { token: director.token, body: { status: 'open' } });
    return r.data;
  };
  const actInteres = await crear('Taller de interes', aInteres);
  const actMejora = await crear('Taller de mejora', aMejora);
  const actTecInt = await crear('Practica tecnologica', aTecInt, { skillIds: [sInt.id] });
  const actTecMej = await crear('Practica a mejorar', aTecMej, { skillIds: [sMej.id] });
  const otroSemestre = await crear('Taller de septimo', aInteres, { semesterScope: [7] });

  const leer = async () => {
    const r = await req('GET', '/recommendations/me', { token: est.token });
    return (r.data?.groups ?? []).flatMap((g) => g.items);
  };
  let items = await leer();
  const de = (act) => items.find((i) => i.targetId === act.id);
  const puntos = (item, code) => (item?.reasons ?? []).filter((r) => r.code === code).reduce((a, r) => a + r.points, 0);

  check(puntos(de(actInteres), 'preferred_area') === 35, 'V2.10.1 §54 Interés explícito de prioridad 1: 35 puntos', JSON.stringify(de(actInteres)?.reasons));
  check(puntos(de(actMejora), 'improvement_area') === 25, 'V2.10.2 §54 Área a fortalecer: 25 puntos', JSON.stringify(de(actMejora)?.reasons));
  check(puntos(de(actTecInt), 'skill_match') > 0 && /te interesa/.test(de(actTecInt)?.reasons?.[0]?.label ?? ''),
    'V2.10.3 §53 Tecnología de interés que la actividad trabaja: suma interés, con su motivo', JSON.stringify(de(actTecInt)?.reasons));
  check(puntos(de(actTecMej), 'improve_skill_match') > 0, 'V2.10.4 §53 Tecnología a mejorar: suma en «mejora»', JSON.stringify(de(actTecMej)?.reasons));
  check(!de(otroSemestre), 'V2.10.5 §54 Filtro duro: una actividad de otro semestre no se recomienda');
  check(items.every((i) => (i.reasons ?? []).every((r) => r.code !== 'build_experience')),
    'V2.10.6 §54 Sin refuerzos fuera de la regla');
  check(items.filter((i) => ['activity', 'opportunity', 'resource', 'external_course'].includes(i.type))
    .every((i) => Math.abs(i.reasons.reduce((a, r) => a + r.points, 0) - i.score) < 0.011 && i.score <= 100),
  'V2.10.7 §53 Los motivos suman exactamente el puntaje, siempre ≤ 100');

  // Orientación confirmada: el área sugerida y confirmada suma 20 (§54).
  const q = (await req('GET', '/onboarding/questionnaire', { token: est.token })).data;
  const run = await req('POST', '/onboarding/runs', {
    token: est.token,
    body: { answers: q.questions.map((x) => ({ questionCode: x.code, optionCodes: [x.options[0].code] })) },
  });
  const sugerida = run.data?.suggestedAreas?.[0];
  if (sugerida) {
    await req('POST', `/onboarding/runs/${run.data.id}/confirm`, { token: est.token, body: { academicAreaIds: [sugerida.academicAreaId] } });
    const sugeridaArea = { id: sugerida.academicAreaId };
    const actOrientacion = await crear('Taller orientado', sugeridaArea);
    void actOrientacion;
    items = await leer();
    const delArea = items.filter((i) => i.area?.id === sugerida.academicAreaId && ['activity', 'opportunity', 'resource', 'external_course'].includes(i.type));
    check(delArea.length > 0 && delArea.every((i) => puntos(i, 'orientation_confirmed') === 20),
      'V2.10.8 §54 El área confirmada desde la orientación aporta 20', JSON.stringify(delArea.slice(0, 1).map((i) => i.reasons)));
  } else {
    check(false, 'V2.10.8 §54 El cuestionario debía sugerir al menos un área', JSON.stringify(run.data));
  }

  const reglas = (await req('GET', '/recommendations/rules', { token: est.token })).data;
  check(JSON.stringify((reglas?.ranking ?? []).map((r) => r.weight)) === JSON.stringify([35, 25, 20, 10, 10]),
    'V2.10.9 §54 Las reglas publicadas son las de la especificación', JSON.stringify(reglas?.ranking?.map((r) => [r.code, r.weight])));
}

// ===========================================================================
//  BATCH 4 — Catálogos (§23, §24, §73)
// ===========================================================================
async function batch4(ctx) {
  objective('BATCH 4 · Catálogos: alias, clasificación semántica y nombres únicos');
  const letras = String.fromCharCode(...String(TS).slice(-6).split('').map((d) => 65 + Number(d)));
  const areas = (await req('GET', '/academic-areas', { token: ctx.admin })).data ?? [];
  const movil = areas.find((a) => a.name === 'Desarrollo Móvil');
  const web = areas.find((a) => a.name === 'Desarrollo Web');

  const rn = await req('GET', '/skills/classify?name=React%20Native', { token: ctx.admin });
  check(rn.status === 200 && rn.data?.rule === 'canonical' && rn.data?.areaIds?.includes(movil?.id),
    'V2.4.1 §23.3 «React Native» tiene regla canónica: Desarrollo Móvil', json(rn.data));

  const bloqueada = await req('POST', '/skills', {
    token: ctx.admin, body: { name: `Kit Movil ${letras}`, aliases: ['SwiftUI'], academicAreaId: web.id },
  });
  check(bloqueada.status === 409 && bloqueada.data?.code === 'CLASSIFICATION_BLOCKED' && bloqueada.data?.fields?.academicAreaId,
    'V2.4.2 §23.3 Guardar una tecnología canónica de móvil en Web se bloquea, aunque llegue por un alias', json(bloqueada.data));
  const conMotivo = await req('POST', '/skills', {
    token: ctx.admin, body: { name: `Kit Movil ${letras}`, aliases: ['SwiftUI'], academicAreaId: web.id, overrideReason: 'Lo usamos en la web de la carrera.' },
  });
  check(conMotivo.status === 409, 'V2.4.3 §23.3 Contra una regla dura no vale ni un motivo', `status ${conMotivo.status}`);

  const area = (await req('POST', '/academic-areas', {
    token: ctx.admin, body: { name: `Robotica Educativa ${letras}`, tags: [`legokit${letras.toLowerCase()}`] },
  })).data;
  const nombre = `Legokit${letras.toLowerCase()} Studio`;
  const sugerida = await req('GET', `/skills/classify?name=${encodeURIComponent(nombre)}`, { token: ctx.admin });
  check(sugerida.data?.rule === 'suggested' && sugerida.data?.areaIds?.includes(area.id),
    'V2.4.4 §23.3 Para una tecnología sin regla, se sugiere el área por sus etiquetas', json(sugerida.data));

  const otra = areas.find((a) => a.name === 'Redes') ?? areas[0];
  const sinMotivo = await req('POST', '/skills', { token: ctx.admin, body: { name: nombre, academicAreaId: otra.id } });
  check(sinMotivo.status === 409 && sinMotivo.data?.code === 'CLASSIFICATION_CONFIRMATION_REQUIRED'
    && (sinMotivo.data?.details?.suggestedAreaIds ?? []).includes(area.id),
  'V2.4.5 §23.3 Guardarla en otra área pide confirmar con motivo, y dice cuál se sugería', json(sinMotivo.data));
  const motivada = await req('POST', '/skills', {
    token: ctx.admin, body: { name: nombre, academicAreaId: otra.id, overrideReason: 'Se usa para enseñar redes con robots.' },
  });
  check(motivada.status === 201, 'V2.4.6 §23.3 Con motivo, el administrador decide', json(motivada.data));
  const auditoria = await req('GET', '/audit/events?eventType=SKILL_CLASSIFICATION_OVERRIDE', { token: ctx.admin });
  const registros = auditoria.data?.items ?? auditoria.data ?? [];
  check(registros.some((e) => e.metadata?.name === nombre && /robots/.test(e.metadata?.reason ?? '')),
    'V2.4.7 §23.3 Y la decisión queda auditada con su motivo', json(registros.slice?.(0, 1)));

  const enArea = await req('POST', '/skills', {
    token: ctx.admin, body: { name: `${nombre} Pro`, aliases: [`Legokit Pro ${letras}`], academicAreaId: area.id },
  });
  check(enArea.status === 201 && enArea.data?.aliases?.length === 1, 'V2.4.8 §23.2 La habilidad guarda sus alias', json(enArea.data));
  const aliasAjeno = await req('POST', '/skills', {
    token: ctx.admin, body: { name: `Otra ${letras}`, aliases: ['PostgreSQL'], academicAreaId: area.id },
  });
  check(aliasAjeno.status === 409 && aliasAjeno.data?.fields?.aliases,
    'V2.4.9 §23.2 Un alias no puede ser el nombre de otra habilidad', json(aliasAjeno.data?.fields));

  const tecnicos = [];
  for (const n of ['C++', 'C#', '.NET', 'Node.js', 'CI/CD']) {
    const r = await req('GET', `/skills/classify?name=${encodeURIComponent(n)}`, { token: ctx.admin });
    tecnicos.push(r.status);
  }
  const nombreTecnico = await req('POST', '/skills', { token: ctx.admin, body: { name: `CI/CD ${letras}`, academicAreaId: area.id } });
  check(tecnicos.every((st) => st === 200) && nombreTecnico.status !== 400,
    'V2.4.10 §23.4 Nombres técnicos reales (C++, C#, .NET, Node.js, CI/CD) se aceptan', `${tecnicos} / ${nombreTecnico.status}`);

  const duplicada = await req('POST', '/academic-areas', {
    token: ctx.admin, body: { name: `  robotica   educativa ${letras.toLowerCase()} `, tags: ['x'] },
  });
  check(duplicada.status === 409 || duplicada.status === 400,
    'V2.4.11 §23.1 El nombre de un área es único sin importar mayúsculas ni espacios', `status ${duplicada.status}`);

  const sinArea = await req('POST', '/skills', { token: ctx.admin, body: { name: `Huérfana ${letras}` } });
  check(sinArea.status === 400 && sinArea.data?.fields?.academicAreaId, 'V2.4.12 §23.2 Una habilidad sin área no existe', json(sinArea.data?.fields));
}

// ===========================================================================
//  BATCH 5 — Actividades y aprobación (§26–§31)
// ===========================================================================
async function batch5(ctx) {
  objective('BATCH 5 · Docente y Sociedad proponen, Dirección decide');
  const staff = async (key, role, semesters) => {
    const c = await provisionAndActivate(ctx.admin, { firstName: 'Ana', lastName: 'Staff', email: correoStaff(`act${key}`), role });
    if (semesters) await req('PUT', `/users/${c.userId}/semesters`, { token: ctx.admin, body: { semesters } });
    return c;
  };
  const docente = await staff('doc', 'TEACHER', [1, 5]);
  const director = await staff('dir', 'CAREER_DIRECTOR');
  const sociedad = await staff('soc', 'SCIENTIFIC_SOCIETY');
  const cats = (await req('GET', '/activity-categories', { token: director.token })).data ?? [];
  const taller = cats.find((c) => c.code === 'taller_academico') ?? cats[0];
  const extra = cats.find((c) => c.code === 'convocatoria') ?? cats.find((c) => c.appliesTo === 'extracurricular') ?? cats[0];

  const fuera = await req('POST', '/activities', {
    token: docente.token,
    body: { title: `Taller fuera de alcance ${TS}`, type: 'academica', categoryId: taller.id, semesterScope: [2] },
  });
  check(fuera.status === 403 || fuera.status === 400, 'V2.5.1 §28 El docente no elige semestres fuera de su alcance', `status ${fuera.status}`);

  const publicada = await req('POST', '/activities', {
    token: docente.token,
    body: { title: `Taller directo ${TS}`, type: 'academica', categoryId: taller.id, semesterScope: [1, 5], status: 'open' },
  });
  check(publicada.status === 409, 'V2.5.2 §27.3 El docente no publica sin aprobación', `status ${publicada.status}`);

  const creada = await req('POST', '/activities', {
    token: docente.token,
    body: {
      title: `Taller de Docker ${TS}`, type: 'academica', categoryId: taller.id, semesterScope: [1, 5],
      internalConstancyEnabled: true, gamificationRules: [{ trigger: 'participacion_confirmada', points: 30 }],
    },
  });
  const id = creada.data?.id;
  check(creada.status === 201 && creada.data?.requiresReview === true && creada.data?.reviewStatus === null,
    'V2.5.3 §27.3 Nace en borrador, pendiente de enviar a revisión', json({ rs: creada.data?.reviewStatus, rr: creada.data?.requiresReview, st: creada.status }));
  check((creada.data?.gamificationRules ?? []).some((r) => r.points === 30), 'V2.5.4 §31.2 Lleva su regla de puntos', json(creada.data?.gamificationRules));

  const abrir = await req('PATCH', `/activities/${id}`, { token: docente.token, body: { status: 'open' } });
  check(abrir.status === 409, 'V2.5.5 §27.6 Sin aprobación no se abre', `status ${abrir.status}`);

  const enviada = await req('POST', `/activities/${id}/submit`, { token: docente.token, body: {} });
  check(enviada.status === 200 && enviada.data?.reviewStatus === 'pending', 'V2.5.6 §27.3 Se envía a Dirección', json(enviada.data?.reviewStatus));
  const editarEnRevision = await req('PATCH', `/activities/${id}`, { token: docente.token, body: { title: `Otro título ${TS}` } });
  check(editarEnRevision.status === 409, 'V2.5.7 §27 En revisión no cambia su contenido', `status ${editarEnRevision.status}`);

  const pendientes = await req('GET', '/activities/reviews/pending', { token: director.token });
  check((pendientes.data ?? []).some((a) => a.id === id), 'V2.5.8 §27 Dirección la ve entre las pendientes');
  const docenteRevisa = await req('POST', `/activities/${id}/review`, { token: docente.token, body: { decision: 'approve' } });
  check(docenteRevisa.status === 403, 'V2.5.9 §27.3 El docente no aprueba su propia actividad', `status ${docenteRevisa.status}`);
  const adminRevisa = await req('POST', `/activities/${id}/review`, { token: ctx.admin, body: { decision: 'approve' } });
  check(adminRevisa.status === 403, 'V2.5.10 §6.5 La administración no aprueba actividades', `status ${adminRevisa.status}`);
  const observarSinMotivo = await req('POST', `/activities/${id}/review`, { token: director.token, body: { decision: 'observe' } });
  check(observarSinMotivo.status === 400, 'V2.5.11 §27.3 Observar exige decir qué cambiar', `status ${observarSinMotivo.status}`);

  const observada = await req('POST', `/activities/${id}/review`, {
    token: director.token, body: { decision: 'observe', comment: 'Indica el laboratorio y baja los puntos a 20.' },
  });
  check(observada.data?.reviewStatus === 'observed' && /laboratorio/.test(observada.data?.reviewComment ?? ''),
    'V2.5.12 §27.3 OBSERVED conserva la observación', json(observada.data?.reviewComment));
  const corregida = await req('PATCH', `/activities/${id}`, {
    token: docente.token, body: { location: 'Laboratorio 3', gamificationRules: [{ trigger: 'participacion_confirmada', points: 20 }] },
  });
  check(corregida.status === 200, 'V2.5.13 §27.3 Observada se puede editar', `status ${corregida.status}`);
  const reenviada = await req('POST', `/activities/${id}/submit`, { token: docente.token, body: { comment: 'Corregida.' } });
  check(reenviada.data?.reviewStatus === 'pending', 'V2.5.14 §27.3 Y reenviar');
  const aprobada = await req('POST', `/activities/${id}/review`, { token: director.token, body: { decision: 'approve' } });
  check(aprobada.data?.reviewStatus === 'approved', 'V2.5.15 §27.3 Dirección aprueba', json(aprobada.data?.reviewStatus));
  const abierta = await req('PATCH', `/activities/${id}`, { token: docente.token, body: { status: 'open' } });
  check(abierta.status === 200 && abierta.data?.status === 'open', 'V2.5.16 §27.6 Aprobada, el docente la publica', `status ${abierta.status}`);
  const historia = await req('GET', `/activities/${id}/reviews`, { token: docente.token });
  check(JSON.stringify((historia.data ?? []).map((h) => h.action)) === JSON.stringify(['submitted', 'observed', 'submitted', 'approved']),
    'V2.5.17 §88.12 La aprobación tiene historia completa', json((historia.data ?? []).map((h) => h.action)));
  const cambioTrasPublicar = await req('PATCH', `/activities/${id}`, { token: docente.token, body: { title: `Cambiada ${TS}` } });
  check(cambioTrasPublicar.status === 409, 'V2.5.18 §27 Publicada, su contenido no cambia sin Dirección', `status ${cambioTrasPublicar.status}`);
  const auditoria = await req('GET', '/audit/events?eventType=ACTIVITY_APPROVED', { token: ctx.admin });
  check((auditoria.data?.items ?? auditoria.data ?? []).some((e) => e.entityId === id), 'V2.5.19 §69 La aprobación queda auditada');

  const otra = await req('POST', '/activities', { token: docente.token, body: { title: `Taller rechazado ${TS}`, type: 'academica', categoryId: taller.id, semesterScope: [5] } });
  await req('POST', `/activities/${otra.data.id}/submit`, { token: docente.token, body: {} });
  await req('POST', `/activities/${otra.data.id}/review`, { token: director.token, body: { decision: 'reject', comment: 'Duplica un taller existente.' } });
  const reenvioRechazada = await req('POST', `/activities/${otra.data.id}/submit`, { token: docente.token, body: {} });
  const abrirRechazada = await req('PATCH', `/activities/${otra.data.id}`, { token: docente.token, body: { status: 'open' } });
  check(reenvioRechazada.status === 409 && abrirRechazada.status === 409, 'V2.5.20 §27.3 REJECTED no se publica ni se reutiliza', `${reenvioRechazada.status}/${abrirRechazada.status}`);

  const socAcad = await req('POST', '/activities', { token: sociedad.token, body: { title: `Académica de sociedad ${TS}`, type: 'academica', categoryId: taller.id } });
  check(socAcad.status === 403, 'V2.5.21 §27.4 La Sociedad no crea académicas', `status ${socAcad.status}`);
  const socExtra = await req('POST', '/activities', { token: sociedad.token, body: { title: `Hackaton de la sociedad ${TS}`, type: 'extracurricular', categoryId: extra.id } });
  check(socExtra.status === 201 && socExtra.data?.requiresReview === true, 'V2.5.22 §27.4 Sus extracurriculares pasan por Dirección', json([socExtra.status, socExtra.data?.reviewStatus, socExtra.data?.message]));

  const deDireccion = await req('POST', '/activities', { token: director.token, body: { title: `Seminario de carrera ${TS}`, type: 'academica', categoryId: taller.id, status: 'open' } });
  check(deDireccion.status === 201 && deDireccion.data?.reviewStatus === 'not_required' && deDireccion.data?.status === 'open',
    'V2.5.23 §27.5 Dirección publica sin segunda autoridad', json([deDireccion.data?.reviewStatus, deDireccion.data?.status]));

  const est = await provisionAndActivate(ctx.admin, { firstName: 'Lia', lastName: 'Paz', email: correoEst('act5'), role: 'STUDENT', semester: 5 });
  await req('POST', '/profiles/me', { token: est.token, body: {} });
  const perfil = (await req('GET', '/profiles/me', { token: est.token })).data;
  await req('POST', `/activities/${id}/register`, { token: est.token });
  const adminConfirma = await req('PATCH', `/activities/${id}/confirm-participation`, {
    token: ctx.admin, body: { studentProfileId: perfil.id, status: 'confirmed' },
  });
  check(adminConfirma.status === 403, 'V2.5.24 §6.5 La administración no confirma participación', `status ${adminConfirma.status}`);
  const confirmada = await req('PATCH', `/activities/${id}/confirm-participation`, {
    token: docente.token, body: { studentProfileId: perfil.id, status: 'confirmed' },
  });
  check(confirmada.status === 200, 'V2.5.25 §29 El responsable confirma', `status ${confirmada.status}`);
  const progreso = (await req('GET', '/gamification/me', { token: est.token })).data;
  check((progreso?.events ?? []).some((e) => e.points === 20 && /actividad/.test(e.reason ?? '')),
    'V2.5.26 §31.2 La participación da los puntos que fijó la actividad, aprobados por Dirección', json(progreso?.events?.slice(0, 2)));

  const constancia = await req('POST', '/constancies/internal', {
    token: docente.token, body: { profileId: perfil.id, activityId: id, description: `Constancia del taller ${TS}` },
  });
  check(constancia.status === 201 && constancia.data?.authorizedById === director.userId && constancia.data?.issuedById === docente.userId,
    'V2.5.27 §30 El responsable emite la constancia; la autorizó la Dirección que aprobó', json({ s: constancia.status, a: constancia.data?.authorizedById, i: constancia.data?.issuedById, m: constancia.data?.message }));
  const adminConstancia = await req('POST', '/constancies/internal', {
    token: ctx.admin, body: { profileId: perfil.id, activityId: deDireccion.data.id, description: 'Constancia de prueba' },
  });
  check(adminConstancia.status === 403, 'V2.5.28 §6.5 La administración no otorga constancias', `status ${adminConstancia.status}`);
  const sinHabilitar = await req('POST', '/activities', { token: director.token, body: { title: `Charla sin constancia ${TS}`, type: 'academica', categoryId: taller.id, status: 'open' } });
  await req('POST', `/activities/${sinHabilitar.data.id}/register`, { token: est.token });
  await req('PATCH', `/activities/${sinHabilitar.data.id}/confirm-participation`, { token: director.token, body: { studentProfileId: perfil.id, status: 'confirmed' } });
  const noHabilitada = await req('POST', '/constancies/internal', {
    token: director.token, body: { profileId: perfil.id, activityId: sinHabilitar.data.id, description: `Constancia ${TS}` },
  });
  check(noHabilitada.status === 400, 'V2.5.29 §30 Sin constancias habilitadas en la actividad, no se emiten', `status ${noHabilitada.status}`);

  const demasiados = await req('POST', '/activities', {
    token: director.token, body: { title: `Taller con muchos puntos ${TS}`, type: 'academica', categoryId: taller.id, gamificationRules: [{ trigger: 'participacion_confirmada', points: 900 }] },
  });
  const otroHecho = await req('POST', '/activities', {
    token: director.token, body: { title: `Taller con hecho ajeno ${TS}`, type: 'academica', categoryId: taller.id, gamificationRules: [{ trigger: 'perfil_completo', points: 5 }] },
  });
  check(demasiados.status === 400 && otroHecho.status === 400, 'V2.5.30 §31.2 Puntos en rango y solo hechos permitidos', `${demasiados.status}/${otroHecho.status}`);

  // §80 seguridad: el creador viaja anidado en actividades y pendientes;
  // su hash de contraseña nunca debe salir.
  const listados = [
    await req('GET', '/activities', { token: est.token }),
    await req('GET', '/activities/managed', { token: docente.token }),
    await req('GET', '/activities/reviews/pending', { token: director.token }),
    await req('GET', `/activities/${deDireccion.data.id}`, { token: director.token }),
  ];
  const fuga = listados.some((r) => /passwordHash|password_hash|\$2[aby]\$/.test(JSON.stringify(r.data)));
  check(listados.every((r) => r.status === 200) && !fuga, 'V2.5.31 §80 Ninguna respuesta de actividades expone el hash de contraseña', listados.map((r) => r.status).join('/'));
}

// ===========================================================================

const BATCHES = { batch2, batch3, batch4, batch5, batch10 };

async function main() {
  console.log(`${C.bold}Afinia V2 — verificación contra la API${C.r}`);
  const ctx = { admin: await loginAdmin(), TS, correoEst, correoStaff };
  const solo = process.argv[2];
  for (const [nombre, paso] of Object.entries(BATCHES)) {
    if (solo && nombre !== solo) continue;
    try {
      await paso(ctx);
    } catch (e) {
      failures.push(`${nombre}: ${e.message}`);
      console.log(`  ${C.bad}✗ ${nombre} se interrumpió: ${e.message}${C.r}`);
    }
  }
  console.log(`\n${C.bold}${passed} comprobaciones correctas, ${failures.length} fallidas${C.r}`);
  if (failures.length) {
    for (const f of failures) console.log(`  ${C.bad}- ${f}${C.r}`);
    process.exit(1);
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
