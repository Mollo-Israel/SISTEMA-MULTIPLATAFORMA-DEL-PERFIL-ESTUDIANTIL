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

  /** Registra la credencial y corre el validador sobre ella (el worker está apagado en pruebas). */
  let n = 0;
  const registrar = async (t: string, cuerpo: Record<string, unknown>) => {
    n += 1;
    const r = await con(http().post('/api/certificates/external'), t).send({ certificateName: `Curso V9 ${RUN} ${n}`, issuer: 'Huawei ICT Academy', ...cuerpo });
    expect(r.status).toBe(201);
    const id = r.body.id as string;
    const reg = await validacion.enqueue({ resourceType: ValidationResourceType.EXTERNAL_CERTIFICATE, resourceId: id, force: true });
    const hecho = await validacion.process(reg);
    return { id, v: hecho };
  };

  beforeAll(async () => {
    app = await crearApp();
    validacion = app.get(ValidationService);
    tAna = await entrar(app, ANA);
    tLuis = await entrar(app, LUIS);
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
