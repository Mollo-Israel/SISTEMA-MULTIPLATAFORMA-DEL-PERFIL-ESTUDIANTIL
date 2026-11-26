import { All, Controller, GoneException } from '@nestjs/common';
import { ApiExcludeController } from '@nestjs/swagger';
import { Public } from '../auth/decorators/public.decorator';

/**
 * V7.1 §7 · Registros verificables propios: retirados.
 *
 * Afinia ya no emite ni verifica documentos propios. Todas las rutas que
 * tenía el módulo (emitir, política, registro, descargas, y las públicas de
 * verificación, claves, estado y Open Badges) responden **410** con un texto
 * neutro: no confirman ni niegan la vigencia de nada y no devuelven datos de
 * ninguna persona. Las tablas, claves y migraciones se conservan como
 * histórico interno; la lectura de QR externos y el QR del perfil no dependen
 * de este módulo.
 */
@ApiExcludeController()
@Controller()
export class RetiredCredentialsController {
  private retirado(): never {
    throw new GoneException({
      code: 'SERVICE_RETIRED',
      message: 'Este servicio ya no está disponible. Afinia no emite ni verifica certificados; consulta a la institución o al proveedor que lo emitió.',
    });
  }

  @Public()
  @All(['credentials', 'credentials/*'])
  credentials(): never {
    return this.retirado();
  }

  @Public()
  @All(['public/credentials', 'public/credentials/*'])
  publicCredentials(): never {
    return this.retirado();
  }
}
