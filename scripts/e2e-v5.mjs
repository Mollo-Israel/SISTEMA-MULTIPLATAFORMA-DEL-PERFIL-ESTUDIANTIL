/**
 * Cierre V5 — verificación del contrato contra la API en marcha.
 *
 * Una sección por batch (PLAN_BATCHES_AFINIA_V5.md). Cada comprobación cita
 * el escenario del §19 del contrato (A01…I07) que verifica. Se ejecuta con
 * la API en modo de correo simulado (MAIL_TRANSPORT=console).
 *
 * Uso:
 *   API_URL=http://localhost:3010/api node scripts/e2e-v5.mjs [batch4 …]
 */
import { execSync } from 'child_process';
import { API, asegurarGithubSimulado, codigoUniversitario, loginAdmin, provisionAndActivate, provisionStudent, repoDePrueba, req } from './lib/fixtures.mjs';

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
const correoStaff = (k) => `v5.${k}.${TS}@univalle.edu`;
const correoEst = (k) => `v5.${k}.${TS}@est.univalle.edu`;
const json = (x) => JSON.stringify(x ?? null).slice(0, 220);
const en = (h) => new Date(Date.now() + h * 3_600_000).toISOString();

/** Registrar asistencia o decidir una solicitud SIN la ayuda de las suites anteriores. */
const decidir = (token, activityId, studentProfileId, status, extra = {}) => req('PATCH', `/activities/${activityId}/confirm-participation`, {
  token, body: { studentProfileId, status, __sinAdelantar: true, ...extra },
});

// ===========================================================================
//  BATCH V5-1 — Primer y segundo apellido, con compatibilidad (V5-04, V5-05, A01…A05)
// ===========================================================================
async function subirPadron(token, contenido) {
  const form = new FormData();
  form.append('file', new Blob([contenido], { type: 'text/csv' }), 'padron.csv');
  const res = await fetch(`${API}/imports/students/preview`, { method: 'POST', headers: { Authorization: `Bearer ${token}` }, body: form });
  let data = null;
  try { data = await res.json(); } catch { /* sin cuerpo */ }
  return { status: res.status, data };
}

async function batch1(ctx) {
  objective('BATCH V5-1 · Primer apellido obligatorio, segundo opcional, sin partir apellidos por suposición');
  const usuario = async (email) => ((await req('GET', `/users?search=${encodeURIComponent(email)}`, { token: ctx.admin })).data ?? [])
    .find((u) => u.email === email);

  // --- A01: alta con primer apellido y segundo vacío
  const e1 = correoEst('b1a01');
  const a01 = await req('POST', '/users', { token: ctx.admin, body: { firstName: 'Ana', firstSurname: 'Quispe', email: e1, role: 'STUDENT', semester: 2, universityCode: codigoUniversitario('STUDENT') } });
  check(a01.status === 201 && a01.data?.firstSurname === 'Quispe' && a01.data?.secondSurname === null && a01.data?.lastName === 'Quispe' && a01.data?.surnamesPending === false,
    'V5.1.1 A01 Alta con primer apellido y sin el segundo', json(a01.data && { f: a01.data.firstSurname, s: a01.data.secondSurname, l: a01.data.lastName }));
  const sinApellido = await req('POST', '/users', { token: ctx.admin, body: { firstName: 'Sin', email: correoEst('b1sin'), role: 'STUDENT', semester: 2, universityCode: codigoUniversitario('STUDENT') } });
  check(sinApellido.status === 400 && !!sinApellido.data?.fields?.firstSurname, 'V5.1.2 A01 Sin primer apellido no se crea la cuenta (error en su campo)', `${sinApellido.status}`);
  const dos = await req('POST', '/users', { token: ctx.admin, body: { firstName: 'Luis', firstSurname: 'Mamani', secondSurname: 'Condori', email: correoEst('b1dos'), role: 'STUDENT', semester: 3, universityCode: codigoUniversitario('STUDENT') } });
  check(dos.status === 201 && dos.data?.lastName === 'Mamani Condori', 'V5.1.3 Los dos apellidos componen el apellido que se muestra', json(dos.data?.lastName));

  // --- A02: un cliente anterior con «Pérez García» no se parte por suposición
  const e2 = correoEst('b1a02');
  const a02 = await req('POST', '/users', { token: ctx.admin, body: { firstName: 'Rosa', lastName: 'Pérez García', email: e2, role: 'STUDENT', semester: 2, universityCode: codigoUniversitario('STUDENT') } });
  check(a02.status === 201 && a02.data?.lastName === 'Pérez García' && a02.data?.firstSurname === null && a02.data?.surnamesPending === true,
    'V5.1.4 A02 «Pérez García» se conserva y queda por separar (no se asigna como dos apellidos)', json(a02.data && { f: a02.data.firstSurname, p: a02.data.surnamesPending }));
  const separado = await req('PATCH', `/users/${a02.data?.id}`, { token: ctx.admin, body: { firstSurname: 'Pérez', secondSurname: 'García' } });
  check(separado.status === 200 && separado.data?.firstSurname === 'Pérez' && separado.data?.secondSurname === 'García' && separado.data?.surnamesPending === false && separado.data?.lastName === 'Pérez García',
    'V5.1.5 A05 Administración lo separa explícitamente; el apellido mostrado no cambia', json(separado.data && { f: separado.data.firstSurname, s: separado.data.secondSurname }));

  // --- A03: padrón con la plantilla nueva y con la anterior
  const c1 = codigoUniversitario('STUDENT');
  const c2 = codigoUniversitario('STUDENT');
  const nuevo = correoEst('b1padron1');
  const viejo = correoEst('b1padron2');
  const plantillaNueva = `university_code,first_name,first_surname,second_surname,institutional_email,semester\n${c1},Eva,Choque,Mamani,${nuevo},4\n`;
  const pNueva = await subirPadron(ctx.admin, plantillaNueva);
  const apNueva = await req('POST', `/imports/students/${pNueva.data?.batchId}/apply`, { token: ctx.admin });
  const uNueva = await usuario(nuevo);
  check(pNueva.status === 201 && apNueva.status < 300 && uNueva?.firstSurname === 'Choque' && uNueva?.secondSurname === 'Mamani' && uNueva?.lastName === 'Choque Mamani',
    'V5.1.6 A03 Plantilla nueva: el padrón crea la cuenta con sus dos apellidos', json(uNueva && { f: uNueva.firstSurname, s: uNueva.secondSurname, l: uNueva.lastName }));
  const plantillaVieja = `university_code,first_name,last_name,institutional_email,semester\n${c2},Iván,Flores Rojas,${viejo},4\n`;
  const pVieja = await subirPadron(ctx.admin, plantillaVieja);
  const fila = (pVieja.data?.rows ?? [])[0];
  const apVieja = await req('POST', `/imports/students/${pVieja.data?.batchId}/apply`, { token: ctx.admin });
  const uVieja = await usuario(viejo);
  check(pVieja.status === 201 && fila?.status === 'new' && fila?.institutionalEmail === viejo && apVieja.status < 300
    && uVieja?.lastName === 'Flores Rojas' && uVieja?.surnamesPending === true,
  'V5.1.7 A03 Plantilla anterior: sin desplazar columnas y con el apellido compuesto por separar', json(uVieja && { l: uVieja.lastName, p: uVieja.surnamesPending }));
}

// ===========================================================================
//  BATCH V5-2 — Fechas al minuto, externas validadas, borrar borradores (§5, B02…B07, B10)
// ===========================================================================
async function batch2(ctx) {
  objective('BATCH V5-2 · Fechas al minuto, externas validadas y borradores (§5)');
  const director = await provisionAndActivate(ctx.admin, { firstName: 'Delia', lastName: `Fechas${L}`, email: correoStaff('b2dir'), role: 'CAREER_DIRECTOR' });
  const otro = await provisionAndActivate(ctx.admin, { firstName: 'Omar', lastName: `Ajeno${L}`, email: correoStaff('b2dir2'), role: 'CAREER_DIRECTOR' });
  const est = await provisionStudent(ctx.admin, { firstName: 'Iris', lastName: `Borr${L}`, email: correoEst('b2e1'), semester: 3 });
  const cats = (await req('GET', '/activity-categories', { token: director.token })).data ?? [];
  const charla = cats.find((c) => c.appliesTo === 'academica') ?? cats[0];
  const areas = (await req('GET', '/academic-areas', { token: director.token })).data ?? [];
  const base = { type: 'academica', categoryId: charla.id, semesterScope: [3], modality: 'presencial', location: 'Aula 201' };
  const crear = (titulo, extra = {}) => req('POST', '/activities', { token: director.token, body: { ...base, title: `${titulo} ${L}`, ...extra } });

  // --- B04 / B05: fechas al minuto con tolerancia, sin abrir el pasado
  const minuto = new Date(); minuto.setSeconds(0, 0);
  const ahora = await crear('Empieza ahora', { activityDate: minuto.toISOString(), endAt: en(2), status: 'open' });
  check(ahora.status === 201 && ahora.data?.status === 'open',
    'V5.2.1 B04 Elegir «ahora» al minuto se publica aunque ya pasaron unos segundos', `${ahora.status} ${ahora.data?.code ?? ahora.data?.status}`);
  const manana = new Date(); manana.setHours(Math.max(0, manana.getHours() - 3), 0, 0, 0);
  const pasada = await crear('Empezó hace horas', { activityDate: manana.toISOString(), endAt: en(2), status: 'open' });
  check(pasada.status === 400 && pasada.data?.code === 'ACTIVITY_START_IN_PAST',
    'V5.2.2 B05 Un evento que empezó hace horas no se publica como futuro', `${pasada.status} ${pasada.data?.code}`);

  // --- B02 / B03: la externa se valida igual que la interna
  const ext = { originType: 'external', provider: 'Cisco NetAcad', externalUrl: 'https://www.netacad.com/', activityDate: en(48), endAt: en(50), status: 'open' };
  const lugarMalo = await crear('Externa lugar malo', { ...ext, location: '1234' });
  check(lugarMalo.status === 400 && !!lugarMalo.data?.fields?.location, 'V5.2.3 B02 Externa presencial con lugar «1234» se rechaza en su campo', `${lugarMalo.status}`);
  const sinLugar = await crear('Externa sin lugar', { ...ext, location: undefined, __sinCompletar: true, areaIds: [areas[0]?.id] });
  check(sinLugar.status === 400 && !!sinLugar.data?.fields?.location, 'V5.2.4 B02 Externa presencial sin lugar tampoco se publica', `${sinLugar.status} ${json(sinLugar.data?.fields)}`);
  const virtualSinEnlace = await crear('Externa virtual sin enlace', { ...ext, modality: 'virtual', location: undefined, externalUrl: undefined, __sinCompletar: true, areaIds: [areas[0]?.id] });
  check(virtualSinEnlace.status === 400, 'V5.2.5 B03 Externa virtual sin ningún enlace se rechaza', `${virtualSinEnlace.status} ${json(virtualSinEnlace.data?.fields)}`);
  const virtualOficial = await crear('Externa virtual con enlace oficial', { ...ext, modality: 'virtual', location: undefined });
  check(virtualOficial.status === 201, 'V5.2.6 B03 Externa virtual con el enlace oficial del proveedor se publica', `${virtualOficial.status} ${json(virtualOficial.data?.fields)}`);

  // --- B07: borrar un borrador propio; lo publicado no
  const borrador = await crear('Borrador para borrar', { activityDate: en(48), endAt: en(50) });
  const ajeno = await req('DELETE', `/activities/${borrador.data?.id}`, { token: otro.token });
  check(ajeno.status === 403, 'V5.2.7 B07 Otra persona no borra mi borrador', `${ajeno.status}`);
  const borrado = await req('DELETE', `/activities/${borrador.data?.id}`, { token: director.token });
  const yaNo = await req('GET', `/activities/${borrador.data?.id}`, { token: director.token });
  check(borrado.status === 204 && yaNo.status === 404, 'V5.2.8 B07 El borrador propio sin historia se borra', `${borrado.status} / ${yaNo.status}`);
  const audit = await req('GET', `/audit/events?eventType=ACTIVITY_DRAFT_DELETED&entityId=${borrador.data?.id}`, { token: ctx.admin });
  check(((audit.data?.items ?? audit.data) ?? []).length >= 1, 'V5.2.9 B07 Queda la huella en la auditoría', json(audit.data).slice(0, 120));
  const publicada = await crear('Publicada', { activityDate: en(48), endAt: en(50), status: 'open' });
  const noPublicada = await req('DELETE', `/activities/${publicada.data?.id}`, { token: director.token });
  check(noPublicada.status === 409 && noPublicada.data?.code === 'ACTIVITY_NOT_DELETABLE', 'V5.2.10 B07 Una publicada no se borra: se cancela', `${noPublicada.status} ${noPublicada.data?.code}`);

  // --- B06: duplicar una terminada da un borrador limpio
  await req('POST', `/activities/${publicada.data?.id}/register`, { token: est.token });
  await req('PATCH', `/activities/${publicada.data?.id}`, { token: director.token, body: { activityDate: en(-3), endAt: en(-2) } });
  await req('PATCH', `/activities/${publicada.data?.id}`, { token: director.token, body: { status: 'finished' } });
  const copia = await req('POST', `/activities/${publicada.data?.id}/duplicate`, { token: director.token });
  const filasCopia = (await req('GET', `/activities/${copia.data?.id}/participants`, { token: director.token })).data ?? [];
  check(copia.status === 201 && copia.data?.status === 'draft' && copia.data?.id !== publicada.data?.id && filasCopia.length === 0,
    'V5.2.11 B06 Duplicar una terminada da un borrador nuevo sin participantes', `${copia.status} ${copia.data?.status} ${filasCopia.length}`);
  const borraCopia = await req('DELETE', `/activities/${copia.data?.id}`, { token: director.token });
  check(borraCopia.status === 204, 'V5.2.12 B07 La copia (borrador sin historia) sí se puede borrar', `${borraCopia.status}`);

  // --- B10: una charla general publica con un área y sin tecnologías
  const ia = areas.find((a) => /inteligencia/i.test(a.name)) ?? areas[0];
  const general = await crear('Introducción a IA', { areaIds: [ia.id], skillIds: [], activityDate: en(48), endAt: en(50), status: 'open' });
  check(general.status === 201 && (general.data?.activitySkills ?? []).length === 0,
    'V5.2.13 B10 Una charla general se publica con un área y sin tecnologías', `${general.status} ${json(general.data?.fields)}`);
}

// ===========================================================================
//  BATCH V5-3 — Vista docente, filtro por responsable y favoritos (V5-01, V5-02)
// ===========================================================================
async function batch3(ctx) {
  objective('BATCH V5-3 · Vista docente por páginas, filtro por responsable y favoritos');
  const director = await provisionAndActivate(ctx.admin, { firstName: 'Rita', lastName: `Resp${L}`, email: correoStaff('b3dir'), role: 'CAREER_DIRECTOR' });
  const docente = await provisionAndActivate(ctx.admin, { firstName: 'Tito', lastName: `Doc${L}`, email: correoStaff('b3doc'), role: 'TEACHER' });
  await req('PUT', `/users/${docente.userId}/semesters`, { token: ctx.admin, body: { semesters: [3] } });
  const est = await provisionStudent(ctx.admin, { firstName: 'Ugo', lastName: `Fav${L}`, email: correoEst('b3e1'), semester: 3 });
  const cats = (await req('GET', '/activity-categories', { token: director.token })).data ?? [];
  const charla = cats.find((c) => c.appliesTo === 'academica') ?? cats[0];
  const crear = (titulo, extra = {}) => req('POST', '/activities', {
    token: director.token,
    body: { title: `${titulo} ${L}`, type: 'academica', categoryId: charla.id, semesterScope: [3], activityDate: en(48), endAt: en(50), ...extra },
  });
  const publicada = await crear('Con responsable docente', { status: 'open', responsibleUserIds: [docente.userId] });
  const borrador = await crear('Borrador de Dirección', { responsibleUserIds: [docente.userId] });

  // --- V5-01: el docente consulta por páginas, sin borradores
  const pag = await req('GET', `/activities?limit=6&q=${encodeURIComponent(L)}`, { token: docente.token });
  const ids = (pag.data?.items ?? []).map((a) => a.id);
  check(pag.status === 200 && Array.isArray(pag.data?.items) && Number.isInteger(pag.data?.total) && ids.includes(publicada.data?.id),
    'V5.3.1 V5-01 El docente consulta la oferta por páginas (con total)', `${pag.status} ${json(ids)}`);
  check(!ids.includes(borrador.data?.id), 'V5.3.2 B08 En la consulta del docente no aparecen borradores ajenos', json(ids));
  check((pag.data?.items ?? []).every((a) => typeof a.isFavorite === 'boolean'), 'V5.3.3 Cada tarjeta dice si es favorita de quien consulta');

  // --- V5-02: filtro por responsable
  const porResp = await req('GET', `/activities?limit=6&responsibleId=${docente.userId}`, { token: est.token });
  check(porResp.status === 200 && (porResp.data?.items ?? []).some((a) => a.id === publicada.data?.id)
    && (porResp.data?.items ?? []).every((a) => a.status !== 'draft'),
  'V5.3.4 V5-02 El estudiante filtra por responsable (y no ve borradores)', json((porResp.data?.items ?? []).map((a) => a.title)));
  const buscar = await req('GET', `/activities/responsibles?q=${encodeURIComponent('Tito')}`, { token: est.token });
  const fila = (buscar.data ?? []).find((p) => p.id === docente.userId);
  check(buscar.status === 200 && !!fila && fila.email === undefined, 'V5.3.5 V5-02 El buscador de responsables da nombre y rol, sin correo', json(fila));

  // --- V5-01: favoritos, idempotentes y sin efecto en lo demás
  const f1 = await req('PUT', `/activities/${publicada.data?.id}/favorite`, { token: docente.token });
  const f2 = await req('PUT', `/activities/${publicada.data?.id}/favorite`, { token: docente.token });
  const favs = await req('GET', '/activities?limit=6&favorites=true', { token: docente.token });
  check(f1.status === 200 && f2.status === 200 && (favs.data?.items ?? []).map((a) => a.id).join() === publicada.data?.id,
    'V5.3.6 V5-01 Marcar favorita es idempotente y el filtro «Solo favoritas» la trae', json((favs.data?.items ?? []).map((a) => a.id)));
  const participantes = (await req('GET', `/activities/${publicada.data?.id}/participants`, { token: director.token })).data ?? [];
  check(participantes.length === 0, 'V5.3.7 §14.1 Un favorito no es una inscripción ni reserva lugar', `${participantes.length}`);
  const ajeno = await req('PUT', `/activities/${borrador.data?.id}/favorite`, { token: est.token });
  check(ajeno.status === 404, 'V5.3.8 No se marca como favorito un borrador que no se puede ver', `${ajeno.status}`);
  const quita = await req('DELETE', `/activities/${publicada.data?.id}/favorite`, { token: docente.token });
  const sinFavs = await req('GET', '/activities?limit=6&favorites=true', { token: docente.token });
  check(quita.status === 200 && (sinFavs.data?.items ?? []).length === 0, 'V5.3.9 Quitarla la saca de favoritas', `${quita.status} ${(sinFavs.data?.items ?? []).length}`);
}

// ===========================================================================
//  BATCH V5-10 + V5-11 — Señales de GitHub al día y pedidos: alias ≠ tecnología nueva
// ===========================================================================
async function batch10(ctx) {
  objective('BATCH V5-10/11 · «La usé» al día, PyMongo como señal, y FastAPI/Pytest no son Python');
  await asegurarGithubSimulado();
  const est = await provisionStudent(ctx.admin, { firstName: 'Gael', lastName: `Repo${L}`, email: correoEst('b10e1'), semester: 5 });
  const p = await req('POST', '/projects', {
    token: est.token, body: { title: `API de inventario ${L}`, repositoryUrl: repoDePrueba(`pymongo-inv-${TS}`), status: 'draft' },
  });
  const id = p.data?.id;
  const sug = (await req('GET', `/projects/${id}/suggestions`, { token: est.token })).data;
  const mongo = (sug?.suggestions ?? []).find((x) => /^mongodb$/i.test(x.skill?.name ?? ''));
  const python = (sug?.suggestions ?? []).find((x) => /^python$/i.test(x.skill?.name ?? ''));
  check(p.status === 201 && !!mongo && /pymongo/i.test(mongo.why ?? ''),
    'V5.10.1 F03 PyMongo sugiere MongoDB con su procedencia (señal del repositorio, no un servidor ni una persona)', json(sug?.suggestions?.map((x) => [x.skill?.name, x.why])));

  const antes = (await req('GET', `/projects/${id}/checks`, { token: est.token })).data;
  const pyAntes = (antes?.repository?.technologySignals ?? []).find((t) => /^python$/i.test(t.name));
  const acepta = await req('POST', `/projects/${id}/suggestions/accept`, {
    token: est.token, body: { skillId: python?.skill.id, areaId: python?.areas?.[0]?.id, signal: python?.signal, source: python?.source },
  });
  const despues = (await req('GET', `/projects/${id}/checks`, { token: est.token })).data;
  const pyDespues = (despues?.repository?.technologySignals ?? []).find((t) => /^python$/i.test(t.name));
  const sug2 = (await req('GET', `/projects/${id}/suggestions`, { token: est.token })).data;
  check(pyAntes?.status === 'detected' && acepta.status === 200 && pyDespues?.status === 'both'
    && !(sug2?.suggestions ?? []).some((x) => /^python$/i.test(x.skill?.name ?? '')),
  'V5.10.2 F04 Aceptar Python lo muestra enseguida como declarada y detectada, y deja de sugerirse', json({ antes: pyAntes?.status, despues: pyDespues?.status }));

  // --- V5-25: un pedido no catalogado se resuelve como tecnología nueva o como alias, nunca mezclado
  const nombreNuevo = `Pytest${L}`;
  const pedido = await req('POST', `/projects/${id}/suggestions/request-skill`, { token: est.token, body: { name: nombreNuevo, source: 'requirements.txt (pytest)' } });
  const pythonSkill = ((await req('GET', '/skills', { token: est.token })).data ?? []).find((s) => /^python$/i.test(s.name));
  const aliasSinConfirmar = await req('POST', `/skill-requests/${pedido.data?.id}/decision`, {
    token: ctx.admin, body: { decision: 'alias', skillId: pythonSkill?.id },
  });
  check(aliasSinConfirmar.status === 400 && aliasSinConfirmar.data?.code === 'ALIAS_NOT_CONFIRMED',
    'V5.11.1 F07 Registrar un alias exige confirmar que es la misma tecnología (FastAPI usa Python, no es Python)', `${aliasSinConfirmar.status} ${aliasSinConfirmar.data?.code}`);
  const areas = (await req('GET', '/academic-areas', { token: ctx.admin })).data ?? [];
  const area = areas.find((a) => /software/i.test(a.name)) ?? areas[0];
  const nueva = await req('POST', `/skill-requests/${pedido.data?.id}/decision`, {
    token: ctx.admin, body: { decision: 'new_skill', newSkill: { academicAreaId: area.id, overrideReason: 'Herramienta de pruebas del área de software.' } },
  });
  const catalogo = (await req('GET', '/skills', { token: est.token })).data ?? [];
  const creada = catalogo.find((s) => s.name === nombreNuevo);
  const pythonDespues = catalogo.find((s) => s.id === pythonSkill?.id);
  check(nueva.status === 200 && nueva.data?.status === 'added' && nueva.data?.resolution === 'new_skill' && !!creada
    && creada.academicAreaId === area.id && !(pythonDespues?.aliases ?? []).includes(nombreNuevo),
  'V5.11.2 F08/F09 La tecnología nueva aparece en el catálogo con su área, y Python no gana un alias falso', json({ s: nueva.status, r: nueva.data?.resolution, a: creada?.academicAreaId === area.id }));
  const otraVez = await req('POST', `/skill-requests/${pedido.data?.id}/decision`, { token: ctx.admin, body: { decision: 'rejected', note: 'Doble clic.' } });
  check(otraVez.status === 409, 'V5.11.3 Decidir dos veces el mismo pedido no lo cambia (idempotente)', `${otraVez.status}`);
  const avisos = (await req('GET', '/notifications/me', { token: est.token })).data;
  const aviso = (avisos?.items ?? avisos ?? []).find?.((n) => n.type === 'SKILL_REQUEST_DECIDED' && n.body?.includes(nombreNuevo));
  check(!!aviso && /se agregó al catálogo/.test(aviso.body), 'V5.11.4 F09 El aviso dice lo que pasó de verdad', json(aviso?.body));

  // --- alias verdadero: el nombre detectado es otra forma de escribir una tecnología existente
  const alias = `postgres${L.toLowerCase()}`;
  const pedido2 = await req('POST', `/projects/${id}/suggestions/request-skill`, { token: est.token, body: { name: alias } });
  const pg = catalogo.find((s) => /^postgresql$/i.test(s.name));
  const comoAlias = await req('POST', `/skill-requests/${pedido2.data?.id}/decision`, {
    token: ctx.admin, body: { decision: 'alias', skillId: pg?.id, sameTechnology: true },
  });
  const pgDespues = ((await req('GET', '/skills', { token: est.token })).data ?? []).find((s) => s.id === pg?.id);
  const cuantas = ((await req('GET', '/skills', { token: est.token })).data ?? []).length;
  check(comoAlias.status === 200 && comoAlias.data?.resolution === 'alias' && (pgDespues?.aliases ?? []).includes(alias) && cuantas === catalogo.length,
    'V5.11.5 Un alias confirmado se agrega a la tecnología existente sin crear otra', json({ s: comoAlias.status, r: comoAlias.data?.resolution }));
}

// ===========================================================================
//  BATCH V5-12 — Contribuciones acotadas al proyecto y varios roles (G01, G04, G05)
// ===========================================================================
async function batch12(ctx) {
  objective('BATCH V5-12 · Lo que dices que usaste sale del proyecto; varios roles que describen, no prueban');
  const est = await provisionStudent(ctx.admin, { firstName: 'Hugo', lastName: `Contrib${L}`, email: correoEst('b12e1'), semester: 4 });
  const skills = (await req('GET', '/skills', { token: est.token })).data ?? [];
  const conArea = skills.filter((s) => s.isActive !== false && s.academicAreaId);
  const propia = conArea[0];
  const ajena = conArea.find((s) => s.id !== propia.id);
  const p = await req('POST', '/projects', {
    token: est.token,
    body: { title: `Proyecto acotado ${L}`, areaIds: [propia.academicAreaId], skillIds: [propia.id], status: 'draft' },
  });
  const id = p.data?.id;
  const fuera = await req('PUT', `/projects/${id}/my-contribution`, { token: est.token, body: { contribution: 'Hice la base.', skillIds: [ajena.id] } });
  check(fuera.status === 400 && fuera.data?.code === 'SKILL_NOT_IN_PROJECT' && new RegExp(ajena.name).test(fuera.data?.message ?? ''),
    'V5.12.1 G01 Una tecnología que el proyecto no tiene se rechaza, nombrándola', `${fuera.status} ${fuera.data?.code}`);
  const dentro = await req('PUT', `/projects/${id}/my-contribution`, {
    token: est.token, body: { contribution: 'Hice la base de datos y coordiné.', skillIds: [propia.id], roles: ['Responsable', 'Base de Datos'] },
  });
  const yo = (await req('GET', `/projects/${id}/members/detailed`, { token: est.token })).data?.find?.((m) => m.userId === est.userId)
    ?? (dentro.data ?? null);
  check(dentro.status === 200 && JSON.stringify(yo?.roles ?? []) === JSON.stringify(['Responsable', 'Base de Datos']) && yo?.role === 'Responsable',
    'V5.12.2 G04 Varios roles (Responsable + Base de Datos); el primero queda como principal', json({ s: dentro.status, roles: yo?.roles, role: yo?.role }));
  const rolRaro = await req('PUT', `/projects/${id}/my-contribution`, { token: est.token, body: { roles: ['Mago'] } });
  check(rolRaro.status === 400, 'V5.12.3 Un rol fuera del catálogo controlado se rechaza', `${rolRaro.status}`);
  const soloRol = await req('PUT', `/projects/${id}/my-contribution`, { token: est.token, body: { roles: ['Backend'], skillIds: [propia.id] } });
  check(soloRol.status === 200, 'V5.12.4 G05 El rol no bloquea una tecnología del proyecto que de verdad usó', `${soloRol.status}`);
}

// ===========================================================================
//  BATCH V5-6 — Recursos: enlace o archivo, tipos y alcance (§8, D01…D07)
// ===========================================================================
async function subirArchivo(token, bytes, nombre, tipo) {
  const form = new FormData();
  form.append('file', new Blob([bytes], { type: tipo }), nombre);
  const res = await fetch(`${API}/uploads`, { method: 'POST', headers: { Authorization: `Bearer ${token}` }, body: form });
  let data = null;
  try { data = await res.json(); } catch { /* sin cuerpo */ }
  return { status: res.status, data };
}

async function leerArchivo(token, ruta) {
  const res = await fetch(`${API}${ruta.replace(/^\/api/, '')}`, { headers: { Authorization: `Bearer ${token}` } });
  return { status: res.status, tipo: res.headers.get('content-type') ?? '', bytes: res.ok ? Buffer.from(await res.arrayBuffer()) : null };
}

async function batch6(ctx) {
  objective('BATCH V5-6 · Un recurso tiene un enlace o un archivo; Dirección elige toda la carrera o semestres');
  const director = await provisionAndActivate(ctx.admin, { firstName: 'Dora', lastName: `Material${L}`, email: correoStaff('b6dir'), role: 'CAREER_DIRECTOR' });
  const docente = await provisionAndActivate(ctx.admin, { firstName: 'Ciro', lastName: `Material${L}`, email: correoStaff('b6doc'), role: 'TEACHER' });
  await req('PUT', `/users/${docente.userId}/semesters`, { token: ctx.admin, body: { semesters: [2] } });
  const est = {};
  for (const n of [3, 4, 5]) {
    est[n] = await provisionStudent(ctx.admin, { firstName: 'Eva', lastName: `Sem${'xabcdef'[n]}${L}`, email: correoEst(`b6e${n}`), semester: n });
  }
  const area = ((await req('GET', '/academic-areas', { token: director.token })).data ?? [])[0];
  const base = (k) => ({ title: `Material ${k} ${L}`, provider: 'Carrera de Sistemas', resourceType: 'guide', academicAreaId: area.id, areaIds: [area.id] });
  const enBiblioteca = async (token, titulo) => ((await req('GET', `/library?q=${encodeURIComponent(titulo)}`, { token })).data?.items ?? []).find((r) => r.title === titulo) ?? null;

  const conEnlace = await req('POST', '/learning-resources', { token: director.token, body: { ...base('enlace'), url: `https://docs.example.org/v5b6/${TS}/enlace` } });
  check(conEnlace.status === 201 && !conEnlace.data?.fileId, 'V5.6.1 D01 Con enlace y sin archivo: se publica', `${conEnlace.status}`);

  const PDF = Buffer.from(`%PDF-1.4\n1 0 obj << /Type /Catalog >> endobj\n% material ${TS}\n%%EOF\n`, 'latin1');
  const subido = await subirArchivo(director.token, PDF, 'guia-redes.pdf', 'application/pdf');
  const conArchivo = await req('POST', '/learning-resources', { token: director.token, body: { ...base('archivo'), fileId: subido.data?.id } });
  check(subido.status === 201 && conArchivo.status === 201 && conArchivo.data?.url === null && !!conArchivo.data?.fileUrl,
    'V5.6.2 D02 Con archivo y sin enlace: se publica', json({ up: subido.status, s: conArchivo.status, url: conArchivo.data?.url, f: conArchivo.data?.fileUrl }));
  const visto = await enBiblioteca(est[4].token, base('archivo').title);
  const leido = visto?.fileUrl ? await leerArchivo(est[4].token, visto.fileUrl) : { status: 0 };
  check(!!visto && visto.url === null && leido.status === 200 && !!leido.bytes?.equals(PDF),
    'V5.6.3 D02 En la Biblioteca se abre el material con la sesión; los bytes vienen del almacenamiento, no de PostgreSQL', json({ v: !!visto, s: leido.status, t: leido.tipo }));
  const columnas = await req('GET', '/learning-resources', { token: director.token });
  const fila = (columnas.data ?? []).find((r) => r.id === conArchivo.data?.id);
  check(!!fila && !('fileBytes' in fila) && !('data' in fila) && fila.fileName === 'guia-redes.pdf',
    'V5.6.4 D02 El recurso guarda solo la referencia y el nombre del archivo', json({ n: fila?.fileName }));
  const sinSesion = await fetch(`${API}${(conArchivo.data?.fileUrl ?? '').replace(/^\/api/, '')}`);
  check(sinSesion.status === 401, 'V5.6.5 El material no se abre por ruta pública, sin sesión', `${sinSesion.status}`);

  const nada = await req('POST', '/learning-resources', { token: director.token, body: base('vacio') });
  check(nada.status === 400 && !!nada.data?.fields?.url, 'V5.6.6 D03 Sin enlace ni archivo: error en el campo', json(nada.data?.fields));
  const quitar = await req('PATCH', `/learning-resources/${conEnlace.data?.id}`, { token: director.token, body: { url: null } });
  check(quitar.status === 400 && !!quitar.data?.fields?.url, 'V5.6.7 D03 Al editar tampoco se puede dejar sin enlace ni archivo', `${quitar.status}`);

  const MP4 = Buffer.concat([Buffer.from([0, 0, 0, 0x18]), Buffer.from('ftypmp42\0\0\0\0mp42isom', 'latin1'), Buffer.alloc(2048)]);
  const video = await subirArchivo(director.token, MP4, 'clase.mp4', 'video/mp4');
  check(video.status >= 400 && video.status < 500 && !video.data?.id, 'V5.6.8 D04 Un video no se sube (se usa su enlace)', `${video.status} ${json(video.data?.message)}`);
  const ajeno = await subirArchivo(est[3].token, PDF, 'mio.pdf', 'application/pdf');
  const robado = await req('POST', '/learning-resources', { token: director.token, body: { ...base('ajeno'), fileId: ajeno.data?.id } });
  check(robado.status === 400 && !!robado.data?.fields?.fileId, 'V5.6.9 No se publica como material un archivo que subió otra persona', `${robado.status}`);

  const dirigido = await req('POST', '/learning-resources', {
    token: director.token, body: { ...base('dirigido'), url: `https://docs.example.org/v5b6/${TS}/dirigido`, semesterScope: [3, 5] },
  });
  const ven = await Promise.all([3, 4, 5].map(async (n) => !!(await enBiblioteca(est[n].token, base('dirigido').title))));
  check(dirigido.status === 201 && JSON.stringify(dirigido.data?.semesterScope) === '[3,5]' && JSON.stringify(ven) === '[true,false,true]',
    'V5.6.10 D05 Dirección elige 3.º y 5.º: solo esos estudiantes lo ven', json({ s: dirigido.status, sc: dirigido.data?.semesterScope, ven }));
  const aTodos = await req('PATCH', `/learning-resources/${dirigido.data?.id}`, { token: director.token, body: { semesterScope: [] } });
  check(aTodos.status === 200 && (aTodos.data?.semesterScope ?? []).length === 0 && !!(await enBiblioteca(est[4].token, base('dirigido').title)),
    'V5.6.11 D05 Y puede pasarlo a toda la carrera después', `${aTodos.status}`);

  const fuera = await req('POST', '/learning-resources', {
    token: docente.token, body: { ...base('fuera'), url: `https://docs.example.org/v5b6/${TS}/fuera`, semesterScope: [8] },
  });
  check(fuera.status === 403 && !!fuera.data?.fields?.semesterScope, 'V5.6.12 D06 Un docente de 2.º no publica para 8.º (403)', `${fuera.status}`);
  const subidoDoc = await subirArchivo(docente.token, PDF, 'propuesta.pdf', 'application/pdf');
  const propuesta = await req('POST', '/learning-resources', { token: docente.token, body: { ...base('propuesta'), fileId: subidoDoc.data?.id } });
  const antesDeAprobar = propuesta.data?.fileUrl ? await leerArchivo(est[3].token, propuesta.data.fileUrl) : { status: 0 };
  check(propuesta.status === 201 && propuesta.data?.reviewStatus === 'pending' && [403, 404].includes(antesDeAprobar.status),
    'V5.6.13 El archivo de una propuesta que Dirección no aprobó no lo abre un estudiante', json({ s: propuesta.status, r: propuesta.data?.reviewStatus, l: antesDeAprobar.status }));

  const curso = await req('POST', '/learning-resources', {
    token: director.token, body: { ...base('curso'), resourceType: 'external_course', url: `https://docs.example.org/v5b6/${TS}/curso` },
  });
  const cursoVisto = await enBiblioteca(est[4].token, base('curso').title);
  check(curso.status === 201 && cursoVisto?.resourceTypeLabel === 'Curso de autoaprendizaje (sin acreditación automática)',
    'V5.6.14 §8 Un curso libre se rotula «Curso de autoaprendizaje (sin acreditación automática)»', json(cursoVisto?.resourceTypeLabel));

  const puntos = async (token) => (await req('GET', '/gamification/me', { token })).data?.totalPoints ?? 0;
  const afinidad = async (token) => ((await req('GET', '/affinity/me/summary', { token })).data?.areas ?? []).reduce((s, a) => s + (a.rawPoints ?? 0), 0);
  const antes = [await puntos(est[4].token), await afinidad(est[4].token)];
  const fav = await req('PUT', `/library/${conArchivo.data?.id}/favorite`, { token: est[4].token });
  await leerArchivo(est[4].token, conArchivo.data?.fileUrl ?? '');
  await req('POST', '/affinity/recalculate/me', { token: est[4].token });
  const despues = [await puntos(est[4].token), await afinidad(est[4].token)];
  check([200, 201, 204].includes(fav.status) && JSON.stringify(antes) === JSON.stringify(despues),
    'V5.6.15 D07 Guardar en favoritos y abrir el material no da puntos ni afinidad', json({ fav: fav.status, antes, despues }));
}

// ===========================================================================
//  BATCH V5-7 — Autonomía docente por módulo (§9.2, E01…E04, E08)
// ===========================================================================
const psql = (sql) => execSync(
  `docker exec perfil_postgres psql -U ${process.env.POSTGRES_USER ?? 'perfil_user'} -d ${process.env.POSTGRES_DB ?? 'perfil_estudiantil'} -tAc "${sql.replace(/"/g, '\\"')}"`,
  { encoding: 'utf8' },
).trim();

async function batch7(ctx) {
  objective('BATCH V5-7 · REQUIRE_REVIEW por defecto; Dirección concede y revoca autonomía por docente y módulo');
  const director = await provisionAndActivate(ctx.admin, { firstName: 'Dora', lastName: `Autonomia${L}`, email: correoStaff('b7dir'), role: 'CAREER_DIRECTOR' });
  const docente = await provisionAndActivate(ctx.admin, { firstName: 'Ciro', lastName: `Autonomia${L}`, email: correoStaff('b7doc'), role: 'TEACHER' });
  const sociedad = await provisionAndActivate(ctx.admin, { firstName: 'Sara', lastName: `Autonomia${L}`, email: correoStaff('b7soc'), role: 'SCIENTIFIC_SOCIETY' });
  await req('PUT', `/users/${docente.userId}/semesters`, { token: ctx.admin, body: { semesters: [5] } });
  const est = await provisionStudent(ctx.admin, { firstName: 'Eva', lastName: `Autonomia${L}`, email: correoEst('b7est'), semester: 5 });
  est.profileId = (await req('GET', '/profiles/me', { token: est.token })).data?.id;
  const area = ((await req('GET', '/academic-areas', { token: director.token })).data ?? [])[0];
  const recurso = (k) => ({
    title: `Material autonomo ${k} ${L}`, provider: 'Carrera de Sistemas', resourceType: 'guide',
    academicAreaId: area.id, areaIds: [area.id], url: `https://docs.example.org/v5b7/${TS}/${k}`,
  });
  const enBiblioteca = async (titulo) => ((await req('GET', `/library?q=${encodeURIComponent(titulo)}`, { token: est.token })).data?.items ?? []).some((r) => r.title === titulo);
  const pendientesRecursos = async () => ((await req('GET', '/learning-resources/reviews/pending', { token: director.token })).data ?? []).map((r) => r.title);

  const porDefecto = await req('GET', '/approval-policies/me', { token: docente.token });
  const r1 = await req('POST', '/learning-resources', { token: docente.token, body: recurso('antes') });
  check(porDefecto.data?.RESOURCE === 'REQUIRE_REVIEW' && porDefecto.data?.GAMIFICATION === 'REQUIRE_REVIEW' && porDefecto.data?.ACTIVITY === 'REQUIRE_REVIEW'
    && r1.data?.reviewStatus === 'pending' && !(await enBiblioteca(recurso('antes').title)) && (await pendientesRecursos()).includes(recurso('antes').title),
    'V5.7.1 E01 Sin excepción, el recurso del docente queda pendiente y va a la bandeja', json({ p: porDefecto.data, r: r1.data?.reviewStatus }));

  const datos = { teacherUserId: docente.userId, module: 'RESOURCE', justification: 'Coordina la materia en los paralelos A, B y C.' };
  const porAdmin = await req('POST', '/approval-policies', { token: ctx.admin, body: datos });
  const porDocente = await req('POST', '/approval-policies', { token: docente.token, body: datos });
  check(porAdmin.status === 403 && porDocente.status === 403, 'V5.7.2 §10.2 Solo Dirección concede: Administración y el propio docente no', `${porAdmin.status} / ${porDocente.status}`);
  const actividad = await req('POST', '/approval-policies', { token: director.token, body: { ...datos, module: 'ACTIVITY' } });
  check(actividad.status === 400 && actividad.data?.code === 'ACTIVITY_OVERRIDE_NOT_ENABLED',
    'V5.7.3 §9.2 Las actividades siguen con revisión obligatoria: no se concede excepción', `${actividad.status} ${actividad.data?.code}`);
  const aSociedad = await req('POST', '/approval-policies', { token: director.token, body: { ...datos, teacherUserId: sociedad.userId } });
  check(aSociedad.status === 400 && aSociedad.data?.code === 'POLICY_TEACHER_ONLY', 'V5.7.4 E08 La sociedad científica no recibe ni hereda excepciones docentes', `${aSociedad.status} ${aSociedad.data?.code}`);
  const sinMotivo = await req('POST', '/approval-policies', { token: director.token, body: { ...datos, justification: 'porque' } });
  check(sinMotivo.status === 400 && !!sinMotivo.data?.fields?.justification, 'V5.7.5 La excepción exige un motivo, en su campo', `${sinMotivo.status}`);

  const concedida = await req('POST', '/approval-policies', { token: director.token, body: datos });
  const repetida = await req('POST', '/approval-policies', { token: director.token, body: datos });
  check(concedida.status === 201 && concedida.data?.grantedBy && repetida.status === 409,
    'V5.7.6 Dirección concede autonomía en recursos (con quién y cuándo); no se duplica', `${concedida.status} / ${repetida.status}`);
  const ahora = await req('GET', '/approval-policies/me', { token: docente.token });
  const r2 = await req('POST', '/learning-resources', { token: docente.token, body: recurso('directo') });
  check(ahora.data?.RESOURCE === 'DIRECT_ALLOWED' && ahora.data?.GAMIFICATION === 'REQUIRE_REVIEW' && r2.status === 201 && r2.data?.reviewStatus === 'not_required'
    && r2.data?.policyId === concedida.data?.id && (await enBiblioteca(recurso('directo').title)) && !(await pendientesRecursos()).includes(recurso('directo').title),
    'V5.7.7 E02 Con la excepción publica directo: llega a la Biblioteca y no a la bandeja; puntos sigue con revisión', json({ m: ahora.data, r: r2.data?.reviewStatus }));
  const historial = (await req('GET', '/approval-policies/direct-actions', { token: director.token })).data ?? [];
  const accion = historial.find((a) => a.module === 'RESOURCE' && a.id === r2.data?.id);
  const auditoria = psql(`select count(*) from audit_events where event_type = 'RESOURCE_PUBLISHED_DIRECT' and entity_id = '${r2.data?.id}' and actor_user_id = '${docente.userId}'`);
  check(!!accion && accion.teacherUserId === docente.userId && accion.policyId === concedida.data?.id && auditoria === '1',
    'V5.7.8 §9.3 Dirección ve la acción directa en su historial, auditada con actor y excepción', json({ a: !!accion, auditoria }));
  const ajustada = await req('PATCH', `/learning-resources/${r2.data?.id}`, { token: docente.token, body: { description: 'Material revisado por el docente.' } });
  check(ajustada.status === 200 && ajustada.data?.reviewStatus === 'not_required', 'V5.7.9 Ajusta lo que publicó con su autonomía sin volver a la bandeja', `${ajustada.status} ${ajustada.data?.reviewStatus}`);

  const puntos = await req('POST', '/approval-policies', { token: director.token, body: { ...datos, module: 'GAMIFICATION', justification: 'Incentivos acordados para la materia de quinto.' } });
  const proy = await req('POST', '/projects', {
    token: est.token, body: { title: `Robot autonomo ${L}`, description: 'Robot que esquiva obstáculos con sensores ultrasónicos.', visibility: 'teachers', status: 'draft' },
  });
  psql(`update projects set backing_tier='supported' where id='${proy.data?.id}'`);
  const criterio = ((await req('GET', '/gamification-criteria/available?trigger=proyecto_corroborado', { token: docente.token })).data ?? [])[0];
  const antes = (await req('GET', '/gamification/me', { token: est.token })).data?.totalPoints ?? 0;
  const otorgada = await req('POST', '/gamification/proposals', {
    token: docente.token, body: { projectId: proy.data?.id, studentProfileId: est.profileId, criterionId: criterio?.id, reason: 'Integró sensores y control con evidencia propia.' },
  });
  const despues = (await req('GET', '/gamification/me', { token: est.token })).data?.totalPoints ?? 0;
  const bandeja = ((await req('GET', '/gamification/proposals?status=pending', { token: director.token })).data ?? []).map((p) => p.id);
  check(puntos.status === 201 && otorgada.status === 201 && otorgada.data?.status === 'approved' && otorgada.data?.direct === true
    && despues - antes === criterio?.points && !bandeja.includes(otorgada.data?.id),
    'V5.7.10 E02 Con autonomía en puntos, el docente otorga directo: entran una vez y no van a la bandeja', json({ s: otorgada.status, st: otorgada.data?.status, d: despues - antes, p: criterio?.points }));
  const respaldo = psql(`select backing_tier from projects where id='${proy.data?.id}'`);
  check(respaldo === 'supported', 'V5.7.11 E06 Otorgar puntos no cambia el respaldo del proyecto', respaldo);

  const revocarSinMotivo = await req('POST', `/approval-policies/${concedida.data?.id}/revoke`, { token: director.token, body: { reason: '' } });
  const revocada = await req('POST', `/approval-policies/${concedida.data?.id}/revoke`, { token: director.token, body: { reason: 'Cambio de coordinación de la materia.' } });
  const r3 = await req('POST', '/learning-resources', { token: docente.token, body: recurso('despues') });
  const sigue = await enBiblioteca(recurso('directo').title);
  const politicas = (await req('GET', '/approval-policies?includeRevoked=true', { token: director.token })).data ?? [];
  const fila = politicas.find((p) => p.id === concedida.data?.id);
  check(revocarSinMotivo.status === 400 && revocada.status === 200 && r3.data?.reviewStatus === 'pending' && sigue && !!fila?.revokedAt && !!fila?.revokedBy,
    'V5.7.12 E03 Al revocar, lo nuevo vuelve a revisión; lo ya publicado se conserva y la revocación queda registrada',
    json({ rv: revocada.status, r3: r3.data?.reviewStatus, sigue, f: !!fila?.revokedAt }));
  const reajuste = await req('PATCH', `/learning-resources/${r2.data?.id}`, { token: docente.token, body: { description: 'Otra versión del material.' } });
  check(reajuste.status === 200 && reajuste.data?.reviewStatus === 'pending', 'V5.7.13 E03 Sin la excepción, ajustar lo publicado vuelve a pasar por Dirección', `${reajuste.status} ${reajuste.data?.reviewStatus}`);
  const otraVez = await req('POST', `/approval-policies/${concedida.data?.id}/revoke`, { token: director.token, body: { reason: 'Otra vez.' } });
  check(otraVez.status === 409, 'V5.7.14 Una excepción revocada no se revoca dos veces', `${otraVez.status}`);

  const filtrado = (await req('GET', `/approval-policies/direct-actions?teacherUserId=${docente.userId}`, { token: director.token })).data ?? [];
  const estudianteVe = await req('GET', '/approval-policies', { token: est.token });
  check(filtrado.length >= 2 && filtrado.every((a) => a.teacherUserId === docente.userId) && filtrado.some((a) => a.module === 'GAMIFICATION' && a.student)
    && estudianteVe.status === 403,
    'V5.7.15 E04 Dirección filtra el historial por docente (recursos y puntos, con estudiante); un estudiante no lo ve', json({ n: filtrado.length, e: estudianteVe.status }));
}

// ===========================================================================
//  BATCH V5-8 — Gamificación: tres familias e historial detallado (§10, E05…E07, D08)
// ===========================================================================
async function batch8(ctx) {
  objective('BATCH V5-8 · Tres familias de puntos; cada punto dice criterio, origen, quién otorgó y quién aprobó');
  const director = await provisionAndActivate(ctx.admin, { firstName: 'Dora', lastName: `Familias${L}`, email: correoStaff('b8dir'), role: 'CAREER_DIRECTOR' });
  const docente = await provisionAndActivate(ctx.admin, { firstName: 'Ciro', lastName: `Familias${L}`, email: correoStaff('b8doc'), role: 'TEACHER' });
  const ajeno = await provisionAndActivate(ctx.admin, { firstName: 'Iris', lastName: `Familias${L}`, email: correoStaff('b8ajeno'), role: 'TEACHER' });
  await req('PUT', `/users/${docente.userId}/semesters`, { token: ctx.admin, body: { semesters: [6] } });
  await req('PUT', `/users/${ajeno.userId}/semesters`, { token: ctx.admin, body: { semesters: [2] } });
  const est = await provisionStudent(ctx.admin, { firstName: 'Eva', lastName: `Familias${L}`, email: correoEst('b8est'), semester: 6 });
  est.profileId = (await req('GET', '/profiles/me', { token: est.token })).data?.id;
  const area = ((await req('GET', '/academic-areas', { token: director.token })).data ?? [])[0];
  const puntos = async () => (await req('GET', '/gamification/me', { token: est.token })).data?.totalPoints ?? 0;
  const historial = async (token = director.token) => req('GET', `/gamification/students/${est.profileId}/history`, { token });

  // --- §10: los criterios nuevos solo usan las tres familias
  const retirado = await req('POST', '/gamification-criteria', {
    token: director.token, body: { code: `colab_${TS}`, name: 'Colaborar', trigger: 'colaboracion_aceptada', points: 5, academicAreaId: area.id },
  });
  const deRecurso = await req('POST', '/gamification-criteria', {
    token: director.token, body: { code: `recurso_${TS}`, name: `Completó la guía ${L}`, trigger: 'recurso_completado_atestiguado', points: 12, academicAreaId: area.id },
  });
  check(retirado.status >= 400 && retirado.status < 500 && !!retirado.data?.fields?.trigger && deRecurso.status === 201,
    'V5.8.1 §10 Un criterio nuevo solo usa las tres familias: «colaboración aceptada» está retirada; «recurso completado» sí', `${retirado.status} / ${deRecurso.status}`);
  const disponibles = (await req('GET', '/gamification-criteria/available?trigger=recurso_completado_atestiguado', { token: docente.token })).data ?? [];
  check(disponibles.some((c) => c.id === deRecurso.data?.id) && disponibles.every((c) => c.trigger === 'recurso_completado_atestiguado'),
    'V5.8.2 El docente ve los criterios vigentes de recurso completado', json(disponibles.map((c) => c.code)));

  // --- E05: confirmar dos veces la misma asistencia es un solo evento, con quién la confirmó
  const cats = (await req('GET', '/activity-categories', { token: director.token })).data ?? [];
  const charla = cats.find((c) => c.appliesTo === 'academica') ?? cats[0];
  const act = await req('POST', '/activities', {
    token: director.token,
    body: { title: `Charla con puntos ${L}`, type: 'academica', categoryId: charla.id, semesterScope: [6], activityDate: en(48), endAt: en(50), status: 'open' },
  });
  await req('POST', `/activities/${act.data?.id}/register`, { token: est.token });
  await req('PATCH', `/activities/${act.data?.id}`, { token: director.token, body: { activityDate: en(-1), endAt: en(2) } });
  const antesAsistir = await puntos();
  const c1 = await decidir(director.token, act.data?.id, est.profileId, 'confirmed');
  const c2 = await decidir(director.token, act.data?.id, est.profileId, 'confirmed');
  const trasAsistir = await puntos();
  const h1 = (await historial()).data;
  const deAsistencia = (h1?.items ?? []).filter((i) => i.origin?.type === 'activity' && i.origin?.id === act.data?.id && i.points > 0);
  check(c1.status === 200 && [200, 409].includes(c2.status) && deAsistencia.length === 1 && trasAsistir - antesAsistir === deAsistencia[0]?.points,
    'V5.8.3 E05 Confirmar dos veces la misma asistencia da un solo evento de puntos', json({ c1: c1.status, c2: c2.status, n: deAsistencia.length, d: trasAsistir - antesAsistir }));
  check(deAsistencia[0]?.awardedBy === `Dora Familias${L}` && !!deAsistencia[0]?.criterion && deAsistencia[0]?.status === 'APPLIED',
    'V5.8.4 §10.3 El evento dice quién confirmó la asistencia, con qué criterio y que está aplicado', json(deAsistencia[0]));

  // --- E07 / D08: un recurso completado solo suma cuando un docente da fe
  const PDF = Buffer.from(`%PDF-1.4\n1 0 obj << /Type /Catalog >> endobj\n% guia ${TS}\n%%EOF\n`, 'latin1');
  const subido = await subirArchivo(director.token, PDF, 'guia-completar.pdf', 'application/pdf');
  const malCriterio = await req('POST', '/learning-resources', {
    token: director.token,
    body: { title: `Guía mal criterio ${L}`, provider: 'Carrera', resourceType: 'practice', academicAreaId: area.id, areaIds: [area.id], fileId: subido.data?.id, criterionId: act.data?.id },
  });
  const recurso = await req('POST', '/learning-resources', {
    token: director.token,
    body: { title: `Guía para completar ${L}`, provider: 'Carrera', resourceType: 'practice', academicAreaId: area.id, areaIds: [area.id], fileId: subido.data?.id, criterionId: deRecurso.data?.id },
  });
  const sinCriterio = await req('POST', '/learning-resources', {
    token: director.token,
    body: { title: `Guía sin puntos ${L}`, provider: 'Carrera', resourceType: 'guide', academicAreaId: area.id, areaIds: [area.id], url: `https://docs.example.org/v5b8/${TS}/sin` },
  });
  check(malCriterio.status === 400 && !!malCriterio.data?.fields?.criterionId && recurso.status === 201 && recurso.data?.criterionId === deRecurso.data?.id,
    'V5.8.5 §8.3 El recurso lleva un criterio opcional, y solo de «recurso completado»', `${malCriterio.status} / ${recurso.status}`);
  const antesAbrir = await puntos();
  await req('PUT', `/library/${recurso.data?.id}/favorite`, { token: est.token });
  await leerArchivo(est.token, recurso.data?.fileUrl ?? '');
  await req('GET', '/gamification/me', { token: est.token });
  check(await puntos() === antesAbrir, 'V5.8.6 E07 Guardar en favoritos y descargar el recurso no lo da por completado', `${antesAbrir} → ${await puntos()}`);

  const atestiguar = (quien, extra = {}) => req('POST', '/gamification/proposals', {
    token: quien.token,
    body: { resourceId: recurso.data?.id, studentProfileId: est.profileId, criterionId: deRecurso.data?.id, reason: 'Entregó la práctica resuelta en clase el martes.', ...extra },
  });
  const deEstudiante = await atestiguar(est);
  const fueraDeAlcance = await atestiguar(ajeno);
  const sinSustento = await atestiguar(docente, { reason: 'listo' });
  const recursoSinCriterio = await atestiguar(docente, { resourceId: sinCriterio.data?.id });
  const ambos = await req('POST', '/gamification/proposals', {
    token: docente.token, body: { resourceId: recurso.data?.id, projectId: recurso.data?.id, studentProfileId: est.profileId, criterionId: deRecurso.data?.id, reason: 'Entregó la práctica resuelta.' },
  });
  check(deEstudiante.status === 403 && fueraDeAlcance.status === 404 && sinSustento.status === 400
    && recursoSinCriterio.status === 400 && recursoSinCriterio.data?.code === 'RESOURCE_WITHOUT_CRITERION' && ambos.status === 400,
    'V5.8.7 D08 Solo un docente con el estudiante en su alcance, con sustento y sobre un recurso con criterio',
    `${deEstudiante.status} / ${fueraDeAlcance.status} / ${sinSustento.status} / ${recursoSinCriterio.status}:${recursoSinCriterio.data?.code} / ${ambos.status}`);

  const propuesta = await atestiguar(docente);
  const hPend = (await historial()).data;
  const pendiente = (hPend?.items ?? []).find((i) => i.id === propuesta.data?.id);
  check(propuesta.status === 201 && propuesta.data?.status === 'pending' && propuesta.data?.sourceType === 'resource'
    && propuesta.data?.resource?.id === recurso.data?.id && pendiente?.status === 'PENDING' && await puntos() === antesAbrir,
    'V5.8.8 D08 Sin autonomía, el docente propone: queda pendiente y figura como «pendiente» en el historial', json({ s: propuesta.status, st: propuesta.data?.status, h: pendiente?.status }));
  const aprobada = await req('POST', `/gamification/proposals/${propuesta.data?.id}/review`, { token: director.token, body: { decision: 'approve' } });
  const despues = await puntos();
  const hFin = (await historial()).data;
  const evento = (hFin?.items ?? []).find((i) => i.origin?.type === 'resource' && i.origin?.id === recurso.data?.id && i.status === 'APPLIED');
  check(aprobada.status === 200 && despues - antesAbrir === 12 && evento?.points === 12 && evento?.criterion === `Completó la guía ${L}`
    && evento?.awardedBy === `Ciro Familias${L}` && evento?.approvedBy === `Dora Familias${L}` && evento?.origin?.title === `Guía para completar ${L}`,
    'V5.8.9 §10.3 Aprobado: suma una vez, y el historial dice criterio, recurso, quién dio fe y quién aprobó', json(evento));
  const otraVez = await atestiguar(docente);
  check(otraVez.status === 409, 'V5.8.10 §10.3 El mismo recurso no se premia dos veces al mismo estudiante', `${otraVez.status}`);

  // --- Quién ve el historial
  const delDocente = await historial(docente.token);
  const delAjeno = await historial(ajeno.token);
  const delEstudiante = await historial(est.token);
  check(delDocente.status === 200 && delAjeno.status === 403 && delEstudiante.status === 403,
    'V5.8.11 §10.3 El docente ve el historial de su alcance; otro docente y el propio estudiante no (sin ranking)',
    `${delDocente.status} / ${delAjeno.status} / ${delEstudiante.status}`);
  const vista = (await req('GET', '/gamification/me', { token: est.token })).data;
  check((vista?.rules ?? []).every((r) => ['participacion_confirmada', 'proyecto_corroborado', 'recurso_completado_atestiguado'].includes(r.trigger)),
    'V5.8.12 §10 Al estudiante se le explican solo las tres familias que dan puntos', json((vista?.rules ?? []).map((r) => r.trigger)));
}

// ===========================================================================
//  BATCH V5-9 — Alta guiada por GitHub, nunca obligatoria (§11, F01…F06, F12)
// ===========================================================================
async function batch9(ctx) {
  objective('BATCH V5-9 · «Analizar repositorio» ofrece; el borrador nunca depende de GitHub');
  await asegurarGithubSimulado();
  const est = await provisionStudent(ctx.admin, { firstName: 'Gael', lastName: `Analisis${L}`, email: correoEst('b9e1'), semester: 5 });
  const docente = await provisionAndActivate(ctx.admin, { firstName: 'Tea', lastName: `Analisis${L}`, email: correoStaff('b9doc'), role: 'TEACHER' });
  const analizar = (url, token = est.token) => req('POST', '/projects/repository/analyze', { token, body: { repositoryUrl: url } });
  const mios = async () => ((await req('GET', '/projects/my', { token: est.token })).data ?? []).length;

  const borrador = await req('POST', '/projects', { token: est.token, body: { title: `Borrador sin repositorio ${L}`, status: 'draft' } });
  check(borrador.status === 201 && borrador.data?.status === 'draft', 'V5.9.1 F01 Sin repositorio, el borrador se guarda igual', `${borrador.status}`);

  const antes = await mios();
  const url = repoDePrueba(`pymongo-alta-${TS}`);
  const a1 = await analizar(url);
  const mongo = (a1.data?.suggestions ?? []).find((s) => /mongo/i.test(s.skill?.name ?? ''));
  check(a1.status === 200 && a1.data?.status === 'ANALYZED' && !!mongo && /requirements\.txt/.test(`${mongo.source ?? ''} ${mongo.why ?? ''}`) && (mongo.areas ?? []).length > 0,
    'V5.9.2 F02/F03 Analizar un repositorio público sugiere tecnologías del catálogo con su fuente (PyMongo → MongoDB)',
    json({ s: a1.data?.status, sug: (a1.data?.suggestions ?? []).map((x) => `${x.skill?.name}:${x.source}`) }));
  check(await mios() === antes, 'V5.9.3 F12 Analizar no guarda nada ni agrega tecnologías por su cuenta', `${antes} → ${await mios()}`);
  const a2 = await analizar(url);
  const ids = (r) => (r.data?.suggestions ?? []).map((s) => s.skill.id).sort();
  check(a2.status === 200 && JSON.stringify(ids(a1)) === JSON.stringify(ids(a2)) && new Set(ids(a2)).size === ids(a2).length,
    'V5.9.4 F05 Volver a analizar el mismo repositorio no duplica sugerencias', json({ a: ids(a1).length, b: ids(a2).length }));

  const area = mongo?.areas?.find((x) => x.primary) ?? mongo?.areas?.[0];
  const conSugerida = await req('POST', '/projects', {
    token: est.token,
    body: {
      title: `API con Mongo ${L}`, status: 'draft', repositoryUrl: url,
      areaIds: [area?.id], skillIds: [mongo?.skill?.id], skillContexts: [{ skillId: mongo?.skill?.id, areaId: area?.id }],
      skillSources: [{ skillId: mongo?.skill?.id, source: mongo?.why ?? 'requirements.txt' }],
    },
  });
  const procedencia = psql(`select provenance from project_skills where project_id = '${conSugerida.data?.id}' and skill_id = '${mongo?.skill?.id}'`);
  check(conSugerida.status === 201 && /^sugerida: /.test(procedencia),
    'V5.9.5 §11.1 Lo que el estudiante aceptó del análisis queda con su procedencia («sugerida: …»)', `${conSugerida.status} ${procedencia}`);

  const mala = await analizar('no es un enlace');
  const otro = await analizar('https://gitlab.com/afinia-pruebas/proyecto');
  const privado = await analizar(repoDePrueba(`privado-${TS}`));
  const noExiste = await analizar(repoDePrueba(`inexistente-${TS}`));
  const deDocente = await analizar(url, docente.token);
  check(mala.status === 400 && !!mala.data?.fields?.repositoryUrl && otro.data?.status === 'NOT_GITHUB'
    && privado.data?.status === 'UNAVAILABLE' && noExiste.data?.status === 'UNAVAILABLE' && deDocente.status === 403,
    'V5.9.6 Enlace inválido en su campo; otro proveedor, privado o inexistente se explican sin inventar; solo estudiantes',
    json({ m: mala.status, o: otro.data?.status, p: privado.data?.status, n: noExiste.data?.status, d: deDocente.status }));

  // F06 al final: la cuota agotada abre una ventana corta en la que no se consulta GitHub.
  const skillsAntes = psql(`select count(*) from project_skills where project_id = '${conSugerida.data?.id}'`);
  const cuota = await analizar(repoDePrueba(`cuota-${TS}`));
  const skillsDespues = psql(`select count(*) from project_skills where project_id = '${conSugerida.data?.id}'`);
  check(cuota.status === 200 && cuota.data?.status === 'INCONCLUSIVE' && !!cuota.data?.message && skillsAntes === skillsDespues,
    'V5.9.7 F06 Con la cuota de GitHub agotada el análisis es INCONCLUSIVE y no se borra nada de lo declarado',
    json({ s: cuota.data?.status, m: cuota.data?.message, antes: skillsAntes, despues: skillsDespues }));
  await new Promise((r) => setTimeout(r, 2500));
}

// ===========================================================================
//  BATCH V5-4 — Inscripción, admisión y asistencia (§6, C01…C08, E05)
// ===========================================================================
async function batch4(ctx) {
  objective('BATCH V5-4 · Solicitar, ser admitido y asistir son tres cosas (§6)');
  const director = await provisionAndActivate(ctx.admin, { firstName: 'Diana', lastName: `Admision${L}`, email: correoStaff('b4dir'), role: 'CAREER_DIRECTOR' });
  const [e1, e2, e3] = await Promise.all(['b4e1', 'b4e2', 'b4e3'].map((k, i) =>
    provisionStudent(ctx.admin, { firstName: ['Ana', 'Beto', 'Ciro'][i], lastName: `Cupo${L}`, email: correoEst(k), semester: 3 })));
  const cats = (await req('GET', '/activity-categories', { token: director.token })).data ?? [];
  const charla = cats.find((c) => c.appliesTo === 'academica') ?? cats[0];
  const crear = (titulo, extra = {}) => req('POST', '/activities', {
    token: director.token,
    body: { title: `${titulo} ${L}`, type: 'academica', categoryId: charla.id, semesterScope: [3], activityDate: en(48), endAt: en(50), status: 'open', ...extra },
  });
  const participantes = async (id) => (await req('GET', `/activities/${id}/participants`, { token: director.token })).data ?? [];
  const estadoDe = async (id, perfil) => (await participantes(id)).find((r) => r.studentProfileId === perfil)?.status;

  // --- C06: abierta y sin cupo → admisión automática, asistencia pendiente
  const abierta = await crear('Charla abierta');
  const ins = await req('POST', `/activities/${abierta.data?.id}/register`, { token: e1.token });
  check(abierta.status === 201 && ins.status === 201 && ins.data?.status === 'accepted',
    'V5.4.1 C06 Abierta y sin cupo: quien se inscribe queda admitido al instante', `${abierta.status} / ${ins.status} ${ins.data?.status}`);
  const tray = (await req('GET', '/trajectory/me', { token: e1.token })).data;
  const entrada = (tray?.entries ?? []).find((x) => x.id === abierta.data?.id);
  check(!entrada || entrada.cvEligible !== true, 'V5.4.2 C06 Admitido no es haber asistido: no entra al currículo', json(entrada));

  // --- C01/C02: con cupo → solicitud pendiente; admitir no es asistir
  const conCupo = await crear('Taller con cupo', { capacity: 1 });
  const id = conCupo.data?.id;
  const r1 = await req('POST', `/activities/${id}/register`, { token: e1.token });
  const r2 = await req('POST', `/activities/${id}/register`, { token: e2.token });
  const r3 = await req('POST', `/activities/${id}/register`, { token: e3.token });
  check([r1, r2, r3].every((r) => r.status === 201 && r.data?.status === 'registered'),
    'V5.4.3 C01 Con cupo, cada solicitud queda pendiente (no ocupa plaza ni es asistencia)', [r1, r2, r3].map((r) => `${r.status}:${r.data?.status}`).join(' '));

  // --- C03: no se registra asistencia antes del evento
  const antes = await decidir(director.token, id, e1.profileId, 'confirmed');
  check(antes.status === 409 && antes.data?.code === 'ATTENDANCE_BEFORE_START',
    'V5.4.4 C03 La asistencia no se registra antes de que empiece el evento', `${antes.status} ${antes.data?.code}`);

  // --- C05: dos admisiones simultáneas con cupo 1 → solo una
  const [a1, a2] = await Promise.all([
    decidir(director.token, id, e1.profileId, 'accepted'),
    decidir(director.token, id, e2.profileId, 'accepted'),
  ]);
  const okAdm = [a1, a2].filter((r) => r.status === 200).length;
  const llenos = [a1, a2].filter((r) => r.status === 409 && r.data?.code === 'ACTIVITY_FULL').length;
  check(okAdm === 1 && llenos === 1, 'V5.4.5 C05 Cupo 1 con dos admisiones simultáneas: una entra y la otra recibe «cupo completo»',
    `${a1.status}:${a1.data?.code ?? a1.data?.status} ${a2.status}:${a2.data?.code ?? a2.data?.status}`);
  const filas = await participantes(id);
  check(filas.filter((r) => ['accepted', 'confirmed'].includes(r.status)).length === 1,
    'V5.4.6 C05 En la base hay exactamente una plaza ocupada', json(filas.map((r) => r.status)));
  const admitido = a1.status === 200 ? e1 : e2;
  const otro = a1.status === 200 ? e2 : e1;

  // --- C08: no admitir exige motivo, lo ve el estudiante, y no es ausencia
  const sinMotivo = await decidir(director.token, id, e3.profileId, 'rejected');
  check(sinMotivo.status === 400 && !!sinMotivo.data?.fields?.reason,
    'V5.4.7 C08 No admitir sin motivo se rechaza en su campo', `${sinMotivo.status} ${json(sinMotivo.data?.fields)}`);
  const rechazo = await decidir(director.token, id, e3.profileId, 'rejected', { reason: 'El taller es solo para quienes cursan Bases de Datos II.' });
  check(rechazo.status === 200 && rechazo.data?.status === 'rejected' && /Bases de Datos II/.test(rechazo.data?.decisionReason ?? ''),
    'V5.4.8 C08 La solicitud queda «No admitida» con su motivo (no «Ausente»)', `${rechazo.status} ${rechazo.data?.status}`);
  const avisos = (await req('GET', '/notifications/me', { token: e3.token })).data;
  const aviso = (avisos?.items ?? avisos ?? []).find?.((n) => n.type === 'ACTIVITY_REGISTRATION_REJECTED');
  check(!!aviso && /Bases de Datos II/.test(aviso.body ?? ''), 'V5.4.9 C08 El estudiante recibe el aviso con el motivo', json(aviso));
  const reinsc = await req('POST', `/activities/${id}/register`, { token: e3.token });
  check(reinsc.status === 400, 'V5.4.10 C08 Una solicitud no admitida no se reenvía sola', `${reinsc.status}`);

  // --- el evento empieza: ahora sí asistencia; sin admisión, no
  await req('PATCH', `/activities/${id}`, { token: director.token, body: { activityDate: en(-1), endAt: en(2) } });
  const sinAdmision = await decidir(director.token, id, otro.profileId, 'confirmed');
  check(sinAdmision.status === 409 && sinAdmision.data?.code === 'ATTENDANCE_REQUIRES_ADMISSION',
    'V5.4.11 §6 Sin admisión no hay asistencia, aunque el evento ya empezó', `${sinAdmision.status} ${sinAdmision.data?.code}`);
  const presente = await decidir(director.token, id, admitido.profileId, 'confirmed');
  check(presente.status === 200 && presente.data?.status === 'confirmed',
    'V5.4.12 C03 Con el evento empezado, el responsable registra la asistencia del admitido', `${presente.status} ${presente.data?.status}`);
  const cambiaAdmision = await decidir(director.token, id, admitido.profileId, 'rejected', { reason: 'Prueba de cambio tardío.' });
  check(cambiaAdmision.status === 409 && cambiaAdmision.data?.code === 'ADMISSION_AFTER_ATTENDANCE',
    'V5.4.13 §6 Registrada la asistencia, la admisión ya no se cambia por la vía ordinaria', `${cambiaAdmision.status} ${cambiaAdmision.data?.code}`);

  // --- C04: ausente no suma
  const abierta2 = await crear('Charla para ausencia');
  await req('POST', `/activities/${abierta2.data?.id}/register`, { token: e2.token });
  await req('PATCH', `/activities/${abierta2.data?.id}`, { token: director.token, body: { activityDate: en(-1), endAt: en(2) } });
  const ausente = await decidir(director.token, abierta2.data?.id, e2.profileId, 'absent');
  check(ausente.status === 200 && ausente.data?.status === 'absent', 'V5.4.14 C04 El responsable marca la ausencia de un admitido', `${ausente.status} ${ausente.data?.status}`);

  // --- interés ≠ inscripción
  const interesada = await crear('Charla de interés');
  await req('POST', `/activities/${interesada.data?.id}/register-interest`, { token: e3.token });
  const admitirInteres = await decidir(director.token, interesada.data?.id, e3.profileId, 'accepted');
  check(admitirInteres.status === 409 && admitirInteres.data?.code === 'NO_PENDING_REQUEST',
    'V5.4.15 §14.1 «Me interesa» no es una solicitud: no se admite ni reserva cupo', `${admitirInteres.status} ${admitirInteres.data?.code}`);

  // --- baja de una plaza admitida la libera
  const libre = await crear('Taller para baja', { capacity: 1 });
  await req('POST', `/activities/${libre.data?.id}/register`, { token: e1.token });
  await decidir(director.token, libre.data?.id, e1.profileId, 'accepted');
  const baja = await req('POST', `/activities/${libre.data?.id}/cancel-registration`, { token: e1.token });
  await req('POST', `/activities/${libre.data?.id}/register`, { token: e2.token });
  const ocupa = await decidir(director.token, libre.data?.id, e2.profileId, 'accepted');
  check(baja.status === 201 && ocupa.status === 200, 'V5.4.16 §6 Darse de baja de una plaza admitida la libera para otro', `${baja.status} / ${ocupa.status}`);

  check(await estadoDe(id, admitido.profileId) === 'confirmed', 'V5.4.17 El estado final del asistente se conserva', '');
}

// ===========================================================================
//  BATCH V5-5 — Afinia registra la participación; no certifica (§1, §7, H01…H04)
// ===========================================================================
async function batch5(ctx) {
  objective('BATCH V5-5 · Afinia registra la participación; no emite certificados (§1, §7)');
  const director = await provisionAndActivate(ctx.admin, { firstName: 'Dora', lastName: `Registro${L}`, email: correoStaff('b5dir'), role: 'CAREER_DIRECTOR' });
  const est = await provisionStudent(ctx.admin, { firstName: 'Elsa', lastName: `Tray${L}`, email: correoEst('b5e1'), semester: 3 });
  const cats = (await req('GET', '/activity-categories', { token: director.token })).data ?? [];
  const charla = cats.find((c) => c.appliesTo === 'academica') ?? cats[0];
  const base = { type: 'academica', categoryId: charla.id, semesterScope: [3], activityDate: en(48), endAt: en(50) };

  const conConstancia = await req('POST', '/activities', { token: director.token, body: { ...base, title: `Con constancia ${L}`, outcomePolicy: 'internal_constancy', __constanciaLiteral: true } });
  check(conConstancia.status === 400 && conConstancia.data?.code === 'CONSTANCY_ISSUANCE_DISABLED' && !!conConstancia.data?.fields?.outcomePolicy,
    'V5.5.1 §1.2 Una actividad nueva ya no puede prometer una constancia de Afinia (error en su campo)', `${conConstancia.status} ${conConstancia.data?.code}`);

  const act = await req('POST', '/activities', { token: director.token, body: { ...base, title: `Solo participación ${L}`, outcomePolicy: 'participation_only', status: 'open' } });
  await req('POST', `/activities/${act.data?.id}/register`, { token: est.token });
  await req('PATCH', `/activities/${act.data?.id}`, { token: director.token, body: { activityDate: en(-1), endAt: en(2) } });
  const asistio = await decidir(director.token, act.data?.id, est.profileId, 'confirmed');
  const mias = (await req('GET', '/constancies/internal/my', { token: est.token })).data ?? [];
  check(asistio.status === 200 && !mias.some((c) => c.activityId === act.data?.id),
    'V5.5.2 H02 Registrar la asistencia no genera ninguna constancia', `${asistio.status} · ${mias.length}`);

  const manual = await req('POST', '/constancies/internal', {
    token: director.token, body: { profileId: est.profileId, activityId: act.data?.id, description: 'Participó en la charla de prueba.' },
  });
  const mias2 = (await req('GET', '/constancies/internal/my', { token: est.token })).data ?? [];
  // 400 si la actividad nunca tuvo constancias; 403 CONSTANCY_ISSUANCE_DISABLED en una antigua que sí (Jest).
  check([400, 403].includes(manual.status) && !mias2.some((c) => c.activityId === act.data?.id),
    'V5.5.3 §7.2 Dirección tampoco emite constancias nuevas desde Afinia', `${manual.status} ${manual.data?.code} ${json(manual.data?.fields ?? manual.data?.errors)}`);

  const tray = (await req('GET', '/trajectory/me', { token: est.token })).data;
  const entrada = (tray?.entries ?? []).find((x) => x.id === act.data?.id);
  check(!!entrada && /responsable/.test(entrada.detail ?? '') && !/certific/i.test(entrada.detail ?? ''),
    'V5.5.4 H01 La trayectoria la presenta como registro del responsable, no como certificado', json(entrada));

  const res = await fetch(`${API}/trajectory-summary/pdf`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${est.token}` },
    body: JSON.stringify({ sections: ['academic_activities'], items: { academic_activities: [act.data?.id] } }),
  });
  const pdf = Buffer.from(await res.arrayBuffer()).toString('latin1');
  check(res.status === 201 && pdf.includes('borrador informativo') && pdf.includes('generado el') && pdf.includes('No constituye historial'),
    'V5.5.5 H04 El PDF dice que es un borrador informativo, con su fecha y el aviso de que no es oficial', `status ${res.status}`);
}

const BATCHES = { batch1, batch2, batch3, batch4, batch5, batch6, batch7, batch8, batch9, batch10, batch12 };

async function main() {
  console.log(`${C.bold}Afinia V5 — verificación del contrato contra la API${C.r}`);
  const ctx = { admin: await loginAdmin() };
  const pedidos = process.argv.slice(2);
  for (const [nombre, paso] of Object.entries(BATCHES)) {
    if (pedidos.length && !pedidos.includes(nombre)) continue;
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
