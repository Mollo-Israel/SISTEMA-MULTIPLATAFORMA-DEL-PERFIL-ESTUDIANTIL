/**
 * V8 · Registros verificables (Open Badges 3.0 / 2.0) de punta a punta.
 *
 * La aplicación real contra `afinia_test`: política de Dirección (ND-01),
 * emisión, verificación pública, documentos estándar, archivos (PDF, PNG,
 * SVG, JSON), estado en vivo, suspensión y revocación, integridad de la
 * bitácora y defensas de la base de datos.
 *
 * Se puede repetir sobre la misma base: crea sus propios datos cuando los
 * necesita y deja la política como la encontró.
 */
import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { createHash } from 'node:crypto';
import { ADMIN, crearApp, db, entrar } from '../app';
import { verifyProof, createProof } from '../../../src/verifiable-credentials/crypto/data-integrity';
import { decodeJws, verifyJws } from '../../../src/verifiable-credentials/crypto/jws';
import { decodeStatusList, statusBit } from '../../../src/verifiable-credentials/crypto/status-list';
import { ed25519FromSeed, ed25519PublicFromRaw, fromMultikey, publicKeyFromJwk, toDidKey } from '../../../src/verifiable-credentials/crypto/keys';
import { PUBLIC_CODE_PATTERN } from '../../../src/verifiable-credentials/public-code';
import { extractPdfText } from '../../../src/validation/pdf-text';

const ANA = 'ana.quispe@est.univalle.edu';
const LUIS = 'luis.mamani@est.univalle.edu';
const DIRECTOR = 'jorge.vargas@univalle.edu';
const DOCENTE = 'carlos.perez@univalle.edu';

interface Item {
  id: string; code: string; status: string; sourceType: string; achievementName: string; holderName: string; verifyUrl: string;
}

describe('V8 · Registros verificables', () => {
  let app: INestApplication;
  let tDirector: string;
  let tAna: string;
  let tLuis: string;
  let tDocente: string;
  let tAdmin: string | null = null;
  let politicaInicial = false;
  const http = () => request(app.getHttpServer());
  const con = (r: request.Test, t: string) => r.set('Authorization', `Bearer ${t}`);
  const binario = (res: request.Response, cb: (e: Error | null, d: Buffer) => void) => {
    const trozos: Buffer[] = [];
    res.on('data', (c: Buffer) => trozos.push(c));
    res.on('end', () => cb(null, Buffer.concat(trozos)));
  };
  const politica = async (enabled: boolean) => {
    const r = await con(http().post('/api/credentials/policy'), tDirector)
      .send({ enabled, justification: enabled ? 'Prueba automatizada: se habilita la emisión.' : 'Prueba automatizada: se apaga la emisión.' });
    return r;
  };
  const misRegistros = async (t = tAna) => (await con(http().get('/api/credentials/mine'), t)).body as {
    policy: { enabled: boolean }; items: Item[]; pending: unknown[];
  };
  const descargar = async (id: string, formato: string, t = tAna) =>
    (await con(http().get(`/api/credentials/${id}/download/${formato}`), t).buffer(true).parse(binario)).body as Buffer;

  /** Una participación confirmada nueva para Ana, para no depender de corridas anteriores. */
  const participacionNueva = async (): Promise<{ regId: string; activityId: string }> => {
    const [perfil] = await db(app).query(`SELECT sp.id FROM student_profiles sp JOIN users u ON u.id = sp.user_id WHERE u.email = $1`, [ANA]);
    const [act] = await db(app).query(`
      SELECT a.id FROM activities a
       WHERE a.origin_type = 'internal' AND a.status NOT IN ('draft', 'cancelled')
         AND NOT EXISTS (SELECT 1 FROM activity_registrations r WHERE r.activity_id = a.id AND r.student_profile_id = $1)
       LIMIT 1`, [perfil.id]);
    let activityId = act?.id as string | undefined;
    if (!activityId) {
      // Sin actividades libres: se duplica una existente directamente en la base.
      const [nueva] = await db(app).query(`
        INSERT INTO activities (title, description, type, origin_type, status, creator_id, category_id)
        SELECT 'Taller V8 ' || floor(random() * 1e6)::text, description, type, origin_type, status, creator_id, category_id
          FROM activities WHERE origin_type = 'internal' AND status NOT IN ('draft', 'cancelled') LIMIT 1
        RETURNING id`);
      activityId = nueva.id;
    }
    const [reg] = await db(app).query(
      `INSERT INTO activity_registrations (activity_id, student_profile_id, status) VALUES ($1, $2, 'confirmed') RETURNING id`,
      [activityId, perfil.id],
    );
    return { regId: reg.id, activityId: activityId! };
  };

  beforeAll(async () => {
    app = await crearApp();
    [tDirector, tAna, tLuis, tDocente] = await Promise.all([entrar(app, DIRECTOR), entrar(app, ANA), entrar(app, LUIS), entrar(app, DOCENTE)]);
    if (ADMIN.password) tAdmin = await entrar(app, ADMIN.email, ADMIN.password).catch(() => null);
    politicaInicial = (await con(http().get('/api/credentials/policy'), tDirector)).body.enabled;
    if (politicaInicial) await politica(false);
  });

  afterAll(async () => {
    const ahora = (await con(http().get('/api/credentials/policy'), tDirector)).body.enabled;
    if (ahora !== politicaInicial) await politica(politicaInicial);
    await app.close();
  });

  it('sin decisión de Dirección la emisión está apagada (ND-01) y la regla V5 sigue igual', async () => {
    const mios = await misRegistros();
    expect(mios.policy.enabled).toBe(false);
    const r = await con(http().post('/api/credentials/mine/issue'), tAna);
    expect(r.status).toBe(403);
    expect(r.body.code).toBe('CREDENTIAL_ISSUANCE_DISABLED');
    // V5 §1.2: el endpoint histórico de constancias sigue sin emitir.
    const v5 = await con(http().post('/api/constancies/internal'), tDirector).send({
      profileId: '00000000-0000-4000-8000-000000000000', activityId: '00000000-0000-4000-8000-000000000000', description: 'x',
    });
    expect([400, 403]).toContain(v5.status);
  });

  it('solo Dirección decide la política, con justificación, y queda en la historia', async () => {
    if (tAdmin) {
      const a = await con(http().post('/api/credentials/policy'), tAdmin).send({ enabled: true, justification: 'Administración no decide esto.' });
      expect(a.status).toBe(403);
    }
    const d = await con(http().post('/api/credentials/policy'), tDocente).send({ enabled: true, justification: 'Un docente tampoco lo decide.' });
    expect(d.status).toBe(403);
    const corta = await con(http().post('/api/credentials/policy'), tDirector).send({ enabled: true, justification: 'ok' });
    expect(corta.status).toBe(400);
    const r = await politica(true);
    expect(r.status).toBe(201);
    expect(r.body.enabled).toBe(true);
    expect(r.body.history[0].decidedBy).toBeTruthy();
    expect((await politica(true)).status).toBe(409);
  });

  let registro: Item;

  it('Ana firma sus registros: cada uno con un código AF verificable', async () => {
    await participacionNueva();
    const r = await con(http().post('/api/credentials/mine/issue'), tAna);
    expect(r.status).toBe(201);
    const items = r.body.items.items as Item[];
    expect(items.length).toBeGreaterThanOrEqual(2);
    expect(r.body.items.pending).toHaveLength(0);
    for (const i of items) expect(i.code).toMatch(PUBLIC_CODE_PATTERN);
    registro = items.find((i) => i.sourceType === 'participation' && i.status === 'active')!;
    expect(registro).toBeTruthy();
    expect(registro.holderName).toMatch(/Ana/);
    // Volver a pedir no duplica nada.
    const otra = await con(http().post('/api/credentials/mine/issue'), tAna);
    expect(otra.body.issued).toBe(0);
  });

  it('cualquiera verifica el código sin sesión, y el informe no expone el correo', async () => {
    const r = await http().get(`/api/public/credentials/${registro.code}`);
    expect(r.status).toBe(200);
    expect(r.body.outcome).toBe('valid');
    const ids = (r.body.checks as Array<{ id: string; status: string }>).map((c) => `${c.id}:${c.status}`);
    for (const c of ['registro', 'clave', 'firma', 'huella', 'bitacora', 'estado', 'origen']) expect(ids).toContain(`${c}:ok`);
    expect(JSON.stringify(r.body)).not.toMatch(/@est\.univalle\.edu/);
    expect(r.body.ledger.seq).toBeTruthy();
    // En minúsculas y con espacios también se reconoce.
    const flexible = await http().get(`/api/public/credentials/${encodeURIComponent(registro.code.toLowerCase().replace(/-/g, ' '))}`);
    expect(flexible.body.outcome).toBe('valid');
  });

  it('un error de tipeo se detecta por el carácter de control, sin consultar la base', async () => {
    const c = registro.code;
    const ultimo = c[c.length - 1] === '0' ? '1' : '0';
    const r = await http().get(`/api/public/credentials/${c.slice(0, -1)}${ultimo}`);
    expect(r.body.outcome).toBe('not_found');
    expect(r.body.checks[0]).toMatchObject({ id: 'formato', status: 'fail' });
  });

  it('publica los documentos estándar: emisor con Multikey, JWKS, listas firmadas y OB 2.0', async () => {
    const issuer = (await http().get('/api/public/credentials/issuer')).body;
    expect(issuer.type).toContain('Profile');
    expect(issuer.verificationMethod[0].type).toBe('Multikey');
    expect(issuer.verificationMethod[0].publicKeyMultibase).toMatch(/^z6Mk/);
    const jwks = (await http().get('/api/public/credentials/keys')).body;
    expect(jwks.keys[0]).toMatchObject({ kty: 'OKP', crv: 'Ed25519', alg: 'EdDSA' });

    const lista = await http().get('/api/public/credentials/status/revocation');
    expect(lista.headers['access-control-allow-origin']).toBe('*');
    const vm = issuer.verificationMethod.find((m: { id: string }) => m.id === lista.body.proof.verificationMethod);
    expect(verifyProof(lista.body, ed25519PublicFromRaw(fromMultikey(vm.publicKeyMultibase))).ok).toBe(true);
    expect((await http().get('/api/public/credentials/status/otra')).status).toBe(404);

    const asercion = (await http().get(`/api/public/credentials/ob2/assertions/${registro.code}`)).body;
    expect(asercion).toMatchObject({ type: 'Assertion', verification: { type: 'hosted' } });
    expect(asercion.recipient.identity).toMatch(/^sha256\$[0-9a-f]{64}$/);
    expect(asercion.revoked).toBeUndefined();
    const badge = (await http().get(`/api/public/credentials/ob2/badges/${registro.code}`)).body;
    expect(badge.type).toBe('BadgeClass');
    const img = await http().get(`/api/public/credentials/ob2/badges/${registro.code}/image.svg`);
    expect(img.headers['content-type']).toMatch(/image\/svg\+xml/);
    expect((await http().get('/api/public/credentials/ledger/head')).body.head.hash).toMatch(/^[0-9a-f]{64}$/);
  });

  it('la credencial descargada verifica sola, sin la base: JSON (Data Integrity) y VC-JWT', async () => {
    const json = JSON.parse((await descargar(registro.id, 'json')).toString('utf8'));
    expect(json.type).toEqual(['VerifiableCredential', 'OpenBadgeCredential']);
    expect(json.credentialStatus).toHaveLength(2);
    const issuer = (await http().get('/api/public/credentials/issuer')).body;
    const vm = issuer.verificationMethod.find((m: { id: string }) => m.id === json.proof.verificationMethod);
    expect(verifyProof(json, ed25519PublicFromRaw(fromMultikey(vm.publicKeyMultibase))).ok).toBe(true);

    const jwt = (await descargar(registro.id, 'jwt')).toString('utf8');
    const dec = decodeJws(jwt);
    const jwk = (await http().get('/api/public/credentials/keys')).body.keys.find((k: { kid: string }) => k.kid === dec.header.kid);
    expect(verifyJws(dec, publicKeyFromJwk(jwk))).toBe(true);

    for (const presentada of [json, jwt]) {
      const r = await http().post('/api/public/credentials/verify').send({ credential: presentada });
      expect(r.status).toBe(200);
      expect(r.body.outcome).toBe('valid');
      expect(r.body.checks.find((c: { id: string }) => c.id === 'presentada').status).toBe('ok');
    }
  });

  it('una credencial alterada, aunque sea una letra, no pasa', async () => {
    const json = JSON.parse((await descargar(registro.id, 'json')).toString('utf8'));
    json.name = `${json.name}.`;
    const r = await http().post('/api/public/credentials/verify').send({ credential: json });
    expect(r.body.outcome).toBe('invalid');
    const jwt = (await descargar(registro.id, 'jwt')).toString('utf8');
    const [h, p, s] = jwt.split('.');
    const carga = JSON.parse(Buffer.from(p, 'base64url').toString('utf8'));
    carga.name = 'Otro logro';
    const falso = `${h}.${Buffer.from(JSON.stringify(carga)).toString('base64url')}.${s}`;
    expect((await http().post('/api/public/credentials/verify').send({ credential: falso })).body.outcome).toBe('invalid');
  });

  it('la base de datos impide alterar lo firmado y reescribir la bitácora', async () => {
    await expect(db(app).query(`UPDATE verifiable_credentials SET holder_name = 'Otra Persona' WHERE id = $1`, [registro.id]))
      .rejects.toThrow(/no se puede modificar/);
    await expect(db(app).query(`UPDATE verifiable_credentials SET credential_json = credential_json || '{"x":1}' WHERE id = $1`, [registro.id]))
      .rejects.toThrow(/no se puede modificar/);
    await expect(db(app).query(`UPDATE credential_ledger SET data = '{}' WHERE seq = 1`)).rejects.toThrow(/solo anexado/);
    await expect(db(app).query(`DELETE FROM credential_ledger WHERE seq = 1`)).rejects.toThrow(/solo anexado/);
    await expect(db(app).query(`TRUNCATE credential_ledger`)).rejects.toThrow(/solo anexado/);
  });

  it('el PDF original verifica byte a byte; uno editado se detecta como modificado', async () => {
    const pdf = await descargar(registro.id, 'pdf');
    expect(pdf.subarray(0, 5).toString('latin1')).toBe('%PDF-');
    expect(extractPdfText(pdf).links.some((l) => l.endsWith(`/verificar/${registro.code}`))).toBe(true);
    const ok = await http().post('/api/public/credentials/verify-file').attach('file', pdf, 'registro.pdf');
    expect(ok.status).toBe(200);
    expect(ok.body.outcome).toBe('valid');
    expect(ok.body.checks.find((c: { id: string }) => c.id === 'documento').status).toBe('ok');

    const texto = pdf.toString('latin1');
    const nombre = registro.holderName.split(' ')[0];
    const editado = Buffer.from(texto.replace(`(${nombre}`, `(${'X'.repeat(nombre.length)}`), 'latin1');
    expect(editado.equals(pdf)).toBe(false);
    const malo = await http().post('/api/public/credentials/verify-file').attach('file', editado, 'registro.pdf');
    expect(malo.body.outcome).toBe('altered');
  });

  it('las insignias horneadas (PNG y SVG) llevan la credencial y verifican solas', async () => {
    for (const formato of ['png', 'svg']) {
      const archivo = await descargar(registro.id, formato);
      const r = await http().post('/api/public/credentials/verify-file').attach('file', archivo, `insignia.${formato}`);
      expect(r.body.outcome).toBe('valid');
      expect(r.body.file.recognizedAs).toBe('baked_badge');
    }
  });

  it('si la asistencia deja de estar confirmada, el registro queda sin efecto al instante', async () => {
    const { regId } = await participacionNueva();
    const emitido = (await con(http().post('/api/credentials/mine/issue'), tAna)).body.items.items as Item[];
    const [perfil] = await db(app).query(`SELECT source_id FROM verifiable_credentials WHERE source_id = $1`, [regId]);
    expect(perfil).toBeTruthy();
    const vc = (await db(app).query(`SELECT public_code, status_index FROM verifiable_credentials WHERE source_id = $1`, [regId]))[0];
    expect(emitido.some((i) => i.code === vc.public_code)).toBe(true);

    await db(app).query(`UPDATE activity_registrations SET status = 'absent' WHERE id = $1`, [regId]);
    const r = await http().get(`/api/public/credentials/${vc.public_code}`);
    expect(r.body.outcome).toBe('without_effect');
    expect((await http().get(`/api/public/credentials/ob2/assertions/${vc.public_code}`)).body.revoked).toBe(true);
    await db(app).query(`UPDATE activity_registrations SET status = 'confirmed' WHERE id = $1`, [regId]);
    expect((await http().get(`/api/public/credentials/${vc.public_code}`)).body.outcome).toBe('valid');
  });

  it('Dirección suspende, levanta y revoca con motivo; la revocación es definitiva y se publica', async () => {
    const { regId } = await participacionNueva();
    await con(http().post('/api/credentials/mine/issue'), tAna);
    const [vc] = await db(app).query(`SELECT id, public_code, status_index FROM verifiable_credentials WHERE source_id = $1`, [regId]);

    expect((await con(http().post(`/api/credentials/registry/${vc.id}/suspend`), tDirector).send({ reason: 'corto' })).status).toBe(400);
    expect((await con(http().post(`/api/credentials/registry/${vc.id}/suspend`), tDocente).send({ reason: 'Un docente no puede hacerlo.' })).status).toBe(403);
    if (tAdmin) {
      expect((await con(http().post(`/api/credentials/registry/${vc.id}/revoke`), tAdmin).send({ reason: 'Administración no decide esto.' })).status).toBe(403);
    }
    const s = await con(http().post(`/api/credentials/registry/${vc.id}/suspend`), tDirector).send({ reason: 'Se revisa la asistencia registrada.' });
    expect(s.status).toBe(201);
    expect(s.body.status).toBe('suspended');
    expect((await http().get(`/api/public/credentials/${vc.public_code}`)).body.outcome).toBe('suspended');
    const l = await con(http().post(`/api/credentials/registry/${vc.id}/lift`), tDirector).send({ reason: 'La asistencia quedó comprobada.' });
    expect(l.body.status).toBe('active');

    const rv = await con(http().post(`/api/credentials/registry/${vc.id}/revoke`), tDirector).send({ reason: 'Se registró por error en otra actividad.' });
    expect(rv.body.status).toBe('revoked');
    const informe = (await http().get(`/api/public/credentials/${vc.public_code}`)).body;
    expect(informe.outcome).toBe('revoked');
    // El motivo no se publica: solo lo ven Dirección y el titular.
    expect(JSON.stringify(informe)).not.toMatch(/por error en otra actividad/);
    expect((await con(http().post(`/api/credentials/registry/${vc.id}/revoke`), tDirector).send({ reason: 'Otra vez, por las dudas.' })).status).toBe(409);
    expect((await con(http().post(`/api/credentials/registry/${vc.id}/lift`), tDirector).send({ reason: 'Intento de deshacer.' })).status).toBe(409);
    await expect(db(app).query(`UPDATE verifiable_credentials SET revoked_at = NULL WHERE id = $1`, [vc.id])).rejects.toThrow(/definitiva/);

    // La lista de revocación firmada lo refleja (pasa la caché de 30 s porque se invalida al revocar).
    const lista = (await http().get('/api/public/credentials/status/revocation')).body;
    expect(statusBit(decodeStatusList(lista.credentialSubject.encodedList), vc.status_index)).toBe(true);
    const detalle = (await con(http().get(`/api/credentials/registry/${vc.id}`), tDirector)).body;
    expect(detalle.ledger.map((e: { event: string }) => e.event)).toEqual(['ISSUED', 'SUSPENDED', 'SUSPENSION_LIFTED', 'REVOKED']);
    const [aud] = await db(app).query(`SELECT count(*)::int AS n FROM audit_events WHERE entity_id = $1 AND event_type LIKE 'CREDENTIAL_%'`, [vc.id]);
    expect(aud.n).toBe(4);
  });

  it('nadie más ve ni descarga un registro ajeno', async () => {
    expect((await con(http().get(`/api/credentials/${registro.id}/download/pdf`), tLuis)).status).toBe(404);
    expect((await con(http().get(`/api/credentials/${registro.id}/download/pdf`), tDocente)).status).toBe(403);
    expect((await con(http().get('/api/credentials/registry'), tAna)).status).toBe(403);
    expect((await http().get('/api/credentials/mine')).status).toBe(401);
    expect((await con(http().get(`/api/credentials/${registro.id}/download/exe`), tAna)).status).toBe(404);
  });

  it('la auditoría de integridad recorre la cadena entera y cada firma', async () => {
    const r = await con(http().get('/api/credentials/registry/integrity'), tDirector);
    expect(r.status).toBe(200);
    expect(r.body.ok).toBe(true);
    expect(r.body.ledger.ok).toBe(true);
    expect(r.body.credentialsChecked).toBeGreaterThanOrEqual(3);
    expect(r.body.problems).toHaveLength(0);
    const lista = await con(http().get('/api/credentials/registry?q=Ana'), tDirector);
    expect(lista.body.items.length).toBeGreaterThan(0);
  });

  it('el certificado que entregó la institución se reconoce por su huella', async () => {
    const archivo = Buffer.concat([Buffer.from('%PDF-1.4\n% certificado de prueba V8 '), Buffer.from(String(Date.now()))]);
    const sha = createHash('sha256').update(archivo).digest('hex');
    const [ana] = await db(app).query(`SELECT sp.id, u.id AS user_id FROM student_profiles sp JOIN users u ON u.id = sp.user_id WHERE u.email = $1`, [ANA]);
    const [dir] = await db(app).query(`SELECT id FROM users WHERE email = $1`, [DIRECTOR]);
    const [f] = await db(app).query(`
      INSERT INTO stored_files (storage_key, original_filename, mime_type_declared, mime_type_detected, size_bytes, sha256, uploaded_by_user_id)
      VALUES ($1, 'certificado.pdf', 'application/pdf', 'application/pdf', $2, $3, $4) RETURNING id`,
    [`v8/${sha.slice(0, 16)}.pdf`, archivo.length, sha, dir.id]);
    await db(app).query(`
      INSERT INTO internal_constancies (student_profile_id, description, kind, issuer_name, stored_file_id, status)
      VALUES ($1, 'Certificado de prueba V8', 'institution_certificate', 'Cisco Networking Academy', $2, 'authorized')`, [ana.id, f.id]);

    const antes = await http().post('/api/public/credentials/verify-file').attach('file', archivo, 'certificado.pdf');
    expect(antes.body.outcome).toBe('document_recognized');
    expect(JSON.stringify(antes.body)).not.toMatch(/Ana/);

    await con(http().post('/api/credentials/mine/issue'), tAna);
    const despues = await http().post('/api/public/credentials/verify-file').attach('file', archivo, 'certificado.pdf');
    expect(despues.body.outcome).toBe('valid');
    expect(despues.body.credential.documentIssuer).toBe('Cisco Networking Academy');
    expect(despues.body.credential.documentSha256).toBe(sha);
  });

  it('un archivo desconocido no se reconoce, y uno vacío se rechaza', async () => {
    const r = await http().post('/api/public/credentials/verify-file').attach('file', Buffer.from('hola mundo, nada que ver'), 'nota.txt');
    expect(r.body.outcome).toBe('not_found');
    expect((await http().post('/api/public/credentials/verify-file')).status).toBe(400);
  });

  it('verifica en lote hasta 25 códigos', async () => {
    const r = await http().post('/api/public/credentials/verify-batch').send({ codes: [registro.code, 'AF-0000-0000-00000', 'basura'] });
    expect(r.status).toBe(200);
    expect(r.body.summary).toMatchObject({ total: 3, valid: 1, problems: 2 });
    const demasiados = await http().post('/api/public/credentials/verify-batch').send({ codes: Array.from({ length: 26 }, (_, i) => `c${i}`) });
    expect(demasiados.status).toBe(400);
  });

  it('una credencial de otro emisor (did:key) se verifica sin red, y alterada no pasa', async () => {
    const kp = ed25519FromSeed(Buffer.alloc(32, 9));
    const did = toDidKey(kp.publicRaw);
    const vm = `${did}#${did.slice('did:key:'.length)}`;
    const doc = {
      '@context': ['https://www.w3.org/ns/credentials/v2', 'https://purl.imsglobal.org/spec/ob/v3p0/context-3.0.3.json'],
      id: 'urn:uuid:5b2b0d39-8f3c-4b5e-9c55-1a1c0b7c2d11',
      type: ['VerifiableCredential', 'OpenBadgeCredential'],
      issuer: { id: did, type: ['Profile'], name: 'Emisor externo de prueba' },
      validFrom: '2026-01-01T00:00:00Z',
      credentialSubject: { type: ['AchievementSubject'], achievement: { id: 'urn:x', type: ['Achievement'], name: 'Curso externo' } },
    };
    const firmado = createProof(doc, kp.privateKey, { verificationMethod: vm, created: '2026-01-01T00:00:00Z' });
    const ok = await http().post('/api/public/credentials/verify').send({ credential: firmado });
    expect(ok.body.outcome).toBe('valid_external');
    expect(ok.body.credential.issuerName).toBe('Emisor externo de prueba');

    const alterado = { ...firmado, credentialSubject: { ...doc.credentialSubject, achievement: { ...doc.credentialSubject.achievement, name: 'Doctorado' } } };
    expect((await http().post('/api/public/credentials/verify').send({ credential: alterado })).body.outcome).toBe('invalid');

    // Firmada con una clave que no es del emisor declarado: no basta con que la firma cuadre.
    const impostor = createProof({ ...doc, issuer: { id: 'did:key:z6MkhaXgBZDvotDkL5257faiztiGiC2QtKLGpbnnEGta2doK', name: 'Otro' } }, kp.privateKey, {
      verificationMethod: vm, created: '2026-01-01T00:00:00Z',
    });
    expect((await http().post('/api/public/credentials/verify').send({ credential: impostor })).body.outcome).toBe('invalid');
  });

  it('una credencial con el código de Afinia pero firmada por otro no se hace pasar por propia', async () => {
    const json = JSON.parse((await descargar(registro.id, 'json')).toString('utf8'));
    const kp = ed25519FromSeed(Buffer.alloc(32, 3));
    const did = toDidKey(kp.publicRaw);
    const { proof: _p, ...sinFirma } = json;
    const falsa = createProof({ ...sinFirma, name: 'Doctorado honoris causa' }, kp.privateKey, {
      verificationMethod: `${did}#${did.slice(8)}`, created: new Date().toISOString(),
    });
    const r = await http().post('/api/public/credentials/verify').send({ credential: falsa });
    expect(['invalid']).toContain(r.body.outcome);
  });

  it('con la emisión apagada, lo emitido se sigue verificando', async () => {
    expect((await politica(false)).status).toBe(201);
    expect((await con(http().post('/api/credentials/mine/issue'), tAna)).status).toBe(403);
    expect((await http().get(`/api/public/credentials/${registro.code}`)).body.outcome).toBe('valid');
  });
});
