// Resume una corrida de regresión: cuenta las comprobaciones correctas (✓) y fallidas (✗)
// en el registro de cada suite y muestra el total.
//
// Uso: node scripts/pruebas/resumen-regresion.mjs <carpeta-con-los-.log>
import { readdirSync, readFileSync } from 'node:fs';
import { join, basename } from 'node:path';

const carpeta = process.argv[2];
if (!carpeta) {
  console.error('Uso: node scripts/pruebas/resumen-regresion.mjs <carpeta-con-los-.log>');
  process.exit(2);
}

const ORDEN = [
  'e2e-objectives-40', 'e2e-objective-5', 'e2e-objective-6', 'e2e-objective-7',
  ...Array.from({ length: 11 }, (_, i) => `e2e-batch-${i + 1}`),
  'e2e-qa', 'e2e-v2', 'e2e-v3', 'e2e-v3-2', 'e2e-v4-1', 'e2e-v5', 'e2e-v6',
  'e2e-ai-provider', 'e2e-web', 'e2e-v6-web', 'e2e-web-gestion',
];
const registros = readdirSync(carpeta).filter((f) => f.endsWith('.log')).map((f) => basename(f, '.log'));
const suites = [...ORDEN.filter((s) => registros.includes(s)), ...registros.filter((s) => !ORDEN.includes(s)).sort()];

let correctas = 0, fallidas = 0;
console.log('Suite                  Correctas  Fallos');
console.log('---------------------  ---------  ------');
for (const s of suites) {
  const texto = readFileSync(join(carpeta, `${s}.log`), 'utf8');
  const ok = (texto.match(/✓/g) ?? []).length;
  const ko = (texto.match(/✗/g) ?? []).length;
  correctas += ok; fallidas += ko;
  console.log(`${s.padEnd(21)}  ${String(ok).padStart(9)}  ${String(ko).padStart(6)}  ${ko ? '✗' : '✓'}`);
}
console.log('---------------------  ---------  ------');
console.log(`TOTAL (${suites.length} suites)`.padEnd(21) + `  ${String(correctas).padStart(9)}  ${String(fallidas).padStart(6)}`);
process.exit(fallidas ? 1 : 0);
