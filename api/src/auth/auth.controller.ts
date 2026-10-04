import { Body, Controller, Delete, Get, HttpCode, Post, Req, Res, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import type { Request, Response } from 'express';
import { AuthService } from './auth.service';
import { LoginDto } from './dto/login.dto';
import { RefreshDto } from './dto/refresh.dto';
import { Public } from './decorators/public.decorator';
import { CurrentUser } from './decorators/current-user.decorator';
import { AuthenticatedUser } from './types/authenticated-user';
import { AUTH_RATE_LIMIT } from '../config/identity.config';
import {
  clearRefreshCookie,
  readRefreshCookie,
  setRefreshCookie,
  wantsCookie,
} from './refresh-cookie';

/**
 * Acceso (especificación §14).
 *
 * No hay `POST /auth/register`: §9.1 lo elimina. Una cuenta nace provisionada
 * por el administrador y se activa en `/activation`.
 */
@ApiTags('auth')
@Controller('auth')
export class AuthController {
  constructor(
    private readonly authService: AuthService,
    private readonly config: ConfigService,
  ) {}

  /**
   * Con `X-Session-Transport: cookie` (la web) el refresh token va a una
   * cookie HttpOnly y desaparece del cuerpo; sin ella (móvil), va en el cuerpo.
   */
  private entregar<T extends { refreshToken: string }>(req: Request, res: Response, result: T) {
    if (!wantsCookie(req)) return result;
    setRefreshCookie(res, result.refreshToken, this.config);
    const { refreshToken: _omitido, ...resto } = result;
    return resto;
  }

  @Public()
  @Post('login')
  @HttpCode(200)
  // Límite estrecho: el login es el objetivo natural de la fuerza bruta (§15).
  @Throttle({ default: AUTH_RATE_LIMIT })
  @ApiOperation({ summary: 'Iniciar sesión. Devuelve access token y refresh token.' })
  async login(@Body() dto: LoginDto, @Req() req: Request, @Res({ passthrough: true }) res: Response) {
    const result = await this.authService.login(dto, {
      userAgent: req.headers['user-agent'] ?? null,
      ipAddress: req.ip ?? null,
    });
    return this.entregar(req, res, result);
  }

  @Public()
  @Post('refresh')
  @HttpCode(200)
  @Throttle({ default: AUTH_RATE_LIMIT })
  @ApiOperation({
    summary: 'Canjear el refresh token por un par nuevo.',
    description: 'Rotatorio: el token presentado deja de servir en cuanto se canjea.',
  })
  async refresh(@Body() dto: RefreshDto, @Req() req: Request, @Res({ passthrough: true }) res: Response) {
    const token = dto.refreshToken ?? readRefreshCookie(req);
    if (!token) {
      throw new UnauthorizedException('La sesión expiró o fue cerrada. Inicie sesión de nuevo.');
    }
    try {
      return this.entregar(req, res, await this.authService.refresh(token));
    } catch (error) {
      // Una cookie que ya no sirve se borra: el navegador no debe seguir
      // presentándola.
      if (!dto.refreshToken) clearRefreshCookie(res, this.config);
      throw error;
    }
  }

  @Public()
  @Post('logout')
  @HttpCode(200)
  @ApiOperation({ summary: 'Cerrar la sesión actual revocando su refresh token.' })
  logout(
    @Body() dto: RefreshDto,
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
    @CurrentUser() user?: AuthenticatedUser,
  ) {
    const token = dto.refreshToken ?? readRefreshCookie(req);
    clearRefreshCookie(res, this.config);
    return this.authService.logout(token, user?.userId ?? null);
  }

  @ApiBearerAuth()
  @Delete('sessions')
  @ApiOperation({ summary: 'Cerrar todas las sesiones del usuario.' })
  logoutAll(@CurrentUser() user: AuthenticatedUser) {
    return this.authService.logoutAll(user.userId);
  }

  @ApiBearerAuth()
  @Get('sessions')
  @ApiOperation({ summary: 'Sesiones abiertas del usuario.' })
  sessions(@CurrentUser() user: AuthenticatedUser) {
    return this.authService.listSessions(user.userId);
  }

  @ApiBearerAuth()
  @Get('me')
  @ApiOperation({ summary: 'Usuario de la sesión actual.' })
  me(@CurrentUser() user: AuthenticatedUser) {
    return this.authService.me(user.userId);
  }
}
