/**
 * Especificación Maestra Final V3.1 — verificación contra la API en marcha.
 *
 * Una sección por batch de la V3 (§72). Cada comprobación cita la sección que
 * verifica. Se ejecuta con la API en modo de correo simulado.
 *
 * Uso:
 *   API_URL=http://localhost:3010/api node scripts/e2e-v3.mjs [batch]
 *
 * La sección batch9 levanta un verificador oficial simulado en 127.0.0.1:3997:
 * la API debe arrancar con
 *   LINK_CHECK_TEST_ORIGINS=verificador.afinia-pruebas.org:3997=127.0.0.1:3997
 */

import { createHash } from 'node:crypto';
import { createServer } from 'node:http';
import QRCode from 'qrcode';
import {
  API, aprobarActividad, asegurarGithubSimulado, codigoUniversitario, crearProyectoActivo, crearProyectoBorrador, loginAdmin, provisionAndActivate,
  githubSimuladoLog, repoDePrueba, repoQueCorrobora, req,
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

// ===========================================================================
//  BATCH 9 — Validación escalonada de credenciales (§18, §19, §20)
// ===========================================================================
/**
 * Verificador «oficial» simulado en 127.0.0.1:3997, publicado con un nombre de
 * dominio. La API de desarrollo debe arrancar con
 *   LINK_CHECK_TEST_ORIGINS=verificador.afinia-pruebas.org:3997=127.0.0.1:3997
 * (en producción se ignora): es la única excepción a la protección SSRF.
 */
const PUERTO_VERIFICADOR = 3997;
const DOMINIO_VERIFICADOR = 'afinia-pruebas.org';
const BASE_VERIFICADOR = `http://verificador.${DOMINIO_VERIFICADOR}:${PUERTO_VERIFICADOR}`;

function levantarVerificador(est) {
  const sal = 'sal-b9';
  const hash = createHash('sha256').update(est.email + sal).digest('hex');
  const asercion = (identity) => JSON.stringify({
    '@context': 'https://w3id.org/openbadges/v2',
    type: 'Assertion',
    id: `${BASE_VERIFICADOR}/badge/${identity === 'propia' ? 'ok' : 'otra'}.json`,
    recipient: { type: 'email', hashed: true, salt: sal, identity: identity === 'propia' ? `sha256$${hash}` : 'sha256$00ff00' },
    verification: { type: 'hosted' },
    badge: { name: 'CCNA Introduction to Networks', issuer: { name: 'Cisco' } },
  });
  const server = createServer((rq, rs) => {
    const html = (cuerpo) => { rs.writeHead(200, { 'content-type': 'text/html; charset=utf-8' }); rs.end(`<html><head><title>Credencial</title></head><body>${cuerpo}</body></html>`); };
    if (rq.url === '/cert/ok') return html(`Credential NA-2026-AB7 issued to ${est.nombre} for CCNA Introduction to Networks by Cisco Networking Academy`);
    if (rq.url === '/cert/otra') return html('Credential NA-2026-AB7 issued to Persona Distinta for CCNA Introduction to Networks');
    if (rq.url === '/cert/spa') return html('<div id="root"></div><script>/* requiere JavaScript */</script>');
    if (rq.url === '/cert/caido') { rs.writeHead(503); return rs.end(); }
    if (rq.url === '/badge/ok.json' || rq.url === '/badge/otra.json') {
      rs.writeHead(200, { 'content-type': 'application/json' });
      return rs.end(asercion(rq.url === '/badge/ok.json' ? 'propia' : 'otra'));
    }
    rs.writeHead(404); rs.end();
  });
  return new Promise((resolve) => server.listen(PUERTO_VERIFICADOR, '127.0.0.1', () => resolve(server)));
}

/** PDF mínimo con texto nativo legible (§18.4). */
function pdfConTexto(lineas) {
  const contenido = `BT\n/F1 14 Tf\n72 720 Td\n${lineas.map((l, i) => `${i === 0 ? '' : '0 -24 Td\n'}(${l.replace(/([()\\])/g, '\\$1')}) Tj\n`).join('')}ET\n`;
  const objetos = [
    '<< /Type /Catalog /Pages 2 0 R >>',
    '<< /Type /Pages /Kids [3 0 R] /Count 1 >>',
    '<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Resources << /Font << /F1 5 0 R >> >> /Contents 4 0 R >>',
    `<< /Length ${Buffer.byteLength(contenido, 'latin1')} >>\nstream\n${contenido}\nendstream`,
    '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>',
  ];
  let out = '%PDF-1.4\n';
  const offsets = [];
  objetos.forEach((o, i) => { offsets.push(Buffer.byteLength(out, 'latin1')); out += `${i + 1} 0 obj\n${o}\nendobj\n`; });
  const xref = Buffer.byteLength(out, 'latin1');
  out += `xref\n0 ${objetos.length + 1}\n0000000000 65535 f \n${offsets.map((o) => `${String(o).padStart(10, '0')} 00000 n \n`).join('')}`;
  out += `trailer\n<< /Size ${objetos.length + 1} /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF\n`;
  return Buffer.from(out, 'latin1');
}

async function subirArchivo(token, buffer, nombre, tipo) {
  const form = new FormData();
  form.append('file', new Blob([buffer], { type: tipo }), nombre);
  return req('POST', '/uploads', { token, raw: form });
}

async function batch9(ctx) {
  objective('BATCH 9 · Validación escalonada: fuente oficial, QR, insignias, FLAGGED y revisión excepcional');
  const director = await provisionAndActivate(ctx.admin, {
    firstName: 'Elena', lastName: 'Saavedra', email: correoStaff('b9dir'), role: 'CAREER_DIRECTOR',
  });
  const docente = await provisionAndActivate(ctx.admin, {
    firstName: 'Hugo', lastName: 'Arce', email: correoStaff('b9doc'), role: 'TEACHER',
  });
  const est = await provisionAndActivate(ctx.admin, {
    firstName: 'Valeria', lastName: 'Montaño', email: correoEst('b9'), role: 'STUDENT', semester: 6,
  });
  est.email = correoEst('b9');
  est.nombre = 'Valeria Montaño';
  est.profileId = (await req('GET', '/profiles/me', { token: est.token })).data?.id;
  const servidor = await levantarVerificador(est);

  try {
    const veredicto = async (id) => {
      for (let i = 0; i < 40; i++) {
        await req('POST', '/validation/run?limit=50', { token: ctx.admin });
        const v = await req('GET', `/validation/external_certificate/${id}`, { token: est.token });
        if (v.data && !['pending', 'processing'].includes(v.data.status)) return v.data;
        await new Promise((r) => setTimeout(r, 400));
      }
      return null;
    };
    const credencial = async (body) => {
      const r = await req('POST', '/certificates/external', { token: est.token, body: { issueDate: '2025-06-01', ...body } });
      if (r.status !== 201) throw new Error(`no se creó la credencial: ${json(r.data)}`);
      return { id: r.data.id, v: await veredicto(r.data.id) };
    };

    // ----- Oportunidad externa con referencia (§15, §17)
    const cats = (await req('GET', '/activity-categories', { token: director.token })).data ?? [];
    const cat = cats.find((c) => c.code === 'curso_externo_recomendado') ?? cats[0];
    const dia = 86_400_000;
    const crearExterna = async (titulo) => {
      const a = (await req('POST', '/activities', {
        token: director.token,
        body: {
          title: `${titulo} ${TS}`, type: 'academica', categoryId: cat.id, status: 'open',
          originType: 'external', provider: 'Cisco Networking Academy', externalUrl: `${BASE_VERIFICADOR}/curso`,
          outcomePolicy: 'external_credential_expected', expectedIssuerDomains: [DOMINIO_VERIFICADOR],
          expectedKeywords: ['Introduction to Networks'],
          activityDate: new Date(Date.now() + dia).toISOString(), endAt: new Date(Date.now() + 2 * dia).toISOString(),
        },
      })).data;
      await req('PUT', `/activities/${a.id}/validation-reference`, {
        token: director.token, body: { expectedCourseName: 'CCNA Introduction to Networks', credentialIdPattern: 'NA-####-@@#' },
      });
      await req('POST', `/activities/${a.id}/register`, { token: est.token });
      await req('PATCH', `/activities/${a.id}/confirm-participation`, {
        token: director.token, body: { studentProfileId: est.profileId, status: 'accepted' },
      });
      await req('PATCH', `/activities/${a.id}`, { token: director.token, body: { status: 'finished' } });
      return a;
    };

    // Precondición: la API debe poder alcanzar el verificador de prueba.
    const sonda = await credencial({ certificateName: `Sonda ${TS}`, issuer: 'Academia Sonda', certificateUrl: `${BASE_VERIFICADOR}/cert/spa` });
    if (sonda.v?.linkCheck?.status === 'blocked') {
      throw new Error(`La API no tiene LINK_CHECK_TEST_ORIGINS=verificador.${DOMINIO_VERIFICADOR}:3997=127.0.0.1:3997: arránquela así para esta sección.`);
    }

    const op1 = await crearExterna('CCNA ITN oficial');
    const ok = await credencial({
      activityId: op1.id, certificateName: `CCNA Introduction to Networks 1 ${TS}`, issuer: 'Cisco Networking Academy',
      certificateUrl: `${BASE_VERIFICADOR}/cert/ok`, credentialId: 'NA-2026-AB7',
    });
    check(ok.v?.credentialCheck?.status === 'verified_match' && ok.v?.backingTier === 'corroborated',
      'V3.9.1 §18.2 URL oficial que identifica la credencial y nombra al estudiante: VERIFIED_MATCH → CORROBORATED',
      json({ c: ok.v?.credentialCheck?.status, t: ok.v?.backingTier }));
    check((ok.v?.credentialCheck?.pipeline ?? []).join(',').includes('ai:not_used')
      && ok.v?.credentialCheck?.aiUsed === false,
    'V3.9.2 §18.6 La IA no interviene en el nivel: respaldo determinista', json(ok.v?.credentialCheck?.pipeline));

    const op2 = await crearExterna('CCNA ITN ajena');
    const ajena = await credencial({
      activityId: op2.id, certificateName: `CCNA Introduction to Networks 2 ${TS}`, issuer: 'Cisco Networking Academy',
      certificateUrl: `${BASE_VERIFICADOR}/cert/otra`, credentialId: 'NA-2026-AB7',
    });
    check(ajena.v?.credentialCheck?.status === 'reachable_no_structured_proof' && ajena.v?.backingTier !== 'corroborated',
      'V3.9.3 §19 La página oficial de otra persona no corrobora (el código lo escribe quien registra)',
      json({ c: ajena.v?.credentialCheck?.status, t: ajena.v?.backingTier }));

    const spa = sonda.v;
    check(spa?.credentialCheck?.status === 'reachable_no_structured_proof' && spa?.credentialCheck?.official === null
      && spa?.backingTier !== 'corroborated',
    'V3.9.4 §20 Página que requiere JavaScript o emisor desconocido: «responde, sin prueba legible», nunca corrobora',
    json({ c: spa?.credentialCheck?.status, o: spa?.credentialCheck?.official }));

    const caido = await credencial({ certificateName: `Curso caído ${TS}`, issuer: 'Cisco', certificateUrl: `${BASE_VERIFICADOR}/cert/caido` });
    check(caido.v?.credentialCheck?.status === 'mismatch' || caido.v?.credentialCheck?.status === 'unreachable',
      'V3.9.5 (control) Una URL de Cisco fuera de sus dominios no puede corroborar', json(caido.v?.credentialCheck?.status));
    const caido2 = await credencial({ certificateName: `Proveedor caído ${TS}`, issuer: 'Academia Sin Catálogo', certificateUrl: `${BASE_VERIFICADOR}/cert/caido` });
    check(caido2.v?.credentialCheck?.status === 'unreachable' && caido2.v?.status === 'inconclusive' && caido2.v?.backingTier !== 'flagged',
      'V3.9.6 §18.2 Proveedor caído: UNREACHABLE e INCONCLUSIVE, no «falso»', json({ c: caido2.v?.credentialCheck?.status, s: caido2.v?.status, t: caido2.v?.backingTier }));

    const dominio = await credencial({ certificateName: `IBM falso dominio ${TS}`, issuer: 'IBM', certificateUrl: `${BASE_VERIFICADOR}/cert/ok` });
    check(dominio.v?.credentialCheck?.status === 'mismatch' && dominio.v?.backingTier === 'flagged'
      && (dominio.v?.credentialCheck?.contradictions ?? []).includes('verification_mismatch'),
    'V3.9.7 §19 URL a un dominio que no es del emisor declarado: FLAGGED (no se borra)', json({ c: dominio.v?.credentialCheck?.status, t: dominio.v?.backingTier }));
    const sigue = (await req('GET', '/certificates/external/my', { token: est.token })).data ?? [];
    check(sigue.some((c) => c.id === dominio.id), 'V3.9.8 §19 La credencial FLAGGED sigue registrada');

    const ssrf = await credencial({ certificateName: `Metadata ${TS}`, issuer: 'Academia X', certificateUrl: 'http://169.254.169.254/latest/meta-data' });
    check(ssrf.v?.linkCheck?.status === 'blocked' && ssrf.v?.backingTier === 'flagged',
      'V3.9.9 §49 SSRF: la metadata de la nube no se consulta y la credencial queda señalada', json({ l: ssrf.v?.linkCheck?.status, t: ssrf.v?.backingTier }));

    // ----- QR (§18.1)
    const qrInterno = await QRCode.toBuffer('http://127.0.0.1:9/interno', { type: 'png', width: 300 });
    const subidaQr = await subirArchivo(est.token, qrInterno, 'qr-interno.png', 'image/png');
    const conQr = await credencial({ certificateName: `Con QR interno ${TS}`, issuer: 'Academia Y', storedFileId: subidaQr.data?.id });
    check(conQr.v?.credentialCheck?.qr === 'qr_present' && conQr.v?.credentialCheck?.urlSource === 'qr'
      && conQr.v?.linkCheck?.status === 'blocked',
    'V3.9.10 §18.1/§49 El QR se lee y su URL pasa por la misma protección SSRF (red interna bloqueada)',
    json({ q: conQr.v?.credentialCheck?.qr, u: conQr.v?.credentialCheck?.urlSource, l: conQr.v?.linkCheck?.status }));

    const op3 = await crearExterna('CCNA ITN por QR');
    const qrOficial = await QRCode.toBuffer(`${BASE_VERIFICADOR}/cert/ok`, { type: 'png', width: 300 });
    const subidaQr2 = await subirArchivo(est.token, qrOficial, 'qr-oficial.png', 'image/png');
    const porQr = await credencial({
      activityId: op3.id, certificateName: `CCNA Introduction to Networks 3 ${TS}`, issuer: 'Cisco Networking Academy',
      storedFileId: subidaQr2.data?.id, credentialId: 'NA-2026-AB7',
    });
    check(porQr.v?.credentialCheck?.status === 'verified_match' && porQr.v?.backingTier === 'corroborated',
      'V3.9.11 §19 QR a la verificación oficial que coincide: CORROBORATED', json({ c: porQr.v?.credentialCheck?.status, t: porQr.v?.backingTier }));

    const sinQrPdf = await subirArchivo(est.token, pdfConTexto([`Certificado otorgado a ${est.nombre}`, 'Curso de Fotografia Digital', 'Academia Lumen']), 'sin-qr.pdf', 'application/pdf');
    const sinQr = await credencial({ certificateName: `Curso de Fotografia Digital ${TS}`, issuer: 'Academia Lumen', storedFileId: sinQrPdf.data?.id });
    check(sinQr.v?.credentialCheck?.qr === 'qr_absent' && sinQr.v?.status === 'completed' && sinQr.v?.backingTier === 'supported',
      'V3.9.12 §18.1/§48 Sin QR no falla: archivo legible y coherente queda SUPPORTED (respaldo parcial)',
      json({ q: sinQr.v?.credentialCheck?.qr, s: sinQr.v?.status, t: sinQr.v?.backingTier }));

    // ----- Open Badges (§18.3)
    const op4 = await crearExterna('Insignia hosted');
    const insignia = await credencial({
      activityId: op4.id, certificateName: `CCNA Introduction to Networks 4 ${TS}`, issuer: 'Cisco Networking Academy',
      certificateUrl: `${BASE_VERIFICADOR}/badge/ok.json`,
    });
    check(insignia.v?.credentialCheck?.openBadge?.format === 'open_badges_2' && insignia.v?.credentialCheck?.openBadge?.recipientMatch === true
      && insignia.v?.backingTier === 'corroborated',
    'V3.9.13 §18.3 Open Badge 2.0 hosted del emisor con destinatario propio: CORROBORATED', json(insignia.v?.credentialCheck?.openBadge));
    const insigniaAjena = await credencial({
      certificateName: `Insignia ajena ${TS}`, issuer: 'Academia Z', certificateUrl: `${BASE_VERIFICADOR}/badge/otra.json`,
    });
    check(insigniaAjena.v?.credentialCheck?.openBadge?.recipientMatch === false && insigniaAjena.v?.backingTier === 'flagged',
      'V3.9.14 §18.3 Insignia de otra persona: FLAGGED', json({ r: insigniaAjena.v?.credentialCheck?.openBadge?.recipientMatch, t: insigniaAjena.v?.backingTier }));

    // ----- Contradicciones con la referencia (§17, §19)
    const op5 = await crearExterna('Patrón');
    const patron = await credencial({
      activityId: op5.id, certificateName: `CCNA Introduction to Networks 5 ${TS}`, issuer: 'Cisco Networking Academy',
      credentialId: 'XX-1',
    });
    check(patron.v?.backingTier === 'flagged' && (patron.v?.credentialCheck?.contradictions ?? []).includes('credential_id_pattern'),
      'V3.9.15 §17 Código que no sigue el patrón del proveedor: FLAGGED', json(patron.v?.credentialCheck?.contradictions));
    const op6 = await crearExterna('Curso cambiado');
    const otroCursoPdf = await subirArchivo(est.token, pdfConTexto([`Certificate of completion ${est.nombre}`, 'Python for Data Science', 'IBM Skills Network']), 'otro-curso.pdf', 'application/pdf');
    const otroCurso = await credencial({
      activityId: op6.id, certificateName: `Python for Data Science ${TS}`, issuer: 'IBM', storedFileId: otroCursoPdf.data?.id,
    });
    const cc = otroCurso.v?.credentialCheck?.contradictions ?? [];
    check(otroCurso.v?.backingTier === 'flagged' && cc.includes('course_mismatch') && cc.includes('issuer_mismatch'),
      'V3.9.16 §19 El documento es de otro curso y otro emisor que la oportunidad: FLAGGED', json(cc));
    const op7 = await crearExterna('Contexto coincide');
    const coincidePdf = await subirArchivo(est.token, pdfConTexto([`Certificate of completion ${est.nombre}`, 'CCNA Introduction to Networks', 'Cisco Networking Academy']), 'coincide.pdf', 'application/pdf');
    const coincide = await credencial({
      activityId: op7.id, certificateName: `CCNA Introduction to Networks 6 ${TS}`, issuer: 'Cisco Networking Academy', storedFileId: coincidePdf.data?.id,
    });
    check(coincide.v?.backingTier === 'supported' && (coincide.v?.credentialCheck?.contradictions ?? []).length === 0,
      'V3.9.17 §19 Sin URL, el documento coincide con la oportunidad: SUPPORTED, no CORROBORATED', json({ t: coincide.v?.backingTier }));

    // ----- Revisión manual excepcional (§16)
    const historicaPdf = await subirArchivo(est.token, pdfConTexto([`Diploma ${est.nombre}`, 'Taller de Robotica Educativa', 'Club Andino de Robotica']), 'historica.pdf', 'application/pdf');
    const historica = await credencial({ certificateName: `Taller de Robotica Educativa ${TS}`, issuer: 'Club Andino de Robotica', storedFileId: historicaPdf.data?.id });
    check(historica.v?.credentialCheck?.status === 'no_verifier' && historica.v?.manualReview?.canRequest === true
      && historica.v?.backingTier !== 'corroborated',
    'V3.9.18 §16 Histórica sin verificador digital: puede pedirse la revisión excepcional', json({ c: historica.v?.credentialCheck?.status, m: historica.v?.manualReview }));
    check(ok.v?.manualReview?.canRequest === false, 'V3.9.19 §16 Una credencial de oportunidad no la necesita (se valida con su referencia)');
    const pedirOp = await req('POST', `/certificates/external/${ok.id}/manual-review`, { token: est.token, body: {} });
    check(pedirOp.status === 400, 'V3.9.20 §16 Y la API lo impide', `status ${pedirOp.status}`);

    const archivoUrl = (await req('GET', '/certificates/external/my', { token: est.token })).data?.find((c) => c.id === historica.id)?.fileUrl;
    const bajar = (token) => fetch(`${API.replace(/\/api$/, '')}${archivoUrl}`, { headers: { Authorization: `Bearer ${token}` } });
    check((await bajar(director.token)).status === 404, 'V3.9.21 §16 Antes de pedirla, Dirección no ve el documento del estudiante');

    const pedir = await req('POST', `/certificates/external/${historica.id}/manual-review`, {
      token: est.token, body: { note: 'El club confirma por correo a robotica@club.example.' },
    });
    check(pedir.status === 200 && pedir.data?.manualReview?.status === 'requested', 'V3.9.22 §16 El estudiante la pide', json(pedir.data));
    const otraVez = await req('POST', `/certificates/external/${historica.id}/manual-review`, { token: est.token, body: {} });
    check(otraVez.status === 409, 'V3.9.23 No se pide dos veces', `status ${otraVez.status}`);

    const deDocente = await req('GET', '/validation/manual-reviews', { token: docente.token });
    const deEst = await req('GET', '/validation/manual-reviews', { token: est.token });
    const deAdmin = await req('GET', '/validation/manual-reviews', { token: ctx.admin });
    check(deDocente.status === 403 && deEst.status === 403 && deAdmin.status === 403,
      'V3.9.24 §6.5 Solo Dirección revisa: ni docente, ni estudiante, ni administración técnica', json([deDocente.status, deEst.status, deAdmin.status]));
    const pendientes = await req('GET', '/validation/manual-reviews', { token: director.token });
    const fila = (pendientes.data ?? []).find((x) => x.certificateId === historica.id);
    check(!!fila && fila.studentName === est.nombre && fila.requestNote?.includes('robotica'),
      'V3.9.25 §16 Dirección ve la solicitud con su nota', json(fila));
    check((await bajar(director.token)).status === 200, 'V3.9.26 §16 Con la revisión pedida, Dirección abre el documento');

    const corta = await req('POST', `/validation/manual-reviews/${historica.id}`, { token: director.token, body: { decision: 'corroborated', reason: 'ok' } });
    check(corta.status === 400, 'V3.9.27 §16 Decidir exige explicar cómo se comprobó', `status ${corta.status}`);
    const decide = await req('POST', `/validation/manual-reviews/${historica.id}`, {
      token: director.token, body: { decision: 'corroborated', reason: 'Llamé al club y confirmaron la participación y el nombre.' },
    });
    check(decide.status === 200 && decide.data?.backingTier === 'corroborated',
      'V3.9.28 §16 La revisión excepcional es la única vía para corroborar una histórica sin verificador', json(decide.data));
    const auditada = await req('GET', `/audit/events?eventType=EXTERNAL_CREDENTIAL_MANUAL_REVIEWED&entityId=${historica.id}`, { token: ctx.admin });
    check((auditada.data?.items ?? auditada.data ?? []).length >= 1, 'V3.9.29 §65 Queda auditada (EXTERNAL_CREDENTIAL_MANUAL_REVIEWED)');

    await req('PATCH', `/certificates/external/${historica.id}`, { token: est.token, body: { issuer: 'Club Andino de Robotica Educativa' } });
    const tras = await veredicto(historica.id);
    check(tras?.manualReview?.status === null && tras?.backingTier !== 'corroborated',
      'V3.9.30 §19 Si cambia lo declarado, la revisión anterior ya no vale y se vuelve a comprobar', json({ m: tras?.manualReview?.status, t: tras?.backingTier }));

    const reproc = await req('POST', '/validation/reprocess-outdated?limit=1', { token: ctx.admin });
    check(reproc.status === 200 && typeof reproc.data?.pendientes === 'number',
      'V3.9.31 Administración puede revalidar lo procesado con una versión anterior del validador', json(reproc.data));
  } finally {
    servidor.close();
  }
}

// ===========================================================================
//  BATCH 10 — Proyectos: multiárea, requisitos de ACTIVE y privacidad (§21, §22, §40)
// ===========================================================================
async function batch10(ctx) {
  objective('BATCH 10 · Borrador incompleto, requisitos para activar, multiárea, TEAM y enlace público');
  await asegurarGithubSimulado();
  const est = async (k, nombre) => {
    const e = await provisionAndActivate(ctx.admin, {
      firstName: nombre, lastName: 'Proyecto', email: correoEst(`b10${k}`), role: 'STUDENT', semester: 5,
    });
    e.profileId = (await req('GET', '/profiles/me', { token: e.token })).data?.id;
    return e;
  };
  const ana = await est('a', 'Ana');
  const beto = await est('b', 'Beto');
  const caro = await est('c', 'Caro');
  const letras = (n) => String.fromCharCode(...String(TS + n).slice(-6).split('').map((d) => 65 + Number(d)));
  const sufijo = letras(10);
  const area = async (n, tag) => (await req('POST', '/academic-areas', {
    token: ctx.admin, body: { name: `${n} ${sufijo}`, tags: [`${tag}${sufijo.toLowerCase()}`] },
  })).data;
  const areaA = await area('Sistemas Distribuidos', 'sdist');
  const areaB = await area('Interfaces de Usuario', 'iuser');
  const areaC = await area('Bioinformatica Aplicada', 'bioin');
  const skill = async (n, a) => (await req('POST', '/skills', { token: ctx.admin, body: { name: `${n} ${sufijo}`, academicAreaId: a.id } })).data;
  const sA = await skill('Kafka Streams', areaA);
  const sB = await skill('Figma Tokens', areaB);
  const sC = await skill('BLAST Suite', areaC);

  const readiness = async (id, token = ana.token) => (await req('GET', `/projects/${id}/readiness`, { token })).data;
  const codigos = (r) => (r?.missing ?? []).map((m) => m.code);

  // ----- §21 Borrador incompleto
  const borrador = await req('POST', '/projects', { token: ana.token, body: { title: `Idea suelta ${TS}` } });
  check(borrador.status === 201 && borrador.data?.status === 'draft', 'V3.10.1 §21 Un borrador se guarda incompleto', json({ s: borrador.status, st: borrador.data?.status }));
  const r0 = await readiness(borrador.data.id);
  check(r0?.ready === false && ['area', 'skill', 'repository', 'evidence'].every((c) => codigos(r0).includes(c)),
    'V3.10.2 §22 La lista de requisitos dice qué falta', json(codigos(r0)));
  const activarIncompleto = await req('PATCH', `/projects/${borrador.data.id}`, { token: ana.token, body: { status: 'active' } });
  check(activarIncompleto.status === 400 && activarIncompleto.data?.code === 'PROJECT_NOT_READY' && Array.isArray(activarIncompleto.data?.details?.missing),
    'V3.10.3 §22 Activar sin cumplir los requisitos → 400 con lo que falta', json({ s: activarIncompleto.status, c: activarIncompleto.data?.code }));

  const antes = ((await req('GET', '/projects/my', { token: ana.token })).data ?? []).length;
  const directo = await req('POST', '/projects', { token: ana.token, body: { title: `Activo de golpe ${TS}`, status: 'active' } });
  const despues = ((await req('GET', '/projects/my', { token: ana.token })).data ?? []).length;
  check(directo.status === 400 && antes === despues, 'V3.10.4 §22 Crear como ACTIVE sin requisitos no deja nada a medias', json({ s: directo.status, antes, despues }));

  // ----- §21.2 Multiárea y skills por área
  const multi = await req('PATCH', `/projects/${borrador.data.id}`, {
    token: ana.token, body: { areaIds: [areaA.id, areaB.id], skillIds: [sA.id, sB.id] },
  });
  check(multi.status === 200 && (multi.data?.projectAreas ?? []).length === 2 && (multi.data?.projectSkills ?? []).length === 2,
    'V3.10.5 §21.2 Un proyecto toca varias áreas, con tecnologías de cada una', json({ a: multi.data?.projectAreas?.length, s: multi.data?.projectSkills?.length }));
  const ajena = await req('PATCH', `/projects/${borrador.data.id}`, { token: ana.token, body: { skillIds: [sA.id, sC.id] } });
  check(ajena.status === 400 && ajena.data?.fields?.skillIds, 'V3.10.6 §4 Una tecnología de otra área se rechaza', `status ${ajena.status}`);

  // ----- §22 Repositorio público y válido
  const conRepo = async (url) => {
    await req('PATCH', `/projects/${borrador.data.id}`, { token: ana.token, body: { repositoryUrl: url } });
    return codigos(await readiness(borrador.data.id));
  };
  check((await conRepo('https://example.com/no-es-repo')).includes('repository_invalid'),
    'V3.10.7 §22 Un enlace que no es de repositorio no sirve');
  check((await conRepo(repoDePrueba(`privado-${TS}`))).includes('repository_not_public'),
    'V3.10.8 §22 Un repositorio privado no sirve');
  check((await conRepo(repoDePrueba(`inexistente-${TS}`))).includes('repository_not_public'),
    'V3.10.9 §22 Uno que no existe tampoco');
  const r1 = await conRepo(repoDePrueba(`tutorias-${TS}`));
  check(!r1.some((c) => c.startsWith('repository')), 'V3.10.10 §22 Repositorio público comprobado', json(r1));

  // ----- §22 Integrantes confirmados
  const inv = await req('POST', `/projects/${borrador.data.id}/invitations`, {
    token: ana.token, body: { invitedProfileId: beto.profileId, proposedRole: 'Frontend' },
  });
  check(inv.status === 201 && codigos(await readiness(borrador.data.id)).includes('members_pending'),
    'V3.10.11 §22 Una invitación sin responder bloquea la activación', `status ${inv.status}`);
  await req('PATCH', `/projects/invitations/${inv.data.id}`, { token: beto.token, body: { decision: 'accept' } });
  const r2 = codigos(await readiness(borrador.data.id));
  check(r2.includes('members_unconfirmed') && !r2.includes('members_pending'),
    'V3.10.12 §22 Aceptar no basta: el integrante confirma su contribución', json(r2));
  await req('PUT', `/projects/${borrador.data.id}/my-contribution`, { token: beto.token, body: { contribution: 'Maqueté la interfaz y los formularios.', skillIds: [sB.id] } });
  const r3 = codigos(await readiness(borrador.data.id));
  check(!r3.includes('members_unconfirmed') && r3.includes('evidence'), 'V3.10.13 §22 Confirmada, solo falta la evidencia de funcionamiento', json(r3));

  // ----- §22.1 Evidencia mínima y activación
  await req('POST', `/projects/${borrador.data.id}/evidences`, {
    token: ana.token, body: { evidenceType: 'link', externalUrl: 'https://capturas.example.org/tutorias.png', description: 'Captura del panel.' },
  });
  const r4 = await readiness(borrador.data.id);
  check(r4?.ready === true, 'V3.10.14 §22.1 Con una evidencia del funcionamiento, cumple todo', json(r4));
  const activa = await req('PATCH', `/projects/${borrador.data.id}`, { token: ana.token, body: { status: 'active' } });
  check(activa.status === 200 && activa.data?.status === 'active', 'V3.10.15 §22 Pasa a ACTIVE', json({ s: activa.status, st: activa.data?.status }));
  const bitacora = (await req('GET', `/projects/${borrador.data.id}/timeline`, { token: ana.token })).data ?? [];
  const auditoria = await req('GET', `/audit/events?eventType=PROJECT_ACTIVATED&entityId=${borrador.data.id}`, { token: ctx.admin });
  check(bitacora.some((e) => e.eventType === 'project_activated') && (auditoria.data?.items ?? auditoria.data ?? []).length >= 1,
    'V3.10.16 §39/§65 La activación queda en la bitácora y en la auditoría');
  const sinArea = await req('PATCH', `/projects/${borrador.data.id}`, { token: ana.token, body: { areaIds: [] } });
  check(sinArea.status === 400, 'V3.10.17 §22 Un proyecto activo no puede quedarse sin áreas', `status ${sinArea.status}`);
  const fixture = await crearProyectoActivo(ana.token, { title: `Proyecto de fixture ${TS}` });
  check(fixture.status === 201 && fixture.data?.status === 'active', 'V3.10.18 El camino completo de un estudiante deja el proyecto activo', json({ s: fixture.status }));

  // ----- §40 Enlace público
  const publico = await req('PATCH', `/projects/${borrador.data.id}`, { token: ana.token, body: { visibility: 'public_link' } });
  const token = publico.data?.publicLinkToken;
  check(publico.status === 200 && typeof token === 'string' && token.length >= 20, 'V3.10.19 §40 PUBLIC_LINK genera un enlace secreto', json({ s: publico.status }));
  const sinSesion = await fetch(`${API}/projects/public/${token}`);
  const vista = await sinSesion.json();
  check(sinSesion.status === 200 && vista.title?.startsWith('Idea suelta') && (vista.areas ?? []).length === 2,
    'V3.10.20 §40 Cualquiera con el enlace ve el resumen, sin iniciar sesión', json(vista));
  check(!('members' in vista) && !('createdByProfile' in vista) && !('evidences' in vista) && !('publicLinkToken' in vista),
    'V3.10.21 §40 El resumen no expone integrantes, archivos, bitácora ni auditoría', Object.keys(vista).join(','));
  check((await fetch(`${API}/projects/public/${'x'.repeat(32)}`)).status === 404, 'V3.10.22 §40 Un enlace inventado no lleva a nada');
  const cerrado = await req('PATCH', `/projects/${borrador.data.id}`, { token: ana.token, body: { visibility: 'private' } });
  check(cerrado.data?.publicLinkToken === null && (await fetch(`${API}/projects/public/${token}`)).status === 404,
    'V3.10.23 §40 Al cambiar la visibilidad, el enlace deja de funcionar');

  // ----- §40 TEAM
  const necesidad = (await req('POST', '/team-needs', { token: ana.token, body: { purpose: `Equipo de tutorías ${TS}`, maxMembers: 4 } })).data;
  const equipo = (await req('POST', `/team-needs/${necesidad.id}/team`, { token: ana.token, body: { name: `Equipo Tutor ${sufijo}` } })).data;
  const invEq = (await req('POST', `/teams/${equipo.id}/invitations`, { token: ana.token, body: { invitedProfileId: caro.profileId } })).data;
  await req('PATCH', `/teams/invitations/${invEq.id}`, { token: caro.token, body: { decision: 'accept' } });
  const ajenoEquipo = await req('PATCH', `/projects/${borrador.data.id}`, { token: beto.token, body: { teamId: equipo.id } });
  check(ajenoEquipo.status === 403 || ajenoEquipo.status === 400, 'V3.10.24 Solo el responsable vincula el proyecto a un equipo', `status ${ajenoEquipo.status}`);
  await req('PATCH', `/projects/${borrador.data.id}`, { token: ana.token, body: { teamId: equipo.id, visibility: 'private' } });
  check((await req('GET', `/projects/${borrador.data.id}`, { token: caro.token })).status === 403,
    'V3.10.25 §40 PRIVATE: alguien del equipo que no es integrante del proyecto no lo ve');
  await req('PATCH', `/projects/${borrador.data.id}`, { token: ana.token, body: { visibility: 'team' } });
  check((await req('GET', `/projects/${borrador.data.id}`, { token: caro.token })).status === 200,
    'V3.10.26 §40 TEAM: el equipo vinculado sí lo ve');
  const equipoDeOtro = await req('PATCH', `/projects/${fixture.data.id}`, { token: beto.token, body: { teamId: equipo.id } });
  check(equipoDeOtro.status === 403, 'V3.10.27 Nadie vincula el proyecto de otra persona', `status ${equipoDeOtro.status}`);
  const otroEquipo = (await req('POST', `/team-needs/${(await req('POST', '/team-needs', { token: beto.token, body: { purpose: `Otro equipo ${TS}`, maxMembers: 3 } })).data.id}/team`, { token: beto.token, body: { name: `Equipo Ajeno ${sufijo}` } })).data;
  const vincularAjeno = await req('PATCH', `/projects/${fixture.data.id}`, { token: ana.token, body: { teamId: otroEquipo.id } });
  check(vincularAjeno.status === 400 && vincularAjeno.data?.fields?.teamId, 'V3.10.28 §21.1 Solo se vincula un equipo del que se forma parte', `status ${vincularAjeno.status}`);
}

// ===========================================================================
//  BATCH 11 — GitHub: manifiestos, mapeo determinista, caché y demo (§24, §25, §26)
// ===========================================================================
async function batch11(ctx) {
  objective('BATCH 11 · Dependencias leídas de los manifiestos, ETag, cuota, reintentos y demo');
  await asegurarGithubSimulado();
  const est = await provisionAndActivate(ctx.admin, {
    firstName: 'Gael', lastName: 'Repositorio', email: correoEst('b11'), role: 'STUDENT', semester: 6,
  });
  const areas = (await req('GET', '/academic-areas', { token: ctx.admin })).data ?? [];
  const areaBase = areas[0];
  const catalogo = async () => (await req('GET', '/skills', { token: ctx.admin })).data ?? [];
  const skill = async (nombre) => {
    const ya = (await catalogo()).find((s) => s.name.toLowerCase() === nombre.toLowerCase() && s.academicAreaId);
    if (ya) return ya;
    let creada = await req('POST', '/skills', { token: ctx.admin, body: { name: nombre, academicAreaId: areaBase.id } });
    // §9.3: el catálogo sabe a qué área pertenece; se usa la que sugiere.
    const sugerida = creada.data?.details?.suggestedAreaIds?.[0];
    if (!creada.data?.id && sugerida) {
      creada = await req('POST', '/skills', { token: ctx.admin, body: { name: nombre, academicAreaId: sugerida } });
    }
    return creada.data?.id ? creada.data : (await catalogo()).find((s) => s.name.toLowerCase() === nombre.toLowerCase());
  };
  const s = {};
  for (const n of ['React', 'NestJS', 'PostgreSQL', 'Redis', 'TypeScript', 'FastAPI']) s[n] = await skill(n);
  const proyecto = async (titulo, skills, repo, extra = {}) => req('POST', '/projects', {
    token: est.token,
    body: {
      title: `${titulo} ${TS}`,
      areaIds: [...new Set(skills.map((x) => x.academicAreaId))],
      skillIds: skills.map((x) => x.id),
      repositoryUrl: repoDePrueba(repo),
      status: 'draft',
      ...extra,
    },
  });
  const checks = async (id) => (await req('GET', `/projects/${id}/checks`, { token: est.token })).data;
  const senal = (c, nombre) => (c?.repository?.technologySignals ?? []).find((t) => t.name.toLowerCase() === nombre.toLowerCase());

  // ----- §24.3 Manifiestos de Node y docker-compose
  const stackRepo = `stack-${TS}`;
  const p1 = await proyecto('Tablero académico', [s.React, s.NestJS, s.PostgreSQL, s.Redis, s.TypeScript], stackRepo);
  const c1 = await checks(p1.data.id);
  check(c1?.repository?.status === 'available' && (c1?.repository?.metadata?.manifests ?? []).includes('package.json')
    && (c1?.repository?.metadata?.manifests ?? []).includes('docker-compose.yml'),
  'V3.11.1 §24.1 Repositorio público, con su raíz y manifiestos controlados', json(c1?.repository?.metadata?.manifests));
  check(senal(c1, 'React')?.status === 'both' && /package\.json \(react\)/.test(senal(c1, 'React')?.source ?? ''),
    'V3.11.2 §24.3 package.json contiene «react» → React corroborada, con su origen', json(senal(c1, 'React')));
  check(senal(c1, 'NestJS')?.status === 'both' && /@nestjs\/core/.test(senal(c1, 'NestJS')?.source ?? ''),
    'V3.11.3 §24.3 «@nestjs/core» → NestJS', json(senal(c1, 'NestJS')));
  check(senal(c1, 'PostgreSQL')?.status === 'both', 'V3.11.4 §24.3 «pg» → señal de PostgreSQL', json(senal(c1, 'PostgreSQL')));
  const deps = c1?.repository?.metadata?.dependencySignals ?? [];
  check(deps.some((d) => d.technology === 'PostgreSQL' && d.file === 'docker-compose.yml' && /postgres/.test(d.evidence)),
    'V3.11.5 §24.3 docker-compose con servicio postgres → señal adicional de PostgreSQL', json(deps.filter((d) => d.file === 'docker-compose.yml')));
  check(senal(c1, 'Redis')?.status === 'declared', 'V3.11.6 §29 Redis sin rastro queda DECLARADA, no falsa', json(senal(c1, 'Redis')));
  check(senal(c1, 'Docker')?.status === 'detected', 'V3.11.7 §24.4 Lo encontrado y no declarado se informa sin añadirlo', json(senal(c1, 'Docker')));
  check(!!c1?.repository?.metadata?.pushedAt && c1?.repository?.metadata?.readmePresence === true,
    'V3.11.8 §24.1 Último push y README', json({ p: c1?.repository?.metadata?.pushedAt }));

  // ----- Python
  const p2 = await proyecto('API de inscripciones', [s.FastAPI, s.PostgreSQL], `py-${TS}`);
  const c2 = await checks(p2.data.id);
  check(senal(c2, 'FastAPI')?.status === 'both' && senal(c2, 'PostgreSQL')?.status === 'both',
    'V3.11.9 §24.3 requirements.txt: «fastapi» → FastAPI y «psycopg2-binary» → PostgreSQL', json([senal(c2, 'FastAPI'), senal(c2, 'PostgreSQL')]));

  // ----- §24.6 Caché y ETag
  const base = `/repos/afinia-pruebas/${stackRepo}`;
  const antes = githubSimuladoLog.filter((r) => r.url === base).length;
  const p3 = await proyecto('Mismo repositorio', [s.React], stackRepo);
  const despues = githubSimuladoLog.filter((r) => r.url === base).length;
  check(p3.status === 201 && despues === antes, 'V3.11.10 §24.6 Dentro del plazo, la respuesta guardada evita volver a preguntar', `${antes} → ${despues}`);
  const recheck = await req('POST', `/projects/${p1.data.id}/checks/recheck`, { token: est.token });
  const ultimas = githubSimuladoLog.filter((r) => r.url === base);
  check(recheck.status === 200 || recheck.status === 201, 'V3.11.11 El responsable pide volver a comprobar', `status ${recheck.status}`);
  check(ultimas.length > despues && !!ultimas[ultimas.length - 1].ifNoneMatch,
    'V3.11.12 §24.6 Al volver a preguntar se manda el ETag (If-None-Match)', json(ultimas.slice(-1)));
  check(recheck.data?.repository?.metadata?.fromCache === true && senal(recheck.data, 'React')?.status === 'both',
    'V3.11.13 §24.6 Sin cambios (304), se reutiliza lo guardado sin gastar cuota', json({ c: recheck.data?.repository?.metadata?.fromCache }));

  // ----- Cuota agotada y reintentos
  const p4 = await proyecto('Sin cuota', [s.React], `cuota-${TS}`);
  const c4 = await checks(p4.data.id);
  const r4 = (await req('GET', `/projects/${p4.data.id}/readiness`, { token: est.token })).data;
  check(c4?.repository?.status === 'unverified' && !(r4?.missing ?? []).some((m) => m.code.startsWith('repository')) && (r4?.warnings ?? []).length > 0,
    'V3.11.14 §24.6 Cuota agotada: queda «sin comprobar», avisa y no bloquea', json({ s: c4?.repository?.status, w: r4?.warnings }));
  // El reinicio de la cuota simulada llega en ≤3 s (segundos enteros, redondeados hacia arriba).
  await new Promise((r) => setTimeout(r, 3600));
  const p5 = await proyecto('Proveedor inestable', [s.React], `inestable-${TS}`);
  const c5 = await checks(p5.data.id);
  check(c5?.repository?.status === 'available', 'V3.11.15 §24.6 Un fallo pasajero se reintenta y se recupera', json(c5?.repository?.status));

  // ----- §26 Demo sin crawler
  const demo = createServer((rq, rs) => {
    rs.writeHead(200, { 'content-type': 'text/html; charset=utf-8' });
    rs.end('<html><head><title>Tablero en vivo</title><meta property="og:description" content="Panel de seguimiento de tutorías"><meta property="og:site_name" content="Tutorías"></head><body>ok</body></html>');
  });
  await new Promise((r) => demo.listen(3997, '127.0.0.1', r));
  try {
    const p6 = await proyecto('Con demo', [s.React], stackRepo, { demoUrl: 'http://verificador.afinia-pruebas.org:3997/demo' });
    const c6 = await checks(p6.data.id);
    check(c6?.demo?.status === 'available' && c6?.demo?.title === 'Tablero en vivo' && c6?.demo?.isHttps === false
      && c6?.demo?.metadata?.description === 'Panel de seguimiento de tutorías',
    'V3.11.16 §26 Demo: accesible, título, HTTPS y metadata pública', json(c6?.demo));
    check(!JSON.stringify(c6?.demo ?? {}).match(/nestjs|postgres/i),
      'V3.11.17 §26 De una demo no se deduce backend ni base de datos');
  } finally {
    demo.close();
  }
}

// ===========================================================================
//  BATCH 12 — Equipos y contribuciones (§30, §31)
// ===========================================================================
async function batch12(ctx) {
  objective('BATCH 12 · Roles controlados, «usar uno de mis equipos», confirmación y corrección');
  await asegurarGithubSimulado();
  const est = async (k, nombre) => {
    const e = await provisionAndActivate(ctx.admin, {
      firstName: nombre, lastName: 'Equipo', email: correoEst(`b12${k}`), role: 'STUDENT', semester: 7,
    });
    e.profileId = (await req('GET', '/profiles/me', { token: e.token })).data?.id;
    return e;
  };
  const lider = await est('l', 'Lidia');
  const uno = await est('u', 'Umberto');
  const dos = await est('d', 'Dalia');
  const letras = (n) => String.fromCharCode(...String(TS + n).slice(-6).split('').map((d) => 65 + Number(d)));

  // ----- §31 Equipo real antes del proyecto
  const necesidad = (await req('POST', '/team-needs', { token: lider.token, body: { purpose: `Equipo del sistema de becas ${TS}`, maxMembers: 4 } })).data;
  const equipo = (await req('POST', `/team-needs/${necesidad.id}/team`, { token: lider.token, body: { name: `Equipo Becas ${letras(12)}` } })).data;
  for (const m of [uno, dos]) {
    const inv = (await req('POST', `/teams/${equipo.id}/invitations`, { token: lider.token, body: { invitedProfileId: m.profileId } })).data;
    await req('PATCH', `/teams/invitations/${inv.id}`, { token: m.token, body: { decision: 'accept' } });
  }

  // ----- §30.1 Catálogo de roles
  const borrador = await crearProyectoBorrador(lider.token, { title: `Sistema de becas ${TS}` });
  const rolLibre = await req('POST', `/projects/${borrador.data.id}/invitations`, {
    token: lider.token, body: { invitedProfileId: uno.profileId, proposedRole: 'Arquitecto galáctico' },
  });
  check(rolLibre.status === 400, 'V3.12.1 §30.1 El rol propuesto sale de un catálogo controlado', `status ${rolLibre.status}`);

  // ----- §31 Usar uno de mis equipos
  const catalogo = ((await req('GET', '/skills', { token: lider.token })).data ?? []).filter((s) => s.academicAreaId);
  const sk = catalogo[0];
  const proyecto = await req('POST', '/projects', {
    token: lider.token,
    body: {
      title: `Portal de becas ${TS}`, areaIds: [sk.academicAreaId], skillIds: [sk.id],
      repositoryUrl: repoDePrueba(`becas-${TS}`), teamId: equipo.id, inviteTeamMembers: true, status: 'draft',
    },
  });
  check(proyecto.status === 201 && proyecto.data?.teamId === equipo.id, 'V3.12.2 §31 Se crea el proyecto con uno de mis equipos', json({ s: proyecto.status }));
  const id = proyecto.data.id;
  const invitaciones = (await req('GET', `/projects/${id}/invitations`, { token: lider.token })).data ?? [];
  const pendientes = invitaciones.filter((i) => i.status === 'pending');
  check(pendientes.length === 2 && pendientes.every((i) => i.proposedRole === 'Otro'),
    'V3.12.3 §31 Se precargan los integrantes del equipo como invitaciones (sin el responsable)', json(invitaciones.map((i) => [i.status, i.proposedRole])));
  const bitacora = (await req('GET', `/projects/${id}/timeline`, { token: lider.token })).data ?? [];
  check(bitacora.filter((e) => e.eventType === 'member_invited').length === 2
    && bitacora.filter((e) => e.eventType === 'member_invited').every((e) => e.metadata?.desdeEquipo === equipo.id),
  'V3.12.4 §31 La bitácora conserva que las invitaciones salieron del equipo', json(bitacora.map((e) => e.eventType)));
  const otraVez = await req('POST', `/projects/${id}/invite-team`, { token: lider.token });
  check(otraVez.status === 201 && otraVez.data?.invitados === 0 && otraVez.data?.omitidos === 2,
    'V3.12.5 Repetirlo no duplica invitaciones', json(otraVez.data));
  const ajeno = await req('POST', `/projects/${id}/invite-team`, { token: uno.token });
  check(ajeno.status === 403, 'V3.12.6 Solo el responsable invita al equipo', `status ${ajeno.status}`);

  // ----- §30 Confirmación individual
  await req('POST', `/projects/${id}/evidences`, { token: lider.token, body: { evidenceType: 'link', externalUrl: 'https://capturas.example.org/becas.png', description: 'Captura.' } });
  const codigos = async () => ((await req('GET', `/projects/${id}/readiness`, { token: lider.token })).data?.missing ?? []).map((m) => m.code);
  check((await codigos()).includes('members_pending'), 'V3.12.7 §30 Mientras no respondan, no se activa');
  const mias = async (m) => (await req('GET', '/projects/invitations/mine', { token: m.token })).data ?? [];
  for (const m of [uno, dos]) {
    const suya = (await mias(m)).find((i) => (i.projectId ?? i.project?.id) === id && i.status === 'pending');
    await req('PATCH', `/projects/invitations/${suya.id}`, { token: m.token, body: { decision: 'accept' } });
  }
  check((await codigos()).includes('members_unconfirmed'), 'V3.12.8 §30 Aceptar no basta: cada uno confirma su contribución');

  const rolMalo = await req('PUT', `/projects/${id}/my-contribution`, { token: uno.token, body: { role: 'Mago', contribution: 'Todo.' } });
  check(rolMalo.status === 400, 'V3.12.9 §30.1 Al confirmar, el rol también es del catálogo', `status ${rolMalo.status}`);
  await req('PUT', `/projects/${id}/my-contribution`, { token: uno.token, body: { role: 'Backend', contribution: 'Implementé la API de postulaciones.', skillIds: [sk.id] } });

  // ----- §30 Corrección
  const detallados = (await req('GET', `/projects/${id}/members/detailed`, { token: lider.token })).data ?? [];
  const deDos = detallados.find((m) => m.userId === dos.userId);
  await req('PATCH', `/projects/${id}/members/${deDos.id}/contribution`, { token: lider.token, body: { contribution: 'Hizo todo el backend.', role: 'Backend' } });
  const corta = await req('POST', `/projects/${id}/my-contribution/correction`, { token: dos.token, body: { note: 'no' } });
  check(corta.status === 400, 'V3.12.10 §30 Pedir una corrección exige explicar qué', `status ${corta.status}`);
  const correccion = await req('POST', `/projects/${id}/my-contribution/correction`, {
    token: dos.token, body: { note: 'No hice el backend: me encargué de las pruebas y la documentación.' },
  });
  check(correccion.status === 201 && correccion.data?.contributionConfirmed === false,
    'V3.12.11 §30 El integrante pide corregir lo que le propusieron; queda sin confirmar', json(correccion.data));
  const bit2 = (await req('GET', `/projects/${id}/timeline`, { token: lider.token })).data ?? [];
  check(bit2.some((e) => e.eventType === 'contribution_correction_requested'), 'V3.12.12 §39 La corrección queda en la bitácora');
  const delLider = await req('POST', `/projects/${id}/my-contribution/correction`, { token: lider.token, body: { note: 'Quiero corregirme a mí mismo.' } });
  check(delLider.status === 400, 'V3.12.13 El responsable edita su contribución directamente', `status ${delLider.status}`);
  check((await codigos()).includes('members_unconfirmed'), 'V3.12.14 §30 Con una corrección pendiente, el proyecto no se activa');

  await req('PUT', `/projects/${id}/my-contribution`, { token: dos.token, body: { role: 'QA', contribution: 'Escribí las pruebas y la documentación.', skillIds: [sk.id] } });
  const activo = await req('PATCH', `/projects/${id}`, { token: lider.token, body: { status: 'active' } });
  check(activo.status === 200 && activo.data?.status === 'active', 'V3.12.15 §30 Cuando todos confirman, se activa', json({ s: activo.status, c: activo.data?.code }));
}

// ===========================================================================
//  BATCH 13 — Respaldo del proyecto (§28) y por tecnología (§24.4, §29)
// ===========================================================================
async function batch13(ctx) {
  objective('BATCH 13 · CORROBORATED técnico + independiente, estado por tecnología y revisión docente');
  await asegurarGithubSimulado();
  const est = await provisionAndActivate(ctx.admin, {
    firstName: 'Bruno', lastName: 'Respaldo', email: correoEst('b13'), role: 'STUDENT', semester: 4,
  });
  const docente = await provisionAndActivate(ctx.admin, {
    firstName: 'Olga', lastName: 'Revisora', email: correoStaff('b13doc'), role: 'TEACHER',
  });
  const ajeno = await provisionAndActivate(ctx.admin, {
    firstName: 'Ivo', lastName: 'Fuera', email: correoStaff('b13ajeno'), role: 'TEACHER',
  });
  await req('PUT', `/users/${docente.userId}/semesters`, { token: ctx.admin, body: { semesters: [4] } });
  await req('PUT', `/users/${ajeno.userId}/semesters`, { token: ctx.admin, body: { semesters: [9] } });

  const catalogo = (await req('GET', '/skills', { token: ctx.admin })).data ?? [];
  const sk = (n) => catalogo.find((s) => s.name.toLowerCase() === n.toLowerCase() && s.academicAreaId);
  const [react, redis, ts] = [sk('React'), sk('Redis'), sk('TypeScript')];
  const crear = (titulo, skills, repo, extra = {}) => req('POST', '/projects', {
    token: est.token,
    body: {
      title: `${titulo} ${TS}`, areaIds: [...new Set(skills.map((x) => x.academicAreaId))], skillIds: skills.map((x) => x.id),
      ...(repo ? { repositoryUrl: repoDePrueba(repo) } : {}), visibility: 'teachers', status: 'draft', ...extra,
    },
  });
  const proyecto = async (id) => (await req('GET', `/projects/${id}`, { token: est.token })).data;
  const estado = (p, s) => (p?.projectSkills ?? []).find((x) => x.skillId === s.id)?.evidenceStatus;

  // ----- §24.4 Estado por tecnología
  const p1 = await crear('Panel de becas', [react, redis], `stack-b13-${TS}`);
  let v = await proyecto(p1.data.id);
  check(estado(v, react) === 'corroborated_by_manifest', 'V3.13.1 §24.4 React: corroborada por manifiesto', json(v?.projectSkills));
  check(estado(v, redis) === 'declared', 'V3.13.2 §29 Redis sin rastro: DECLARADA, no falsa ni restada', json(estado(v, redis)));
  const p2 = await crear('Servicio en TypeScript', [ts], `generico-b13-${TS}`);
  check(estado(await proyecto(p2.data.id), ts) === 'corroborated_by_github_language',
    'V3.13.3 §24.4 TypeScript: corroborada por los lenguajes del repositorio');

  // ----- §28 Reglas del proyecto
  check(v?.backingTier === 'supported', 'V3.13.4 §28 Repositorio + corroboración técnica, sin señal independiente: SUPPORTED', json(v?.backingTier));
  await req('POST', `/projects/${p1.data.id}/evidences`, { token: est.token, body: { evidenceType: 'link', externalUrl: 'https://capturas.example.org/b13.png', description: 'Captura.' } });
  v = await proyecto(p1.data.id);
  check(v?.backingTier === 'corroborated', 'V3.13.5 §28 + una señal independiente (evidencia de contexto): CORROBORATED', json({ t: v?.backingTier, r: v?.backingReasons }));
  check((v?.backingReasons ?? []).some((r) => r.includes('React')), 'V3.13.6 §25 La explicación nombra la tecnología respaldada', json(v?.backingReasons));
  const sinRepo = await crear('Idea sin repositorio', [react], null);
  await req('POST', `/projects/${sinRepo.data.id}/evidences`, { token: est.token, body: { evidenceType: 'link', externalUrl: 'https://capturas.example.org/b13b.png', description: 'Captura.' } });
  const vs = await proyecto(sinRepo.data.id);
  check(vs?.backingTier === 'declared', 'V3.13.7 §28 Sin repositorio, una evidencia no basta: DECLARED', json(vs?.backingTier));
  const p3 = await crear('Solo contexto', [redis], `generico-ctx-${TS}`, { demoUrl: undefined });
  await req('POST', `/projects/${p3.data.id}/evidences`, { token: est.token, body: { evidenceType: 'link', externalUrl: 'https://capturas.example.org/b13c.png', description: 'Captura.' } });
  check((await proyecto(p3.data.id))?.backingTier === 'supported',
    'V3.13.8 §28 Repositorio + contexto, sin corroboración técnica: SUPPORTED, no CORROBORATED');

  // ----- §29 Revisión docente
  const ruta = (pid, sid) => `/projects/${pid}/feedback/skills/${sid}`;
  const deEst = await req('POST', ruta(p1.data.id, redis.id), { token: est.token, body: { comment: 'Me confirmo yo mismo Redis.' } });
  check(deEst.status === 403, 'V3.13.9 §29 El estudiante no confirma sus propias tecnologías', `status ${deEst.status}`);
  const fuera = await req('POST', ruta(p1.data.id, redis.id), { token: ajeno.token, body: { comment: 'Vi el uso de Redis para la caché.' } });
  check(fuera.status === 403, 'V3.13.10 §8.2 Un docente fuera de su alcance no puede', `status ${fuera.status}`);
  const corta = await req('POST', ruta(p1.data.id, redis.id), { token: docente.token, body: { comment: 'ok' } });
  check(corta.status === 400, 'V3.13.11 §29 Confirmar exige retroalimentación específica', `status ${corta.status}`);
  const confirma = await req('POST', ruta(p1.data.id, redis.id), {
    token: docente.token, body: { comment: 'Revisé en clase la caché de sesiones con Redis y su configuración.' },
  });
  check(confirma.status === 201 && confirma.data?.evidenceStatus === 'corroborated_by_academic_review',
    'V3.13.12 §29 El docente autorizado confirma Redis: CORROBORATED_BY_ACADEMIC_REVIEW', json(confirma.data));
  v = await proyecto(p1.data.id);
  check(v?.backingTier === 'reviewed', 'V3.13.13 §28 Con retroalimentación docente: REVIEWED (no es aprobación oficial)', json(v?.backingTier));
  const fb = (await req('GET', `/projects/${p1.data.id}/feedback`, { token: est.token })).data ?? [];
  check(fb.some((f) => f.comment.startsWith('Tecnología confirmada: Redis')), 'V3.13.14 La confirmación queda como retroalimentación visible para el equipo');
  const otraSkill = await req('POST', ruta(p1.data.id, ts.id), { token: docente.token, body: { comment: 'Esta tecnología no está en el proyecto.' } });
  check(otraSkill.status === 404, 'V3.13.15 Solo se confirma una tecnología declarada en el proyecto', `status ${otraSkill.status}`);

  // ----- Recalculo masivo
  const masivo = await req('POST', '/projects/admin/recompute-backing?limit=50', { token: ctx.admin });
  check(masivo.status === 201 && masivo.data?.procesados === 50, 'V3.13.16 Administración recalcula el respaldo con las reglas vigentes, en tandas', json(masivo.data));
  check((await req('POST', '/projects/admin/recompute-backing', { token: est.token })).status === 403, 'V3.13.17 Solo administración');
}

// ===========================================================================
//  BATCH 14 — Afinidad V4 (§35, §36, §37)
// ===========================================================================
async function batch14(ctx) {
  objective('BATCH 14 · Afinidad V4: solo trayectoria corroborada, habilidades respaldadas sin porcentaje');
  await asegurarGithubSimulado();
  const est = await provisionAndActivate(ctx.admin, {
    firstName: 'Renata', lastName: 'Cuarta', email: correoEst('b14'), role: 'STUDENT', semester: 6,
  });
  est.profileId = (await req('GET', '/profiles/me', { token: est.token })).data?.id;
  const docente = await provisionAndActivate(ctx.admin, { firstName: 'Saul', lastName: 'Guia', email: correoStaff('b14doc'), role: 'TEACHER' });
  await req('PUT', `/users/${docente.userId}/semesters`, { token: ctx.admin, body: { semesters: [6] } });
  const director = await provisionAndActivate(ctx.admin, { firstName: 'Nora', lastName: 'Directa', email: correoStaff('b14dir'), role: 'CAREER_DIRECTOR' });

  const letras = (n) => String.fromCharCode(...String(TS + n).slice(-6).split('').map((d) => 65 + Number(d)));
  const sufijo = letras(14);
  const area = async (n, tag) => (await req('POST', '/academic-areas', {
    token: ctx.admin, body: { name: `${n} ${sufijo}`, tags: [`${tag}${sufijo.toLowerCase()}`] },
  })).data;
  const areaP = await area('Ingenieria de Plataformas', 'plataf');
  const areaQ = await area('Analitica Educativa', 'analed');
  const areaC = await area('Seguridad de Redes', 'segred');
  const skill = async (n, a) => (await req('POST', '/skills', { token: ctx.admin, body: { name: `${n}${sufijo}`, academicAreaId: a.id } })).data;
  const sP = await skill('Plataformix', areaP);
  const sQ = await skill('Analitix', areaQ);
  const sC = await skill('Cortafuegox', areaC);

  const resumen = async () => (await req('GET', '/affinity/me', { token: est.token })).data;
  const resumenFull = async () => (await req('GET', '/affinity/me/summary', { token: est.token })).data;
  const crudo = (s, a) => Number((s?.areas ?? []).find((x) => x.academicAreaId === a.id)?.rawPoints ?? 0);
  const respaldo = (s, a) => Number((s?.areas ?? []).find((x) => x.academicAreaId === a.id)?.supportScore ?? 0);
  const proyecto = (titulo, skills, repo) => req('POST', '/projects', {
    token: est.token,
    body: {
      title: `${titulo} ${TS}`, areaIds: [...new Set(skills.map((x) => x.academicAreaId))], skillIds: skills.map((x) => x.id),
      repositoryUrl: repo, visibility: 'teachers', status: 'draft',
    },
  });
  const evidencia = (id) => req('POST', `/projects/${id}/evidences`, { token: est.token, body: { evidenceType: 'link', externalUrl: `https://capturas.example.org/${id}.png`, description: 'Captura.' } });
  const confirmar = (id, skills) => req('PUT', `/projects/${id}/my-contribution`, { token: est.token, body: { contribution: 'Diseño e implementación.', skillIds: skills.map((x) => x.id) } });

  let s = await resumenFull();
  check(s?.engineVersion === 4, 'V3.14.1 §35 El motor vigente es la versión 4', `versión ${s?.engineVersion}`);

  // ----- Borrador
  const borrador = await proyecto('Borrador de plataforma', [sP], repoQueCorrobora(sP.name));
  await evidencia(borrador.data.id);
  await confirmar(borrador.data.id, [sP]);
  s = await resumenFull();
  check(crudo(s, areaP) === 0 && respaldo(s, areaP) === 0, 'V3.14.2 §35.1 Un proyecto DRAFT no puntúa, aunque esté corroborado', JSON.stringify(s?.areas));

  // ----- SUPPORTED: respaldo sí, afinidad no
  const soportado = await proyecto('Analítica soportada', [sQ], repoDePrueba(`generico-b14-${TS}`));
  await evidencia(soportado.data.id);
  await req('PATCH', `/projects/${soportado.data.id}`, { token: est.token, body: { status: 'active' } });
  await confirmar(soportado.data.id, [sQ]);
  s = await resumenFull();
  check((await req('GET', `/projects/${soportado.data.id}`, { token: est.token })).data?.backingTier === 'supported'
    && crudo(s, areaQ) === 0 && respaldo(s, areaQ) > 0,
  'V3.14.3 §35.3/§37 SUPPORTED no suma afinidad, pero sí respaldo', `crudo ${crudo(s, areaQ)} / respaldo ${respaldo(s, areaQ)}`);

  // ----- CORROBORATED: 18, solo con tecnologías corroboradas para él
  const activar = await req('PATCH', `/projects/${borrador.data.id}`, { token: est.token, body: { status: 'active' } });
  s = await resumenFull();
  check(activar.data?.backingTier === 'corroborated' && crudo(s, areaP) === 18,
    'V3.14.4 §35.3 CORROBORATED + tecnología confirmada y corroborada: 18', `${activar.data?.backingTier} / crudo ${crudo(s, areaP)}`);
  const conDeclarada = await req('PATCH', `/projects/${borrador.data.id}`, {
    token: est.token, body: { areaIds: [areaP.id, areaC.id], skillIds: [sP.id, sC.id] },
  });
  await confirmar(borrador.data.id, [sP, sC]);
  s = await resumenFull();
  check(conDeclarada.status === 200 && crudo(s, areaC) === 0 && crudo(s, areaP) === 18,
    'V3.14.5 §35.1 Una tecnología solo declarada en el proyecto no puntúa', `C ${crudo(s, areaC)} / P ${crudo(s, areaP)}`);

  // ----- REVIEWED: 22
  const fb = await req('POST', `/projects/${borrador.data.id}/feedback`, { token: docente.token, body: { comment: 'Buena separación de servicios y despliegue.' } });
  s = await resumenFull();
  check(fb.status === 201 && crudo(s, areaP) === 22, 'V3.14.6 §35.3 REVIEWED: 22', `crudo ${crudo(s, areaP)}`);

  // ----- Credenciales: solo CORROBORATED
  const pdf = (t) => {
    const c = `BT\n/F1 14 Tf\n72 720 Td\n(${t}) Tj\nET\n`;
    const o = ['<< /Type /Catalog /Pages 2 0 R >>', '<< /Type /Pages /Kids [3 0 R] /Count 1 >>',
      '<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Resources << /Font << /F1 5 0 R >> >> /Contents 4 0 R >>',
      `<< /Length ${c.length} >>\nstream\n${c}\nendstream`, '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>'];
    let out = '%PDF-1.4\n';
    const off = [];
    o.forEach((x, i) => { off.push(out.length); out += `${i + 1} 0 obj\n${x}\nendobj\n`; });
    const xref = out.length;
    out += `xref\n0 6\n0000000000 65535 f \n${off.map((n) => `${String(n).padStart(10, '0')} 00000 n \n`).join('')}trailer\n<< /Size 6 /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF\n`;
    return Buffer.from(out, 'latin1');
  };
  const form = new FormData();
  form.append('file', new Blob([pdf('Diploma Renata Cuarta - Taller de Cortafuegos - Club de Redes')], { type: 'application/pdf' }), 'diploma.pdf');
  const subida = await req('POST', '/uploads', { token: est.token, raw: form });
  const cert = await req('POST', '/certificates/external', {
    token: est.token,
    body: { certificateName: `Taller de Cortafuegos ${TS}`, issuer: 'Club de Redes', issueDate: '2025-05-01', academicAreaId: areaC.id, storedFileId: subida.data?.id, skillIds: [sC.id] },
  });
  for (let i = 0; i < 30; i++) {
    await req('POST', '/validation/run?limit=50', { token: ctx.admin });
    const v = (await req('GET', `/validation/external_certificate/${cert.data.id}`, { token: est.token })).data;
    if (v && !['pending', 'processing'].includes(v.status)) break;
    await new Promise((r) => setTimeout(r, 300));
  }
  s = await resumenFull();
  check(crudo(s, areaC) === 0, 'V3.14.7 §35.4 Una credencial sin corroborar no suma afinidad', `crudo ${crudo(s, areaC)}`);
  await req('POST', `/certificates/external/${cert.data.id}/manual-review`, { token: est.token, body: { note: 'El club confirma por correo.' } });
  await req('POST', `/validation/manual-reviews/${cert.data.id}`, { token: director.token, body: { decision: 'corroborated', reason: 'Confirmé con el club la participación y el nombre.' } });
  s = await resumenFull();
  check(crudo(s, areaC) === 15, 'V3.14.8 §35.4 CORROBORATED: 15', `crudo ${crudo(s, areaC)}`);

  // ----- Actividad en dos áreas
  const cats = (await req('GET', '/activity-categories', { token: director.token })).data ?? [];
  const taller = cats.find((c) => c.code === 'taller_academico') ?? cats[0];
  const act = (await req('POST', '/activities', {
    token: director.token,
    body: { title: `Taller interdisciplinario ${TS}`, type: 'academica', categoryId: taller.id, status: 'open', areaIds: [areaQ.id, areaP.id] },
  })).data;
  await req('POST', `/activities/${act.id}/register`, { token: est.token });
  await req('PATCH', `/activities/${act.id}/confirm-participation`, { token: director.token, body: { studentProfileId: est.profileId, status: 'confirmed' } });
  s = await resumenFull();
  check(crudo(s, areaQ) === 10 && crudo(s, areaP) === 32,
    'V3.14.9 §35.2 Una participación confirmada puntúa en todas las áreas de la actividad', `Q ${crudo(s, areaQ)} / P ${crudo(s, areaP)}`);

  // ----- §36 Habilidades respaldadas, sin porcentaje
  const aP = (s?.areas ?? []).find((x) => x.academicAreaId === areaP.id);
  const habP = (aP?.backedSkills ?? []).find((h) => h.skillId === sP.id);
  check(!!habP && habP.sources.some((x) => x.type === 'project' && x.title.startsWith('Borrador de plataforma')),
    'V3.14.10 §36 Habilidad respaldada con su origen (proyecto)', JSON.stringify(aP?.backedSkills));
  const aC = (s?.areas ?? []).find((x) => x.academicAreaId === areaC.id);
  check((aC?.backedSkills ?? []).some((h) => h.skillId === sC.id && h.sources.some((x) => x.type === 'credential')),
    'V3.14.11 §36 La credencial corroborada respalda su tecnología', JSON.stringify(aC?.backedSkills));
  check(!(aC?.backedSkills ?? []).some((h) => h.sources.some((x) => x.type === 'project')),
    'V3.14.12 §36 La tecnología solo declarada en el proyecto no figura como respaldada por él');
  check(!JSON.stringify(s).match(/"(percent|mastery|dominio)"/i) && (aP?.backedSkills ?? []).every((h) => !('score' in h)),
    'V3.14.13 §36 Sin porcentaje ni puntaje de dominio por habilidad');
  void resumen;
}

// ===========================================================================
//  BATCH 15 — Recomendaciones (§34)
// ===========================================================================
async function batch15(ctx) {
  objective('BATCH 15 · Ranking 40/30/15/10/5 sin afinidad, «No me interesa» y guardar');
  const est = await provisionAndActivate(ctx.admin, {
    firstName: 'Iris', lastName: 'Sugerida', email: correoEst('b15'), role: 'STUDENT', semester: 3,
  });
  const director = await provisionAndActivate(ctx.admin, { firstName: 'Tadeo', lastName: 'Oferta', email: correoStaff('b15dir'), role: 'CAREER_DIRECTOR' });
  const letras = (n) => String.fromCharCode(...String(TS + n).slice(-6).split('').map((d) => 65 + Number(d)));
  const sufijo = letras(15);
  const area = async (n, tag) => (await req('POST', '/academic-areas', { token: ctx.admin, body: { name: `${n} ${sufijo}`, tags: [`${tag}${sufijo.toLowerCase()}`] } })).data;
  const aInt = await area('Computacion Afectiva', 'afectiv');
  const aMej = await area('Cartografia Digital', 'cartog');
  const sInt = (await req('POST', '/skills', { token: ctx.admin, body: { name: `Emotiv${sufijo}`, academicAreaId: aInt.id } })).data;

  await req('PUT', '/profiles/me/interests', { token: est.token, body: { items: [{ academicAreaId: aInt.id, priority: 1 }] } });
  await req('PATCH', '/profiles/me', { token: est.token, body: { improvementAreaIds: [aMej.id] } });
  await req('PUT', '/profiles/me/skill-interests', { token: est.token, body: { items: [{ skillId: sInt.id, kind: 'interest' }] } });

  const cats = (await req('GET', '/activity-categories', { token: director.token })).data ?? [];
  const taller = cats.find((c) => c.code === 'taller_academico') ?? cats[0];
  const crear = async (titulo, a, extra = {}) => (await req('POST', '/activities', {
    token: director.token,
    body: { title: `${titulo} ${TS}`, description: 'Escenario de recomendaciones V3.', type: 'academica', categoryId: taller.id, areaId: a.id, status: 'open', ...extra },
  })).data;
  const t1 = await crear('Taller de emociones uno', aInt, { skillIds: [sInt.id] });
  const t2 = await crear('Taller de emociones dos', aInt);
  const t3 = await crear('Taller de emociones tres', aInt);
  const m1 = await crear('Taller de mapas', aMej);
  const m2 = await crear('Taller de mapas avanzado', aMej);

  const leer = async () => {
    return ((await req('GET', '/recommendations/me', { token: est.token })).data?.groups ?? []).flatMap((g) => g.items);
  };
  let items = await leer();
  const de = (act) => items.find((i) => i.targetId === act.id);
  const pts = (item, code) => (item?.reasons ?? []).filter((r) => r.code === code).reduce((a, r) => a + r.points, 0);

  const reglas = (await req('GET', '/recommendations/rules', { token: est.token })).data;
  check(JSON.stringify((reglas?.ranking ?? []).map((r) => r.weight)) === JSON.stringify([40, 30, 15, 10, 5]),
    'V3.15.1 §34 Reparto publicado: 40 / 30 / 15 / 10 / 5', JSON.stringify(reglas?.ranking?.map((r) => [r.code, r.weight])));
  check(pts(de(t1), 'preferred_area') === 40 && pts(de(t1), 'skill_match') === 15,
    'V3.15.2 §34 Interés explícito 40 y tecnología de interés 15', JSON.stringify(de(t1)?.reasons));
  check(pts(de(m1), 'improvement_area') === 30, 'V3.15.3 §34 Área de mejora 30', JSON.stringify(de(m1)?.reasons));
  check(items.every((i) => !(i.reasons ?? []).some((r) => r.code === 'affinity_area')),
    'V3.15.4 §34 La afinidad no es factor de ninguna recomendación');
  check(items.every((i) => Math.abs((i.reasons ?? []).reduce((a, r) => a + r.points, 0) - Number(i.score)) < 0.011),
    'V3.15.5 Los motivos suman el puntaje y cada uno explica por qué se muestra');

  // ----- §34.1 No me interesa
  const intereses = async () => {
    const yo = (await req('GET', '/profiles/me', { token: est.token })).data;
    const tec = (await req('GET', '/profiles/me/skill-interests', { token: est.token })).data;
    return JSON.stringify([yo?.improvementAreaIds, yo?.preferredAreas ?? yo?.interests ?? null, tec]);
  };
  const interesesAntes = await intereses();
  const antesT2 = Number(de(t2)?.score);
  const descartar = await req('PATCH', `/recommendations/me/${de(t3).id}`, { token: est.token, body: { status: 'dismissed' } });
  check(descartar.status === 200, 'V3.15.6 §34.1 «No me interesa»', `status ${descartar.status}`);
  const audit = await req('GET', `/audit/events?eventType=RECOMMENDATION_DISMISSED&entityId=${de(t3).id}`, { token: ctx.admin });
  check((audit.data?.items ?? audit.data ?? []).length >= 1, 'V3.15.7 §34.1 Queda registrado RECOMMENDATION_DISMISSED');
  const interesesDespues = await intereses();
  check(interesesAntes === interesesDespues,
    'V3.15.8 §34.1 No modifica los intereses del perfil');
  items = await leer();
  check(!de(t3), 'V3.15.9 Lo descartado no vuelve a proponerse');
  check(Number(de(t2)?.score) < antesT2 && pts(de(t2), 'dismissed_similar') < 0,
    'V3.15.10 §34.1 Lo parecido (misma área y tipo) baja de prioridad y dice por qué', `${antesT2} → ${de(t2)?.score} ${JSON.stringify(de(t2)?.reasons)}`);
  check(Number(de(m1)?.score) === 30 + 0 || !pts(de(m1), 'dismissed_similar'),
    'V3.15.11 Lo no parecido no se ve afectado', JSON.stringify(de(m1)?.reasons));

  // ----- Feedback positivo (5 %)
  await req('PATCH', `/recommendations/me/${de(m1).id}`, { token: est.token, body: { status: 'saved' } });
  items = await leer();
  check(pts(de(m2), 'similar_saved') === 5, 'V3.15.12 §34 Guardar algo parecido suma el 5 % de feedback', JSON.stringify(de(m2)?.reasons));
}

// ===========================================================================
//  BATCH 16 — Notificaciones (§33)
// ===========================================================================
async function batch16(ctx) {
  objective('BATCH 16 · Centro de notificaciones: eventos, leído/no leído, dedupe y recordatorios');
  await asegurarGithubSimulado();
  const est = await provisionAndActivate(ctx.admin, { firstName: 'Noa', lastName: 'Avisos', email: correoEst('b16'), role: 'STUDENT', semester: 2 });
  est.profileId = (await req('GET', '/profiles/me', { token: est.token })).data?.id;
  const otro = await provisionAndActivate(ctx.admin, { firstName: 'Leo', lastName: 'Ajeno', email: correoEst('b16b'), role: 'STUDENT', semester: 2 });
  otro.profileId = (await req('GET', '/profiles/me', { token: otro.token })).data?.id;
  const director = await provisionAndActivate(ctx.admin, { firstName: 'Ada', lastName: 'Aviso', email: correoStaff('b16dir'), role: 'CAREER_DIRECTOR' });
  const docente = await provisionAndActivate(ctx.admin, { firstName: 'Ciro', lastName: 'Comenta', email: correoStaff('b16doc'), role: 'TEACHER' });
  await req('PUT', `/users/${docente.userId}/semesters`, { token: ctx.admin, body: { semesters: [2] } });

  const bandeja = async (token, extra = '') => (await req('GET', `/notifications/me${extra}`, { token })).data ?? [];
  const deTipo = async (token, tipo) => (await bandeja(token)).filter((n) => n.type === tipo);
  const cats = (await req('GET', '/activity-categories', { token: director.token })).data ?? [];
  const taller = cats.find((c) => c.code === 'taller_academico') ?? cats[0];
  const hora = 3_600_000;
  const actividad = async (titulo, enHoras) => (await req('POST', '/activities', {
    token: director.token,
    body: { title: `${titulo} ${TS}`, type: 'academica', categoryId: taller.id, status: 'open', activityDate: new Date(Date.now() + enHoras * hora).toISOString() },
  })).data;

  // ----- PARTICIPATION_CONFIRMED + dedupe
  const a1 = await actividad('Charla de bienvenida', 72);
  await req('POST', `/activities/${a1.id}/register`, { token: est.token });
  const confirmar = (status) => req('PATCH', `/activities/${a1.id}/confirm-participation`, { token: director.token, body: { studentProfileId: est.profileId, status } });
  await confirmar('confirmed');
  let n = await deTipo(est.token, 'PARTICIPATION_CONFIRMED');
  check(n.length === 1 && n[0].link && !n[0].readAt && n[0].entityType === 'activity_registration',
    'V3.16.1 §33 PARTICIPATION_CONFIRMED llega al estudiante, no leída, con enlace', JSON.stringify(n[0] ?? null));
  await confirmar('absent');
  await confirmar('confirmed');
  check((await deTipo(est.token, 'PARTICIPATION_CONFIRMED')).length === 1, 'V3.16.2 §33.1 La misma alerta no se repite (dedupe_key)');

  // ----- leído / no leído
  const antes = (await req('GET', '/notifications/me/unread-count', { token: est.token })).data?.unread;
  const ajena = await req('PATCH', `/notifications/${n[0].id}/read`, { token: otro.token });
  check(ajena.status === 404, 'V3.16.3 Nadie marca ni ve una notificación ajena -> 404', `status ${ajena.status}`);
  check(!(await bandeja(otro.token)).some((x) => x.id === n[0].id), 'V3.16.4 La bandeja de otro no la incluye');
  const leida = await req('PATCH', `/notifications/${n[0].id}/read`, { token: est.token });
  const despues = (await req('GET', '/notifications/me/unread-count', { token: est.token })).data?.unread;
  check(leida.status === 200 && !!leida.data?.readAt && despues === antes - 1, 'V3.16.5 Marcar como leída baja el contador', `${antes} → ${despues}`);
  check((await bandeja(est.token, '?unread=true')).every((x) => !x.readAt), 'V3.16.6 Filtro de no leídas');

  // ----- Recordatorios con frecuencia controlada
  const manana = await actividad('Taller de mañana', 20);
  const pronto = await actividad('Taller en dos horas', 2);
  const interes = await actividad('Seminario de interés', 18);
  await req('POST', `/activities/${manana.id}/register`, { token: est.token });
  await req('POST', `/activities/${pronto.id}/register`, { token: est.token });
  await req('POST', `/activities/${interes.id}/register-interest`, { token: est.token });
  const lejana = await actividad('Congreso lejano', 24 * 10);
  await req('POST', `/activities/${lejana.id}/register`, { token: est.token });
  const vuelta = await req('POST', '/notifications/admin/run-reminders', { token: ctx.admin });
  check(vuelta.status === 200, 'V3.16.7 La vuelta de recordatorios corre (cada media hora sola)', `status ${vuelta.status}`);
  await req('POST', '/notifications/admin/run-reminders', { token: ctx.admin });
  const recordatorios = await deTipo(est.token, 'ACTIVITY_STARTING');
  const de = (act) => recordatorios.filter((x) => x.entityId === act.id).length;
  check(de(manana) === 1, 'V3.16.8 §33.1 Inscrito: aviso el día antes, una sola vez aunque la vuelta corra dos veces', `${de(manana)}`);
  check(de(pronto) === 2, 'V3.16.9 §33.1 Y otro unas horas antes', `${de(pronto)}`);
  check(de(lejana) === 0, 'V3.16.10 Nada para lo que falta mucho');
  const deInteres = (await deTipo(est.token, 'ACTIVITY_INTEREST_REMINDER')).filter((x) => x.entityId === interes.id);
  check(deInteres.length === 1, 'V3.16.11 §33.1 Interesado: un solo aviso, con menos frecuencia', `${deInteres.length}`);

  // ----- Equipos y proyectos
  const nec = (await req('POST', '/team-needs', { token: est.token, body: { purpose: `Equipo de avisos ${TS}`, maxMembers: 3 } })).data;
  const eq = (await req('POST', `/team-needs/${nec.id}/team`, { token: est.token, body: { name: `Equipo Aviso ${String(TS).slice(-5)}` } })).data;
  await req('POST', `/teams/${eq.id}/invitations`, { token: est.token, body: { invitedProfileId: otro.profileId } });
  check((await deTipo(otro.token, 'TEAM_INVITATION')).length === 1, 'V3.16.12 §33 TEAM_INVITATION');

  const proy = await crearProyectoBorrador(est.token, { title: `Proyecto con avisos ${TS}`, visibility: 'teachers' });
  const inv = await req('POST', `/projects/${proy.data.id}/invitations`, { token: est.token, body: { invitedProfileId: otro.profileId, proposedRole: 'Backend' } });
  check((await deTipo(otro.token, 'PROJECT_INVITATION')).length === 1, 'V3.16.13 Invitación a proyecto');
  await req('PATCH', `/projects/invitations/${inv.data.id}`, { token: otro.token, body: { decision: 'accept' } });
  check((await deTipo(otro.token, 'PROJECT_MEMBER_CONFIRMATION_REQUIRED')).length === 1, 'V3.16.14 §33 PROJECT_MEMBER_CONFIRMATION_REQUIRED al aceptar');
  const detallados = (await req('GET', `/projects/${proy.data.id}/members/detailed`, { token: est.token })).data ?? [];
  const suyo = detallados.find((m) => m.userId === otro.userId);
  await req('PATCH', `/projects/${proy.data.id}/members/${suyo.id}/contribution`, { token: est.token, body: { contribution: 'API y pruebas.' } });
  check((await deTipo(otro.token, 'PROJECT_CONTRIBUTION_CHANGED')).length === 1, 'V3.16.15 §33 PROJECT_CONTRIBUTION_CHANGED');
  const fb = await req('POST', `/projects/${proy.data.id}/feedback`, { token: docente.token, body: { comment: 'Buen avance en la arquitectura del proyecto.' } });
  check(fb.status === 201 && (await deTipo(est.token, 'TEACHER_FEEDBACK_RECEIVED')).length === 1
    && (await deTipo(otro.token, 'TEACHER_FEEDBACK_RECEIVED')).length === 1,
  'V3.16.16 §33 TEACHER_FEEDBACK_RECEIVED al responsable y a los integrantes', `status ${fb.status}`);

  // ----- Todas leídas
  const todas = await req('POST', '/notifications/me/read-all', { token: est.token });
  check(todas.status === 200 && (await req('GET', '/notifications/me/unread-count', { token: est.token })).data?.unread === 0,
    'V3.16.17 Marcar todas como leídas', JSON.stringify(todas.data));
}

// ===========================================================================
//  BATCH 17 — Colaboración, contactos y equipos (§31, §32, §55, §56)
// ===========================================================================
async function batch17(ctx) {
  objective('BATCH 17 · Necesidad → semestres → áreas/skills → cupos → postulación → aceptar/rechazar → equipo');
  const alumno = async (sufijo, nombre, semestre) => {
    const e = await provisionAndActivate(ctx.admin, { firstName: nombre, lastName: 'Equipo', email: correoEst(`b17${sufijo}`), role: 'STUDENT', semester: semestre });
    e.profileId = (await req('GET', '/profiles/me', { token: e.token })).data?.id;
    return e;
  };
  const lider = await alumno('lid', 'Lía', 5);
  const ana = await alumno('ana', 'Ana', 5);
  const beto = await alumno('bet', 'Beto', 6);
  const caro = await alumno('car', 'Caro', 2);
  const dani = await alumno('dan', 'Dani', 5);
  const eli = await alumno('eli', 'Eli', 6);

  const catalogo = ((await req('GET', '/skills', { token: lider.token })).data ?? []).filter((s) => s.academicAreaId);
  const sk = catalogo[0];
  const ajena = catalogo.find((s) => s.academicAreaId !== sk.academicAreaId);

  // ----- Área → solo skills de esa área (§55)
  const mala = await req('POST', '/team-needs', {
    token: lider.token,
    body: { purpose: `Mal armada ${TS}`, preferredAreaIds: [sk.academicAreaId], requiredSkillIds: [ajena.id], targetSemesters: [5] },
  });
  check(mala.status === 400, 'V3.17.1 §55 Una habilidad de otra área se rechaza', `status ${mala.status}`);
  const semMala = await req('POST', '/team-needs', { token: lider.token, body: { purpose: `Semestre 13 ${TS}`, targetSemesters: [13] } });
  check(semMala.status === 400, 'V3.17.2 Semestres fuera de rango se rechazan', `status ${semMala.status}`);

  const nec = await req('POST', '/team-needs', {
    token: lider.token,
    body: {
      purpose: `Plataforma de tutorías ${TS}`, preferredAreaIds: [sk.academicAreaId], requiredSkillIds: [sk.id],
      targetSemesters: [6, 5], maxMembers: 3, availabilityRequirement: 'any',
    },
  });
  check(nec.status === 201 && JSON.stringify(nec.data?.targetSemesters) === '[5,6]', 'V3.17.3 §55 Necesidad con semestres objetivo, áreas, skills y cupos', JSON.stringify(nec.data?.targetSemesters));
  const necId = nec.data.id;

  // ----- Visibilidad por semestre
  const ve = async (e) => ((await req('GET', '/team-needs', { token: e.token })).data ?? []).find((n) => n.id === necId);
  const vistaAna = await ve(ana);
  check(!!vistaAna && vistaAna.openings === 2 && vistaAna.myApplication === null, 'V3.17.4 La ve quien cursa un semestre objetivo, con sus cupos', JSON.stringify(vistaAna && { o: vistaAna.openings }));
  check(!(await ve(caro)), 'V3.17.5 §55 No la ve quien está en otro semestre');
  const fuera = await req('POST', `/team-needs/${necId}/applications`, { token: caro.token, body: {} });
  check(fuera.status === 404, 'V3.17.6 Ni puede postular cambiando el id a mano -> 404', `status ${fuera.status}`);
  const propia = await req('POST', `/team-needs/${necId}/applications`, { token: lider.token, body: {} });
  check(propia.status === 400, 'V3.17.7 El responsable no postula a su propia necesidad', `status ${propia.status}`);

  // ----- Postular
  const pAna = await req('POST', `/team-needs/${necId}/applications`, { token: ana.token, body: { message: 'Hice el backend de dos proyectos.' } });
  check(pAna.status === 201 && pAna.data?.status === 'pending', 'V3.17.8 §31 Postula', `status ${pAna.status}`);
  const otra = await req('POST', `/team-needs/${necId}/applications`, { token: ana.token, body: {} });
  check(otra.status === 409 && otra.data?.code === 'TEAM_APPLICATION_PENDING', 'V3.17.9 No se postula dos veces', JSON.stringify(otra.data?.code));
  const larga = await req('POST', `/team-needs/${necId}/applications`, { token: beto.token, body: { message: 'x'.repeat(301) } });
  check(larga.status === 400, 'V3.17.10 §55 Sin abuso de texto libre: presentación de hasta 300', `status ${larga.status}`);
  const pBeto = await req('POST', `/team-needs/${necId}/applications`, { token: beto.token, body: {} });
  const pDani = await req('POST', `/team-needs/${necId}/applications`, { token: dani.token, body: {} });
  const notifLider = ((await req('GET', '/notifications/me', { token: lider.token })).data ?? []).filter((n) => n.type === 'TEAM_APPLICATION');
  check(notifLider.length === 3, 'V3.17.11 §33 TEAM_APPLICATION al responsable por cada una', `${notifLider.length}`);

  // ----- Solo el responsable decide y ve
  const ajenas = await req('GET', `/team-needs/${necId}/applications`, { token: ana.token });
  check(ajenas.status === 403, 'V3.17.12 Otro estudiante no ve las postulaciones', `status ${ajenas.status}`);
  const robo = await req('PATCH', `/team-applications/${pBeto.data.id}`, { token: ana.token, body: { decision: 'accept' } });
  check(robo.status === 404, 'V3.17.13 Ni decide sobre ellas -> 404', `status ${robo.status}`);
  const lista = (await req('GET', `/team-needs/${necId}/applications`, { token: lider.token })).data ?? [];
  check(lista.length === 3 && lista.every((p) => p.applicant?.name && Array.isArray(p.coversSkills) && !('score' in p)),
    'V3.17.14 El responsable ve quién, su semestre y qué cubre, sin ranking', `${lista.length}`);

  // ----- Rechazar con motivo controlado
  const sinMotivo = await req('PATCH', `/team-applications/${pDani.data.id}`, { token: lider.token, body: { decision: 'reject' } });
  check(sinMotivo.status === 400 && sinMotivo.data?.code === 'TEAM_APPLICATION_REASON_REQUIRED', 'V3.17.15 §55 Rechazar exige un motivo', JSON.stringify(sinMotivo.data?.code));
  const inventado = await req('PATCH', `/team-applications/${pDani.data.id}`, { token: lider.token, body: { decision: 'reject', reason: 'me_cae_mal' } });
  check(inventado.status === 400, 'V3.17.16 §55 Solo motivos predefinidos', `status ${inventado.status}`);
  const otroSin = await req('PATCH', `/team-applications/${pDani.data.id}`, { token: lider.token, body: { decision: 'reject', reason: 'other' } });
  check(otroSin.status === 400 && otroSin.data?.code === 'TEAM_APPLICATION_COMMENT_REQUIRED', 'V3.17.17 «Otro motivo» pide un comentario breve', JSON.stringify(otroSin.data?.code));
  const rech = await req('PATCH', `/team-applications/${pDani.data.id}`, { token: lider.token, body: { decision: 'reject', reason: 'schedule', comment: 'Nos reunimos por las mañanas.' } });
  check(rech.status === 200 && rech.data?.reasonLabel === 'La disponibilidad no coincide', 'V3.17.18 Rechaza con motivo y comentario opcional', JSON.stringify(rech.data));
  const nDani = ((await req('GET', '/notifications/me', { token: dani.token })).data ?? []).find((n) => n.type === 'TEAM_APPLICATION_REJECTED');
  check(!!nDani && nDani.body.includes('La disponibilidad no coincide'), 'V3.17.19 §33 TEAM_APPLICATION_REJECTED con el motivo', nDani?.body);
  const insiste = await req('POST', `/team-needs/${necId}/applications`, { token: dani.token, body: {} });
  check(insiste.status === 409 && insiste.data?.code === 'TEAM_APPLICATION_REJECTED', 'V3.17.20 Un rechazo no se reabre insistiendo', JSON.stringify(insiste.data?.code));

  // ----- Aceptar constituye el equipo
  const acA = await req('PATCH', `/team-applications/${pAna.data.id}`, { token: lider.token, body: { decision: 'accept' } });
  check(acA.status === 200 && !!acA.data?.teamId && acA.data?.needClosed === false, 'V3.17.21 §31 Aceptar constituye el equipo si no existía', JSON.stringify(acA.data));
  const nAna = ((await req('GET', '/notifications/me', { token: ana.token })).data ?? []).filter((n) => n.type === 'TEAM_APPLICATION_ACCEPTED');
  check(nAna.length === 1, 'V3.17.22 §33 TEAM_APPLICATION_ACCEPTED');
  const equipoAna = ((await req('GET', '/teams/mine', { token: ana.token })).data ?? []).find((t) => t.id === acA.data.teamId);
  check(!!equipoAna && equipoAna.members.length === 2 && equipoAna.openings === 1, 'V3.17.23 Entra al equipo y baja el cupo', JSON.stringify(equipoAna && equipoAna.members.length));

  // Eli postula en el último momento; al llenarse los cupos queda respondida.
  const pEli = await req('POST', `/team-needs/${necId}/applications`, { token: eli.token, body: {} });
  const acB = await req('PATCH', `/team-applications/${pBeto.data.id}`, { token: lider.token, body: { decision: 'accept' } });
  check(acB.status === 200 && acB.data?.needClosed === true, 'V3.17.24 Con los cupos llenos la necesidad se cierra', JSON.stringify(acB.data));
  const eliVe = ((await req('GET', '/team-applications/mine', { token: eli.token })).data ?? []).find((p) => p.id === pEli.data.id);
  check(eliVe?.status === 'rejected' && eliVe?.rejectionReason === 'team_full', 'V3.17.25 Y quien esperaba recibe «equipo completo», no silencio', JSON.stringify(eliVe && eliVe.rejectionReason));
  const cerrada = await req('POST', `/team-needs/${necId}/applications`, { token: dani.token, body: {} });
  check([404, 409].includes(cerrada.status), 'V3.17.26 Una necesidad cerrada no recibe postulaciones', `status ${cerrada.status}`);

  // ----- Retirar y volver a postular
  const nec2 = (await req('POST', '/team-needs', { token: lider.token, body: { purpose: `Segunda búsqueda ${TS}`, maxMembers: 4 } })).data;
  const p2 = await req('POST', `/team-needs/${nec2.id}/applications`, { token: caro.token, body: {} });
  check(p2.status === 201, 'V3.17.27 Sin semestres objetivo la ve y postula cualquiera', `status ${p2.status}`);
  const ret = await req('DELETE', `/team-applications/${p2.data.id}`, { token: caro.token });
  const vuelve = await req('POST', `/team-needs/${nec2.id}/applications`, { token: caro.token, body: {} });
  check(ret.status === 200 && vuelve.status === 201 && vuelve.data.id === p2.data.id, 'V3.17.28 Retirar permite volver a postular, sin filas nuevas');

  // ----- Sugerencias respetan el semestre (§56)
  const sug = await req('GET', `/team-needs/${necId}/suggestions`, { token: lider.token });
  check(sug.status === 200 && !(sug.data?.candidates ?? []).some((c) => c.semester !== null && ![5, 6].includes(c.semester)),
    'V3.17.29 §56 Las sugerencias solo traen semestres elegibles', `status ${sug.status}`);

  // ----- Usar el equipo en un proyecto (§31) y el chat sigue retirado
  const proy = await req('POST', '/projects', {
    token: lider.token,
    body: {
      title: `Proyecto del equipo ${TS}`, areaIds: [sk.academicAreaId], skillIds: [sk.id],
      repositoryUrl: repoDePrueba(`tutorias-${TS}`), teamId: acA.data.teamId, inviteTeamMembers: true, status: 'draft',
    },
  });
  const precargadas = (await req('GET', `/projects/${proy.data?.id}/invitations`, { token: lider.token })).data ?? [];
  check(proy.status === 201 && precargadas.length === 2, 'V3.17.30 §31 El equipo formado por postulaciones se usa en un proyecto: precarga sus integrantes', `${proy.status} ${precargadas.length}`);
  const chat = await req('GET', '/conversations', { token: ana.token });
  check(chat.status === 410, 'V3.17.31 §32 Sin chat: la mensajería sigue retirada (410)', `status ${chat.status}`);
}

// ===========================================================================
//  BATCH 18 — Trayectoria, perfil y currículo (§41 a §45, §64)
// ===========================================================================
async function batch18(ctx) {
  objective('BATCH 18 · Mi trayectoria con niveles y currículo en dos niveles: secciones → ítems elegibles');
  await asegurarGithubSimulado();
  const est = await provisionAndActivate(ctx.admin, { firstName: 'Vera', lastName: 'Curriculum', email: correoEst('b18'), role: 'STUDENT', semester: 7 });
  est.profileId = (await req('GET', '/profiles/me', { token: est.token })).data?.id;
  const otro = await provisionAndActivate(ctx.admin, { firstName: 'Iker', lastName: 'Ajeno', email: correoEst('b18b'), role: 'STUDENT', semester: 7 });
  const director = await provisionAndActivate(ctx.admin, { firstName: 'Dora', lastName: 'Directora', email: correoStaff('b18dir'), role: 'CAREER_DIRECTOR' });
  const docente = await provisionAndActivate(ctx.admin, { firstName: 'Tito', lastName: 'Tutor', email: correoStaff('b18doc'), role: 'TEACHER' });
  await req('PUT', `/users/${docente.userId}/semesters`, { token: ctx.admin, body: { semesters: [7] } });
  const sociedad = await provisionAndActivate(ctx.admin, { firstName: 'Sol', lastName: 'Sociedad', email: correoStaff('b18soc'), role: 'SCIENTIFIC_SOCIETY' });

  // ----- Proyectos: uno corroborado y uno en borrador
  const catalogo = ((await req('GET', '/skills', { token: est.token })).data ?? []).filter((s) => s.academicAreaId);
  const sk = catalogo[0];
  const nuevo = (titulo, repo) => req('POST', '/projects', {
    token: est.token,
    body: { title: `${titulo} ${TS}`, areaIds: [sk.academicAreaId], skillIds: [sk.id], repositoryUrl: repo, visibility: 'teachers', status: 'draft' },
  });
  const corroborado = (await nuevo('Sistema de turnos', repoQueCorrobora(sk.name))).data;
  await req('POST', `/projects/${corroborado.id}/evidences`, { token: est.token, body: { evidenceType: 'link', externalUrl: `https://capturas.example.org/${corroborado.id}.png`, description: 'Captura.' } });
  await req('PUT', `/projects/${corroborado.id}/my-contribution`, { token: est.token, body: { contribution: 'Backend y base de datos.', skillIds: [sk.id] } });
  const activo = await req('PATCH', `/projects/${corroborado.id}`, { token: est.token, body: { status: 'active' } });
  const borrador = (await nuevo('Idea sin terminar', repoDePrueba(`generico-b18-${TS}`))).data;

  // ----- Actividades: académica con constancia, extracurricular y una sin confirmar
  const cats = (await req('GET', '/activity-categories', { token: director.token })).data ?? [];
  const catAcad = cats.find((c) => c.code === 'taller_academico') ?? cats[0];
  const catExtra = cats.find((c) => c.appliesTo === 'extracurricular') ?? cats.find((c) => c.code === 'reto') ?? cats[0];
  const actividad = async (titulo, type, categoryId, dias, extra = {}, quien = director) => {
    const r = await req('POST', '/activities', {
      token: quien.token,
      // La Sociedad crea en borrador y la Dirección aprueba (V2 §27).
      body: { title: `${titulo} ${TS}`, type, categoryId, ...(quien === director ? { status: 'open' } : {}), activityDate: new Date(Date.now() + dias * 86_400_000).toISOString(), ...extra },
    });
    if (r.status !== 201) throw new Error(`No se pudo crear «${titulo}»: ${JSON.stringify(r.data)}`);
    // V2 §27: lo de la Sociedad pasa por Dirección.
    if (r.data.requiresReview) await aprobarActividad(quien.token, director.token, r.data.id);
    return r.data;
  };
  // §14.1: con esta política, confirmar la participación emite la constancia.
  const acad1 = await actividad('Clase espejo de bases de datos', 'academica', catAcad.id, 3, { outcomePolicy: 'internal_constancy' });
  const acad2 = await actividad('Taller de pruebas', 'academica', catAcad.id, 4);
  const extra = await actividad('Hackatón interna', 'extracurricular', catExtra.id, 5, {}, sociedad);
  const pendiente = await actividad('Seminario por confirmar', 'academica', catAcad.id, 6);
  for (const a of [acad1, acad2, extra, pendiente]) await req('POST', `/activities/${a.id}/register`, { token: est.token });
  for (const [a, quien] of [[acad1, director], [acad2, director], [extra, sociedad]]) {
    await req('PATCH', `/activities/${a.id}/confirm-participation`, { token: quien.token, body: { studentProfileId: est.profileId, status: 'confirmed' } });
  }
  const constancia = { status: ((await req('GET', '/constancies/internal/my', { token: est.token })).data ?? []).some((c) => c.activityId === acad1.id) ? 201 : 404 };

  // ----- Credencial externa declarada (no corroborada)
  const cert = await req('POST', '/certificates/external', { token: est.token, body: { certificateName: `Curso de Docker ${TS}`, issuer: 'Plataforma X' } });

  // ----- Retroalimentación docente
  await req('POST', `/projects/${corroborado.id}/feedback`, { token: docente.token, body: { comment: 'Buena separación de capas en el backend.' } });

  check(activo.data?.backingTier === 'corroborated' && constancia.status === 201 && cert.status === 201,
    'V3.18.0 Preparación: proyecto corroborado, constancia emitida y credencial declarada',
    JSON.stringify({ t: activo.data?.backingTier, c: constancia.status, x: cert.status }));

  // =========================================================== §42 Trayectoria
  const tray = await req('GET', '/trajectory/me', { token: est.token });
  const entrada = (kind, id) => (tray.data?.entries ?? []).find((e) => e.kind === kind && e.id === id);
  check(tray.status === 200 && (tray.data?.levels ?? []).map((l) => l.label).join('|') === 'Declarado|Con respaldo|Corroborado|Revisado|Inconcluso',
    'V3.18.1 §42 Distingue Declarado, Con respaldo, Corroborado, Revisado e Inconcluso', JSON.stringify(tray.data?.levels?.map((l) => l.label)));
  // Con la retroalimentación docente, el proyecto corroborado pasa a REVIEWED.
  check(entrada('project', corroborado.id)?.levelLabel === 'Revisado' && entrada('project', corroborado.id)?.cvEligible === true,
    'V3.18.2 El proyecto revisado por un docente aparece como tal y es elegible para el currículo', entrada('project', corroborado.id)?.levelLabel);
  check(entrada('project', borrador.id)?.levelLabel === 'Inconcluso' && entrada('project', borrador.id)?.cvEligible === false,
    'V3.18.3 El borrador sigue en la trayectoria como inconcluso, explicado', entrada('project', borrador.id)?.detail);
  check(entrada('activity', pendiente.id)?.levelLabel === 'Inconcluso' && /confirme/.test(entrada('activity', pendiente.id)?.detail ?? ''),
    'V3.18.4 La inscripción sin confirmar dice qué le falta', entrada('activity', pendiente.id)?.detail);
  check(entrada('activity', acad1.id)?.levelLabel === 'Corroborado', 'V3.18.5 La participación confirmada está corroborada por el responsable');
  check(entrada('credential', cert.data.id)?.cvEligible === false && ['Declarado', 'Con respaldo', 'Inconcluso'].includes(entrada('credential', cert.data.id)?.levelLabel),
    'V3.18.6 La credencial sin corroborar sigue en la trayectoria, sin ofrecerse al currículo', entrada('credential', cert.data.id)?.levelLabel);
  check((tray.data?.entries ?? []).some((e) => e.kind === 'feedback' && e.levelLabel === 'Revisado') && (tray.data?.entries ?? []).some((e) => e.kind === 'constancy'),
    'V3.18.7 §42 Incluye constancias y feedback docente');
  check(Array.isArray(tray.data?.evolution), 'V3.18.8 §42 Y la evolución de afinidad y respaldo');
  const docenteVe = await req('GET', '/trajectory/me', { token: docente.token });
  check(docenteVe.status === 403, 'V3.18.9 La trayectoria es del estudiante: otro rol no la pide', `status ${docenteVe.status}`);

  // ======================================================= §43 Ítems elegibles
  const secciones = await req('GET', '/trajectory-summary/sections', { token: est.token });
  check((secciones.data?.cvSections ?? []).map((s) => s.label).join('|')
    === 'Perfil / resumen|Proyectos|Actividades académicas internas|Actividades extracurriculares internas|Credenciales / cursos externos|Constancias|Habilidades respaldadas|Insignias|Contacto',
  'V3.18.10 §43.1 Paso 1: las nueve secciones, en orden');
  const items = await req('GET', '/trajectory-summary/items', { token: est.token });
  const sec = (k) => (items.data?.sections ?? []).find((s) => s.key === k);
  check(sec('projects')?.items.map((i) => i.id).join() === corroborado.id && sec('projects')?.excluded?.count === 1,
    'V3.18.11 §43.3 Proyectos: solo el activo y corroborado; el borrador queda fuera con su motivo', JSON.stringify(sec('projects')));
  check(sec('academic_activities')?.items.length === 2 && sec('extracurricular_activities')?.items.map((i) => i.id).join() === extra.id,
    'V3.18.12 §43.1 Actividades internas confirmadas, separadas en académicas y extracurriculares');
  check(!sec('academic_activities')?.items.some((i) => i.id === pendiente.id) && sec('academic_activities')?.excluded?.count === 1,
    'V3.18.13 §44 La inscripción sin confirmar no se ofrece');
  check(sec('academic_activities')?.items.find((i) => i.id === acad1.id)?.detail?.includes('Constancia interna disponible'),
    'V3.18.14 §44 La constancia se indica en la misma actividad');
  check(sec('certificates')?.items.length === 0 && sec('certificates')?.excluded?.count === 1 && /corroboradas/.test(sec('certificates')?.excluded?.reason ?? ''),
    'V3.18.15 §45 Una credencial no corroborada no se ofrece: no prueba que terminaste', JSON.stringify(sec('certificates')?.excluded));

  // ================================================== §43.2 Selección de ítems
  const cv = (body) => req('POST', '/trajectory-summary/preview', { token: est.token, body });
  const soloUna = await cv({ sections: ['academic_activities', 'constancies'], items: { academic_activities: [acad2.id] } });
  check(soloUna.status === 201 && soloUna.data?.academicActivities?.map((a) => a.id).join() === acad2.id,
    'V3.18.16 §43.2 Paso 2: entra solo el ítem marcado', JSON.stringify(soloUna.data?.academicActivities));
  check((soloUna.data?.constancies ?? []).length === 1, 'V3.18.17 La constancia de una actividad no marcada sigue como constancia');
  const conAmbas = await cv({ sections: ['academic_activities', 'constancies'], items: { academic_activities: [acad2.id, acad1.id] } });
  check(conAmbas.data?.academicActivities?.map((a) => a.id).join() === `${acad2.id},${acad1.id}`,
    'V3.18.18 §43.4 El orden elegido se respeta');
  check((conAmbas.data?.constancies ?? []).length === 0 && conAmbas.data?.academicActivities?.find((a) => a.id === acad1.id)?.constancy === true,
    'V3.18.19 §44 Si la actividad ya está, su constancia no se duplica como otra experiencia');
  const certNo = await cv({ sections: ['certificates'], items: { certificates: [cert.data.id] } });
  check(certNo.status === 400 && certNo.data?.code === 'CV_ITEM_NOT_ELIGIBLE', 'V3.18.20 §43.3 Pedir una credencial no corroborada por id se rechaza', JSON.stringify(certNo.data?.code));
  const borradorNo = await cv({ sections: ['projects'], items: { projects: [borrador.id] } });
  check(borradorNo.status === 400 && borradorNo.data?.code === 'CV_ITEM_NOT_ELIGIBLE', 'V3.18.21 Y un borrador también');
  const ajeno = await req('POST', '/projects', { token: otro.token, body: { title: `Ajeno ${TS}`, areaIds: [sk.academicAreaId], skillIds: [sk.id], status: 'draft' } });
  const robo = await cv({ sections: ['projects'], items: { projects: [ajeno.data?.id ?? corroborado.id] } });
  check(robo.status === 400 && robo.data?.code === 'CV_ITEM_NOT_ELIGIBLE', 'V3.18.22 Ni el proyecto de otra persona metiendo su id');
  const raro = await cv({ sections: ['projects'], items: { nota_final: [corroborado.id] } });
  check(raro.status === 400, 'V3.18.23 Una sección inventada en la selección se rechaza', `status ${raro.status}`);
  const proy = await cv({ sections: ['projects', 'contributions'] });
  check(proy.data?.projects?.length === 1 && proy.data.projects[0].id === corroborado.id && proy.data.projects[0].level === 'Revisado',
    'V3.18.24 Sin lista, entran todos los elegibles con su nivel', JSON.stringify(proy.data?.projects?.map((p) => p.level)));

  // ================================================================ §43.4 PDF
  const res = await fetch(`${API}/trajectory-summary/pdf`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${est.token}` },
    body: JSON.stringify({ sections: ['projects', 'academic_activities', 'extracurricular_activities'], items: { academic_activities: [acad1.id] } }),
  });
  const pdf = Buffer.from(await res.arrayBuffer()).toString('latin1');
  check(res.status === 201 && pdf.startsWith('%PDF-') && pdf.includes('Participaci') && pdf.includes('Constancia interna disponible'),
    'V3.18.25 §43.4 El PDF sale de la misma selección', `status ${res.status}`);
  check(pdf.includes('registrada y respaldada en Afinia') && pdf.includes('No constituye historial'),
    'V3.18.26 §43.6 Con el descargo exacto de V3');
  check(!pdf.includes('Taller de pruebas'), 'V3.18.27 Y sin lo que no se marcó');
}

const BATCHES = { batch2, batch4, batch5, batch6, batch7, batch8, batch9, batch10, batch11, batch12, batch13, batch14, batch15, batch16, batch17, batch18 };

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
