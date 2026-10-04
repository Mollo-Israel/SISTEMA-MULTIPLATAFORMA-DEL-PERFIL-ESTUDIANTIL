/**
 * Especificación V2 §43, §44, §84 — el asistente de IA con un proveedor real
 * del protocolo `openai_compatible`, sin depender de ningún modelo externo.
 *
 * Levanta:
 *   1. un proveedor simulado en 127.0.0.1:3999 que habla `/v1/chat/completions`
 *      y guarda cada pedido para inspeccionarlo;
 *   2. una segunda instancia de la API (api/dist, puerto 3011) con
 *      AI_PROVIDER=openai_compatible apuntando a ese proveedor.
 *
 * La instancia principal (3010) sigue con AI_PROVIDER=none y no se toca.
 *
 * Requiere `npm --prefix api run build:e2e` antes (lo hace `npm run test:ai`).
 * Compila en `dist-e2e` y no en `dist`: `dist` es de donde corre la API en
 * modo watch, y reescribirlo la tumba a mitad de una regresión.
 *
 * Uso: node scripts/e2e-ai-provider.mjs
 */

import { spawn, execSync } from 'node:child_process';
import { createServer } from 'node:http';
import { existsSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const RAIZ = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const PUERTO_API = Number(process.env.AI_TEST_API_PORT ?? 3011);
const PUERTO_IA = Number(process.env.AI_TEST_PROVIDER_PORT ?? 3999);
const CLAVE = 'clave-de-prueba-0123456789';
process.env.API_URL = `http://localhost:${PUERTO_API}/api`;
const { loginAdmin, provisionAndActivate, req } = await import('./lib/fixtures.mjs');

const TS = Date.now();
const C = { r: '\x1b[0m', bold: '\x1b[1m', dim: '\x1b[90m', ok: '\x1b[32m', bad: '\x1b[31m', head: '\x1b[36m' };
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
const json = (x) => JSON.stringify(x ?? null).slice(0, 200);
const espera = (ms) => new Promise((r) => setTimeout(r, ms));

// ===========================================================================
//  Proveedor simulado
// ===========================================================================
const proveedor = { pedidos: [], demoraMs: 0, caido: false, inventar: false };

function responder(system, user) {
  if (system.includes('"tags"')) return { tags: ['Arquitectura', 'patrones de diseño', 'x', '<b>mal</b>', 'arquitectura'] };
  if (system.includes('"area"')) {
    const lista = (user.split('Áreas: ')[1] ?? '').split('.')[0].split(' | ');
    return proveedor.inventar ? { area: 'Área que no existe', reason: 'x' } : { area: lista[0], reason: 'Por afinidad temática.' };
  }
  if (system.includes('"summary"')) return { summary: 'El proyecto registra enlaces a capturas del sistema.' };
  if (system.includes('"explanation"')) return { explanation: 'Revisa que el enlace del repositorio sea público.' };
  if (system.includes('"texts"')) {
    return proveedor.inventar
      ? { texts: ['Lideré durante 15 años un equipo de 40 personas.'] }
      : { texts: ['Desarrollé el backend del sistema de inventario con NestJS y PostgreSQL.'] };
  }
  if (system.includes('"narrative"')) {
    const cifra = (user.match(/: (\d+)/) ?? [])[1] ?? '';
    return { narrative: proveedor.inventar ? 'Hubo 987654 proyectos este año.' : `La tecnología más usada aparece en ${cifra} proyectos.` };
  }
  if (system.includes('"flagged"')) {
    const marcado = /tontos/i.test(user);
    return { flagged: marcado, reason: marcado ? 'Puede leerse como burla.' : null, suggestion: marcado ? 'Equipo Aurora' : null };
  }
  return { error: 'tarea desconocida' };
}

const servidorIa = createServer((rq, rs) => {
  let cuerpo = '';
  rq.on('data', (c) => { cuerpo += c; });
  rq.on('end', async () => {
    const body = JSON.parse(cuerpo || '{}');
    proveedor.pedidos.push({ url: rq.url, auth: rq.headers.authorization ?? null, body });
    if (proveedor.demoraMs) await espera(proveedor.demoraMs);
    if (proveedor.caido) {
      rs.writeHead(500, { 'Content-Type': 'application/json' });
      rs.end(JSON.stringify({ error: { message: `fallo interno con ${CLAVE}` } }));
      return;
    }
    const system = body.messages?.[0]?.content ?? '';
    const user = body.messages?.[1]?.content ?? '';
    rs.writeHead(200, { 'Content-Type': 'application/json' });
    rs.end(JSON.stringify({
      choices: [{ message: { role: 'assistant', content: '```json\n' + JSON.stringify(responder(system, user)) + '\n```' } }],
    }));
  });
});

// ===========================================================================
//  Segunda instancia de la API
// ===========================================================================
let api = null;
async function levantarApi() {
  const main = join(RAIZ, 'api', 'dist-e2e', 'main.js');
  if (!existsSync(main)) throw new Error('Falta api/dist-e2e/main.js: ejecute `npm --prefix api run build:e2e`.');
  api = spawn(process.execPath, [main], {
    cwd: join(RAIZ, 'api'),
    env: {
      ...process.env,
      API_PORT: String(PUERTO_API),
      AI_PROVIDER: 'openai_compatible',
      AI_BASE_URL: `http://127.0.0.1:${PUERTO_IA}/v1`,
      AI_MODEL: 'modelo-simulado',
      AI_API_KEY: CLAVE,
      AI_TIMEOUT_MS: '1500',
      AI_MAX_INPUT_CHARS: '4000',
      // La instancia principal ya hizo los recálculos de arranque.
      AFFINITY_BACKFILL_ON_BOOT: 'false',
    },
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  let log = '';
  api.stdout.on('data', (d) => { log += d; });
  api.stderr.on('data', (d) => { log += d; });
  for (let i = 0; i < 90; i++) {
    await espera(1000);
    try {
      const r = await fetch(`http://localhost:${PUERTO_API}/api/health`);
      if (r.ok) return;
    } catch { /* aún no */ }
    if (api.exitCode !== null) break;
  }
  throw new Error(`La API de prueba no arrancó:\n${log.slice(-2000)}`);
}

const psql = (sql) => execSync(
  `docker exec perfil_postgres psql -U ${process.env.POSTGRES_USER ?? 'perfil_user'} -d ${process.env.POSTGRES_DB ?? 'perfil_estudiantil'} -tAc "${sql.replace(/"/g, '\\"')}"`,
  { encoding: 'utf8' },
).trim();

// ===========================================================================
async function pruebas() {
  const admin = await loginAdmin();
  const nuevo = (k, role, extra = {}) => provisionAndActivate(admin, {
    firstName: 'Prueba', lastName: k, role,
    email: role === 'STUDENT' ? `ai.${k}.${TS}@est.univalle.edu` : `ai.${k}.${TS}@univalle.edu`, ...extra,
  });
  const est = await nuevo('est', 'STUDENT', { semester: 6 });
  const otro = await nuevo('otro', 'STUDENT', { semester: 6 });
  const docenteDentro = await nuevo('docin', 'TEACHER');
  const docenteFuera = await nuevo('docout', 'TEACHER');
  const director = await nuevo('dir', 'CAREER_DIRECTOR');
  await req('PUT', `/users/${docenteDentro.userId}/semesters`, { token: admin, body: { semesters: [6] } });
  await req('PUT', `/users/${docenteFuera.userId}/semesters`, { token: admin, body: { semesters: [1] } });
  for (const s of [est, otro]) await req('POST', '/profiles/me', { token: s.token, body: {} });

  objective('§43.1 · Proveedor openai_compatible');
  const st = await req('GET', '/ai/status', { token: est.token });
  check(st.data?.enabled === true && st.data?.provider === 'openai_compatible' && st.data?.model === 'modelo-simulado',
    'IA.1 La API usa el adaptador configurado por entorno', json(st.data));
  check((st.data?.tasks ?? []).map((t) => t.task).sort().join() === 'CV_TEXT_ASSIST,EVIDENCE_SUMMARY,INCONSISTENCY_EXPLANATION',
    'IA.2 El estudiante ve solo sus tareas', json(st.data?.tasks));

  objective('§61.3 · Ayuda de redacción del CV');
  const original = 'Trabajé en el backend del sistema de inventario con NestJS y PostgreSQL. Mi correo es iris@gmail.com y mi celular 77123456.';
  const antes = proveedor.pedidos.length;
  const cv = await req('POST', '/ai/suggestions', { token: est.token, body: { task: 'CV_TEXT_ASSIST', text: original, mode: 'improve' } });
  const pedido = proveedor.pedidos[antes];
  check(cv.status === 201 && cv.data?.ok === true && cv.data?.source === 'ai' && cv.data?.result?.texts?.length === 1 && !!cv.data?.runId,
    'IA.3 Devuelve la propuesta con su ejecución registrada', json(cv.data));
  check(pedido?.url === '/v1/chat/completions' && pedido?.auth === `Bearer ${CLAVE}` && pedido?.body?.model === 'modelo-simulado',
    'IA.4 Habla el protocolo: /chat/completions, Bearer y modelo', json({ url: pedido?.url, model: pedido?.body?.model }));
  const enviado = pedido?.body?.messages?.[1]?.content ?? '';
  check(!enviado.includes('iris@gmail.com') && !enviado.includes('77123456') && enviado.includes('[correo]'),
    'IA.5 §43.4 Correo y teléfono no salen hacia el proveedor', enviado.slice(0, 160));
  check(/no inventes/i.test(pedido?.body?.messages?.[0]?.content ?? ''),
    'IA.6 §61.3 La instrucción prohíbe inventar experiencia, cargos o cifras');
  check(!!cv.data?.disclaimer, 'IA.7 Toda sugerencia viaja con su advertencia');

  const fila = psql(`select provider||'|'||model||'|'||task_type||'|'||length(input_fingerprint)||'|'||status||'|'||coalesce(accepted_by::text,'null') from ai_assistance_runs where id='${cv.data?.runId}'`);
  check(fila === 'openai_compatible|modelo-simulado|CV_TEXT_ASSIST|64|completed|null',
    'IA.8 §43.3 Se registra proveedor, modelo, tarea, huella, resultado y aceptación pendiente', fila);
  const columnas = psql("select string_agg(column_name, ',') from information_schema.columns where table_name='ai_assistance_runs'");
  check(!/input(?!_fingerprint)/.test(columnas.replace(/input_fingerprint/g, '')), 'IA.9 §43.4 La entrada no se guarda, solo su huella', columnas);

  const ajena = await req('POST', `/ai/runs/${cv.data?.runId}/accept`, { token: otro.token });
  const afinidadAntes = JSON.stringify((await req('GET', '/affinity/me/summary', { token: est.token })).data?.areas ?? []);
  const aceptada = await req('POST', `/ai/runs/${cv.data?.runId}/accept`, { token: est.token });
  const otraVez = await req('POST', `/ai/runs/${cv.data?.runId}/accept`, { token: est.token });
  const afinidadDespues = JSON.stringify((await req('GET', '/affinity/me/summary', { token: est.token })).data?.areas ?? []);
  check(ajena.status === 404 && aceptada.status === 201 && !!aceptada.data?.acceptedAt && otraVez.data?.acceptedAt === aceptada.data?.acceptedAt,
    'IA.10 §43.3 Solo quien la pidió la acepta; aceptar dos veces no cambia la fecha', `${ajena.status}/${aceptada.status}`);
  check(afinidadAntes === afinidadDespues, 'IA.11 §5.3 Aceptar una sugerencia no toca la afinidad');
  check(psql(`select accepted_by from ai_assistance_runs where id='${cv.data?.runId}'`) === est.userId,
    'IA.12 §43.3 accepted_by queda con quien la adoptó');

  proveedor.inventar = true;
  const inventa = await req('POST', '/ai/suggestions', { token: est.token, body: { task: 'CV_TEXT_ASSIST', text: original, mode: 'alternatives' } });
  proveedor.inventar = false;
  check(inventa.status === 201 && inventa.data?.ok === false && !inventa.data?.result,
    'IA.13 §61.3 Si la propuesta trae cifras que el texto no tenía, se descarta', json(inventa.data));

  objective('§23.3 · Etiquetas y área sugerida');
  const etiquetas = await req('POST', '/ai/suggestions', {
    token: docenteDentro.token, body: { task: 'TAG_SUGGESTION', target: 'activity', text: 'Taller de arquitectura de software y patrones de diseño' },
  });
  check(etiquetas.data?.ok && json(etiquetas.data?.result?.tags) === json(['arquitectura', 'patrones de diseño']),
    'IA.14 Las etiquetas se normalizan, sin duplicados ni marcas', json(etiquetas.data?.result));
  const area = await req('POST', '/ai/suggestions', { token: admin, body: { task: 'TAG_SUGGESTION', target: 'skill', text: `Tecnologia rara ${TS}` } });
  check(area.data?.ok && !!area.data?.result?.areaId && area.data?.source === 'ai',
    'IA.15 Para una tecnología sin regla, la IA propone un área del catálogo', json(area.data?.result));
  proveedor.inventar = true;
  const areaInventada = await req('POST', '/ai/suggestions', { token: admin, body: { task: 'TAG_SUGGESTION', target: 'skill', text: `Otra rara ${TS}` } });
  proveedor.inventar = false;
  check(areaInventada.data?.ok === false, 'IA.16 §23.3 Un área que no existe en el catálogo no se acepta', json(areaInventada.data));
  const regla = await req('POST', '/ai/suggestions', { token: admin, body: { task: 'TAG_SUGGESTION', target: 'skill', text: 'Flutter' } });
  check(regla.data?.source === 'rule', 'IA.17 §23.3 Con regla canónica no se consulta a la IA', json(regla.data));

  objective('§43.2 · Evidencias e inconsistencias, con el acceso del proyecto');
  const proyecto = await req('POST', '/projects', {
    token: est.token,
    body: { title: `Proyecto IA ${TS}`, description: 'Proyecto de prueba.', technologies: ['NestJS'], status: 'active', visibility: 'teachers' },
  });
  await req('POST', `/projects/${proyecto.data?.id}/evidences`, {
    token: est.token, body: { evidenceType: 'link', description: 'Capturas del sistema', externalUrl: 'https://ejemplo.univalle.edu/capturas?token=secreto123' },
  });
  const n0 = proveedor.pedidos.length;
  const resumen = await req('POST', '/ai/suggestions', { token: est.token, body: { task: 'EVIDENCE_SUMMARY', projectId: proyecto.data?.id } });
  const enviadoResumen = proveedor.pedidos[n0]?.body?.messages?.[1]?.content ?? '';
  check(resumen.data?.ok && !!resumen.data?.result?.summary, 'IA.18 Resume las evidencias del proyecto', json(resumen.data));
  check(enviadoResumen.includes('ejemplo.univalle.edu') && !enviadoResumen.includes('secreto123') && !enviadoResumen.includes('Prueba est'),
    'IA.19 §43.4 Solo viajan metadatos: dominio del enlace, sin parámetros ni nombre del estudiante', enviadoResumen.slice(0, 200));
  const dentro = await req('POST', '/ai/suggestions', { token: docenteDentro.token, body: { task: 'EVIDENCE_SUMMARY', projectId: proyecto.data?.id } });
  const fuera = await req('POST', '/ai/suggestions', { token: docenteFuera.token, body: { task: 'EVIDENCE_SUMMARY', projectId: proyecto.data?.id } });
  check(dentro.status === 201 && fuera.status === 403, 'IA.20 TeacherScope rige también para la IA', `${dentro.status}/${fuera.status}`);

  psql(`update projects set backing_tier='flagged', backing_reasons=ARRAY['El repositorio declarado no existe.'] where id='${proyecto.data?.id}'`);
  const explica = await req('POST', '/ai/suggestions', { token: est.token, body: { task: 'INCONSISTENCY_EXPLANATION', projectId: proyecto.data?.id } });
  const nivel = psql(`select backing_tier from projects where id='${proyecto.data?.id}'`);
  check(explica.data?.ok && explica.data?.source === 'ai' && nivel === 'flagged',
    'IA.21 §43.3 Explica la inconsistencia sin cambiar el nivel de respaldo', `${json(explica.data)} nivel=${nivel}`);

  objective('§63 · Narrativa sobre cifras deterministas');
  const narrativa = await req('POST', '/ai/suggestions', { token: director.token, body: { task: 'ANALYTICS_NARRATIVE' } });
  check(narrativa.data?.ok && !!narrativa.data?.result?.narrative && !!narrativa.data?.result?.figures,
    'IA.22 La narrativa viaja junto a las cifras de las que sale', json(narrativa.data?.result));
  proveedor.inventar = true;
  const narrativaFalsa = await req('POST', '/ai/suggestions', { token: director.token, body: { task: 'ANALYTICS_NARRATIVE' } });
  proveedor.inventar = false;
  check(narrativaFalsa.data?.ok === false, 'IA.23 §63 Una cifra que no está en los datos invalida la narrativa', json(narrativaFalsa.data));

  objective('RNF09 · Fallos del proveedor');
  proveedor.demoraMs = 2500;
  const lenta = await req('POST', '/ai/suggestions', { token: est.token, body: { task: 'CV_TEXT_ASSIST', text: original } });
  proveedor.demoraMs = 0;
  check(lenta.status === 201 && lenta.data?.ok === false && /continuar sin/i.test(lenta.data?.message ?? ''),
    'IA.24 Si el proveedor tarda más del límite, se responde sin romper nada', json(lenta.data));
  check(/1500 ms/.test(psql(`select error_message from ai_assistance_runs where id='${lenta.data?.runId}'`)),
    'IA.25 Y la ejecución fallida queda registrada con su motivo');
  proveedor.caido = true;
  const caida = await req('POST', '/ai/suggestions', { token: est.token, body: { task: 'CV_TEXT_ASSIST', text: original } });
  const runs = await req('GET', '/ai/runs?limit=200', { token: admin });
  proveedor.caido = false;
  check(caida.data?.ok === false && !JSON.stringify(caida.data).includes(CLAVE) && !JSON.stringify(runs.data).includes(CLAVE),
    'IA.26 La clave nunca aparece en respuestas ni registros, aunque el proveedor la repita', json(caida.data));

  objective('§44 · Moderación de nombres con IA como segunda barrera');
  const necesidad = async (k) => (await req('POST', '/team-needs', { token: est.token, body: { purpose: `Necesidad ${k} ${TS}`, maxMembers: 3 } })).data?.id;
  const regla2 = await req('POST', `/team-needs/${await necesidad('a')}/team`, { token: est.token, body: { name: 'Equipo mierda' } });
  check(regla2.status === 400 && regla2.data?.code === 'TEAM_NAME_FORBIDDEN', 'IA.27 Las reglas actúan primero, con o sin IA', json(regla2.data));
  const marcado = await req('POST', `/team-needs/${await necesidad('b')}/team`, { token: est.token, body: { name: 'Los Tontos del Fondo' } });
  check(marcado.status === 201 && marcado.data?.nameStatus === 'flagged' && /Aurora/.test(marcado.data?.nameFlagReason ?? ''),
    'IA.28 Lo ambiguo lo marca la IA, con motivo y sugerencia', json(marcado.data));
  const perfilOtro = (await req('GET', '/profiles/me', { token: otro.token })).data?.id;
  const invitar = await req('POST', `/teams/${marcado.data?.id}/invitations`, { token: est.token, body: { invitedProfileId: perfilOtro } });
  check(invitar.status === 409 && invitar.data?.code === 'TEAM_NAME_FLAGGED', 'IA.29 Marcado, no se comparte: no se puede invitar', json(invitar.data));
  const corregido = await req('PATCH', `/teams/${marcado.data?.id}`, { token: est.token, body: { name: 'Equipo Aurora' } });
  const invitar2 = await req('POST', `/teams/${marcado.data?.id}/invitations`, { token: est.token, body: { invitedProfileId: perfilOtro } });
  check(corregido.data?.nameStatus === 'ok' && invitar2.status === 201, 'IA.30 Corregido el nombre, ya se puede invitar', `${json(corregido.data)} ${invitar2.status}`);
  const recaida = await req('PATCH', `/teams/${marcado.data?.id}`, { token: est.token, body: { name: 'Los Tontos Otra Vez' } });
  const visibles = await req('GET', '/teams/invitations/mine', { token: otro.token });
  check(recaida.data?.nameStatus === 'flagged' && !(visibles.data ?? []).some((i) => i.team?.id === marcado.data?.id),
    'IA.31 Si vuelve a quedar marcado, la invitación deja de mostrarse', json(visibles.data));
  proveedor.caido = true;
  const sinIa = await req('POST', `/team-needs/${await necesidad('c')}/team`, { token: est.token, body: { name: 'Equipo Boreal' } });
  proveedor.caido = false;
  check(sinIa.status === 201 && sinIa.data?.nameStatus === 'ok', 'IA.32 §44 Si la IA falla, no bloquea: las reglas ya aprobaron', json(sinIa.data));
}

// ===========================================================================
async function main() {
  console.log(`${C.bold}Asistente de IA con proveedor simulado (V2 §43, §44, §84)${C.r}`);
  await new Promise((r) => servidorIa.listen(PUERTO_IA, '127.0.0.1', r));
  try {
    await levantarApi();
    await pruebas();
  } catch (e) {
    failures.push(`Error: ${e.message}`);
    console.error(e);
  } finally {
    api?.kill();
    servidorIa.close();
  }
  console.log(`\n${C.bold}${passed} comprobaciones correctas, ${failures.length} fallidas${C.r}`);
  for (const f of failures) console.log(`  ${C.bad}- ${f}${C.r}`);
  process.exit(failures.length ? 1 : 0);
}

main();
