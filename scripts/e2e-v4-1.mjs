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

const BATCHES = { batch1, batch2, batch3 };

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
