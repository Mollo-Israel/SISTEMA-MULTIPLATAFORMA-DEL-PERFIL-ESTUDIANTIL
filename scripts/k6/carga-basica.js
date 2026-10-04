/**
 * Carga de Afinia con k6 (V2 §79.7, RNF05; BATCH 16).
 *
 * Cubre lo que §79.7 enumera: login, listados, perfiles, recomendaciones y
 * reportes. Los usuarios (un estudiante y una Dirección) los crea run-k6.mjs
 * por el camino real. Los umbrales son los de RNF05, en entorno controlado:
 *   - 95 % de las operaciones CRUD sin archivos en <= 3 s;
 *   - reportes habituales en <= 5 s;
 * y menos de 1 % de errores.
 *
 * Las peticiones piden respuesta comprimida, como cualquier navegador.
 */
import http from 'k6/http';
import { check, group, sleep } from 'k6';

const BASE = __ENV.BASE || 'http://host.docker.internal:3010/api';
const JSON_HEADERS = { 'Content-Type': 'application/json' };

export const options = {
  scenarios: {
    estudiantes: {
      executor: 'ramping-vus',
      exec: 'estudiante',
      startVUs: 1,
      stages: [
        { duration: '15s', target: 10 },
        { duration: '30s', target: 25 },
        { duration: '15s', target: 0 },
      ],
    },
    direccion: {
      executor: 'constant-vus',
      exec: 'direccion',
      vus: 2,
      duration: '60s',
    },
  },
  thresholds: {
    http_req_failed: ['rate<0.01'],
    'http_req_duration{tipo:crud}': ['p(95)<3000'],
    'http_req_duration{tipo:login}': ['p(95)<3000'],
    'http_req_duration{tipo:reporte}': ['p(95)<5000'],
    checks: ['rate>0.99'],
  },
};

function login(email, password) {
  const res = http.post(`${BASE}/auth/login`, JSON.stringify({ email, password }), {
    headers: JSON_HEADERS, tags: { tipo: 'login' },
  });
  check(res, { 'login 200': (r) => r.status === 200 });
  return res.json('accessToken');
}

export function setup() {
  return {
    estudiante: login(__ENV.EMAIL, __ENV.PASSWORD),
    director: login(__ENV.DIR_EMAIL, __ENV.PASSWORD),
  };
}

const params = (token, tipo) => ({
  headers: { Authorization: `Bearer ${token}`, 'Accept-Encoding': 'gzip, deflate' },
  tags: { tipo },
});

export function estudiante(data) {
  const t = data.estudiante;
  group('Perfil', () => {
    check(http.get(`${BASE}/profiles/me/summary`, params(t, 'crud')), { 'resumen 200': (r) => r.status === 200 });
    check(http.get(`${BASE}/affinity/me/summary`, params(t, 'crud')), { 'afinidad 200': (r) => r.status === 200 });
  });
  group('Listados', () => {
    check(http.get(`${BASE}/activities?status=open`, params(t, 'crud')), { 'actividades 200': (r) => r.status === 200 });
    check(http.get(`${BASE}/projects/my`, params(t, 'crud')), { 'proyectos 200': (r) => r.status === 200 });
  });
  group('Recomendaciones', () => {
    check(http.get(`${BASE}/recommendations/me`, params(t, 'crud')), { 'recomendaciones 200': (r) => r.status === 200 });
  });
  // Una de cada diez vueltas vuelve a iniciar sesión: el login también se mide.
  if (Math.random() < 0.1) login(__ENV.EMAIL, __ENV.PASSWORD);
  sleep(1);
}

export function direccion(data) {
  const t = data.director;
  group('Reportes', () => {
    check(http.get(`${BASE}/reports/director/overview`, params(t, 'reporte')), { 'panel 200': (r) => r.status === 200 });
    check(http.get(`${BASE}/reports/director/trends`, params(t, 'reporte')), { 'tendencias 200': (r) => r.status === 200 });
    check(http.get(`${BASE}/reports/director/affinity-map`, params(t, 'reporte')), { 'mapa 200': (r) => r.status === 200 });
  });
  sleep(2);
}
