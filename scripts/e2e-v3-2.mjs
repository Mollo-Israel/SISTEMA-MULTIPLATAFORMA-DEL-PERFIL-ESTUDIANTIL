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
  API, PWD, aprobarActividad, codigoUniversitario, crearProyectoBorrador, loginAdmin, provisionAndActivate, req,
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

// ===========================================================================
//  BATCH 2 — Activación (§8.2–§8.6)
// ===========================================================================
async function batch2(ctx) {
  objective('BATCH 2 · Activación: cuenta activa, espera real y vencimiento visible');

  // ----- §8.3 Cuenta ya activa: estado controlado, sin token ni correo
  const activa = await provisionAndActivate(ctx.admin, {
    firstName: 'Iris', lastName: 'Vaca', email: correoEst('activa'), role: 'STUDENT', semester: 3,
  });
  const pedido = await req('POST', '/activation/request', { body: { email: correoEst('activa') } });
  check(pedido.status === 200 && pedido.data?.status === 'ALREADY_ACTIVE',
    'V32.2.1 §8.3 Pedir activación de una cuenta ACTIVE responde ALREADY_ACTIVE', json(pedido.data));
  check(!/te enviamos/i.test(pedido.data?.message ?? '') && /inicia sesi[oó]n/i.test(pedido.data?.message ?? ''),
    'V32.2.2 §8.3 No afirma un envío y orienta a iniciar sesión o recuperar', pedido.data?.message);
  const auditados = await req('GET', `/audit/events?eventType=ACTIVATION_REQUESTED&entityId=${activa.userId}`, { token: ctx.admin });
  check((auditados.data?.items ?? auditados.data ?? []).length === 0,
    'V32.2.3 §8.3 No se registra una solicitud de activación (no hubo token ni correo)');
  const login = await req('POST', '/auth/login', { body: { email: correoEst('activa'), password: PWD } });
  check(login.status === 200, 'V32.2.4 §8.3 La cuenta activa sigue entrando con su contraseña', `status ${login.status}`);

  // ----- §8.4 La espera viene del servidor: no se reinicia al reabrir la pantalla
  const pendienteCorreo = correoEst('pendiente');
  const alta = await req('POST', '/users', {
    token: ctx.admin,
    body: {
      firstName: 'Ruth', lastName: 'Pinto', email: pendienteCorreo, role: 'STUDENT', semester: 2,
      universityCode: codigoUniversitario(),
    },
  });
  check(alta.status === 201, 'V32.2.5 Alta de una cuenta pendiente', `status ${alta.status} ${json(alta.data)}`);
  const primera = await req('POST', '/activation/request', { body: { email: pendienteCorreo } });
  await new Promise((r) => setTimeout(r, 2100));
  const segunda = await req('POST', '/activation/request', { body: { email: pendienteCorreo } });
  const e1 = Number(primera.data?.retryAfterSeconds);
  const e2 = Number(segunda.data?.retryAfterSeconds);
  check(primera.data?.status === 'REQUESTED' && e1 > 0 && e1 <= 120,
    'V32.2.6 §8.4 Una cuenta pendiente recibe la respuesta genérica con la espera', json(primera.data));
  check(e2 > 0 && e2 < e1,
    'V32.2.7 §8.4 Volver a pedir no reinicia la cuenta atrás: informa lo que realmente queda', `${e1} → ${e2}`);
  const inventado = `nadie.v32.${TS}@est.univalle.edu`;
  const i1 = await req('POST', '/activation/request', { body: { email: inventado } });
  await new Promise((r) => setTimeout(r, 2100));
  const i2 = await req('POST', '/activation/request', { body: { email: inventado } });
  check(i1.data?.status === 'REQUESTED' && i1.data?.message === primera.data?.message,
    'V32.2.8 §12 Un correo inexistente recibe la misma respuesta que uno pendiente', json(i1.data));
  check(Number(i2.data?.retryAfterSeconds) < Number(i1.data?.retryAfterSeconds),
    'V32.2.9 §8.4 La espera también corre para correos inexistentes (no delata cuentas)',
    `${i1.data?.retryAfterSeconds} → ${i2.data?.retryAfterSeconds}`);

  // ----- §8.6 Administración: enviada, expira y estado
  const lista = await req('GET', `/users?search=${encodeURIComponent(pendienteCorreo)}`, { token: ctx.admin });
  const u = (lista.data ?? [])[0];
  const horas = u?.invitation?.expiresAt ? (new Date(u.invitation.expiresAt).getTime() - Date.now()) / 3_600_000 : NaN;
  check(u?.invitation?.at && horas > 47 && horas <= 48 && u?.invitation?.expired === false,
    'V32.2.10 §8.6 El administrador ve cuándo se envió y que expira en 48 h', json(u?.invitation));

  // ----- §8.1 Lo que ya funcionaba, sigue
  const suspendida = await provisionAndActivate(ctx.admin, {
    firstName: 'Olga', lastName: 'Sosa', email: correoEst('suspendida'), role: 'STUDENT', semester: 1,
  });
  await req('PATCH', `/users/${suspendida.userId}/status`, { token: ctx.admin, body: { status: 'suspended' } });
  const pideSusp = await req('POST', '/activation/request', { body: { email: correoEst('suspendida') } });
  check(pideSusp.status === 200 && pideSusp.data?.status === 'REQUESTED',
    'V32.2.11 §8.1 Una cuenta suspendida no se delata ni se reactiva por esta vía', json(pideSusp.data));
  const reset = await req('POST', '/activation/forgot-password', { body: { email: correoEst('activa') } });
  check(reset.status === 200 && reset.data?.status === 'REQUESTED' && Number(reset.data?.retryAfterSeconds) > 0,
    'V32.2.12 §8.4 Recuperar contraseña sigue con respuesta genérica y espera real', json(reset.data));
}

// ===========================================================================
//  BATCH 3 — Taxonomía: sugeridor, áreas secundarias y tags semánticos (§10–§12)
// ===========================================================================
async function batch3(ctx) {
  objective('BATCH 3 · Taxonomía: aws ya no va a Redes, skills multiárea y tags semánticos');
  const L = String.fromCharCode(...String(TS).slice(-7).split('').map((d) => 65 + Number(d)));
  const areas = (await req('GET', '/academic-areas', { token: ctx.admin })).data ?? [];
  const porCodigo = (c) => areas.find((a) => a.code === c);
  const nube = porCodigo('computacion_en_la_nube');
  const redes = porCodigo('redes');
  const web = porCodigo('desarrollo_web');
  const ciber = porCodigo('ciberseguridad');
  const ia = porCodigo('inteligencia_artificial');
  const bd = porCodigo('bases_de_datos');

  // ----- §10.1 / §10.3 Catálogo semántico
  check(!!nube && (nube.tags ?? []).includes('nube'),
    'V32.3.1 §10.1 Existe el área «Computación en la nube» con vocabulario propio', json(nube));
  check(!!redes && !(redes.tags ?? []).some((t) => ['infraestructura', 'linux', 'routing', 'tcp-ip'].includes(t)),
    'V32.3.2 §10.3 Las etiquetas de Redes ya no copian habilidades ni la palabra que confundía al sugeridor', json(redes?.tags));
  const skills = (await req('GET', '/skills', { token: ctx.admin })).data ?? [];
  const aws = skills.find((s) => s.code === 'aws');
  const linux = skills.find((s) => s.code === 'administracion_linux');
  check(aws?.academicAreaId === nube?.id && (aws?.aliases ?? []).includes('Amazon Web Services'),
    'V32.3.3 §10.2 AWS es una habilidad de Computación en la nube, con su alias', json(aws));
  check((linux?.aliases ?? []).includes('Linux') && (linux?.secondaryAreaIds ?? []).includes(ciber?.id)
      && (linux?.secondaryAreaIds ?? []).includes(nube?.id),
    'V32.3.4 §11.1 Linux: principal Redes, secundarias Ciberseguridad y Nube', json(linux));

  // ----- §10.5 Sugeridor
  const c = async (name, aliases = '') =>
    (await req('GET', `/skills/classify?name=${encodeURIComponent(name)}&aliases=${encodeURIComponent(aliases)}`, { token: ctx.admin })).data;
  const bug = await c(`Servicio ${L}`, 'aws');
  check(bug?.rule === 'exact_skill' && bug?.areaIds?.includes(nube?.id) && !bug?.areaIds?.includes(redes?.id),
    'V32.3.5 §10.5 El bug: alias «aws» sugiere Computación en la nube, no Redes', json(bug));
  const alias = await c('Amazon Web Services');
  check(alias?.rule === 'exact_skill' && alias?.areaIds?.[0] === nube?.id,
    'V32.3.6 §10.5 Prioridad 1: el alias exacto de una habilidad existente', json(alias));
  const etiqueta = await c(`Persistencia ${L}`);
  check(etiqueta?.rule === 'area_tag' && etiqueta?.areaIds?.includes(bd?.id),
    'V32.3.7 §10.5 Prioridad 2: la etiqueta exacta del área (palabra completa)', json(etiqueta));
  const relacionada = await c(`React ${L}`);
  check(relacionada?.rule === 'related_skill' && relacionada?.areaIds?.includes(web?.id),
    'V32.3.8 §10.5 Prioridad 3: la relación con una habilidad ya clasificada', json(relacionada));
  const corta = await c('AS');
  const subcadena = await c(`Rawsome${L}`);
  check(corta?.rule === 'none' && subcadena?.rule === 'none',
    'V32.3.9 §10.5 Sin subcadena bruta: «AS» y una palabra que contiene «aws» no sugieren nada', `${corta?.rule} / ${subcadena?.rule}`);

  // ----- §10.5 / §10.6 Guardar: el administrador decide
  const enOtra = await req('POST', '/skills', {
    token: ctx.admin, body: { name: `Kitnet ${L}`, academicAreaId: web.id },
  });
  check(enOtra.status === 201, 'V32.3.10 §10.6 Sin sugerencia fuerte se guarda donde el administrador diga', `status ${enOtra.status}`);
  const duplicado = await req('POST', '/skills', {
    token: ctx.admin, body: { name: 'Postgres', academicAreaId: bd.id },
  });
  check(duplicado.status === 409 && duplicado.data?.fields?.name,
    'V32.3.11 §10.4 Un nombre que ya es alias de otra habilidad es la misma: no se crea dos veces', json(duplicado.data?.fields));

  // ----- §11 Áreas secundarias
  const multi = await req('POST', '/skills', {
    token: ctx.admin,
    body: { name: `Pyconsola ${L}`, academicAreaId: ia.id, secondaryAreaIds: [web.id, web.id, ia.id] },
  });
  check(multi.status === 201 && json(multi.data?.secondaryAreaIds) === json([web.id]),
    'V32.3.12 §11.2 Se guardan las secundarias sin repetir ni incluir la principal', json(multi.data?.secondaryAreaIds));
  const listada = ((await req('GET', '/skills', { token: ctx.admin })).data ?? []).find((s) => s.id === multi.data?.id);
  check(json(listada?.secondaryAreaIds) === json([web.id]), 'V32.3.13 §11 El catálogo devuelve las áreas secundarias', json(listada));
  const cambio = await req('PATCH', `/skills/${multi.data?.id}`, { token: ctx.admin, body: { secondaryAreaIds: [ciber.id] } });
  check(cambio.status === 200 && json(cambio.data?.secondaryAreaIds) === json([ciber.id]),
    'V32.3.14 §11 Editar reemplaza las áreas secundarias', json(cambio.data?.secondaryAreaIds));
  const inexistente = await req('PATCH', `/skills/${multi.data?.id}`, {
    token: ctx.admin, body: { secondaryAreaIds: ['00000000-0000-4000-8000-000000000000'] },
  });
  check(inexistente.status === 409 && inexistente.data?.fields?.secondaryAreaIds,
    'V32.3.15 §11 Un área secundaria que no existe se rechaza en su campo', `status ${inexistente.status}`);
  const deRelacionada = await c(`Pyconsola ${L} Pro`);
  check(json(deRelacionada?.areaIds) === json([ia.id]),
    'V32.3.16 §11.5 La sugerencia usa la principal de la relacionada; la secundaria no reparte', json(deRelacionada));

  // ----- §10.6 Etiquetas que repiten una habilidad
  const analisis = await req('POST', '/academic-areas/tag-analysis', { token: ctx.admin, body: { tags: ['persistencia', 'postgresql'] } });
  check((analisis.data?.skillDuplicates ?? []).some((d) => d.tag === 'postgresql' && d.skill === 'PostgreSQL'),
    'V32.3.17 §10.6 Avisa que la etiqueta «postgresql» ya es una habilidad', json(analisis.data?.skillDuplicates));

  // ----- §11.3 En un formulario, la habilidad vale por su área secundaria
  const est = await provisionAndActivate(ctx.admin, {
    firstName: 'Lina', lastName: 'Rocha', email: correoEst('taxo'), role: 'STUDENT', semester: 4,
  });
  const porSecundaria = await crearProyectoBorrador(est.token, {
    title: `Servidor seguro ${L}`, description: 'Endurecimiento de un servidor Linux.', areaIds: [ciber.id], skillIds: [linux.id],
  });
  check(porSecundaria.status === 201,
    'V32.3.19 §11.3 Linux se acepta en un proyecto de Ciberseguridad (su área secundaria)', `status ${porSecundaria.status} ${json(porSecundaria.data)}`);
  const ajenaArea = await crearProyectoBorrador(est.token, {
    title: `Sitio ${L}`, description: 'Una web.', areaIds: [web.id], skillIds: [linux.id],
  });
  check(ajenaArea.status === 400 && ajenaArea.data?.fields?.skillIds,
    'V32.3.20 §11.3 Pero no en un área que no es ni su principal ni una secundaria', `status ${ajenaArea.status}`);

  // ----- Solo Administración
  const docente = await provisionAndActivate(ctx.admin, {
    firstName: 'Teo', lastName: 'Arce', email: correoStaff('taxo'), role: 'TEACHER',
  });
  const ajeno = await req('POST', '/skills', { token: docente.token, body: { name: `Ajena ${L}`, academicAreaId: web.id } });
  check(ajeno.status === 403, 'V32.3.18 Un docente no crea habilidades -> 403', `status ${ajeno.status}`);
}

// ===========================================================================
//  BATCH 4 — Actividad multiárea transaccional y contexto área+skill (C6, C7, §11.4)
// ===========================================================================
async function batch4(ctx) {
  objective('BATCH 4 · Actividad multiárea: edición transaccional y contexto área + habilidad');
  const areas = (await req('GET', '/academic-areas', { token: ctx.admin })).data ?? [];
  const area = (c) => areas.find((a) => a.code === c);
  const ia = area('inteligencia_artificial');
  const web = area('desarrollo_web');
  const redes = area('redes');
  const bd = area('bases_de_datos');
  const skills = (await req('GET', '/skills', { token: ctx.admin })).data ?? [];
  const skill = (c) => skills.find((s) => s.code === c);
  const python = skill('python');
  const react = skill('react');
  const sql = skill('sql');
  const tcp = skill('tcp_ip');
  const director = await provisionAndActivate(ctx.admin, {
    firstName: 'Rene', lastName: 'Salinas', email: correoStaff('b4dir'), role: 'CAREER_DIRECTOR',
  });
  const cats = (await req('GET', '/activity-categories', { token: director.token })).data ?? [];
  const taller = cats.find((c) => c.code === 'taller_academico') ?? cats[0];
  const base = { type: 'academica', categoryId: taller.id, semesterScope: [1, 2] };
  const contextoDe = (a, skillId) => (a?.activitySkills ?? []).find((s) => s.skillId === skillId)?.academicAreaId;

  // ----- C6 / C7 Editar con varias áreas ya no rompe, y todo se guarda
  const creada = await req('POST', '/activities', {
    token: director.token,
    body: { ...base, title: `Taller multiárea ${TS}`, areaIds: [web.id], skillIds: [react.id] },
  });
  check(creada.status === 201, 'V32.4.1 Se crea una actividad con un área y una habilidad', `status ${creada.status} ${json(creada.data)}`);
  const id = creada.data?.id;
  const editada = await req('PATCH', `/activities/${id}`, {
    token: director.token,
    body: { title: `Taller multiárea editado ${TS}`, areaIds: [ia.id, web.id, bd.id], skillIds: [python.id, react.id, sql.id] },
  });
  check(editada.status === 200, 'V32.4.2 C6 Editar con 3 áreas ya no devuelve 500', `status ${editada.status} ${json(editada.data)}`);
  check((editada.data?.activityAreas ?? []).length === 3 && editada.data?.academicAreaId === ia.id,
    'V32.4.3 C6 Las 3 áreas quedan guardadas y la primera es la principal', json(editada.data?.activityAreas?.map((a) => a.academicAreaId)));
  const leida = (await req('GET', `/activities/${id}`, { token: director.token })).data;
  check((leida?.activitySkills ?? []).length === 3 && leida?.title === `Taller multiárea editado ${TS}`,
    'V32.4.4 C7 Las 3 habilidades persisten al editar (y el resto de cambios también)', json(leida?.activitySkills?.map((s) => s.skillId)));
  const huerfana = await req('PATCH', `/activities/${id}`, { token: director.token, body: { areaIds: [web.id, ia.id] } });
  check(huerfana.status === 400 && huerfana.data?.fields?.skillIds,
    'V32.4.5a §4 Quitar un área que todavía tiene habilidades elegidas se rechaza en su campo', json(huerfana.data?.fields));
  const otraVez = await req('PATCH', `/activities/${id}`, {
    token: director.token, body: { areaIds: [web.id, ia.id], skillIds: [python.id, react.id] },
  });
  check(otraVez.status === 200 && (otraVez.data?.activityAreas ?? []).length === 2 && otraVez.data?.academicAreaId === web.id
      && (otraVez.data?.activitySkills ?? []).length === 2,
    'V32.4.5 C6 Quitar un área (con sus habilidades) vuelve a funcionar', json({ s: otraVez.status, sk: otraVez.data?.activitySkills?.length }));

  // ----- Atomicidad: si algo falla, no queda nada a medias
  const antes = (await req('GET', `/activities/${id}`, { token: director.token })).data;
  const fallida = await req('PATCH', `/activities/${id}`, {
    token: director.token, body: { title: `No debe quedar ${TS}`, areaIds: [redes.id], skillIds: [python.id] },
  });
  const despues = (await req('GET', `/activities/${id}`, { token: director.token })).data;
  check(fallida.status === 400 && despues?.title === antes?.title
      && json((despues?.activityAreas ?? []).map((a) => a.academicAreaId).sort()) === json((antes?.activityAreas ?? []).map((a) => a.academicAreaId).sort()),
    'V32.4.6 Una edición inválida no cambia nada: ni el título ni las áreas', json({ s: fallida.status, t: despues?.title }));

  // ----- §11.4 Contexto área + habilidad
  check(contextoDe(otraVez.data, python.id) === ia.id,
    'V32.4.7 §11.4 Sin indicar contexto, Python se trabaja en su área principal (IA)', json(otraVez.data?.activitySkills));
  const enWeb = await req('PATCH', `/activities/${id}`, {
    token: director.token, body: { skillContexts: [{ skillId: python.id, areaId: web.id }] },
  });
  check(enWeb.status === 200 && contextoDe(enWeb.data, python.id) === web.id,
    'V32.4.8 §11.4 Se puede indicar que Python se trabaja en Desarrollo Web (su secundaria)', json(enWeb.data?.activitySkills));
  const sigue = await req('PATCH', `/activities/${id}`, { token: director.token, body: { title: `Taller con contexto ${TS}` } });
  check(contextoDe(sigue.data, python.id) === web.id,
    'V32.4.9 §11.4 El contexto se conserva al editar otra cosa', json(sigue.data?.activitySkills));
  const malo = await req('PATCH', `/activities/${id}`, {
    token: director.token, body: { areaIds: [web.id, ia.id, redes.id], skillContexts: [{ skillId: python.id, areaId: redes.id }] },
  });
  check(malo.status === 400 && malo.data?.fields?.skillContexts,
    'V32.4.10 §11.4 Un contexto en un área a la que la habilidad no pertenece → 400 en su campo', json(malo.data?.fields));
  const sinWeb = await req('PATCH', `/activities/${id}`, { token: director.token, body: { areaIds: [ia.id], skillIds: [python.id] } });
  check(sinWeb.status === 200 && contextoDe(sinWeb.data, python.id) === ia.id,
    'V32.4.11 §11.4 Si se quita el área del contexto, la habilidad vuelve a su área principal', json(sinWeb.data?.activitySkills));
  const nueva = await req('POST', '/activities', {
    token: director.token,
    body: {
      ...base, title: `Taller de redes ${TS}`, areaIds: [redes.id, ia.id], skillIds: [tcp.id, python.id],
      skillContexts: [{ skillId: python.id, areaId: ia.id }],
    },
  });
  check(nueva.status === 201 && contextoDe(nueva.data, tcp.id) === redes.id && contextoDe(nueva.data, python.id) === ia.id,
    'V32.4.12 §11.4 Al crear, cada habilidad guarda el área en que se trabaja', json(nueva.data?.activitySkills));
  const otraCategoria = cats.find((c) => c.id !== taller.id && c.isActive !== false && [null, undefined, 'academica'].includes(c.appliesTo));
  if (otraCategoria) {
    const recategorizada = await req('PATCH', `/activities/${nueva.data?.id}`, { token: director.token, body: { categoryId: otraCategoria.id } });
    const releida = (await req('GET', `/activities/${nueva.data?.id}`, { token: director.token })).data;
    check(recategorizada.status === 200 && releida?.categoryId === otraCategoria.id,
      'V32.4.13 Cambiar la categoría persiste (la relación cargada ya no pisa el cambio)', json({ s: recategorizada.status, c: releida?.categoryId }));
  }
}

// ===========================================================================
//  BATCH 5 — Formulario, responsables, modalidad, estados y resultado (§16–§22, §28, §29, §38)
// ===========================================================================
const PNG_1X1 = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==',
  'base64',
);

async function subirArchivo(token, bytes, nombre, tipo) {
  const form = new FormData();
  form.append('file', new Blob([bytes], { type: tipo }), nombre);
  const res = await fetch(`${API}/uploads`, { method: 'POST', headers: { Authorization: `Bearer ${token}` }, body: form });
  let data = null;
  try { data = await res.json(); } catch { /* sin cuerpo */ }
  return { status: res.status, data };
}

async function batch5(ctx) {
  objective('BATCH 5 · Formulario completo, responsables y contactos, modalidad, cancelación y ciclo de vida');
  const areas = (await req('GET', '/academic-areas', { token: ctx.admin })).data ?? [];
  const web = areas.find((a) => a.code === 'desarrollo_web');
  const skills = (await req('GET', '/skills', { token: ctx.admin })).data ?? [];
  const react = skills.find((s) => s.code === 'react');
  const director = await provisionAndActivate(ctx.admin, { firstName: 'Mara', lastName: 'Quispe', email: correoStaff('b5dir'), role: 'CAREER_DIRECTOR' });
  const docente = await provisionAndActivate(ctx.admin, { firstName: 'Ivo', lastName: 'Mendez', email: correoStaff('b5doc'), role: 'TEACHER' });
  await req('PUT', `/users/${docente.userId}/semesters`, { token: ctx.admin, body: { semesters: [3] } });
  const sociedad = await provisionAndActivate(ctx.admin, { firstName: 'Sara', lastName: 'Rios', email: correoEst('b5soc'), role: 'SCIENTIFIC_SOCIETY', semester: 5 });
  const enAlcance = await provisionAndActivate(ctx.admin, { firstName: 'Luz', lastName: 'Paz', email: correoEst('b5in'), role: 'STUDENT', semester: 3 });
  const fuera = await provisionAndActivate(ctx.admin, { firstName: 'Ana', lastName: 'Vera', email: correoEst('b5out'), role: 'STUDENT', semester: 7 });
  await req('POST', '/profiles/me', { token: enAlcance.token, body: {} });
  await req('POST', '/profiles/me', { token: fuera.token, body: {} });
  const cats = (await req('GET', '/activity-categories', { token: director.token })).data ?? [];
  const taller = cats.find((c) => c.code === 'taller_academico') ?? cats[0];
  const en = (h) => new Date(Date.now() + h * 3_600_000).toISOString();
  const completa = {
    type: 'academica', categoryId: taller.id, semesterScope: [3], areaIds: [web.id], skillIds: [react.id],
    activityDate: en(48), endAt: en(50), modality: 'presencial', location: 'Aula 12',
  };

  // ----- §6.4 Validaciones por campo
  const simbolos = await req('POST', '/activities', { token: director.token, body: { ...completa, title: '### !!! ###' } });
  check(simbolos.status === 400 && simbolos.data?.fields?.title,
    'V32.5.1 §6.4 Un título solo de símbolos se rechaza en su campo', json(simbolos.data?.fields));
  const alReves = await req('POST', '/activities', { token: director.token, body: { ...completa, title: `Fechas ${TS}`, endAt: en(47) } });
  check(alReves.status === 400 && /posterior/.test(json(alReves.data?.fields?.endAt)),
    'V32.5.2 §38 La fecha final debe ser posterior a la inicial (error en endAt)', json(alReves.data?.fields));

  // ----- §21.1 Borrador incompleto sí; publicar incompleto no
  const borrador = await req('POST', '/activities', {
    token: director.token,
    body: { __sinCompletar: true, title: `Idea suelta ${TS}`, type: 'academica', categoryId: taller.id },
  });
  check(borrador.status === 201 && borrador.data?.status === 'draft', 'V32.5.3 §21.1 Un borrador puede quedar incompleto', `status ${borrador.status}`);
  const publicar = await req('PATCH', `/activities/${borrador.data?.id}`, { token: director.token, body: { status: 'open' } });
  const faltan = Object.keys(publicar.data?.fields ?? {}).sort();
  check(publicar.status === 400 && ['activityDate', 'areaIds', 'endAt', 'location', 'skillIds'].every((c) => faltan.includes(c)),
    'V32.5.4 §18–§19 Publicarlo incompleto se rechaza, campo por campo', json(faltan));

  // ----- §18.1 Modalidad
  const virtualSin = await req('POST', '/activities', {
    token: director.token, body: { ...completa, __sinCompletar: true, title: `Virtual ${TS}`, modality: 'virtual', location: 'Aula 9', status: 'open' },
  });
  check(virtualSin.status === 400 && virtualSin.data?.fields?.meetingUrl,
    'V32.5.5 §18.1 Virtual exige el enlace de la reunión', json(virtualSin.data?.fields));
  const virtual = await req('POST', '/activities', {
    token: director.token,
    body: { ...completa, title: `Virtual ${TS}`, modality: 'virtual', location: 'Aula 9', meetingUrl: 'https://meet.google.com/abc-defg-hij', status: 'open' },
  });
  check(virtual.status === 201 && virtual.data?.location === null && virtual.data?.meetingUrl,
    'V32.5.6 §18.1 Virtual guarda el enlace y oculta el aula', json({ l: virtual.data?.location, m: virtual.data?.meetingUrl }));
  const hibridaSin = await req('POST', '/activities', {
    token: director.token, body: { ...completa, __sinCompletar: true, title: `Hibrida ${TS}`, modality: 'hibrida', status: 'open' },
  });
  check(hibridaSin.status === 400 && hibridaSin.data?.fields?.meetingUrl && !hibridaSin.data?.fields?.location,
    'V32.5.7 §18.1 Híbrida pide aula y enlace', json(hibridaSin.data?.fields));
  const presencial = await req('POST', '/activities', {
    token: director.token, body: { ...completa, title: `Presencial ${TS}`, meetingUrl: 'https://meet.google.com/x', status: 'open' },
  });
  check(presencial.status === 201 && presencial.data?.meetingUrl === null,
    'V32.5.8 §18.1 Presencial no guarda enlace de reunión', json(presencial.data?.meetingUrl));

  // ----- §18.2 Enlaces de apoyo
  const enlaces = await req('PATCH', `/activities/${presencial.data?.id}`, {
    token: director.token,
    body: { resourceLinks: [{ label: 'Guía', url: 'https://univalle.edu/guia.pdf' }, { label: 'Sitio', url: 'https://evento.univalle.edu' }] },
  });
  check(enlaces.status === 200 && (enlaces.data?.resourceLinks ?? []).length === 2,
    'V32.5.9 §18.2 Se guardan varios enlaces de apoyo', json(enlaces.data?.resourceLinks));
  const http = await req('PATCH', `/activities/${presencial.data?.id}`, {
    token: director.token, body: { resourceLinks: [{ label: 'Inseguro', url: 'http://sitio.com' }] },
  });
  check(http.status === 400, 'V32.5.10 §18.2 Un enlace que no es https se rechaza', `status ${http.status}`);

  // ----- §20 Palabras de búsqueda derivadas
  const kw = presencial.data?.searchKeywords ?? [];
  check(kw.includes('desarrollo web') && kw.includes('react') && kw.includes('reactjs'),
    'V32.5.11 §20 Las palabras de búsqueda salen de áreas, habilidades y alias (sin escribirlas)', json(kw));

  // ----- §16–§17 Responsables y contactos
  const conResp = await req('POST', '/activities', {
    token: director.token,
    body: { ...completa, title: `Con responsables ${TS}`, responsibleUserIds: [docente.userId, director.userId], status: 'open' },
  });
  check(conResp.status === 201 && conResp.data?.responsibleUserId === docente.userId
      && json((conResp.data?.responsibles ?? []).map((p) => p.id)) === json([docente.userId, director.userId])
      && conResp.data?.creatorId === director.userId,
    'V32.5.12 §16 Creador, responsables (1..N) y principal quedan separados', json(conResp.data?.responsibles));
  const gestiona = await req('PATCH', `/activities/${conResp.data?.id}`, { token: docente.token, body: { location: 'Aula 13' } });
  check(gestiona.status === 200, 'V32.5.13 §16 Un responsable gestiona la actividad aunque no la creó', `status ${gestiona.status}`);
  const docOtros = await req('POST', '/activities', {
    token: docente.token, body: { ...completa, title: `Del docente ${TS}`, responsibleUserIds: [director.userId] },
  });
  check(docOtros.status === 400 && docOtros.data?.fields?.responsibleUserIds,
    'V32.5.14 §17 El docente es el responsable de lo suyo: no nombra a otros', json(docOtros.data?.fields));
  const conContacto = await req('POST', '/activities', {
    token: docente.token, body: { ...completa, title: `Con contacto ${TS}`, contactUserIds: [enAlcance.userId] },
  });
  check(conContacto.status === 201 && (conContacto.data?.contacts ?? [])[0]?.id === enAlcance.userId,
    'V32.5.15 §16 El docente suma como contacto a un estudiante de su alcance', json(conContacto.data?.contacts));
  const contactoFuera = await req('POST', '/activities', {
    token: docente.token, body: { ...completa, title: `Contacto fuera ${TS}`, contactUserIds: [fuera.userId] },
  });
  check(contactoFuera.status === 400 && contactoFuera.data?.fields?.contactUserIds,
    'V32.5.16 §16 Un estudiante fuera de su alcance no puede ser contacto', json(contactoFuera.data?.fields));
  const contactoDir = await req('POST', '/activities', {
    token: director.token, body: { ...completa, title: `Contacto dir ${TS}`, contactUserIds: [enAlcance.userId] },
  });
  check(contactoDir.status === 400, 'V32.5.17 §16 Solo un docente asigna a un estudiante como contacto', `status ${contactoDir.status}`);
  const estudianteEdita = await req('PATCH', `/activities/${conContacto.data?.id}`, { token: enAlcance.token, body: { title: `Tomada ${TS}` } });
  check(estudianteEdita.status === 403, 'V32.5.18 §16 El estudiante contacto no gestiona nada -> 403', `status ${estudianteEdita.status}`);
  const candidatos = await req('GET', `/activities/people?kind=contact&type=academica&q=${encodeURIComponent(correoEst('b5out'))}`, { token: docente.token });
  const candidatosIn = await req('GET', `/activities/people?kind=contact&type=academica&q=${encodeURIComponent(correoEst('b5in'))}`, { token: docente.token });
  check(!(candidatos.data ?? []).some((p) => p.id === fuera.userId) && (candidatosIn.data ?? []).some((p) => p.id === enAlcance.userId),
    'V32.5.19 §6.3 El buscador de contactos solo ofrece estudiantes del alcance del docente', json(candidatos.data?.length));
  const socResp = await req('GET', '/activities/people?kind=responsible&type=extracurricular', { token: sociedad.token });
  check((socResp.data ?? []).every((p) => p.role === 'SCIENTIFIC_SOCIETY'),
    'V32.5.20 §17 La Sociedad solo puede nombrar responsables de la Sociedad', json((socResp.data ?? []).map((p) => p.role)));
  const pideEst = await req('GET', '/activities/people', { token: enAlcance.token });
  check(pideEst.status === 403, 'V32.5.21 Un estudiante no consulta candidatos -> 403', `status ${pideEst.status}`);

  // ----- §28–§29 Resultado
  const participacion = await req('POST', '/activities', { token: director.token, body: { ...completa, title: `Solo participación ${TS}`, outcomePolicy: 'participation_only' } });
  const certificado = await req('POST', '/activities', { token: director.token, body: { ...completa, title: `Certificado ${TS}`, outcomePolicy: 'institution_issued_certificate' } });
  check(participacion.data?.outcomePolicy === 'participation_only' && certificado.data?.outcomePolicy === 'institution_issued_certificate',
    'V32.5.22 §28 Se ofrecen PARTICIPATION_ONLY e INSTITUTION_ISSUED_CERTIFICATE', json([participacion.data?.outcomePolicy, certificado.data?.outcomePolicy]));
  const vieja = await req('POST', '/activities', { token: director.token, body: { ...completa, title: `Vieja ${TS}`, outcomePolicy: 'other_authorized_resource' } });
  check(vieja.status === 400 && vieja.data?.fields?.outcomePolicy, 'V32.5.23 §28 La opción histórica ya no se ofrece', `status ${vieja.status}`);
  const externa = await req('POST', '/activities', {
    token: director.token,
    body: {
      ...completa, title: `Curso externo ${TS}`, originType: 'external', outcomePolicy: 'none',
      provider: 'Cisco Networking Academy', externalUrl: 'https://www.netacad.com/courses/ccna',
    },
  });
  check(externa.status === 201 && externa.data?.outcomePolicy === 'external_credential_expected',
    'V32.5.24 §29 Una externa no elige resultado: siempre espera la credencial del proveedor', json(externa.data?.outcomePolicy));

  // ----- §18.3 Imagen
  const png = await subirArchivo(director.token, PNG_1X1, 'portada.png', 'image/png');
  const conImagen = await req('PATCH', `/activities/${presencial.data?.id}`, { token: director.token, body: { imageFileId: png.data?.id } });
  check(conImagen.status === 200 && /\/api\/files\//.test(conImagen.data?.imageUrl ?? ''),
    'V32.5.25 §18.3 Una imagen subida queda como ilustración de la actividad', json(conImagen.data?.imageUrl));
  const vista = await fetch(`${API.replace(/\/api$/, '')}${conImagen.data?.imageUrl}`, { headers: { Authorization: `Bearer ${enAlcance.token}` } });
  check(vista.status === 200, 'V32.5.26 §18.3 Publicada, un estudiante puede ver su imagen', `status ${vista.status}`);
  const ajena = await subirArchivo(docente.token, PNG_1X1, 'ajena.png', 'image/png');
  const conAjena = await req('PATCH', `/activities/${presencial.data?.id}`, { token: director.token, body: { imageFileId: ajena.data?.id } });
  check(conAjena.status === 400 && conAjena.data?.fields?.imageFileId, 'V32.5.27 §18.3 No se usa como imagen un archivo de otra persona', `status ${conAjena.status}`);

  // ----- §21.6 Cancelar con motivo
  const sinMotivo = await fetch(`${API}/activities/${virtual.data?.id}`, {
    method: 'PATCH', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${director.token}` },
    body: JSON.stringify({ status: 'cancelled' }),
  });
  const sinMotivoData = await sinMotivo.json().catch(() => null);
  check(sinMotivo.status === 400 && sinMotivoData?.fields?.cancellationReason,
    'V32.5.28 §21.6 Cancelar sin motivo se rechaza', `status ${sinMotivo.status}`);
  const cancelada = await req('PATCH', `/activities/${virtual.data?.id}`, {
    token: director.token, body: { status: 'cancelled', cancellationReason: 'El expositor no puede asistir; se reprogramará.' },
  });
  const vistaEst = await req('GET', `/activities/${virtual.data?.id}`, { token: enAlcance.token });
  check(cancelada.status === 200 && vistaEst.data?.cancellationReason === 'El expositor no puede asistir; se reprogramará.',
    'V32.5.29 §21.6 / §37 El estudiante ve el motivo de la cancelación', json(vistaEst.data?.cancellationReason));
  const auditCancel = await req('GET', `/audit/events?eventType=ACTIVITY_STATUS_CHANGED&entityId=${virtual.data?.id}`, { token: ctx.admin });
  check((auditCancel.data?.items ?? auditCancel.data ?? []).some((e) => e.metadata?.motivo),
    'V32.5.30 §21.6 La cancelación queda auditada con su motivo');

  // ----- §38 La API conserva el instante exacto
  const instante = '2026-11-20T20:45:00.000Z';
  const conHora = await req('POST', '/activities', { token: director.token, body: { ...completa, title: `Hora ${TS}`, activityDate: instante, endAt: '2026-11-20T22:45:00.000Z' } });
  const releida = await req('PATCH', `/activities/${conHora.data?.id}`, { token: director.token, body: { location: 'Aula 20' } });
  check(new Date(releida.data?.eventDate).toISOString() === instante,
    'V32.5.31 §38 (C11) Editar no corre la hora: se conserva el instante', json(releida.data?.eventDate));

  // ----- §21.4–§21.5 Cierre y fin automáticos
  const empezada = await req('POST', '/activities', {
    token: director.token, body: { ...completa, title: `Empezada ${TS}`, activityDate: en(-1), endAt: en(5), status: 'open' },
  });
  const terminando = await req('POST', '/activities', {
    token: director.token, body: { ...completa, title: `Terminando ${TS}`, activityDate: en(-2), endAt: new Date(Date.now() + 3000).toISOString(), status: 'open' },
  });
  let e1 = null;
  let e2 = null;
  for (let i = 0; i < 40; i++) {
    await new Promise((r) => setTimeout(r, 2000));
    e1 = (await req('GET', `/activities/${empezada.data?.id}`, { token: director.token })).data?.status;
    e2 = (await req('GET', `/activities/${terminando.data?.id}`, { token: director.token })).data?.status;
    if (e1 === 'closed' && e2 === 'finished') break;
  }
  check(e1 === 'closed', 'V32.5.32 §21.4 Lo que ya empezó cierra sus inscripciones solo (CLOSED)', `estado ${e1}`);
  check(e2 === 'finished', 'V32.5.33 §21.5 Lo que ya terminó queda FINISHED solo', `estado ${e2}`);
  const tarde = await req('POST', `/activities/${empezada.data?.id}/register`, { token: enAlcance.token });
  check(tarde.status === 400, 'V32.5.34 §21.4 Cerrada, no acepta inscripciones', `status ${tarde.status}`);
}

// ===========================================================================
//  BATCH 6 — Borradores privados, cancelar envío, aprobada inmutable, avisos (C8, C9, C10, §23–§26, §47)
// ===========================================================================
async function batch6(ctx) {
  objective('BATCH 6 · Revisión y propiedad: borradores privados, cancelar envío y aprobada sin cambios del creador');
  const mk = (n, a, rol, extra = {}) => provisionAndActivate(ctx.admin, { firstName: n, lastName: a, email: correoStaff(`b6${n.toLowerCase()}`), role: rol, ...extra });
  const docA = await mk('Abel', 'Torrez', 'TEACHER');
  const docB = await mk('Beto', 'Ugarte', 'TEACHER');
  for (const d of [docA, docB]) await req('PUT', `/users/${d.userId}/semesters`, { token: ctx.admin, body: { semesters: [4] } });
  const director = await mk('Delia', 'Vaca', 'CAREER_DIRECTOR');
  const socA = await provisionAndActivate(ctx.admin, { firstName: 'Sofi', lastName: 'Arce', email: correoEst('b6socA'), role: 'SCIENTIFIC_SOCIETY', semester: 6 });
  const socB = await provisionAndActivate(ctx.admin, { firstName: 'Saul', lastName: 'Rojas', email: correoEst('b6socB'), role: 'SCIENTIFIC_SOCIETY', semester: 6 });
  const est = await provisionAndActivate(ctx.admin, { firstName: 'Elsa', lastName: 'Mamani', email: correoEst('b6est'), role: 'STUDENT', semester: 4 });
  const cats = (await req('GET', '/activity-categories', { token: director.token })).data ?? [];
  const taller = cats.find((c) => c.code === 'taller_academico') ?? cats[0];
  const extra = cats.find((c) => c.appliesTo === 'extracurricular') ?? cats[0];
  const ids = (r) => (r.data ?? []).map((a) => a.id);

  // ----- §24.1 (C9) El borrador del docente es solo suyo
  const borrador = await req('POST', '/activities', {
    token: docA.token, body: { title: `Borrador privado ${TS}`, type: 'academica', categoryId: taller.id, semesterScope: [4] },
  });
  const bid = borrador.data?.id;
  check(borrador.status === 201 && borrador.data?.status === 'draft', 'V32.6.1 El docente crea un borrador', `status ${borrador.status}`);
  const verB = await req('GET', `/activities/${bid}`, { token: docB.token });
  const listaB = await req('GET', '/activities', { token: docB.token });
  const gestB = await req('GET', '/activities/managed', { token: docB.token });
  check(verB.status === 404 && !ids(listaB).includes(bid) && !ids(gestB).includes(bid),
    'V32.6.2 §24.1 Otro docente del mismo semestre no ve el borrador (ni en listas ni por URL)', `detalle ${verB.status}`);
  const editaB = await req('PATCH', `/activities/${bid}`, { token: docB.token, body: { title: `Ajeno ${TS}` } });
  check(editaB.status === 403 || editaB.status === 404, 'V32.6.3 §24.1 Tampoco lo edita cambiando el id en la petición', `status ${editaB.status}`);
  const verDir = await req('GET', `/activities/${bid}`, { token: director.token });
  const listaDir = await req('GET', '/activities/managed', { token: director.token });
  check(verDir.status === 404 && !ids(listaDir).includes(bid),
    'V32.6.4 §24.1 Dirección no lo ve antes del envío', `detalle ${verDir.status}`);
  const verAdm = await req('GET', `/activities/${bid}`, { token: ctx.admin });
  const listaAdm = await req('GET', '/activities/managed', { token: ctx.admin });
  check(verAdm.status === 404 && !ids(listaAdm).includes(bid),
    'V32.6.5 §24.1 Administración tampoco, en la vista operativa', `detalle ${verAdm.status}`);
  const verEst = await req('GET', `/activities/${bid}`, { token: est.token });
  check(verEst.status === 404, 'V32.6.6 §24.1 Un estudiante nunca ve un borrador', `status ${verEst.status}`);
  const propio = await req('GET', '/activities/managed', { token: docA.token });
  check(ids(propio).includes(bid), 'V32.6.7 §25 Está en «Mis actividades» de quien lo creó');

  // ----- §23.1 Enviar y cancelar el envío
  const enviada = await req('POST', `/activities/${bid}/submit`, { token: docA.token, body: {} });
  check(enviada.status === 200 && enviada.data?.reviewStatus === 'pending', 'V32.6.8 §23 Se envía a revisión', `status ${enviada.status}`);
  const pendientes = await req('GET', '/activities/reviews/pending', { token: director.token });
  const verDir2 = await req('GET', `/activities/${bid}`, { token: director.token });
  check(ids(pendientes).includes(bid) && verDir2.status === 200, 'V32.6.9 §24.5 Enviada, aparece en la bandeja de Dirección');
  const avisoDir = (await req('GET', '/notifications/me', { token: director.token })).data ?? [];
  check(avisoDir.some((n) => n.type === 'ACTIVITY_REVIEW_SUBMITTED' && n.entityId === bid),
    'V32.6.10 §47 Dirección recibe ACTIVITY_REVIEW_SUBMITTED', json(avisoDir.map((n) => n.type)));
  const cancelaB = await req('POST', `/activities/${bid}/cancel-submission`, { token: docB.token });
  check(cancelaB.status === 403, 'V32.6.11 §23.1 Otro docente no retira un envío ajeno', `status ${cancelaB.status}`);
  const cancela = await req('POST', `/activities/${bid}/cancel-submission`, { token: docA.token });
  check(cancela.status === 200 && cancela.data?.reviewStatus === null && cancela.data?.status === 'draft',
    'V32.6.12 §23.1 «Cancelar envío» la devuelve a borrador para corregir', json({ s: cancela.status, r: cancela.data?.reviewStatus }));
  const pendientes2 = await req('GET', '/activities/reviews/pending', { token: director.token });
  const verDir3 = await req('GET', `/activities/${bid}`, { token: director.token });
  check(!ids(pendientes2).includes(bid) && verDir3.status === 404, 'V32.6.13 §23.1 Sale de la bandeja y vuelve a ser privada');
  const otraVez = await req('POST', `/activities/${bid}/cancel-submission`, { token: docA.token });
  check(otraVez.status === 409, 'V32.6.14 §23.1 Sin envío pendiente no hay nada que retirar', `status ${otraVez.status}`);
  const historia = await req('GET', `/activities/${bid}/reviews`, { token: docA.token });
  check((historia.data ?? []).some((h) => h.action === 'cancelled'), 'V32.6.15 §23.1 La historia registra el retiro', json(historia.data));

  // ----- §23.2 Observada → corrige y reenvía
  await req('POST', `/activities/${bid}/submit`, { token: docA.token, body: {} });
  const observa = await req('POST', `/activities/${bid}/review`, { token: director.token, body: { decision: 'observe', comment: 'Falta el objetivo.' } });
  const avisoObs = (await req('GET', '/notifications/me', { token: docA.token })).data ?? [];
  check(observa.status === 200 && avisoObs.some((n) => n.type === 'ACTIVITY_REVIEW_OBSERVED' && n.entityId === bid),
    'V32.6.16 §47 Quien la propuso recibe ACTIVITY_REVIEW_OBSERVED', json(avisoObs.map((n) => n.type)));
  const corrige = await req('PATCH', `/activities/${bid}`, { token: docA.token, body: { description: 'Objetivo: practicar diseño.' } });
  check(corrige.status === 200, 'V32.6.17 §23.2 Observada, el creador corrige', `status ${corrige.status}`);
  await req('POST', `/activities/${bid}/submit`, { token: docA.token, body: {} });
  const aprueba = await req('POST', `/activities/${bid}/review`, { token: director.token, body: { decision: 'approve' } });
  const avisoAp = (await req('GET', '/notifications/me', { token: docA.token })).data ?? [];
  check(aprueba.status === 200 && avisoAp.some((n) => n.type === 'ACTIVITY_REVIEW_APPROVED' && n.entityId === bid),
    'V32.6.18 §47 Y ACTIVITY_REVIEW_APPROVED al aprobarse', json(avisoAp.map((n) => n.type)));

  // ----- §23.3 (C10) Aprobada: el creador ya no cambia el contenido
  const cambiaTitulo = await req('PATCH', `/activities/${bid}`, { token: docA.token, body: { title: `Cambiada ${TS}` } });
  check(cambiaTitulo.status === 409 && cambiaTitulo.data?.code === 'ACTIVITY_APPROVED_LOCKED',
    'V32.6.19 §23.3 (C10) Aprobada, el creador no cambia campos materiales', `status ${cambiaTitulo.status}`);
  const publica = await req('PATCH', `/activities/${bid}`, { token: docA.token, body: { status: 'open' } });
  check(publica.status === 200 && publica.data?.status === 'open', 'V32.6.20 §23.3 Pero sí la publica y sigue gestionándola', `status ${publica.status}`);
  const ajustaDir = await req('PATCH', `/activities/${bid}`, { token: director.token, body: { title: `Ajustada por Dirección ${TS}` } });
  check(ajustaDir.status === 200, 'V32.6.21 §23.3 Dirección sí puede ajustarla', `status ${ajustaDir.status}`);
  const auditAjuste = await req('GET', `/audit/events?entityId=${bid}`, { token: ctx.admin });
  check((auditAjuste.data?.items ?? auditAjuste.data ?? []).length > 0, 'V32.6.22 §26 Cada cambio queda auditado');

  // ----- §25 Publicada: otro docente la ve en la carrera, pero no la gestiona
  const listaB2 = await req('GET', '/activities', { token: docB.token });
  const gestB2 = await req('GET', '/activities/managed', { token: docB.token });
  const confirmaB = await req('GET', `/activities/${bid}/participants`, { token: docB.token });
  check(ids(listaB2).includes(bid) && !ids(gestB2).includes(bid) && confirmaB.status === 403,
    'V32.6.23 §25 «Actividades de la carrera» la muestra; «Mis actividades» y la participación, no', `participantes ${confirmaB.status}`);
  const verEst2 = await req('GET', `/activities/${bid}`, { token: est.token });
  check(verEst2.status === 200, 'V32.6.24 §24.6 Publicada, la ve el estudiante', `status ${verEst2.status}`);

  // ----- §24.2 Sociedad: el borrador es de quien lo crea
  const socDraft = await req('POST', '/activities', {
    token: socA.token, body: { title: `Reto interno ${TS}`, type: 'extracurricular', categoryId: extra.id },
  });
  const verSocB = await req('GET', `/activities/${socDraft.data?.id}`, { token: socB.token });
  check(socDraft.status === 201 && verSocB.status === 404, 'V32.6.25 §24.2 El borrador de un integrante no lo ve otro', `status ${verSocB.status}`);
  await req('POST', `/activities/${socDraft.data?.id}/submit`, { token: socA.token, body: {} });
  await req('POST', `/activities/${socDraft.data?.id}/review`, { token: director.token, body: { decision: 'approve' } });
  await req('PATCH', `/activities/${socDraft.data?.id}`, { token: socA.token, body: { status: 'open' } });
  const gestDir = await req('GET', '/activities/managed', { token: director.token });
  check(ids(gestDir).includes(socDraft.data?.id) && ids(gestDir).includes(bid),
    'V32.6.26 §26 Dirección da seguimiento a lo aprobado (académico y extracurricular)');

  // ----- §24.3–§24.4 El borrador de Dirección o de Administración no es de nadie más
  const dirDraft = await req('POST', '/activities', { token: director.token, body: { title: `Idea de Dirección ${TS}`, type: 'academica', categoryId: taller.id } });
  const verAdmDir = await req('GET', `/activities/${dirDraft.data?.id}`, { token: ctx.admin });
  const verDocDir = await req('GET', `/activities/${dirDraft.data?.id}`, { token: docA.token });
  check(verAdmDir.status === 404 && verDocDir.status === 404, 'V32.6.27 §24.3 El borrador de Dirección no aparece a Administración ni a docentes',
    `${verAdmDir.status} / ${verDocDir.status}`);
  const docAdm = await provisionAndActivate(ctx.admin, { firstName: 'Ulo', lastName: 'Ticona', email: correoStaff('b6resp'), role: 'TEACHER' });
  const admDraft = await req('POST', '/activities', {
    token: ctx.admin, body: { title: `Operativa ${TS}`, type: 'academica', categoryId: taller.id, responsibleUserIds: [docAdm.userId] },
  });
  const verDirAdm = await req('GET', `/activities/${admDraft.data?.id}`, { token: director.token });
  const verResp = await req('GET', `/activities/${admDraft.data?.id}`, { token: docAdm.token });
  check(verDirAdm.status === 404 && verResp.status === 200,
    'V32.6.28 §24.4 El borrador de Administración no lo ve Dirección; sí su responsable', `${verDirAdm.status} / ${verResp.status}`);
}

// ===========================================================================
//  BATCH 7 — Tarjetas y detalle de actividad, participantes (C16, C17, §37, §64)
// ===========================================================================
async function batch7(ctx) {
  objective('BATCH 7 · Tarjeta y detalle: imagen, fechas, áreas, habilidades, personas y enlaces');
  const director = await provisionAndActivate(ctx.admin, { firstName: 'Nora', lastName: 'Saavedra', email: correoStaff('b7dir'), role: 'CAREER_DIRECTOR' });
  const docente = await provisionAndActivate(ctx.admin, { firstName: 'Omar', lastName: 'Taboada', email: correoStaff('b7doc'), role: 'TEACHER' });
  const est = await provisionAndActivate(ctx.admin, { firstName: 'Pia', lastName: 'Ustariz', email: correoEst('b7est'), role: 'STUDENT', semester: 2 });
  await req('POST', '/profiles/me', { token: est.token, body: {} });
  const areas = (await req('GET', '/academic-areas', { token: ctx.admin })).data ?? [];
  const skills = (await req('GET', '/skills', { token: ctx.admin })).data ?? [];
  const area = (c) => areas.find((a) => a.code === c);
  const skill = (c) => skills.find((s) => s.code === c);
  const cats = (await req('GET', '/activity-categories', { token: director.token })).data ?? [];
  const taller = cats.find((c) => c.code === 'taller_academico') ?? cats[0];
  const png = await subirArchivo(director.token, PNG_1X1, 'portada.png', 'image/png');
  const titulo = `Taller tarjeta ${TS}`;
  const creada = await req('POST', '/activities', {
    token: director.token,
    body: {
      title: titulo, type: 'academica', categoryId: taller.id, semesterScope: [2],
      description: 'Descripción larga. '.repeat(40),
      areaIds: [area('desarrollo_web').id, area('bases_de_datos').id, area('redes').id, area('ingenieria_de_software').id],
      skillIds: [skill('react').id, skill('postgresql').id, skill('tcp_ip').id, skill('git').id],
      activityDate: new Date(Date.now() + 72 * 3_600_000).toISOString(), endAt: new Date(Date.now() + 75 * 3_600_000).toISOString(),
      modality: 'hibrida', location: 'Aula 5', meetingUrl: 'https://meet.google.com/xyz-abcd-efg',
      resourceLinks: [{ label: 'Guía', url: 'https://univalle.edu/guia.pdf' }],
      imageFileId: png.data?.id, capacity: 30,
      responsibleUserIds: [director.userId, docente.userId], status: 'open',
    },
  });
  check(creada.status === 201, 'V32.7.1 Se publica una actividad con todo lo que muestra la tarjeta', `status ${creada.status} ${json(creada.data?.fields)}`);
  const pagina = await req('GET', `/activities?limit=50&q=${encodeURIComponent(titulo)}`, { token: est.token });
  const tarjeta = (pagina.data?.items ?? pagina.data ?? []).find((a) => a.id === creada.data?.id);
  check(!!tarjeta?.imageUrl && tarjeta?.endAt && tarjeta?.meetingUrl && (tarjeta?.resourceLinks ?? []).length === 1,
    'V32.7.2 §37 El listado trae imagen, fin, enlace de reunión y el primer enlace útil', json({ i: !!tarjeta?.imageUrl, e: tarjeta?.endAt }));
  check((tarjeta?.activityAreas ?? []).length === 4 && (tarjeta?.activitySkills ?? []).every((s) => s.skill?.name),
    'V32.7.3 §37 Y las áreas y habilidades con su nombre, para resumirlas («+2»)', json((tarjeta?.activitySkills ?? []).map((s) => s.skill?.name)));
  check(json((tarjeta?.responsibles ?? []).map((p) => p.id)) === json([director.userId, docente.userId]) && !('email' in (tarjeta?.responsibles?.[0] ?? {})),
    'V32.7.4 §37 El detalle nombra a los responsables (sin exponer su correo)', json(tarjeta?.responsibles));
  check(tarjeta && !('reviewComment' in tarjeta) && !('creator' in tarjeta && tarjeta.creator?.email),
    'V32.7.5 V2 §80 El estudiante sigue recibiendo la vista mínima', json(Object.keys(tarjeta ?? {}).length));
  const gestion = await req('GET', '/activities/managed', { token: docente.token });
  check((gestion.data ?? []).some((a) => a.id === creada.data?.id && (a.responsibles ?? []).length === 2),
    'V32.7.6 §16 El responsable la tiene en «Mis actividades», con sus responsables', `${(gestion.data ?? []).length}`);

  objective('BATCH 7 · Participantes: la lista que ve el responsable');
  for (let i = 0; i < 12; i++) {
    const alumno = await provisionAndActivate(ctx.admin, {
      firstName: 'Alumno', lastName: `Prueba ${String.fromCharCode(65 + i)}`, email: correoEst(`b7p${i}`), role: 'STUDENT', semester: 2,
    });
    await req('POST', '/profiles/me', { token: alumno.token, body: {} });
    await req('POST', `/activities/${creada.data?.id}/register`, { token: alumno.token });
  }
  const participantes = await req('GET', `/activities/${creada.data?.id}/participants`, { token: docente.token });
  check(participantes.status === 200 && (participantes.data ?? []).length === 12,
    'V32.7.7 §64 El responsable ve a los 12 inscritos (la web los pagina de a 10)', `${(participantes.data ?? []).length}`);
  check((participantes.data ?? []).every((p) => p.studentName && p.status && !('email' in p)),
    'V32.7.8 §64 Cada fila trae nombre y estado, sin datos de más', json(participantes.data?.[0]));
}

// ===========================================================================
//  BATCH 8 — Resultados: certificado institucional con emisor real (§28.3) y permisos de entrega
// ===========================================================================
async function batch8(ctx) {
  objective('BATCH 8 · Certificado emitido por la institución: emisor real, entrega a confirmados, sin autoría de Afinia');
  const docente = await provisionAndActivate(ctx.admin, { firstName: 'Raul', lastName: 'Vidaurre', email: correoStaff('b8doc'), role: 'TEACHER' });
  const otroDoc = await provisionAndActivate(ctx.admin, { firstName: 'Sergio', lastName: 'Zapata', email: correoStaff('b8otro'), role: 'TEACHER' });
  for (const d of [docente, otroDoc]) await req('PUT', `/users/${d.userId}/semesters`, { token: ctx.admin, body: { semesters: [5] } });
  const director = await provisionAndActivate(ctx.admin, { firstName: 'Tania', lastName: 'Aguirre', email: correoStaff('b8dir'), role: 'CAREER_DIRECTOR' });
  const est = await provisionAndActivate(ctx.admin, { firstName: 'Uma', lastName: 'Barrios', email: correoEst('b8est'), role: 'STUDENT', semester: 5 });
  const est2 = await provisionAndActivate(ctx.admin, { firstName: 'Vico', lastName: 'Cardozo', email: correoEst('b8est2'), role: 'STUDENT', semester: 5 });
  for (const e of [est, est2]) e.profileId = (await req('POST', '/profiles/me', { token: e.token, body: {} })).data?.id;
  const cats = (await req('GET', '/activity-categories', { token: director.token })).data ?? [];
  const taller = cats.find((c) => c.code === 'taller_academico') ?? cats[0];

  const sinEmisor = await req('POST', '/activities', {
    token: director.token,
    body: { title: `Diplomado ${TS}`, type: 'academica', categoryId: taller.id, semesterScope: [5], outcomePolicy: 'institution_issued_certificate', status: 'open' },
  });
  check(sinEmisor.status === 400 && sinEmisor.data?.fields?.certificateIssuer,
    'V32.8.1 §28.3 Publicar con certificado institucional exige nombrar al emisor real', json(sinEmisor.data?.fields));

  const creada = await req('POST', '/activities', {
    token: docente.token,
    body: {
      title: `Seminario certificado ${TS}`, type: 'academica', categoryId: taller.id, semesterScope: [5],
      outcomePolicy: 'institution_issued_certificate', certificateIssuer: 'Universidad del Valle — Facultad de Informática',
    },
  });
  const id = creada.data?.id;
  await aprobarActividad(docente.token, director.token, id);
  for (const e of [est, est2]) await req('POST', `/activities/${id}/register`, { token: e.token });
  await req('PATCH', `/activities/${id}/confirm-participation`, { token: docente.token, body: { studentProfileId: est.profileId, status: 'confirmed' } });
  check(creada.data?.certificateIssuer === 'Universidad del Valle — Facultad de Informática',
    'V32.8.2 §28.3 La actividad guarda el emisor real del certificado', json(creada.data?.certificateIssuer));

  const misAntes = await req('GET', '/constancies/internal/my', { token: est.token });
  check((misAntes.data ?? []).every((c) => c.activityId !== id),
    'V32.8.3 §28.3 Confirmar no fabrica un certificado: lo entrega el responsable', json((misAntes.data ?? []).length));

  const ajeno = await req('GET', `/constancies/internal/eligible/${id}`, { token: otroDoc.token });
  check(ajeno.status === 404, 'V32.8.4 Otro docente no lista los confirmados de una actividad ajena (aunque conozca el id)', `status ${ajeno.status}`);
  const elegibles = await req('GET', `/constancies/internal/eligible/${id}`, { token: docente.token });
  check(elegibles.status === 200 && (elegibles.data ?? []).length === 1 && elegibles.data[0].studentProfileId === est.profileId,
    'V32.8.5 §28.3 El responsable ve a los confirmados que pueden recibirlo', json(elegibles.data));

  const noConfirmado = await req('POST', `/constancies/internal/institution-certificates/${id}`, {
    token: docente.token, body: { profileIds: [est2.profileId] },
  });
  check(noConfirmado.status === 400, 'V32.8.6 §28.3 No se entrega a quien no tiene la participación confirmada', `status ${noConfirmado.status}`);
  const ajenoEntrega = await req('POST', `/constancies/internal/institution-certificates/${id}`, {
    token: otroDoc.token, body: { profileIds: [est.profileId] },
  });
  check(ajenoEntrega.status === 404, 'V32.8.7 Otro docente no entrega certificados de una actividad ajena', `status ${ajenoEntrega.status}`);

  const archivo = await subirArchivo(docente.token, PNG_1X1, 'certificado.png', 'image/png');
  const entrega = await req('POST', `/constancies/internal/institution-certificates/${id}`, {
    token: docente.token, body: { profileIds: [est.profileId], storedFileId: archivo.data?.id, certificateCode: 'UV-2026-0042' },
  });
  check(entrega.status === 201 && entrega.data?.delivered === 1, 'V32.8.8 §28.3 El responsable entrega el certificado al confirmado', `status ${entrega.status} ${json(entrega.data)}`);
  const mis = await req('GET', '/constancies/internal/my', { token: est.token });
  const cert = (mis.data ?? []).find((c) => c.activityId === id);
  check(cert?.kind === 'institution_certificate' && cert?.issuerName === 'Universidad del Valle — Facultad de Informática'
      && cert?.certificateCode === 'UV-2026-0042' && /\/api\/files\//.test(cert?.fileUrl ?? ''),
    'V32.8.9 §28.3 El estudiante lo recibe con el emisor real, su código y el archivo', json(cert));
  const descarga = await fetch(`${API.replace(/\/api$/, '')}${cert?.fileUrl}`, { headers: { Authorization: `Bearer ${est.token}` } });
  const descargaAjena = await fetch(`${API.replace(/\/api$/, '')}${cert?.fileUrl}`, { headers: { Authorization: `Bearer ${est2.token}` } });
  check(descarga.status === 200 && descargaAjena.status === 404,
    'V32.8.10 §28.3 Solo su titular (y quien lo entregó) descarga el certificado', `${descarga.status} / ${descargaAjena.status}`);
  const aviso = (await req('GET', '/notifications/me', { token: est.token })).data ?? [];
  check(aviso.some((n) => n.type === 'CERTIFICATE_DELIVERED'), 'V32.8.11 §47 El estudiante recibe el aviso de su certificado');
  const resumen = await req('GET', '/trajectory-summary/items', { token: est.token });
  const texto = json(resumen.data);
  check(resumen.status === 200 && /Emitido por Universidad del Valle/.test(JSON.stringify(resumen.data ?? {})),
    'V32.8.12 §28.3 La trayectoria lo muestra como emitido por la institución, no por Afinia', texto.slice(0, 120));
  const otraVez = await req('POST', `/constancies/internal/institution-certificates/${id}`, {
    token: docente.token, body: { profileIds: [est.profileId], certificateCode: 'UV-2026-0043' },
  });
  const mis2 = await req('GET', '/constancies/internal/my', { token: est.token });
  check(otraVez.status === 201 && (mis2.data ?? []).filter((c) => c.activityId === id).length === 1
      && (mis2.data ?? []).find((c) => c.activityId === id)?.certificateCode === 'UV-2026-0043',
    'V32.8.13 §28.3 Volver a entregar actualiza el código, sin duplicar', `${(mis2.data ?? []).filter((c) => c.activityId === id).length}`);
  const admin = await req('POST', `/constancies/internal/institution-certificates/${id}`, { token: ctx.admin, body: { profileIds: [est.profileId] } });
  check(admin.status === 403, 'V32.8.14 §6.5 Administración no entrega documentos académicos', `status ${admin.status}`);
}

// ===========================================================================
//  BATCH 9 — Biblioteca de recursos con favoritos (§35)
// ===========================================================================
async function batch9(ctx) {
  objective('BATCH 9 · Biblioteca: buscar, filtrar por área o habilidad, abrir y guardar; sin afinidad');
  const director = await provisionAndActivate(ctx.admin, { firstName: 'Wara', lastName: 'Choque', email: correoStaff('b9dir'), role: 'CAREER_DIRECTOR' });
  const est = await provisionAndActivate(ctx.admin, { firstName: 'Xime', lastName: 'Duran', email: correoEst('b9est'), role: 'STUDENT', semester: 4 });
  est.profileId = (await req('POST', '/profiles/me', { token: est.token, body: {} })).data?.id;
  const areas = (await req('GET', '/academic-areas', { token: ctx.admin })).data ?? [];
  const skills = (await req('GET', '/skills', { token: ctx.admin })).data ?? [];
  const bd = areas.find((a) => a.code === 'bases_de_datos');
  const web = areas.find((a) => a.code === 'desarrollo_web');
  const pg = skills.find((s) => s.code === 'postgresql');
  const png = await subirArchivo(director.token, PNG_1X1, 'tapa.png', 'image/png');
  const titulo = `Manual de PostgreSQL ${TS}`;
  const recurso = await req('POST', '/learning-resources', {
    token: director.token,
    body: {
      title: titulo, provider: 'Documentación oficial', url: `https://www.postgresql.org/docs/${TS}/`,
      description: 'Referencia completa.', academicAreaId: bd.id, areaIds: [web.id], resourceType: 'documentation',
      skillIds: [pg.id], imageFileId: png.data?.id,
    },
  });
  check(recurso.status === 201 && json(recurso.data?.areaIds) === json([bd.id, web.id]) && !!recurso.data?.imageUrl,
    'V32.9.1 §35 Un recurso guarda varias áreas (la principal primero), sus habilidades y una imagen', json({ s: recurso.status, a: recurso.data?.areaIds }));

  const buscar = await req('GET', `/library?q=${encodeURIComponent(titulo)}`, { token: est.token });
  const item = (buscar.data?.items ?? [])[0];
  check(buscar.status === 200 && item?.id === recurso.data?.id && item?.skills?.[0]?.name === 'PostgreSQL'
      && item?.areas?.length === 2 && item?.resourceTypeLabel && item?.isFavorite === false,
    'V32.9.2 §35.1 El estudiante lo busca y ve tipo, áreas, habilidades e imagen', json(item));
  check(!('startAt' in (item ?? {})) && !('eventDate' in (item ?? {})) && !('capacity' in (item ?? {})),
    'V32.9.3 §35 Un recurso no tiene fechas, inscripción ni cupo');
  const porArea = await req('GET', `/library?areaId=${web.id}&q=${encodeURIComponent(titulo)}`, { token: est.token });
  const porSkill = await req('GET', `/library?skillId=${pg.id}&q=${encodeURIComponent(titulo)}`, { token: est.token });
  const otraArea = await req('GET', `/library?areaId=${areas.find((a) => a.code === 'redes').id}&q=${encodeURIComponent(titulo)}`, { token: est.token });
  check(porArea.data?.total === 1 && porSkill.data?.total === 1 && otraArea.data?.total === 0,
    'V32.9.4 §35.1 Se filtra por cualquiera de sus áreas y por habilidad', `${porArea.data?.total}/${porSkill.data?.total}/${otraArea.data?.total}`);
  check((buscar.data?.facets?.areas ?? []).length <= 30 && (buscar.data?.facets?.areas ?? []).every((a) => a.total > 0),
    'V32.9.5 §6.3 Los filtros ofrecen solo áreas con recursos, acotadas', `${(buscar.data?.facets?.areas ?? []).length}`);

  const antes = await req('GET', '/affinity/me', { token: est.token });
  const guarda = await req('PUT', `/library/${recurso.data?.id}/favorite`, { token: est.token });
  const dosVeces = await req('PUT', `/library/${recurso.data?.id}/favorite`, { token: est.token });
  const favoritos = await req('GET', '/library?favorites=true', { token: est.token });
  check(guarda.status === 200 && dosVeces.status === 200 && (favoritos.data?.items ?? []).some((r) => r.id === recurso.data?.id && r.isFavorite),
    'V32.9.6 §35.1 Guardar como favorito (idempotente) y verlo en «Mis favoritos»', json(favoritos.data?.total));
  await req('POST', '/affinity/recalculate/me', { token: est.token });
  const despues = await req('GET', '/affinity/me', { token: est.token });
  const suma = (r) => JSON.stringify((r.data?.areas ?? r.data ?? []).map?.((a) => [a.areaId ?? a.academicAreaId, a.affinityScore ?? a.score]) ?? r.data);
  check(suma(antes) === suma(despues), 'V32.9.7 §35.3 Guardar un recurso no aporta afinidad', `${suma(antes).slice(0, 80)} / ${suma(despues).slice(0, 80)}`);
  const quita = await req('DELETE', `/library/${recurso.data?.id}/favorite`, { token: est.token });
  const favoritos2 = await req('GET', '/library?favorites=true', { token: est.token });
  check(quita.status === 200 && !(favoritos2.data?.items ?? []).some((r) => r.id === recurso.data?.id), 'V32.9.8 §35.1 Y quitarlo');
  const docente = await provisionAndActivate(ctx.admin, { firstName: 'Yago', lastName: 'Flores', email: correoStaff('b9doc'), role: 'TEACHER' });
  const docFav = await req('PUT', `/library/${recurso.data?.id}/favorite`, { token: docente.token });
  check(docFav.status === 403, 'V32.9.9 Solo el estudiante guarda favoritos -> 403', `status ${docFav.status}`);
  await req('PATCH', `/learning-resources/${recurso.data?.id}`, { token: director.token, body: { status: 'inactive' } });
  const retirado = await req('GET', `/library?q=${encodeURIComponent(titulo)}`, { token: est.token });
  check(retirado.data?.total === 0, 'V32.9.10 §61 Un recurso retirado sale de la Biblioteca', `${retirado.data?.total}`);
}

// ===========================================================================
//  BATCH 10 — Recomendaciones: favorito de recurso como señal secundaria, «Me interesa» (§35.2, §36)
// ===========================================================================
async function batch10(ctx) {
  objective('BATCH 10 · Favoritos con peso bajo, «Me interesa» sin modelo y guardar algo que ya pasó');
  const L = String.fromCharCode(...String(TS).slice(-6).split('').map((d) => 65 + Number(d)));
  const area = async (n) => (await req('POST', '/academic-areas', { token: ctx.admin, body: { name: `${n} ${L}`, tags: [`${n.toLowerCase().slice(0, 6)}${L.toLowerCase()}`] } })).data;
  const aInteres = await area('Fotonica');
  const aSoloFav = await area('Acustica');
  const sk = async (n, a) => (await req('POST', '/skills', { token: ctx.admin, body: { name: `${n} ${L}`, academicAreaId: a.id } })).data;
  const sInt = await sk('Laser Kit', aInteres);
  const sFav = await sk('Sonar Kit', aSoloFav);
  const director = await provisionAndActivate(ctx.admin, { firstName: 'Zoe', lastName: 'Gutierrez', email: correoStaff('b10dir'), role: 'CAREER_DIRECTOR' });
  const est = await provisionAndActivate(ctx.admin, { firstName: 'Ariel', lastName: 'Huanca', email: correoEst('b10est'), role: 'STUDENT', semester: 3 });
  est.profileId = (await req('POST', '/profiles/me', { token: est.token, body: {} })).data?.id;
  await req('PUT', '/profiles/me/interests', { token: est.token, body: { items: [{ academicAreaId: aInteres.id, priority: 1 }] } });
  const cats = (await req('GET', '/activity-categories', { token: director.token })).data ?? [];
  const taller = cats.find((c) => c.code === 'taller_academico') ?? cats[0];
  const crear = (titulo, a, s, extra = {}) => req('POST', '/activities', {
    token: director.token,
    body: { title: `${titulo} ${TS}`, type: 'academica', categoryId: taller.id, areaIds: [a.id], skillIds: [s.id], status: 'open', ...extra },
  });
  const actInteres = (await crear('Taller de fotonica', aInteres, sInt)).data;
  const actSoloFav = (await crear('Taller de acustica', aSoloFav, sFav)).data;
  const recurso = async (titulo, a) => (await req('POST', '/learning-resources', {
    token: director.token,
    body: { title: `${titulo} ${TS}`, provider: 'Catálogo', url: `https://recursos.univalle.edu/${titulo.replace(/\s/g, '-')}-${TS}`, academicAreaId: a.id, resourceType: 'guide' },
  })).data;
  const rInt = await recurso('Guia de fotonica', aInteres);
  const rFav = await recurso('Guia de acustica', aSoloFav);

  const items = async () => ((await req('GET', '/recommendations/me', { token: est.token })).data?.groups ?? []).flatMap((g) => g.items);
  const de = (lista, id) => lista.find((i) => i.targetId === id);
  const codigos = (i) => (i?.reasons ?? []).map((r) => r.code);
  let lista = await items();
  check(!!de(lista, actInteres.id) && !codigos(de(lista, actInteres.id)).includes('resource_favorite_area'),
    'V32.10.1 Sin favoritos, la actividad del área de interés se recomienda sin esa señal', json(codigos(de(lista, actInteres.id))));
  const puntosAntes = de(lista, actInteres.id)?.score ?? 0;

  await req('PUT', `/library/${rInt.id}/favorite`, { token: est.token });
  await req('PUT', `/library/${rFav.id}/favorite`, { token: est.token });
  lista = await items();
  const conFav = de(lista, actInteres.id);
  const razon = (conFav?.reasons ?? []).find((r) => r.code === 'resource_favorite_area');
  check(!!razon && razon.points <= 5 && /Biblioteca/.test(razon.label),
    'V32.10.2 §35.2 Un recurso guardado del área suma como señal secundaria (≤ 5 puntos, con su motivo)', json(conFav?.reasons));
  check((conFav?.score ?? 0) - puntosAntes <= 5.001, 'V32.10.3 §35.2 Pesa poco: a lo sumo el 5 % de feedback', `${puntosAntes} → ${conFav?.score}`);
  check(!de(lista, actSoloFav.id), 'V32.10.4 §35.2 Por sí solo, un favorito no crea una recomendación', json(de(lista, actSoloFav.id)?.reasons));

  // ----- §36 «Me interesa»: no alimenta el modelo ni la afinidad
  const otroEst = await provisionAndActivate(ctx.admin, { firstName: 'Bruno', lastName: 'Ibarra', email: correoEst('b10est2'), role: 'STUDENT', semester: 3 });
  await req('POST', '/profiles/me', { token: otroEst.token, body: {} });
  const recOtroAntes = ((await req('GET', '/recommendations/me', { token: otroEst.token })).data?.groups ?? []).flatMap((g) => g.items);
  const afAntes = await req('GET', '/affinity/me', { token: otroEst.token });
  await req('POST', `/activities/${actSoloFav.id}/register-interest`, { token: otroEst.token });
  await req('POST', '/affinity/recalculate/me', { token: otroEst.token });
  const recOtroDespues = ((await req('GET', '/recommendations/me', { token: otroEst.token })).data?.groups ?? []).flatMap((g) => g.items);
  const afDespues = await req('GET', '/affinity/me', { token: otroEst.token });
  check(JSON.stringify(afAntes.data) === JSON.stringify(afDespues.data) || JSON.stringify(afDespues.data ?? {}).indexOf(aSoloFav.id) === -1,
    'V32.10.5 §36 «Me interesa» no aporta afinidad');
  check(!recOtroDespues.some((i) => (i.reasons ?? []).some((r) => r.label?.includes(aSoloFav.name))) && recOtroAntes.length === recOtroDespues.length,
    'V32.10.6 §36 «Me interesa» no se usa como señal del recomendador', `${recOtroAntes.length} → ${recOtroDespues.length}`);

  // ----- §36 Guardar algo que ya pasó, sin inscripción
  const pasada = (await crear('Taller pasado', aInteres, sInt, { activityDate: new Date(Date.now() - 3 * 3_600_000).toISOString(), endAt: new Date(Date.now() - 3_600_000).toISOString() })).data;
  const guardar = await req('POST', `/activities/${pasada.id}/register-interest`, { token: est.token });
  const inscribir = await req('POST', `/activities/${pasada.id}/register`, { token: est.token });
  check(guardar.status === 201 || guardar.status === 200, 'V32.10.7 §36 Una actividad que ya terminó se puede guardar', `status ${guardar.status} ${json(guardar.data)}`);
  check(inscribir.status === 400, 'V32.10.8 §36 Pero no inscribirse', `status ${inscribir.status}`);
}

// ===========================================================================
//  BATCH 11 — Proyectos: contexto área + habilidad (§11.4, §40)
// ===========================================================================
async function batch11(ctx) {
  objective('BATCH 11 · Proyecto: cada tecnología guarda el área en que se usó');
  const areas = (await req('GET', '/academic-areas', { token: ctx.admin })).data ?? [];
  const skills = (await req('GET', '/skills', { token: ctx.admin })).data ?? [];
  const ia = areas.find((a) => a.code === 'inteligencia_artificial');
  const web = areas.find((a) => a.code === 'desarrollo_web');
  const redes = areas.find((a) => a.code === 'redes');
  const python = skills.find((s) => s.code === 'python');
  const react = skills.find((s) => s.code === 'react');
  const est = await provisionAndActivate(ctx.admin, { firstName: 'Ciro', lastName: 'Jauregui', email: correoEst('b11est'), role: 'STUDENT', semester: 6 });
  await req('POST', '/profiles/me', { token: est.token, body: {} });
  const contexto = (p, id) => (p?.projectSkills ?? []).find((s) => s.skillId === id)?.academicAreaId;
  const leer = async (id) => (await req('GET', `/projects/${id}`, { token: est.token })).data;

  const creado = await crearProyectoBorrador(est.token, {
    title: `Recomendador web ${TS}`, description: 'Un modelo servido en una web.', areaIds: [ia.id, web.id], skillIds: [python.id, react.id],
    skillContexts: [{ skillId: python.id, areaId: web.id }],
  });
  const p1 = await leer(creado.data?.id);
  check(creado.status === 201 && contexto(p1, python.id) === web.id && contexto(p1, react.id) === web.id,
    'V32.11.1 §11.4 Python se registra como usado en Desarrollo Web (indicado) y React en su área', json(p1?.projectSkills?.map((s) => [s.skillId === python.id ? 'py' : 'react', s.academicAreaId])));
  const sinIndicar = await crearProyectoBorrador(est.token, {
    title: `Clasificador ${TS}`, description: 'Modelo de clasificación.', areaIds: [ia.id, web.id], skillIds: [python.id],
  });
  check(contexto(await leer(sinIndicar.data?.id), python.id) === ia.id,
    'V32.11.2 §11.4 Sin indicarlo, se deduce su área principal (IA)', '');
  const malo = await crearProyectoBorrador(est.token, {
    title: `Mal contexto ${TS}`, description: 'x', areaIds: [web.id, redes.id], skillIds: [react.id], skillContexts: [{ skillId: react.id, areaId: redes.id }],
  });
  check(malo.status === 400 && malo.data?.fields?.skillContexts,
    'V32.11.3 §11.4 Un contexto en un área ajena a la tecnología se rechaza en su campo', json(malo.data?.fields));
  const cambio = await req('PATCH', `/projects/${creado.data?.id}`, { token: est.token, body: { title: `Recomendador web v2 ${TS}` } });
  check(cambio.status === 200 && contexto(await leer(creado.data?.id), python.id) === web.id,
    'V32.11.4 §11.4 Editar otra cosa conserva el contexto', `status ${cambio.status}`);
  const sinWeb = await req('PATCH', `/projects/${creado.data?.id}`, { token: est.token, body: { areaIds: [ia.id], skillIds: [python.id] } });
  check(sinWeb.status === 200 && contexto(await leer(creado.data?.id), python.id) === ia.id,
    'V32.11.5 §11.4 Si se quita el área del contexto, vuelve a su área principal', `status ${sinWeb.status}`);
}

const BATCHES = { batch1, batch2, batch3, batch4, batch5, batch6, batch7, batch8, batch9, batch10, batch11 };

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
