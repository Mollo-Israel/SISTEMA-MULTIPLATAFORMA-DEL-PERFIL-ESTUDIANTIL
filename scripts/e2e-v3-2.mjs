/**
 * Cierre final V3.2 — verificación contra la API en marcha.
 *
 * Una sección por batch del cierre (PLAN_EJECUCION_CIERRE_V3_2.md). Cada
 * comprobación cita la sección de la especificación que verifica. Se ejecuta
 * con la API en modo de correo simulado (MAIL_TRANSPORT=console).
 *
 * Uso:
 *   API_URL=http://localhost:3010/api node scripts/e2e-v3-2.mjs [batch]
 */

import {
  API, codigoUniversitario, loginAdmin, provisionAndActivate, req,
} from './lib/fixtures.mjs';

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
const correoEst = (k) => `v32.${k}.${TS}@est.univalle.edu`;
const correoStaff = (k) => `v32.${k}.${TS}@univalle.edu`;
const json = (x) => JSON.stringify(x ?? null).slice(0, 220);

/** Sube un CSV (texto o bytes) a la previsualización del padrón indicado. */
async function subirCsv(token, kind, contenido, nombre = `padron-${kind}.csv`) {
  const form = new FormData();
  form.append('file', new Blob([contenido], { type: 'text/csv' }), nombre);
  const res = await fetch(`${API}/imports/${kind}/preview`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}` },
    body: form,
  });
  let data = null;
  try { data = await res.json(); } catch { /* sin cuerpo */ }
  return { status: res.status, data };
}

const fila = (preview, codigo) => (preview.data?.rows ?? []).find((r) => r.universityCode === codigo);
const CAB_EST = 'university_code,first_name,last_name,institutional_email,semester';
const CAB_DOC = 'university_code,first_name,last_name,institutional_email,authorized_semesters';

// ===========================================================================
//  BATCH 1 — Importación y usuarios (§6.1, §6.2, §7, §8.6)
// ===========================================================================
async function batch1(ctx) {
  objective('BATCH 1 · Importación parcial, historial limpio y grilla de usuarios');

  // ----- §7.3 200 existentes + 10 nuevos: se aplican los nuevos, los demás no estorban
  const todos = await req('GET', '/users?role=STUDENT', { token: ctx.admin });
  const existentes = (todos.data ?? [])
    .filter((u) => u.universityCode && u.semester && /@est\.univalle\.edu$/.test(u.email))
    .slice(0, 200);
  const nuevos = Array.from({ length: 10 }, (_, i) => ({
    codigo: codigoUniversitario(),
    correo: correoEst(`masivo${i}`),
  }));
  const lineas = [
    CAB_EST,
    ...existentes.map((u) => `${u.universityCode},${u.firstName},${u.lastName},${u.email},${u.semester}`),
    ...nuevos.map((n, i) => `${n.codigo},Nuevo,Masivo ${String.fromCharCode(65 + i)},${n.correo},2`),
  ];
  const masivo = await subirCsv(ctx.admin, 'students', lineas.join('\n'), 'masivo.csv');
  const c = masivo.data?.counts ?? {};
  check(existentes.length === 200, 'V32.1.1 Hay 200 estudiantes reales para el padrón de prueba', `${existentes.length}`);
  check(masivo.status === 201 && c.new === 10,
    'V32.1.2 §7.3 De 210 filas, exactamente las 10 nuevas son NEW', json(c));
  check((c.unchanged ?? 0) + (c.update ?? 0) + (c.conflict ?? 0) + (c.invalid ?? 0) === existentes.length,
    'V32.1.3 §7.3 Las 200 existentes se clasifican, ninguna se crea dos veces', json(c));
  const aplicado = await req('POST', `/imports/students/${masivo.data?.batchId}/apply`, { token: ctx.admin });
  const s = aplicado.data?.summary ?? {};
  check(aplicado.status === 201 && s.inserted === 10,
    'V32.1.4 §7.3 Aplicar crea las 10 cuentas nuevas', json(aplicado.data));
  check(['inserted', 'updated', 'unchanged', 'skippedConflict', 'invalid'].every((k) => typeof s[k] === 'number'),
    'V32.1.5 §7.3 El resultado trae el resumen completo (nuevas, actualizadas, sin cambios, conflicto, inválidas)', json(s));
  check(s.unchanged === (c.unchanged ?? 0) && s.skippedConflict === (c.conflict ?? 0) && s.invalid === (c.invalid ?? 0),
    'V32.1.6 §7.3 El resumen cuadra con la previsualización', `${json(s)} vs ${json(c)}`);

  // ----- §7.3 Un conflicto no bloquea a las filas nuevas
  const nuevoOk = { codigo: codigoUniversitario(), correo: correoEst('pasa') };
  const ajeno = existentes[0];
  const conConflicto = await subirCsv(ctx.admin, 'students', [
    CAB_EST,
    `${nuevoOk.codigo},Pasa,Igual,${nuevoOk.correo},3`,
    // Correo de una cuenta existente con otro código: identidad ambigua.
    `${codigoUniversitario()},Otro,Codigo,${ajeno.email},3`,
  ].join('\n'));
  check(conConflicto.data?.counts?.conflict === 1 && conConflicto.data?.counts?.new === 1,
    'V32.1.7 §7.3 Correo existente con otro código es CONFLICT; la otra fila sigue NEW', json(conConflicto.data?.counts));
  const aplicaParcial = await req('POST', `/imports/students/${conConflicto.data?.batchId}/apply`, { token: ctx.admin });
  check(aplicaParcial.status === 201 && aplicaParcial.data?.summary?.inserted === 1
      && aplicaParcial.data?.summary?.skippedConflict === 1,
    'V32.1.8 §7.3 La aplicación parcial crea la válida y omite el conflicto', json(aplicaParcial.data?.summary));
  const creada = await req('GET', `/users?search=${encodeURIComponent(nuevoOk.correo)}`, { token: ctx.admin });
  check((creada.data ?? []).length === 1, 'V32.1.9 §7.3 La cuenta válida existe después de aplicar');

  // ----- §7.6 Validación de columnas, duplicados y codificación
  const cFalta = codigoUniversitario();
  const cSobra = codigoUniversitario();
  const dupA = codigoUniversitario();
  const dupB = codigoUniversitario();
  const repetido = codigoUniversitario();
  const malo = await subirCsv(ctx.admin, 'students', [
    CAB_EST,
    `${cFalta},Falta,Columna,${correoEst('falta')}`,
    `${cSobra},Sobra,Columna,Extra,${correoEst('sobra')},4`,
    `${dupA},Dup,Uno,${correoEst('dupcorreo')},1`,
    `${dupB},Dup,Dos,${correoEst('dupcorreo')},1`,
    `${repetido},Rep,Uno,${correoEst('rep1')},1`,
    `${repetido},Rep,Dos,${correoEst('rep2')},1`,
  ].join('\n'));
  check(fila(malo, cFalta)?.status === 'invalid' && /falta/i.test(fila(malo, cFalta)?.message ?? ''),
    'V32.1.10 §7.6 Fila con una columna menos → INVALID que lo explica', json(fila(malo, cFalta)));
  check(fila(malo, cSobra)?.status === 'invalid' && /sobra/i.test(fila(malo, cSobra)?.message ?? ''),
    'V32.1.11 §7.6 Fila con una columna de más → INVALID, sin correr los valores', json(fila(malo, cSobra)));
  check(fila(malo, dupB)?.status === 'conflict',
    'V32.1.12 §7.6 Correo repetido dentro del archivo → CONFLICT', json(fila(malo, dupB)));
  const repes = (malo.data?.rows ?? []).filter((r) => r.universityCode === repetido);
  check(repes.some((r) => r.status === 'conflict'),
    'V32.1.13 §7.6 Código repetido dentro del archivo → CONFLICT', json(repes));
  await req('POST', `/imports/students/${malo.data?.batchId}/discard`, { token: ctx.admin });

  const latin1 = Buffer.concat([
    Buffer.from(`${CAB_EST}\n${codigoUniversitario()},Jos`),
    Buffer.from([0xe9]),
    Buffer.from(`,Peña,${correoEst('latin')},1\n`, 'latin1'),
  ]);
  const enc = await subirCsv(ctx.admin, 'students', latin1);
  check(enc.status === 400 && enc.data?.code === 'IMPORT_ENCODING',
    'V32.1.14 §7.6 Un CSV que no es UTF-8 se rechaza con un mensaje claro', `${enc.status} ${json(enc.data)}`);

  const docFalta = codigoUniversitario('TEACHER');
  const docMalo = await subirCsv(ctx.admin, 'teachers', `${CAB_DOC}\n${docFalta},Doc,Falta,${correoStaff('falta')}`);
  check(fila(docMalo, docFalta)?.status === 'invalid' && /falta/i.test(fila(docMalo, docFalta)?.message ?? ''),
    'V32.1.15 §7.6 El padrón de docentes también detecta la columna faltante', json(fila(docMalo, docFalta)));
  await req('POST', `/imports/teachers/${docMalo.data?.batchId}/discard`, { token: ctx.admin });

  // ----- §7.5 Historial: solo aplicado o fallido; descartar no deja rastro
  const contenido = `${CAB_EST}\n${codigoUniversitario()},Temporal,Descarte,${correoEst('descarte')},1`;
  const previa = await subirCsv(ctx.admin, 'students', contenido);
  let historial = await req('GET', '/imports/students', { token: ctx.admin });
  check(!(historial.data ?? []).some((b) => b.id === previa.data?.batchId),
    'V32.1.16 §7.5 Una previsualización no aparece en el historial', `${(historial.data ?? []).length} lotes`);
  const descartado = await req('POST', `/imports/students/${previa.data?.batchId}/discard`, { token: ctx.admin });
  const tras = await req('GET', `/imports/students/${previa.data?.batchId}`, { token: ctx.admin });
  check(descartado.status === 201 && tras.status === 404,
    'V32.1.17 §7.5 Descartar borra el lote: ya no existe', `${descartado.status} / ${tras.status}`);
  historial = await req('GET', '/imports/students', { token: ctx.admin });
  check((historial.data ?? []).length > 0 && (historial.data ?? []).every((b) => ['applied', 'failed'].includes(b.status)),
    'V32.1.18 §7.5 El historial solo contiene lotes aplicados o fallidos',
    json([...new Set((historial.data ?? []).map((b) => b.status))]));
  check((historial.data ?? []).some((b) => b.id === masivo.data?.batchId),
    'V32.1.19 §7.5 El lote aplicado sí queda en el historial');
  const otraVez = await subirCsv(ctx.admin, 'students', contenido);
  check(otraVez.status === 201 && otraVez.data?.batchId !== previa.data?.batchId && otraVez.data?.counts?.new === 1,
    'V32.1.20 §7.5 El mismo archivo se puede volver a subir después de descartarlo', json(otraVez.data?.counts));
  await req('POST', `/imports/students/${otraVez.data?.batchId}/discard`, { token: ctx.admin });
  const previos = await req('GET', `/audit/events?eventType=IMPORT_PREVIEWED&entityId=${otraVez.data?.batchId}`, { token: ctx.admin });
  check((previos.data?.items ?? previos.data ?? []).length === 0,
    'V32.1.21 §7.5 Previsualizar no genera evento de auditoría');
  const aplicadoAud = await req('GET', `/audit/events?eventType=IMPORT_APPLIED&entityId=${masivo.data?.batchId}`, { token: ctx.admin });
  check((aplicadoAud.data?.items ?? aplicadoAud.data ?? []).length === 1,
    'V32.1.22 §7.5 Aplicar sí queda auditado (IMPORT_APPLIED)', json(aplicadoAud.data).slice(0, 120));

  // ----- §8.6 / §6.2 Listado de usuarios: vencimiento de la invitación y búsqueda por código
  const pendiente = nuevos[0];
  const lista = await req('GET', `/users?search=${encodeURIComponent(pendiente.codigo)}`, { token: ctx.admin });
  const u = (lista.data ?? [])[0];
  check(u?.universityCode === pendiente.codigo,
    'V32.1.23 §6.2 El listado de usuarios busca también por código universitario', json(lista.data));
  const venceEn = u?.invitation?.expiresAt ? new Date(u.invitation.expiresAt).getTime() - Date.now() : NaN;
  check(u?.status === 'pending_activation' && venceEn > 0 && u?.invitation?.expired === false,
    'V32.1.24 §8.6 Una cuenta pendiente muestra cuándo expira su invitación', json(u?.invitation));

  // ----- Solo el administrador
  const est = await provisionAndActivate(ctx.admin, {
    firstName: 'Lia', lastName: 'Mendez', email: correoEst('ajena'), role: 'STUDENT', semester: 2,
  });
  const intruso = await req('GET', '/imports/students', { token: est.token });
  check(intruso.status === 403, 'V32.1.25 Un estudiante NO ve el historial de importaciones -> 403', `status ${intruso.status}`);
}

const BATCHES = { batch1 };

async function main() {
  console.log(`${C.bold}Afinia V3.2 — verificación del cierre final contra la API${C.r}`);
  const ctx = { admin: await loginAdmin() };
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
