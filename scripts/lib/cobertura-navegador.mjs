/**
 * Cobertura de la web en las suites de navegador (scripts/e2e-web.mjs,
 * scripts/e2e-v6-web.mjs y scripts/e2e-web-gestion.mjs), solo con PRUEBAS_COBERTURA=1.
 *
 * Envuelve el navegador de Playwright: cada página nueva registra el JavaScript
 * que ejecuta (cobertura de V8; Edge y Chrome son Chromium) y lo guarda al
 * cerrarse en pruebas/03-playwright/cobertura-v8/, para que
 * scripts/pruebas/cobertura.mjs lo convierta a lcov. V8 descarta la cobertura
 * de un documento al cargar otro, así que se recoge antes de cada navegación
 * completa (goto o reload). Sin la variable devuelve el navegador intacto, y un
 * fallo al medir nunca cambia el resultado de una prueba.
 */
import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const RAIZ = resolve(dirname(fileURLToPath(import.meta.url)), '..', '..');
const DIR = join(RAIZ, 'pruebas', '03-playwright', 'cobertura-v8');

export function medirCobertura(browser, suite) {
  if (process.env.PRUEBAS_COBERTURA !== '1') return browser;
  mkdirSync(DIR, { recursive: true });
  const recogido = new Map(); // página → entradas acumuladas
  let n = 0;

  const recoger = async (page, seguir) => {
    try {
      const entradas = (await page.coverage.stopJSCoverage()).filter((e) => e.url.includes('/assets/'));
      recogido.get(page)?.push(...entradas);
      if (seguir) await page.coverage.startJSCoverage({ resetOnNavigation: false });
    } catch {
      // La página ya se cerró: lo recogido hasta aquí se conserva.
    }
  };

  const guardar = async (page) => {
    if (!recogido.has(page)) return;
    await recoger(page, false);
    const entradas = recogido.get(page);
    recogido.delete(page);
    n += 1;
    writeFileSync(join(DIR, `${suite}-${String(n).padStart(3, '0')}.json`), JSON.stringify(entradas));
  };

  const vigilar = async (crear) => {
    const page = await crear();
    try {
      await page.coverage.startJSCoverage({ resetOnNavigation: false });
      recogido.set(page, []);
      const ir = page.goto.bind(page);
      page.goto = async (url, opciones) => {
        await recoger(page, true);
        return ir(url, opciones);
      };
      const recargar = page.reload.bind(page);
      page.reload = async (opciones) => {
        await recoger(page, true);
        return recargar(opciones);
      };
      const cerrar = page.close.bind(page);
      page.close = async (opciones) => {
        await guardar(page);
        return cerrar(opciones);
      };
    } catch {
      // Sin cobertura en esta página.
    }
    return page;
  };

  const nuevoContexto = browser.newContext.bind(browser);
  browser.newContext = async (opciones) => {
    const ctx = await nuevoContexto(opciones);
    const nuevaPagina = ctx.newPage.bind(ctx);
    ctx.newPage = () => vigilar(nuevaPagina);
    const cerrarContexto = ctx.close.bind(ctx);
    ctx.close = async (o) => {
      for (const p of ctx.pages()) await guardar(p);
      return cerrarContexto(o);
    };
    return ctx;
  };
  const nuevaPagina = browser.newPage.bind(browser);
  browser.newPage = (opciones) => vigilar(() => nuevaPagina(opciones));
  const cerrarNavegador = browser.close.bind(browser);
  browser.close = async () => {
    for (const p of [...recogido.keys()]) await guardar(p);
    return cerrarNavegador();
  };
  return browser;
}
