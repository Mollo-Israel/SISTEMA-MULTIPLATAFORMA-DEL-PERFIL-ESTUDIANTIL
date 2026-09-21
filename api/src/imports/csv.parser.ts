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
  /** Cada fila con su número de línea real en el archivo, para señalar errores. */
  rows: { lineNumber: number; values: Record<string, string> }[];
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
    rows.push({ lineNumber: i + 1, values });
  }

  return { headers, rows };
}
