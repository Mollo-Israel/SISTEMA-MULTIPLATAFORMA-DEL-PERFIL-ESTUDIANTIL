/**
 * Utilidades compartidas por las suites de integración.
 *
 * Desde el BATCH 1 no existe registro público (§9.1): una cuenta se provisiona
 * y su titular la activa. Estas funciones reproducen ese camino real —crear,
 * activar, iniciar sesión— en lugar de saltárselo, de modo que las pruebas
 * ejercitan el mismo flujo que usará una persona.
 *
 * El token de activación llega en la respuesta porque el entorno de pruebas no
 * tiene SMTP configurado; en producción viaja solo por correo.
 */

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

/** Inicia sesión como administrador y devuelve su access token. */
export async function loginAdmin() {
  const res = await req('POST', '/auth/login', { body: ADMIN_CREDENTIALS });
  if (res.status !== 200 || !res.data?.accessToken) {
    throw new Error(
      `No se pudo iniciar sesión como administrador (${res.status}). `
      + 'Ejecute: npm run api:migrate && npm run seed:populate',
    );
  }
  return res.data.accessToken;
}

/**
 * Provisiona una cuenta, la activa y la deja lista para usar.
 *
 * Devuelve el mismo contrato que antes producía `/auth/register`
 * —`{ token, userId }`— más lo que ahora hace falta, para que migrar las
 * suites no obligue a reescribir sus aserciones.
 */
export async function provisionAndActivate(adminToken, { firstName, lastName, email, role, password = PWD }) {
  const created = await req('POST', '/users', {
    token: adminToken,
    body: { firstName, lastName, email, password, role },
  });
  if (created.status !== 201) {
    throw new Error(
      `No se pudo provisionar ${email} (${created.status}): ${JSON.stringify(created.data)}`,
    );
  }

  const activationToken = created.data?.activationToken;
  if (!activationToken) {
    throw new Error(
      `La API no devolvió token de activación para ${email}. `
      + 'Las pruebas requieren un entorno sin SMTP configurado.',
    );
  }

  const activated = await req('POST', '/activation/activate', {
    body: { token: activationToken, password },
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
    activationToken,
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
