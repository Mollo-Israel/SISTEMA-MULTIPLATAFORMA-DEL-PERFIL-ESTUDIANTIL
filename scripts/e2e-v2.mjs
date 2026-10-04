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

const BATCHES = { batch2 };

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
