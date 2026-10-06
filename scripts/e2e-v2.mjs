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
  API, PWD, aprobarActividad, codigoUniversitario, loginAdmin, provisionAndActivate, req,
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

  // ----- Código universitario en toda cuenta, con el prefijo de su rol
  const alta = (k, role, extra = {}) => req('POST', '/users', {
    token: ctx.admin,
    body: { firstName: 'Rosa', lastName: 'Mendez', email: role === 'STUDENT' ? correoEst(k) : correoStaff(k), role, ...extra },
  });
  const docSinCodigo = await alta('doccod0', 'TEACHER');
  check(docSinCodigo.status === 400 && docSinCodigo.data?.fields?.universityCode,
    'V2.2.3b §12 Toda cuenta lleva código: un docente sin código -> 400 en ese campo', `status ${docSinCodigo.status}`);
  const prefijoAjeno = await alta('doccod1', 'TEACHER', { universityCode: codigoUniversitario('STUDENT') });
  check(prefijoAjeno.status === 400 && /DOC-/.test(json(prefijoAjeno.data?.fields?.universityCode)),
    'V2.2.3c §12 El prefijo depende del rol: un docente con EST- -> 400 y pide DOC-', json(prefijoAjeno.data?.fields));
  const malFormato = await alta('doccod2', 'TEACHER', { universityCode: 'DOC-12' });
  check(malFormato.status === 400 && malFormato.data?.fields?.universityCode,
    'V2.2.3d §12 Formato PREFIJO-XXXXXXX: «DOC-12» -> 400', `status ${malFormato.status}`);
  const enMinusculas = codigoUniversitario('TEACHER');
  const docOk = await alta('doccod3', 'TEACHER', { universityCode: enMinusculas.toLowerCase() });
  check(docOk.status === 201 && docOk.data?.universityCode === enMinusculas && docOk.data?.semester == null,
    'V2.2.3e §12 Se guarda en mayúsculas y el docente no lleva semestre', `status ${docOk.status} ${docOk.data?.universityCode}`);

  const socSinSemestre = await alta('soccod0', 'SCIENTIFIC_SOCIETY', { universityCode: codigoUniversitario('SCIENTIFIC_SOCIETY') });
  check(socSinSemestre.status === 400 && socSinSemestre.data?.fields?.semester,
    'V2.2.3f La Sociedad científica indica su semestre al crearse -> 400 sin él', json(socSinSemestre.data?.fields));
  const codSoc = codigoUniversitario('SCIENTIFIC_SOCIETY');
  const socOk = await alta('soccod1', 'SCIENTIFIC_SOCIETY', { universityCode: codSoc, semester: 6 });
  check(socOk.status === 201 && socOk.data?.semester === 6 && /^EST-[A-Z0-9]{7}$/.test(socOk.data?.universityCode ?? ''),
    'V2.2.3g La Sociedad científica se crea con su semestre y un código EST-', `status ${socOk.status}`);
  const repetido = await alta('estcod9', 'STUDENT', { universityCode: codSoc, semester: 2 });
  check(repetido.status === 409 && repetido.data?.fields?.universityCode,
    'V2.2.3h El código es único entre todas las cuentas, no solo entre estudiantes -> 409', `status ${repetido.status}`);
  const lista = await req('GET', `/users?search=${encodeURIComponent(correoStaff('soccod1'))}`, { token: ctx.admin });
  const fila = (lista.data ?? [])[0];
  check(fila?.universityCode === codSoc && fila?.semester === 6,
    'V2.2.3i El listado muestra el código y el semestre de cada cuenta', json(fila && { c: fila.universityCode, s: fila.semester }));

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
  // F5 en medio de la renovación: el navegador perdió la cookie nueva y vuelve
  // con la anterior. Dentro de la gracia sirve una vez; después, ya no.
  const vieja = await crudo('POST', '/auth/refresh', { body: {}, cookie, headers: { 'X-Session-Transport': 'cookie' } });
  check(vieja.status === 200 && Boolean(cookieDe(vieja.setCookie)),
    'V2.2.8 §18 F5 en medio de la renovación: la cookie anterior sirve una vez y rota', `status ${vieja.status}`);
  const viejaOtraVez = await crudo('POST', '/auth/refresh', { body: {}, cookie, headers: { 'X-Session-Transport': 'cookie' } });
  check(viejaOtraVez.status === 401, 'V2.2.8b §18 Usada otra vez, la cookie anterior ya no sirve (rotación)', `status ${viejaOtraVez.status}`);

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

// ===========================================================================
//  BATCH 8 — Asistente de IA (sin proveedor) y moderación de nombres de equipo
// ===========================================================================
async function batch8(ctx) {
  objective('BATCH 8 · La IA es opcional y no decide; los nombres de equipo se moderan por reglas');
  const est = await provisionAndActivate(ctx.admin, { firstName: 'Iris', lastName: 'Asistida', email: correoEst('ai1'), role: 'STUDENT', semester: 6 });
  const otro = await provisionAndActivate(ctx.admin, { firstName: 'Tomas', lastName: 'Invitado', email: correoEst('ai2'), role: 'STUDENT', semester: 6 });
  const director = await provisionAndActivate(ctx.admin, { firstName: 'Delia', lastName: 'Directora', email: correoStaff('aidir'), role: 'CAREER_DIRECTOR' });
  for (const s of [est, otro]) {
    s.profileId = (await req('POST', '/profiles/me', { token: s.token, body: {} })).data?.id
      ?? (await req('GET', '/profiles/me', { token: s.token })).data?.id;
  }

  const st = await req('GET', '/ai/status', { token: est.token });
  check(st.status === 200 && st.data?.enabled === false && st.data?.provider === 'none' && (st.data?.tasks ?? []).length === 0,
    'V2.8.1 §84 Con AI_PROVIDER=none el sistema arranca y declara la IA apagada', json(st.data));

  const cv = await req('POST', '/ai/suggestions', {
    token: est.token, body: { task: 'CV_TEXT_ASSIST', text: 'Trabajé en el backend del proyecto de inventario con NestJS y PostgreSQL.', mode: 'improve' },
  });
  check(cv.status === 201 && cv.data?.available === false && !cv.data?.runId,
    'V2.8.2 §84 Pedir ayuda sin proveedor responde «no disponible», sin error ni registro', json(cv.data));

  const narrativa = await req('POST', '/ai/suggestions', { token: est.token, body: { task: 'ANALYTICS_NARRATIVE' } });
  const moderar = await req('POST', '/ai/suggestions', { token: director.token, body: { task: 'CONTENT_MODERATION_FLAG', text: 'x' } });
  const cvDirector = await req('POST', '/ai/suggestions', { token: director.token, body: { task: 'CV_TEXT_ASSIST', text: 'Texto cualquiera de prueba para el CV.' } });
  check(narrativa.status === 403 && moderar.status === 403 && cvDirector.status === 403,
    'V2.8.3 §43.2 Cada tarea tiene sus roles; la moderación no se pide desde fuera', `${narrativa.status}/${moderar.status}/${cvDirector.status}`);

  const invalida = await req('POST', '/ai/suggestions', { token: est.token, body: { task: 'APPROVE_ACTIVITY' } });
  check(invalida.status === 400, 'V2.8.4 §43.2 Una tarea fuera de la lista se rechaza', `status ${invalida.status}`);

  const regla = await req('POST', '/ai/suggestions', { token: ctx.admin, body: { task: 'TAG_SUGGESTION', target: 'skill', text: 'React Native' } });
  check(regla.status === 201 && regla.data?.ok === true && regla.data?.source === 'rule' && !!regla.data?.result?.areaId,
    'V2.8.5 §23.3 Lo que una regla resuelve no necesita IA, ni siquiera apagada', json(regla.data));

  const proyecto = await req('POST', '/projects', {
    token: est.token,
    body: { title: `Proyecto asistido ${TS}`, description: 'Proyecto para probar la IA.', technologies: ['NestJS'], status: 'active' },
  });
  const explicacion = await req('POST', '/ai/suggestions', { token: est.token, body: { task: 'INCONSISTENCY_EXPLANATION', projectId: proyecto.data?.id } });
  check(explicacion.status === 201 && explicacion.data?.source === 'rule',
    'V2.8.6 §43 Sin inconsistencias registradas, la explicación la da la regla', json(explicacion.data));
  const ajena = await req('POST', '/ai/suggestions', { token: otro.token, body: { task: 'EVIDENCE_SUMMARY', projectId: proyecto.data?.id } });
  check(ajena.status === 403, 'V2.8.7 §43 La IA no abre puertas: el proyecto ajeno sigue cerrado', `status ${ajena.status}`);

  const aceptarAjena = await req('POST', '/ai/runs/00000000-0000-4000-8000-000000000000/accept', { token: est.token });
  check(aceptarAjena.status === 404, 'V2.8.8 §43.3 No se acepta una sugerencia inexistente o ajena', `status ${aceptarAjena.status}`);
  const runsAdmin = await req('GET', '/ai/runs', { token: ctx.admin });
  const runsEst = await req('GET', '/ai/runs', { token: est.token });
  check(runsAdmin.status === 200 && Array.isArray(runsAdmin.data) && runsEst.status === 403,
    'V2.8.9 §43.3 El registro de ejecuciones es de soporte (solo Administración)', `${runsAdmin.status}/${runsEst.status}`);
  check((runsAdmin.data ?? []).every((r) => !('result' in r) && !('input' in r)),
    'V2.8.10 §43.4 El registro de soporte muestra metadatos, no contenido');

  // ----------------------------------------------------------- §44
  const nuevaNecesidad = async (k) => (await req('POST', '/team-needs', {
    token: est.token, body: { purpose: `Necesidad ${k} ${TS}`, maxMembers: 3 },
  })).data?.id;
  const crearEquipo = async (name) => {
    const id = await nuevaNecesidad(name.slice(0, 12));
    return req('POST', `/team-needs/${id}/team`, { token: est.token, body: { name } });
  };
  const rechazos = [
    ['Equipo pendejo', 'TEAM_NAME_FORBIDDEN'],
    ['Los P3ND3J0S', 'TEAM_NAME_FORBIDDEN'],
    ['p u t a s', 'TEAM_NAME_FORBIDDEN'],
    ['Escríbenos a equipo@correo.com', 'TEAM_NAME_CONTACT'],
    ['Visiten www.equipo.xyz', 'TEAM_NAME_CONTACT'],
    ['Llama al 7712 3456', 'TEAM_NAME_CONTACT'],
    ['AB', 'TEAM_NAME_LENGTH'],
    ['Equipo <script>', 'TEAM_NAME_CHARACTERS'],
    ['Equipooooooo', 'TEAM_NAME_REPEATED'],
  ];
  const obtenidos = [];
  for (const [nombre] of rechazos) obtenidos.push(await crearEquipo(nombre));
  check(obtenidos.every((r, i) => r.status === 400 && r.data?.code === rechazos[i][1]),
    'V2.8.11 §44 Reglas: términos prohibidos (también con números o letras sueltas), contacto, longitud, caracteres, repeticiones',
    obtenidos.map((r, i) => `${rechazos[i][0]}=${r.status}/${r.data?.code}`).filter((_, i) => obtenidos[i].data?.code !== rechazos[i][1]).join(' | '));

  const valido = await crearEquipo('Computación Distribuida & IoT');
  check(valido.status === 201 && valido.data?.nameStatus === 'ok',
    'V2.8.12 §44 Sin falsos positivos: «Computación» no choca con un término prohibido', json(valido.data));
  const tecnico = await crearEquipo('C# y .NET (grupo 2)');
  check(tecnico.status === 201, 'V2.8.13 §23.4 Nombres técnicos con signos válidos se aceptan', json(tecnico.data));

  const renombrar = await req('PATCH', `/teams/${valido.data?.id}`, { token: est.token, body: { name: 'Equipo idiota' } });
  const renombrarBien = await req('PATCH', `/teams/${valido.data?.id}`, { token: est.token, body: { name: 'Equipo Aurora' } });
  const renombrarAjeno = await req('PATCH', `/teams/${valido.data?.id}`, { token: otro.token, body: { name: 'Equipo Robado' } });
  check(renombrar.status === 400 && renombrarBien.status === 200 && renombrarBien.data?.name === 'Equipo Aurora' && renombrarAjeno.status === 403,
    'V2.8.14 §44 Renombrar vuelve a moderar, y solo lo hace el responsable', `${renombrar.status}/${renombrarBien.status}/${renombrarAjeno.status}`);

  const auditoria = await req('GET', `/audit/events?eventType=TEAM_NAME_MODERATED&actorUserId=${est.userId}&limit=50`, { token: ctx.admin });
  const filas = Array.isArray(auditoria.data) ? auditoria.data : [];
  check(auditoria.status === 200 && filas.filter((f) => f.metadata?.resultado === 'rechazado').length >= rechazos.length
    && !JSON.stringify(filas).includes('pendejo'),
    'V2.8.15 §69 Cada rechazo queda en la auditoría con la regla, sin el nombre', `status ${auditoria.status}, filas ${filas.length}`);
}

// ===========================================================================
//  BATCH 11 — Chat retirado, canales de contacto y nota por contacto
// ===========================================================================
async function batch11(ctx) {
  objective('BATCH 11 · Sin chat; cada uno comparte sus canales y anota a sus contactos');
  const nuevo = async (k, nombre) => {
    const c = await provisionAndActivate(ctx.admin, { firstName: nombre, lastName: 'Contacto', email: correoEst(`b11${k}`), role: 'STUDENT', semester: 5 });
    c.profileId = (await req('POST', '/profiles/me', { token: c.token, body: {} })).data?.id;
    return c;
  };
  const ana = await nuevo('ana', 'Ana');
  const beto = await nuevo('beto', 'Beto');
  const ciro = await nuevo('ciro', 'Ciro');

  const chat = await req('GET', '/conversations', { token: ana.token });
  const nueva = await req('POST', '/conversations/direct', { token: ana.token, body: { profileId: beto.profileId } });
  check(chat.status === 410 && nueva.status === 410 && chat.data?.code === 'CHAT_RETIRED',
    'V2.11.1 §57 Las rutas de chat responden 410 Gone', `${chat.status}/${nueva.status}`);

  const malos = [
    ['whatsapp', '71234567', 'sin código de país'],
    ['linkedin', 'https://evil.com/in/ana', 'dominio ajeno'],
    ['link', 'javascript:alert(1)', 'javascript:'],
    ['link', 'http://sitio.com', 'http sin cifrar'],
    ['email', 'no-es-correo', 'correo inválido'],
    ['teams', 'https://evil.com/chat', 'enlace no de Teams'],
  ];
  const resp = [];
  for (const [channel, value] of malos) {
    resp.push(await req('PUT', '/profiles/me/contact-channels', { token: ana.token, body: { channels: [{ channel, value }] } }));
  }
  check(resp.every((r) => r.status === 400 && r.data?.fields?.['channels.0.value']),
    'V2.11.2 §59 Cada canal valida su formato y se rechaza lo inseguro', resp.map((r, i) => `${malos[i][2]}=${r.status}`).join(' '));

  const guardar = await req('PUT', '/profiles/me/contact-channels', {
    token: ana.token,
    body: {
      channels: [
        { channel: 'whatsapp', value: '+591 712-34567', isPublic: false },
        { channel: 'linkedin', value: 'linkedin.com/in/ana-contacto', isPublic: true },
        { channel: 'teams', value: 'Ana.Contacto@est.univalle.edu' },
      ],
    },
  });
  const porCanal = Object.fromEntries((guardar.data ?? []).map((c) => [c.channel, c]));
  check(guardar.status === 200 && porCanal.whatsapp?.value === '+59171234567' && porCanal.whatsapp?.href === 'https://wa.me/59171234567'
    && porCanal.linkedin?.href === 'https://www.linkedin.com/in/ana-contacto'
    && porCanal.teams?.href?.startsWith('https://teams.microsoft.com/l/chat/0/0?users=ana.contacto%40'),
    'V2.11.3 §59 Se normalizan y cada uno da un único enlace seguro', json(guardar.data));
  const duplicado = await req('PUT', '/profiles/me/contact-channels', {
    token: ana.token, body: { channels: [{ channel: 'email', value: 'a@b.com' }, { channel: 'email', value: 'c@d.com' }] },
  });
  check(duplicado.status === 400, 'V2.11.4 §59 Un canal por tipo', `status ${duplicado.status}`);

  // Contacto Ana <-> Beto
  const enlace = (await req('GET', '/profiles/me/public-link', { token: ana.token })).data;
  // §45: el contacto se pide desde el perfil compartido, así que Ana lo publica.
  const publicar = await req('PUT', '/profiles/me/visibility', { token: ana.token, body: { publicProfileEnabled: true, fields: { bio: true } } });
  const sol = await req('POST', '/contacts/requests', { token: beto.token, body: { slug: enlace?.slug } });
  await req('PATCH', `/contacts/requests/${sol.data?.id}`, { token: ana.token, body: { decision: 'accept' } });

  const deBeto = (await req('GET', '/contacts', { token: beto.token })).data ?? [];
  const anaParaBeto = deBeto.find((c) => c.profileId === ana.profileId);
  check(anaParaBeto?.channels?.length === 3 && anaParaBeto.channels.every((c) => c.href),
    'V2.11.5 §59 Un contacto aceptado ve todos los canales que compartió el otro', json(anaParaBeto?.channels));
  const deCiro = await req('GET', '/contacts', { token: ciro.token });
  check(!(deCiro.data ?? []).some((c) => c.profileId === ana.profileId), 'V2.11.6 §56 Quien no es contacto no los ve');

  const sinCorreo = JSON.stringify(anaParaBeto ?? {});
  check(!sinCorreo.includes(ana.email), 'V2.11.7 §59 El correo institucional no se expone por omisión');

  const nota = await req('PATCH', `/contacts/${ana.profileId}/note`, {
    token: beto.token, body: { alias: 'Ana del lab', context: 'Hackatón 2026', preferredChannel: 'linkedin' },
  });
  const notaMala = await req('PATCH', `/contacts/${ana.profileId}/note`, { token: beto.token, body: { preferredChannel: 'email' } });
  const notaAjena = await req('PATCH', `/contacts/${ana.profileId}/note`, { token: ciro.token, body: { alias: 'x' } });
  check(nota.status === 200 && nota.data?.alias === 'Ana del lab' && notaMala.status === 400 && notaAjena.status === 404,
    'V2.11.8 §56 Alias, contexto y canal preferido; solo entre contactos y con un canal que el otro comparte',
    `${nota.status}/${notaMala.status}/${notaAjena.status}`);
  const vistaBeto = ((await req('GET', '/contacts', { token: beto.token })).data ?? []).find((c) => c.profileId === ana.profileId);
  const vistaAna = ((await req('GET', '/contacts', { token: ana.token })).data ?? []).find((c) => c.profileId === beto.profileId);
  check(vistaBeto?.note?.alias === 'Ana del lab' && vistaBeto?.note?.preferredChannel === 'linkedin' && vistaAna?.note?.alias === null,
    'V2.11.9 §56 La nota es personal: Ana no ve cómo la anotó Beto', json([vistaBeto?.note, vistaAna?.note]));

  const publico = await req('GET', `/public/profiles/${enlace?.slug}`);
  const canalesPublicos = publico.data?.contactChannels ?? [];
  check(publicar.status === 200 && publico.status === 200 && canalesPublicos.length === 1
    && canalesPublicos[0].channel === 'linkedin' && !('value' in canalesPublicos[0]),
    'V2.11.10 §58 En el perfil público solo aparecen los canales marcados como públicos', `status ${publico.status} ${json(canalesPublicos)}`);

  await req('DELETE', `/contacts/${ana.profileId}`, { token: beto.token });
  const trasDeshacer = ((await req('GET', '/contacts', { token: beto.token })).data ?? []).find((c) => c.profileId === ana.profileId);
  check(!trasDeshacer, 'V2.11.11 §56 Deshecho el contacto, sus canales dejan de verse');

  const quitar = await req('PUT', '/profiles/me/contact-channels', { token: ana.token, body: { channels: [] } });
  check(quitar.status === 200 && (quitar.data ?? []).length === 0, 'V2.11.12 §59 Todos los canales son opcionales y se pueden quitar');
}

// ===========================================================================
//  BATCH 12 — CV con plantillas, presentación aprobada y descargo
// ===========================================================================

/** PDF por POST, como lo descarga la web; devuelve el texto latin1 del archivo. */
async function cvPdf(token, body) {
  const res = await fetch(`${API}/trajectory-summary/pdf`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
    body: JSON.stringify(body),
  });
  const buf = Buffer.from(await res.arrayBuffer());
  let data = null;
  if (!res.ok) { try { data = JSON.parse(buf.toString('utf8')); } catch { /* binario */ } }
  return { status: res.status, type: res.headers.get('content-type'), text: buf.toString('latin1'), data };
}

async function batch12(ctx) {
  objective('BATCH 12 · CV: plantillas, secciones nuevas, presentación aprobada y descargo');
  const est = await provisionAndActivate(ctx.admin, { firstName: 'Clara', lastName: 'Curricular', email: correoEst('cv1'), role: 'STUDENT', semester: 7 });
  await req('POST', '/profiles/me', { token: est.token, body: { bio: 'Biografía del perfil dinámico.' } });
  await req('PUT', '/profiles/me/contact-channels', {
    token: est.token, body: { channels: [{ channel: 'linkedin', value: 'linkedin.com/in/clara-curricular' }] },
  });

  const secciones = await req('GET', '/trajectory-summary/sections', { token: est.token });
  const claves = (secciones.data?.sections ?? []).map((s) => s.key);
  check(claves.includes('badges') && claves.includes('contact'),
    'V2.12.1 §61.1 Se pueden elegir insignias y contacto autorizado', json(claves));
  check((secciones.data?.templates ?? []).map((t) => t.key).join() === 'classic,modern,compact',
    'V2.12.2 §61.2 Hay tres plantillas estáticas', json(secciones.data?.templates));
  const DESCARGO = 'Documento generado a partir de información registrada en Afinia. No constituye historial académico oficial, certificación institucional ni acreditación profesional de competencias.';
  check(secciones.data?.disclaimer === DESCARGO, 'V2.12.3 §61.4 El descargo es el texto exacto de la especificación');

  const vista = await req('POST', '/trajectory-summary/preview', {
    token: est.token, body: { sections: ['bio', 'contact'], template: 'modern', summaryText: 'Estudiante de séptimo semestre con interés en backend.' },
  });
  check(vista.status === 201 && vista.data?.template === 'modern' && vista.data?.bio === 'Estudiante de séptimo semestre con interés en backend.',
    'V2.12.4 §61.3 Una presentación propia reemplaza la biografía, sin aprobación aparte', json(vista.data?.bio));
  check((vista.data?.contact ?? []).some((c) => c.label === 'LinkedIn' && c.value.includes('clara-curricular')) && !JSON.stringify(vista.data).includes(est.email),
    'V2.12.5 §61.1 El contacto son los canales que compartió; el correo institucional no entra', json(vista.data?.contact));
  const sinTexto = await req('POST', '/trajectory-summary/preview', { token: est.token, body: { sections: ['bio'] } });
  check(sinTexto.data?.bio === 'Biografía del perfil dinámico.', 'V2.12.6 §60 Sin presentación propia se usa la biografía');

  const pdfs = {};
  for (const t of ['classic', 'modern', 'compact']) {
    pdfs[t] = await cvPdf(est.token, { sections: ['bio', 'contact', 'badges'], template: t, summaryText: 'Presentación (con paréntesis) para el PDF.' });
  }
  check(Object.values(pdfs).every((p) => p.status === 201 && p.type?.includes('application/pdf') && p.text.startsWith('%PDF-')),
    'V2.12.7 §61 Las tres plantillas generan un PDF', Object.values(pdfs).map((p) => p.status).join('/'));
  check(Object.values(pdfs).every((p) => p.text.includes('No constituye historial acad')),
    'V2.12.8 §61.4 El descargo va dentro del PDF en todas las plantillas');
  check(pdfs.compact.text.includes('/Times-Roman') && !pdfs.classic.text.includes('/Times-Roman')
    && / rg /.test(pdfs.modern.text) && !/ rg /.test(pdfs.classic.text),
    'V2.12.9 §61.2 Las plantillas cambian tipografía y color, no el contenido');
  check(pdfs.classic.text.includes('\\(con par') && pdfs.modern.text.includes('linkedin.com/in/clara-curricular'),
    'V2.12.10 §61 La presentación y el contacto llegan al PDF, con caracteres escapados');

  const inventado = await cvPdf(est.token, { sections: ['bio'], summaryText: 'Texto que dice venir de la IA.', summaryAiRunId: '00000000-0000-4000-8000-000000000000' });
  check(inventado.status === 409 && inventado.data?.code === 'CV_TEXT_NOT_APPROVED',
    'V2.12.11 §61.3 Un texto atribuido a una sugerencia no aceptada no se exporta', `status ${inventado.status}`);

  const largo = await cvPdf(est.token, { sections: ['bio'], summaryText: 'x'.repeat(1201) });
  const plantillaMala = await cvPdf(est.token, { sections: ['bio'], template: 'canva' });
  check(largo.status === 400 && plantillaMala.status === 400, 'V2.12.12 §61.2 Largo máximo y solo plantillas existentes', `${largo.status}/${plantillaMala.status}`);

  const viejo = await fetch(`${API}/trajectory-summary/pdf?sections=bio&template=compact`, { headers: { Authorization: `Bearer ${est.token}` } });
  const textoViejo = Buffer.from(await viejo.arrayBuffer()).toString('latin1');
  check(viejo.status === 200 && textoViejo.includes('/Times-Roman'), 'V2.12.13 La descarga por enlace sigue funcionando, también con plantilla');

  const docente = await provisionAndActivate(ctx.admin, { firstName: 'Doc', lastName: 'Cv', email: correoStaff('cvdoc'), role: 'TEACHER' });
  const ajeno = await cvPdf(docente.token, { sections: ['bio'] });
  check(ajeno.status === 403, 'V2.12.14 §61 El CV es solo del estudiante', `status ${ajeno.status}`);
}

// ===========================================================================
//  BATCH 13 — Paneles: docente por semestre, dirección y sociedad
// ===========================================================================
async function batch13(ctx) {
  objective('BATCH 13 · Panel académico por semestre, recursos consultados y métricas de sociedad');
  const staff = async (key, role, semesters) => {
    const c = await provisionAndActivate(ctx.admin, { firstName: 'Pan', lastName: 'El', email: correoStaff(`b13${key}`), role });
    if (semesters) await req('PUT', `/users/${c.userId}/semesters`, { token: ctx.admin, body: { semesters } });
    return c;
  };
  const docente = await staff('doc', 'TEACHER', [3, 4]);
  const sinAlcance = await staff('doc0', 'TEACHER');
  const director = await staff('dir', 'CAREER_DIRECTOR');
  const sociedad = await staff('soc', 'SCIENTIFIC_SOCIETY');

  const panel = await req('GET', '/reports/teacher/overview', { token: docente.token });
  const semestres = (panel.data?.bySemester ?? []).map((f) => f.semester);
  check(panel.status === 200 && semestres.length > 0 && semestres.every((n) => n === 3 || n === 4),
    'V2.13.1 §62 El panel docente se agrupa por semestre y solo con los suyos', json(semestres));
  const fila = panel.data?.bySemester?.[0] ?? {};
  check(['students', 'activeProfiles', 'confirmedParticipations', 'projectsVisibleToTeachers', 'openTeamNeeds']
    .every((k) => Number.isInteger(fila[k])), 'V2.13.2 §62 Con estudiantes, perfiles activos, participación, proyectos visibles y necesidades de equipo', json(fila));
  const total = (panel.data?.bySemester ?? []).reduce((s, f) => s + f.students, 0);
  check(total === panel.data?.students?.total, 'V2.13.3 §62 La suma por semestre cuadra con el total del alcance', `${total} vs ${panel.data?.students?.total}`);
  const vacio = await req('GET', '/reports/teacher/overview', { token: sinAlcance.token });
  check((vacio.data?.bySemester ?? []).length === 0, 'V2.13.4 §28 Sin semestres habilitados, el panel no muestra a nadie');

  const tendencias = await req('GET', '/reports/director/trends', { token: director.token });
  check(tendencias.status === 200 && Array.isArray(tendencias.data?.resources)
    && tendencias.data.resources.every((r) => Number.isInteger(r.opened) && r.opened > 0),
    'V2.13.5 §63 Dirección ve los recursos más consultados (personas que los abrieron)', json(tendencias.data?.resources?.slice(0, 2)));
  const noDirector = await req('GET', '/reports/director/trends', { token: docente.token });
  check(noDirector.status === 403, 'V2.13.6 §63 Las tendencias de la carrera son de Dirección', `status ${noDirector.status}`);

  // Sociedad: dos actividades, una estudiante que vuelve y otra ausente.
  const cats = (await req('GET', '/activity-categories', { token: sociedad.token })).data ?? [];
  const cat = cats.find((c) => c.appliesTo === 'extracurricular') ?? cats[0];
  const crear = async (t) => {
    const a = await req('POST', '/activities', { token: sociedad.token, body: { title: `${t} ${TS}`, type: 'extracurricular', categoryId: cat.id } });
    await aprobarActividad(sociedad.token, director.token, a.data.id);
    return a.data.id;
  };
  const a1 = await crear('Club de robótica');
  const a2 = await crear('Club de robótica II');
  const nuevo = async (k) => {
    const c = await provisionAndActivate(ctx.admin, { firstName: 'Est', lastName: k, email: correoEst(`b13${k}`), role: 'STUDENT', semester: 3 });
    c.profileId = (await req('POST', '/profiles/me', { token: c.token, body: {} })).data?.id;
    return c;
  };
  const vuelve = await nuevo('vuelve');
  const falta = await nuevo('falta');
  for (const [est, act, estado] of [[vuelve, a1, 'confirmed'], [vuelve, a2, 'confirmed'], [falta, a1, 'absent']]) {
    await req('POST', `/activities/${act}/register`, { token: est.token });
    await req('PATCH', `/activities/${act}/confirm-participation`, { token: sociedad.token, body: { studentProfileId: est.profileId, status: estado } });
  }
  const m = await req('GET', '/reports/society/activities', { token: sociedad.token });
  check(m.status === 200 && m.data?.totals?.confirmed === 2 && m.data?.totals?.absent === 1 && m.data?.totals?.returningStudents === 1,
    'V2.13.7 §64 Inscritos, confirmados, ausentes y quiénes volvieron', json(m.data?.totals));
  check((m.data?.byCategory ?? []).some((c) => c.activities === 2 && c.confirmed === 2 && c.absent === 1),
    'V2.13.8 §64 Métricas comparables por categoría', json(m.data?.byCategory));
  const ajenas = (m.data?.activities ?? []).every((a) => [a1, a2].includes(a.activityId));
  check(ajenas, 'V2.13.9 §64 Solo sobre sus actividades');
}

// ===========================================================================
//  BATCH 14 — Ayuda, necesidades de equipo para el docente y auditoría
// ===========================================================================
async function batch14(ctx) {
  objective('BATCH 14 · Centro de ayuda, accesos por actor y auditoría');
  const ayuda = await req('GET', '/help');
  check(ayuda.status === 200 && 'video' in (ayuda.data ?? {}),
    'V2.14.1 §65 La ayuda se abre sin sesión (activar, recuperar)', json(ayuda.data));

  const staff = async (key, role, semesters) => {
    const c = await provisionAndActivate(ctx.admin, { firstName: 'Ayu', lastName: 'Da', email: correoStaff(`b14${key}`), role });
    if (semesters) await req('PUT', `/users/${c.userId}/semesters`, { token: ctx.admin, body: { semesters } });
    return c;
  };
  const docente = await staff('doc', 'TEACHER', [2]);
  const sinAlcance = await staff('doc0', 'TEACHER');
  const nuevo = async (k, semester) => {
    const c = await provisionAndActivate(ctx.admin, { firstName: 'Nec', lastName: k, email: correoEst(`b14${k}`), role: 'STUDENT', semester });
    await req('POST', '/profiles/me', { token: c.token, body: {} });
    return c;
  };
  const deDos = await nuevo('dos', 2);
  const deSeis = await nuevo('seis', 6);
  const proposito = (k) => `Necesidad B14 ${k} ${TS}`;
  await req('POST', '/team-needs', { token: deDos.token, body: { purpose: proposito('dos'), maxMembers: 3 } });
  await req('POST', '/team-needs', { token: deSeis.token, body: { purpose: proposito('seis'), maxMembers: 3 } });

  const vistas = await req('GET', '/reports/teacher/team-needs', { token: docente.token });
  const propositos = (vistas.data ?? []).map((n) => n.purpose);
  check(vistas.status === 200 && propositos.includes(proposito('dos')) && !propositos.includes(proposito('seis'))
    && (vistas.data ?? []).every((n) => n.semester === 2),
    'V2.14.2 §62 §77 El docente ve las necesidades de equipo de sus semestres, y solo esas', json(propositos.slice(0, 3)));
  const vacio = await req('GET', '/reports/teacher/team-needs', { token: sinAlcance.token });
  const estudiante = await req('GET', '/reports/teacher/team-needs', { token: deDos.token });
  check((vacio.data ?? []).length === 0 && estudiante.status === 403,
    'V2.14.3 §28 Sin alcance no ve ninguna; un estudiante no entra', `${(vacio.data ?? []).length}/${estudiante.status}`);
  check(!JSON.stringify(vistas.data).includes('@'), 'V2.14.4 §62 Sin correos en la vista del docente');

  const auditoria = await req('GET', '/audit/events?limit=5', { token: ctx.admin });
  const auditoriaDocente = await req('GET', '/audit/events?limit=5', { token: docente.token });
  check(auditoria.status === 200 && Array.isArray(auditoria.data) && auditoriaDocente.status === 403,
    'V2.14.5 §77 La auditoría es de la Administración', `${auditoria.status}/${auditoriaDocente.status}`);
  check(!/passwordHash|tokenHash|"password"/i.test(JSON.stringify(auditoria.data)), 'V2.14.6 §69 Sin datos sensibles en la auditoría');

  const area = ((await req('GET', '/academic-areas', { token: ctx.admin })).data ?? []).find((x) => x.isActive !== false);
  const cuerpo = {
    title: `Recurso de administración ${TS}`, provider: 'Univalle', url: `https://ejemplo.univalle.edu/recurso-${TS}`,
    academicAreaId: area?.id, resourceType: 'guide',
  };
  const recurso = await req('POST', '/learning-resources', { token: ctx.admin, body: cuerpo });
  const recursoDocente = await req('POST', '/learning-resources', { token: docente.token, body: { ...cuerpo, title: `${cuerpo.title} docente` } });
  check(recurso.status === 201 && recursoDocente.status === 403,
    'V2.14.7 §77 La Administración gestiona recursos; un docente no', `${recurso.status}/${recursoDocente.status} ${json(recurso.data)}`);
}

// ===========================================================================
//  BATCH 15 — La app móvil es del Estudiante
// ===========================================================================
async function batch15(ctx) {
  objective('BATCH 15 · Móvil solo para estudiantes, aplicado por la API');
  const MOVIL = { 'X-Afinia-Client': 'mobile' };
  const est = await provisionAndActivate(ctx.admin, { firstName: 'Mo', lastName: 'Vil', email: correoEst('b15est'), role: 'STUDENT', semester: 4 });
  const docente = await provisionAndActivate(ctx.admin, { firstName: 'Do', lastName: 'Cente', email: correoStaff('b15doc'), role: 'TEACHER' });

  const estMovil = await crudo('POST', '/auth/login', { body: { email: est.email, password: PWD }, headers: MOVIL });
  check(estMovil.status === 200 && !!estMovil.data?.accessToken && estMovil.data?.user?.role === 'STUDENT',
    'V2.15.1 §67 El estudiante inicia sesión en la app móvil', `status ${estMovil.status}`);

  const docMovil = await crudo('POST', '/auth/login', { body: { email: docente.email, password: PWD }, headers: MOVIL });
  check(docMovil.status === 403 && docMovil.data?.code === 'MOBILE_STUDENT_ONLY' && !docMovil.data?.accessToken && !docMovil.data?.refreshToken,
    'V2.15.2 §67 Un docente no obtiene sesión desde la app móvil', `status ${docMovil.status} ${json(docMovil.data)}`);
  check(/web/i.test(docMovil.data?.message ?? ''), 'V2.15.3 §67 El mensaje lo orienta a la web');

  const adminMovil = await crudo('POST', '/auth/login', {
    body: { email: process.env.ADMIN_EMAIL ?? 'admin@univalle.edu', password: process.env.ADMIN_PASSWORD ?? 'Admin123*' }, headers: MOVIL,
  });
  check(adminMovil.status === 403, 'V2.15.4 §67 Tampoco la Administración', `status ${adminMovil.status}`);

  const docWeb = await crudo('POST', '/auth/login', { body: { email: docente.email, password: PWD } });
  check(docWeb.status === 200 && !!docWeb.data?.refreshToken, 'V2.15.5 §67 Desde la web el docente entra con normalidad', `status ${docWeb.status}`);

  const renovarMovil = await crudo('POST', '/auth/refresh', { body: { refreshToken: docWeb.data?.refreshToken }, headers: MOVIL });
  check(renovarMovil.status === 403, 'V2.15.6 §67 Una sesión de personal no se renueva desde el móvil', `status ${renovarMovil.status}`);
  const renovarWeb = await crudo('POST', '/auth/refresh', { body: { refreshToken: docWeb.data?.refreshToken } });
  check(renovarWeb.status === 200, 'V2.15.7 §67 Y esa misma sesión sigue sirviendo en la web', `status ${renovarWeb.status}`);
}

// ===========================================================================
//  BATCH 7 — Certificados externos con tecnologías (§41)
// ===========================================================================
async function batch7(ctx) {
  objective('BATCH 7 · El certificado declara sus tecnologías; solo con respaldo cuentan');
  const { execSync } = await import('node:child_process');
  const psql = (sql) => execSync(
    `docker exec perfil_postgres psql -U ${process.env.POSTGRES_USER ?? 'perfil_user'} -d ${process.env.POSTGRES_DB ?? 'perfil_estudiantil'} -tAc "${sql.replace(/"/g, '\\"')}"`,
    { encoding: 'utf8' },
  ).trim();
  const est = await provisionAndActivate(ctx.admin, { firstName: 'Cert', lastName: 'Tecnologias', email: correoEst('b7cert'), role: 'STUDENT', semester: 6 });
  await req('POST', '/profiles/me', { token: est.token, body: {} });
  const catalogo = ((await req('GET', '/skills', { token: est.token })).data ?? []).filter((s) => s.isActive !== false);
  const [s1, s2] = catalogo;

  const cert = await req('POST', '/certificates/external', {
    token: est.token,
    body: { certificateName: `Curso de contenedores ${TS}`, issuer: 'Plataforma externa', skillIds: [s1.id, s2.id] },
  });
  check(cert.status === 201, 'V2.7.1 §41 Se registra un certificado con sus tecnologías', json(cert.data));
  const mios = (await req('GET', '/certificates/external/my', { token: est.token })).data ?? [];
  const guardado = mios.find((c) => c.id === cert.data?.id);
  check((guardado?.skills ?? []).map((s) => s.skill?.name).sort().join() === [s1.name, s2.name].sort().join(),
    'V2.7.2 §41 El listado trae las tecnologías', json(guardado?.skills));

  const malo = await req('POST', '/certificates/external', {
    token: est.token, body: { certificateName: `Otro ${TS}`, issuer: 'X', skillIds: ['00000000-0000-4000-8000-000000000000'] },
  });
  const repetido = await req('POST', '/certificates/external', {
    token: est.token, body: { certificateName: `Otro dos ${TS}`, issuer: 'X', skillIds: [s1.id, s1.id] },
  });
  check(malo.status === 400 && repetido.status === 400, 'V2.7.3 §41 Solo tecnologías del catálogo, sin repetir', `${malo.status}/${repetido.status}`);

  const perfil = (await req('GET', '/profiles/me', { token: est.token })).data;
  const respaldadas = async () => ((await req('GET', '/profiles/me/summary', { token: est.token })).data?.skills ?? []);
  // Esperar a que la validación asíncrona deje su veredicto (sin archivo: DECLARED).
  for (let i = 0; i < 20 && !psql(`select backing_tier from validation_records where resource_type='external_certificate' and resource_id='${cert.data?.id}'`); i++) {
    await new Promise((r) => setTimeout(r, 500));
  }
  const antes = await respaldadas();
  check(!antes.some((s) => s.skillId === s1.id), 'V2.7.4 §41 §22 Un certificado solo declarado no respalda tecnologías', json(antes));

  // Con respaldo (lo que daría la validación con un documento legible y coherente).
  psql(`update validation_records set backing_tier='supported' where resource_type='external_certificate' and resource_id='${cert.data?.id}'`);
  const despues = await respaldadas();
  const conCert = despues.find((s) => s.skillId === s1.id);
  check(!!conCert && (conCert.sources ?? []).includes('certificate'),
    'V2.7.5 §41 Con respaldo, sus tecnologías cuentan como respaldadas, con su procedencia', json(conCert));

  const cambio = await req('PATCH', `/certificates/external/${cert.data?.id}`, { token: est.token, body: { skillIds: [s2.id] } });
  const ahora = ((await req('GET', '/certificates/external/my', { token: est.token })).data ?? []).find((c) => c.id === cert.data?.id);
  check(cambio.status === 200 && (ahora?.skills ?? []).length === 1 && ahora.skills[0].skillId === s2.id,
    'V2.7.6 §41 Editar reemplaza la lista de tecnologías', json(ahora?.skills));
  void perfil;
}

const BATCHES = { batch2, batch3, batch4, batch5, batch7, batch8, batch10, batch11, batch12, batch13, batch14, batch15 };

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
