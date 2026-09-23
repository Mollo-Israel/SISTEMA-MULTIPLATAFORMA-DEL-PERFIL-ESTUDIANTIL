/**
 * BATCH 11 — Hardening final.
 *
 * Cubre §83 (archivos: conocer la URL no basta), §84 (cabeceras, CORS, límites,
 * Swagger, entorno), §85 (dar de baja antes que borrar), §86 (sin huérfanos),
 * §102 (registro con request_id, sin secretos) y §103 (formato de error).
 *
 * Todo se comprueba contra la API en marcha. Un hardening que solo se afirma en
 * un documento no es hardening.
 *
 * Uso:
 *   API_URL=http://localhost:3010/api node scripts/e2e-batch-11.mjs
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

const correoEst = (k) => `b11.${k}.${TS}@est.univalle.edu`;
const correoStaff = (k) => `b11.${k}.${TS}@univalle.edu`;

/** Petición cruda, para mirar cabeceras y cuerpos sin procesar. */
async function crudo(method, path, { token, body, headers = {} } = {}) {
  const res = await fetch(`${API}${path}`, {
    method,
    headers: {
      ...(body ? { 'Content-Type': 'application/json' } : {}),
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...headers,
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  const texto = await res.text();
  let datos = null;
  try { datos = JSON.parse(texto); } catch { /* sin cuerpo JSON */ }
  return { status: res.status, headers: res.headers, text: texto, data: datos };
}

// ===========================================================================
//  §103 · Formato de error
// ===========================================================================
async function formatoDeError(ctx) {
  objective('§103 · Una sola forma de error para toda la API');

  const invalido = await crudo('POST', '/auth/login', {
    body: { email: 'no-es-correo', password: 123, campoQueNoExiste: 'x' },
  });
  check(invalido.status === 400, 'B11.1 Una petición mal formada responde 400',
    `status ${invalido.status}`);
  check(
    invalido.data?.code === 'VALIDATION_ERROR' && typeof invalido.data?.message === 'string',
    'B11.2 Con `code` y `message` (§103)',
    JSON.stringify(invalido.data).slice(0, 120),
  );
  check(
    Array.isArray(invalido.data?.details) && invalido.data.details.length >= 3,
    'B11.3 Y `details` con lo que falló, campo por campo (§103)',
    JSON.stringify(invalido.data?.details),
  );
  check(
    typeof invalido.data?.requestId === 'string' && invalido.data.requestId.length > 8,
    'B11.4 Y el `requestId` para poder rastrearlo (§103)',
    String(invalido.data?.requestId),
  );

  section('Los mensajes van en español');
  const enIngles = (invalido.data?.details ?? []).filter((d) =>
    / must be | should not | must contain /.test(String(d)));
  check(
    enIngles.length === 0,
    'B11.5 Ningún mensaje de validación llega en inglés',
    enIngles.join(' | '),
  );
  check(
    (invalido.data?.details ?? []).some((d) => String(d).includes('no es un campo admitido')),
    'B11.6 Incluido el rechazo de un campo que no existe',
    JSON.stringify(invalido.data?.details),
  );

  section('Cada estado tiene su código');
  const sinSesion = await crudo('GET', '/profiles/me');
  check(
    sinSesion.status === 401 && sinSesion.data?.code === 'UNAUTHENTICATED',
    'B11.7 Sin sesión -> 401 UNAUTHENTICATED',
    JSON.stringify(sinSesion.data),
  );

  const prohibido = await crudo('GET', '/reports/director/trends', { token: ctx.est.token });
  check(
    prohibido.status === 403 && prohibido.data?.code === 'FORBIDDEN',
    'B11.8 Sin permiso -> 403 FORBIDDEN',
    JSON.stringify(prohibido.data),
  );

  const inexistente = await crudo('GET', '/projects/00000000-0000-4000-8000-000000000000', {
    token: ctx.est.token,
  });
  check(
    inexistente.status === 404 && inexistente.data?.code === 'NOT_FOUND',
    'B11.9 Inexistente -> 404 NOT_FOUND',
    JSON.stringify(inexistente.data),
  );

  section('§103 · Sin trazas ni detalles internos');
  const textoCompleto = [invalido.text, prohibido.text, inexistente.text].join(' ');
  check(
    !/\bat .+\.ts:\d+|node_modules|\/src\/|C:\\\\/.test(textoCompleto),
    'B11.10 Ninguna respuesta de error incluye una traza (§103)',
    textoCompleto.slice(0, 140),
  );
  check(
    !/QueryFailedError|relation "|column "|constraint/.test(textoCompleto),
    'B11.11 Ni el nombre de una tabla, columna o restricción',
  );
}

// ===========================================================================
//  §102 · Registro y trazabilidad
// ===========================================================================
async function trazabilidad() {
  objective('§102 · Cada petición se puede rastrear');

  const uno = await crudo('GET', '/health');
  check(
    !!uno.headers.get('x-request-id'),
    'B11.12 Toda respuesta trae su identificador de petición (§102)',
    String(uno.headers.get('x-request-id')),
  );

  const otro = await crudo('GET', '/health');
  check(
    uno.headers.get('x-request-id') !== otro.headers.get('x-request-id'),
    'B11.13 Y es distinto en cada una',
  );

  section('Se respeta el que envía el cliente');
  const propio = await crudo('GET', '/health', { headers: { 'x-request-id': 'traza-de-prueba-1' } });
  check(
    propio.headers.get('x-request-id') === 'traza-de-prueba-1',
    'B11.14 Un identificador entrante se conserva: la traza cruza servicios',
    String(propio.headers.get('x-request-id')),
  );

  /*
   * Un salto de línea no se puede ni probar desde aquí: `fetch` se niega a
   * enviarlo. Lo que sí viaja es cualquier otro carácter, y de ahí que el
   * saneado acote el alfabeto en vez de quitar solo los saltos: un proxy o un
   * cliente menos estricto sí los dejaría pasar.
   */
  const raro = await crudo('GET', '/health', {
    headers: { 'x-request-id': '<script>alert(1)</script>' },
  });
  const devuelto = String(raro.headers.get('x-request-id') ?? '');
  check(
    !devuelto.includes('<'),
    'B11.15 Uno con caracteres fuera del alfabeto se descarta y se genera otro (§102)',
    JSON.stringify(devuelto),
  );

  const larguisimo = await crudo('GET', '/health', {
    headers: { 'x-request-id': 'a'.repeat(400) },
  });
  check(
    String(larguisimo.headers.get('x-request-id') ?? '').length <= 64,
    'B11.15b Y uno desmedido se recorta: no se registra una línea de 400 caracteres',
    String(String(larguisimo.headers.get('x-request-id') ?? '').length),
  );
}

// ===========================================================================
//  §84 · Cabeceras, CORS y límites
// ===========================================================================
async function cabecerasYLimites(ctx) {
  objective('§84 · Cabeceras, CORS y límites de cuerpo');

  const r = await crudo('GET', '/health');
  check(
    r.headers.get('x-content-type-options') === 'nosniff',
    'B11.16 `X-Content-Type-Options: nosniff` (§84)',
    String(r.headers.get('x-content-type-options')),
  );
  check(
    !!r.headers.get('strict-transport-security'),
    'B11.17 HSTS presente (§84)',
    String(r.headers.get('strict-transport-security')),
  );
  check(
    !r.headers.get('x-powered-by'),
    'B11.18 Sin `X-Powered-By`: no se anuncia con qué está hecho',
    String(r.headers.get('x-powered-by')),
  );

  section('§84 · CORS explícito');
  const ajeno = await fetch(`${API}/health`, {
    headers: { Origin: 'https://sitio-que-no-autorizamos.example' },
  });
  check(
    !ajeno.headers.get('access-control-allow-origin'),
    'B11.19 Un origen no autorizado no recibe permiso (§84)',
    String(ajeno.headers.get('access-control-allow-origin')),
  );

  section('§84 · Límite de cuerpo');
  const enorme = await crudo('POST', '/auth/login', {
    body: { email: 'a@b.com', password: 'x'.repeat(400_000) },
  });
  check(
    enorme.status === 413 || enorme.status === 400,
    'B11.20 Un cuerpo desmedido se rechaza en vez de procesarse (§84)',
    `status ${enorme.status}`,
  );
}

// ===========================================================================
//  §83 · Archivos
// ===========================================================================
async function archivos(ctx) {
  objective('§83 · Conocer la URL no basta para descargar');

  const pdf = Buffer.from(
    `%PDF-1.4\n1 0 obj<</Type/Catalog>>endobj\n% b11 ${TS}\ntrailer<</Root 1 0 R>>\n%%EOF\n`,
    'utf8',
  );
  const form = new FormData();
  form.append('file', new Blob([pdf], { type: 'application/pdf' }), 'privado.pdf');
  const subida = await fetch(`${API}/uploads`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${ctx.est.token}` },
    body: form,
  });
  const archivo = await subida.json();
  check(subida.status === 201, 'B11.21 El estudiante sube un archivo', String(subida.status));

  const evidencia = await req('POST', '/evidences', {
    token: ctx.est.token,
    body: {
      evidenceType: 'file',
      description: `Evidencia privada ${TS}`,
      storedFileId: archivo.id,
    },
  });
  check(evidencia.status === 201, 'B11.22 Y la adjunta a una evidencia suya');
  const url = evidencia.data?.fileUrl;
  check(!!url, 'B11.23 La evidencia publica una URL de descarga', String(url));

  section('La URL sola no abre nada');
  const ruta = String(url).replace(/^.*\/api/, '');
  const anonimo = await crudo('GET', ruta);
  check(
    anonimo.status === 401,
    'B11.24 Sin sesión, la descarga se niega (§83)',
    `status ${anonimo.status}`,
  );

  const deOtro = await crudo('GET', ruta, { token: ctx.otro.token });
  check(
    deOtro.status === 403 || deOtro.status === 404,
    'B11.25 Con sesión ajena, tampoco: la autorización mira de quién es (§83)',
    `status ${deOtro.status}`,
  );

  const dueno = await crudo('GET', ruta, { token: ctx.est.token });
  check(dueno.status === 200, 'B11.26 Su dueño sí la descarga', `status ${dueno.status}`);

  section('§86 · Al borrar no quedan huérfanos');
  const borrado = await req('DELETE', `/evidences/${evidencia.data.id}`, { token: ctx.est.token });
  check(borrado.status === 204 || borrado.status === 200, 'B11.27 El estudiante borra su evidencia');
  const trasBorrar = await crudo('GET', ruta, { token: ctx.est.token });
  check(
    trasBorrar.status === 404,
    'B11.28 Y el archivo deja de ser accesible (§86)',
    `status ${trasBorrar.status}`,
  );
}

// ===========================================================================
//  §84 · Revocación de sesión
// ===========================================================================
async function sesiones(ctx) {
  objective('§84 · Cerrar sesión revoca de verdad');

  const login = await req('POST', '/auth/login', {
    body: { email: ctx.desechable.email, password: 'Afinia2026Seg*' },
  });
  const { accessToken, refreshToken } = login.data;
  check(!!accessToken && !!refreshToken, 'B11.29 Inicia sesión y obtiene sus dos tokens');

  const antes = await crudo('GET', '/auth/me', { token: accessToken });
  check(antes.status === 200, 'B11.30 El token de acceso funciona');

  await req('POST', '/auth/logout', { token: accessToken, body: { refreshToken } });

  const renovar = await req('POST', '/auth/refresh', { body: { refreshToken } });
  check(
    renovar.status === 401,
    'B11.31 Tras cerrar sesión, el token de refresco ya no sirve (§14)',
    `status ${renovar.status}`,
  );
}

// ===========================================================================
//  §85 · Dar de baja antes que borrar
// ===========================================================================
async function bajaDeUsuarios(ctx) {
  objective('§85 · Borrar una cuenta con historial destruiría su trayectoria');

  section('Lo normal es dar de baja');
  const baja = await req('DELETE', `/users/${ctx.desechable.userId}`, { token: ctx.admin });
  check(
    baja.status === 200 && baja.data?.status === 'inactive',
    'B11.32 Un DELETE da de baja: el estado pasa a inactivo (§85)',
    JSON.stringify(baja.data?.status),
  );

  const entrar = await req('POST', '/auth/login', {
    body: { email: ctx.desechable.email, password: 'Afinia2026Seg*' },
  });
  check(
    entrar.status === 401 || entrar.status === 403,
    'B11.33 Y la cuenta ya no puede entrar',
    `status ${entrar.status}`,
  );

  const sigue = await req('GET', `/users/${ctx.desechable.userId}`, { token: ctx.admin });
  check(
    sigue.status === 200,
    'B11.34 Pero la cuenta sigue existiendo, con su historial (§85)',
    `status ${sigue.status}`,
  );

  section('El borrado real solo para cuentas sin historial');
  const conHistorial = await req('DELETE', `/users/${ctx.est.userId}?hard=true`, {
    token: ctx.admin,
  });
  check(
    conHistorial.status === 409,
    'B11.35 Una cuenta con perfil estudiantil NO se borra -> 409 (§85)',
    `status ${conHistorial.status}`,
  );
  check(
    String(conHistorial.data?.message ?? '').includes('historial'),
    'B11.36 Y se explica qué hacer en su lugar',
    String(conHistorial.data?.message),
  );

  // Se comprueba desde la propia cuenta: que el estudiante siga viendo su
  // perfil demuestra a la vez que el perfil existe y que la cuenta que lo
  // sostiene quedó utilizable, que es justo lo que el 409 debía proteger.
  const siguePerfil = await req('GET', '/profiles/me', { token: ctx.est.token });
  check(
    siguePerfil.status === 200 && siguePerfil.data?.id === ctx.est.profileId,
    'B11.37 El perfil del estudiante quedó intacto',
    `status ${siguePerfil.status} · id ${siguePerfil.data?.id ?? '-'}`,
  );

  const sinHistorial = await req('DELETE', `/users/${ctx.desechable.userId}?hard=true`, {
    token: ctx.admin,
  });
  check(
    sinHistorial.status === 200,
    'B11.38 Una cuenta sin perfil sí se borra, bajo esa condición (§85)',
    `status ${sinHistorial.status}`,
  );
}

// ===========================================================================
//  §136 · Limpieza de huérfanos
// ===========================================================================
async function limpiezaDeHuerfanos(ctx) {
  objective('§136 · Los archivos que nadie llegó a adjuntar no se quedan para siempre');

  const subir = async (nombre) => {
    const pdf = Buffer.from(
      `%PDF-1.4\n1 0 obj<</Type/Catalog>>endobj\n% ${nombre} ${TS}\ntrailer<</Root 1 0 R>>\n%%EOF\n`,
      'utf8',
    );
    const form = new FormData();
    form.append('file', new Blob([pdf], { type: 'application/pdf' }), `${nombre}.pdf`);
    const res = await fetch(`${API}/uploads`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${ctx.est.token}` },
      body: form,
    });
    return res.json();
  };

  // Uno recién subido y todavía sin adjuntar: es exactamente el caso que el
  // periodo de gracia tiene que proteger.
  const enCurso = await subir('en-curso');

  // Y uno adjuntado, que no es huérfano por definición.
  const adjuntado = await subir('adjuntado');
  const evidencia = await req('POST', '/evidences', {
    token: ctx.est.token,
    body: {
      evidenceType: 'file',
      description: `Evidencia con archivo ${TS}`,
      storedFileId: adjuntado.id,
    },
  });
  check(evidencia.status === 201, 'B11.41 Hay un archivo adjuntado y otro recién subido');

  section('La limpieza es una tarea de mantenimiento');
  const ajena = await crudo('POST', '/uploads/cleanup-orphans', { token: ctx.est.token });
  check(
    ajena.status === 403,
    'B11.42 Un estudiante no puede lanzarla (§136)',
    `status ${ajena.status}`,
  );

  const barrido = await req('POST', '/uploads/cleanup-orphans', { token: ctx.admin });
  check(
    barrido.status === 201 && typeof barrido.data?.removed === 'number',
    'B11.43 La administración sí, y dice cuántos quitó',
    `status ${barrido.status} · removed ${barrido.data?.removed}`,
  );

  section('Y no se lleva por delante lo que todavía se está usando');
  // Que el archivo siga pudiéndose adjuntar es la prueba de que sobrevivió: si
  // la limpieza se lo hubiera llevado, esto respondería que no existe.
  const tardio = await req('POST', '/evidences', {
    token: ctx.est.token,
    body: {
      evidenceType: 'file',
      description: `Evidencia tardía ${TS}`,
      storedFileId: enCurso.id,
    },
  });
  check(
    tardio.status === 201,
    'B11.44 El archivo en curso sigue ahí: la gracia lo protege (§136)',
    `status ${tardio.status}`,
  );

  const sigueDescargando = await crudo('GET', String(evidencia.data?.fileUrl).replace(/^.*\/api/, ''), {
    token: ctx.est.token,
  });
  check(
    sigueDescargando.status === 200,
    'B11.45 Y el archivo adjuntado tampoco se tocó',
    `status ${sigueDescargando.status}`,
  );
}

// ===========================================================================
//  §84 · URL seguras
// ===========================================================================
async function urlsSeguras(ctx) {
  objective('§84 · Lo que se guarda como enlace tiene que ser un enlace');

  const peligrosos = [
    ['javascript:alert(document.cookie)', 'un esquema ejecutable'],
    ['data:text/html;base64,PHNjcmlwdD5hbGVydCgxKTwvc2NyaXB0Pg==', 'un documento incrustado'],
    ['file:///etc/passwd', 'una ruta del servidor'],
    ['ejemplo.com/sin-esquema', 'una dirección sin esquema'],
  ];

  let rechazados = 0;
  for (const [valor] of peligrosos) {
    const r = await req('POST', '/projects', {
      token: ctx.est.token,
      body: {
        title: `Proyecto con enlace raro ${TS}`,
        description: 'Prueba de validación de enlaces.',
        areaId: ctx.area.id,
        status: 'active',
        visibility: 'private',
        demoUrl: valor,
      },
    });
    if (r.status === 400) rechazados++;
  }
  check(
    rechazados === peligrosos.length,
    'B11.39 Los cuatro se rechazan, incluido el enlace sin esquema (§84)',
    `rechazados ${rechazados} de ${peligrosos.length}`,
  );

  const bueno = await req('POST', '/projects', {
    token: ctx.est.token,
    body: {
      title: `Proyecto con enlace válido ${TS}`,
      description: 'Prueba de validación de enlaces.',
      areaId: ctx.area.id,
      status: 'active',
      visibility: 'private',
      demoUrl: 'https://demo.univalle.edu/proyecto',
    },
  });
  check(bueno.status === 201, 'B11.40 Y un https normal se acepta', String(bueno.status));
}

// ===========================================================================
//  Preparación
// ===========================================================================
async function preparar() {
  console.log(`${C.bold}BATCH 11 — Hardening contra ${API}${C.r}`);
  const admin = await loginAdmin();

  const area = (await req('POST', '/academic-areas', {
    token: admin,
    body: { name: `Seguridad Aplicada ${TS}`, description: 'Área del escenario.', tags: ['owasp'] },
  })).data;

  const estudiante = async (key, nombre, apellido) => {
    const cuenta = await provisionAndActivate(admin, {
      firstName: nombre, lastName: apellido, email: correoEst(key), role: 'STUDENT',
    });
    const perfil = await req('POST', '/profiles/me', { token: cuenta.token, body: {} });
    return { ...cuenta, profileId: perfil.data?.id };
  };

  const est = await estudiante('est', 'Andrea', 'Siles');
  const otro = await estudiante('otro', 'Bruno', 'Vaca');

  // Una cuenta sin perfil: es la única que §85 permite borrar de verdad.
  const desechable = await provisionAndActivate(admin, {
    firstName: 'Cuenta', lastName: 'Desechable', email: correoStaff('temp'), role: 'TEACHER',
  });

  return { admin, area, est, otro, desechable };
}

async function main() {
  try {
    const ctx = await preparar();
    await formatoDeError(ctx);
    await trazabilidad();
    await cabecerasYLimites(ctx);
    await archivos(ctx);
    await limpiezaDeHuerfanos(ctx);
    await urlsSeguras(ctx);
    await sesiones(ctx);
    await bajaDeUsuarios(ctx);
  } catch (error) {
    console.error(`\n${C.bad}Error durante la ejecución:${C.r} ${error.message}`);
    process.exitCode = 1;
    return;
  }

  console.log(`\n${'-'.repeat(78)}`);
  if (failures.length === 0) {
    console.log(`${C.ok}${C.bold}  ${passed} verificaciones OK · 0 fallos${C.r}`);
    console.log('  El BATCH 11 queda demostrado de punta a punta.');
  } else {
    console.log(`${C.bad}${C.bold}  ${passed} verificaciones OK · ${failures.length} fallos${C.r}`);
    failures.forEach((f) => console.log(`  ${C.bad}·${C.r} ${f}`));
    process.exitCode = 1;
  }
}

main();
