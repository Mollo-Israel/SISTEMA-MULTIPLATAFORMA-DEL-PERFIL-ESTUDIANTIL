import { ForbiddenException, Injectable, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import * as bcrypt from 'bcryptjs';
import { RolNombre, UserStatus } from '@perfil/shared';

/**
 * Cliente que se presenta en la cabecera `X-Afinia-Client` (V2 §67). No es
 * autorización —un cliente cualquiera puede omitirla y entonces es la web,
 * donde cada rol tiene su lugar—: es la regla de producto «la app móvil es
 * del Estudiante», aplicada antes de emitir la sesión y no ocultando botones.
 */
export type ClientKind = 'web' | 'mobile';

export function assertClientAllowsRole(client: ClientKind | undefined, role: string): void {
  if (client === 'mobile' && role !== RolNombre.STUDENT) {
    throw new ForbiddenException({
      code: 'MOBILE_STUDENT_ONLY',
      message: 'La aplicación móvil es para estudiantes. Entra a Afinia desde la web.',
    });
  }
}
import { UsersService } from '../users/users.service';
import { PublicUser, toPublicUser } from '../users/types/public-user';
import { AuthSessionsService, SessionContext } from '../identity/auth-sessions.service';
import { AuditEventType, AuditService } from '../audit/audit.service';
import { identityConfig } from '../config/identity.config';
import { LoginDto } from './dto/login.dto';
import { JwtPayload } from './types/authenticated-user';

export interface AuthResult {
  accessToken: string;
  /** Opaco y rotatorio. El cliente lo guarda y lo canjea; nunca lo interpreta. */
  refreshToken: string;
  /** Segundos de vida del access token, para que el cliente sepa cuándo renovar. */
  expiresIn: number;
  user: PublicUser;
}

/**
 * Autenticación (especificación §14).
 *
 * No existe `register`: §9.1 elimina el registro público. Una cuenta se crea
 * por provisionamiento administrativo y se activa desde `/activation`.
 *
 * El access token es corto y el refresh es rotatorio y revocable. La sesión
 * vive en base de datos precisamente para poder cortarla antes de que el JWT
 * caduque.
 */
@Injectable()
export class AuthService {
  constructor(
    private readonly usersService: UsersService,
    private readonly jwtService: JwtService,
    private readonly sessions: AuthSessionsService,
    private readonly audit: AuditService,
    private readonly config: ConfigService,
  ) {}

  async login(dto: LoginDto, context: SessionContext = {}): Promise<AuthResult> {
    const entity = await this.usersService.findByEmailWithPassword(dto.email);

    // Mismo mensaje para "no existe" y "contraseña incorrecta": distinguirlos
    // convertiría el login en un verificador de correos registrados.
    if (!entity) {
      throw new UnauthorizedException('Credenciales inválidas.');
    }

    const valid = await bcrypt.compare(dto.password, entity.passwordHash);
    if (!valid) {
      throw new UnauthorizedException('Credenciales inválidas.');
    }

    // El estado sí se explica, pero solo tras acreditar la contraseña: a esas
    // alturas quien pregunta ya demostró ser el titular.
    if (entity.status !== UserStatus.ACTIVE) {
      throw new UnauthorizedException(this.explainStatus(entity.status));
    }

    const user = toPublicUser(entity);
    // Antes de crear la sesión: si el cliente no corresponde, no queda nada abierto.
    assertClientAllowsRole(context.client, user.role);
    const session = await this.sessions.create(user.id, context);

    return {
      accessToken: this.signAccessToken(user),
      refreshToken: session.refreshToken,
      expiresIn: identityConfig.accessTokenTtlMinutes(this.config) * 60,
      user,
    };
  }

  /**
   * Canjea un refresh token por un par nuevo.
   *
   * La rotación es condicional: si el mismo token llega dos veces, solo el
   * primero encuentra la sesión. Un token reutilizado no produce acceso.
   */
  async refresh(refreshToken: string, client?: ClientKind): Promise<AuthResult> {
    const session = await this.sessions.findUsable(refreshToken);
    if (!session) {
      throw new UnauthorizedException('La sesión expiró o fue cerrada. Inicie sesión de nuevo.');
    }
    // Una sesión de personal no se renueva desde la app móvil (V2 §67).
    assertClientAllowsRole(client, session.user.role?.name ?? '');

    if (session.user.status !== UserStatus.ACTIVE) {
      await this.sessions.revoke(session.id);
      throw new UnauthorizedException(this.explainStatus(session.user.status));
    }

    let rotated = await this.sessions.rotate(session, refreshToken);
    if (!rotated) {
      // Otra renovacion con el mismo token gano la carrera por milesimas. Si
      // sigue dentro de la gracia, se rota desde el token que ella dejo
      // vigente; si no, el token ya no sirve.
      const vigente = await this.sessions.findUsable(refreshToken);
      if (vigente) rotated = await this.sessions.rotate(vigente, refreshToken);
    }
    if (!rotated) {
      throw new UnauthorizedException('La sesión expiró o fue cerrada. Inicie sesión de nuevo.');
    }

    const user = toPublicUser(session.user);
    return {
      accessToken: this.signAccessToken(user),
      refreshToken: rotated.refreshToken,
      expiresIn: identityConfig.accessTokenTtlMinutes(this.config) * 60,
      user,
    };
  }

  /** Cierra la sesión presentada. Idempotente: cerrar dos veces no es un error. */
  async logout(refreshToken: string | undefined, userId: string | null): Promise<{ message: string }> {
    if (refreshToken) {
      const revoked = await this.sessions.revokeByToken(refreshToken);
      if (revoked && userId) {
        await this.audit.record({
          actorUserId: userId,
          eventType: AuditEventType.SESSION_REVOKED,
          entityType: 'user',
          entityId: userId,
        });
      }
    }
    return { message: 'Sesión cerrada.' };
  }

  /** Cierra todas las sesiones del usuario, incluida la actual. */
  async logoutAll(userId: string): Promise<{ message: string; revoked: number }> {
    const revoked = await this.sessions.revokeAllForUser(userId);
    await this.audit.record({
      actorUserId: userId,
      eventType: AuditEventType.ALL_SESSIONS_REVOKED,
      entityType: 'user',
      entityId: userId,
      metadata: { revoked },
    });
    return { message: 'Se cerraron todas las sesiones.', revoked };
  }

  listSessions(userId: string) {
    return this.sessions.listActive(userId);
  }

  me(userId: string): Promise<PublicUser> {
    return this.usersService.findOne(userId);
  }

  private signAccessToken(user: PublicUser): string {
    const payload: JwtPayload = { sub: user.id, email: user.email, role: user.role };
    return this.jwtService.sign(payload, {
      expiresIn: `${identityConfig.accessTokenTtlMinutes(this.config)}m`,
    });
  }

  private explainStatus(status: UserStatus): string {
    switch (status) {
      case UserStatus.PENDING_ACTIVATION:
        return 'La cuenta aún no está activada. Revise su correo institucional o solicite un nuevo enlace de activación.';
      case UserStatus.SUSPENDED:
        return 'La cuenta está suspendida. Contacte con el administrador.';
      default:
        return 'La cuenta está inactiva.';
    }
  }
}
