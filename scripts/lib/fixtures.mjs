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
export async function asegurarGithubSimulado() {
  if (githubSimulado) return;
  const { createServer } = await import('node:http');
  const json = (rs, code, data) => { rs.writeHead(code, { 'content-type': 'application/json' }); rs.end(JSON.stringify(data)); };
  const server = createServer((rq, rs) => {
    const m = /^\/repos\/([^/]+)\/([^/?]+)(\/[^?]*)?/.exec(rq.url ?? '');
    if (!m || m[1] !== 'afinia-pruebas' || m[2].startsWith('inexistente')) return json(rs, 404, { message: 'Not Found' });
    const [, owner, name, resto] = m;
    if (!resto || resto === '/') {
      return json(rs, 200, {
        name, owner: { login: owner }, default_branch: 'main', private: name.startsWith('privado'),
        updated_at: new Date().toISOString(), stargazers_count: 3,
      });
    }
    if (resto === '/languages') return json(rs, 200, { TypeScript: 52000, JavaScript: 3000, CSS: 1200 });
    if (resto.startsWith('/contents')) {
      return json(rs, 200, [
        { name: 'package.json', type: 'file' }, { name: 'README.md', type: 'file' }, { name: 'Dockerfile', type: 'file' },
      ]);
    }
    return json(rs, 404, { message: 'Not Found' });
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
  return req('POST', '/projects', { token, body: { ...body, status: 'draft' } });
}
