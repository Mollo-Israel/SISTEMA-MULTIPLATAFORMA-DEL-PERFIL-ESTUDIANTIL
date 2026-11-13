/**
 * Los lectores de manifiestos lineales dan exactamente el mismo resultado que
 * las expresiones regulares que reemplazan (SonarQube S8786), sobre miles de
 * entradas armadas con líneas reales de pnpm-lock y pyproject y con
 * caracteres sueltos que fuerzan los casos raros.
 */
import { bloqueImportadorRaiz, nombresEntreComillas } from '../../../src/projects/manifiestos';
import { separarNombreYDireccion } from '../../../src/common/texto';

function generador(semilla: number) {
  let s = semilla >>> 0;
  return () => {
    s = (s * 1664525 + 1013904223) >>> 0;
    return s / 0x100000000;
  };
}

function combinar(piezas: string[], cantidad: number, largoMax: number, semilla: number, union = ''): string[] {
  const azar = generador(semilla);
  const salida: string[] = [];
  for (let i = 0; i < cantidad; i += 1) {
    const largo = Math.floor(azar() * (largoMax + 1));
    const partes: string[] = [];
    for (let k = 0; k < largo; k += 1) partes.push(piezas[Math.floor(azar() * piezas.length)]);
    salida.push(partes.join(union));
  }
  return salida;
}

const PNPM_ORIGINAL = (t: string) => /importers:\s*\n\s+\.:\s*\n([\s\S]*?)(?:\n\S|\n {2}\S)/.exec(t)?.[1] ?? '';
const PYPROJECT_ORIGINAL = (t: string) =>
  [...t.matchAll(/["']([A-Za-z0-9_.-]+)\s*(?:[<>=!~^ ;\[].*?)?["']/g)].map((m) => m[1]);

describe('Lectores de manifiestos equivalentes a sus expresiones regulares', () => {
  it('bloqueImportadorRaiz con un pnpm-lock real', () => {
    const lock = [
      "lockfileVersion: '9.0'", '', 'importers:', '', '  .:', '    dependencies:', '      react:',
      '        specifier: ^18.3.1', '        version: 18.3.1', "      '@nestjs/core':", '        specifier: ^10.0.0',
      '', '  packages/web:', '    dependencies:', '      vite:', '', 'packages:', '',
    ].join('\n');
    expect(bloqueImportadorRaiz(lock)).toBe(PNPM_ORIGINAL(lock));
    expect(bloqueImportadorRaiz(lock)).toContain('react:');
  });

  it('bloqueImportadorRaiz = la expresión original (por líneas)', () => {
    const lineas = ['importers:', 'importers:  ', '', ' ', '  ', '  .:', '.:', '\t.:', '  .: ', '    dependencies:',
      '      react:', "      '@a/b':", '  packages/a:', 'packages:', '   x', '  x', ' x', 'x', 'importers: x', '\r'];
    for (const t of combinar(lineas, 6000, 9, 11, '\n')) expect(bloqueImportadorRaiz(t)).toBe(PNPM_ORIGINAL(t));
  });

  it('bloqueImportadorRaiz = la expresión original (por caracteres)', () => {
    const piezas = ['importers:', '\n', ' ', '  ', '.:', 'x', '\t', '.'];
    for (const t of combinar(piezas, 6000, 12, 12)) expect(bloqueImportadorRaiz(t)).toBe(PNPM_ORIGINAL(t));
  });

  it('nombresEntreComillas con un pyproject real', () => {
    const toml = [
      '[project]', 'name = "demo"', 'dependencies = [', '  "fastapi>=0.110",', "  'pydantic ~= 2.6',",
      '  "uvicorn[standard] >=0.29",', '  "numpy",', ']', '[tool.poetry.dependencies]', 'python = "^3.11"',
    ].join('\n');
    expect(nombresEntreComillas(toml)).toEqual(PYPROJECT_ORIGINAL(toml));
    expect(nombresEntreComillas(toml)).toEqual(expect.arrayContaining(['fastapi', 'pydantic', 'uvicorn', 'numpy']));
  });

  it('nombresEntreComillas = la expresión original', () => {
    const piezas = ['"', "'", 'a', 'b_', '.', '-', ' ', '\t', '\n', '<', '=', '>', '#', '[', ';', '~', 'x y', '\r'];
    for (const t of combinar(piezas, 8000, 14, 13)) expect(nombresEntreComillas(t)).toEqual(PYPROJECT_ORIGINAL(t));
  });

  it('la clase de espacios de una misma línea (Dockerfile y compose) = [^\\S\\r\\n LS PS]', () => {
    // dependency-map.ts cambió [^\S\r\n<LS><PS>] por la lista explícita de esos
    // espacios (Sonar S5869 leía \S como en Java). Se comprueban las 65.536
    // unidades de código, con las mismas banderas que usan las expresiones.
    const LS = String.fromCharCode(0x2028);
    const PS = String.fromCharCode(0x2029);
    const antes = new RegExp(`^[^\\S\\r\\n${LS}${PS}]$`, 'im');
    const ahora = /^[\t\v\f \u00a0\u1680\u2000-\u200a\u202f\u205f\u3000\ufeff]$/im;
    const distintos: string[] = [];
    for (let c = 0; c <= 0xffff; c += 1) {
      const ch = String.fromCharCode(c);
      if (ahora.test(ch) !== antes.test(ch)) distintos.push(c.toString(16));
    }
    expect(distintos).toEqual([]);
    expect(ahora.test(' ') && ahora.test('\t') && !ahora.test('\n') && !ahora.test(LS)).toBe(true);
  });

  it('separarNombreYDireccion = /^(.*)<([^>]+)>\\s*$/.exec', () => {
    const piezas = ['<', '>', 'a', ' ', '\n', '"', 'b@c.d', '\t'];
    const casos = [...combinar(piezas, 8000, 9, 14), 'Afinia <no-responder@afinia.edu>', '"Afinia" <a@b.c>  ', 'a@b.c', '<>', '<a>'];
    for (const t of casos) {
      const m = /^(.*)<([^>]+)>\s*$/.exec(t);
      expect(separarNombreYDireccion(t)).toEqual(m ? [m[1], m[2]] : null);
    }
  });
});
