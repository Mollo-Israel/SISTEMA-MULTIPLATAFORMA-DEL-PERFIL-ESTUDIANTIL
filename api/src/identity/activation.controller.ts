import { Body, Controller, HttpCode, Post } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import { Public } from '../auth/decorators/public.decorator';
import { ActivationService } from './activation.service';
import { ConsumeTokenDto, RequestByEmailDto } from './dto/activation.dto';
import { ACTIVATION_RATE_LIMIT } from '../config/identity.config';

/**
 * Activación de cuenta y recuperación de contraseña (especificación §12).
 *
 * Son los únicos endpoints públicos junto al login: sustituyen al registro
 * público, que §9.1 elimina. Todos llevan límite de peticiones propio porque
 * son los candidatos naturales a fuerza bruta y a envío masivo de correo (§15).
 */
@ApiTags('activation')
@Controller('activation')
export class ActivationController {
  constructor(private readonly activation: ActivationService) {}

  @Public()
  @Post('request')
  @HttpCode(200)
  @Throttle({ default: ACTIVATION_RATE_LIMIT })
  @ApiOperation({
    summary: 'Solicitar o reenviar el enlace de activación.',
    description:
      'La respuesta es idéntica exista o no la cuenta, para no permitir enumerar correos.',
  })
  requestActivation(@Body() dto: RequestByEmailDto) {
    return this.activation.requestActivation(dto.email);
  }

  @Public()
  @Post('activate')
  @HttpCode(200)
  @Throttle({ default: ACTIVATION_RATE_LIMIT })
  @ApiOperation({ summary: 'Activar la cuenta con el código recibido y fijar la contraseña.' })
  activate(@Body() dto: ConsumeTokenDto) {
    return this.activation.activate(dto.token, dto.password);
  }

  @Public()
  @Post('forgot-password')
  @HttpCode(200)
  @Throttle({ default: ACTIVATION_RATE_LIMIT })
  @ApiOperation({
    summary: 'Solicitar el restablecimiento de la contraseña.',
    description: 'Respuesta genérica. Una cuenta sin activar recibe activación, no recuperación.',
  })
  forgotPassword(@Body() dto: RequestByEmailDto) {
    return this.activation.requestPasswordReset(dto.email);
  }

  @Public()
  @Post('reset-password')
  @HttpCode(200)
  @Throttle({ default: ACTIVATION_RATE_LIMIT })
  @ApiOperation({
    summary: 'Fijar una contraseña nueva con el código de recuperación.',
    description: 'Cierra todas las sesiones abiertas del usuario.',
  })
  resetPassword(@Body() dto: ConsumeTokenDto) {
    return this.activation.resetPassword(dto.token, dto.password);
  }
}
