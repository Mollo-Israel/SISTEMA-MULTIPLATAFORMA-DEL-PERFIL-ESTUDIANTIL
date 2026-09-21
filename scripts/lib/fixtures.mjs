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

/** Atajo para el caso más frecuente: un estudiante listo para operar. */
export async function provisionStudent(adminToken, { firstName, lastName, email, semester }) {
  const actor = await provisionAndActivate(adminToken, {
    firstName,
    lastName,
    email,
    role: 'STUDENT',
  });

  // El perfil lo crea el propio estudiante: el provisionamiento solo aporta la
  // identidad institucional.
  if (semester !== undefined) {
    await req('POST', '/profiles/me', {
      token: actor.token,
      body: { semester, bio: `Estudiante de ${semester}º semestre.` },
    });
  }

  const profile = await req('GET', '/profiles/me', { token: actor.token });
  return { ...actor, profileId: profile.data?.id ?? null };
}
