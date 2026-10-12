import { BadRequestException, Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { ConfigService } from '@nestjs/config';
import { DataSource, Repository } from 'typeorm';
import * as bcrypt from 'bcryptjs';
import { AccountTokenPurpose, UserStatus } from '@perfil/shared';
import { User } from '../entities/user.entity';
import { AccountToken, TokenState } from '../entities/account-token.entity';
import { AuditEventType, AuditService } from '../audit/audit.service';
import { AccountTokensService } from './account-tokens.service';
import { AuthSessionsService } from './auth-sessions.service';
import { AccountMailService } from './account-mail.service';
import { passwordPolicyError } from '../common/validation';
import {
  appTimezone,
  identityConfig,
  institutionalEmailDomains,
  isInstitutionalEmail,
} from '../config/identity.config';
import { formatearFecha } from '../mail/templates';
import { maskEmail } from '../mail/mail.service';

/**
 * Respuesta deliberadamente idéntica exista o no la cuenta (§12).
 *
 * Si el mensaje cambiara, cualquiera podría averiguar qué correos están dados
 * de alta probando uno por uno. Por eso tampoco depende del tiempo: el correo
 * se encola y la respuesta sale al instante, haya o no algo que enviar.
 *
 * `retryAfterSeconds` es lo que realmente falta para poder pedir otro (V3.2
 * §8.4): cerrar y volver a abrir la pantalla no reinicia la espera. Se lleva
 * por correo escrito, exista o no la cuenta, para que el número tampoco delate
 * nada.
 */
function respuestaGenerica(segundos: number) {
  return {
    status: 'REQUESTED' as const,
    message:
      'Si el correo corresponde a una cuenta registrada, te enviamos un mensaje. '
      + 'Revisa tu bandeja de entrada y la carpeta de correo no deseado.',
    retryAfterSeconds: segundos,
  };
}

/**
 * V3.2 §8.3: una cuenta que ya está activa no recibe otra activación. No se
 * crea token, no se encola correo y no se afirma ningún envío: se orienta a
 * iniciar sesión o a recuperar la contraseña.
 */
function respuestaYaActiva() {
  return {
    status: 'ALREADY_ACTIVE' as const,
    message:
      'Esta cuenta ya está activa: no hace falta activarla otra vez. Inicia sesión con tu contraseña '
      + 'o, si no la recuerdas, usa «Olvidé mi contraseña».',
    retryAfterSeconds: 0,
  };
}

/** Qué hacer con cada estado de un enlace, en palabras del usuario. */
function explicarEstado(state: TokenState | 'invalid', purpose: AccountTokenPurpose, vence?: string): string {
  const activacion = purpose === AccountTokenPurpose.ACCOUNT_ACTIVATION;
  switch (state) {
    case 'used':
      return activacion
        ? 'Este enlace ya se usó y tu cuenta ya está activa. Inicia sesión con tu contraseña.'
        : 'Este enlace ya se usó. Si necesitas cambiar la contraseña otra vez, pide uno nuevo.';
    case 'expired':
      return `Este enlace venció${vence ? ` el ${vence}` : ''}. Pide uno nuevo y te llegará otro correo.`;
    case 'replaced':
      return 'Pediste un enlace más reciente y este quedó anulado. Usa el del último correo que recibiste.';
    case 'locked':
      return 'Este enlace se anuló por demasiados intentos fallidos con el código. Pide uno nuevo.';
    case 'suspended':
      return 'Este enlace se anuló porque la cuenta fue suspendida. Contacta con la administración.';
    default:
      return 'El enlace no es válido. Comprueba que se abrió completo o pide uno nuevo.';
  }
}

const CODIGO_INCORRECTO =
  'El código no es correcto o ya venció. Revisa el último correo que recibiste: tras varios '
  + 'intentos fallidos el código se anula por seguridad y hay que pedir uno nuevo.';

export interface ConsumeInput {
  token?: string;
  email?: string;
  code?: string;
  password: string;
}

export interface TokenCheck {
  state: TokenState | 'invalid';
  message: string | null;
  firstName?: string;
  email?: string;
  expiresAt?: string;
}

@Injectable()
export class ActivationService {
  constructor(
    @InjectRepository(User) private readonly users: Repository<User>,
    private readonly tokens: AccountTokensService,
    private readonly sessions: AuthSessionsService,
    private readonly accountMail: AccountMailService,
    private readonly audit: AuditService,
    private readonly config: ConfigService,
    private readonly dataSource: DataSource,
  ) {}

  private get cooldown(): number {
    return identityConfig.resendCooldownSeconds(this.config);
  }

  /**
   * V3.2 §8.4: última solicitud pública por correo y propósito. Vale igual
   * para correos que no existen, así la espera que se informa no distingue
   * cuentas reales de inventadas.
   */
  private readonly ultimaSolicitud = new Map<string, number>();

  /**
   * Segundos que faltan para la próxima solicitud de este correo. Si ya no
   * falta nada, la solicitud actual abre una ventana nueva. `servidor` es lo
   * que dicen los tokens de una cuenta real (p. ej. el que emitió el
   * administrador): manda el mayor de los dos.
   */
  private esperaPara(email: string, proposito: string, servidor = 0): number {
    const ahora = Date.now();
    const ventana = this.cooldown * 1000;
    if (this.ultimaSolicitud.size > 5000) {
      for (const [k, t] of this.ultimaSolicitud) if (ahora - t >= ventana) this.ultimaSolicitud.delete(k);
    }
    const clave = `${proposito}:${email.trim().toLowerCase()}`;
    const previa = this.ultimaSolicitud.get(clave);
    let restante = previa !== undefined && ahora - previa < ventana ? Math.ceil((ventana - (ahora - previa)) / 1000) : 0;
    if (restante === 0 && servidor === 0) {
      this.ultimaSolicitud.set(clave, ahora);
      restante = this.cooldown;
    }
    return Math.max(restante, servidor);
  }

  /**
   * Comprueba que el correo sea institucional antes de nada.
   *
   * No delata cuentas: decir «ese dominio no es institucional» depende del
   * texto escrito, no de lo que haya en la base.
   */
  private assertInstitutional(email: string): void {
    const dominios = institutionalEmailDomains(this.config);
    if (!isInstitutionalEmail(email, dominios)) {
      const lista = dominios.map((d) => `@${d}`).join(' o ');
      throw new BadRequestException(
        `Usa tu correo institucional${lista ? ` (${lista})` : ''}. A otros correos no enviamos nada.`,
      );
    }
  }

  // ======================================================================
  //  Activación
  // ======================================================================

  /**
   * Solicita (o reenvía) el correo de activación.
   *
   * La respuesta es la misma exista o no la cuenta, salvo una excepción que
   * pide V3.2 §8.3: si la cuenta ya está activa se dice, sin enviar nada.
   */
  async requestActivation(email: string) {
    this.assertInstitutional(email);
    const user = await this.findByEmail(email);

    if (user && user.status === UserStatus.ACTIVE) return respuestaYaActiva();

    let servidor = 0;
    if (user && user.status === UserStatus.PENDING_ACTIVATION) {
      const puede = await this.accountMail.check(user.id, 'account_activation');
      if (puede.allowed) {
        await this.accountMail.enqueue(user.id, 'account_activation', user.id);
        await this.audit.record({
          actorUserId: user.id,
          eventType: AuditEventType.ACTIVATION_REQUESTED,
          entityType: 'user',
          entityId: user.id,
        });
      } else if (puede.reason === 'cooldown' || puede.reason === 'daily_limit') {
        servidor = puede.retryAfterSeconds;
      }
    }
    return respuestaGenerica(this.esperaPara(email, 'activation', servidor));
  }

  /**
   * Encola la activación de una cuenta recién provisionada.
   *
   * Devuelve el identificador del envío, **nunca el token**: el código solo
   * viaja al correo institucional de su titular. Antes, sin SMTP configurado,
   * se le devolvía al administrador para poder activar en desarrollo, y eso
   * dejaba en manos de quien crea la cuenta la llave para entrar en ella.
   */
  async queueActivation(user: User, requestedBy: string | null): Promise<string> {
    return this.accountMail.enqueue(user.id, 'account_activation', requestedBy);
  }

  /** Estado de un enlace, para que la pantalla diga qué pasa antes de pedir la contraseña. */
  async checkToken(token: string, purpose: AccountTokenPurpose): Promise<TokenCheck> {
    const { record, state } = await this.tokens.inspect(token, purpose);
    if (!record) return { state, message: explicarEstado(state, purpose) };

    const vence = formatearFecha(record.expiresAt, appTimezone(this.config));
    // Una activación sobre una cuenta que ya no está pendiente no sirve aunque
    // el enlace siga vivo: se dice como lo que es.
    let estado: TokenState | 'invalid' = state;
    if (
      purpose === AccountTokenPurpose.ACCOUNT_ACTIVATION
      && state === 'valid'
      && record.user.status !== UserStatus.PENDING_ACTIVATION
    ) {
      estado = record.user.status === UserStatus.ACTIVE ? 'used' : 'suspended';
    }
    return {
      state: estado,
      message: estado === 'valid' ? null : explicarEstado(estado, purpose, vence),
      firstName: record.user.firstName,
      email: maskEmail(record.user.email),
      expiresAt: record.expiresAt.toISOString(),
    };
  }

  /**
   * Activa la cuenta: con el enlace o con correo y código, aplica la política
   * de contraseña y deja el usuario ACTIVE. Todo en una transacción (§75).
   */
  async activate(input: ConsumeInput): Promise<{ message: string }> {
    const record = await this.resolver(input, AccountTokenPurpose.ACCOUNT_ACTIVATION);
    const user = record.user;
    if (user.status !== UserStatus.PENDING_ACTIVATION) {
      throw new BadRequestException(
        user.status === UserStatus.ACTIVE
          ? 'Esta cuenta ya está activa. Inicia sesión con tu contraseña.'
          : 'Esta cuenta no se puede activar. Contacta con la administración.',
      );
    }

    await this.assertPasswordAcceptable(input.password, user);

    await this.dataSource.transaction(async (manager) => {
      await manager.getRepository(User).update(
        { id: user.id },
        { passwordHash: await bcrypt.hash(input.password, 10), status: UserStatus.ACTIVE },
      );
      await this.tokens.consume(record.id, manager);
      await this.audit.record(
        {
          actorUserId: user.id,
          eventType: AuditEventType.ACCOUNT_ACTIVATED,
          entityType: 'user',
          entityId: user.id,
          metadata: { via: input.token ? 'link' : 'code' },
        },
        manager,
      );
    });

    return { message: 'Cuenta activada. Ya puedes iniciar sesión.' };
  }

  // ======================================================================
  //  Recuperación de contraseña
  // ======================================================================

  async requestPasswordReset(email: string) {
    this.assertInstitutional(email);
    const user = await this.findByEmail(email);

    // Una cuenta sin activar no «recupera»: activa. Se le reenvía la activación
    // para que el usuario no quede en un callejón sin salida.
    let servidor = 0;
    if (user && user.status === UserStatus.PENDING_ACTIVATION) {
      const puede = await this.accountMail.check(user.id, 'account_activation');
      if (puede.allowed) await this.accountMail.enqueue(user.id, 'account_activation', user.id);
      else if (puede.reason === 'cooldown' || puede.reason === 'daily_limit') servidor = puede.retryAfterSeconds;
      return respuestaGenerica(this.esperaPara(email, 'reset', servidor));
    }

    if (user && user.status === UserStatus.ACTIVE) {
      const puede = await this.accountMail.check(user.id, 'password_reset');
      if (puede.allowed) {
        await this.accountMail.enqueue(user.id, 'password_reset', user.id);
        await this.audit.record({
          actorUserId: user.id,
          eventType: AuditEventType.PASSWORD_RESET_REQUESTED,
          entityType: 'user',
          entityId: user.id,
        });
      } else if (puede.reason === 'cooldown' || puede.reason === 'daily_limit') {
        servidor = puede.retryAfterSeconds;
      }
    }

    return respuestaGenerica(this.esperaPara(email, 'reset', servidor));
  }

  /**
   * Restablece la contraseña y **cierra todas las sesiones** (§14).
   *
   * Si alguien recupera la cuenta es porque pudo haberla perdido: dejar
   * abiertas las sesiones de quien la tuviera anularía la recuperación.
   */
  async resetPassword(input: ConsumeInput): Promise<{ message: string }> {
    const record = await this.resolver(input, AccountTokenPurpose.PASSWORD_RESET);
    const user = record.user;
    if (user.status !== UserStatus.ACTIVE) {
      throw new BadRequestException('Esta cuenta no está activa. Contacta con la administración.');
    }
    await this.assertPasswordAcceptable(input.password, user);

    let revoked = 0;
    await this.dataSource.transaction(async (manager) => {
      await manager.getRepository(User).update(
        { id: user.id },
        { passwordHash: await bcrypt.hash(input.password, 10) },
      );
      await this.tokens.consume(record.id, manager);
      revoked = await this.sessions.revokeAllForUser(user.id, manager);
      await this.audit.record(
        {
          actorUserId: user.id,
          eventType: AuditEventType.PASSWORD_CHANGED,
          entityType: 'user',
          entityId: user.id,
          metadata: { revokedSessions: revoked, via: input.token ? 'password_reset_link' : 'password_reset_code' },
        },
        manager,
      );
    });

    return {
      message: 'Contraseña actualizada. Se cerraron las sesiones abiertas; vuelve a iniciar sesión.',
    };
  }

  // ======================================================================

  /**
   * Encuentra el token a partir del enlace o del par correo + código.
   *
   * Con el enlace se explica el motivo exacto si no sirve. Con el código no:
   * ahí cualquiera puede escribir un correo ajeno, y un mensaje distinto
   * según exista o no la cuenta serviría para enumerarlas.
   */
  private async resolver(input: ConsumeInput, purpose: AccountTokenPurpose): Promise<AccountToken> {
    if (input.token) {
      const { record, state } = await this.tokens.inspect(input.token.trim(), purpose);
      if (!record || state !== 'valid') {
        const vence = record ? formatearFecha(record.expiresAt, appTimezone(this.config)) : undefined;
        throw new BadRequestException(explicarEstado(state, purpose, vence));
      }
      return record;
    }

    if (!input.email || !input.code) {
      throw new BadRequestException(
        'Abre el enlace del correo o escribe tu correo institucional y el código de 6 dígitos.',
      );
    }
    const user = await this.findByEmail(input.email);
    if (!user) throw new BadRequestException(CODIGO_INCORRECTO);
    const resultado = await this.tokens.verifyCode(user.id, purpose, input.code);
    if (!resultado.ok) throw new BadRequestException(CODIGO_INCORRECTO);
    return resultado.record;
  }

  private async findByEmail(email: string): Promise<User | null> {
    const normalized = email?.toLowerCase().trim();
    if (!normalized) return null;
    return this.users.findOne({ where: { email: normalized } });
  }

  /** Aplica §13, incluidas las reglas que dependen del propio usuario. */
  private async assertPasswordAcceptable(password: string, user: User): Promise<void> {
    // Toda cuenta tiene código universitario: la regla vale para todos.
    const error = passwordPolicyError(password, {
      email: user.email,
      universityCode: user.universityCode ?? null,
    });
    if (error) throw new BadRequestException(error);
  }
}
