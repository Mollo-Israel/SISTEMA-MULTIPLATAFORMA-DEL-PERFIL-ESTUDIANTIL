/**
 * V9 · Validación reforzada de credenciales externas, de punta a punta.
 *
 * La aplicación real contra `afinia_test`: dos estudiantes reales (Ana y
 * Luis) intentan las trampas habituales —registrar el certificado de un
 * compañero, el mismo código, una imagen generada con IA, un código impreso
 * editado con el QR original— y se comprueba lo que ve cada uno. También
 * los correos personales comprobados (sin ellos, una insignia de Credly
 * enviada al Gmail del estudiante no se puede reconocer como suya).
 *
 * Repetible: cada corrida usa códigos e imágenes nuevos.
 */
import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { createHash, randomBytes } from 'node:crypto';
import { crc32 } from 'node:zlib';
import { ValidationResourceType } from '@perfil/shared';
import { crearApp, db, entrar } from '../app';
import { ValidationService } from '../../../src/validation/validation.service';
import { encodeQr } from '../../../src/collaboration/qr-encoder';

// eslint-disable-next-line @typescript-eslint/no-var-requires
const { PNG } = require('pngjs');

const ANA = 'ana.quispe@est.univalle.edu';
const LUIS = 'luis.mamani@est.univalle.edu';
const RUN = randomBytes(3).toString('hex').toUpperCase();

function bloquePng(tipo: string, datos: Buffer): Buffer {
  const largo = Buffer.alloc(4);
  largo.writeUInt32BE(datos.length);
  const td = Buffer.concat([Buffer.from(tipo, 'latin1'), datos]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(td) >>> 0);
  return Buffer.concat([largo, td, crc]);
}

/** Imagen única por corrida (patrón aleatorio) con bloques de texto opcionales. */
function imagen(extra: [string, string][] = []): Buffer {
  const semilla = randomBytes(8);
  const img = new PNG({ width: 96, height: 64 });
  for (let i = 0; i < 96 * 64; i += 1) {
    img.data[i * 4] = semilla[i % 8] ^ (i & 0xff);
    img.data[i * 4 + 1] = (semilla[(i + 3) % 8] * i) & 0xff;
    img.data[i * 4 + 2] = (i * 13) & 0xff;
    img.data[i * 4 + 3] = 255;
  }
  const base: Buffer = PNG.sync.write(img);
  const iend = base.length - 12;
  const bloques = extra.map(([k, v]) => bloquePng('tEXt', Buffer.concat([Buffer.from(k, 'latin1'), Buffer.from([0]), Buffer.from(v, 'latin1')])));
  return Buffer.concat([base.subarray(0, iend), ...bloques, base.subarray(iend)]);
}

/** Certificado modelo en PDF con texto nativo (la fase 1 no necesita OCR). */
function pdfModelo(proveedor: string): Buffer {
  const lineas = [proveedor, 'Certificado de finalizacion', 'Otorgado a Persona Modelo', `Curso de prueba V9 ${RUN}`];
  const contenido = `BT\n/F1 14 Tf\n72 720 Td\n${lineas.map((l, i) => `${i ? '0 -24 Td\n' : ''}(${l}) Tj\n`).join('')}ET\n`;
  const objetos = [
    '<< /Type /Catalog /Pages 2 0 R >>',
    '<< /Type /Pages /Kids [3 0 R] /Count 1 >>',
    '<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Resources << /Font << /F1 5 0 R >> >> /Contents 4 0 R >>',
    `<< /Length ${Buffer.byteLength(contenido, 'latin1')} >>\nstream\n${contenido}\nendstream`,
    '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>',
  ];
  let out = '%PDF-1.4\n';
  const offsets: number[] = [];
  objetos.forEach((o, i) => { offsets.push(Buffer.byteLength(out, 'latin1')); out += `${i + 1} 0 obj\n${o}\nendobj\n`; });
  const xref = Buffer.byteLength(out, 'latin1');
  out += `xref\n0 ${objetos.length + 1}\n0000000000 65535 f \n${offsets.map((o) => `${String(o).padStart(10, '0')} 00000 n \n`).join('')}`;
  out += `trailer\n<< /Size ${objetos.length + 1} /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF\n`;
  return Buffer.from(out, 'latin1');
}

/** PNG con un QR que lleva `texto`, como el de un certificado escaneado. */
function imagenConQr(texto: string): Buffer {
  const qr = encodeQr(texto);
  const m = 8;
  const margen = 4;
  const lado = (qr.size + margen * 2) * m;
  const img = new PNG({ width: lado, height: lado });
  for (let y = 0; y < lado; y += 1) {
    for (let x = 0; x < lado; x += 1) {
      const fy = Math.floor(y / m) - margen;
      const fx = Math.floor(x / m) - margen;
      const oscuro = fy >= 0 && fx >= 0 && fy < qr.size && fx < qr.size && qr.modules[fy][fx];
      const i = (y * lado + x) * 4;
      const v = oscuro ? 0 : 255;
      img.data[i] = v; img.data[i + 1] = v; img.data[i + 2] = v; img.data[i + 3] = 255;
    }
  }
  return PNG.sync.write(img);
}

describe('V9 · Validación reforzada (API)', () => {
  let app: INestApplication;
  let tAna: string;
  let tLuis: string;
  let validacion: ValidationService;
  const http = () => request(app.getHttpServer());
  const con = (r: request.Test, t: string) => r.set('Authorization', `Bearer ${t}`);

  const subir = async (t: string, archivo: Buffer, nombre = 'certificado.png') => {
    const r = await con(http().post('/api/uploads'), t).attach('file', archivo, nombre);
    expect(r.status).toBe(201);
    return r.body.id as string;
  };

  /**
   * V7.1 §5.2 (BATCH V7-3): una histórica ya no pasa por el procesamiento
   * automático, así que las señales de V9 se prueban con credenciales
   * vinculadas a una oportunidad con certificado modelo, que es la ruta que
   * hoy se comprueba. Cada registro usa una oportunidad nueva (una credencial
   * por estudiante y oportunidad) en la que Ana y Luis fueron aceptados.
   */
  let n = 0;
  let tDir: string;
  let categoria: string;
  let area: string;
  const oportunidad = async (proveedor: string) => {
    const a = await con(http().post('/api/activities'), tDir).send({
      title: `Oportunidad V9 ${RUN} ${n}`, type: 'academica', categoryId: categoria, status: 'open', originType: 'external',
      provider: proveedor, externalUrl: 'https://oportunidad.example.org', outcomePolicy: 'external_credential_expected',
      activityDate: new Date(Date.now() + 864e5).toISOString(), endAt: new Date(Date.now() + 2 * 864e5).toISOString(),
      modality: 'presencial', location: 'Aula de pruebas', areaIds: [area], semesterScope: [1, 2, 3, 4, 5, 6, 7, 8],
    });
    expect(a.status).toBe(201);
    for (const t of [tAna, tLuis]) {
      await con(http().post(`/api/activities/${a.body.id}/register`), t);
      const perfil = await con(http().get('/api/profiles/me'), t);
      const ok = await con(http().patch(`/api/activities/${a.body.id}/confirm-participation`), tDir).send({ studentProfileId: perfil.body.id, status: 'accepted' });
      expect(ok.status).toBe(200);
    }
    const modelo = await subir(tDir, pdfModelo(proveedor), 'modelo.pdf');
    expect((await con(http().put(`/api/activities/${a.body.id}/validation-reference`), tDir).send({ sampleStoredFileId: modelo })).status).toBe(200);
    expect((await con(http().patch(`/api/activities/${a.body.id}`), tDir).send({ status: 'finished' })).status).toBe(200);
    return a.body.id as string;
  };
  const ultimaPorProveedor = new Map<string, { id: string; usada: Set<string> }>();
  /** Registra la credencial y corre el validador sobre ella (el worker está apagado en pruebas). */
  const registrar = async (t: string, cuerpo: Record<string, unknown>) => {
    n += 1;
    const proveedor = (cuerpo.issuer as string | undefined) ?? 'Huawei ICT Academy';
    // Ana y Luis comparten oportunidad: así «el mismo X por otro estudiante» es literal.
    let op = ultimaPorProveedor.get(proveedor);
    if (!op || op.usada.has(t)) {
      op = { id: await oportunidad(proveedor), usada: new Set() };
      ultimaPorProveedor.set(proveedor, op);
    }
    op.usada.add(t);
    const { issuer: _ignorado, ...resto } = cuerpo;
    const archivo = resto.storedFileId ?? await subir(t, imagen());
    const r = await con(http().post('/api/certificates/external'), t).send({ activityId: op.id, ...resto, storedFileId: archivo });
    expect(r.status).toBe(201);
    const id = r.body.id as string;
    // El trabajo se reclama como lo haría el worker: un resultado solo se aplica a un trabajo reclamado (C19).
    await db(app).query(
      `UPDATE validation_records SET status = 'processing', claimed_by = 'jest-v9', started_at = now(), attempts = attempts + 1 WHERE resource_id = $1`, [id],
    );
    const hecho = await validacion.process(await validacion.findForOrFail(ValidationResourceType.EXTERNAL_CERTIFICATE, id));
    return { id, v: hecho };
  };

  beforeAll(async () => {
    app = await crearApp();
    validacion = app.get(ValidationService);
    tAna = await entrar(app, ANA);
    tLuis = await entrar(app, LUIS);
    tDir = await entrar(app, 'jorge.vargas@univalle.edu');
    const cats = await con(http().get('/api/activity-categories'), tDir);
    categoria = (cats.body.find((c: { code: string }) => c.code === 'curso_externo_recomendado') ?? cats.body[0]).id;
    const areas = await con(http().get('/api/academic-areas'), tDir);
    area = (areas.body.find((x: { code: string }) => x.code === 'ingenieria_de_software') ?? areas.body[0]).id;
  });

  afterAll(async () => {
    await db(app).query(`DELETE FROM student_verified_emails WHERE email LIKE 'v9-%@correo-personal.test'`);
    await app.close();
  });

  // ------------------------------------------------------------------ antifraude
  it('el mismo archivo registrado después por otro estudiante queda Observado; el primero no', async () => {
    const archivo = imagen();
    const deAna = await registrar(tAna, { storedFileId: await subir(tAna, archivo) });
    const deLuis = await registrar(tLuis, { storedFileId: await subir(tLuis, archivo) });

    expect(deAna.v.credentialCheck?.contradictions).not.toContain('shared_with_other_student');
    expect(deLuis.v.credentialCheck?.contradictions).toContain('shared_with_other_student');
    expect(deLuis.v.credentialCheck?.sharing?.sameFile).toBe(1);
    expect(deLuis.v.backingTier).toBe('flagged');

    // Queda en la auditoría para Dirección, sin datos del otro estudiante en la credencial.
    const [ev] = await db(app).query(`SELECT metadata FROM audit_events WHERE event_type = 'EXTERNAL_CREDENTIAL_SHARED' AND entity_id = $1`, [deLuis.id]);
    expect(ev.metadata.sameFile).toBe(1);
    expect(JSON.stringify(deLuis.v.credentialCheck)).not.toContain(deAna.id);
  });

  it('el mismo código de credencial (con otro formato) registrado por otro estudiante queda Observado', async () => {
    const codigo = `ICTCRA2025${RUN}1275`;
    await registrar(tAna, { credentialId: codigo });
    const deLuis = await registrar(tLuis, { credentialId: codigo.toLowerCase().replace(/(\d{4})/, '$1-') });
    expect(deLuis.v.credentialCheck?.sharing?.sameCredentialId).toBe(1);
    expect(deLuis.v.backingTier).toBe('flagged');
  });

  it('el mismo enlace individual de verificación registrado por otro estudiante queda Observado', async () => {
    const url = `https://www.credly.com/badges/${createHash('md5').update(RUN).digest('hex').replace(/^(.{8})(.{4})(.{4})(.{4})(.{12})$/, '$1-$2-$3-$4-$5')}/public_url`;
    await registrar(tAna, { issuer: 'IBM', certificateUrl: url });
    const deLuis = await registrar(tLuis, { issuer: 'IBM', certificateUrl: `${url}?utm_source=linkedin` });
    expect(deLuis.v.credentialCheck?.sharing?.sameUrl).toBe(1);
    expect(deLuis.v.credentialCheck?.contradictions).toContain('shared_with_other_student');
  });

  // --------------------------------------------------------------------- forense
  it('una imagen con parámetros de Stable Diffusion queda Observada por IA', async () => {
    const ia = imagen([['parameters', 'certificate of completion, huawei\nSteps: 28, Sampler: DPM++ 2M, CFG scale: 7, Seed: 42']]);
    const r = await registrar(tAna, { storedFileId: await subir(tAna, ia) });
    expect(r.v.credentialCheck?.contradictions).toContain('ai_generated_document');
    expect(r.v.credentialCheck?.forensics?.signals).toContainEqual(expect.objectContaining({ code: 'ai_generated', severity: 'critical' }));
    expect(r.v.backingTier).toBe('flagged');
  });

  it('una imagen pasada por Photoshop no se acusa, pero queda con la advertencia', async () => {
    const ps = imagen([['Software', 'Adobe Photoshop 25.0 (Windows)']]);
    const r = await registrar(tAna, { storedFileId: await subir(tAna, ps) });
    expect(r.v.credentialCheck?.forensics?.signals).toContainEqual(expect.objectContaining({ code: 'image_editor', severity: 'warning' }));
    expect(r.v.credentialCheck?.contradictions).not.toContain('ai_generated_document');
    expect(r.v.backingTier).not.toBe('corroborated');
  });

  it('código impreso editado con el QR original: QR y código no coinciden', async () => {
    const qr = imagenConQr(`https://e.huawei.com/en/talent/cert?code=ICTCRA2025${RUN}9999`);
    const r = await registrar(tAna, { storedFileId: await subir(tAna, qr), credentialId: `ICTCRA2025${RUN}1275` });
    expect(r.v.extractedData?.qrPayloads?.[0]).toContain('ICTCRA');
    expect(r.v.credentialCheck?.contradictions).toContain('qr_code_mismatch');
    expect(r.v.backingTier).toBe('flagged');
  });

  it('el estudiante ve las señales; el validador quedó en la versión 4', async () => {
    const r = await registrar(tAna, { storedFileId: await subir(tAna, imagen([['Software', 'Canva']])) });
    expect(r.v.validatorVersion).toBe(4);
    const vista = await con(http().get(`/api/validation/external_certificate/${r.id}`), tAna);
    expect(vista.status).toBe(200);
    expect(JSON.stringify(vista.body)).toContain('online_editor');
  });

  // ----------------------------------------------------------- correos personales
  describe('correos personales comprobados', () => {
    const correo = `v9-${RUN.toLowerCase()}@correo-personal.test`;
    let id: string;
    const fijarCodigo = async (codigo: string) => {
      const hash = createHash('sha256').update(`afinia-correo:${id}:${codigo}`).digest('hex');
      await db(app).query(`UPDATE student_verified_emails SET code_hash = $1, code_expires_at = now() + interval '10 minutes', attempts = 0 WHERE id = $2`, [hash, id]);
    };

    it('agregar envía un código (correo simulado) y queda pendiente', async () => {
      const r = await con(http().post('/api/verified-emails'), tAna).send({ email: correo.toUpperCase() });
      expect(r.status).toBe(201);
      expect(r.body).toEqual(expect.objectContaining({ email: correo, verified: false }));
      id = r.body.id;
    });

    it('el correo institucional propio no se agrega, ni un correo inválido', async () => {
      expect((await con(http().post('/api/verified-emails'), tAna).send({ email: ANA })).status).toBe(400);
      expect((await con(http().post('/api/verified-emails'), tAna).send({ email: 'no-es-correo' })).status).toBe(400);
    });

    it('reenviar antes de un minuto no se permite', async () => {
      expect((await con(http().post(`/api/verified-emails/${id}/resend`), tAna)).status).toBe(429);
    });

    it('un código incorrecto no comprueba; cinco errores invalidan el código', async () => {
      await fijarCodigo('111111');
      for (let n = 0; n < 5; n += 1) {
        expect((await con(http().post(`/api/verified-emails/${id}/confirm`), tAna).send({ code: '222222' })).status).toBe(400);
      }
      // Ni el correcto sirve ya.
      expect((await con(http().post(`/api/verified-emails/${id}/confirm`), tAna).send({ code: '111111' })).status).toBe(400);
    });

    it('con el código correcto queda comprobado', async () => {
      await fijarCodigo('654321');
      const r = await con(http().post(`/api/verified-emails/${id}/confirm`), tAna).send({ code: '654 321' });
      expect(r.status).toBe(200);
      expect(r.body.verified).toBe(true);
      const lista = await con(http().get('/api/verified-emails'), tAna);
      expect(lista.body).toContainEqual(expect.objectContaining({ email: correo, verified: true }));
    });

    it('otro estudiante no puede reclamar un correo ya comprobado, ni confirmar uno ajeno', async () => {
      const r = await con(http().post('/api/verified-emails'), tLuis).send({ email: correo });
      expect(r.status).toBe(409);
      expect(JSON.stringify(r.body)).not.toContain('Ana');
      expect((await con(http().post(`/api/verified-emails/${id}/confirm`), tLuis).send({ code: '654321' })).status).toBe(404);
      expect((await con(http().delete(`/api/verified-emails/${id}`), tLuis)).status).toBe(404);
    });

    it('el validador usa el correo comprobado como correo del estudiante', async () => {
      const [perfil] = await db(app).query(`SELECT sp.user_id FROM student_profiles sp JOIN users u ON u.id = sp.user_id WHERE u.email = $1`, [ANA]);
      const [fila] = await db(app).query(`SELECT email FROM student_verified_emails WHERE user_id = $1 AND verified_at IS NOT NULL`, [perfil.user_id]);
      expect(fila.email).toBe(correo);
    });

    it('un docente no usa esta función', async () => {
      const tDoc = await entrar(app, 'carlos.perez@univalle.edu');
      expect((await con(http().get('/api/verified-emails'), tDoc)).status).toBe(403);
    });

    it('quitar el correo lo borra', async () => {
      expect((await con(http().delete(`/api/verified-emails/${id}`), tAna)).status).toBe(204);
      const lista = await con(http().get('/api/verified-emails'), tAna);
      expect(lista.body.find((e: { id: string }) => e.id === id)).toBeUndefined();
    });
  });
});
