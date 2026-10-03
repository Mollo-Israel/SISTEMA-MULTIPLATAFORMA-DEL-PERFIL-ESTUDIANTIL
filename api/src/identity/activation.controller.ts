import { Body, Controller, HttpCode, Post } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import { AccountTokenPurpose } from '@perfil/shared';
import { Public } from '../auth/decorators/public.decorator';
import { ActivationService } from './activation.service';
import { CheckTokenDto, ConsumeTokenDto, RequestByEmailDto } from './dto/activation.dto';
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
    summary: 'Solicitar o reenviar el correo de activación.',
    description:
      'Solo a correos institucionales. La respuesta es idéntica exista o no la cuenta, para no '
      + 'permitir enumerar correos, e incluye los segundos de espera antes de poder pedir otro.',
  })
  requestActivation(@Body() dto: RequestByEmailDto) {
    return this.activation.requestActivation(dto.email);
  }

  @Public()
  @Post('check')
  @HttpCode(200)
  @Throttle({ default: ACTIVATION_RATE_LIMIT })
  @ApiOperation({
    summary: 'Comprobar un enlace antes de pedir la contraseña.',
    description:
      'Dice si sirve y, si no, por qué: usado, vencido o reemplazado por uno más reciente. Va por '
      + 'POST para que el token no quede en el registro de rutas.',
  })
  check(@Body() dto: CheckTokenDto) {
    return this.activation.checkToken(
      dto.token,
      dto.purpose === 'activation'
        ? AccountTokenPurpose.ACCOUNT_ACTIVATION
        : AccountTokenPurpose.PASSWORD_RESET,
    );
  }

  @Public()
  @Post('activate')
  @HttpCode(200)
  @Throttle({ default: ACTIVATION_RATE_LIMIT })
  @ApiOperation({
    summary: 'Activar la cuenta y fijar la contraseña.',
    description: 'Con el token del enlace, o con el correo institucional y el código de 6 dígitos.',
  })
  activate(@Body() dto: ConsumeTokenDto) {
    return this.activation.activate(dto);
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
    summary: 'Fijar una contraseña nueva.',
    description:
      'Con el token del enlace, o con el correo y el código de 6 dígitos. Cierra todas las '
      + 'sesiones abiertas del usuario.',
  })
  resetPassword(@Body() dto: ConsumeTokenDto) {
    return this.activation.resetPassword(dto);
  }
}
