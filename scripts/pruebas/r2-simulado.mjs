/**
 * Simulador mínimo de Cloudflare R2 (API S3) para probar sin cuenta ni internet.
 *
 *   node scripts/pruebas/r2-simulado.mjs [puerto]        # por omisión 3995
 *
 * Luego arranque la API con:
 *   STORAGE_DRIVER=r2 R2_ENDPOINT=http://127.0.0.1:3995 R2_BUCKET=prueba
 *   R2_ACCESS_KEY_ID=x R2_SECRET_ACCESS_KEY=y
 *
 * Guarda en memoria; no verifica firmas. No sirve para producción.
 */
import { createServer } from 'node:http';

const objetos = new Map();
const puerto = Number(process.argv[2] ?? 3995);
const noExiste = (res) => {
  res.writeHead(404, { 'content-type': 'application/xml' });
  res.end('<?xml version="1.0"?><Error><Code>NoSuchKey</Code><Message>No existe</Message></Error>');
};

createServer((req, res) => {
  const clave = new URL(req.url, 'http://x').pathname;
  if (req.method === 'PUT') {
    const trozos = [];
    req.on('data', (t) => trozos.push(t));
    req.on('end', () => {
      objetos.set(clave, { cuerpo: Buffer.concat(trozos), tipo: req.headers['content-type'] });
      console.log(`PUT ${clave} (${objetos.get(clave).cuerpo.length} bytes) · total ${objetos.size}`);
      res.writeHead(200, { etag: '"simulado"' });
      res.end();
    });
    return;
  }
  const objeto = objetos.get(clave);
  if (req.method === 'DELETE') {
    objetos.delete(clave);
    res.writeHead(204);
    res.end();
    return;
  }
  if (!objeto) return noExiste(res);
  res.writeHead(200, { 'content-type': objeto.tipo ?? 'application/octet-stream', 'content-length': objeto.cuerpo.length, etag: '"simulado"' });
  res.end(req.method === 'HEAD' ? undefined : objeto.cuerpo);
}).listen(puerto, '127.0.0.1', () => console.log(`R2 simulado en http://127.0.0.1:${puerto}`));
