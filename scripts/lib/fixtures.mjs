/**
 * Utilidades compartidas por las suites de integración.
 *
 * Desde el BATCH 1 no existe registro público (§9.1): una cuenta se provisiona
 * y su titular la activa. Estas funciones reproducen ese camino real —crear,
 * activar, iniciar sesión— en lugar de saltárselo, de modo que las pruebas
 * ejercitan el mismo flujo que usará una persona.
 *
 * El código de activación nunca llega en la respuesta del administrador: se
 * lee de la copia local de correos (api/.mail-outbox), como el estudiante lo
 * leería de su buzón.
 */

import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

export const API = process.env.API_URL ?? 'http://localhost:3010/api';

/** §13 exige 12 caracteres como mínimo. */
export const PWD = 'Afinia2026Seg*';

export const ADMIN_CREDENTIALS = {
  email: process.env.ADMIN_EMAIL ?? 'admin@univalle.edu',
  password: process.env.ADMIN_PASSWORD ?? 'Admin123*',
};

export async function req(method, path, { token, body, raw } = {}) {
  // V3.2 §18–§21: publicar exige una actividad completa. Las suites anteriores
  // crean actividades mínimas porque prueban otra cosa; aquí se completan los
  // datos que falten (nunca se pisa lo que la prueba envía). Una prueba que
  // necesite una actividad incompleta lo pide con `__sinCompletar: true`.
  if (body && typeof body === 'object' && !raw) body = await ajustarCuerpoActividad(method, path, token, body);
  const res = await fetch(`${API}${path}`, {
    method,
    headers: {
      ...(raw ? {} : { 'Content-Type': 'application/json' }),
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: raw ?? (body ? JSON.stringify(body) : undefined),
  });
  let data = null;
  try {
    data = await res.json();
  } catch {
    /* respuesta sin cuerpo */
  }
  return { status: res.status, data };
}

/**
 * V3.2 §18–§21.6: completa lo mínimo de una actividad nueva y el motivo de
 * una cancelación. Lo usan también las suites que tienen su propio `req`.
 */
export async function ajustarCuerpoActividad(method, path, token, body) {
  if (!body || typeof body !== 'object') return body;
  if (method === 'POST' && path === '/activities') return completarActividad(token, body);
  if (method === 'PATCH' && /^\/activities\/[0-9a-f-]{36}$/.test(path)
    && body.status === 'cancelled' && body.cancellationReason === undefined) {
    return { ...body, cancellationReason: 'Cancelada por la prueba automática.' };
  }
  return body;
}

let catalogoCache = null;
let adminDePrueba = null;

/** Una habilidad neutra para un área de prueba que no tiene ninguna. */
async function habilidadNeutra(areaId) {
  adminDePrueba ??= await loginAdmin();
  const letras = String.fromCharCode(...areaId.replace(/[^0-9]/g, '').slice(0, 8).split('').map((d) => 65 + Number(d)));
  const creada = await req('POST', '/skills', {
    token: adminDePrueba,
    body: { name: `Base Neutra ${letras} ${String.fromCharCode(...String(Date.now()).slice(-5).split('').map((d) => 65 + Number(d)))}`, academicAreaId: areaId },
  });
  catalogoCache = null;
  return creada.status === 201 ? creada.data : null;
}

/** Áreas y habilidades del catálogo, una sola vez por proceso. */
async function catalogoDePrueba(token) {
  if (catalogoCache) return catalogoCache;
  const [areas, skills] = await Promise.all([
    req('GET', '/academic-areas', { token }),
    req('GET', '/skills', { token }),
  ]);
  if (areas.status !== 200 || skills.status !== 200) return { areas: [], skills: [] };
  catalogoCache = { areas: areas.data ?? [], skills: skills.data ?? [] };
  return catalogoCache;
}

/** Completa lo mínimo para publicar (V3.2 §18): fechas, lugar o enlace, área y habilidad. */
export async function completarActividad(token, original) {
  const { __sinCompletar, ...body } = original;
  if (__sinCompletar) return body;
  const out = { ...body };
  const enUnaSemana = Date.now() + 14 * 24 * 3_600_000;
  if (out.activityDate === undefined) out.activityDate = new Date(enUnaSemana).toISOString();
  if (out.endAt === undefined && out.activityDate) {
    const inicio = new Date(out.activityDate).getTime();
    // Si la prueba la fecha en el pasado, se mantiene «en curso» hasta mañana.
    out.endAt = new Date(Math.max(inicio + 2 * 3_600_000, Date.now() + 24 * 3_600_000)).toISOString();
  }
  const externa = out.originType === 'external';
  const modalidad = out.modality ?? 'presencial';
  if (!externa && (modalidad === 'presencial' || modalidad === 'hibrida') && out.location === undefined) {
    out.location = 'Aula de pruebas';
  }
  if (!externa && (modalidad === 'virtual' || modalidad === 'hibrida') && out.meetingUrl === undefined) {
    out.meetingUrl = 'https://meet.afinia-pruebas.org/sala';
  }
  const areasPedidas = out.areaIds ?? (out.areaId ? [out.areaId] : undefined);
  if (areasPedidas === undefined || out.skillIds === undefined) {
    const { areas, skills } = await catalogoDePrueba(token);
    let areaIds = areasPedidas;
    if (areaIds === undefined) {
      const base = areas.find((a) => a.code === 'ingenieria_de_software') ?? areas[0];
      areaIds = base ? [base.id] : [];
      if (out.areaId === undefined) out.areaIds = areaIds;
    }
    if (out.skillIds === undefined) {
      const buscar = (lista) => lista.find((s) => s.isActive !== false
        && (areaIds.includes(s.academicAreaId) || (s.secondaryAreaIds ?? []).some((a) => areaIds.includes(a))));
      let propia = buscar(skills);
      if (!propia) {
        // Un área recién creada por la prueba: se vuelve a leer el catálogo.
        catalogoCache = null;
        propia = buscar((await catalogoDePrueba(token)).skills);
      }
      if (!propia && areaIds.length > 0) {
        // Área creada por la prueba y todavía sin habilidades: se le da una
        // neutra (§19 exige al menos una para publicar). No coincide con
        // intereses ni declaraciones de nadie.
        propia = await habilidadNeutra(areaIds[0]);
      }
      if (propia) out.skillIds = [propia.id];
    }
  }
  return out;
}

// ===========================================================================
//  Correo: el código se lee del buzón local, nunca de la respuesta del admin
// ===========================================================================

const RAIZ = resolve(dirname(fileURLToPath(import.meta.url)), '..', '..');

/**
 * Copia local de los correos que escribe la API fuera de producción.
 *
 * Antes la API le devolvía el código de activación al administrador para que
 * las pruebas pudieran activar cuentas. Eso es justo lo que no puede ocurrir:
 * el código solo debe llegar al buzón del titular. Ahora las pruebas hacen lo
 * mismo que el estudiante —leer su correo—, solo que el «buzón» es una
 * carpeta local.
 */
export const BUZON = process.env.MAIL_CAPTURE_DIR
  ? resolve(process.env.MAIL_CAPTURE_DIR)
  : join(RAIZ, 'api', '.mail-outbox');

const dormir = (ms) => new Promise((r) => setTimeout(r, ms));

/** Prefijo del código universitario según el rol (copia de shared/university-code). */
export const PREFIJO_CODIGO = {
  STUDENT: 'EST', SCIENTIFIC_SOCIETY: 'EST', TEACHER: 'DOC', CAREER_DIRECTOR: 'DIR', ADMIN: 'ADM',
};
/** Roles que indican el semestre que cursan. */
export const ROLES_CON_SEMESTRE = ['STUDENT', 'SCIENTIFIC_SOCIETY'];

const ALFABETO = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
const usados = new Set();
/**
 * Código universitario único para las altas de prueba (V2 §12): toda cuenta
 * lo lleva, con el formato PREFIJO-XXXXXXX del rol.
 */
export function codigoUniversitario(rol = 'STUDENT') {
  let codigo;
  do {
    let cuerpo = '';
    for (let i = 0; i < 7; i++) cuerpo += ALFABETO[Math.floor(Math.random() * ALFABETO.length)];
    codigo = `${PREFIJO_CODIGO[rol] ?? 'EST'}-${cuerpo}`;
  } while (usados.has(codigo));
  usados.add(codigo);
  return codigo;
}

function analizarCorreo(m) {
  const token = /[?&]token=([A-Za-z0-9_-]+)/.exec(m.text ?? '')?.[1] ?? null;
  const codigo = /c[oó]digo[^:\n]*:\s*(\d{3})\s?(\d{3})/i.exec(m.text ?? '');
  return { ...m, token, code: codigo ? `${codigo[1]}${codigo[2]}` : null };
}

/**
 * Espera el correo más reciente enviado a `email` desde `desde` (epoch ms).
 *
 * `tipo`: 'account_activation' | 'password_reset' | 'test'.
 */
export async function leerCorreo(email, { tipo, desde = 0, esperaMs = 10_000 } = {}) {
  // La API guarda los correos en minúsculas; quien busca puede no hacerlo.
  const buscado = email.toLowerCase();
  const limite = Date.now() + esperaMs;
  while (Date.now() < limite) {
    if (existsSync(BUZON)) {
      const archivos = readdirSync(BUZON).filter((f) => f.endsWith('.json')).sort().reverse();
      for (const f of archivos) {
        if (Number(f.split('-')[0]) < desde) break;
        let m;
        try {
          m = JSON.parse(readFileSync(join(BUZON, f), 'utf8'));
        } catch {
          continue; // se está escribiendo justo ahora
        }
        if (m.to?.toLowerCase() === buscado && (!tipo || m.kind === tipo)) return analizarCorreo(m);
      }
    }
    await dormir(40);
  }
  throw new Error(
    `No llegó ningún correo${tipo ? ` de tipo ${tipo}` : ''} a ${email} en ${esperaMs / 1000} s. `
    + `¿La API corre en esta máquina y escribe en ${BUZON}?`,
  );
}

let correoComprobado = false;

/**
 * Las suites crean cientos de cuentas con correos inventados. Con un SMTP real
 * eso serían cientos de correos a direcciones que no existen: rebotes, y el
 * remitente marcado como spam. Se comprueba antes de crear nada.
 */
export async function asegurarCorreoDePrueba(adminToken) {
  if (correoComprobado) return;
  const estado = await req('GET', '/mail/status', { token: adminToken });
  if (estado.status !== 200) {
    throw new Error(`No se pudo consultar el estado del correo (${estado.status}).`);
  }
  if (!estado.data.safeForAutomatedTests) {
    throw new Error(
      'La API está enviando correo REAL (SMTP). Las pruebas crean cientos de cuentas con correos '
      + 'inventados: con SMTP real serían cientos de rebotes y el remitente acabaría marcado como '
      + 'spam. Arranque la API con MAIL_TRANSPORT=console (o sin SMTP_HOST) para correrlas.',
    );
  }
  if (!estado.data.captureEnabled) {
    throw new Error('La copia local de correos está desactivada (¿NODE_ENV=production?).');
  }
  correoComprobado = true;
}

/** Inicia sesión como administrador y devuelve su access token. */
export async function loginAdmin() {
  const res = await req('POST', '/auth/login', { body: ADMIN_CREDENTIALS });
  if (res.status !== 200 || !res.data?.accessToken) {
    throw new Error(
      `No se pudo iniciar sesión como administrador (${res.status}). `
      + 'Ejecute: npm run api:migrate && npm run seed:populate',
    );
  }
  await asegurarCorreoDePrueba(res.data.accessToken);
  return res.data.accessToken;
}

/**
 * Provisiona una cuenta, la activa y la deja lista para usar.
 *
 * Hace el camino real: el administrador crea la cuenta, la invitación llega
 * al buzón y el titular la activa con el enlace. Para estudiantes el semestre
 * es obligatorio en el alta (§17.1): si la suite no lo indica, se usa el 1.
 */
export async function provisionAndActivate(
  adminToken,
  { firstName, lastName, email, role, password = PWD, semester, universityCode },
) {
  await asegurarCorreoDePrueba(adminToken);
  const desde = Date.now();
  const body = { firstName, lastName, email, role, universityCode: universityCode ?? codigoUniversitario(role) };
  if (ROLES_CON_SEMESTRE.includes(role)) body.semester = semester ?? 1;

  const created = await req('POST', '/users', { token: adminToken, body });
  if (created.status !== 201) {
    throw new Error(
      `No se pudo provisionar ${email} (${created.status}): ${JSON.stringify(created.data)}`,
    );
  }

  const correo = await leerCorreo(email, { tipo: 'account_activation', desde });
  if (!correo.token) throw new Error(`El correo de activación de ${email} no trae enlace.`);

  const activated = await req('POST', '/activation/activate', {
    body: { token: correo.token, password },
  });
  if (activated.status !== 200) {
    throw new Error(
      `No se pudo activar ${email} (${activated.status}): ${JSON.stringify(activated.data)}`,
    );
  }

  const login = await req('POST', '/auth/login', { body: { email, password } });
  if (login.status !== 200) {
    throw new Error(`No se pudo iniciar sesión como ${email} (${login.status}).`);
  }

  return {
    token: login.data.accessToken,
    refreshToken: login.data.refreshToken,
    userId: created.data.id,
    email,
    name: `${firstName} ${lastName}`,
    activationToken: correo.token,
    activationCode: correo.code,
    created: created.data,
  };
}

/**
 * Crea el perfil del estudiante y deja que el administrador fije su semestre.
 *
 * Reproduce el reparto que fija §17.1: la biografía es del estudiante, el
 * semestre es institucional. Devuelve el perfil ya con el semestre puesto.
 */
export async function crearPerfilConSemestre(studentToken, adminToken, { semester, bio } = {}) {
  const creado = await req('POST', '/profiles/me', {
    token: studentToken,
    body: bio === undefined ? {} : { bio },
  });
  const profileId = creado.data?.id ?? null;
  if (semester !== undefined && profileId) {
    await req('PATCH', `/profiles/${profileId}/institutional-data`, {
      token: adminToken,
      body: { semester },
    });
  }
  const actual = await req('GET', '/profiles/me', { token: studentToken });
  return { status: creado.status, data: actual.data ?? creado.data };
}

/**
 * Atajo para el caso más frecuente: un estudiante listo para operar.
 *
 * Desde el BATCH 2 el semestre es dato institucional (§17.1): lo fija el
 * administrador o llega por padrón, y el estudiante no puede tocarlo. Por eso
 * aquí el perfil lo crea el estudiante —la biografía es suya— pero el semestre
 * lo pone el administrador, que es como ocurre en el sistema real.
 */
export async function provisionStudent(adminToken, { firstName, lastName, email, semester }) {
  const actor = await provisionAndActivate(adminToken, {
    firstName,
    lastName,
    email,
    role: 'STUDENT',
    semester,
  });

  await req('POST', '/profiles/me', {
    token: actor.token,
    body: { bio: `Estudiante de Ingeniería en Sistemas.` },
  });

  const profile = await req('GET', '/profiles/me', { token: actor.token });
  const profileId = profile.data?.id ?? null;

  if (semester !== undefined && profileId) {
    const asignado = await req('PATCH', `/profiles/${profileId}/institutional-data`, {
      token: adminToken,
      body: { semester },
    });
    if (asignado.status !== 200) {
      throw new Error(
        `No se pudo fijar el semestre de ${email} (${asignado.status}): `
        + JSON.stringify(asignado.data),
      );
    }
  }

  return { ...actor, profileId };
}

/**
 * V2 §27: una actividad de Docente o Sociedad se envía a Dirección y solo se
 * publica aprobada. Envía, aprueba y (si `abrir`) la abre.
 */
export async function aprobarActividad(managerToken, directorToken, activityId, { abrir = true } = {}) {
  const enviada = await req('POST', `/activities/${activityId}/submit`, { token: managerToken, body: {} });
  if (enviada.status !== 200) {
    throw new Error(`No se pudo enviar a revisión (${enviada.status}): ${JSON.stringify(enviada.data)}`);
  }
  const aprobada = await req('POST', `/activities/${activityId}/review`, {
    token: directorToken, body: { decision: 'approve' },
  });
  if (aprobada.status !== 200) {
    throw new Error(`Dirección no pudo aprobar (${aprobada.status}): ${JSON.stringify(aprobada.data)}`);
  }
  if (abrir) {
    await req('PATCH', `/activities/${activityId}`, { token: managerToken, body: { status: 'open' } });
  }
  return aprobada.data;
}

// ===========================================================================
//  V3 §22 · Proyectos activos y GitHub simulado
// ===========================================================================

/**
 * GitHub simulado para las suites (V3 §22, §24). La API de desarrollo se
 * arranca con GITHUB_API_BASE_URL=http://127.0.0.1:3996 para usarlo; así las
 * pruebas no dependen de la cuota pública de GitHub ni de internet.
 *
 * Repositorios del dueño `afinia-pruebas`: públicos, salvo los que empiezan
 * por `privado` (privados) o `inexistente` (404). Cualquier otro dueño: 404.
 */
export const GITHUB_SIMULADO_PUERTO = Number(process.env.GITHUB_SIMULADO_PUERTO ?? 3996);
export const repoDePrueba = (nombre) => `https://github.com/afinia-pruebas/${nombre}`;

let githubSimulado = null;

/**
 * Contenido de los repositorios simulados (V3 §24). Según el prefijo del
 * nombre:
 *   stack-*     Node: React, NestJS, pg, TypeScript; compose con postgres.
 *   py-*        Python: FastAPI y psycopg2 en requirements.txt.
 *   cuota-*     GitHub responde «cuota agotada» (403, reinicio en 2 s).
 *   inestable-* Falla con 500 las dos primeras veces y luego responde.
 *   lenguaje-X  GitHub informa el lenguaje «X» (corrobora una tecnología X).
 *   resto       Node con Express y un Dockerfile.
 */
function contenidoSimulado(nombre) {
  const b64 = (t) => Buffer.from(t, 'utf8').toString('base64');
  if (nombre.startsWith('lenguaje-')) {
    return { languages: { [nombre.slice('lenguaje-'.length)]: 9000 }, files: { 'README.md': '# Proyecto' } };
  }
  if (nombre.startsWith('stack-')) {
    return {
      languages: { TypeScript: 80000, JavaScript: 2000 },
      files: {
        'package.json': JSON.stringify({ dependencies: { react: '^18', '@nestjs/core': '^10', pg: '^8' }, devDependencies: { typescript: '^5' } }),
        'docker-compose.yml': 'services:\n  db:\n    image: postgres:16\n  api:\n    build: .\n',
        'README.md': '# Proyecto',
      },
    };
  }
  if (nombre.startsWith('py-')) {
    return {
      languages: { Python: 40000 },
      files: { 'requirements.txt': 'fastapi==0.110\npsycopg2-binary>=2.9 # base de datos\nuvicorn\n', 'README.md': '# API' },
    };
  }
  return {
    languages: { TypeScript: 52000, JavaScript: 3000, CSS: 1200 },
    files: {
      'package.json': JSON.stringify({ dependencies: { express: '^4' } }),
      Dockerfile: 'FROM node:20-alpine\nCMD ["node", "index.js"]\n',
      'README.md': '# Proyecto',
    },
    b64,
  };
}

/** Repositorio simulado cuyo lenguaje corrobora la tecnología `nombre` (§24.2). */
export const repoQueCorrobora = (nombre) =>
  repoDePrueba(`lenguaje-${nombre.toLowerCase().normalize('NFD').replace(/[^a-z0-9]+/g, '')}`);

/** Peticiones recibidas por el GitHub simulado, para que las suites las inspeccionen. */
export const githubSimuladoLog = [];

export async function asegurarGithubSimulado() {
  if (githubSimulado) return;
  const { createServer } = await import('node:http');
  const { createHash } = await import('node:crypto');
  const fallos = new Map();
  const server = createServer((rq, rs) => {
    const url = rq.url ?? '';
    githubSimuladoLog.push({ url, ifNoneMatch: rq.headers['if-none-match'] ?? null });
    const json = (code, data, extra = {}) => {
      const cuerpo = JSON.stringify(data);
      const etag = `"${createHash('sha1').update(cuerpo).digest('hex')}"`;
      if (code === 200 && rq.headers['if-none-match'] === etag) {
        rs.writeHead(304, { etag });
        return rs.end();
      }
      rs.writeHead(code, { 'content-type': 'application/json', ...(code === 200 ? { etag } : {}), ...extra });
      rs.end(cuerpo);
    };
    const m = /^\/repos\/([^/]+)\/([^/?]+)(\/[^?]*)?/.exec(url);
    if (!m || m[1] !== 'afinia-pruebas' || m[2].startsWith('inexistente')) return json(404, { message: 'Not Found' });
    const [, owner, name, resto] = m;
    if (name.startsWith('cuota-')) {
      return json(403, { message: 'API rate limit exceeded' }, {
        'x-ratelimit-remaining': '0', 'x-ratelimit-reset': String(Math.ceil(Date.now() / 1000) + 2),
      });
    }
    if (name.startsWith('inestable-')) {
      const n = (fallos.get(url) ?? 0) + 1;
      fallos.set(url, n);
      if (n <= 2) { rs.writeHead(500); return rs.end(); }
    }
    const repo = contenidoSimulado(name);
    if (!resto || resto === '/') {
      return json(200, {
        name, owner: { login: owner }, default_branch: 'main', private: name.startsWith('privado'),
        updated_at: '2026-09-01T10:00:00Z', pushed_at: '2026-09-30T18:00:00Z', stargazers_count: 3,
      });
    }
    if (resto === '/languages') return json(200, repo.languages);
    if (resto === '/contents/' || resto === '/contents') {
      return json(200, Object.entries(repo.files).map(([f, t]) => ({ name: f, type: 'file', size: Buffer.byteLength(t) })));
    }
    const fichero = /^\/contents\/(.+)$/.exec(resto);
    if (fichero) {
      const nombre = decodeURIComponent(fichero[1]);
      const texto = repo.files[nombre];
      if (texto === undefined) return json(404, { message: 'Not Found' });
      return json(200, { name: nombre, encoding: 'base64', size: Buffer.byteLength(texto), content: Buffer.from(texto, 'utf8').toString('base64') });
    }
    return json(404, { message: 'Not Found' });
  });
  await new Promise((resolve) => {
    server.once('error', (e) => {
      // Otra suite ya lo levantó en este puerto: sirve igual.
      if (e.code === 'EADDRINUSE') resolve();
      else throw e;
    });
    server.listen(GITHUB_SIMULADO_PUERTO, '127.0.0.1', () => resolve());
  });
  server.unref();
  githubSimulado = server;
}

/**
 * Crea un proyecto y lo activa como lo haría un estudiante (V3 §22): borrador
 * con áreas, tecnologías del catálogo y repositorio público; una evidencia de
 * funcionamiento; y el paso a ACTIVE. Devuelve `{ status: 201, data }` con el
 * proyecto activo, o la respuesta que falló.
 *
 * Sin `skillIds`, toma del catálogo las tecnologías escritas en
 * `technologies`; si ninguna está, una del área indicada (o cualquiera).
 */
export async function crearProyectoActivo(token, body = {}) {
  await asegurarGithubSimulado();
  const { status: _ignorado, areaId, ...resto } = body;
  let areaIds = body.areaIds ?? (areaId ? [areaId] : []);
  let skillIds = body.skillIds ?? [];
  if (!skillIds.length || !areaIds.length) {
    const catalogo = ((await req('GET', '/skills', { token })).data ?? [])
      .filter((s) => s.isActive !== false && s.academicAreaId);
    if (!skillIds.length) {
      const escritas = new Set((body.technologies ?? []).map((t) => t.toLowerCase()));
      skillIds = catalogo.filter((s) => escritas.has(s.name.toLowerCase())).map((s) => s.id).slice(0, 20);
    }
    if (!skillIds.length) {
      let elegida = catalogo.find((s) => !areaIds.length || areaIds.includes(s.academicAreaId));
      if (!elegida && areaIds.length) {
        // Área recién creada en la suite: Administración registra una
        // tecnología suya, como haría antes de que un estudiante la elija.
        const admin = await loginAdmin();
        const creada = await req('POST', '/skills', {
          token: admin,
          body: { name: `Herramienta ${String(Date.now()).slice(-8)}${Math.floor(Math.random() * 90 + 10)}`, academicAreaId: areaIds[0] },
        });
        if (creada.status !== 201) throw new Error(`No se pudo registrar una tecnología para el área: ${JSON.stringify(creada.data)}`);
        elegida = creada.data;
        catalogo.push(elegida);
      }
      if (!elegida) throw new Error('No hay tecnologías en el catálogo para las áreas del proyecto.');
      skillIds = [elegida.id];
    }
    const areasDeSkills = catalogo.filter((s) => skillIds.includes(s.id)).map((s) => s.academicAreaId);
    areaIds = [...new Set([...areaIds, ...areasDeSkills])].slice(0, 6);
    // V4.1 §10.2: activar exige una tecnología por cada área alegada.
    if (!body.skillIds?.length) {
      for (const a of areaIds) {
        const cubierta = catalogo.some((s) => skillIds.includes(s.id) && s.academicAreaId === a);
        const deArea = catalogo.find((s) => s.academicAreaId === a);
        if (!cubierta && deArea && skillIds.length < 20) skillIds.push(deArea.id);
      }
    }
  }
  const slug = String(body.title ?? 'proyecto').toLowerCase().normalize('NFD')
    .replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 60) || 'proyecto';
  const borrador = await req('POST', '/projects', {
    token,
    body: { ...resto, areaIds, skillIds, repositoryUrl: body.repositoryUrl ?? repoDePrueba(slug), status: 'draft' },
  });
  if (borrador.status !== 201) return borrador;
  const id = borrador.data.id;
  const ev = await req('POST', `/projects/${id}/evidences`, {
    token,
    body: { evidenceType: 'link', externalUrl: `https://capturas.example.org/${id}.png`, description: 'Captura del funcionamiento.' },
  });
  if (ev.status !== 201) return ev;
  const activo = await req('PATCH', `/projects/${id}`, { token, body: { status: 'active' } });
  if (activo.status !== 200) return activo;
  return { status: 201, data: activo.data };
}

/**
 * Proyecto en borrador (V3 §21): se guarda aunque esté incompleto. Es el
 * punto de partida de las pruebas que miden cómo un proyecto vacío va
 * ganando respaldo: un ACTIVE ya nace con repositorio y evidencia (§22).
 */
export async function crearProyectoBorrador(token, body = {}) {
  // V3 §28: sin repositorio accesible no hay respaldo posible; el borrador
  // declara uno público (genérico: no respalda ninguna tecnología por sí
  // solo) para que las pruebas midan cómo gana respaldo. `repositoryUrl:
  // null` lo omite.
  await asegurarGithubSimulado();
  const slug = String(body.title ?? 'borrador').toLowerCase().normalize('NFD')
    .replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 60) || 'borrador';
  const { repositoryUrl, ...resto } = body;
  const repo = repositoryUrl === null ? {} : { repositoryUrl: repositoryUrl ?? repoDePrueba(`borrador-${slug}`) };
  return req('POST', '/projects', { token, body: { ...resto, ...repo, status: 'draft' } });
}
