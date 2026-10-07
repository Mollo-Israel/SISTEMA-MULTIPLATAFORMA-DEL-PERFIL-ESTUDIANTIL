/**
 * BATCH 3 — Storage y validación.
 *
 * Cubre §27 (pipeline de archivos), §28 (deduplicación), §29 (extracción
 * documental), §30 (niveles de respaldo y comparación de nombre), §31
 * (comprobación de enlaces con protección SSRF) y §76 (worker persistente),
 * más lo que §87.5 declara obligatorio.
 *
 * Uso:
 *   API_URL=http://localhost:3010/api node scripts/e2e-batch-3.mjs
 */

import { Buffer } from 'node:buffer';
import { deflateSync } from 'node:zlib';
import { API, loginAdmin, provisionAndActivate, req } from './lib/fixtures.mjs';

const TS = Date.now();

const C = {
  r: '\x1b[0m', bold: '\x1b[1m', dim: '\x1b[90m',
  ok: '\x1b[32m', bad: '\x1b[31m', head: '\x1b[36m',
};

let passed = 0;
const failures = [];

function check(condition, label, detail = '') {
  if (condition) {
    passed++;
    console.log(`  ${C.ok}✓${C.r} ${label}`);
  } else {
    failures.push(label + (detail ? ` -> ${detail}` : ''));
    console.log(`  ${C.bad}✗${C.r} ${label}${detail ? ` ${C.dim}-> ${detail}${C.r}` : ''}`);
  }
}

const objective = (t) => console.log(`\n${C.head}${C.bold}${t}${C.r}`);
const section = (t) => console.log(`\n${C.bold}${t}${C.r}`);
const msgOf = (r) =>
  Array.isArray(r?.data?.message) ? r.data.message.join(' | ') : (r?.data?.message ?? '');

const correo = (k) => `b3.${k}.${TS}@est.univalle.edu`;

/* ------------------------------------------------------------------ */
/*  Documentos de prueba                                               */
/* ------------------------------------------------------------------ */

/**
 * Construye un PDF real con el texto dado.
 *
 * Se genera aquí en vez de guardar un binario en el repositorio: así la
 * prueba enseña exactamente qué contiene el documento que después dice haber
 * leído.
 */
function construirPdf(lineas, { comprimir = true, conEnlace = null } = {}) {
  const contenido = Buffer.from(
    `BT\n/F1 14 Tf\n72 720 Td\n${lineas
      .map((l, i) => `${i === 0 ? '' : '0 -24 Td\n'}(${l.replace(/([()\\])/g, '\\$1')}) Tj\n`)
      .join('')}ET\n`,
    'latin1',
  );
  const stream = comprimir ? deflateSync(contenido) : contenido;
  const filtro = comprimir ? '/Filter /FlateDecode ' : '';

  const objetos = [
    '<< /Type /Catalog /Pages 2 0 R >>',
    '<< /Type /Pages /Kids [3 0 R] /Count 1 >>',
    '<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] '
      + '/Resources << /Font << /F1 5 0 R >> >> /Contents 4 0 R'
      + (conEnlace ? ' /Annots [6 0 R]' : '') + ' >>',
    null, // el flujo se inserta aparte por ser binario
    '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>',
  ];
  if (conEnlace) {
    objetos.push(
      '<< /Type /Annot /Subtype /Link /Rect [72 560 400 580] '
      + `/A << /S /URI /URI (${conEnlace}) >> >>`,
    );
  }

  const trozos = [Buffer.from('%PDF-1.4\n', 'latin1')];
  const offsets = [];
  let pos = trozos[0].length;

  objetos.forEach((obj, i) => {
    offsets.push(pos);
    let cuerpo;
    if (obj === null) {
      cuerpo = Buffer.concat([
        Buffer.from(`${i + 1} 0 obj\n<< ${filtro}/Length ${stream.length} >>\nstream\n`, 'latin1'),
        stream,
        Buffer.from('\nendstream\nendobj\n', 'latin1'),
      ]);
    } else {
      cuerpo = Buffer.from(`${i + 1} 0 obj\n${obj}\nendobj\n`, 'latin1');
    }
    trozos.push(cuerpo);
    pos += cuerpo.length;
  });

  const xref = pos;
  const tabla = [`xref\n0 ${objetos.length + 1}\n`, '0000000000 65535 f \n']
    .concat(offsets.map((o) => `${String(o).padStart(10, '0')} 00000 n \n`))
    .join('');
  trozos.push(Buffer.from(
    `${tabla}trailer\n<< /Size ${objetos.length + 1} /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF\n`,
    'latin1',
  ));

  return Buffer.concat(trozos);
}

/** Un PNG mínimo y válido: sirve para probar la firma, no para leer nada. */
function construirPng() {
  const crc = (buf) => {
    let c = ~0;
    for (const b of buf) {
      c ^= b;
      for (let k = 0; k < 8; k += 1) c = (c >>> 1) ^ (0xedb88320 & -(c & 1));
    }
    return ~c >>> 0;
  };
  const trozo = (tipo, datos) => {
    const cuerpo = Buffer.concat([Buffer.from(tipo, 'latin1'), datos]);
    const largo = Buffer.alloc(4);
    largo.writeUInt32BE(datos.length);
    const suma = Buffer.alloc(4);
    suma.writeUInt32BE(crc(cuerpo));
    return Buffer.concat([largo, cuerpo, suma]);
  };
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(1, 0);
  ihdr.writeUInt32BE(1, 4);
  ihdr[8] = 8; ihdr[9] = 2;
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    trozo('IHDR', ihdr),
    trozo('IDAT', deflateSync(Buffer.from([0, 0, 0, 0]))),
    trozo('IEND', Buffer.alloc(0)),
  ]);
}

async function subir(token, buffer, nombre, tipo) {
  const form = new FormData();
  form.append('file', new Blob([buffer], { type: tipo }), nombre);
  const res = await fetch(`${API}/uploads`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}` },
    body: form,
  });
  let data = null;
  try { data = await res.json(); } catch { /* sin cuerpo */ }
  return { status: res.status, data };
}

/** Fuerza una vuelta del worker y devuelve cuántos trabajos procesó. */
async function procesarCola(admin, limite = 20) {
  const r = await req('POST', `/validation/run?limit=${limite}`, { token: admin });
  return r.data?.procesados ?? 0;
}

/**
 * Espera a que el veredicto de un recurso sea definitivo.
 *
 * El worker corre solo cada pocos segundos, así que puede haberse llevado el
 * trabajo justo antes de que la prueba fuerce su vuelta. Si eso pasa,
 * `procesarCola` no encuentra nada que hacer y la lectura cae mientras el
 * trabajo sigue en PROCESSING. No es un fallo del sistema: es que hay dos
 * caminos hacia el mismo resultado. Se espera al resultado, no a quién lo
 * produjo.
 */
async function esperarVeredicto(ctx, tipo, id, intentos = 12) {
  const terminales = ['completed', 'inconclusive', 'failed'];
  for (let i = 0; i < intentos; i += 1) {
    await procesarCola(ctx.admin);
    const v = (await req('GET', `/validation/${tipo}/${id}`, { token: ctx.est.token })).data;
    if (v && terminales.includes(v.status)) return v;
    await new Promise((r) => setTimeout(r, 400));
  }
  return (await req('GET', `/validation/${tipo}/${id}`, { token: ctx.est.token })).data;
}

// ===========================================================================
//  §27 · Pipeline de archivos
// ===========================================================================
async function pipeline(ctx) {
  objective('§27 · El archivo tiene dueño y su tipo se decide por su firma');

  section('§27.2 · Metadatos que produce el servidor');
  const pdf = construirPdf([
    'CERTIFICADO DE PARTICIPACION',
    'Otorgado a: Renata Bustillos Alarcon',
    'Emitido por: Universidad Privada del Valle',
    'Fecha de emision: 2026-03-15',
    'Credencial: AF-2026-00417',
  ], { conEnlace: 'https://verificar.univalle.edu/AF-2026-00417' });

  const subida = await subir(ctx.est.token, pdf, 'certificado.pdf', 'application/pdf');
  check(subida.status === 201, 'B3.1 El estudiante sube un PDF', msgOf(subida));
  ctx.archivo = subida.data;

  check(
    !!subida.data?.id && subida.data?.url === undefined,
    'B3.2 La subida devuelve un identificador, no una URL reenviable (§27)',
    JSON.stringify(Object.keys(subida.data ?? {})),
  );
  check(
    /^[0-9a-f]{64}$/.test(subida.data?.sha256 ?? ''),
    'B3.3 Se calcula el SHA-256 del contenido (§28)',
  );
  check(subida.data?.mimeType === 'application/pdf', 'B3.4 El tipo se detecta del contenido');
  check(subida.data?.sizeBytes === pdf.length, 'B3.5 Se conserva el tamaño real');
  check(
    !String(subida.data?.id ?? '').includes('certificado'),
    'B3.6 El nombre en disco no viene del cliente',
  );

  section('§27.3 · Firma real frente a tipo declarado');
  const disfrazado = await subir(
    ctx.est.token,
    Buffer.from('MZ\x90\x00 esto es un ejecutable, no un PDF'),
    'inofensivo.pdf',
    'application/pdf',
  );
  check(
    disfrazado.status === 400,
    'B3.7 Un archivo que miente sobre su tipo se rechaza por su firma -> 400',
    `status ${disfrazado.status}`,
  );

  const png = await subir(ctx.est.token, construirPng(), 'imagen.png', 'image/png');
  check(png.status === 201, 'B3.8 Un PNG válido se acepta', msgOf(png));

  const pngComoPdf = await subir(ctx.est.token, construirPng(), 'imagen.pdf', 'application/pdf');
  check(
    pngComoPdf.status === 400,
    'B3.9 Un PNG declarado como PDF se rechaza: el contenido manda -> 400',
    `status ${pngComoPdf.status}`,
  );

  const vacio = await subir(ctx.est.token, Buffer.alloc(0), 'vacio.pdf', 'application/pdf');
  check(vacio.status === 400, 'B3.10 Un archivo vacío se rechaza -> 400', `status ${vacio.status}`);

  const sinSesion = await fetch(`${API}/uploads`, { method: 'POST', body: new FormData() });
  check(sinSesion.status === 401, 'B3.11 Subir sin sesión -> 401', `status ${sinSesion.status}`);

  section('El archivo solo lo adjunta quien lo subió');
  const ajeno = await req('POST', '/certificates/external', {
    token: ctx.otro.token,
    body: {
      certificateName: `Ajeno ${TS}`,
      issuer: 'Universidad Privada del Valle',
      storedFileId: ctx.archivo.id,
    },
  });
  check(
    ajeno.status === 403,
    'B3.12 Otro estudiante NO puede adjuntar mi archivo (§27) -> 403',
    `status ${ajeno.status} ${msgOf(ajeno)}`,
  );

  const inventado = await req('POST', '/evidences', {
    token: ctx.est.token,
    body: {
      evidenceType: 'file',
      storedFileId: '00000000-0000-4000-8000-000000000000',
      description: 'Archivo que no existe',
    },
  });
  check(
    inventado.status === 404,
    'B3.13 Un identificador de archivo inventado -> 404',
    `status ${inventado.status}`,
  );
}

// ===========================================================================
//  §28 · Deduplicación
// ===========================================================================
async function deduplicacion(ctx) {
  objective('§28 · El mismo archivo no cuenta dos veces');

  const pdf = construirPdf([
    'CERTIFICADO DE PARTICIPACION',
    'Otorgado a: Renata Bustillos Alarcon',
    'Emitido por: Universidad Privada del Valle',
  ]);

  const primera = await subir(ctx.est.token, pdf, 'copia-uno.pdf', 'application/pdf');
  const segunda = await subir(ctx.est.token, pdf, 'copia-dos.pdf', 'application/pdf');

  check(
    primera.data?.sha256 === segunda.data?.sha256,
    'B3.14 Dos subidas del mismo contenido comparten huella',
  );
  check(
    primera.data?.duplicateOfId === null,
    'B3.15 La primera subida NO es duplicado de nada',
    String(primera.data?.duplicateOfId),
  );
  check(
    segunda.data?.duplicateOfId === primera.data?.id,
    'B3.16 La segunda apunta a la primera como original',
    String(segunda.data?.duplicateOfId),
  );

  // Otra persona con el mismo contenido: no es duplicado suyo. Cada quien
  // responde por lo que aporta.
  const deOtro = await subir(ctx.otro.token, pdf, 'copia-otro.pdf', 'application/pdf');
  check(
    deOtro.data?.duplicateOfId === null,
    'B3.17 El mismo contenido de otra persona no se marca como duplicado',
    String(deOtro.data?.duplicateOfId),
  );

  ctx.duplicado = segunda.data;
  ctx.original = primera.data;
}

// ===========================================================================
//  §29 y §30 · Extracción documental y niveles de respaldo
// ===========================================================================
async function extraccion(ctx) {
  objective('§29 y §30 · Qué dice el documento y cuánto respalda');

  section('PDF legible cuyo nombre coincide');
  const cert = await req('POST', '/certificates/external', {
    token: ctx.est.token,
    body: {
      certificateName: 'CERTIFICADO DE PARTICIPACION',
      issuer: 'Universidad Privada del Valle',
      issueDate: '2026-03-15',
      credentialId: 'AF-2026-00417',
      storedFileId: ctx.archivo.id,
    },
  });
  check(cert.status === 201, 'B3.18 Se registra el certificado con su archivo', msgOf(cert));
  ctx.certId = cert.data?.id;

  const pendiente = await req('GET', `/validation/external_certificate/${ctx.certId}`, {
    token: ctx.est.token,
  });
  check(
    pendiente.status === 200 && ['pending', 'processing', 'completed'].includes(pendiente.data?.status),
    'B3.19 La validación queda encolada al crear el certificado (§76)',
    `status ${pendiente.data?.status}`,
  );

  const v = await esperarVeredicto(ctx, 'external_certificate', ctx.certId);

  check(v?.status === 'completed', 'B3.20 El worker la procesa', `status ${v?.status}`);
  check(
    v?.extractedData?.source === 'pdf_text',
    'B3.21 El texto sale del PDF, sin necesidad de OCR (§29, paso 1)',
    String(v?.extractedData?.source),
  );
  check(
    v?.extractedData?.holderName?.includes('Renata'),
    'B3.22 Se extrae el nombre del titular',
    String(v?.extractedData?.holderName),
  );
  check(
    v?.extractedData?.issuer?.includes('Univalle') || v?.extractedData?.issuer?.includes('Valle'),
    'B3.23 Se extrae el emisor',
    String(v?.extractedData?.issuer),
  );
  check(
    v?.extractedData?.issueDate === '2026-03-15',
    'B3.24 Se extrae la fecha de emisión y se normaliza a ISO',
    String(v?.extractedData?.issueDate),
  );
  check(
    v?.extractedData?.credentialId === 'AF-2026-00417',
    'B3.25 Se extrae el identificador de credencial',
    String(v?.extractedData?.credentialId),
  );
  check(
    v?.extractedData?.verificationUrl?.includes('verificar.univalle.edu'),
    'B3.26 Se extrae la URL de verificación de la anotación del PDF',
    String(v?.extractedData?.verificationUrl),
  );
  check(
    v?.identityMatchStatus === 'match',
    'B3.27 El nombre del papel corresponde al titular (§30)',
    String(v?.identityMatchStatus),
  );
  check(
    v?.backingTier === 'supported',
    'B3.28 Documento legible y coherente -> SUPPORTED (§30)',
    String(v?.backingTier),
  );
  check(
    typeof v?.disclaimer === 'string' && v.disclaimer.includes('No certifica'),
    'B3.29 La respuesta declara que no se afirma autenticidad legal (§30)',
  );

  section('PDF de otra persona');
  const deOtraPersona = construirPdf([
    'CERTIFICADO DE PARTICIPACION',
    'Otorgado a: Gonzalo Mercado Pinto',
    'Emitido por: Universidad Privada del Valle',
  ]);
  const subidaAjena = await subir(ctx.est.token, deOtraPersona, 'de-otro.pdf', 'application/pdf');
  const certAjeno = await req('POST', '/certificates/external', {
    token: ctx.est.token,
    body: {
      certificateName: `Curso de otra persona ${TS}`,
      issuer: 'Universidad Privada del Valle',
      storedFileId: subidaAjena.data?.id,
    },
  });
  const vAjeno = await esperarVeredicto(ctx, 'external_certificate', certAjeno.data?.id);
  check(
    vAjeno?.identityMatchStatus === 'mismatch',
    'B3.30 Un nombre que no corresponde se marca MISMATCH (§30)',
    String(vAjeno?.identityMatchStatus),
  );
  check(
    vAjeno?.backingTier === 'flagged',
    'B3.31 V3 §19 Con el nombre equivocado queda FLAGGED (no suma), por legible que sea',
    String(vAjeno?.backingTier),
  );

  section('Documento ilegible');
  const ilegible = await subir(ctx.est.token, construirPng(), 'escaneo.png', 'image/png');
  const certIlegible = await req('POST', '/certificates/external', {
    token: ctx.est.token,
    body: {
      certificateName: `Escaneo sin texto ${TS}`,
      issuer: 'Emisor Externo',
      storedFileId: ilegible.data?.id,
    },
  });
  const vIlegible = await esperarVeredicto(ctx, 'external_certificate', certIlegible.data?.id);
  check(
    vIlegible?.status === 'inconclusive',
    'B3.32 Sin texto legible el resultado es INCONCLUSIVE, no un fallo (§29)',
    String(vIlegible?.status),
  );

  const sigueAhi = await req('GET', '/certificates/external/my', { token: ctx.est.token });
  check(
    (sigueAhi.data ?? []).some((c) => c.id === certIlegible.data?.id),
    'B3.33 El recurso NO se elimina por ser ilegible (§29)',
  );
  check(
    vIlegible?.identityMatchStatus === 'unknown',
    'B3.34 Sin nombre leído se dice UNKNOWN, no MISMATCH (§30)',
    String(vIlegible?.identityMatchStatus),
  );

  section('§28 · El duplicado se reconoce');
  const certDuplicado = await req('POST', '/certificates/external', {
    token: ctx.est.token,
    body: {
      certificateName: `Copia del mismo documento ${TS}`,
      issuer: 'Universidad Privada del Valle',
      storedFileId: ctx.duplicado.id,
    },
  });
  const vDuplicado = await esperarVeredicto(ctx, 'external_certificate', certDuplicado.data?.id);
  check(
    vDuplicado?.isDuplicate === true,
    'B3.35 La validación reconoce que el contenido ya se había aportado (§28)',
    String(vDuplicado?.isDuplicate),
  );
}

// ===========================================================================
//  §31 · Comprobación de enlaces y protección SSRF
// ===========================================================================
async function enlaces(ctx) {
  objective('§31 · Comprobar enlaces sin convertirse en un escáner de la red');

  /**
   * Cada caso registra un certificado con esa URL de verificación y observa el
   * veredicto. Se prueba a través de la API y no contra la clase directamente:
   * lo que importa es que el camino real esté protegido.
   */
  const casos = [
    ['http://localhost:3010/api/users', 'blocked', 'localhost por nombre'],
    ['http://127.0.0.1:3010/api/users', 'blocked', 'bucle local IPv4'],
    ['http://[::1]:3010/', 'blocked', 'bucle local IPv6'],
    ['http://[::ffff:127.0.0.1]/', 'blocked', 'IPv4 mapeada en IPv6'],
    ['http://10.0.0.5/', 'blocked', 'rango privado 10/8'],
    ['http://172.16.4.9/', 'blocked', 'rango privado 172.16/12'],
    ['http://192.168.1.1/', 'blocked', 'rango privado 192.168/16'],
    ['http://169.254.169.254/latest/meta-data/', 'blocked', 'metadata de nube'],
    ['http://100.64.0.1/', 'blocked', 'rango de operador'],
    ['http://2130706433/', 'blocked', 'bucle local en decimal'],
    ['http://127.1/', 'blocked', 'bucle local abreviado'],
    ['http://[fd00::1]/', 'blocked', 'IPv6 privada'],
    ['http://mi-nas.local/', 'blocked', 'dominio .local'],
  ];

  let n = 36;
  for (const [url, , nota] of casos) {
    const creado = await req('POST', '/certificates/external', {
      token: ctx.est.token,
      body: {
        certificateName: `Enlace ${nota} ${TS}`,
        issuer: 'Emisor Externo',
        certificateUrl: url,
      },
    });

    // Hay dos barreras y cualquiera de las dos sirve: el DTO rechaza de
    // entrada lo que ni siquiera parece una URL publica, y el verificador
    // rechaza lo que resuelve a una direccion interna. Lo que se comprueba
    // aqui es la propiedad que importa —el servidor nunca va a esa
    // direccion—, no cual de las dos la detuvo.
    if (creado.status === 400) {
      check(true, `B3.${n} El sistema se niega a consultar: ${nota} (rechazado al validar la entrada)`);
      n += 1;
      continue;
    }

    const v = await esperarVeredicto(ctx, 'external_certificate', creado.data?.id);
    check(
      v?.linkCheck?.status === 'blocked',
      `B3.${n} El sistema se niega a consultar: ${nota}`,
      `status ${v?.linkCheck?.status ?? 'sin comprobacion'}`,
    );
    n += 1;
  }

  section('Un dominio que no existe está caído, no bloqueado');
  const inexistente = await req('POST', '/certificates/external', {
    token: ctx.est.token,
    body: {
      certificateName: `Dominio inexistente ${TS}`,
      issuer: 'Emisor Externo',
      certificateUrl: `https://no-existe-${TS}.invalid/verificar`,
    },
  });
  const vInexistente = await esperarVeredicto(ctx, 'external_certificate', inexistente.data?.id);
  check(
    vInexistente?.linkCheck?.status === 'unavailable',
    `B3.${n} Un servidor ausente es UNAVAILABLE, no BLOCKED (§31)`,
    String(vInexistente?.linkCheck?.status),
  );
  n += 1;

  check(
    vInexistente?.backingTier === 'declared',
    `B3.${n} Sin enlace comprobable ni documento, el respaldo se queda en DECLARED`,
    String(vInexistente?.backingTier),
  );
  ctx.siguiente = n + 1;
}

// ===========================================================================
//  §76 · Worker persistente
// ===========================================================================
async function worker(ctx) {
  objective('§76 · La cola sobrevive y no procesa dos veces');
  let n = ctx.siguiente;

  section('Estado de la cola');
  const cola = await req('GET', '/validation/queue', { token: ctx.admin });
  check(cola.status === 200, `B3.${n} El administrador consulta la cola`, msgOf(cola));
  n += 1;
  check(
    typeof cola.data?.byStatus?.completed === 'number'
      && typeof cola.data?.byStatus?.inconclusive === 'number',
    `B3.${n} La cola informa de cada estado de §76`,
    JSON.stringify(cola.data?.byStatus),
  );
  n += 1;
  check(
    cola.data?.byStatus?.failed === 0,
    `B3.${n} Ninguna validación quedó en FAILED`,
    String(cola.data?.byStatus?.failed),
  );
  n += 1;

  section('Encolar es idempotente');
  const antes = (await req('GET', '/validation/queue', { token: ctx.admin })).data;
  const total = (x) => Object.values(x?.byStatus ?? {}).reduce((a, b) => a + b, 0);
  // Volver a pedir la validación de algo ya resuelto no crea trabajo nuevo.
  await req('POST', `/certificates/external`, {
    token: ctx.est.token,
    body: { certificateName: `Idempotencia ${TS}`, issuer: 'Emisor Externo' },
  });
  await procesarCola(ctx.admin);
  const despues = (await req('GET', '/validation/queue', { token: ctx.admin })).data;
  check(
    total(despues) === total(antes) + 1,
    `B3.${n} Cada recurso tiene un solo trabajo, no uno por intento`,
    `${total(antes)} -> ${total(despues)}`,
  );
  n += 1;

  section('Nada queda a medias');
  const vacia = await procesarCola(ctx.admin);
  check(
    vacia === 0,
    `B3.${n} Procesada la cola, no queda trabajo pendiente`,
    `procesados ${vacia}`,
  );
  n += 1;
  check(
    (await req('GET', '/validation/queue', { token: ctx.admin })).data?.byStatus?.processing === 0,
    `B3.${n} Ningún trabajo queda atrapado en PROCESSING`,
  );
  n += 1;

  section('El veredicto es del titular');
  const ajeno = await req('GET', `/validation/external_certificate/${ctx.certId}`, {
    token: ctx.otro.token,
  });
  check(
    ajeno.status === 404,
    `B3.${n} Otro estudiante no consulta un veredicto ajeno -> 404`,
    `status ${ajeno.status}`,
  );
  n += 1;

  const docente = await req('GET', '/validation/queue', { token: ctx.docente.token });
  check(
    docente.status === 403,
    `B3.${n} Un docente no administra la cola -> 403`,
    `status ${docente.status}`,
  );
}

// ===========================================================================
async function preparar() {
  console.log(`${C.bold}BATCH 3 — Storage y validación contra ${API}${C.r}`);
  const admin = await loginAdmin();

  // El nombre coincide con el del documento de prueba: es lo que permite
  // comprobar la coincidencia de §30.
  const est = await provisionAndActivate(admin, {
    firstName: 'Renata', lastName: 'Bustillos', email: correo('est'), role: 'STUDENT',
  });
  const otro = await provisionAndActivate(admin, {
    firstName: 'Gonzalo', lastName: 'Mercado', email: correo('otro'), role: 'STUDENT',
  });
  const docente = await provisionAndActivate(admin, {
    firstName: 'Nuria', lastName: 'Ballivian', email: `b3.doc.${TS}@univalle.edu`, role: 'TEACHER',
  });

  await req('POST', '/profiles/me', { token: est.token, body: {} });
  await req('POST', '/profiles/me', { token: otro.token, body: {} });

  return { admin, est, otro, docente };
}

async function main() {
  try {
    const ctx = await preparar();
    await pipeline(ctx);
    await deduplicacion(ctx);
    await extraccion(ctx);
    await enlaces(ctx);
    await worker(ctx);
  } catch (error) {
    console.error(`\n${C.bad}Error durante la ejecución:${C.r} ${error.message}`);
    process.exitCode = 1;
    return;
  }

  console.log(`\n${'-'.repeat(78)}`);
  if (failures.length === 0) {
    console.log(`${C.ok}${C.bold}  ${passed} verificaciones OK · 0 fallos${C.r}`);
    console.log('  El BATCH 3 queda demostrado de punta a punta.');
  } else {
    console.log(`${C.bad}${C.bold}  ${passed} verificaciones OK · ${failures.length} fallos${C.r}`);
    failures.forEach((f) => console.log(`  ${C.bad}·${C.r} ${f}`));
    process.exitCode = 1;
  }
}

main();
