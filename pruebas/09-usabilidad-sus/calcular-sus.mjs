/**
 * Calcula el SUS y resume las tareas de usabilidad (Investigación §3.8).
 *
 *   node pruebas/09-usabilidad-sus/calcular-sus.mjs
 *
 * Lee respuestas-sus.csv (participante,i1..i10 con valores 1–5) y
 * registro-tareas.csv (participante,tarea,exito[si|parcial|no],tiempo_s,errores,ayuda[si|no],observaciones).
 * Escribe resultados-usabilidad.md en esta misma carpeta.
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const AQUI = dirname(fileURLToPath(import.meta.url));
const leer = (f) => readFileSync(join(AQUI, f), 'utf8').trim().split(/\r?\n/).slice(1)
  .filter(Boolean).map((l) => l.split(','));

/** Puntaje SUS de un participante: impares (r−1), pares (5−r), suma × 2,5. */
export function sus(respuestas) {
  if (respuestas.length !== 10 || respuestas.some((r) => !(r >= 1 && r <= 5))) throw new Error(`Respuestas inválidas: ${respuestas}`);
  return respuestas.reduce((s, r, i) => s + (i % 2 === 0 ? r - 1 : 5 - r), 0) * 2.5;
}

const filas = leer('respuestas-sus.csv');
const puntajes = filas.map(([p, ...r]) => ({ p, puntaje: sus(r.map(Number)) }));
const media = puntajes.length ? puntajes.reduce((s, x) => s + x.puntaje, 0) / puntajes.length : null;

const tareas = leer('registro-tareas.csv');
const porTarea = new Map();
for (const [, tarea, exito, tiempo, errores, ayuda] of tareas) {
  const t = porTarea.get(tarea) ?? { n: 0, exito: 0, tiempo: 0, errores: 0, ayudas: 0 };
  t.n += 1;
  t.exito += exito === 'si' ? 1 : exito === 'parcial' ? 0.5 : 0;
  t.tiempo += Number(tiempo) || 0;
  t.errores += Number(errores) || 0;
  t.ayudas += ayuda === 'si' ? 1 : 0;
  porTarea.set(tarea, t);
}

const md = [
  '# Resultados de usabilidad (tareas + SUS)',
  '',
  `Participantes con SUS: **${puntajes.length}**. Media SUS: **${media === null ? '—' : media.toFixed(1)}** (0–100; no es un porcentaje; ≈ 68 es el promedio de referencia).`,
  '',
  '| Participante | SUS |', '|---|---|',
  ...puntajes.map((x) => `| ${x.p} | ${x.puntaje.toFixed(1)} |`),
  '',
  '| Tarea | Participantes | Tasa de éxito | Tiempo medio (s) | Errores | Ayudas |', '|---|---|---|---|---|---|',
  ...[...porTarea.entries()].map(([k, t]) => `| ${k} | ${t.n} | ${(100 * t.exito / t.n).toFixed(0)} % | ${(t.tiempo / t.n).toFixed(0)} | ${t.errores} | ${t.ayudas} |`),
  '',
].join('\n');
writeFileSync(join(AQUI, 'resultados-usabilidad.md'), md);
console.log(md);
