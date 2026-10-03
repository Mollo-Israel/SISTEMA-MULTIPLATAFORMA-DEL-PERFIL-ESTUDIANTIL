/**
 * Prueba de correo desde la terminal.
 *
 *   npm run mail:test -- tu.correo@dominio.com
 *
 * Lee la misma configuración que la API (`.env`), se conecta al servidor de
 * correo y envía un mensaje de prueba. No arranca la API ni toca la base de
 * datos: sirve para comprobar las credenciales antes de nada, y si fallan,
 * dice qué variable revisar.
 */
import '../load-env';
import { Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { MailService } from './mail.service';

const VERDE = '\x1b[32m';
const ROJO = '\x1b[31m';
const AMARILLO = '\x1b[33m';
const GRIS = '\x1b[90m';
const FIN = '\x1b[0m';

async function main(): Promise<void> {
  const destino = process.argv[2]?.trim();
  if (!destino || !destino.includes('@')) {
    console.error('Uso: npm run mail:test -- tu.correo@dominio.com');
    process.exitCode = 2;
    return;
  }

  // La salida es para una persona: sin el formato de registro de Nest.
  Logger.overrideLogger(false);
  const mail = new MailService(new ConfigService());
  const estado = mail.status();

  console.log('\nConfiguración de correo de Afinia');
  console.log(`  Transporte : ${estado.transport === 'smtp' ? 'SMTP (real)' : 'consola (simulado)'}`);
  if (estado.host) console.log(`  Servidor   : ${estado.host}:${estado.port} ${estado.secure ? '(TLS)' : '(STARTTLS)'}`);
  if (estado.user) console.log(`  Usuario    : ${estado.user}`);
  console.log(`  Remitente  : ${estado.from}`);
  console.log(`  Dominios   : ${estado.allowedDomains.join(', ') || '(sin restricción)'}`);
  estado.warnings.forEach((w) => console.log(`  ${AMARILLO}Aviso:${FIN} ${w}`));

  if (estado.problems.length > 0) {
    estado.problems.forEach((p) => console.log(`  ${ROJO}Error:${FIN} ${p}`));
    console.log(`\n${ROJO}Corrija .env y vuelva a intentarlo.${FIN} Guía: docs/CORREO_REAL.md\n`);
    process.exitCode = 1;
    return;
  }

  if (estado.transport === 'console') {
    console.log(
      `\n${AMARILLO}El correo está en modo simulado${FIN}: SMTP_HOST está vacío, así que no se `
        + 'conectará a ningún servidor.\nRellene las variables SMTP_* de .env (docs/CORREO_REAL.md).\n',
    );
    return;
  }

  mail.prepare();
  process.stdout.write('\nComprobando la conexión… ');
  const conecta = await mail.verify();
  if (!conecta) {
    console.log(`${ROJO}falló${FIN}\n  ${mail.status().lastError}\n`);
    mail.onApplicationShutdown();
    process.exitCode = 1;
    return;
  }
  console.log(`${VERDE}correcta${FIN}`);

  process.stdout.write(`Enviando la prueba a ${destino}… `);
  try {
    const entrega = await mail.sendTest(destino);
    console.log(`${VERDE}enviado${FIN} ${GRIS}${entrega.messageId ?? ''}${FIN}`);
    console.log(
      '\nRevise la bandeja de entrada y también la de correo no deseado. Si llegó a no deseado,'
        + '\nmárquelo como «No es spam»; la guía explica cómo mejorar la entrega.\n',
    );
  } catch (error) {
    console.log(`${ROJO}falló${FIN}\n  ${(error as Error).message}\n`);
    process.exitCode = 1;
  } finally {
    mail.onApplicationShutdown();
  }
}

void main();
