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

// ===========================================================================
//  BATCH 5 — Perfil y onboarding (§11)
// ===========================================================================
async function batch5(ctx) {
  objective('BATCH 5 · Mi perfil por pestañas y avatar de catálogo');
  const est = await provisionAndActivate(ctx.admin, {
    firstName: 'Iver', lastName: 'Antezana', email: correoEst('avatar'), role: 'STUDENT', semester: 5,
  });
  await req('POST', '/profiles/me', { token: est.token, body: { improvementAreaIds: [] } });
  await req('PATCH', '/profiles/me', { token: est.token, body: { availability: 'open' } });

  const conAvatar = await req('PATCH', '/profiles/me', { token: est.token, body: { avatarKey: 'database' } });
  check(conAvatar.status === 200 && conAvatar.data?.avatarKey === 'database',
    'V3.5.1 §11.2 El estudiante elige un avatar del catálogo', json({ s: conAvatar.status, a: conAvatar.data?.avatarKey }));
  const ajeno = await req('PATCH', '/profiles/me', { token: est.token, body: { avatarKey: 'https://x.test/foto.png' } });
  check(ajeno.status === 400, 'V3.5.2 §11.2 Nada fuera del catálogo: ni URLs ni claves inventadas', `status ${ajeno.status}`);
  const sinAvatar = await req('PATCH', '/profiles/me', { token: est.token, body: { avatarKey: null } });
  check(sinAvatar.status === 200 && sinAvatar.data?.avatarKey === null, 'V3.5.3 §11.2 Puede quitarlo', `status ${sinAvatar.status}`);

  const soloBio = await req('PATCH', '/profiles/me', { token: est.token, body: { bio: 'Me interesan los datos.' } });
  check(soloBio.status === 200 && soloBio.data?.bio === 'Me interesan los datos.' && soloBio.data?.availability === 'open',
    'V3.5.4 §11.1 Cada pestaña guarda lo suyo: cambiar «Sobre mí» no toca la disponibilidad', json({ b: soloBio.data?.bio, d: soloBio.data?.availability }));
  const semestre = await req('PATCH', '/profiles/me', { token: est.token, body: { semester: 2 } });
  check(semestre.status === 400, 'V3.5.5 §6.1 El semestre sigue siendo institucional (400)', `status ${semestre.status}`);
}

// ===========================================================================
//  BATCH 6 — Modelo unificado de oportunidades (§12)
// ===========================================================================
async function batch6(ctx) {
  objective('BATCH 6 · Internas y externas, multiárea, revisión por actor y responsable');
  const letras = (n) => String.fromCharCode(...String(TS + n).slice(-6).split('').map((d) => 65 + Number(d)));
  const sufijo = letras(9);
  const staff = (k, role) => provisionAndActivate(ctx.admin, { firstName: 'Opor', lastName: 'Tunidad', email: correoStaff(`b6${k}`), role });
  const director = await staff('dir', 'CAREER_DIRECTOR');
  const docente = await staff('doc', 'TEACHER');
  const sociedad = await staff('soc', 'SCIENTIFIC_SOCIETY');
  await req('PUT', `/users/${docente.userId}/semesters`, { token: ctx.admin, body: { semesters: [1, 2, 3, 4] } });

  const area = async (n, tag) => (await req('POST', '/academic-areas', {
    token: ctx.admin, body: { name: `${n} ${sufijo}`, tags: [`${tag}${sufijo.toLowerCase()}`] },
  })).data;
  const areaA = await area('Robotica Movil', 'robmov');
  const areaB = await area('Vision Artificial', 'vision');
  const areaC = await area('Contabilidad Digital', 'conta');
  const skill = async (n, a) => (await req('POST', '/skills', { token: ctx.admin, body: { name: `${n} ${sufijo}`, academicAreaId: a.id } })).data;
  const sA = await skill('Lidar Kit', areaA);
  const sB = await skill('Optic Flow', areaB);
  const sC = await skill('Ledger Pro', areaC);
  const cats = (await req('GET', '/activity-categories', { token: director.token })).data ?? [];
  const taller = cats.find((c) => c.code === 'taller_academico') ?? cats[0];
  const extra = cats.find((c) => c.appliesTo === 'extracurricular') ?? cats[0];

  // ----- §12.1 Multiárea + habilidades de esas áreas
  const base = { type: 'academica', categoryId: taller.id, semesterScope: [1, 2] };
  const multi = await req('POST', '/activities', {
    token: director.token,
    body: { ...base, title: `Taller de percepción ${TS}`, areaIds: [areaA.id, areaB.id], skillIds: [sA.id, sB.id], status: 'open' },
  });
  check(multi.status === 201 && (multi.data?.activityAreas ?? []).length === 2 && multi.data?.academicAreaId === areaA.id,
    'V3.6.1 §12.1 Una oportunidad toca varias áreas; la primera es la principal', json({ s: multi.status, n: multi.data?.activityAreas?.length }));
  check(multi.data?.originType === 'internal' && multi.data?.reviewStatus === 'not_required',
    'V3.6.2 §12.2 Dirección crea internas académicas sin revisión (NOT_REQUIRED)', json({ o: multi.data?.originType, r: multi.data?.reviewStatus }));
  const ajena = await req('POST', '/activities', {
    token: director.token,
    body: { ...base, title: `Taller incoherente ${TS}`, areaIds: [areaA.id], skillIds: [sC.id] },
  });
  check(ajena.status === 400 && /otra área/.test(json(ajena.data?.fields?.skillIds)),
    'V3.6.3 §4 Una habilidad de un área no elegida → 400 en su campo', json(ajena.data?.fields));

  // ----- §12.1 Externas
  const sinProveedor = await req('POST', '/activities', {
    token: docente.token,
    body: { ...base, title: `Curso CCNA ${TS}`, originType: 'external', areaIds: [areaA.id] },
  });
  check(sinProveedor.status === 400 && sinProveedor.data?.fields?.provider && sinProveedor.data?.fields?.externalUrl,
    'V3.6.4 §12.1 Una externa exige proveedor y enlace oficial (errores por campo)', json(sinProveedor.data?.fields));
  const externa = await req('POST', '/activities', {
    token: docente.token,
    body: {
      ...base, title: `Curso CCNA ${TS}`, originType: 'external', areaIds: [areaA.id],
      provider: 'Cisco Networking Academy', externalUrl: 'https://www.netacad.com/courses/ccna',
      credentialExpected: true, expectedIssuerDomains: ['https://www.NetAcad.com/path', 'credly.com'],
      expectedKeywords: ['Introduction to Networks'],
    },
  });
  check(externa.status === 201 && externa.data?.originType === 'external' && externa.data?.credentialExpected === true,
    'V3.6.5 §12.1 El docente propone una externa con proveedor y credencial esperada', json({ s: externa.status, o: externa.data?.originType }));
  check(json(externa.data?.expectedIssuerDomains) === json(['www.netacad.com', 'credly.com']),
    'V3.6.6 §17 Los dominios del emisor se guardan normalizados', json(externa.data?.expectedIssuerDomains));
  check(externa.data?.requiresReview === true && externa.data?.status === 'draft',
    'V3.6.7 §12.2 Lo que propone el docente (también externas) pasa por Dirección', json({ r: externa.data?.requiresReview, st: externa.data?.status }));
  const dominioMalo = await req('POST', '/activities', {
    token: director.token,
    body: { ...base, title: `Curso raro ${TS}`, originType: 'external', provider: 'X', externalUrl: 'https://x.test', expectedIssuerDomains: ['no es un dominio'] },
  });
  check(dominioMalo.status === 400, 'V3.6.8 §49 Un dominio inválido → 400', `status ${dominioMalo.status}`);
  const deSociedad = await req('POST', '/activities', {
    token: sociedad.token,
    body: {
      title: `Bootcamp externo ${TS}`, type: 'extracurricular', categoryId: extra.id, originType: 'external',
      provider: 'IBM SkillsBuild', externalUrl: 'https://skillsbuild.org', areaIds: [areaB.id],
    },
  });
  check(deSociedad.status === 201 && deSociedad.data?.requiresReview === true,
    'V3.6.9 §12.2 La Sociedad propone externas complementarias que revisa Dirección', json({ s: deSociedad.status, r: deSociedad.data?.requiresReview }));

  // ----- §6.5, §12.2 Administración excepcional con responsable
  const adminSin = await req('POST', '/activities', { token: ctx.admin, body: { ...base, title: `Operativa ${TS}`, status: 'open' } });
  check(adminSin.status === 400 && adminSin.data?.fields?.responsibleUserId,
    'V3.6.10 §6.5 Administración debe nombrar un responsable académico', json(adminSin.data?.fields));
  const adminConSociedad = await req('POST', '/activities', {
    token: ctx.admin, body: { ...base, title: `Operativa ${TS}`, responsibleUserId: sociedad.userId },
  });
  check(adminConSociedad.status === 400, 'V3.6.11 §12.2 El responsable de una académica es docente o Dirección', `status ${adminConSociedad.status}`);
  const adminOk = await req('POST', '/activities', {
    token: ctx.admin, body: { ...base, title: `Operativa ${TS}`, responsibleUserId: docente.userId, status: 'open' },
  });
  check(adminOk.status === 201 && adminOk.data?.reviewStatus === 'not_required' && adminOk.data?.responsibleUserId === docente.userId,
    'V3.6.12 §12.2 Administración publica sin revisión y conserva al responsable real', json({ r: adminOk.data?.reviewStatus, resp: adminOk.data?.responsibleUserId === docente.userId }));
  const reasignaDocente = await req('PATCH', `/activities/${multi.data.id}`, { token: director.token, body: { responsibleUserId: docente.userId } });
  check(reasignaDocente.status === 403, 'V3.6.13 Solo Administración reasigna el responsable', `status ${reasignaDocente.status}`);

  // ----- Listados
  const soloExternas = await req('GET', '/activities?originType=external', { token: director.token });
  check((soloExternas.data ?? []).length > 0 && (soloExternas.data ?? []).every((x) => x.originType === 'external'),
    'V3.6.14 §12 Se filtran las externas', `${(soloExternas.data ?? []).length} filas`);
  const porAreaB = await req('GET', `/activities?areaId=${areaB.id}`, { token: director.token });
  check((porAreaB.data ?? []).some((x) => x.id === multi.data.id),
    'V3.6.15 §12.1 Filtrar por un área encuentra las oportunidades que la tienen como secundaria', `${(porAreaB.data ?? []).length} filas`);
  const est = await provisionAndActivate(ctx.admin, { firstName: 'Ruth', lastName: 'Saavedra', email: correoEst('b6'), role: 'STUDENT', semester: 2 });
  const vistas = await req('GET', '/activities', { token: est.token });
  const vista = (vistas.data ?? []).find((x) => x.id === multi.data.id);
  check(vista?.originType === 'internal' && (vista?.activityAreas ?? []).length === 2 && vista?.provider === null,
    'V3.6.16 §12 El estudiante ve un único universo: origen y áreas de cada oportunidad', json({ o: vista?.originType, n: vista?.activityAreas?.length }));
}

// ===========================================================================
//  BATCH 7 — Participación interna y resultados (§13, §14)
// ===========================================================================
async function batch7(ctx) {
  objective('BATCH 7 · Sin evidencia del estudiante, política de resultado y constancia automática');
  const director = await provisionAndActivate(ctx.admin, {
    firstName: 'Ines', lastName: 'Barrientos', email: correoStaff('b7dir'), role: 'CAREER_DIRECTOR',
  });
  const est = await provisionAndActivate(ctx.admin, {
    firstName: 'Tobias', lastName: 'Cuba', email: correoEst('b7'), role: 'STUDENT', semester: 3,
  });
  const perfil = await req('GET', '/profiles/me', { token: est.token });
  const profileId = perfil.data?.id;
  const cats = (await req('GET', '/activity-categories', { token: director.token })).data ?? [];
  const taller = cats.find((c) => c.code === 'taller_academico') ?? cats[0];
  const crear = (titulo, extra = {}) => req('POST', '/activities', {
    token: director.token,
    body: { title: `${titulo} ${TS}`, type: 'academica', categoryId: taller.id, status: 'open', ...extra },
  });

  const conConstancia = await crear('Clase espejo con constancia', { outcomePolicy: 'internal_constancy', evidenceRequired: true });
  check(conConstancia.status === 201 && conConstancia.data?.outcomePolicy === 'internal_constancy'
    && conConstancia.data?.internalConstancyEnabled === true,
  'V3.7.1 §14 La oportunidad declara qué genera al terminar (constancia interna)', json({ p: conConstancia.data?.outcomePolicy }));
  check(conConstancia.data?.evidenceRequired === false,
    'V3.7.2 §13.1 Nunca se pide al estudiante evidencia de asistencia (el flag se ignora)', json(conConstancia.data?.evidenceRequired));
  const externaConConstancia = await crear('Curso externo', {
    originType: 'external', provider: 'Coursera', externalUrl: 'https://coursera.org/x', outcomePolicy: 'internal_constancy',
  });
  check(externaConConstancia.status === 400 && externaConConstancia.data?.fields?.outcomePolicy,
    'V3.7.3 §14 Una externa no emite constancia interna (su resultado es la credencial)', `status ${externaConConstancia.status}`);

  // ----- Participación
  const insc = await req('POST', `/activities/${conConstancia.data.id}/register`, { token: est.token });
  check(insc.status === 201 || insc.status === 200, 'V3.7.4 §13 El estudiante se inscribe', `status ${insc.status}`);
  const auditoria = await req('GET', `/audit/events?eventType=ACTIVITY_REGISTERED&entityId=${insc.data?.id}`, { token: ctx.admin });
  const eventos = auditoria.data?.items ?? auditoria.data ?? [];
  check(Array.isArray(eventos) && eventos.length >= 1, 'V3.7.5 §65 La inscripción queda auditada (ACTIVITY_REGISTERED)', json(auditoria.data).slice(0, 120));
  const evidencia = await req('POST', '/evidences', {
    token: est.token,
    body: { evidenceType: 'link', externalUrl: 'https://foto.test/estuve.jpg', description: 'Estuve', activityId: conConstancia.data.id },
  });
  check(evidencia.status === 400 && evidencia.data?.code === 'ACTIVITY_EVIDENCE_NOT_REQUIRED',
    'V3.7.6 §13.1 El estudiante no sube evidencia de que fue a una actividad', json({ s: evidencia.status, c: evidencia.data?.code }));

  const confirmar = (status) => req('PATCH', `/activities/${conConstancia.data.id}/confirm-participation`, {
    token: director.token, body: { studentProfileId: profileId, status },
  });
  const confirmada = await confirmar('confirmed');
  check(confirmada.status === 200, 'V3.7.7 §13 El responsable confirma la participación', `status ${confirmada.status}`);
  const mias = async () => ((await req('GET', '/constancies/internal/my', { token: est.token })).data ?? [])
    .filter((c) => c.activityId === conConstancia.data.id);
  const tras = await mias();
  check(tras.length === 1 && tras[0].status === 'authorized' && tras[0].issuedById === director.userId,
    'V3.7.8 §14.1 La constancia aparece sola en la trayectoria, emitida por el responsable', json(tras.map((c) => ({ s: c.status, i: c.issuedById === director.userId }))));
  const manual = await req('POST', '/constancies/internal', {
    token: director.token, body: { profileId, activityId: conConstancia.data.id, description: 'Constancia pedida otra vez por la misma participación.' },
  });
  check(manual.data?.id === tras[0]?.id, 'V3.7.9 §38 Pedirla otra vez no la duplica', json({ s: manual.status }));

  await confirmar('absent');
  const corregida = await mias();
  check(corregida.length === 1 && corregida[0].status === 'rejected',
    'V3.7.10 §14.1 Si la confirmación se corrige a ausente, la constancia queda rechazada (no se borra)', json(corregida.map((c) => c.status)));
  await confirmar('confirmed');
  const otraVez = await mias();
  check(otraVez.length === 1 && otraVez[0].status === 'authorized', 'V3.7.11 Y vuelve a valer si se confirma de nuevo', json(otraVez.map((c) => c.status)));

  // ----- Sin política de constancia, confirmar no emite nada
  const sinConstancia = await crear('Charla abierta', { outcomePolicy: 'none' });
  await req('POST', `/activities/${sinConstancia.data.id}/register`, { token: est.token });
  await req('PATCH', `/activities/${sinConstancia.data.id}/confirm-participation`, {
    token: director.token, body: { studentProfileId: profileId, status: 'confirmed' },
  });
  const ninguna = ((await req('GET', '/constancies/internal/my', { token: est.token })).data ?? [])
    .filter((c) => c.activityId === sinConstancia.data.id);
  check(ninguna.length === 0, 'V3.7.12 §14 Sin política de constancia, confirmar no emite constancia', `${ninguna.length}`);

  // ----- §14.2 Interna que conduce a una credencial externa
  const haciaCredencial = await crear('Taller preparatorio CCNA', {
    outcomePolicy: 'external_credential_expected', provider: 'Cisco Networking Academy', expectedIssuerDomains: ['netacad.com'],
  });
  check(haciaCredencial.status === 201 && haciaCredencial.data?.originType === 'internal'
    && haciaCredencial.data?.credentialExpected === true && haciaCredencial.data?.provider === 'Cisco Networking Academy',
  'V3.7.13 §14.2 Una interna puede conducir a una credencial de un tercero (con su proveedor)', json({ o: haciaCredencial.data?.originType, c: haciaCredencial.data?.credentialExpected }));
}

// ===========================================================================
//  BATCH 8 — Oportunidades externas y credenciales (§15, §16, §17)
// ===========================================================================
async function batch8(ctx) {
  objective('BATCH 8 · Aceptación, elegibilidad, credencial histórica y referencia de validación');
  const director = await provisionAndActivate(ctx.admin, {
    firstName: 'Paula', lastName: 'Rengel', email: correoStaff('b8dir'), role: 'CAREER_DIRECTOR',
  });
  const docente = await provisionAndActivate(ctx.admin, {
    firstName: 'Mario', lastName: 'Quispe', email: correoStaff('b8doc'), role: 'TEACHER',
  });
  const estudiante = async (k, nombre) => {
    const e = await provisionAndActivate(ctx.admin, {
      firstName: nombre, lastName: 'Villca', email: correoEst(`b8${k}`), role: 'STUDENT', semester: 4,
    });
    e.profileId = (await req('GET', '/profiles/me', { token: e.token })).data?.id;
    return e;
  };
  const est = await estudiante('a', 'Lucia');
  const otro = await estudiante('b', 'Ramiro');

  const cats = (await req('GET', '/activity-categories', { token: director.token })).data ?? [];
  const cat = cats.find((c) => c.code === 'curso_externo_recomendado') ?? cats.find((c) => c.code === 'taller_academico') ?? cats[0];
  const dia = 24 * 3600 * 1000;
  const crear = (titulo, extra = {}) => req('POST', '/activities', {
    token: director.token,
    body: { title: `${titulo} ${TS}`, type: 'academica', categoryId: cat.id, status: 'open', ...extra },
  });
  const externa = (titulo, extra = {}) => crear(titulo, {
    originType: 'external', provider: 'Cisco Networking Academy', externalUrl: 'https://www.netacad.com/courses',
    outcomePolicy: 'external_credential_expected', expectedIssuerDomains: ['netacad.com', 'credly.com'],
    expectedKeywords: ['Introduction to Networks'], ...extra,
  });
  const decidir = (actividad, e, status) => req('PATCH', `/activities/${actividad.id}/confirm-participation`, {
    token: director.token, body: { studentProfileId: e.profileId, status },
  });
  const elegibles = async (e) => (await req('GET', '/certificates/external/eligible-opportunities', { token: e.token })).data ?? [];
  const auditoria = async (tipo, entityId) => {
    const r = await req('GET', `/audit/events?eventType=${tipo}&entityId=${entityId}`, { token: ctx.admin });
    return r.data?.items ?? r.data ?? [];
  };

  // ----- §15 Aceptación: externa en curso
  const ccna = (await externa('CCNA Introduction to Networks', {
    activityDate: new Date(Date.now() + 2 * dia).toISOString(),
    endAt: new Date(Date.now() + 30 * dia).toISOString(),
    capacity: 1,
  })).data;
  check(!!ccna?.id && ccna.originType === 'external', 'V3.8.1 §12 Se crea la oportunidad externa del proveedor', json({ o: ccna?.originType }));

  const insc = await req('POST', `/activities/${ccna.id}/register`, { token: est.token });
  await req('POST', `/activities/${ccna.id}/register`, { token: otro.token });
  check(insc.status === 201 || insc.status === 200, 'V3.8.2 §15 El estudiante se registra (REGISTERED)', `status ${insc.status}`);

  const confirmarExterna = await decidir(ccna, est, 'confirmed');
  check(confirmarExterna.status === 400 && confirmarExterna.data?.code === 'EXTERNAL_USES_ACCEPTANCE',
    'V3.8.3 §15 En una externa no se «confirma asistencia»: se registra la aceptación', json({ s: confirmarExterna.status, c: confirmarExterna.data?.code }));

  const aceptada = await decidir(ccna, est, 'accepted');
  check(aceptada.status === 200 && aceptada.data?.status === 'accepted' && !!aceptada.data?.acceptedAt,
    'V3.8.4 §15 El responsable registra que el proveedor lo aceptó (ACCEPTED)', json({ s: aceptada.status, st: aceptada.data?.status }));
  check((await auditoria('EXTERNAL_OPPORTUNITY_ACCEPTED', aceptada.data?.id)).length >= 1,
    'V3.8.5 §65 La aceptación queda auditada (EXTERNAL_OPPORTUNITY_ACCEPTED)');

  const sinCupo = await decidir(ccna, otro, 'accepted');
  check(sinCupo.status === 400, 'V3.8.6 §12 La aceptación ocupa cupo: con cupo 1, no entra un segundo', `status ${sinCupo.status}`);

  const baja = await req('POST', `/activities/${ccna.id}/cancel-registration`, { token: est.token });
  check(baja.status === 400, 'V3.8.7 Aceptado, el estudiante ya no se da de baja por su cuenta', `status ${baja.status}`);

  const detalle = await req('GET', `/activities/${ccna.id}`, { token: est.token });
  check(detalle.data?.myRegistration?.status === 'accepted' && detalle.data?.myRegistration?.evidenceEligible === false,
    'V3.8.8 §15 ACCEPTED ≠ CREDENTIAL_EARNED: mientras no termine, no habilita adjuntar', json(detalle.data?.myRegistration));
  check(!(await elegibles(est)).some((o) => o.activityId === ccna.id),
    'V3.8.9 §15 La oportunidad en curso no aparece en «Adjuntar credencial»');
  const antes = await req('POST', '/certificates/external', {
    token: est.token,
    body: { certificateName: `CCNA ITN ${TS}`, issuer: 'Cisco', activityId: ccna.id },
  });
  check(antes.status === 400 && antes.data?.code === 'CREDENTIAL_OPPORTUNITY_NOT_ELIGIBLE',
    'V3.8.10 §15 Y la API lo rechaza aunque se envíe el id a mano', json({ s: antes.status, c: antes.data?.code }));

  const interna = (await crear('Charla de redes', { outcomePolicy: 'none' })).data;
  await req('POST', `/activities/${interna.id}/register`, { token: est.token });
  const aceptarInterna = await decidir(interna, est, 'accepted');
  check(aceptarInterna.status === 400 && aceptarInterna.data?.code === 'ACCEPTANCE_ONLY_EXTERNAL',
    'V3.8.11 §15 Una interna no tiene «aceptación del proveedor»', json({ s: aceptarInterna.status, c: aceptarInterna.data?.code }));

  // ----- §17 Referencia de validación
  const ref = (actividad, token, body) => req('PUT', `/activities/${actividad.id}/validation-reference`, { token, body });
  const deEst = await req('GET', `/activities/${ccna.id}/validation-reference`, { token: est.token });
  check(deEst.status === 403, 'V3.8.12 §17 Un estudiante no ve la referencia de validación -> 403', `status ${deEst.status}`);
  const deDocente = await ref(ccna, docente.token, { expectedCourseName: 'Otro curso' });
  check(deDocente.status === 403, 'V3.8.13 §17 Un docente que no responde por la oportunidad no la edita -> 403', `status ${deDocente.status}`);
  const patronMalo = await ref(ccna, director.token, { credentialIdPattern: '(a+)+$' });
  check(patronMalo.status === 400 && patronMalo.data?.fields?.credentialIdPattern,
    'V3.8.14 §17 El patrón del código no admite expresiones libres (sin ReDoS)', json({ s: patronMalo.status }));
  const enInterna = await ref(interna, director.token, { expectedCourseName: 'x' });
  check(enInterna.status === 400 && enInterna.data?.code === 'NO_CREDENTIAL_EXPECTED',
    'V3.8.15 §17 Solo una oportunidad que espera credencial lleva referencia', json({ s: enInterna.status, c: enInterna.data?.code }));

  const pdf = Buffer.from('%PDF-1.4\n1 0 obj<</Type/Catalog>>endobj\ntrailer<</Root 1 0 R>>\n%%EOF\n', 'utf8');
  const subir = async (token, nombre) => {
    const form = new FormData();
    form.append('file', new Blob([pdf], { type: 'application/pdf' }), nombre);
    return req('POST', '/uploads', { token, raw: form });
  };
  const ejemplo = await subir(director.token, 'ejemplo-ccna.pdf');
  check(ejemplo.status === 201, 'V3.8.16 §17 El responsable sube el certificado de ejemplo', `status ${ejemplo.status}`);
  const ajeno = await subir(est.token, 'mio.pdf');
  const conAjeno = await ref(ccna, director.token, { sampleStoredFileId: ajeno.data?.id });
  check(conAjeno.status === 403 || conAjeno.status === 404,
    'V3.8.17 §27 No puede enlazar como ejemplo un archivo de otra persona', `status ${conAjeno.status}`);
  const guardada = await ref(ccna, director.token, {
    expectedCourseName: 'CCNA: Introduction to Networks', credentialIdPattern: 'NA-####-@@*', sampleStoredFileId: ejemplo.data?.id,
  });
  check(guardada.status === 200 && guardada.data?.expectedCourseName === 'CCNA: Introduction to Networks'
    && guardada.data?.credentialIdPattern === 'NA-####-@@*' && guardada.data?.sampleFileName === 'ejemplo-ccna.pdf'
    && (guardada.data?.expectedIssuerDomains ?? []).includes('netacad.com') && guardada.data?.provider === 'Cisco Networking Academy',
  'V3.8.18 §17 Referencia: curso esperado, patrón, ejemplo, y los dominios y proveedor de la oportunidad', json(guardada.data));
  check((await auditoria('VALIDATION_REFERENCE_UPDATED', ccna.id)).length >= 1, 'V3.8.19 §65 La referencia queda auditada');
  const url = guardada.data?.sampleFileUrl ?? '';
  const archivo = (token) => fetch(`${API.replace(/\/api$/, '')}${url}`, { headers: { Authorization: `Bearer ${token}` } });
  check((await archivo(director.token)).status === 200, 'V3.8.20 §17 El responsable abre el ejemplo');
  check((await archivo(est.token)).status === 404, 'V3.8.21 §17 Un estudiante no puede bajar el ejemplo (no es una plantilla para imitar)');

  // ----- §15 Finaliza → elegible
  const cerrar = await req('PATCH', `/activities/${ccna.id}`, { token: director.token, body: { status: 'finished' } });
  check(cerrar.status === 200, 'V3.8.22 El responsable da por finalizada la oportunidad', `status ${cerrar.status}`);
  const lista = await elegibles(est);
  const item = lista.find((o) => o.activityId === ccna.id);
  check(!!item && item.provider === 'Cisco Networking Academy' && item.expectedCourseName === 'CCNA: Introduction to Networks',
    'V3.8.23 §15 Terminada y aceptado: aparece en «Adjuntar credencial» (EVIDENCE_ELIGIBLE)', json(lista));
  check((await auditoria('EXTERNAL_EVIDENCE_ENABLED', aceptada.data?.id)).length >= 1,
    'V3.8.24 §15 Se registra que la evidencia quedó habilitada (punto de notificación para B16)');
  check(!(await elegibles(otro)).some((o) => o.activityId === ccna.id),
    'V3.8.25 §15 A quien no fue aceptado no le aparece');
  const ajena = await req('POST', '/certificates/external', {
    token: otro.token, body: { certificateName: `CCNA ajeno ${TS}`, issuer: 'Cisco', activityId: ccna.id },
  });
  check(ajena.status === 400, 'V3.8.26 §15 Ni puede adjuntar una credencial a esa oportunidad', `status ${ajena.status}`);

  const credencial = await req('POST', '/certificates/external', {
    token: est.token,
    body: { certificateName: `CCNA ITN ${TS}`, issuer: 'Cisco Networking Academy', activityId: ccna.id, credentialId: 'NA-2026-AB7' },
  });
  check(credencial.status === 201 && credencial.data?.source === 'opportunity' && credencial.data?.activityId === ccna.id,
    'V3.8.27 §15 Adjunta la credencial de la oportunidad (source = opportunity)', json({ s: credencial.status, src: credencial.data?.source }));
  check((await auditoria('EXTERNAL_CREDENTIAL_CREATED', credencial.data?.id)).length >= 1,
    'V3.8.28 §65 Auditada (EXTERNAL_CREDENTIAL_CREATED)');
  const repetida = await req('POST', '/certificates/external', {
    token: est.token, body: { certificateName: `CCNA ITN bis ${TS}`, issuer: 'Cisco', activityId: ccna.id },
  });
  check(repetida.status === 409, 'V3.8.29 Una sola credencial por oportunidad', `status ${repetida.status}`);
  check(!(await elegibles(est)).some((o) => o.activityId === ccna.id),
    'V3.8.30 Ya adjunta, deja de aparecer en el selector');
  const mias = (await req('GET', '/certificates/external/my', { token: est.token })).data ?? [];
  const vista = mias.find((c) => c.id === credencial.data?.id);
  check(vista?.activity?.title?.startsWith('CCNA Introduction to Networks') && vista?.activity?.creatorId === undefined,
    'V3.8.31 §5.6 La procedencia se ve: de qué oportunidad viene (sin datos internos de la oportunidad)', json(vista?.activity));
  const cambiar = await req('PATCH', `/certificates/external/${credencial.data?.id}`, {
    token: est.token, body: { activityId: interna.id },
  });
  check(cambiar.status === 400, 'V3.8.32 §16 El origen no se cambia editando la credencial', `status ${cambiar.status}`);

  // ----- §16 Histórica
  const historica = await req('POST', '/certificates/external', {
    token: est.token,
    body: { certificateName: `AWS Cloud Practitioner ${TS}`, issuer: 'Amazon Web Services', issueDate: '2024-05-10', credentialId: 'AWS-123' },
  });
  check(historica.status === 201 && historica.data?.source === 'historical_external' && historica.data?.activityId === null,
    'V3.8.33 §16 Una credencial histórica no exige oportunidad previa (source = historical_external)', json({ s: historica.status, src: historica.data?.source }));

  // ----- Aceptar una externa que ya terminó la habilita en el acto
  // Se inscribió mientras estaba abierta; el responsable registra la
  // aceptación cuando ya terminó.
  const futuro = { activityDate: new Date(Date.now() + 3 * dia).toISOString(), endAt: new Date(Date.now() + 4 * dia).toISOString() };
  const yaPaso = { activityDate: new Date(Date.now() - 40 * dia).toISOString(), endAt: new Date(Date.now() - 10 * dia).toISOString() };
  const pasada = (await externa('Cybersecurity Essentials', futuro)).data;
  await req('POST', `/activities/${pasada.id}/register`, { token: otro.token });
  await req('PATCH', `/activities/${pasada.id}`, { token: director.token, body: yaPaso });
  const tarde = await decidir(pasada, otro, 'accepted');
  check(tarde.status === 200 && (await elegibles(otro)).some((o) => o.activityId === pasada.id),
    'V3.8.34 §15 Aceptado en una que ya terminó: elegible de inmediato', `status ${tarde.status}`);
  check((await auditoria('EXTERNAL_EVIDENCE_ENABLED', tarde.data?.id)).length >= 1,
    'V3.8.35 §15 Y queda registrado el aviso de evidencia habilitada');

  // ----- §14.2 Interna con credencial de un tercero
  const prepa = (await crear('Taller preparatorio Linux Essentials', {
    outcomePolicy: 'external_credential_expected', provider: 'Linux Professional Institute', ...futuro,
  })).data;
  await req('POST', `/activities/${prepa.id}/register`, { token: est.token });
  await req('PATCH', `/activities/${prepa.id}`, { token: director.token, body: yaPaso });
  await decidir(prepa, est, 'confirmed');
  check((await elegibles(est)).some((o) => o.activityId === prepa.id && o.originType === 'internal'),
    'V3.8.36 §14.2 Una interna que conduce a una credencial también la habilita al confirmar y terminar');
}

const BATCHES = { batch2, batch4, batch5, batch6, batch7, batch8 };

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
