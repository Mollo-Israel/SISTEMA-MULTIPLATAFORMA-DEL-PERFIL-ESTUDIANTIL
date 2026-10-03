import { ConfigService } from '@nestjs/config';
import { Logger } from '@nestjs/common';
import { readMailSettings } from '../mail/mail.settings';

const logger = new Logger('Environment');

/**
 * Validación de entorno al iniciar (especificación §84).
 *
 * Un despliegue mal configurado que arranca es peor que uno que no arranca:
 * parece sano y falla más tarde, en producción, con datos reales. En
 * producción cualquier ausencia detiene el proceso; en desarrollo solo avisa,
 * para no obligar a montar SMTP antes de poder programar.
 */
export function assertEnvironment(config: ConfigService): void {
  const isProduction = (config.get<string>('NODE_ENV') ?? 'development') === 'production';
  const problems: string[] = [];
  const warnings: string[] = [];

  // Base de datos: sin esto no hay sistema, en ningún entorno.
  for (const key of ['POSTGRES_HOST', 'POSTGRES_DB', 'POSTGRES_USER']) {
    if (!config.get<string>(key)?.trim()) problems.push(`${key} no está definido.`);
  }

  // Los secretos los validan resolveJwtSecret y resolveRefreshSecret, que se
  // ejecutan al construir el módulo de autenticación.

  if (isProduction) {
    if (!config.get<string>('WEB_ORIGINS')?.trim()) {
      problems.push('WEB_ORIGINS no está definido: CORS quedaría sin lista explícita.');
    }
    if (!config.get<string>('INSTITUTIONAL_EMAIL_DOMAINS')?.trim()) {
      problems.push(
        'INSTITUTIONAL_EMAIL_DOMAINS no está definido: cualquier dominio podría provisionarse.',
      );
    }
    if (!config.get<string>('SMTP_HOST')?.trim()) {
      problems.push(
        'SMTP_HOST no está definido: la activación y la recuperación no podrían enviarse.',
      );
    }
    // Con el correo mal configurado, cada alta deja una cuenta que nadie podrá
    // activar. Mejor no arrancar que descubrirlo con el primer estudiante.
    const correo = readMailSettings(config);
    if (correo.transport === 'console') {
      problems.push('MAIL_TRANSPORT=console no es válido en producción: los correos no saldrían.');
    }
    problems.push(...correo.problems);
    const web = config.get<string>('WEB_APP_URL')?.trim();
    if (web && !/^https:\/\//i.test(web)) {
      problems.push('WEB_APP_URL debe empezar por https:// en producción: es el enlace del correo.');
    }
  } else {
    if (!config.get<string>('INSTITUTIONAL_EMAIL_DOMAINS')?.trim()) {
      warnings.push('INSTITUTIONAL_EMAIL_DOMAINS sin definir: no se restringe el dominio.');
    }
    if (!config.get<string>('SMTP_HOST')?.trim()) {
      warnings.push(
        'SMTP_HOST sin definir: los correos se SIMULAN (van al registro y a api/.mail-outbox). '
          + 'Para enviarlos de verdad, ver docs/CORREO_REAL.md.',
      );
    }
  }

  const maxUpload = Number(config.get<string>('MAX_UPLOAD_MB') ?? 10);
  if (!Number.isFinite(maxUpload) || maxUpload <= 0 || maxUpload > 100) {
    problems.push('MAX_UPLOAD_MB debe ser un número entre 1 y 100.');
  }

  for (const warning of warnings) logger.warn(warning);

  if (problems.length > 0) {
    throw new Error(
      `Configuración de entorno incompleta:\n  - ${problems.join('\n  - ')}\n`
        + 'Revise .env.example y complete las variables antes de iniciar.',
    );
  }
}
