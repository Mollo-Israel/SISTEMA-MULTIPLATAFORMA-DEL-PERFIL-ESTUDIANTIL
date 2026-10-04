/**
 * Escritor de PDF mínimo (especificación §67, «Exportable a PDF»).
 *
 * ## Por qué escrito y no una dependencia
 *
 * El BATCH 3 ya escribió un **extractor** de texto de PDF para el motor de
 * validación, así que este escritor se puede verificar de verdad: la suite
 * genera el resumen, lo lee con el extractor y comprueba que el texto está —
 * incluida la advertencia obligatoria de §67—. Un PDF que no se puede releer es
 * un archivo que nadie sabe si sirve hasta que alguien intenta abrirlo.
 *
 * Las librerías del ramo pesan entre 1 y 3 MB y traen tipografías embebidas que
 * aquí no hacen falta: un resumen de trayectoria es texto en párrafos.
 *
 * ## Alcance
 *
 * Texto en las catorce tipografías estándar del formato —Helvetica o Times,
 * normal y negrita—, paginación automática y saltos de línea por ancho. Sin
 * imágenes ni tablas. Desde la V2 (§61.2) hay un **tema** por plantilla:
 * tipografía, color de acento, densidad y una línea bajo cada sección. El
 * contenido es el mismo en todas; cambia la presentación.
 *
 * Las tipografías estándar no se embeben: todo lector de PDF las tiene. Eso es
 * lo que permite que el archivo pese unos pocos kilobytes.
 */

/** Tamaño de página A4 en puntos. */
const ANCHO = 595.28;
const ALTO = 841.89;

/** Presentación de una plantilla (V2 §61.2). */
export interface PdfTheme {
  regular: 'Helvetica' | 'Times-Roman';
  bold: 'Helvetica-Bold' | 'Times-Bold';
  /** Color de título y secciones, RGB de 0 a 1; null = negro. */
  accent: [number, number, number] | null;
  /** Factor sobre los tamaños base. */
  scale: number;
  margin: number;
  /** Línea fina bajo cada título de sección. */
  sectionRule: boolean;
  sectionUppercase: boolean;
}

export const PDF_THEMES = {
  classic: {
    regular: 'Helvetica', bold: 'Helvetica-Bold', accent: null, scale: 1, margin: 56,
    sectionRule: false, sectionUppercase: false,
  },
  modern: {
    // Bordó de la Universidad del Valle.
    regular: 'Helvetica', bold: 'Helvetica-Bold', accent: [0.478, 0.106, 0.165], scale: 1, margin: 60,
    sectionRule: true, sectionUppercase: false,
  },
  compact: {
    regular: 'Times-Roman', bold: 'Times-Bold', accent: null, scale: 0.9, margin: 44,
    sectionRule: true, sectionUppercase: true,
  },
} as const satisfies Record<string, PdfTheme>;

/** Anchos aproximados de Helvetica, en milésimas de em. */
const ANCHO_MEDIO = 0.5;

export interface EstiloTexto {
  size: number;
  bold: boolean;
  /** Espacio antes del bloque, en puntos. */
  spaceBefore: number;
  spaceAfter: number;
}

const ESTILOS = {
  titulo: { size: 20, bold: true, spaceBefore: 0, spaceAfter: 10 },
  subtitulo: { size: 11, bold: false, spaceBefore: 0, spaceAfter: 18 },
  seccion: { size: 13, bold: true, spaceBefore: 14, spaceAfter: 6 },
  parrafo: { size: 10, bold: false, spaceBefore: 0, spaceAfter: 6 },
  item: { size: 10, bold: false, spaceBefore: 0, spaceAfter: 3 },
  nota: { size: 8, bold: false, spaceBefore: 12, spaceAfter: 0 },
} as const satisfies Record<string, EstiloTexto>;

export type NombreEstilo = keyof typeof ESTILOS;

interface Bloque {
  texto: string;
  estilo: NombreEstilo;
  /** Sangría adicional, para las viñetas. */
  sangria: number;
}

/**
 * Compone un documento por bloques y lo serializa.
 *
 * La API es deliberadamente pobre —título, sección, párrafo, viñeta, nota—
 * porque un resumen de trayectoria no necesita más y cada primitiva de más es
 * una forma nueva de que dos secciones no se parezcan entre sí.
 */
export class PdfWriter {
  private readonly bloques: Bloque[] = [];

  private readonly tema: PdfTheme;

  constructor(private readonly titulo: string, tema: PdfTheme = PDF_THEMES.classic) {
    this.tema = tema;
  }

  title(texto: string): this {
    this.bloques.push({ texto, estilo: 'titulo', sangria: 0 });
    return this;
  }

  subtitle(texto: string): this {
    this.bloques.push({ texto, estilo: 'subtitulo', sangria: 0 });
    return this;
  }

  section(texto: string): this {
    this.bloques.push({
      texto: this.tema.sectionUppercase ? texto.toLocaleUpperCase('es') : texto,
      estilo: 'seccion',
      sangria: 0,
    });
    return this;
  }

  paragraph(texto: string): this {
    if (texto) this.bloques.push({ texto, estilo: 'parrafo', sangria: 0 });
    return this;
  }

  bullet(texto: string): this {
    if (texto) this.bloques.push({ texto: `•  ${texto}`, estilo: 'item', sangria: 10 });
    return this;
  }

  note(texto: string): this {
    this.bloques.push({ texto, estilo: 'nota', sangria: 0 });
    return this;
  }

  /**
   * Serializa el documento.
   *
   * Sin compresión: los flujos van en claro. Un resumen ronda los pocos
   * kilobytes, comprimirlo ahorraría una nadería y haría el archivo imposible
   * de inspeccionar a ojo cuando algo salga raro.
   */
  build(): Buffer {
    const paginas = this.paginar();
    const objetos: string[] = [];

    // 1: catálogo · 2: árbol de páginas · 3: Helvetica · 4: Helvetica-Bold
    const primeraPagina = 5;
    const idsPagina = paginas.map((_, i) => primeraPagina + i * 2);
    const idsContenido = paginas.map((_, i) => primeraPagina + i * 2 + 1);

    objetos.push('<< /Type /Catalog /Pages 2 0 R >>');
    objetos.push(
      `<< /Type /Pages /Kids [${idsPagina.map((id) => `${id} 0 R`).join(' ')}] `
      + `/Count ${paginas.length} >>`,
    );
    objetos.push(`<< /Type /Font /Subtype /Type1 /BaseFont /${this.tema.regular} /Encoding /WinAnsiEncoding >>`);
    objetos.push(
      `<< /Type /Font /Subtype /Type1 /BaseFont /${this.tema.bold} /Encoding /WinAnsiEncoding >>`,
    );

    paginas.forEach((contenido, i) => {
      objetos.push(
        `<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${ANCHO.toFixed(2)} ${ALTO.toFixed(2)}] `
        + `/Resources << /Font << /F1 3 0 R /F2 4 0 R >> >> `
        + `/Contents ${idsContenido[i]} 0 R >>`,
      );
      objetos.push(`<< /Length ${Buffer.byteLength(contenido, 'latin1')} >>\nstream\n${contenido}\nendstream`);
    });

    return this.ensamblar(objetos);
  }

  // =========================================================================
  // Interno
  // =========================================================================

  /** Reparte los bloques en páginas y produce el flujo de dibujo de cada una. */
  private paginar(): string[] {
    const paginas: string[] = [];
    let actual: string[] = [];
    const MARGEN = this.tema.margin;
    const k = this.tema.scale;
    let y = ALTO - MARGEN;
    const acento = this.tema.accent ? `${this.tema.accent.map((c) => c.toFixed(3)).join(' ')}` : null;

    const cerrar = () => {
      if (actual.length > 0) paginas.push(actual.join('\n'));
      actual = [];
      y = ALTO - MARGEN;
    };

    for (const bloque of this.bloques) {
      const base = ESTILOS[bloque.estilo];
      const estilo = {
        ...base,
        size: +(base.size * k).toFixed(2),
        spaceBefore: base.spaceBefore * k,
        spaceAfter: base.spaceAfter * k,
      };
      const alto = estilo.size * 1.35;
      const anchoUtil = ANCHO - MARGEN * 2 - bloque.sangria;
      const lineas = this.partir(bloque.texto, estilo.size, anchoUtil);
      const coloreado = !!acento && (bloque.estilo === 'titulo' || bloque.estilo === 'seccion');

      y -= estilo.spaceBefore;
      // Un bloque nunca se parte entre páginas por su primera línea: un título
      // solo al pie de una página es peor que una página algo más corta.
      if (y - alto * Math.min(lineas.length, 2) < MARGEN) cerrar();

      for (const linea of lineas) {
        if (y - alto < MARGEN) cerrar();
        actual.push(
          `BT ${coloreado ? `${acento} rg ` : ''}/${estilo.bold ? 'F2' : 'F1'} ${estilo.size} Tf `
          + `${(MARGEN + bloque.sangria).toFixed(2)} ${y.toFixed(2)} Td `
          + `(${this.escapar(linea)}) Tj ${coloreado ? '0 0 0 rg ' : ''}ET`,
        );
        y -= alto;
      }
      if (bloque.estilo === 'seccion' && this.tema.sectionRule) {
        // Línea fina bajo el título, del ancho útil.
        const yl = y + alto * 0.55;
        actual.push(
          `${acento ?? '0.6 0.6 0.6'} RG 0.6 w ${MARGEN.toFixed(2)} ${yl.toFixed(2)} m `
          + `${(ANCHO - MARGEN).toFixed(2)} ${yl.toFixed(2)} l S 0 0 0 RG`,
        );
      }
      y -= estilo.spaceAfter;
    }

    cerrar();
    return paginas.length > 0 ? paginas : [''];
  }

  /**
   * Parte un texto en líneas que quepan en el ancho dado.
   *
   * El ancho de cada carácter se estima en media eme. Helvetica varía entre
   * 0,22 y 0,83, así que la estimación se queda corta con textos de mayúsculas
   * y sobra con los de minúsculas; para un documento de párrafos, el error se
   * traduce en un margen derecho algo irregular y nunca en texto salido de la
   * página, que es lo único que importaría.
   */
  private partir(texto: string, size: number, ancho: number): string[] {
    const maxChars = Math.max(10, Math.floor(ancho / (size * ANCHO_MEDIO)));
    const palabras = texto.split(/\s+/).filter(Boolean);
    const lineas: string[] = [];
    let linea = '';

    for (const palabra of palabras) {
      const candidata = linea ? `${linea} ${palabra}` : palabra;
      if (candidata.length <= maxChars) {
        linea = candidata;
        continue;
      }
      if (linea) lineas.push(linea);
      // Una palabra más larga que la línea se trocea: mejor partida que fuera
      // de la página.
      if (palabra.length > maxChars) {
        let resto = palabra;
        while (resto.length > maxChars) {
          lineas.push(resto.slice(0, maxChars));
          resto = resto.slice(maxChars);
        }
        linea = resto;
      } else {
        linea = palabra;
      }
    }
    if (linea) lineas.push(linea);
    return lineas.length > 0 ? lineas : [''];
  }

  /** Escapa lo que el formato trata como sintaxis dentro de una cadena. */
  private escapar(texto: string): string {
    return texto
      .replace(/\\/g, '\\\\')
      .replace(/\(/g, '\\(')
      .replace(/\)/g, '\\)');
  }

  /** Cabecera, objetos, tabla de referencias cruzadas y tráiler. */
  private ensamblar(objetos: string[]): Buffer {
    const partes: string[] = ['%PDF-1.4\n'];
    const posiciones: number[] = [];
    let offset = Buffer.byteLength(partes[0], 'latin1');

    objetos.forEach((cuerpo, i) => {
      const texto = `${i + 1} 0 obj\n${cuerpo}\nendobj\n`;
      posiciones.push(offset);
      partes.push(texto);
      offset += Buffer.byteLength(texto, 'latin1');
    });

    const xref = offset;
    const filas = ['xref', `0 ${objetos.length + 1}`, '0000000000 65535 f '];
    posiciones.forEach((p) => filas.push(`${String(p).padStart(10, '0')} 00000 n `));
    partes.push(`${filas.join('\n')}\n`);
    partes.push(
      `trailer\n<< /Size ${objetos.length + 1} /Root 1 0 R `
      + `/Info << /Title (${this.escapar(this.titulo)}) /Producer (Afinia) >> >>\n`
      + `startxref\n${xref}\n%%EOF\n`,
    );

    return Buffer.from(partes.join(''), 'latin1');
  }
}
