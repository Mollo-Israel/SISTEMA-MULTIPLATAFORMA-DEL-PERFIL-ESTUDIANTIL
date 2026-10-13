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
  API, PWD, codigoUniversitario, crearProyectoBorrador, loginAdmin, provisionAndActivate, req,
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

const BATCHES = { batch1, batch2, batch3, batch4 };

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
