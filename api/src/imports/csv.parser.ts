/**
 * Lector de CSV (especificación §10).
 *
 * Se implementa aquí en lugar de añadir una dependencia porque el formato que
 * hace falta es acotado y conocido: cabecera, comillas dobles con escape
 * duplicado, y separador coma o punto y coma. Un lector propio de 60 líneas se
 * audita entero; una librería de propósito general, no.
 */

export interface ParsedCsv {
  headers: string[];
  /**
   * Cada fila con su número de línea real en el archivo, para señalar errores,
   * y cuántas columnas traía: V3.2 §7.6 exige detectar la fila a la que le
   * falta (o le sobra) una columna en lugar de correr los valores.
   */
  rows: { lineNumber: number; values: Record<string, string>; columns: number }[];
}

/**
 * V3.2 §7.6: una fila con distinta cantidad de columnas que la cabecera no se
 * interpreta. Si se rellenara por posición, el correo terminaría en el
 * apellido y la fila parecería válida.
 */
export function columnasProblema(row: { columns?: number }, esperadas: number): string | null {
  if (row.columns === undefined || row.columns === esperadas) return null;
  return row.columns < esperadas
    ? `La fila tiene ${row.columns} columna(s) y la plantilla ${esperadas}: falta al menos un dato. No se interpretó para no mezclar campos.`
    : `La fila tiene ${row.columns} columnas y la plantilla ${esperadas}: sobra un separador (¿una coma dentro de un nombre sin comillas?).`;
}

/** V3.2 §7.6: un archivo que no es UTF-8 llega con caracteres de reemplazo. */
export function codificacionProblema(content: string): string | null {
  return content.includes('\uFFFD')
    ? 'El archivo no está en UTF-8 y algunas letras (tildes, ñ) se perderían. Guárdelo como «CSV UTF-8» y vuelva a subirlo.'
    : null;
}

/** Detecta el separador por la cabecera: gana el que más columnas produzca. */
function detectDelimiter(headerLine: string): string {
  const candidates = [',', ';', '\t'];
  let best = ',';
  let bestCount = 0;
  for (const candidate of candidates) {
    const count = splitLine(headerLine, candidate).length;
    if (count > bestCount) {
      best = candidate;
      bestCount = count;
    }
  }
  return best;
}

/** Divide una línea respetando comillas dobles y el escape `""`. */
function splitLine(line: string, delimiter: string): string[] {
  const out: string[] = [];
  let current = '';
  let inQuotes = false;

  for (let i = 0; i < line.length; i++) {
    const char = line[i];
    if (inQuotes) {
      if (char === '"') {
        if (line[i + 1] === '"') {
          current += '"';
          i++;
        } else {
          inQuotes = false;
        }
      } else {
        current += char;
      }
    } else if (char === '"') {
      inQuotes = true;
    } else if (char === delimiter) {
      out.push(current);
      current = '';
    } else {
      current += char;
    }
  }
  out.push(current);
  return out;
}

/** Normaliza un encabezado: minúsculas, sin acentos, con guion bajo. */
function normalizeHeader(raw: string): string {
  return raw
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '');
}

export function parseCsv(content: string): ParsedCsv {
  // Retira el BOM que Excel antepone al guardar en UTF-8: si no, la primera
  // columna se llamaría "﻿university_code" y nunca coincidiría.
  const text = content.replace(/^﻿/, '');
  const lines = text.split(/\r\n|\n|\r/);

  const firstIndex = lines.findIndex((l) => l.trim().length > 0);
  if (firstIndex === -1) return { headers: [], rows: [] };

  const delimiter = detectDelimiter(lines[firstIndex]);
  const headers = splitLine(lines[firstIndex], delimiter).map(normalizeHeader);

  const rows: ParsedCsv['rows'] = [];
  for (let i = firstIndex + 1; i < lines.length; i++) {
    const line = lines[i];
    if (line.trim().length === 0) continue;

    const cells = splitLine(line, delimiter);
    const values: Record<string, string> = {};
    headers.forEach((header, index) => {
      values[header] = (cells[index] ?? '').trim();
    });
    rows.push({ lineNumber: i + 1, values, columns: cells.length });
  }

  return { headers, rows };
}
