/**
 * Genera la colección de Postman de Afinia y su entorno de pruebas
 * (Investigación §3.2: apoyo exploratorio y documental de la API).
 *
 *   node scripts/pruebas/postman-coleccion.mjs
 *
 * Salida: pruebas/04-postman-newman/afinia.postman_collection.json y
 * afinia-pruebas.postman_environment.json. Se importan tal cual en Postman, o se
 * corren con Newman (`npm run pruebas:postman`).
 */
import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { API_URL, RAIZ } from './entorno.mjs';

const DIR = join(RAIZ, 'pruebas', '04-postman-newman');
mkdirSync(DIR, { recursive: true });

const auth = (rol) => ({ type: 'bearer', bearer: [{ key: 'token', value: `{{token_${rol}}}`, type: 'string' }] });
const pruebas = (...lineas) => [{ listen: 'test', script: { type: 'text/javascript', exec: lineas } }];
const req = (nombre, metodo, ruta, { rol, body, tests } = {}) => ({
  name: nombre,
  request: {
    method: metodo,
    ...(rol ? { auth: auth(rol) } : { auth: { type: 'noauth' } }),
    header: body ? [{ key: 'Content-Type', value: 'application/json' }] : [],
    ...(body ? { body: { mode: 'raw', raw: JSON.stringify(body, null, 2) } } : {}),
    url: { raw: `{{baseUrl}}${ruta}`, host: ['{{baseUrl}}'], path: ruta.split('?')[0].split('/').filter(Boolean),
      ...(ruta.includes('?') ? { query: ruta.split('?')[1].split('&').map((q) => { const [key, value] = q.split('='); return { key, value }; }) } : {}) },
  },
  event: tests ? pruebas(...tests) : [],
});

const login = (rol, email, clave) => req(`Iniciar sesión · ${rol}`, 'POST', '/auth/login', {
  body: { email, password: clave },
  tests: [
    "pm.test('200/201 con token de acceso', () => { pm.expect(pm.response.code).to.be.oneOf([200, 201]); pm.expect(pm.response.json().accessToken).to.be.a('string'); });",
    `pm.environment.set('token_${rol}', pm.response.json().accessToken);`,
  ],
});

const coleccion = {
  info: {
    name: 'Afinia — API (pruebas de control de calidad)',
    description: 'Colección de apoyo exploratorio y documental. La regresión crítica de autorización e integridad está en Jest + SuperTest (api/test/jest).',
    schema: 'https://schema.getpostman.com/json/collection/v2.1.0/collection.json',
  },
  item: [
    {
      name: '01 · Identidad y sesión',
      item: [
        login('admin', '{{adminEmail}}', '{{adminPassword}}'),
        login('estudiante', 'ana.quispe@est.univalle.edu', '{{clave}}'),
        login('docente', 'carlos.perez@univalle.edu', '{{clave}}'),
        login('director', 'jorge.vargas@univalle.edu', '{{clave}}'),
        login('sociedad', 'lucia.fernandez@univalle.edu', '{{clave}}'),
        req('Contraseña incorrecta → 401 genérico', 'POST', '/auth/login', {
          body: { email: 'ana.quispe@est.univalle.edu', password: 'Incorrecta2026*' },
          tests: ["pm.test('401 sin revelar si la cuenta existe', () => { pm.response.to.have.status(401); });"],
        }),
        req('Recuperar contraseña de una cuenta que no existe → respuesta genérica', 'POST', '/activation/forgot-password', {
          body: { email: 'nadie.existe@est.univalle.edu' },
          tests: ["pm.test('responde sin revelar la existencia de la cuenta', () => { pm.expect(pm.response.code).to.be.below(300); });"],
        }),
        req('Ruta protegida sin sesión → 401', 'GET', '/profiles/me', {
          tests: ["pm.test('401 sin token', () => pm.response.to.have.status(401));"],
        }),
      ],
    },
    {
      name: '02 · Estudiante',
      item: [
        req('Mi perfil', 'GET', '/profiles/me', { rol: 'estudiante', tests: [
          "pm.test('200 con su semestre', () => { pm.response.to.have.status(200); pm.expect(pm.response.json().semester).to.eql(1); });",
          "pm.test('no expone hash de contraseña', () => pm.expect(pm.response.text()).to.not.include('passwordHash'));",
        ] }),
        req('Mi afinidad (resumen)', 'GET', '/affinity/me/summary', { rol: 'estudiante', tests: ["pm.test('200', () => pm.response.to.have.status(200));"] }),
        req('Mis recomendaciones', 'GET', '/recommendations/me', { rol: 'estudiante', tests: ["pm.test('200', () => pm.response.to.have.status(200));"] }),
        req('Mi trayectoria', 'GET', '/trajectory/me', { rol: 'estudiante', tests: [
          "pm.test('200 con entradas y niveles', () => { pm.response.to.have.status(200); pm.expect(pm.response.json().entries).to.be.an('array'); });",
        ] }),
        req('Mis proyectos', 'GET', '/projects/my', { rol: 'estudiante', tests: ["pm.test('200', () => pm.response.to.have.status(200));"] }),
        req('Actividades publicadas', 'GET', '/activities', { rol: 'estudiante', tests: ["pm.test('200', () => pm.response.to.have.status(200));"] }),
      ],
    },
    {
      name: '03 · Autorización y alcance (casos negativos)',
      item: [
        req('Estudiante → auditoría → 403', 'GET', '/audit/events', { rol: 'estudiante', tests: ["pm.test('403', () => pm.response.to.have.status(403));"] }),
        req('Estudiante → lista de estudiantes → 403', 'GET', '/profiles/students', { rol: 'estudiante', tests: ["pm.test('403', () => pm.response.to.have.status(403));"] }),
        req('Docente (sem. 1–4) → estudiantes de su alcance', 'GET', '/profiles/students', { rol: 'docente', tests: [
          "pm.test('200 con alcance restringido a sus semestres', () => { pm.response.to.have.status(200); pm.expect(pm.response.json().scope.semesters).to.eql([1,2,3,4]); });",
        ] }),
        req('Docente → criterios de puntos (solo lectura de los elegibles)', 'GET', '/gamification-criteria/available', { rol: 'docente', tests: ["pm.test('200', () => pm.response.to.have.status(200));"] }),
        req('Docente → crear criterio → 403', 'POST', '/gamification-criteria', {
          rol: 'docente', body: { code: 'postman_prueba', name: 'Prueba', trigger: 'participacion_confirmada', points: 10 },
          tests: ["pm.test('403: los criterios los configura Dirección o Administración', () => pm.response.to.have.status(403));"],
        }),
        req('Retos (retirados en V4.1) → 410', 'POST', '/gamification/challenges', {
          rol: 'docente', body: { title: 'Reto', points: 10 },
          tests: ["pm.test('410 Gone', () => pm.response.to.have.status(410));"],
        }),
      ],
    },
    {
      name: '04 · Dirección y Administración',
      item: [
        req('Dirección → pendientes de aprobación', 'GET', '/activities/reviews/pending', { rol: 'director', tests: ["pm.test('200', () => pm.response.to.have.status(200));"] }),
        req('Dirección → propuestas de puntos pendientes', 'GET', '/gamification/proposals?status=pending', { rol: 'director', tests: ["pm.test('200', () => pm.response.to.have.status(200));"] }),
        req('Administración → auditoría', 'GET', '/audit/events?limit=5', { rol: 'admin', tests: ["pm.test('200', () => pm.response.to.have.status(200));"] }),
        req('Administración → informe de recálculo de respaldo (en seco)', 'POST', '/project-backing/recalculate', {
          rol: 'admin', body: { apply: false },
          tests: ["pm.test('200 sin aplicar cambios', () => { pm.response.to.have.status(200); pm.expect(pm.response.json().applied).to.eql(false); });"],
        }),
      ],
    },
    {
      // V5: solo lecturas y rechazos, para que la base de pruebas quede igual.
      name: '05 · Cierre V5',
      item: [
        req('Docente → autonomía propia (revisión por defecto)', 'GET', '/approval-policies/me', { rol: 'docente', tests: [
          "pm.test('200 y actividades siempre con revisión', () => { pm.response.to.have.status(200); pm.expect(pm.response.json().ACTIVITY).to.eql('REQUIRE_REVIEW'); });",
        ] }),
        req('Docente → concederse autonomía → 403', 'POST', '/approval-policies', {
          rol: 'docente', body: { teacherUserId: '00000000-0000-4000-8000-000000000000', module: 'RESOURCE', justification: 'Intento de concederse autonomía.' },
          tests: ["pm.test('403: la concede Dirección', () => pm.response.to.have.status(403));"],
        }),
        req('Administración → conceder autonomía → 403', 'POST', '/approval-policies', {
          rol: 'admin', body: { teacherUserId: '00000000-0000-4000-8000-000000000000', module: 'RESOURCE', justification: 'Administración no es autoridad académica.' },
          tests: ["pm.test('403: Administración no concede', () => pm.response.to.have.status(403));"],
        }),
        req('Dirección → excepción en actividades → 400', 'POST', '/approval-policies', {
          rol: 'director', body: { teacherUserId: '00000000-0000-4000-8000-000000000000', module: 'ACTIVITY', justification: 'Las actividades siguen con revisión.' },
          tests: ["pm.test('400 ACTIVITY_OVERRIDE_NOT_ENABLED', () => { pm.response.to.have.status(400); pm.expect(pm.response.json().code).to.eql('ACTIVITY_OVERRIDE_NOT_ENABLED'); });"],
        }),
        req('Dirección → historial de acciones directas', 'GET', '/approval-policies/direct-actions', { rol: 'director', tests: ["pm.test('200', () => pm.response.to.have.status(200));"] }),
        req('Estudiante → proyectos de la carrera (6 por página, sin correos)', 'GET', '/projects/community?page=1', { rol: 'estudiante', tests: [
          "pm.test('200 con páginas de 6', () => { pm.response.to.have.status(200); pm.expect(pm.response.json().pageSize).to.eql(6); });",
          "pm.test('sin correos', () => pm.expect(pm.response.text()).to.not.include('@'));",
        ] }),
        req('Estudiante → analizar un enlace inválido → 400 en su campo', 'POST', '/projects/repository/analyze', {
          rol: 'estudiante', body: { repositoryUrl: 'esto no es un enlace' },
          tests: ["pm.test('400 en repositoryUrl', () => { pm.response.to.have.status(400); pm.expect(pm.response.json().fields.repositoryUrl).to.be.an('array'); });"],
        }),
        req('Docente → criterio con familia retirada → 403', 'POST', '/gamification-criteria', {
          rol: 'docente', body: { code: 'postman_colab', name: 'Colaborar', trigger: 'colaboracion_aceptada', points: 5 },
          tests: ["pm.test('403: el docente no crea criterios', () => pm.response.to.have.status(403));"],
        }),
        req('Estudiante → historial de puntos de otro → 403', 'GET', '/gamification/students/00000000-0000-4000-8000-000000000000/history', {
          rol: 'estudiante', tests: ["pm.test('403: no hay ranking ni consulta entre estudiantes', () => pm.response.to.have.status(403));"],
        }),
        req('Resumen de trayectoria → aviso de fuentes (ND-02)', 'GET', '/trajectory-summary/sections', { rol: 'estudiante', tests: [
          "pm.test('200 con el aviso y el descargo', () => { pm.response.to.have.status(200); pm.expect(pm.response.json().notice).to.include('no las certifica'); pm.expect(pm.response.json().disclaimer).to.include('No constituye historial'); });",
        ] }),
      ],
    },
  ],
  event: [{ listen: 'test', script: { type: 'text/javascript', exec: [
    "pm.test('responde en menos de 2 s', () => pm.expect(pm.response.responseTime).to.be.below(2000));",
  ] } }],
};

const entorno = {
  name: 'Afinia · pruebas (afinia_test)',
  values: [
    { key: 'baseUrl', value: API_URL, enabled: true },
    { key: 'clave', value: 'Univalle2026*', type: 'secret', enabled: true },
    { key: 'adminEmail', value: process.env.ADMIN_EMAIL ?? 'admin@univalle.edu', enabled: true },
    // La contraseña de Administración no se guarda en el archivo: se pasa al correr.
    { key: 'adminPassword', value: '', type: 'secret', enabled: true },
  ],
};

writeFileSync(join(DIR, 'afinia.postman_collection.json'), JSON.stringify(coleccion, null, 2));
writeFileSync(join(DIR, 'afinia-pruebas.postman_environment.json'), JSON.stringify(entorno, null, 2));
console.log(`Colección y entorno escritos en ${DIR}`);
