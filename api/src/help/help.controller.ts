import { Controller, Get } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { Public } from '../auth/decorators/public.decorator';
import { helpVideo } from './help-video';

/**
 * Centro de ayuda (V2 §65). Pública a propósito: la ayuda tiene que poder
 * abrirse también antes de iniciar sesión (activar la cuenta, recuperar la
 * contraseña). No expone nada más que el video configurado.
 */
@ApiTags('help')
@Controller('help')
export class HelpController {
  constructor(private readonly config: ConfigService) {}

  @Public()
  @Get()
  @ApiOperation({ summary: 'Configuración pública del centro de ayuda (video explicativo).' })
  get() {
    return { video: helpVideo(this.config.get<string>('HELP_VIDEO_URL')) };
  }
}
