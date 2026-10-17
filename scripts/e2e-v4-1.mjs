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

const BATCHES = { batch1, batch2 };

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
