/**
 * Cierre V4.1 — verificación contra la API en marcha.
 *
 * Una sección por batch del contrato (PLAN_BATCHES_AFINIA_V4_1.md). Cada
 * comprobación cita el ajuste (A41-xxx) o el caso de regresión (Bxx) del
 * contrato que verifica. Se ejecuta con la API en modo de correo simulado
 * (MAIL_TRANSPORT=console). Lo que solo se ve en el navegador está en
 * `e2e-web.mjs`.
 *
 * Uso:
 *   API_URL=http://localhost:3010/api node scripts/e2e-v4-1.mjs [batch]
 */
import { API, loginAdmin, provisionAndActivate, req } from './lib/fixtures.mjs';

const TS = Date.now();
const L = String.fromCharCode(...String(TS).slice(-6).split('').map((d) => 97 + Number(d)));

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
const correoStaff = (k) => `v41.${k}.${TS}@univalle.edu`;
const json = (x) => JSON.stringify(x ?? null).slice(0, 220);
const en = (h) => new Date(Date.now() + h * 3_600_000).toISOString();

// ===========================================================================
//  BATCH V4.1-1 — Activación, validaciones, grillas y UX básica (A41-001…004)
// ===========================================================================
async function batch1(ctx) {
  objective('BATCH V4.1-1 · Aula o lugar con contenido reconocible (A41-004)');
  const director = await provisionAndActivate(ctx.admin, { firstName: 'Delia', lastName: `Lugar${L}`, email: correoStaff('b1dir'), role: 'CAREER_DIRECTOR' });
  const cats = (await req('GET', '/activity-categories', { token: director.token })).data ?? [];
  const taller = cats.find((c) => c.code === 'taller_academico') ?? cats[0];
  const base = { type: 'academica', categoryId: taller.id, semesterScope: [3], activityDate: en(72), endAt: en(74), modality: 'presencial' };
  const crear = (location, extra = {}) => req('POST', '/activities', {
    token: director.token, body: { ...base, title: `Taller de lugar ${L} ${Math.random().toString(36).slice(2, 6)}`, location, ...extra },
  });

  for (const lugar of ['Aula 201', 'Laboratorio B-12', 'Auditorio Principal', 'Torre Académica, piso 4', 'Salón Ñandú']) {
    const r = await crear(lugar);
    check(r.status === 201 && r.data?.location === lugar, `V41.1.1 B03 «${lugar}» se acepta y se guarda igual`, `status ${r.status} ${json(r.data?.fields)}`);
  }
  for (const lugar of ['123123', '!@#$%^&', '____', '   ', '12-34']) {
    const r = await crear(lugar);
    const vacio = lugar.trim() === '';
    // Solo espacios: tras limpiar queda vacío y lo exige la modalidad presencial al publicar;
    // como borrador se admite incompleto (§4.6), así que se comprueba que no quede guardado como lugar.
    if (vacio) {
      check(r.status === 400 || (r.status === 201 && !r.data?.location),
        'V41.1.2 B04 Solo espacios no se guarda como lugar', `status ${r.status} location=${json(r.data?.location)}`);
    } else {
      check(r.status === 400 && /aula o lugar/i.test(JSON.stringify(r.data?.fields?.location ?? '')),
        `V41.1.2 B04 «${lugar}» se rechaza con el error en su campo`, `status ${r.status} ${json(r.data?.fields)}`);
    }
  }

  const valida = await crear('Aula 12');
  const editarMal = await req('PATCH', `/activities/${valida.data?.id}`, { token: director.token, body: { location: '0000' } });
  check(editarMal.status === 400 && !!editarMal.data?.fields?.location,
    'V41.1.3 B04 La misma regla al editar: «0000» se rechaza', `status ${editarMal.status}`);
  const editarBien = await req('PATCH', `/activities/${valida.data?.id}`, { token: director.token, body: { location: 'Laboratorio 3' } });
  check(editarBien.status === 200 && editarBien.data?.location === 'Laboratorio 3',
    'V41.1.4 B03 Y una corrección válida se guarda', `status ${editarBien.status}`);

  const virtual = await crear(undefined, { modality: 'virtual', meetingUrl: 'https://meet.afinia-pruebas.org/sala-v41' });
  check(virtual.status === 201, 'V41.1.5 Una actividad virtual no necesita aula (la regla no la afecta)', `status ${virtual.status}`);
}

// PNG válido de 1×1; los bytes extra después de IEND lo hacen distinto sin
// dejar de ser PNG (la subida deduplica por contenido para cada usuario).
const PNG_1X1 = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==',
  'base64',
);
let semillaPng = 0;
async function subirPng(token) {
  const bytes = Buffer.concat([PNG_1X1, Buffer.from(`afinia-v41-${TS}-${semillaPng++}`)]);
  const form = new FormData();
  form.append('file', new Blob([bytes], { type: 'image/png' }), `img-${semillaPng}.png`);
  const res = await fetch(`${API}/uploads`, { method: 'POST', headers: { Authorization: `Bearer ${token}` }, body: form });
  return (await res.json())?.id;
}

// ===========================================================================
//  BATCH V4.1-2 — Formulario de actividad e imágenes (A41-005…007, V41-01)
// ===========================================================================
async function batch2(ctx) {
  objective('BATCH V4.1-2 · Habilidades al editar, charla general, responsable al publicar y hasta 5 imágenes');
  const director = await provisionAndActivate(ctx.admin, { firstName: 'Diana', lastName: `Imagen${L}`, email: correoStaff('b2dir'), role: 'CAREER_DIRECTOR' });
  const docente = await provisionAndActivate(ctx.admin, { firstName: 'Carlos', lastName: `Imagen${L}`, email: correoStaff('b2doc'), role: 'TEACHER' });
  await req('PUT', `/users/${docente.userId}/semesters`, { token: ctx.admin, body: { semesters: [1, 2, 3, 4] } });
  const est = await provisionAndActivate(ctx.admin, { firstName: 'Eli', lastName: `Imagen${L}`, email: `v41.b2est.${TS}@est.univalle.edu`, role: 'STUDENT', semester: 3 });
  const areas = (await req('GET', '/academic-areas', { token: ctx.admin })).data ?? [];
  const skills = (await req('GET', '/skills', { token: ctx.admin })).data ?? [];
  const cats = (await req('GET', '/activity-categories', { token: director.token })).data ?? [];
  const taller = cats.find((c) => c.code === 'taller_academico') ?? cats[0];
  const bd = areas.find((a) => a.code === 'bases_de_datos');
  const redes = areas.find((a) => /redes/i.test(a.code));
  const ia = areas.find((a) => /inteligencia/i.test(a.code)) ?? areas.find((a) => a.id !== bd.id && a.id !== redes.id);
  const mongo = skills.find((s) => s.code === 'mongodb') ?? skills.find((s) => s.academicAreaId === bd.id);
  const deRedes = skills.find((s) => s.academicAreaId === redes.id && s.isActive !== false);
  const base = { type: 'academica', categoryId: taller.id, semesterScope: [3], activityDate: en(72), endAt: en(74), modality: 'presencial', location: 'Aula 201' };

  // ----- A41-005 / B05: lo que se guarda vuelve igual al editar
  const multi = await req('POST', '/activities', {
    token: director.token,
    body: {
      ...base, title: `BD y Redes ${L}`, areaIds: [bd.id, redes.id], skillIds: [mongo.id, deRedes.id],
      skillContexts: [{ skillId: mongo.id, areaId: bd.id }, { skillId: deRedes.id, areaId: redes.id }],
    },
  });
  const fila = ((await req('GET', '/activities/managed', { token: director.token })).data ?? []).find((a) => a.id === multi.data?.id);
  const ctxFila = Object.fromEntries((fila?.activitySkills ?? []).map((x) => [x.skillId, x.academicAreaId]));
  check(multi.status === 201 && ctxFila[mongo.id] === bd.id && ctxFila[deRedes.id] === redes.id && (fila?.activityAreas ?? []).length === 2,
    'V41.2.1 B05 A41-005 El listado de gestión trae las habilidades con su área (de ahí se hidrata la edición)', json(fila?.activitySkills));
  const editaTitulo = await req('PATCH', `/activities/${multi.data?.id}`, { token: director.token, body: { title: `BD y Redes editada ${L}` } });
  const tras = await req('GET', `/activities/${multi.data?.id}`, { token: director.token });
  check(editaTitulo.status === 200 && (tras.data?.activitySkills ?? []).length === 2 && (tras.data?.activityAreas ?? []).length === 2,
    'V41.2.2 B05 Editar otro campo no borra áreas ni habilidades', json((tras.data?.activitySkills ?? []).map((x) => x.skillId)));

  // ----- B07: una habilidad multiárea no se agrega dos veces
  const doble = await req('POST', '/activities', {
    token: director.token, body: { ...base, title: `Doble ${L}`, areaIds: [bd.id], skillIds: [mongo.id, mongo.id] },
  });
  const dobleSkills = doble.status === 201 ? (await req('GET', `/activities/${doble.data.id}`, { token: director.token })).data?.activitySkills ?? [] : [];
  check(doble.status === 400 || dobleSkills.length === 1, 'V41.2.3 B07 La misma habilidad no queda dos veces', `status ${doble.status} · ${dobleSkills.length}`);

  // ----- V41-01 / B06 / 23.1: charla general sin habilidad concreta
  const conceptual = await req('POST', '/activities', {
    token: director.token, body: { ...base, title: `Charla de IA ${L}`, areaIds: [ia.id], skillIds: [], status: 'open' },
  });
  check(conceptual.status === 201 && conceptual.data?.status === 'open' && (conceptual.data?.activitySkills ?? []).length === 0,
    'V41.2.4 B06 V41-01 Una charla general se publica con su área y sin inventar una habilidad', `status ${conceptual.status} ${json(conceptual.data?.fields)}`);
  const sinArea = await req('POST', '/activities', {
    token: director.token, body: { ...base, title: `Sin área ${L}`, areaIds: [], skillIds: [], status: 'open' },
  });
  check(sinArea.status === 400 && !!sinArea.data?.fields?.areaIds, 'V41.2.5 Pero al menos un área sigue siendo obligatoria', `status ${sinArea.status}`);

  // ----- A41-007 / B10: Admin guarda borrador sin responsable; publicar lo exige
  const adminDraft = await req('POST', '/activities', { token: ctx.admin, body: { ...base, title: `Borrador de Admin ${L}`, status: 'draft' } });
  check(adminDraft.status === 201 && adminDraft.data?.status === 'draft' && !adminDraft.data?.responsibleUserId,
    'V41.2.6 B10 A41-007 Administración guarda un borrador sin responsable', `status ${adminDraft.status} ${json(adminDraft.data?.fields)}`);
  const publicarSin = await req('PATCH', `/activities/${adminDraft.data?.id}`, { token: ctx.admin, body: { status: 'open' } });
  check(publicarSin.status === 400 && !!publicarSin.data?.fields?.responsibleUserIds,
    'V41.2.7 A41-007 Publicarlo sin responsable se rechaza en el campo del responsable', `status ${publicarSin.status} ${json(publicarSin.data?.fields)}`);
  const conResp = await req('PATCH', `/activities/${adminDraft.data?.id}`, { token: ctx.admin, body: { responsibleUserIds: [docente.userId] } });
  const publicarCon = await req('PATCH', `/activities/${adminDraft.data?.id}`, { token: ctx.admin, body: { status: 'open' } });
  check(conResp.status === 200 && publicarCon.status === 200 && publicarCon.data?.status === 'open',
    'V41.2.8 A41-007 Con responsable se publica', `${conResp.status} / ${publicarCon.status}`);
  const adminPublicaDirecto = await req('POST', '/activities', { token: ctx.admin, body: { ...base, title: `Admin directo ${L}`, status: 'open' } });
  check(adminPublicaDirecto.status === 400, 'V41.2.9 A41-007 Crear y publicar de una vez sin responsable sigue rechazándose', `status ${adminPublicaDirecto.status}`);

  // ----- A41-006 / B08: 0, 1, 3 y 5 imágenes; 6 no; editar conserva las demás
  const img = [];
  for (let i = 0; i < 6; i++) img.push(await subirPng(director.token));
  const conImgs = async (ids, titulo) => req('POST', '/activities', { token: director.token, body: { ...base, title: `${titulo} ${L}`, imageFileIds: ids } });
  const cero = await conImgs([], 'Sin imágenes');
  const una = await conImgs([img[0]], 'Una imagen');
  const tres = await conImgs(img.slice(0, 3), 'Tres imágenes');
  const cinco = await conImgs(img.slice(0, 5), 'Cinco imágenes');
  const seis = await conImgs(img.slice(0, 6), 'Seis imágenes');
  const det = async (id) => (await req('GET', `/activities/${id}`, { token: director.token })).data;
  const d0 = await det(cero.data?.id);
  const d1 = await det(una.data?.id);
  const d3 = await det(tres.data?.id);
  const d5 = await det(cinco.data?.id);
  check(d0?.images?.length === 0 && !d0?.imageUrl, 'V41.2.10 B08 Sin imágenes: ni portada ni lista', json(d0?.images));
  check(d1?.images?.length === 1 && d1?.imageFileId === img[0] && d1?.imageUrl === d1?.images[0].url,
    'V41.2.11 B08 Una imagen: es la portada (compatibilidad con imageUrl)', json(d1?.images));
  check(d3?.images?.map((x) => x.fileId).join() === img.slice(0, 3).join() && d3?.imageFileId === img[0],
    'V41.2.12 B08 Tres imágenes en el orden elegido; la primera es la portada', json(d3?.images?.map((x) => x.fileId)));
  check(d5?.images?.length === 5, 'V41.2.13 B08 Cinco imágenes se aceptan', `${d5?.images?.length}`);
  check(seis.status === 400 && !!seis.data?.fields?.imageFileIds, 'V41.2.14 B08 Seis imágenes se rechazan en su campo', `status ${seis.status}`);

  const portadaNueva = await req('PATCH', `/activities/${tres.data?.id}`, { token: director.token, body: { imageFileIds: [img[2], img[0], img[1]] } });
  const d3b = await det(tres.data?.id);
  check(portadaNueva.status === 200 && d3b?.imageFileId === img[2] && d3b?.images?.length === 3,
    'V41.2.15 B08 Cambiar la portada reordena sin perder imágenes', json(d3b?.images?.map((x) => x.fileId)));
  const quitarUna = await req('PATCH', `/activities/${tres.data?.id}`, { token: director.token, body: { imageFileIds: [img[2], img[1]] } });
  const d3c = await det(tres.data?.id);
  check(quitarUna.status === 200 && d3c?.images?.map((x) => x.fileId).join() === [img[2], img[1]].join(),
    'V41.2.16 B08 Quitar una imagen conserva las demás', json(d3c?.images?.map((x) => x.fileId)));
  const legado = await req('PATCH', `/activities/${tres.data?.id}`, { token: director.token, body: { imageFileId: img[3] } });
  const d3d = await det(tres.data?.id);
  check(legado.status === 200 && d3d?.imageFileId === img[3] && d3d?.images?.length === 2 && d3d.images.some((x) => x.fileId === img[1]),
    'V41.2.17 B08 Un cliente antiguo (solo imageFileId) cambia la portada sin borrar el resto', json(d3d?.images?.map((x) => x.fileId)));

  const ajena = await subirPng(docente.token);
  const conAjena = await req('PATCH', `/activities/${tres.data?.id}`, { token: director.token, body: { imageFileIds: [img[3], ajena] } });
  check(conAjena.status === 400 && !!conAjena.data?.fields?.imageFileIds, 'V41.2.18 B08 No se usa como imagen un archivo de otra persona', `status ${conAjena.status}`);

  // Las imágenes de un borrador solo las ve quien la gestiona; publicada, cualquiera con sesión.
  const urlBorrador = `${API.replace(/\/api$/, '')}${d3d?.images?.[1]?.url}`;
  const verEst = await fetch(urlBorrador, { headers: { Authorization: `Bearer ${est.token}` } });
  const verDir = await fetch(urlBorrador, { headers: { Authorization: `Bearer ${director.token}` } });
  check(verEst.status === 404 && verDir.status === 200, 'V41.2.19 B08 La segunda imagen de un borrador no se sirve a un estudiante', `${verEst.status} / ${verDir.status}`);
  await req('PATCH', `/activities/${tres.data?.id}`, { token: director.token, body: { status: 'open' } });
  const verEst2 = await fetch(urlBorrador, { headers: { Authorization: `Bearer ${est.token}` } });
  check(verEst2.status === 200, 'V41.2.20 B08 Publicada, cualquiera con sesión ve todas sus imágenes', `status ${verEst2.status}`);
}

// ===========================================================================
//  BATCH V4.1-3 — Estados, revisión, propiedad, alcance y tipos (A41-008…010, 012, 013)
// ===========================================================================
async function batch3(ctx) {
  objective('BATCH V4.1-3 · Borradores privados, bandeja de Dirección, operación del responsable, fechas y duplicar');
  const mk = (n, a, rol) => provisionAndActivate(ctx.admin, { firstName: n, lastName: `${a}${L}`, email: correoStaff(`b3${n.toLowerCase()}`), role: rol });
  const director = await mk('Dora', 'Bandeja', 'CAREER_DIRECTOR');
  const docA = await mk('Carlos', 'Alcance', 'TEACHER');
  const docB = await mk('Berta', 'Alcance', 'TEACHER');
  await req('PUT', `/users/${docA.userId}/semesters`, { token: ctx.admin, body: { semesters: [1, 2, 3, 4] } });
  await req('PUT', `/users/${docB.userId}/semesters`, { token: ctx.admin, body: { semesters: [5, 6] } });
  const est = await provisionAndActivate(ctx.admin, { firstName: 'Eva', lastName: `Cupo${L}`, email: `v41.b3est.${TS}@est.univalle.edu`, role: 'STUDENT', semester: 3 });
  await req('POST', '/profiles/me', { token: est.token, body: {} });
  const cats = (await req('GET', '/activity-categories', { token: director.token })).data ?? [];
  const taller = cats.find((c) => c.code === 'taller_academico') ?? cats[0];
  const base = { type: 'academica', categoryId: taller.id, semesterScope: [3], activityDate: en(72), endAt: en(74), modality: 'presencial', location: 'Aula 201' };
  const ids = (r) => (r.data ?? []).map((a) => a.id);

  // ----- 23.3 / B10 / B11: borrador de Admin con un docente responsable
  const draftAdmin = await req('POST', '/activities', { token: ctx.admin, body: { ...base, title: `Admin con docente ${L}`, responsibleUserIds: [docA.userId] } });
  const docVe = await req('GET', '/activities/managed', { token: docA.token });
  const docDet = await req('GET', `/activities/${draftAdmin.data?.id}`, { token: docA.token });
  const docPublica = await req('PATCH', `/activities/${draftAdmin.data?.id}`, { token: docA.token, body: { status: 'open' } });
  check(draftAdmin.status === 201 && !ids(docVe).includes(draftAdmin.data?.id) && docDet.status === 404
      && [403, 404].includes(docPublica.status),
  'V41.3.1 23.3 A41-008 El docente asignado no ve ni puede publicar el borrador de Administración', `${docDet.status} / ${docPublica.status}`);
  const publicada = await req('PATCH', `/activities/${draftAdmin.data?.id}`, { token: ctx.admin, body: { status: 'open' } });
  const docVe2 = await req('GET', '/activities/managed', { token: docA.token });
  check(publicada.status === 200 && ids(docVe2).includes(draftAdmin.data?.id),
    'V41.3.2 B11 Publicada, el docente responsable la recibe en su gestión', `status ${publicada.status}`);
  const docTitulo = await req('PATCH', `/activities/${draftAdmin.data?.id}`, { token: docA.token, body: { title: `Cambiada ${L}` } });
  check(docTitulo.status === 403 && docTitulo.data?.code === 'ACTIVITY_RESPONSIBLE_OPERATION_ONLY',
    'V41.3.3 B11 A41-009 El responsable asignado no cambia el contenido material', `status ${docTitulo.status} ${docTitulo.data?.code}`);
  const docCierra = await req('PATCH', `/activities/${draftAdmin.data?.id}`, { token: docA.token, body: { status: 'closed' } });
  const docReabre = await req('PATCH', `/activities/${draftAdmin.data?.id}`, { token: docA.token, body: { status: 'open' } });
  check(docCierra.status === 200 && docReabre.status === 200, 'V41.3.4 B11 Pero sí opera: cierra y reabre inscripciones', `${docCierra.status} / ${docReabre.status}`);
  const docCancela = await req('PATCH', `/activities/${draftAdmin.data?.id}`, { token: docA.token, body: { status: 'cancelled', cancellationReason: 'Se suspende por un cambio de sala.' } });
  const docEnvia = await req('POST', `/activities/${draftAdmin.data?.id}/submit`, { token: docA.token, body: {} });
  check(docCancela.status === 403 && docEnvia.status >= 400,
    'V41.3.5 B11 No la cancela ni la reenvía a revisión (la creó una autoridad)', `${docCancela.status} / ${docEnvia.status}`);

  // ----- 23.4 / B12: propuesta del docente y bandeja de Dirección
  const propuesta = await req('POST', '/activities', { token: docA.token, body: { ...base, title: `Propuesta docente ${L}` } });
  const dirGestion = await req('GET', '/activities/managed', { token: director.token });
  const dirPend = await req('GET', '/activities/reviews/pending', { token: director.token });
  const dirDet = await req('GET', `/activities/${propuesta.data?.id}`, { token: director.token });
  check(!ids(dirGestion).includes(propuesta.data?.id) && !ids(dirPend).includes(propuesta.data?.id) && dirDet.status === 404,
    'V41.3.6 B12 El borrador del docente no lo ve Dirección (ni gestión, ni bandeja, ni por URL)', `detalle ${dirDet.status}`);
  await req('POST', `/activities/${propuesta.data?.id}/submit`, { token: docA.token, body: {} });
  const dirGestion2 = await req('GET', '/activities/managed', { token: director.token });
  const dirPend2 = await req('GET', '/activities/reviews/pending', { token: director.token });
  const dirDet2 = await req('GET', `/activities/${propuesta.data?.id}`, { token: director.token });
  check(ids(dirPend2).includes(propuesta.data?.id) && !ids(dirGestion2).includes(propuesta.data?.id) && dirDet2.status === 200,
    'V41.3.7 B12 A41-008 Enviada, está en la bandeja de Dirección y no en su gestión («no es suya»)', `pend ${ids(dirPend2).includes(propuesta.data?.id)} · gestión ${ids(dirGestion2).includes(propuesta.data?.id)}`);
  await req('POST', `/activities/${propuesta.data?.id}/review`, { token: director.token, body: { decision: 'approve' } });
  const dirGestion3 = await req('GET', '/activities/managed', { token: director.token });
  const tras = await req('GET', `/activities/${propuesta.data?.id}`, { token: director.token });
  const creadorEdita = await req('PATCH', `/activities/${propuesta.data?.id}`, { token: docA.token, body: { title: `Otro título ${L}` } });
  check(ids(dirGestion3).includes(propuesta.data?.id) && tras.data?.creatorId === docA.userId && creadorEdita.status === 409,
    'V41.3.8 23.4 Aprobada: Dirección la gestiona, el autor sigue siendo el docente y él ya no edita el contenido', `creator=${tras.data?.creatorId === docA.userId} · edita ${creadorEdita.status}`);

  // ----- B13: semestres cubiertos por la unión de alcances de los docentes responsables
  const candidatos = await req('GET', `/activities/people?kind=responsible&type=academica&q=${encodeURIComponent(`Alcance${L}`)}`, { token: director.token });
  const cA = (candidatos.data ?? []).find((p) => p.id === docA.userId);
  check(JSON.stringify(cA?.semesters) === JSON.stringify([1, 2, 3, 4]), 'V41.3.9 B13 Los candidatos docentes traen sus semestres', json(cA));
  const cubre = await req('POST', '/activities', { token: director.token, body: { ...base, title: `Cubre ${L}`, semesterScope: [3, 5], responsibleUserIds: [docA.userId, docB.userId], status: 'open' } });
  check(cubre.status === 201, 'V41.3.10 B13 Semestres 3.º y 5.º con docentes que los cubren: se publica', `status ${cubre.status} ${json(cubre.data?.fields)}`);
  const noCubre = await req('POST', '/activities', { token: director.token, body: { ...base, title: `No cubre ${L}`, semesterScope: [3, 7], responsibleUserIds: [docA.userId, docB.userId], status: 'open' } });
  check(noCubre.status === 400 && noCubre.data?.code === 'ACTIVITY_SCOPE_NOT_COVERED' && /7\.º/.test(JSON.stringify(noCubre.data?.fields?.semesterScope)),
    'V41.3.11 B13 Un semestre que ningún docente cubre (7.º) se rechaza nombrándolo', json(noCubre.data?.fields));
  const toda = await req('POST', '/activities', { token: director.token, body: { ...base, title: `Toda la carrera ${L}`, semesterScope: [], responsibleUserIds: [docA.userId], status: 'open' } });
  check(toda.status === 400 && !!toda.data?.fields?.semesterScope, 'V41.3.12 B13 «Toda la carrera» con un docente que no la cubre se rechaza', `status ${toda.status}`);
  const conDir = await req('POST', '/activities', { token: director.token, body: { ...base, title: `Con Dirección ${L}`, semesterScope: [], responsibleUserIds: [docA.userId, director.userId], status: 'open' } });
  check(conDir.status === 201, 'V41.3.13 B13 Con Dirección entre los responsables, toda la carrera es válida', `status ${conDir.status} ${json(conDir.data?.fields)}`);
  const borradorNoCubre = await req('POST', '/activities', { token: director.token, body: { ...base, title: `Borrador no cubre ${L}`, semesterScope: [8], responsibleUserIds: [docA.userId] } });
  check(borradorNoCubre.status === 201, 'V41.3.14 B13 Como borrador se guarda; se valida al publicar', `status ${borradorNoCubre.status}`);

  // ----- 23.5 / A41-010: inicio en el pasado
  const ayer = await req('POST', '/activities', { token: director.token, body: { ...base, title: `Ayer ${L}`, activityDate: en(-24), endAt: en(-22), status: 'open' } });
  check(ayer.status === 400 && ayer.data?.code === 'ACTIVITY_START_IN_PAST' && !!ayer.data?.fields?.activityDate,
    'V41.3.15 23.5 Publicar una actividad nueva con inicio ayer se rechaza en el campo de fecha', `status ${ayer.status}`);
  const borradorAyer = await req('POST', '/activities', { token: director.token, body: { ...base, title: `Borrador ayer ${L}`, activityDate: en(-24), endAt: en(-22) } });
  const publicarAyer = await req('PATCH', `/activities/${borradorAyer.data?.id}`, { token: director.token, body: { status: 'open' } });
  check(borradorAyer.status === 201 && publicarAyer.status === 400 && publicarAyer.data?.code === 'ACTIVITY_START_IN_PAST',
    'V41.3.16 23.5 El borrador con fecha pasada se guarda, pero no se publica sin corregirla', `${borradorAyer.status} / ${publicarAyer.status}`);
  const sinFecha = await req('POST', '/activities', { token: director.token, body: { title: `Sin fecha ${L}`, type: 'academica', categoryId: taller.id, __sinCompletar: true } });
  check(sinFecha.status === 201, 'V41.3.17 23.5 Un borrador sin fecha se guarda', `status ${sinFecha.status}`);

  // ----- B14 / B15: reabrir un CLOSED dice la causa
  const empezo = await req('POST', '/activities', { token: director.token, body: { ...base, title: `Empezó ${L}`, status: 'open' } });
  await req('PATCH', `/activities/${empezo.data?.id}`, { token: director.token, body: { activityDate: en(-2), endAt: en(5) } });
  await req('PATCH', `/activities/${empezo.data?.id}`, { token: director.token, body: { status: 'closed' } });
  const reabreEmpezo = await req('PATCH', `/activities/${empezo.data?.id}`, { token: director.token, body: { status: 'open' } });
  check(reabreEmpezo.status === 400 && reabreEmpezo.data?.code === 'ACTIVITY_REOPEN_STARTED',
    'V41.3.18 B14 Reabrir una actividad que ya empezó se niega y pide corregir la fecha', `status ${reabreEmpezo.status} ${reabreEmpezo.data?.code}`);
  const lleno = await req('POST', '/activities', { token: director.token, body: { ...base, title: `Cupo lleno ${L}`, capacity: 1, status: 'open' } });
  await req('POST', `/activities/${lleno.data?.id}/register`, { token: est.token });
  // El cupo lo ocupa la participación confirmada o aceptada (OCCUPYING_STATUSES).
  const perfilEst = (await req('GET', '/profiles/me', { token: est.token })).data;
  await req('PATCH', `/activities/${lleno.data?.id}/confirm-participation`, { token: director.token, body: { studentProfileId: perfilEst?.id, status: 'confirmed' } });
  await req('PATCH', `/activities/${lleno.data?.id}`, { token: director.token, body: { status: 'closed' } });
  const reabreLleno = await req('PATCH', `/activities/${lleno.data?.id}`, { token: director.token, body: { status: 'open' } });
  check(reabreLleno.status === 400 && reabreLleno.data?.code === 'ACTIVITY_REOPEN_FULL',
    'V41.3.19 B15 Reabrir con el cupo completo se niega y pide ampliarlo', `status ${reabreLleno.status} ${reabreLleno.data?.code}`);
  await req('PATCH', `/activities/${lleno.data?.id}`, { token: director.token, body: { capacity: 5 } });
  const reabreAmpliado = await req('PATCH', `/activities/${lleno.data?.id}`, { token: director.token, body: { status: 'open' } });
  check(reabreAmpliado.status === 200, 'V41.3.20 B15 Ampliado el cupo, se reabre', `status ${reabreAmpliado.status}`);

  // ----- B16: duplicar una FINISHED
  await req('PATCH', `/activities/${lleno.data?.id}`, { token: director.token, body: { status: 'finished' } });
  const dup = await req('POST', `/activities/${lleno.data?.id}/duplicate`, { token: director.token });
  const partDup = await req('GET', `/activities/${dup.data?.id}/participants`, { token: director.token });
  const filasDup = Array.isArray(partDup.data) ? partDup.data : partDup.data?.items ?? [];
  const original = await req('GET', `/activities/${lleno.data?.id}`, { token: director.token });
  check(dup.status === 201 && dup.data?.id !== lleno.data?.id && dup.data?.status === 'draft' && !dup.data?.eventDate
      && /\(copia\)$/.test(dup.data?.title ?? '') && filasDup.length === 0 && original.data?.status === 'finished',
  'V41.3.21 B16 Duplicar una finalizada crea un borrador nuevo sin fechas ni participantes; la original no cambia',
  json({ s: dup.status, st: dup.data?.status, f: dup.data?.eventDate, p: filasDup.length }));
  check((dup.data?.activityAreas ?? []).length === (original.data?.activityAreas ?? []).length,
    'V41.3.22 B16 La copia conserva áreas y habilidades', `${(dup.data?.activityAreas ?? []).length}`);
}

// ===========================================================================
//  BATCH V4.1-4 — Asistencia y derivados (A41-011, §5)
// ===========================================================================
async function batch4(ctx) {
  objective('BATCH V4.1-4 · Regularización tras FINISHED, Cerrar asistencia y corrección excepcional con reconciliación');
  const director = await provisionAndActivate(ctx.admin, { firstName: 'Dalia', lastName: `Acta${L}`, email: correoStaff('b4dir'), role: 'CAREER_DIRECTOR' });
  const docente = await provisionAndActivate(ctx.admin, { firstName: 'Ciro', lastName: `Acta${L}`, email: correoStaff('b4doc'), role: 'TEACHER' });
  await req('PUT', `/users/${docente.userId}/semesters`, { token: ctx.admin, body: { semesters: [3] } });
  const alumno = async (k) => {
    const e = await provisionAndActivate(ctx.admin, { firstName: 'Alu', lastName: `${k}${L}`, email: `v41.b4${k.toLowerCase()}.${TS}@est.univalle.edu`, role: 'STUDENT', semester: 3 });
    await req('POST', '/profiles/me', { token: e.token, body: {} });
    e.profileId = (await req('GET', '/profiles/me', { token: e.token })).data?.id;
    return e;
  };
  const [a1, a2, a3, a4] = [await alumno('Uno'), await alumno('Dos'), await alumno('Tres'), await alumno('Cuatro')];
  const cats = (await req('GET', '/activity-categories', { token: director.token })).data ?? [];
  const taller = cats.find((c) => c.code === 'taller_academico') ?? cats[0];
  const base = { type: 'academica', categoryId: taller.id, semesterScope: [3], activityDate: en(72), endAt: en(74), modality: 'presencial', location: 'Aula 201' };
  const confirmar = (id, quien, perfil, status) => req('PATCH', `/activities/${id}/confirm-participation`, { token: quien.token, body: { studentProfileId: perfil, status } });

  const ev = await req('POST', '/activities', {
    token: director.token, body: { ...base, title: `Charla con acta ${L}`, status: 'open', responsibleUserIds: [docente.userId], outcomePolicy: 'internal_constancy' },
  });
  for (const e of [a1, a2, a3, a4]) await req('POST', `/activities/${ev.data?.id}/register`, { token: e.token });

  // Antes de terminar: sin constancia, un error se corrige; con constancia, ya no.
  const sinConst = await req('POST', '/activities', { token: director.token, body: { ...base, title: `Sin constancia ${L}`, status: 'open', responsibleUserIds: [docente.userId] } });
  await req('POST', `/activities/${sinConst.data?.id}/register`, { token: a4.token });
  await confirmar(sinConst.data?.id, docente, a4.profileId, 'confirmed');
  const deshace = await confirmar(sinConst.data?.id, docente, a4.profileId, 'absent');
  check(deshace.status === 200, 'V41.4.1 Durante el evento y sin constancia, el responsable corrige un error propio', `status ${deshace.status}`);
  const c1 = await confirmar(ev.data?.id, docente, a1.profileId, 'confirmed');
  const conConstancia = await confirmar(ev.data?.id, docente, a1.profileId, 'absent');
  check(c1.status === 200 && conConstancia.status === 409 && conConstancia.data?.code === 'PARTICIPATION_CONSOLIDATED',
    'V41.4.2 B18 Con constancia emitida, el responsable no la retira libremente', `${c1.status} / ${conConstancia.status} ${conConstancia.data?.code}`);

  // B17: terminado el evento, todavía se registran pendientes.
  const antesDeTerminar = await req('POST', `/activities/${ev.data?.id}/attendance/close`, { token: docente.token });
  check(antesDeTerminar.status === 409 && antesDeTerminar.data?.code === 'ATTENDANCE_NOT_FINISHED',
    'V41.4.3 B19 La asistencia no se cierra antes de que termine la actividad', `status ${antesDeTerminar.status}`);
  const fin = await req('PATCH', `/activities/${ev.data?.id}`, { token: director.token, body: { status: 'finished' } });
  const c2 = await confirmar(ev.data?.id, docente, a2.profileId, 'confirmed');
  check(fin.status === 200 && c2.status === 200 && c2.data?.status === 'confirmed',
    'V41.4.4 B17 23.5 Terminada la actividad, el responsable registra una participación pendiente', `${fin.status} / ${c2.status}`);
  const b18 = await confirmar(ev.data?.id, docente, a2.profileId, 'absent');
  check(b18.status === 409 && b18.data?.code === 'PARTICIPATION_CONSOLIDATED',
    'V41.4.5 B18 23.5 Tras FINISHED, un CONFIRMED no pasa libremente a ausente', `status ${b18.status} ${b18.data?.code}`);

  // B19: cerrar asistencia congela el registro ordinario.
  const adminCierra = await req('POST', `/activities/${ev.data?.id}/attendance/close`, { token: ctx.admin });
  const cierre = await req('POST', `/activities/${ev.data?.id}/attendance/close`, { token: docente.token });
  check(adminCierra.status === 403 && cierre.status === 200 && cierre.data?.attendanceStatus === 'locked' && !!cierre.data?.attendanceClosedAt,
    'V41.4.6 B19 El responsable cierra la asistencia (Administración no: es operación del responsable)', `${adminCierra.status} / ${cierre.status} ${cierre.data?.attendanceStatus}`);
  const tarde = await confirmar(ev.data?.id, docente, a3.profileId, 'confirmed');
  check(tarde.status === 409 && tarde.data?.code === 'ATTENDANCE_LOCKED', 'V41.4.7 B19 Con el acta cerrada ya no se registra asistencia ordinaria', `status ${tarde.status}`);
  const part = await req('GET', `/activities/${ev.data?.id}/participants`, { token: docente.token });
  const filas = Array.isArray(part.data) ? part.data : part.data?.items ?? [];
  check(filas.filter((r) => r.status === 'confirmed').length === 2, 'V41.4.8 B19 El historial se preserva tras cerrar', json(filas.map((r) => r.status)));

  // Corrección excepcional de Dirección: motivo, reconciliación de constancia y puntos.
  const g0 = await req('GET', '/gamification/me', { token: a1.token });
  const conPuntos = (g0.data?.events ?? []).some((e) => e.trigger === 'participacion_confirmada' && e.points > 0);
  const docCorrige = await req('POST', `/activities/${ev.data?.id}/participation-correction`, {
    token: docente.token, body: { studentProfileId: a1.profileId, status: 'absent', reason: 'No asistió según la lista firmada.' },
  });
  const corto = await req('POST', `/activities/${ev.data?.id}/participation-correction`, {
    token: director.token, body: { studentProfileId: a1.profileId, status: 'absent', reason: 'error' },
  });
  check(docCorrige.status === 403 && corto.status === 400,
    'V41.4.9 B18 La corrección excepcional es de Dirección o Administración y exige un motivo', `${docCorrige.status} / ${corto.status}`);
  const corrige = await req('POST', `/activities/${ev.data?.id}/participation-correction`, {
    token: director.token, body: { studentProfileId: a1.profileId, status: 'absent', reason: 'La lista firmada muestra que no asistió.' },
  });
  check(corrige.status === 200 && corrige.data?.status === 'absent',
    'V41.4.10 B18 Dirección corrige aunque el acta esté cerrada', `status ${corrige.status}`);
  const constancias = (await req('GET', '/constancies/internal/my', { token: a1.token })).data ?? [];
  check(!constancias.some((c) => c.activityId === ev.data?.id && c.status === 'authorized'),
    'V41.4.11 La constancia de esa participación deja de estar vigente', json(constancias.map((c) => [c.activityId === ev.data?.id, c.status])));
  const g1 = await req('GET', '/gamification/me', { token: a1.token });
  const reverso = (g1.data?.events ?? []).find((e) => e.points < 0 && /Reverso por corrección/.test(e.reason));
  check(!conPuntos || (!!reverso && g1.data?.totalPoints === g0.data?.totalPoints + reverso.points),
    'V41.4.12 Los puntos se revierten con un movimiento auditable (no se borran)', json({ antes: g0.data?.totalPoints, despues: g1.data?.totalPoints, reverso: reverso?.points, conPuntos }));
  const aud = await req('GET', `/audit/events?eventType=PARTICIPATION_CORRECTED&limit=20`, { token: ctx.admin });
  const evAud = (aud.data ?? []).find((e) => e.entityId === corrige.data?.id);
  check(evAud?.metadata?.motivo?.includes('lista firmada') && evAud?.metadata?.de === 'confirmed' && evAud?.metadata?.a === 'absent',
    'V41.4.13 La corrección queda en la auditoría con antes, después y motivo', json(evAud?.metadata));
  const vuelve = await req('POST', `/activities/${ev.data?.id}/participation-correction`, {
    token: director.token, body: { studentProfileId: a1.profileId, status: 'confirmed', reason: 'Se encontró su firma en la segunda hoja.' },
  });
  const g2 = await req('GET', '/gamification/me', { token: a1.token });
  check(vuelve.status === 200 && (!conPuntos || g2.data?.totalPoints === g0.data?.totalPoints),
    'V41.4.14 Volver a confirmar restituye los puntos una sola vez', json({ antes: g0.data?.totalPoints, final: g2.data?.totalPoints }));

  // Cancelada: no se otorga asistencia.
  const cancelada = await req('POST', '/activities', { token: director.token, body: { ...base, title: `Cancelada ${L}`, status: 'open', responsibleUserIds: [docente.userId] } });
  await req('POST', `/activities/${cancelada.data?.id}/register`, { token: a3.token });
  await req('PATCH', `/activities/${cancelada.data?.id}`, { token: director.token, body: { status: 'cancelled', cancellationReason: 'Se suspende por un corte de energía.' } });
  const enCancelada = await confirmar(cancelada.data?.id, docente, a3.profileId, 'confirmed');
  check(enCancelada.status === 409 && enCancelada.data?.code === 'ACTIVITY_CANCELLED', 'V41.4.15 En una actividad cancelada no se registra asistencia', `status ${enCancelada.status}`);
  const autoconfirma = await req('PATCH', `/activities/${ev.data?.id}/confirm-participation`, { token: a3.token, body: { studentProfileId: a3.profileId, status: 'confirmed' } });
  check(autoconfirma.status === 403, 'V41.4.16 Un estudiante nunca confirma su propia asistencia', `status ${autoconfirma.status}`);
}

// ===========================================================================
//  BATCH V4.1-5 — Recursos y Biblioteca (A41-014, §7)
// ===========================================================================
async function batch5(ctx) {
  objective('BATCH V4.1-5 · Validación de recursos, propuesta del docente con revisión de Dirección y «Para ti»');
  const director = await provisionAndActivate(ctx.admin, { firstName: 'Dina', lastName: `Recurso${L}`, email: correoStaff('b5dir'), role: 'CAREER_DIRECTOR' });
  const docente = await provisionAndActivate(ctx.admin, { firstName: 'Cata', lastName: `Recurso${L}`, email: correoStaff('b5doc'), role: 'TEACHER' });
  const otroDoc = await provisionAndActivate(ctx.admin, { firstName: 'Otto', lastName: `Recurso${L}`, email: correoStaff('b5doc2'), role: 'TEACHER' });
  await req('PUT', `/users/${docente.userId}/semesters`, { token: ctx.admin, body: { semesters: [3] } });
  const est = async (k, sem) => {
    const e = await provisionAndActivate(ctx.admin, { firstName: 'Ana', lastName: `${k}${L}`, email: `v41.b5${k.toLowerCase()}.${TS}@est.univalle.edu`, role: 'STUDENT', semester: sem });
    await req('POST', '/profiles/me', { token: e.token, body: {} });
    return e;
  };
  const e3 = await est('Tres', 3);
  const e5 = await est('Cinco', 5);
  const areas = (await req('GET', '/academic-areas', { token: ctx.admin })).data ?? [];
  const skills = (await req('GET', '/skills', { token: ctx.admin })).data ?? [];
  const bd = areas.find((a) => a.code === 'bases_de_datos');
  const redes = areas.find((a) => /redes/i.test(a.code));
  const web = areas.find((a) => a.code === 'desarrollo_web');
  const pg = skills.find((x) => x.code === 'postgresql');
  const base = (k) => ({ title: `Guía ${k} ${L}`, provider: 'Documentación oficial', url: `https://docs.example.org/v41b5/${TS}/${k}`, resourceType: 'documentation', academicAreaId: bd.id });
  const enBiblioteca = async (token, titulo) => ((await req('GET', `/library?q=${encodeURIComponent(titulo)}`, { token })).data?.items ?? []).some((r) => r.title === titulo);

  // ----- B20: contenido significativo en crear y editar
  const malo = await req('POST', '/learning-resources', { token: director.token, body: { ...base('mala'), title: '123456', provider: '!!!!', url: 'no-es-url' } });
  const campos = Object.keys(malo.data?.fields ?? {});
  check(malo.status === 400 && ['title', 'provider', 'url'].every((c) => campos.includes(c)),
    'V41.5.1 B20 A41-014 «123456» como título, «!!!!» como quién publica y una URL inválida se rechazan, cada uno en su campo', json(malo.data?.fields));
  const valido = await req('POST', '/learning-resources', { token: director.token, body: base('valida') });
  const editaMal = await req('PATCH', `/learning-resources/${valido.data?.id}`, { token: director.token, body: { title: '9999' } });
  check(valido.status === 201 && editaMal.status === 400 && !!editaMal.data?.fields?.title,
    'V41.5.2 B20 La misma regla al editar', `${valido.status} / ${editaMal.status}`);
  const dup = await req('POST', '/learning-resources', { token: director.token, body: { ...base('dup'), url: base('valida').url } });
  check(dup.status === 409, 'V41.5.3 B21 Una URL que ya está en el catálogo se sigue rechazando', `status ${dup.status}`);

  // ----- Propuesta del docente y revisión de Dirección
  const fuera = await req('POST', '/learning-resources', { token: docente.token, body: { ...base('fuera'), semesterScope: [7] } });
  check(fuera.status === 400 && !!fuera.data?.fields?.semesterScope, 'V41.5.4 El docente solo propone para sus semestres', `status ${fuera.status}`);
  const propuesta = await req('POST', '/learning-resources', { token: docente.token, body: { ...base('propuesta'), semesterScope: [3] } });
  check(propuesta.status === 201 && propuesta.data?.reviewStatus === 'pending' && json(propuesta.data?.semesterScope) === json([3]),
    'V41.5.5 A41-014 El docente propone un recurso y queda pendiente de Dirección', json({ s: propuesta.status, r: propuesta.data?.reviewStatus }));
  check(!(await enBiblioteca(e3.token, base('propuesta').title)), 'V41.5.6 Pendiente, no aparece en la Biblioteca');
  const ajeno = await req('PATCH', `/learning-resources/${propuesta.data?.id}`, { token: otroDoc.token, body: { description: 'Cambio ajeno.' } });
  check(ajeno.status === 404, 'V41.5.7 Otro docente no edita la propuesta ajena', `status ${ajeno.status}`);
  const pendientes = await req('GET', '/learning-resources/reviews/pending', { token: director.token });
  const docVePend = await req('GET', '/learning-resources/reviews/pending', { token: docente.token });
  check((pendientes.data ?? []).some((r) => r.id === propuesta.data?.id) && docVePend.status === 403,
    'V41.5.8 §9.4 Está en la bandeja de Dirección (y el docente no ve la bandeja)', `${docVePend.status}`);
  const observarSin = await req('POST', `/learning-resources/${propuesta.data?.id}/review`, { token: director.token, body: { decision: 'observe' } });
  check(observarSin.status === 400 && !!observarSin.data?.fields?.comment, 'V41.5.9 Observar exige explicar qué corregir', `status ${observarSin.status}`);
  await req('POST', `/learning-resources/${propuesta.data?.id}/review`, { token: director.token, body: { decision: 'observe', comment: 'Agrega una descripción para estudiantes.' } });
  const corrige = await req('PATCH', `/learning-resources/${propuesta.data?.id}`, { token: docente.token, body: { description: 'Guía práctica de consultas.' } });
  check(corrige.status === 200 && corrige.data?.reviewStatus === 'pending', 'V41.5.10 Corregida, vuelve a la bandeja', json(corrige.data?.reviewStatus));
  const aprueba = await req('POST', `/learning-resources/${propuesta.data?.id}/review`, { token: director.token, body: { decision: 'approve' } });
  check(aprueba.status === 200 && aprueba.data?.reviewStatus === 'approved', 'V41.5.11 Dirección la aprueba', `status ${aprueba.status}`);
  check(await enBiblioteca(e3.token, base('propuesta').title) && !(await enBiblioteca(e5.token, base('propuesta').title)),
    'V41.5.12 Aprobada, la ve el estudiante de su semestre (3.º) y no el de otro (5.º)');
  const editaAprobada = await req('PATCH', `/learning-resources/${propuesta.data?.id}`, { token: docente.token, body: { description: 'Otro cambio.' } });
  check(editaAprobada.status === 409, 'V41.5.13 Aprobada, el docente ya no la cambia: los ajustes los hace Dirección', `status ${editaAprobada.status}`);
  const docRetira = await req('PATCH', `/learning-resources/${valido.data?.id}`, { token: docente.token, body: { status: 'inactive' } });
  check(docRetira.status === 404 || docRetira.status === 403, 'V41.5.14 El docente no retira recursos del catálogo', `status ${docRetira.status}`);

  // ----- B23: «Para ti» por intereses y metas declaradas
  const enRedes = await req('POST', '/learning-resources', { token: director.token, body: { ...base('redes'), academicAreaId: redes.id } });
  const enWeb = await req('POST', '/learning-resources', { token: director.token, body: { ...base('web'), academicAreaId: web.id } });
  const conPg = await req('POST', '/learning-resources', { token: director.token, body: { ...base('postgres'), academicAreaId: web.id, skillIds: [pg.id] } });
  await req('PUT', '/profiles/me/interests', { token: e5.token, body: { items: [{ academicAreaId: redes.id, priority: 1 }] } });
  await req('PATCH', '/profiles/me', { token: e5.token, body: { improvementAreaIds: [bd.id] } });
  await req('PUT', '/profiles/me/skill-interests', { token: e5.token, body: { items: [{ skillId: pg.id, kind: 'improve' }] } });
  const paraTi = await req('GET', `/library?forMe=true&limit=48&q=${encodeURIComponent(L)}`, { token: e5.token });
  const item = (id) => (paraTi.data?.items ?? []).find((r) => r.id === id);
  check(!!item(enRedes.data?.id) && item(enRedes.data?.id)?.reasons?.some((m) => /intereses: .*Redes/i.test(m)),
    'V41.5.15 B23 «Para ti» trae un recurso del área que le interesa, con el motivo', json(item(enRedes.data?.id)?.reasons));
  check(item(conPg.data?.id)?.reasons?.some((m) => /quieres mejorar: PostgreSQL/.test(m)),
    'V41.5.16 B23 Y uno de una tecnología que quiere mejorar, diciéndolo así', json(item(conPg.data?.id)?.reasons));
  check(!item(enWeb.data?.id), 'V41.5.17 B23 Un recurso sin relación con lo declarado no aparece en «Para ti»', json(paraTi.data?.items?.map((r) => r.title)));
  await req('PUT', `/library/${enWeb.data?.id}/favorite`, { token: e5.token });
  const paraTi2 = await req('GET', `/library?forMe=true&limit=48&q=${encodeURIComponent(L)}`, { token: e5.token });
  check(!(paraTi2.data?.items ?? []).some((r) => r.id === enWeb.data?.id),
    'V41.5.18 B22 Guardar un recurso como favorito no lo vuelve «para ti» (no es señal del recomendador)');
}

// ===========================================================================
//  BATCH V4.1-6 — Recomendaciones y preferencias declarativas (A41-015, §8, A.9)
// ===========================================================================
async function batch6(ctx) {
  objective('BATCH V4.1-6 · «Me interesa» como señal explícita y reversible; Guardar y favoritos sin efecto; motivos claros');
  const director = await provisionAndActivate(ctx.admin, { firstName: 'Delfina', lastName: `Recom${L}`, email: correoStaff('b6dir'), role: 'CAREER_DIRECTOR' });
  const est = await provisionAndActivate(ctx.admin, { firstName: 'Iris', lastName: `Recom${L}`, email: `v41.b6est.${TS}@est.univalle.edu`, role: 'STUDENT', semester: 3 });
  await req('POST', '/profiles/me', { token: est.token, body: {} });
  const areas = (await req('GET', '/academic-areas', { token: ctx.admin })).data ?? [];
  const cats = (await req('GET', '/activity-categories', { token: director.token })).data ?? [];
  const taller = cats.find((c) => c.code === 'taller_academico') ?? cats[0];
  const area = async (n, tag) => (await req('POST', '/academic-areas', { token: ctx.admin, body: { name: `${n} ${L}`, tags: [`${tag}${L}`] } })).data;
  const aInteres = await area('Fotonica Aplicada', 'fotonica');
  const aMejora = await area('Acustica Digital', 'acustica');
  const crear = async (titulo, a, extra = {}) => (await req('POST', '/activities', {
    token: director.token,
    body: { title: `${titulo} ${L}`, type: 'academica', categoryId: taller.id, areaIds: [a.id], skillIds: [], semesterScope: [3], status: 'open', ...extra },
  })).data;
  const t1 = await crear('Taller de fotonica I', aInteres);
  const t2 = await crear('Taller de fotonica II', aInteres);
  const m1 = await crear('Laboratorio de acustica', aMejora);
  await req('PUT', '/profiles/me/interests', { token: est.token, body: { items: [{ academicAreaId: aInteres.id, priority: 1 }] } });
  await req('PATCH', '/profiles/me', { token: est.token, body: { improvementAreaIds: [aMejora.id] } });
  const leer = async () => ((await req('GET', '/recommendations/me', { token: est.token })).data?.groups ?? []).flatMap((g) => g.items);
  const de = (lista, id) => lista.find((i) => i.targetId === id);
  const pts = (i, code) => (i?.reasons ?? []).filter((r) => r.code === code).reduce((a, r) => a + r.points, 0);

  let lista = await leer();
  const r1 = de(lista, t2.id);
  const rm = de(lista, m1.id);
  check((r1?.reasons ?? []).some((r) => /^Coincide con tus intereses: /.test(r.label))
      && (rm?.reasons ?? []).some((r) => /^Coincide con lo que quieres mejorar: /.test(r.label)),
  'V41.6.1 B25 A41-015 Los motivos distinguen «Coincide con tus intereses» y «Coincide con lo que quieres mejorar»', json([r1?.reasons, rm?.reasons]));
  const base = Number(r1?.score ?? 0);

  // B24: «Me interesa» suma una sola vez, se puede quitar y no cambia lo declarado.
  const interesesAntes = JSON.stringify((await req('GET', '/profiles/me', { token: est.token })).data?.improvementAreaIds ?? []);
  await req('POST', `/activities/${t1.id}/register-interest`, { token: est.token });
  await req('POST', `/activities/${t1.id}/register-interest`, { token: est.token });
  lista = await leer();
  const r2 = de(lista, t2.id);
  check(pts(r2, 'activity_interested') === 5 && Math.abs(Number(r2?.score) - base - 5) < 0.001,
    'V41.6.2 B24 «Me interesa» en otra actividad del área suma el 5 %, una sola vez aunque se repita', json(r2?.reasons));
  check(!pts(de(lista, t1.id), 'activity_interested'), 'V41.6.3 La actividad marcada no se recomienda a sí misma por esa señal', json(de(lista, t1.id)?.reasons));
  await req('POST', `/activities/${t1.id}/cancel-registration`, { token: est.token });
  lista = await leer();
  check(!pts(de(lista, t2.id), 'activity_interested') && Math.abs(Number(de(lista, t2.id)?.score) - base) < 0.001,
    'V41.6.4 B24 Quitar «Me interesa» quita la señal (reversible)', json(de(lista, t2.id)?.reasons));
  const interesesDespues = JSON.stringify((await req('GET', '/profiles/me', { token: est.token })).data?.improvementAreaIds ?? []);
  check(interesesAntes === interesesDespues, 'V41.6.5 B24 «Me interesa» no reescribe lo declarado en el perfil');

  // Guardar una recomendación no modifica el modelo.
  await req('PATCH', `/recommendations/me/${de(lista, t1.id)?.id}`, { token: est.token, body: { status: 'saved' } });
  lista = await leer();
  check(Math.abs(Number(de(lista, t2.id)?.score) - base) < 0.001 && !pts(de(lista, t2.id), 'similar_saved'),
    'V41.6.6 A.9 «Guardar» una recomendación no cambia el puntaje de lo parecido', json(de(lista, t2.id)?.reasons));

  // Pesos publicados y sin «100 %» por una sola coincidencia.
  const reglas = await req('GET', '/recommendations/rules', { token: est.token });
  const pesos = reglas.data?.ranking ?? reglas.data?.weights ?? [];
  check(pesos.some((p) => p.code === 'activity_interested' && p.weight === 5) && !pesos.some((p) => p.code === 'similar_saved'),
    'V41.6.7 El reparto publicado nombra «Me interesa» y ya no «Guardar»', json(pesos.map((p) => [p.code, p.weight])));
  check(lista.every((i) => Number(i.score) < 100 || (i.reasons ?? []).length > 1),
    'V41.6.8 §8 Nadie llega a 100 por una sola coincidencia', json(lista.filter((i) => Number(i.score) >= 100).map((i) => i.reasons)));
}

// ===========================================================================
//  BATCH V4.1-7 — Gamificación simplificada (A41-016, A41-017, A41-027)
// ===========================================================================
async function batch7(ctx) {
  objective('BATCH V4.1-7 · Criterios sin puntos libres, extras de temporada y propuestas docentes revisadas por Dirección');
  const { execSync } = await import('node:child_process');
  const psql = (sql) => execSync(
    `docker exec perfil_postgres psql -U ${process.env.POSTGRES_USER ?? 'perfil_user'} -d ${process.env.POSTGRES_DB ?? 'perfil_estudiantil'} -tAc "${sql.replace(/"/g, '\\"')}"`,
    { encoding: 'utf8' },
  ).trim();
  const director = await provisionAndActivate(ctx.admin, { firstName: 'Dora', lastName: `Puntos${L}`, email: correoStaff('b7dir'), role: 'CAREER_DIRECTOR' });
  const docente = await provisionAndActivate(ctx.admin, { firstName: 'Ciro', lastName: `Puntos${L}`, email: correoStaff('b7doc'), role: 'TEACHER' });
  const ajeno = await provisionAndActivate(ctx.admin, { firstName: 'Iris', lastName: `Puntos${L}`, email: correoStaff('b7ajeno'), role: 'TEACHER' });
  await req('PUT', `/users/${docente.userId}/semesters`, { token: ctx.admin, body: { semesters: [5] } });
  await req('PUT', `/users/${ajeno.userId}/semesters`, { token: ctx.admin, body: { semesters: [9] } });
  const est = await provisionAndActivate(ctx.admin, { firstName: 'Eva', lastName: `Puntos${L}`, email: `v41.b7est.${TS}@est.univalle.edu`, role: 'STUDENT', semester: 5 });
  await req('POST', '/profiles/me', { token: est.token, body: {} });
  est.profileId = (await req('GET', '/profiles/me', { token: est.token })).data?.id;
  const cats = (await req('GET', '/activity-categories', { token: director.token })).data ?? [];
  const taller = cats.find((c) => c.code === 'taller_academico') ?? cats[0];
  const base = { type: 'academica', categoryId: taller.id, semesterScope: [5], activityDate: en(72), endAt: en(74), modality: 'presencial', location: 'Aula 201' };

  // ----- A41-017: Retos y recompensas se retiran sin borrar la historia
  const reto = await req('POST', '/gamification/challenges', { token: docente.token, body: { title: `Reto ${L}`, points: 10 } });
  const recompensa = await req('POST', '/gamification/rewards', { token: director.token, body: { name: `Premio ${L}`, cost: 10 } });
  const historicos = await req('GET', '/gamification/challenges', { token: docente.token });
  check(reto.status === 410 && recompensa.status === 410 && historicos.status === 200,
    'V41.7.1 A41-017 Ya no se crean retos ni recompensas (410); lo histórico se sigue consultando', `${reto.status} / ${recompensa.status} / ${historicos.status}`);

  // ----- A41-016 (§9.2): sin puntos libres en la actividad
  const libres = await req('POST', '/activities', {
    token: director.token, body: { ...base, title: `Puntos libres ${L}`, gamificationRules: [{ trigger: 'participacion_confirmada', points: 50 }] },
  });
  check(libres.status === 400 && !!libres.data?.fields?.gamificationRules,
    'V41.7.2 §9.2 Puntos escritos a mano en la actividad se rechazan, con el error en su campo', `status ${libres.status} ${json(libres.data?.fields)}`);
  const disponibles = (await req('GET', '/gamification-criteria/available', { token: docente.token })).data ?? [];
  const deProyecto = (await req('GET', '/gamification-criteria/available?trigger=proyecto_corroborado', { token: docente.token })).data ?? [];
  const general = disponibles.find((c) => c.code === 'participacion_confirmada');
  check(!!general && disponibles.every((c) => c.trigger === 'participacion_confirmada' && !c.isBonus)
    && deProyecto.length > 0 && deProyecto.every((c) => c.trigger === 'proyecto_corroborado' && !c.isBonus),
    'V41.7.3 El docente ve solo criterios vigentes elegibles (participación o proyecto), sin extras de temporada', json(deProyecto.map((c) => c.code)));
  const conCriterio = await req('POST', '/activities', {
    token: director.token, body: { ...base, title: `Con criterio ${L}`, gamificationRules: [{ trigger: 'participacion_confirmada', criterionId: general?.id }] },
  });
  const regla = (conCriterio.data?.gamificationRules ?? [])[0];
  check(conCriterio.status === 201 && regla?.criterionId === general?.id && regla?.points === general?.points,
    'V41.7.4 §9.3 Al elegir un criterio, los puntos son los del criterio', json(conCriterio.data?.gamificationRules));
  const trucado = await req('POST', '/activities', {
    token: director.token, body: { ...base, title: `Trucado ${L}`, gamificationRules: [{ trigger: 'participacion_confirmada', criterionId: general?.id, points: 99 }] },
  });
  check(trucado.status === 400, 'V41.7.5 §9.2 Un criterio con otros puntos que los suyos se rechaza', `status ${trucado.status}`);

  // ----- §9.1: Dirección también configura; extras de temporada con vigencia
  const area = (await req('POST', '/academic-areas', {
    token: ctx.admin, body: { name: `Robotica de temporada ${L}`, description: 'Área del escenario de extras de temporada.', tags: ['servomotores'] },
  })).data;
  const hoy = new Date().toLocaleDateString('en-CA', { timeZone: 'America/La_Paz' });
  const manana = new Date(Date.now() + 86_400_000).toLocaleDateString('en-CA', { timeZone: 'America/La_Paz' });
  const sinFechas = await req('POST', '/gamification-criteria', {
    token: director.token, body: { code: `bono_sf_${TS}`, name: 'Extra sin fechas', trigger: 'participacion_confirmada', points: 5, academicAreaId: area?.id, isBonus: true },
  });
  const alReves = await req('POST', '/gamification-criteria', {
    token: director.token, body: { code: `bono_rv_${TS}`, name: 'Extra al reves', trigger: 'participacion_confirmada', points: 5, academicAreaId: area?.id, isBonus: true, validFrom: manana, validUntil: hoy },
  });
  check(sinFechas.status >= 400 && sinFechas.status < 500 && alReves.status >= 400 && alReves.status < 500,
    'V41.7.6 §9.3 Un extra de temporada exige vigencia, y que termine después de empezar', `${sinFechas.status} / ${alReves.status}`);
  const bono = await req('POST', '/gamification-criteria', {
    token: director.token,
    body: { code: `bono_${TS}`, name: 'Extra de robotica', trigger: 'participacion_confirmada', points: 7, academicAreaId: area?.id, isBonus: true, validFrom: hoy, validUntil: manana },
  });
  const estudianteCrea = await req('POST', '/gamification-criteria', {
    token: est.token, body: { code: `est_${TS}`, name: 'Mis puntos', trigger: 'participacion_confirmada', points: 100 },
  });
  check(bono.status === 201 && bono.data?.isBonus === true && estudianteCrea.status === 403,
    'V41.7.7 §9.1 Dirección crea un extra de temporada; un estudiante no crea criterios', `${bono.status} / ${estudianteCrea.status}`);
  try {
    const evento = await req('POST', '/activities', {
      token: director.token,
      body: { ...base, title: `Robotica en temporada ${L}`, areaIds: [area?.id], status: 'open', responsibleUserIds: [docente.userId] },
    });
    await req('POST', `/activities/${evento.data?.id}/register`, { token: est.token });
    const conf = await req('PATCH', `/activities/${evento.data?.id}/confirm-participation`, {
      token: docente.token, body: { studentProfileId: est.profileId, status: 'confirmed' },
    });
    const g = (await req('GET', '/gamification/me', { token: est.token })).data;
    const bonos = (g?.events ?? []).filter((e) => /Bono de temporada «Extra de robotica»/.test(e.reason));
    check(conf.status === 200 && bonos.length === 1 && bonos[0].points === 7,
      'V41.7.8 §9.3 El extra vigente suma una vez, aparte, en el área de la actividad', json((g?.events ?? []).map((e) => [e.points, e.reason])));
    await req('GET', '/gamification/me', { token: est.token });
    const otraVez = ((await req('GET', '/gamification/me', { token: est.token })).data?.events ?? []).filter((e) => /Bono de temporada/.test(e.reason));
    check(otraVez.length === 1, 'V41.7.9 §9.6 Recalcular no vuelve a dar el extra (una recompensa por hecho)', `${otraVez.length}`);
  } finally {
    await req('PATCH', `/gamification-criteria/${bono.data?.id}`, { token: ctx.admin, body: { isActive: false } });
  }

  // ----- §9.3 Proyecto: el docente propone, Dirección decide
  const proy = await req('POST', '/projects', {
    token: est.token, body: { title: `Brazo robotico ${L}`, description: 'Brazo robótico con visión para clasificar piezas.', visibility: 'teachers', status: 'draft' },
  });
  const criterioProyecto = deProyecto.find((c) => c.code === 'proyecto_corroborado') ?? deProyecto[0];
  const proponer = (quien, extra = {}) => req('POST', '/gamification/proposals', {
    token: quien.token,
    body: { projectId: proy.data?.id, studentProfileId: est.profileId, criterionId: criterioProyecto?.id, reason: 'Integró visión y control con evidencia propia.', ...extra },
  });
  psql(`update projects set backing_tier='declared' where id='${proy.data?.id}'`);
  const sinRespaldo = await proponer(docente);
  check(sinRespaldo.status === 400 && sinRespaldo.data?.code === 'PROJECT_BACKING_INSUFFICIENT',
    'V41.7.10 §9.3 Un proyecto solo declarado no se propone', `status ${sinRespaldo.status} ${sinRespaldo.data?.code}`);
  psql(`update projects set backing_tier='supported' where id='${proy.data?.id}'`);
  const propiaEst = await proponer(est);
  const fueraDeAlcance = await proponer(ajeno);
  const corta = await proponer(docente, { reason: 'bien' });
  const conBono = await proponer(docente, { criterionId: bono.data?.id });
  check(propiaEst.status === 403 && fueraDeAlcance.status === 404 && corta.status === 400 && conBono.status === 400,
    'V41.7.11 §9.3 El estudiante no se premia; otro docente fuera de alcance no propone; motivo y criterio válidos',
    `${propiaEst.status} / ${fueraDeAlcance.status} / ${corta.status} / ${conBono.status}`);
  const propuesta = await proponer(docente);
  const repetida = await proponer(docente);
  check(propuesta.status === 201 && propuesta.data?.status === 'pending' && repetida.status === 409,
    'V41.7.12 §9.6 La propuesta queda pendiente y no se duplica', `${propuesta.status} / ${repetida.status}`);
  const bandeja = (await req('GET', '/gamification/proposals?status=pending', { token: director.token })).data ?? [];
  const enBandeja = bandeja.find((p) => p.id === propuesta.data?.id);
  const delAjeno = (await req('GET', '/gamification/proposals', { token: ajeno.token })).data ?? [];
  check(!!enBandeja && enBandeja.project?.title?.includes('Brazo') && enBandeja.student?.profileId === est.profileId
    && enBandeja.project?.backingTier === 'supported' && !!enBandeja.reason && !delAjeno.some((p) => p.id === propuesta.data?.id),
    'V41.7.13 §9.4 Dirección ve proyecto, estudiante, respaldo y motivo; otro docente no ve propuestas ajenas', json(enBandeja));
  const docenteDecide = await req('POST', `/gamification/proposals/${propuesta.data?.id}/review`, { token: docente.token, body: { decision: 'approve' } });
  const rechazoMudo = await req('POST', `/gamification/proposals/${propuesta.data?.id}/review`, { token: director.token, body: { decision: 'reject' } });
  check(docenteDecide.status === 403 && rechazoMudo.status === 400,
    'V41.7.14 §9.3 El docente no aprueba lo suyo; rechazar exige motivo', `${docenteDecide.status} / ${rechazoMudo.status}`);
  const antes = (await req('GET', '/gamification/me', { token: est.token })).data?.totalPoints ?? 0;
  const aprueba = await req('POST', `/gamification/proposals/${propuesta.data?.id}/review`, { token: director.token, body: { decision: 'approve', comment: 'Respaldado.' } });
  const despues = (await req('GET', '/gamification/me', { token: est.token })).data;
  const evento = (despues?.events ?? []).find((e) => /Brazo robotico/.test(e.reason));
  check(aprueba.status === 200 && aprueba.data?.status === 'approved' && evento?.points === criterioProyecto?.points
    && (despues?.totalPoints ?? 0) - antes === criterioProyecto?.points,
    'V41.7.15 §9.3 Al aprobar, los puntos del criterio entran al historial con su origen', json(evento));
  const otraDecision = await req('POST', `/gamification/proposals/${propuesta.data?.id}/review`, { token: director.token, body: { decision: 'approve' } });
  const tras = await proponer(docente);
  check(otraDecision.status === 409 && tras.status === 409,
    'V41.7.16 §9.6 Una propuesta decidida no se vuelve a decidir ni a proponer', `${otraDecision.status} / ${tras.status}`);
  const auditoria = psql(`select string_agg(event_type, ',') from audit_events where entity_id='${propuesta.data?.id}'`);
  check(/GAMIFICATION_PROPOSED/.test(auditoria) && /GAMIFICATION_PROPOSAL_REVIEWED/.test(auditoria),
    'V41.7.17 Propuesta y decisión quedan en la auditoría', auditoria);

  // ----- §9.5 Puntos por estudiante: solo personal, con alcance y auditado
  const delDocente = (await req('GET', '/gamification/scope-points?period=year', { token: docente.token })).data?.students ?? [];
  const deOtro = (await req('GET', '/gamification/scope-points?period=year', { token: ajeno.token })).data?.students ?? [];
  const delEst = await req('GET', '/gamification/scope-points', { token: est.token });
  check(delDocente.some((s) => s.profileId === est.profileId && s.points > 0) && !deOtro.some((s) => s.profileId === est.profileId) && delEst.status === 403,
    'V41.7.18 §9.5 El docente ve los puntos de sus semestres; otro docente no; el estudiante no ve la tabla', `${delDocente.length} / ${deOtro.length} / ${delEst.status}`);
  const accesos = Number(psql(`select count(*) from audit_events where event_type='GAMIFICATION_SCOPE_VIEWED' and actor_user_id='${docente.userId}'`));
  check(accesos >= 1, 'V41.7.19 §9.5 Consultar puntos de otros queda auditado', `${accesos}`);

  // ----- A41-027: saldo propio con historial trazable
  const billetera = await req('GET', '/gamification/me/wallet', { token: est.token });
  check(billetera.status === 200 && billetera.data?.balance?.available === despues?.totalPoints,
    'V41.7.20 A41-027 El estudiante ve su saldo, igual a la suma de su historial', json(billetera.data?.balance));
}

const BATCHES = { batch1, batch2, batch3, batch4, batch5, batch6, batch7 };

async function main() {
  console.log(`${C.bold}Afinia V4.1 — verificación del contrato contra la API${C.r}`);
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
