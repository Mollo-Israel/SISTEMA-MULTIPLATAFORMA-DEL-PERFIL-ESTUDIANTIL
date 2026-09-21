import { Body, Controller, Delete, Get, HttpCode, Post, Req } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import type { Request } from 'express';
import { AuthService } from './auth.service';
import { LoginDto } from './dto/login.dto';
import { RefreshDto } from './dto/refresh.dto';
import { Public } from './decorators/public.decorator';
import { CurrentUser } from './decorators/current-user.decorator';
import { AuthenticatedUser } from './types/authenticated-user';
import { AUTH_RATE_LIMIT } from '../config/identity.config';

/**
 * Acceso (especificación §14).
 *
 * No hay `POST /auth/register`: §9.1 lo elimina. Una cuenta nace provisionada
 * por el administrador y se activa en `/activation`.
 */
@ApiTags('auth')
@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Public()
  @Post('login')
  @HttpCode(200)
  // Límite estrecho: el login es el objetivo natural de la fuerza bruta (§15).
  @Throttle({ default: AUTH_RATE_LIMIT })
  @ApiOperation({ summary: 'Iniciar sesión. Devuelve access token y refresh token.' })
  login(@Body() dto: LoginDto, @Req() req: Request) {
    return this.authService.login(dto, {
      userAgent: req.headers['user-agent'] ?? null,
      ipAddress: req.ip ?? null,
    });
  }

  @Public()
  @Post('refresh')
  @HttpCode(200)
  @Throttle({ default: AUTH_RATE_LIMIT })
  @ApiOperation({
    summary: 'Canjear el refresh token por un par nuevo.',
    description: 'Rotatorio: el token presentado deja de servir en cuanto se canjea.',
  })
  refresh(@Body() dto: RefreshDto) {
    return this.authService.refresh(dto.refreshToken);
  }

  @Public()
  @Post('logout')
  @HttpCode(200)
  @ApiOperation({ summary: 'Cerrar la sesión actual revocando su refresh token.' })
  logout(@Body() dto: RefreshDto, @CurrentUser() user?: AuthenticatedUser) {
    return this.authService.logout(dto.refreshToken, user?.userId ?? null);
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
