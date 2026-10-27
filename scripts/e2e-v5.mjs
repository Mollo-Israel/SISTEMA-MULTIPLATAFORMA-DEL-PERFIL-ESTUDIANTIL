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
import { API, loginAdmin, provisionAndActivate, provisionStudent, req } from './lib/fixtures.mjs';

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

const BATCHES = { batch2, batch4, batch5 };

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
