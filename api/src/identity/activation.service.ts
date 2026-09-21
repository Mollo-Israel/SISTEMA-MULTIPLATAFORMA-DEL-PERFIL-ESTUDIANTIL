import { BadRequestException, Inject, Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { ConfigService } from '@nestjs/config';
import { DataSource, Repository } from 'typeorm';
import * as bcrypt from 'bcryptjs';
import { AccountTokenPurpose, UserStatus } from '@perfil/shared';
import { User } from '../entities/user.entity';
import { StudentProfile } from '../entities/student-profile.entity';
import { MAIL_PORT, MailPort } from '../mail/mail.port';
import { AuditEventType, AuditService } from '../audit/audit.service';
import { AccountTokensService } from './account-tokens.service';
import { AuthSessionsService } from './auth-sessions.service';
import { passwordPolicyError } from '../common/validation';
import { identityConfig } from '../config/identity.config';

/**
 * Respuesta deliberadamente identica exista o no la cuenta (§12).
 *
 * Si el mensaje cambiara, cualquiera podria averiguar que correos estan dados
 * de alta probando uno por uno.
 */
const GENERIC_RESPONSE = {
  message:
    'Si el correo corresponde a una cuenta registrada, se ha enviado un enlace. '
    + 'Revise su bandeja de entrada.',
};

@Injectable()
export class ActivationService {
  private readonly logger = new Logger(ActivationService.name);

  constructor(
    @InjectRepository(User) private readonly users: Repository<User>,
    @InjectRepository(StudentProfile) private readonly profiles: Repository<StudentProfile>,
    @Inject(MAIL_PORT) private readonly mail: MailPort,
    private readonly tokens: AccountTokensService,
    private readonly sessions: AuthSessionsService,
    private readonly audit: AuditService,
    private readonly config: ConfigService,
    private readonly dataSource: DataSource,
  ) {}

  // ======================================================================
  //  Activación
  // ======================================================================

  /**
   * Solicita (o reenvía) el enlace de activación.
   *
   * Responde siempre lo mismo. El cooldown se aplica igualmente, pero tampoco
   * se revela: un atacante no debe poder deducir nada del tiempo de respuesta
   * ni del texto.
   */
  async requestActivation(email: string): Promise<typeof GENERIC_RESPONSE> {
    const user = await this.findByEmail(email);

    if (user && user.status === UserStatus.PENDING_ACTIVATION) {
      const cooldown = await this.tokens.cooldownRemaining(
        user.id,
        AccountTokenPurpose.ACCOUNT_ACTIVATION,
      );
      if (cooldown === 0) {
        await this.issueAndSendActivation(user);
        await this.audit.record({
          actorUserId: user.id,
          eventType: AuditEventType.ACTIVATION_REQUESTED,
          entityType: 'user',
          entityId: user.id,
        });
      }
    }

    return GENERIC_RESPONSE;
  }

  /**
   * Emite el token y envía el correo. Lo usa también la importación de padrón.
   *
   * Devuelve el token **solo si no hay SMTP configurado**, para que en
   * desarrollo y en las pruebas de integración se pueda activar una cuenta sin
   * montar un servidor de correo. En producción SMTP es obligatorio (§84), de
   * modo que ahí siempre devuelve null y el token únicamente viaja por correo.
   */
  async issueAndSendActivation(user: User): Promise<string | null> {
    const { token, expiresAt } = await this.tokens.issue(
      user.id,
      AccountTokenPurpose.ACCOUNT_ACTIVATION,
    );
    const hours = identityConfig.activationTtlHours(this.config);

    try {
      await this.mail.send({
        to: user.email,
        subject: 'Active su cuenta de Afinia',
        text:
          `Hola ${user.firstName},\n\n`
          + 'Su cuenta institucional en Afinia ya está creada. Para poder entrar, '
          + 'defina su contraseña con este código de activación:\n\n'
          + `${token}\n\n`
          + `El código caduca en ${hours} horas (${expiresAt.toLocaleString('es-BO')}).\n\n`
          + 'Si no esperaba este mensaje, puede ignorarlo.',
      });
    } catch (error) {
      // RNF09: el token ya está emitido y el usuario puede pedir un reenvío.
      // Que el correo falle no debe dejar la cuenta en un estado inconsistente.
      this.logger.error(
        `Token de activación emitido pero no enviado a ${user.email}: ${(error as Error).message}`,
      );
    }

    return this.exposesToken() ? token : null;
  }

  /** Solo fuera de producción y solo si el correo no sale de verdad. */
  private exposesToken(): boolean {
    const isProduction = (this.config.get<string>('NODE_ENV') ?? 'development') === 'production';
    const hasSmtp = !!this.config.get<string>('SMTP_HOST')?.trim();
    return !isProduction && !hasSmtp;
  }

  /**
   * Activa la cuenta: valida el token, aplica la política de contraseña y deja
   * el usuario ACTIVE. Todo en una transacción (§75).
   */
  async activate(token: string, password: string): Promise<{ message: string }> {
    const record = await this.tokens.findUsable(token, AccountTokenPurpose.ACCOUNT_ACTIVATION);
    if (!record) {
      throw new BadRequestException(
        'El enlace de activación no es válido, ya se usó o caducó. Solicite uno nuevo.',
      );
    }

    const user = record.user;
    if (user.status !== UserStatus.PENDING_ACTIVATION) {
      throw new BadRequestException('Esta cuenta ya está activada.');
    }

    await this.assertPasswordAcceptable(password, user);

    await this.dataSource.transaction(async (manager) => {
      await manager.getRepository(User).update(
        { id: user.id },
        { passwordHash: await bcrypt.hash(password, 10), status: UserStatus.ACTIVE },
      );
      await this.tokens.consume(record.id, manager);
      await this.audit.record(
        {
          actorUserId: user.id,
          eventType: AuditEventType.ACCOUNT_ACTIVATED,
          entityType: 'user',
          entityId: user.id,
        },
        manager,
      );
    });

    return { message: 'Cuenta activada. Ya puede iniciar sesión.' };
  }

  // ======================================================================
  //  Recuperación de contraseña
  // ======================================================================

  async requestPasswordReset(email: string): Promise<typeof GENERIC_RESPONSE> {
    const user = await this.findByEmail(email);

    // Una cuenta sin activar no "recupera": activa. Se le reenvía activación
    // para que el usuario no quede en un callejón sin salida.
    if (user && user.status === UserStatus.PENDING_ACTIVATION) {
      const cooldown = await this.tokens.cooldownRemaining(
        user.id,
        AccountTokenPurpose.ACCOUNT_ACTIVATION,
      );
      if (cooldown === 0) await this.issueAndSendActivation(user);
      return GENERIC_RESPONSE;
    }

    if (user && user.status === UserStatus.ACTIVE) {
      const cooldown = await this.tokens.cooldownRemaining(
        user.id,
        AccountTokenPurpose.PASSWORD_RESET,
      );
      if (cooldown === 0) {
        const { token, expiresAt } = await this.tokens.issue(
          user.id,
          AccountTokenPurpose.PASSWORD_RESET,
        );
        const minutes = identityConfig.passwordResetTtlMinutes(this.config);
        try {
          await this.mail.send({
            to: user.email,
            subject: 'Restablecer su contraseña de Afinia',
            text:
              `Hola ${user.firstName},\n\n`
              + 'Recibimos una solicitud para restablecer su contraseña. '
              + 'Use este código:\n\n'
              + `${token}\n\n`
              + `Caduca en ${minutes} minutos (${expiresAt.toLocaleString('es-BO')}).\n\n`
              + 'Si no lo solicitó, ignore este mensaje: su contraseña no ha cambiado.',
          });
        } catch (error) {
          this.logger.error(`No se pudo enviar el restablecimiento: ${(error as Error).message}`);
        }
        await this.audit.record({
          actorUserId: user.id,
          eventType: AuditEventType.PASSWORD_RESET_REQUESTED,
          entityType: 'user',
          entityId: user.id,
        });
      }
    }

    return GENERIC_RESPONSE;
  }

  /**
   * Restablece la contraseña y **cierra todas las sesiones** (§14).
   *
   * Si alguien recupera la cuenta es porque pudo haberla perdido: dejar
   * abiertas las sesiones de quien la tuviera anularía la recuperación.
   */
  async resetPassword(token: string, password: string): Promise<{ message: string }> {
    const record = await this.tokens.findUsable(token, AccountTokenPurpose.PASSWORD_RESET);
    if (!record) {
      throw new BadRequestException(
        'El enlace de recuperación no es válido, ya se usó o caducó. Solicite uno nuevo.',
      );
    }

    const user = record.user;
    await this.assertPasswordAcceptable(password, user);

    let revoked = 0;
    await this.dataSource.transaction(async (manager) => {
      await manager.getRepository(User).update(
        { id: user.id },
        { passwordHash: await bcrypt.hash(password, 10) },
      );
      await this.tokens.consume(record.id, manager);
      revoked = await this.sessions.revokeAllForUser(user.id, manager);
      await this.audit.record(
        {
          actorUserId: user.id,
          eventType: AuditEventType.PASSWORD_CHANGED,
          entityType: 'user',
          entityId: user.id,
          metadata: { revokedSessions: revoked, via: 'password_reset' },
        },
        manager,
      );
    });

    return {
      message:
        'Contraseña actualizada. Se cerraron las sesiones abiertas; vuelva a iniciar sesión.',
    };
  }

  // ======================================================================

  private async findByEmail(email: string): Promise<User | null> {
    const normalized = email?.toLowerCase().trim();
    if (!normalized) return null;
    return this.users.findOne({ where: { email: normalized } });
  }

  /** Aplica §13, incluidas las reglas que dependen del propio usuario. */
  private async assertPasswordAcceptable(password: string, user: User): Promise<void> {
    const profile = await this.profiles.findOne({ where: { userId: user.id } });
    const error = passwordPolicyError(password, {
      email: user.email,
      universityCode: profile?.universityCode ?? null,
    });
    if (error) throw new BadRequestException(error);
  }
}
