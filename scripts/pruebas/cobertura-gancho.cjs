/**
 * Se carga con `node --require` en la API instrumentada (scripts/pruebas/cobertura.mjs).
 *
 * Node escribe la cobertura de V8 (NODE_V8_COVERAGE) cuando el proceso termina
 * con normalidad. Un cierre forzado desde fuera (como el de Windows) no le da
 * tiempo, así que:
 * - COBERTURA_DISPARADOR: la API espera ese archivo y sale por sí misma.
 * - COBERTURA_INTERVALO_MS: para las API que otra suite cierra a la fuerza, se
 *   guarda una instantánea cada tanto (V8 reinicia los contadores en cada una
 *   y luego se suman todas).
 */
const { existsSync, rmSync } = require('node:fs');
const v8 = require('node:v8');

const disparador = process.env.COBERTURA_DISPARADOR;
if (disparador) {
  setInterval(() => {
    if (!existsSync(disparador)) return;
    rmSync(disparador, { force: true });
    console.log('[cobertura] Disparador recibido: se guarda la cobertura y la API termina.');
    process.exit(0);
  }, 1000).unref();
}

const intervalo = Number(process.env.COBERTURA_INTERVALO_MS);
if (process.env.NODE_V8_COVERAGE && intervalo > 0) {
  setInterval(() => v8.takeCoverage(), intervalo).unref();
}
