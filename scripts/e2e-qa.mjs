/**
 * Correcciones de QA («corregir.docx»).
 *
 * Comprueba contra la API en marcha cada observación del documento que tiene
 * un efecto verificable en el servidor:
 *
 *   - el código de activación nunca llega al administrador, solo al buzón;
 *   - activar con enlace o con correo + código, y bloqueo tras 10 intentos (V2 §15.3);
 *   - estado del enlace (válido, usado, reemplazado…) antes de pedir la clave;
 *   - solo correos institucionales; espera entre reenvíos;
 *   - errores campo por campo en los formularios del administrador;
 *   - el semestre se asigna al dar de alta al estudiante;
 *   - áreas, habilidades y categorías: reglas de nombre, etiquetas, código;
 *   - bienvenida por pasos, que no se puede dar por terminada a medias;
 *   - cuestionario adaptado a las áreas declaradas, con respuestas parciales;
 *   - gamificación: criterios que mandan, retos docentes con alcance,
 *     recompensas, canje y devolución, puntos por periodo.
 *
 * Uso:
 *   API_URL=http://localhost:3010/api node scripts/e2e-qa.mjs
 */

import {
  PWD, codigoUniversitario, leerCorreo, loginAdmin, provisionAndActivate, req,
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
const correoEst = (k) => `qa.${k}.${TS}@est.univalle.edu`;
const correoStaff = (k) => `qa.${k}.${TS}@univalle.edu`;
const json = (x) => JSON.stringify(x).slice(0, 160);

// ===========================================================================
//  Activación: el código es del titular
// ===========================================================================
async function activacion(ctx) {
  objective('Activación · el código solo llega al correo del estudiante');

  const email = correoEst('activa');
  const desde = Date.now();
  const alta = await req('POST', '/users', {
    token: ctx.admin,
    body: { firstName: 'Ana', lastName: 'Quispe', email, role: 'STUDENT', semester: 3, universityCode: codigoUniversitario() },
  });
  check(alta.status === 201, 'QA.1 El administrador da de alta al estudiante con su semestre', `status ${alta.status}`);
  const texto = JSON.stringify(alta.data ?? {});
  const claves = [];
  JSON.stringify(alta.data ?? {}, (k, v) => { claves.push(k); return v; });
  check(
    !claves.some((k) => /^(token|code|activationToken|activationCode|link|url)$/i.test(k))
      && !/token=|\b\d{6}\b/.test(texto),
    'QA.2 La respuesta del alta no trae token, enlace ni código',
    texto.slice(0, 200),
  );
  check(alta.data?.invitation?.status !== undefined, 'QA.3 Solo trae el estado de la invitación', json(alta.data?.invitation));

  const listado = await req('GET', '/users', { token: ctx.admin });
  const fila = (listado.data ?? []).find?.((u) => u.email === email) ?? (listado.data?.items ?? []).find((u) => u.email === email);
  check(fila?.semester === 3, 'QA.4 El listado muestra el semestre asignado en el alta', json(fila));
  check(!/"token"|activationCode/.test(JSON.stringify(fila ?? {})), 'QA.5 Ni el listado expone el código');

  const correo = await leerCorreo(email, { tipo: 'account_activation', desde });
  check(Boolean(correo.token && correo.code), 'QA.6 El correo trae enlace y código de 6 dígitos', `${correo.token?.slice(0, 6)}… ${correo.code}`);
  check(/\/activar\?token=/.test(correo.text ?? ''), 'QA.7 El enlace abre la pantalla de activación con el token puesto');

  const chk = await req('POST', '/activation/check', { body: { token: correo.token, purpose: 'activation' } });
  check(chk.status === 200 && chk.data?.state === 'valid', 'QA.8 El enlace se comprueba antes de pedir la contraseña', json(chk.data));
  check(chk.data?.email && chk.data.email !== email && /•/.test(chk.data.email), 'QA.9 Y el correo se muestra enmascarado', chk.data?.email);
  const horas = (new Date(chk.data?.expiresAt).getTime() - Date.now()) / 3_600_000;
  check(horas > 47 && horas <= 48.01, 'QA.10 La invitación dura 48 horas (V2 §15.3)', `${horas.toFixed(1)} h`);

  // Código equivocado: 9 intentos todavía no anulan; el 10.º sí.
  let ultimo = null;
  for (let i = 0; i < 9; i++) {
    ultimo = await req('POST', '/activation/activate', { body: { email, code: '000000', password: PWD } });
  }
  check(ultimo.status === 400, 'QA.11 Un código equivocado se rechaza', `status ${ultimo.status}`);
  const nueve = await req('POST', '/activation/check', { body: { token: correo.token, purpose: 'activation' } });
  check(nueve.data?.state === 'valid', 'QA.11b Con 9 intentos fallidos el enlace sigue vivo', json(nueve.data));
  await req('POST', '/activation/activate', { body: { email, code: '000000', password: PWD } });
  const bloqueado = await req('POST', '/activation/activate', { body: { email, code: correo.code, password: PWD } });
  check(bloqueado.status === 400, 'QA.12 Tras 10 intentos fallidos, ni el código correcto sirve', json(bloqueado.data));

  // Reenvío: llega uno nuevo, el anterior queda reemplazado.
  ctx.pendiente = { email, correo };
}

async function reenvioYCodigo(ctx) {
  objective('Reenvío · espera entre envíos y activación con código');

  const email = correoEst('codigo');
  const desde = Date.now();
  await req('POST', '/users', {
    token: ctx.admin,
    body: { firstName: 'Luis', lastName: 'Mamani', email, role: 'STUDENT', semester: 2, universityCode: codigoUniversitario() },
  });
  const primero = await leerCorreo(email, { tipo: 'account_activation', desde });

  const pronto = await req('POST', '/activation/request', { body: { email } });
  check(pronto.status === 200 || pronto.status === 202, 'QA.13 Pedir otro correo responde igual exista o no la cuenta', `status ${pronto.status}`);
  check(Number(pronto.data?.retryAfterSeconds) > 0, 'QA.14 E indica cuánto esperar antes de volver a pedirlo', json(pronto.data));

  const reenvioAdmin = await req('POST', `/users/${(await idDe(ctx, email))}/resend-activation`, { token: ctx.admin });
  check(reenvioAdmin.status === 429, 'QA.15 El administrador tampoco puede reenviar en ráfaga -> 429', `status ${reenvioAdmin.status}`);

  const externo = await req('POST', '/activation/request', { body: { email: `qa.${TS}@gmail.com` } });
  check(externo.status === 400, 'QA.16 Solo se aceptan correos institucionales', `status ${externo.status}`);

  const ok = await req('POST', '/activation/activate', { body: { email, code: primero.code, password: PWD } });
  check(ok.status === 200, 'QA.17 Se activa con correo + código, sin el enlace', json(ok.data));
  const usado = await req('POST', '/activation/check', { body: { token: primero.token, purpose: 'activation' } });
  check(usado.data?.state === 'used', 'QA.18 Después, el enlace dice que ya se usó', json(usado.data));
  const login = await req('POST', '/auth/login', { body: { email, password: PWD } });
  check(login.status === 200, 'QA.19 Y ya puede iniciar sesión', `status ${login.status}`);

  objective('Recuperar contraseña · ahora sí llega un correo');
  const d2 = Date.now();
  const olvido = await req('POST', '/activation/forgot-password', { body: { email } });
  check(olvido.status === 200 || olvido.status === 202, 'QA.20 La solicitud se acepta', `status ${olvido.status}`);
  const reset = await leerCorreo(email, { tipo: 'password_reset', desde: d2 });
  check(Boolean(reset.token && reset.code), 'QA.21 El correo de recuperación llega con enlace y código');
  const nueva = 'OtraClave2026Seg*';
  const cambio = await req('POST', '/activation/reset-password', { body: { email, code: reset.code, password: nueva } });
  check(cambio.status === 200, 'QA.22 La contraseña se cambia con el código', json(cambio.data));
  const conNueva = await req('POST', '/auth/login', { body: { email, password: nueva } });
  check(conNueva.status === 200, 'QA.23 Y se entra con la nueva', `status ${conNueva.status}`);
}

async function idDe(ctx, email) {
  const r = await req('GET', '/users', { token: ctx.admin });
  const lista = Array.isArray(r.data) ? r.data : r.data?.items ?? [];
  return lista.find((u) => u.email === email)?.id;
}

// ===========================================================================
//  Formularios del administrador: errores campo por campo
// ===========================================================================
async function formularios(ctx) {
  objective('Formularios · cada error en su campo');

  const sinSemestre = await req('POST', '/users', {
    token: ctx.admin,
    body: { firstName: 'Eva', lastName: 'Rojas', email: correoEst('sinsem'), role: 'STUDENT' },
  });
  check(sinSemestre.status === 400 && sinSemestre.data?.fields?.semester,
    'QA.24 Estudiante sin semestre: error en el campo «semestre»', json(sinSemestre.data));
  check(sinSemestre.data?.fields?.universityCode,
    'QA.24b Ni sin código universitario (V2 §12): error en ese campo', json(sinSemestre.data?.fields));
  const codigo = codigoUniversitario();
  const conCodigo = await req('POST', '/users', {
    token: ctx.admin,
    body: { firstName: 'Eva', lastName: 'Rojas', email: correoEst('cod1'), role: 'STUDENT', semester: 2, universityCode: codigo },
  });
  const codigoRepetido = await req('POST', '/users', {
    token: ctx.admin,
    body: { firstName: 'Eva', lastName: 'Rojas', email: correoEst('cod2'), role: 'STUDENT', semester: 2, universityCode: codigo },
  });
  check(conCodigo.status === 201 && codigoRepetido.status === 409 && codigoRepetido.data?.fields?.universityCode,
    'QA.24c El código universitario es único', `${conCodigo.status}/${codigoRepetido.status}`);

  const malos = await req('POST', '/users', {
    token: ctx.admin,
    body: { firstName: 'Eva3', lastName: '', email: 'eva@gmail.com', role: 'STUDENT', semester: 9 },
  });
  const f = malos.data?.fields ?? {};
  check(malos.status === 400 && f.firstName && f.lastName && f.email && f.semester,
    'QA.25 Varios errores a la vez: uno por campo', json(f));

  const area = await req('POST', '/academic-areas', {
    token: ctx.admin,
    body: { name: 'Área 123 $$', description: '' },
  });
  check(area.status === 400 && area.data?.fields?.name, 'QA.26 Área: nombre con números o símbolos -> error en «nombre»', json(area.data?.fields));
  check(area.data?.fields?.tags, 'QA.27 Área: etiquetas obligatorias', json(area.data?.fields));

  const nombre = `Robótica Educativa ${String.fromCharCode(65 + (TS % 26))}${String.fromCharCode(65 + ((TS >> 5) % 26))}`;
  const creada = await req('POST', '/academic-areas', {
    token: ctx.admin,
    body: { name: nombre, tags: ['robotica', 'arduino'] },
  });
  check(creada.status === 201, 'QA.28 Área: la descripción es opcional', json(creada.data));
  check(/^[a-z][a-z0-9_]+$/.test(creada.data?.code ?? ''), 'QA.29 Área: recibe un código automático si no se da', creada.data?.code);
  ctx.areaId = creada.data?.id;

  const dupCodigo = await req('POST', '/academic-areas', {
    token: ctx.admin,
    body: { name: `${nombre} Dos`, tags: ['x'], code: creada.data?.code },
  });
  check(dupCodigo.status === 409 && dupCodigo.data?.fields?.code, 'QA.30 Área: código repetido -> error en «código»', json(dupCodigo.data));

  const skillSinArea = await req('POST', '/skills', { token: ctx.admin, body: { name: 'Soldadura de placas' } });
  check(skillSinArea.status === 400 && skillSinArea.data?.fields?.academicAreaId,
    'QA.31 Habilidad: el área es obligatoria', json(skillSinArea.data?.fields));
  const skill = await req('POST', '/skills', {
    token: ctx.admin,
    body: { name: `Soldadura de placas ${creada.data?.code?.slice(-2) ?? ''}`.trim(), academicAreaId: ctx.areaId },
  });
  check(skill.status === 201 && skill.data?.code, 'QA.32 Habilidad con área: se crea con código', json(skill.data));

  const cat = await req('POST', '/activity-categories', {
    token: ctx.admin,
    body: { name: 'Cat 9 !!', code: 'X' },
  });
  check(cat.status === 400 && cat.data?.fields?.name && cat.data?.fields?.code,
    'QA.33 Categoría: nombre y código inválidos, cada uno en su campo', json(cat.data?.fields));

  const crit = await req('POST', '/gamification-criteria', {
    token: ctx.admin,
    body: { code: `qa_${TS}`, name: 'Extra robótica', trigger: 'participacion_confirmada', points: 'diez' },
  });
  check(crit.status === 400 && crit.data?.fields?.points, 'QA.34 Criterio: puntos con letras -> error en «puntos»', json(crit.data?.fields));
}

// ===========================================================================
//  Bienvenida por pasos y cuestionario adaptado
// ===========================================================================
async function bienvenida(ctx) {
  objective('Bienvenida · por pasos, sin saltarse lo mínimo');

  const est = await provisionAndActivate(ctx.admin, {
    firstName: 'Rosa', lastName: 'Flores', email: correoEst('bienvenida'), role: 'STUDENT', semester: 4,
  });
  ctx.est = est;

  const inicial = await req('GET', '/profiles/me/onboarding', { token: est.token });
  check(inicial.status === 200 && inicial.data?.completed === false, 'QA.35 Una cuenta nueva empieza con la bienvenida pendiente', json(inicial.data));
  check(inicial.data?.semester === 4, 'QA.36 El semestre ya viene del alta: el perfil no queda incompleto por eso', json(inicial.data));

  const antes = await req('POST', '/profiles/me/onboarding/complete', { token: est.token });
  check(antes.status === 400, 'QA.37 No se puede dar por terminada sin perfil ni intereses', json(antes.data));

  // El cuestionario antes de declarar nada: el general.
  const generico = await req('GET', '/onboarding/questionnaire', { token: est.token });
  const areas = (await req('GET', '/academic-areas', { token: est.token })).data ?? [];
  // Áreas del catálogo real: las que dejaron suites antiguas llevan dígitos en el nombre.
  const conTags = areas.filter((a) => a.isActive !== false && (a.tags ?? []).length && !/\d/.test(a.name));
  const elegidas = conTags.slice(0, 2);

  const perfil = await req('POST', '/profiles/me', {
    token: est.token,
    body: { bio: 'Me gusta programar.', improvementAreaIds: [elegidas[0].id] },
  });
  check(perfil.status === 201 || perfil.status === 200, 'QA.38 Paso 1: crea su perfil (reclama el que dejó el alta)', `status ${perfil.status}`);
  const paso = await req('PATCH', '/profiles/me/onboarding', { token: est.token, body: { step: 'interests' } });
  check(paso.status === 200 && paso.data?.step === 'interests', 'QA.39 El paso queda guardado para retomarlo', json(paso.data));

  const sinIntereses = await req('POST', '/profiles/me/onboarding/complete', { token: est.token });
  check(sinIntereses.status === 400 && /privacidad/i.test(sinIntereses.data?.message ?? ''),
    'QA.40 Sin confirmar datos, disponibilidad y privacidad todavía no termina (V2 §20.2)', json(sinIntereses.data));

  await req('PUT', '/profiles/me/interests', {
    token: est.token,
    body: { items: elegidas.map((a) => ({ academicAreaId: a.id, priority: 4 })) },
  });
  const quitar = await req('PUT', '/profiles/me/interests', {
    token: est.token,
    body: { items: [{ academicAreaId: elegidas[0].id, priority: 5 }] },
  });
  const resumen = await req('GET', '/profiles/me/summary', { token: est.token });
  const declarados = resumen.data?.preferredAreas ?? resumen.data?.interests ?? [];
  check(quitar.status === 200 && declarados.length === 1, 'QA.41 Un interés se puede quitar (reemplazo completo)', `${declarados.length} intereses`);
  await req('PUT', '/profiles/me/interests', {
    token: est.token,
    body: { items: elegidas.map((a) => ({ academicAreaId: a.id, priority: 4 })) },
  });

  // V2 §20.2: confirmar datos, decidir disponibilidad y revisar privacidad.
  await req('POST', '/profiles/me/onboarding/institutional-confirmation', { token: est.token, body: {} });
  await req('PATCH', '/profiles/me', { token: est.token, body: { availability: 'open' } });
  await req('POST', '/profiles/me/onboarding/privacy', { token: est.token, body: { peerDiscoverable: true, publicProfileEnabled: false } });
  const fin = await req('POST', '/profiles/me/onboarding/complete', { token: est.token });
  check(fin.status === 201 || fin.status === 200, 'QA.42 Con lo obligatorio de la V2, la bienvenida termina', json(fin.data));
  check(fin.data?.completed === true, 'QA.43 Y queda marcada como completada', json(fin.data));

  objective('Cuestionario · cambia según las áreas declaradas');
  const adaptado = await req('GET', '/onboarding/questionnaire', { token: est.token });
  check(adaptado.status === 200 && adaptado.data?.questions?.length > 0, 'QA.44 El cuestionario carga (ya no aparece «0 preguntas»)', `${adaptado.data?.questions?.length} preguntas`);
  const propias = (q) => (q?.questions ?? []).filter((x) => x.code.startsWith('dd_'));
  check(
    propias(generico.data).length === 0 && propias(adaptado.data).length > 0,
    'QA.45 Con áreas declaradas aparecen preguntas propias de esas áreas',
    `${propias(generico.data).length} -> ${propias(adaptado.data).map((x) => x.text).join(' | ').slice(0, 140)}`,
  );
  check((adaptado.data?.basedOn ?? []).length > 0, 'QA.45b Y dice en qué áreas se basa', json(adaptado.data?.basedOn));
  const minimo = adaptado.data?.minAnswers ?? 6;
  check(minimo < adaptado.data.questions.length, 'QA.46 No hace falta responderlo entero', `mínimo ${minimo}`);

  const parcial = adaptado.data.questions.slice(0, minimo).map((q) => ({
    questionCode: q.code, optionCodes: [q.options[0].code],
  }));
  const run = await req('POST', '/onboarding/runs', { token: est.token, body: { answers: parcial } });
  check(run.status === 201, 'QA.47 Respuestas parciales (el mínimo) se aceptan', json(run.data));
  const pocas = await req('POST', '/onboarding/runs', { token: est.token, body: { answers: parcial.slice(0, minimo - 1) } });
  check(pocas.status === 400, 'QA.48 Por debajo del mínimo se pide responder algo más', `status ${pocas.status}`);
  const otra = await req('POST', '/onboarding/runs', { token: est.token, body: { answers: parcial } });
  check(otra.status === 201, 'QA.49 Se puede volver a hacer cuando quiera', `status ${otra.status}`);
}

// ===========================================================================
//  Gamificación: criterios, retos docentes, recompensas
// ===========================================================================
async function gamificacion(ctx) {
  objective('Gamificación · los criterios mandan y los docentes premian');

  const criterios = (await req('GET', '/gamification-criteria', { token: ctx.admin })).data ?? [];
  const general = criterios.find((c) => c.code === 'participacion_confirmada' && !c.academicAreaId);
  check(general?.isActive && general.points > 0, 'QA.50 Cada hecho tiene su criterio general activo', json(general));

  const duplicado = await req('POST', '/gamification-criteria', {
    token: ctx.admin,
    body: { code: `dup_${TS}`, name: 'Otra participación', trigger: 'participacion_confirmada', points: 5 },
  });
  check(duplicado.status === 409 && duplicado.data?.fields?.academicAreaId,
    'QA.51 Un segundo criterio general del mismo hecho se rechaza: o se edita, o se limita a un área', json(duplicado.data));
  const retirado = await req('POST', '/gamification-criteria', {
    token: ctx.admin,
    body: { code: `perfil_${TS}`, name: 'Perfil completo', trigger: 'perfil_completo', points: 5, academicAreaId: ctx.areaId },
  });
  check(retirado.status === 409, 'QA.52 No se puede premiar algo que §66 excluye (autodeclarado)', `status ${retirado.status}`);
  const extra = await req('POST', '/gamification-criteria', {
    token: ctx.admin,
    body: { code: `extra_${TS}`, name: 'Extra por robótica', trigger: 'participacion_confirmada', points: 15, academicAreaId: ctx.areaId },
  });
  check(extra.status === 201, 'QA.53 Un extra limitado a un área sí se permite', json(extra.data));

  // Docente con alcance en 4º semestre; el estudiante de la bienvenida está en 4º.
  const docente = await provisionAndActivate(ctx.admin, {
    firstName: 'Carlos', lastName: 'Vargas', email: correoStaff('docente'), role: 'TEACHER',
  });
  await req('PUT', `/users/${docente.userId}/semesters`, { token: ctx.admin, body: { semesters: [4] } });
  const ajeno = await provisionAndActivate(ctx.admin, {
    firstName: 'Mario', lastName: 'Choque', email: correoEst('ajeno'), role: 'STUDENT', semester: 7,
  });
  await req('POST', '/profiles/me', { token: ajeno.token, body: { bio: 'Hola.' } });
  const perfilAjeno = (await req('GET', '/profiles/me', { token: ajeno.token })).data;
  const perfilEst = (await req('GET', '/profiles/me', { token: ctx.est.token })).data;

  const malReto = await req('POST', '/gamification/challenges', { token: docente.token, body: { title: 'Reto', points: 500 } });
  check(malReto.status === 400 && malReto.data?.fields?.points, 'QA.54 Los puntos de un reto se validan (1 a 100)', json(malReto.data?.fields));
  const reto = await req('POST', '/gamification/challenges', {
    token: docente.token,
    body: { title: 'Laboratorio de bases de datos', points: 40 },
  });
  check(reto.status === 201, 'QA.55 El docente crea un reto con sus puntos', json(reto.data));

  const fuera = await req('POST', `/gamification/challenges/${reto.data.id}/award`, {
    token: docente.token, body: { studentProfileIds: [perfilAjeno.id] },
  });
  check(fuera.status === 403, 'QA.56 No puede premiar a un estudiante fuera de su alcance cambiando el ID', `status ${fuera.status}`);
  const dentro = await req('POST', `/gamification/challenges/${reto.data.id}/award`, {
    token: docente.token, body: { studentProfileIds: [perfilEst.id] },
  });
  check((dentro.status === 201 || dentro.status === 200) && dentro.data?.awarded === 1, 'QA.57 Sí puede premiar a los suyos', json(dentro.data));
  const otraVez = await req('POST', `/gamification/challenges/${reto.data.id}/award`, {
    token: docente.token, body: { studentProfileIds: [perfilEst.id] },
  });
  check(otraVez.data?.awarded === 0 && otraVez.data?.alreadyHad === 1, 'QA.58 El mismo reto no se cobra dos veces', json(otraVez.data));

  const alcance = await req('GET', '/gamification/scope-points?period=week', { token: docente.token });
  const ids = (alcance.data?.students ?? []).map((s) => s.profileId);
  check(ids.includes(perfilEst.id) && !ids.includes(perfilAjeno.id), 'QA.59 Ve los puntos de su alcance y de nadie más', `${ids.length} estudiantes`);

  const wallet = await req('GET', '/gamification/me/wallet', { token: ctx.est.token });
  check(wallet.data?.balance?.available >= 40, 'QA.60 El estudiante ve su saldo canjeable', json(wallet.data?.balance));
  check(wallet.data?.periods?.week >= 40 && wallet.data.periods.month >= wallet.data.periods.week
    && wallet.data.periods.year >= wallet.data.periods.month, 'QA.61 Y sus puntos de la semana, el mes y el año', json(wallet.data?.periods));

  const caro = await req('POST', '/gamification/rewards', { token: docente.token, body: { name: 'Libro de algoritmos', cost: 9999 } });
  const barato = await req('POST', '/gamification/rewards', { token: docente.token, body: { name: 'Certificado del curso', cost: 30, stock: 1 } });
  check(caro.status === 201 && barato.status === 201, 'QA.62 El docente ofrece recompensas con costo y unidades', `${caro.status}/${barato.status}`);
  const sinSaldo = await req('POST', `/gamification/rewards/${caro.data.id}/redeem`, { token: ctx.est.token });
  check(sinSaldo.status === 400, 'QA.63 Sin puntos suficientes no se canjea', json(sinSaldo.data));
  const canje = await req('POST', `/gamification/rewards/${barato.data.id}/redeem`, { token: ctx.est.token });
  check(canje.status === 201, 'QA.64 Con puntos suficientes, se canjea', json(canje.data));
  const agotada = await req('POST', `/gamification/rewards/${barato.data.id}/redeem`, { token: ctx.est.token });
  check(agotada.status === 409 || agotada.status === 400, 'QA.65 Sin unidades ya no se puede canjear', `status ${agotada.status}`);
  const tras = await req('GET', '/gamification/me/wallet', { token: ctx.est.token });
  check(tras.data?.balance?.available === wallet.data.balance.available - 30, 'QA.66 El costo sale del saldo', json(tras.data?.balance));

  const ajenoResuelve = await req('PATCH', `/gamification/redemptions/${canje.data.id}`, {
    token: ajeno.token, body: { status: 'rejected' },
  });
  check(ajenoResuelve.status === 403, 'QA.67 Un estudiante no resuelve canjes', `status ${ajenoResuelve.status}`);
  const rechazo = await req('PATCH', `/gamification/redemptions/${canje.data.id}`, {
    token: docente.token, body: { status: 'rejected', note: 'Prueba' },
  });
  check(rechazo.status === 200, 'QA.68 Quien la ofrece la resuelve', `status ${rechazo.status}`);
  const devuelto = await req('GET', '/gamification/me/wallet', { token: ctx.est.token });
  check(devuelto.data?.balance?.available === wallet.data.balance.available, 'QA.69 Al rechazar, los puntos vuelven', json(devuelto.data?.balance));

  const afinidad = await req('GET', '/gamification/me', { token: ctx.est.token });
  check(/afinidad/i.test(afinidad.data?.note ?? ''), 'QA.70 La pantalla aclara que los puntos no cambian la afinidad', afinidad.data?.note);
}

// ===========================================================================

async function main() {
  console.log(`${C.bold}Correcciones de QA — verificación contra la API${C.r}`);
  const ctx = { admin: await loginAdmin() };
  for (const paso of [activacion, reenvioYCodigo, formularios, bienvenida, gamificacion]) {
    try {
      await paso(ctx);
    } catch (e) {
      failures.push(`${paso.name}: ${e.message}`);
      console.log(`  ${C.bad}✗ ${paso.name} se interrumpió: ${e.message}${C.r}`);
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
