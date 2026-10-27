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
import { loginAdmin, provisionAndActivate, provisionStudent, req } from './lib/fixtures.mjs';

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

const BATCHES = { batch4 };

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
