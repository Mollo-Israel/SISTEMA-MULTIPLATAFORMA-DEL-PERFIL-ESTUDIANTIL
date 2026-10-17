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
import { loginAdmin, provisionAndActivate, req } from './lib/fixtures.mjs';

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

const BATCHES = { batch1 };

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
