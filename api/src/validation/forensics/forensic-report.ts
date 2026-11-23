/**
 * V9 · Análisis forense del archivo de una credencial externa.
 *
 * El validador de V3 comprueba lo que el documento **dice** contra la fuente
 * oficial. Esto mira el **archivo en sí**: con qué se hizo, si se retocó
 * después de emitido, si trae una firma digital que se pueda comprobar y si
 * declara haber sido generado por inteligencia artificial.
 *
 * Reglas de interpretación (las aplica `decideCredentialBacking`):
 *
 * - Una señal `critical` es una contradicción: la credencial queda Observada.
 *   Solo se usan para hechos comprobables (firma rota, edición posterior a la
 *   firma, marca explícita de contenido generado por IA).
 * - Una señal `warning` nunca acusa, pero impide que el documento por sí solo
 *   dé respaldo: hace falta una fuente oficial o una persona.
 * - `info` se muestra a quien revisa y no cambia nada.
 *
 * Nada de esto prueba que un documento sin señales sea auténtico: la ausencia
 * de rastros de edición no es una prueba (los metadatos se pueden borrar).
 */

export type ForensicSeverity = 'critical' | 'warning' | 'info';

export type ForensicCode =
  /** El archivo declara haber sido generado o compuesto con IA (C2PA, IPTC, parámetros de Stable Diffusion…). */
  | 'ai_generated'
  /** La firma digital del PDF no corresponde a su contenido: se cambió algún byte firmado. */
  | 'signature_broken'
  /** Se agregó contenido al PDF después de firmarlo. */
  | 'modified_after_signature'
  /** Pasó por un editor de imágenes (Photoshop, GIMP…). */
  | 'image_editor'
  /** Pasó por un editor de PDF o de diseño en línea (Canva, iLovePDF, Sejda…). */
  | 'online_editor'
  /** El PDF, sin firma, se guardó varias veces sobre sí mismo. */
  | 'incremental_edits'
  /** La fecha de modificación es bastante posterior a la de creación. */
  | 'modified_later'
  /** Una fecha interna está en el futuro. */
  | 'future_date'
  /** Se «imprimió» a PDF: se perdió el archivo original del emisor. */
  | 'reprinted'
  /** Tiene credenciales de contenido (C2PA) sin marca de IA. */
  | 'content_credentials'
  /** Es casi idéntico al archivo que registró otro estudiante. */
  | 'near_duplicate_other_student'
  /** Firmado, pero por un certificado que no lleva a una raíz de confianza pública. */
  | 'signature_untrusted';

export interface ForensicSignal {
  code: ForensicCode;
  severity: ForensicSeverity;
  /** Dato concreto, corto, para quien revisa: «Adobe Photoshop 25.1», «3 revisiones». */
  detail: string | null;
}

export interface DocumentSignatureReport {
  present: true;
  subFilter: string | null;
  /** La firma cubre el archivo completo (no se agregó nada después). */
  coversWholeFile: boolean;
  /** El resumen firmado corresponde a los bytes del documento. */
  integrity: boolean | null;
  /** La firma criptográfica del firmante es válida. */
  signatureValid: boolean | null;
  /** La cadena del firmante llega a una raíz pública de confianza. */
  trusted: boolean | null;
  signerName: string | null;
  signerOrganization: string | null;
  signerEmail: string | null;
  signingTime: string | null;
  /** El firmante corresponde al emisor declarado. `null` si no hay base para juzgarlo. */
  issuerMatches: boolean | null;
  error: string | null;
}

export interface ForensicReport {
  kind: 'pdf' | 'image' | 'other';
  /** Programa que produjo el archivo, según sus propios metadatos. */
  producer: string | null;
  creator: string | null;
  createdAt: string | null;
  modifiedAt: string | null;
  /** Veces que el PDF se guardó sobre sí mismo (1 = una sola versión). */
  revisions: number | null;
  signals: ForensicSignal[];
  signature: DocumentSignatureReport | null;
  /** dHash de 256 bits en hexadecimal (solo imágenes). */
  perceptualHash: string | null;
}

export const emptyReport = (kind: ForensicReport['kind']): ForensicReport => ({
  kind,
  producer: null,
  creator: null,
  createdAt: null,
  modifiedAt: null,
  revisions: null,
  signals: [],
  signature: null,
  perceptualHash: null,
});

// ===========================================================================
//  Programas reconocidos
// ===========================================================================

/** Editores de imagen: con ellos se cambia un nombre sobre un certificado escaneado. */
const EDITORES_DE_IMAGEN: readonly [RegExp, string][] = [
  [/photoshop/i, 'Adobe Photoshop'],
  [/\bgimp\b/i, 'GIMP'],
  [/paint\.net/i, 'Paint.NET'],
  [/pixelmator/i, 'Pixelmator'],
  [/affinity (photo|designer)/i, 'Affinity'],
  [/photopea/i, 'Photopea'],
  [/pixlr/i, 'Pixlr'],
  [/picsart/i, 'PicsArt'],
  [/krita/i, 'Krita'],
  [/inkscape/i, 'Inkscape'],
  [/corel(draw|\s*photo)/i, 'Corel'],
];

/** Editores de PDF y de diseño, casi siempre en línea. */
const EDITORES_EN_LINEA: readonly [RegExp, string][] = [
  [/\bcanva\b/i, 'Canva'],
  [/ilovepdf/i, 'iLovePDF'],
  [/smallpdf/i, 'Smallpdf'],
  [/sejda/i, 'Sejda'],
  [/pdfescape/i, 'PDFescape'],
  [/pdf-xchange/i, 'PDF-XChange'],
  [/pdfelement|wondershare/i, 'PDFelement'],
  [/foxit (phantom|pdf editor|editor)/i, 'Foxit Editor'],
  [/\bnitro\b/i, 'Nitro'],
  [/pdffiller/i, 'pdfFiller'],
  [/docfly/i, 'DocFly'],
  [/pdf candy/i, 'PDF Candy'],
  [/soda pdf/i, 'Soda PDF'],
  [/adobe acrobat.*\bedit/i, 'Acrobat (edición)'],
];

/** «Imprimir a PDF»: no es una edición, pero ya no es el archivo del emisor. */
const REIMPRESION: readonly [RegExp, string][] = [
  [/microsoft:?\s*print to pdf/i, 'Microsoft Print to PDF'],
  [/cutepdf/i, 'CutePDF'],
  [/pdfcreator/i, 'PDFCreator'],
  [/bullzip/i, 'Bullzip'],
  [/dopdf/i, 'doPDF'],
  [/skia\/pdf/i, 'Chrome (imprimir)'],
];

/** Herramientas de generación con IA que dejan su nombre en los metadatos. */
const GENERADORES_IA =
  /\b(dall[·.\- ]?e|openai|chatgpt|gpt-4o|adobe firefly|firefly|midjourney|stable[ -]?diffusion|sdxl|novelai|comfyui|automatic1111|invokeai|leonardo\.ai|ideogram|bing image creator|microsoft designer|imagen [0-9]|gemini|grok|flux\.1|runway)\b/i;

/** IPTC Digital Source Type: el vocabulario estándar para declarar contenido de IA. */
const FUENTE_IA = /(trainedAlgorithmicMedia|compositeWithTrainedAlgorithmicMedia|algorithmicMedia|compositeSynthetic)/;

export function clasificarPrograma(nombre: string | null): ForensicSignal | null {
  if (!nombre) return null;
  for (const [re, etiqueta] of EDITORES_DE_IMAGEN) {
    if (re.test(nombre)) return { code: 'image_editor', severity: 'warning', detail: recortar(`${etiqueta} · ${nombre}`) };
  }
  for (const [re, etiqueta] of EDITORES_EN_LINEA) {
    if (re.test(nombre)) return { code: 'online_editor', severity: 'warning', detail: recortar(`${etiqueta} · ${nombre}`) };
  }
  for (const [re, etiqueta] of REIMPRESION) {
    if (re.test(nombre)) return { code: 'reprinted', severity: 'info', detail: recortar(`${etiqueta} · ${nombre}`) };
  }
  return null;
}

/**
 * Marca IPTC de contenido generado por IA en un bloque de metadatos completo
 * (XMP o manifiesto C2PA). Es un URI del vocabulario estándar: no aparece por
 * casualidad en el título de un curso.
 *
 * Solo marcas explícitas: no se «adivina» si una imagen parece hecha con IA.
 * Un detector estadístico daría falsos positivos y acusaría a estudiantes
 * honestos; una marca escrita por la propia herramienta no.
 */
export function fuenteIa(metadatos: string): string | null {
  const fuente = FUENTE_IA.exec(metadatos);
  return fuente ? `IPTC DigitalSourceType: ${fuente[1]}` : null;
}

/**
 * Generador de IA en un campo de **programa** (CreatorTool, Producer,
 * Software, claim_generator). Nunca se busca en el texto visible ni en el
 * título: un certificado del curso «Generative AI with Gemini» no es una
 * imagen generada por Gemini.
 */
export function generadorIa(programa: string | null): string | null {
  if (!programa) return null;
  const gen = GENERADORES_IA.exec(programa);
  return gen ? `Generador: ${recortar(programa, 80)}` : null;
}

export function recortar(s: string, max = 120): string {
  const limpio = s.replace(/[\u0000-\u001f]+/g, ' ').replace(/\s+/g, ' ').trim();
  return limpio.length > max ? `${limpio.slice(0, max - 1)}…` : limpio;
}

/** Agrega una señal sin repetir el mismo código con el mismo detalle. */
export function agregarSenal(lista: ForensicSignal[], s: ForensicSignal | null): void {
  if (!s) return;
  if (lista.some((x) => x.code === s.code && x.detail === s.detail)) return;
  lista.push(s);
}

/** Las señales que convierten la credencial en Observada. */
export const CRITICAL_FORENSIC_CODES: readonly ForensicCode[] = [
  'ai_generated', 'signature_broken', 'modified_after_signature',
];
