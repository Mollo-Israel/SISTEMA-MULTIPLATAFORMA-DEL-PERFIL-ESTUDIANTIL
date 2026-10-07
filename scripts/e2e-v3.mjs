/**
 * Especificación Maestra Final V3.1 — verificación contra la API en marcha.
 *
 * Una sección por batch de la V3 (§72). Cada comprobación cita la sección que
 * verifica. Se ejecuta con la API en modo de correo simulado.
 *
 * Uso:
 *   API_URL=http://localhost:3010/api node scripts/e2e-v3.mjs [batch]
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
const correoEst = (k) => `v3.${k}.${TS}@est.univalle.edu`;
const correoStaff = (k) => `v3.${k}.${TS}@univalle.edu`;
const json = (x) => JSON.stringify(x ?? null).slice(0, 200);

/** Sube un CSV a la ruta de previsualización del padrón indicado. */
async function subirCsv(token, kind, contenido) {
  const form = new FormData();
  form.append('file', new Blob([contenido], { type: 'text/csv' }), `padron-${kind}.csv`);
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

// ===========================================================================
//  BATCH 2 — Identidad, códigos, importación y semestres (§7, §8)
// ===========================================================================
async function batch2(ctx) {
  objective('BATCH 2 · Importación de docentes y alcance académico');

  // ----- §7.1 Padrón de docentes
  const cabecera = 'university_code,first_name,last_name,institutional_email,authorized_semesters';
  const docA = codigoUniversitario('TEACHER');
  const docB = codigoUniversitario('TEACHER');
  const estudiante = await provisionAndActivate(ctx.admin, {
    firstName: 'Nilda', lastName: 'Cuellar', email: correoEst('arrastre'), role: 'STUDENT', semester: 3,
  });
  const csv = [
    cabecera,
    `${docA},Rolando,Quiroga,${correoStaff('docA')},1;2`,
    `${docB},Silvia,Arce,${correoStaff('docB')},5|9`,
    `EST-${docA.slice(4)},Mal,Prefijo,${correoStaff('docC')},1`,
    `${codigoUniversitario('TEACHER')},Otro,Rol,${estudiante.email},1`,
    `${docA},Repetido,Fila,${correoStaff('docE')},3`,
  ].join('\n');
  const prev = await subirCsv(ctx.admin, 'teachers', csv);
  check(prev.status === 201 && prev.data?.kind === 'teachers',
    'V3.2.1 §7.1 El padrón de docentes se previsualiza en su propio circuito', `status ${prev.status}`);
  check(fila(prev, docA)?.status === 'new' && json(fila(prev, docA)?.semesters) === '[1,2]',
    'V3.2.2 §7.1 Fila válida → NEW con sus semestres autorizados', json(fila(prev, docA)));
  check(fila(prev, docB)?.status === 'invalid' && /no válido/.test(fila(prev, docB)?.message ?? ''),
    'V3.2.3 §7.1 Un semestre fuera de 1 a 8 → INVALID con motivo', json(fila(prev, docB)));
  check(fila(prev, `EST-${docA.slice(4)}`)?.status === 'invalid',
    'V3.2.4 §7 Un docente con código EST- → INVALID (prefijo del rol)', json(fila(prev, `EST-${docA.slice(4)}`)));
  const delEstudiante = (prev.data?.rows ?? []).find((r) => r.institutionalEmail === estudiante.email);
  check(delEstudiante?.status === 'conflict' && /no es docente/.test(delEstudiante?.message ?? ''),
    'V3.2.5 §7 Un correo que pertenece a un estudiante → CONFLICT', json(delEstudiante));
  const repetida = (prev.data?.rows ?? []).filter((r) => r.universityCode === docA).find((r) => r.status === 'conflict');
  check(Boolean(repetida), 'V3.2.6 §7.1 Un código repetido dentro del archivo → CONFLICT');

  const comoEstudiantes = await req('POST', `/imports/students/${prev.data.batchId}/apply`, { token: ctx.admin });
  check(comoEstudiantes.status === 404,
    'V3.2.7 Un lote de docentes no se aplica por la ruta de estudiantes', `status ${comoEstudiantes.status}`);

  const aplicado = await req('POST', `/imports/teachers/${prev.data.batchId}/apply`, { token: ctx.admin });
  check(aplicado.status === 201 && aplicado.data?.created === 1,
    'V3.2.8 §7.1 Aplicar crea la cuenta docente', json(aplicado.data));
  const otraVez = await req('POST', `/imports/teachers/${prev.data.batchId}/apply`, { token: ctx.admin });
  check(otraVez.status === 400, 'V3.2.9 §7.1 Idempotente: un lote aplicado no se vuelve a aplicar', `status ${otraVez.status}`);

  const lista = await req('GET', `/users?search=${encodeURIComponent(correoStaff('docA'))}`, { token: ctx.admin });
  const docente = (lista.data ?? [])[0];
  check(docente?.role === 'TEACHER' && docente?.status === 'pending_activation' && docente?.universityCode === docA,
    'V3.2.10 §7 La cuenta nace docente, pendiente de activación y con su código DOC-', json(docente && { r: docente.role, s: docente.status }));
  check(json(docente?.semesters) === '[1,2]',
    'V3.2.11 §8.2 Sus semestres autorizados quedan como alcance docente', json(docente?.semesters));

  const igual = await subirCsv(ctx.admin, 'teachers', `${cabecera}\n${docA},Rolando,Quiroga,${correoStaff('docA')},1;2`);
  check(fila(igual, docA)?.status === 'unchanged', 'V3.2.12 §7.1 Reimportar lo mismo → UNCHANGED', json(fila(igual, docA)));
  const cambio = await subirCsv(ctx.admin, 'teachers', `${cabecera}\n${docA},Rolando,Quiroga,${correoStaff('docA')},1;5`);
  check(fila(cambio, docA)?.status === 'update' && /semestres/.test(fila(cambio, docA)?.message ?? ''),
    'V3.2.13 §7.1 Cambiar semestres → UPDATE que lo explica', json(fila(cambio, docA)));
  await req('POST', `/imports/teachers/${cambio.data.batchId}/apply`, { token: ctx.admin });
  const semestres = await req('GET', `/users/${docente.id}/semesters`, { token: ctx.admin });
  check(json(semestres.data?.semesters ?? semestres.data) === '[1,5]',
    'V3.2.14 §8.2 La actualización reemplaza los semestres habilitados', json(semestres.data));

  const historial = await req('GET', '/imports/teachers', { token: ctx.admin });
  check((historial.data ?? []).every((b) => b.kind === 'teachers') && (historial.data ?? []).length >= 3,
    'V3.2.15 El historial de docentes solo muestra lotes de docentes', `${(historial.data ?? []).length} lotes`);

  // ----- §7.1 La columna del semestre del estudiante también puede llamarse current_semester
  const codigoNuevo = codigoUniversitario();
  const conCurrent = await subirCsv(ctx.admin, 'students',
    `university_code,first_name,last_name,institutional_email,current_semester\n${codigoNuevo},Ema,Rivas,${correoEst('current')},4`);
  check(conCurrent.status === 201 && fila(conCurrent, codigoNuevo)?.status === 'new' && fila(conCurrent, codigoNuevo)?.semester === 4,
    'V3.2.16 §7.1 El padrón de estudiantes acepta current_semester', json(fila(conCurrent, codigoNuevo)));
  if (conCurrent.data?.batchId) await req('POST', `/imports/students/${conCurrent.data.batchId}/discard`, { token: ctx.admin });

  // ----- §8.1 Arrastre o repetición
  const docSem1 = await provisionAndActivate(ctx.admin, {
    firstName: 'Teodoro', lastName: 'Ledezma', email: correoStaff('alcance1'), role: 'TEACHER',
  });
  await req('PUT', `/users/${docSem1.userId}/semesters`, { token: ctx.admin, body: { semesters: [1] } });
  const perfiles = await req('GET', `/profiles/students?search=${encodeURIComponent(estudiante.email)}`, { token: ctx.admin });
  const profileId = (perfiles.data?.students ?? [])[0]?.profileId;

  const antes = await req('GET', `/profiles/${profileId}/allowed`, { token: docSem1.token });
  check(antes.status === 403, 'V3.2.17 §8 Sin arrastre, el docente de 1º no ve a un estudiante de 3º', `status ${antes.status}`);

  const fijar = await req('PATCH', `/users/${estudiante.userId}`, {
    token: ctx.admin, body: { academicScopeSemesters: [3, 1] },
  });
  check(fijar.status === 200 && json(fijar.data?.academicScopeSemesters) === '[1]',
    'V3.2.18 §8.1 Administración fija el arrastre; se normaliza sin el semestre actual', json(fijar.data?.academicScopeSemesters));

  const despues = await req('GET', `/profiles/${profileId}/allowed`, { token: docSem1.token });
  check(despues.status === 200, 'V3.2.19 §8.1 Con arrastre a 1º, el docente de 1º ya puede acompañarlo', `status ${despues.status}`);
  const enLista = await req('GET', `/profiles/students?search=${encodeURIComponent(estudiante.email)}`, { token: docSem1.token });
  check((enLista.data?.students ?? []).some((p) => p.profileId === profileId),
    'V3.2.20 §8.1 Y aparece en su listado de estudiantes', `${(enLista.data?.students ?? []).length} filas`);
  const repetidos = await req('PATCH', `/users/${estudiante.userId}`, { token: ctx.admin, body: { academicScopeSemesters: [1, 1] } });
  check(repetidos.status === 400, 'V3.2.20b §8.1 Semestres de arrastre repetidos → 400', `status ${repetidos.status}`);

  const propio = await req('PATCH', '/profiles/me', { token: estudiante.token, body: { academicScopeSemesters: [5] } });
  check(propio.status === 400, 'V3.2.21 §8.1 El estudiante no edita su propio alcance', `status ${propio.status}`);

  const alDocente = await req('PATCH', `/users/${docSem1.userId}`, { token: ctx.admin, body: { academicScopeSemesters: [2] } });
  check(alDocente.status === 200 && json(alDocente.data?.academicScopeSemesters) === '[]',
    'V3.2.22 §8.1 El arrastre solo aplica a estudiantes', json(alDocente.data?.academicScopeSemesters));

  // ----- §8.2 El alcance docente vive en Usuarios
  const docentes = await req('GET', '/users?role=TEACHER', { token: ctx.admin });
  check(docentes.status === 200 && (docentes.data ?? []).every((u) => u.role === 'TEACHER'),
    'V3.2.23 §8.2 Usuarios filtra los docentes para configurar sus semestres', `status ${docentes.status}`);
}

// ===========================================================================
//  BATCH 4 — Taxonomía inteligente y UX relacional (§4, §9)
// ===========================================================================
async function batch4(ctx) {
  objective('BATCH 4 · Sugerencia dinámica, etiquetas y área → habilidades');
  const letras = (n) => String.fromCharCode(...String(TS + n).slice(-6).split('').map((d) => 65 + Number(d)));
  const sufijo = letras(4);

  // ----- §9.4 Etiquetas
  const etiquetaPropia = `zeta${sufijo.toLowerCase()}`;
  const areaA = await req('POST', '/academic-areas', {
    token: ctx.admin, body: { name: `Telemetria ${sufijo}`, tags: [etiquetaPropia, 'sensores'] },
  });
  check(areaA.status === 201, 'V3.4.1 §9 Se crea un área con etiquetas', `status ${areaA.status}`);
  const analisis = await req('POST', '/academic-areas/tag-analysis', {
    token: ctx.admin, body: { tags: ['  Sistemas ', etiquetaPropia, 'Big   Data'] },
  });
  check(analisis.status === 200 && json(analisis.data?.tags) === json(['sistemas', etiquetaPropia, 'big data']),
    'V3.4.2 §9.4 Las etiquetas se normalizan (minúsculas, espacios)', json(analisis.data?.tags));
  check((analisis.data?.generic ?? []).includes('sistemas'),
    'V3.4.3 §9.4 Advierte las etiquetas demasiado generales', json(analisis.data?.generic));
  const compartida = (analisis.data?.shared ?? []).find((x) => x.tag === etiquetaPropia);
  check(compartida?.areas?.some((x) => x.id === areaA.data?.id),
    'V3.4.4 §9.4 Muestra qué áreas ya usan cada etiqueta', json(compartida));
  const sobreSiMisma = await req('POST', '/academic-areas/tag-analysis', {
    token: ctx.admin, body: { tags: [etiquetaPropia], exceptId: areaA.data?.id },
  });
  check((sobreSiMisma.data?.shared ?? []).length === 0, 'V3.4.5 §9.4 Al editar, el área no choca consigo misma');
  const repetidas = await req('POST', '/academic-areas', {
    token: ctx.admin, body: { name: `Telemetria Dos ${sufijo}`, tags: ['radio', 'Radio'] },
  });
  check(repetidas.status === 400, 'V3.4.6 §9.4 Una etiqueta repetida en la misma área se bloquea', `status ${repetidas.status}`);
  const docente = await provisionAndActivate(ctx.admin, {
    firstName: 'Ulises', lastName: 'Montaño', email: correoStaff('tags'), role: 'TEACHER',
  });
  const ajeno = await req('POST', '/academic-areas/tag-analysis', { token: docente.token, body: { tags: ['x'] } });
  check(ajeno.status === 403, 'V3.4.7 El análisis de etiquetas es de Administración', `status ${ajeno.status}`);

  // ----- §9.3 Sugerencia dinámica con el catálogo actual
  const base = await req('POST', '/skills', {
    token: ctx.admin, body: { name: `Kestrel ${sufijo}`, academicAreaId: areaA.data.id },
  });
  check(base.status === 201, 'V3.4.8 §9.2 Se registra una habilidad en esa área', `status ${base.status}`);
  const nueva = `Kestrel ${sufijo} Cloud`;
  const sugerida = await req('GET', `/skills/classify?name=${encodeURIComponent(nueva)}`, { token: ctx.admin });
  check(sugerida.data?.rule === 'suggested' && (sugerida.data?.areaIds ?? []).includes(areaA.data.id)
    && /habilidades ya clasificadas/.test(sugerida.data?.reason ?? ''),
  'V3.4.9 §9.3 Una tecnología nueva hereda la sugerencia de una ya clasificada (catálogo dinámico)', json(sugerida.data));

  const otraArea = await req('POST', '/academic-areas', {
    token: ctx.admin, body: { name: `Logistica ${sufijo}`, tags: [`almacen${sufijo.toLowerCase()}`] },
  });
  const sinMotivo = await req('POST', '/skills', {
    token: ctx.admin, body: { name: nueva, academicAreaId: otraArea.data.id },
  });
  check(sinMotivo.status === 409 && sinMotivo.data?.code === 'CLASSIFICATION_CONFIRMATION_REQUIRED',
    'V3.4.10 §74 Guardarla en un área incoherente no pasa en silencio: pide confirmación', `status ${sinMotivo.status}`);
  const conMotivo = await req('POST', '/skills', {
    token: ctx.admin,
    body: { name: nueva, academicAreaId: otraArea.data.id, overrideReason: 'Se usa en la cadena de suministro del laboratorio.' },
  });
  check(conMotivo.status === 201, 'V3.4.11 §9.3 Con un motivo explícito sí se guarda (y se audita)', `status ${conMotivo.status}`);

  // ----- §4 Área → habilidades en un formulario real (necesidad de equipo)
  const est = await provisionAndActivate(ctx.admin, {
    firstName: 'Paola', lastName: 'Jemio', email: correoEst('necesidad'), role: 'STUDENT', semester: 4,
  });
  const fuera = await req('POST', '/team-needs', {
    token: est.token,
    body: { purpose: 'Prototipo de telemetría', preferredAreaIds: [otraArea.data.id], requiredSkillIds: [base.data.id] },
  });
  check(fuera.status === 400 && /otra área/.test(json(fuera.data?.fields?.requiredSkillIds)),
    'V3.4.12 §67 Una habilidad de un área no elegida → 400 «pertenece a otra área»', json(fuera.data));
  const dentro = await req('POST', '/team-needs', {
    token: est.token,
    body: { purpose: 'Prototipo de telemetría', preferredAreaIds: [areaA.data.id], requiredSkillIds: [base.data.id] },
  });
  check(dentro.status === 201, 'V3.4.13 §4 Con el área de la habilidad elegida, se publica', `status ${dentro.status}`);
}

const BATCHES = { batch2, batch4 };

async function main() {
  console.log(`${C.bold}Afinia V3.1 — verificación contra la API${C.r}`);
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
