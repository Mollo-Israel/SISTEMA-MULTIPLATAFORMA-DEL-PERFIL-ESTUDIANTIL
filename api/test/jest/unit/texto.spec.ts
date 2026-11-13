/**
 * Las utilidades de texto lineales dan exactamente el mismo resultado que las
 * expresiones regulares que reemplazan (SonarQube S8786). Se comparan ambas
 * sobre miles de entradas aleatorias, armadas con los caracteres que importan
 * a cada expresión, además de casos escritos a mano.
 */
import {
  cortarDesdeBarra, limpiarBordesDeLineas, ocultarCorreos, ocultarCorreosEnMensaje,
  quitarBarrasFinales, recortarExtremos, recortarFinal, reemplazarEtiquetas, tieneFormatoDeCorreo,
} from '../../../src/common/texto';

// Generador determinista (mismas entradas en cada ejecución).
function generador(semilla: number) {
  let s = semilla >>> 0;
  return () => {
    s = (s * 1664525 + 1013904223) >>> 0;
    return s / 0x100000000;
  };
}

function cadenas(alfabeto: string[], cantidad: number, largoMax: number, semilla: number): string[] {
  const azar = generador(semilla);
  const salida: string[] = [];
  for (let i = 0; i < cantidad; i += 1) {
    const largo = Math.floor(azar() * (largoMax + 1));
    let t = '';
    for (let k = 0; k < largo; k += 1) t += alfabeto[Math.floor(azar() * alfabeto.length)];
    salida.push(t);
  }
  return salida;
}

const N = 4000;

describe('Utilidades de texto equivalentes a sus expresiones regulares', () => {
  it('quitarBarrasFinales = replace(/\\/+$/, "")', () => {
    for (const t of [...cadenas(['/', 'a', '.', ':', ' '], N, 12, 1), 'https://x.org///', '', '///']) {
      expect(quitarBarrasFinales(t)).toBe(t.replace(/\/+$/, ''));
    }
  });

  it('recortarFinal con «.,;:» = replace(/[.,;:]+$/, "")', () => {
    for (const t of cadenas(['.', ',', ';', ':', 'a', ' '], N, 12, 2)) {
      expect(recortarFinal(t, '.,;:')).toBe(t.replace(/[.,;:]+$/, ''));
    }
  });

  it('recortarExtremos con «_» = replace(/^_+|_+$/g, "")', () => {
    for (const t of cadenas(['_', 'a', 'b'], N, 10, 3)) {
      expect(recortarExtremos(t, '_')).toBe(t.replace(/^_+|_+$/g, ''));
    }
  });

  it('recortarExtremos con « :.,-» = replace(/^[\\s:.,-]+|[\\s:.,-]+$/g, "") tras colapsar espacios', () => {
    for (const bruto of cadenas([' ', ':', '.', ',', '-', 'a', '\t', '\n'], N, 12, 4)) {
      const t = bruto.replace(/\s+/g, ' ');
      expect(recortarExtremos(t, ' :.,-')).toBe(t.replace(/^[\s:.,-]+|[\s:.,-]+$/g, ''));
    }
  });

  it('tieneFormatoDeCorreo = /^[^\\s@]+@[^\\s@]+\\.[^\\s@]+$/.test', () => {
    const casos = [...cadenas(['a', '@', '.', ' ', 'b', '\t'], N, 10, 5),
      'ana@est.univalle.edu', 'a@b.c', 'a@.b', 'a@b.', '@b.c', 'a@@b.c', 'a@b..c', 'a b@c.d'];
    for (const t of casos) expect(tieneFormatoDeCorreo(t)).toBe(/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(t));
  });

  it('ocultarCorreos = replace(/[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\\.[A-Za-z]{2,}/g, ...)', () => {
    const re = /[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}/g;
    const casos = [...cadenas(['a', 'B', '1', '.', '@', '-', '%', ' ', 'z'], N, 16, 6),
      'escribe a ana.quispe@est.univalle.edu o a x@y.z', 'a@b.cd.e1', 'x@1.ab2', '@@a.bc'];
    for (const t of casos) expect(ocultarCorreos(t, '[correo]')).toBe(t.replace(re, '[correo]'));
  });

  it('ocultarCorreosEnMensaje = replace(/[^\\s@\'"]+@[^\\s@\'"]+/g, ...)', () => {
    const casos = [...cadenas(['a', '@', ' ', "'", '"', 'b', '\n'], N, 12, 7),
      'falló para "ana@x.com" y luis@y.org', 'a@b@c', 'a@ b'];
    for (const t of casos) expect(ocultarCorreosEnMensaje(t, '[correo]')).toBe(t.replace(/[^\s@'"]+@[^\s@'"]+/g, '[correo]'));
  });

  it('reemplazarEtiquetas = replace(/<[^>]+>/g, " ")', () => {
    const casos = [...cadenas(['<', '>', 'a', ' ', '/'], N, 14, 8), '<p>Hola <b>mundo</b></p>', '<>', '<<a>', 'a<b'];
    for (const t of casos) expect(reemplazarEtiquetas(t, ' ')).toBe(t.replace(/<[^>]+>/g, ' '));
  });

  it('cortarDesdeBarra = replace(/\\/.*$/, "")', () => {
    const casos = [...cadenas(['/', 'a', '\n', '\r', '.'], N, 10, 9), 'univalle.edu/carreras', 'sin-barra'];
    for (const t of casos) expect(cortarDesdeBarra(t)).toBe(t.replace(/\/.*$/, ''));
  });

  it('limpiarBordesDeLineas = replace(/[ \\t]*\\n[ \\t]*/g, "\\n")', () => {
    for (const t of cadenas([' ', '\t', '\n', 'a'], N, 14, 10)) {
      expect(limpiarBordesDeLineas(t)).toBe(t.replace(/[ \t]*\n[ \t]*/g, '\n'));
    }
  });
});
