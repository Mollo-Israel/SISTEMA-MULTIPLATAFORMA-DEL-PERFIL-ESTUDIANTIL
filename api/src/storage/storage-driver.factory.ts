import type { ConfigService } from '@nestjs/config';

/** Drivers de almacenamiento disponibles (V3 RNF08: la configuración manda). */
export const STORAGE_DRIVERS = ['local'] as const;

/**
 * Elige el driver según `STORAGE_DRIVER`. Un valor desconocido detiene el
 * arranque: ignorarlo en silencio guardaría los archivos donde nadie espera.
 */
export function storageDriverFactory<T>(config: Pick<ConfigService, 'get'>, local: T): T {
  const driver = (config.get<string>('STORAGE_DRIVER') ?? 'local').trim().toLowerCase() || 'local';
  if (!(STORAGE_DRIVERS as readonly string[]).includes(driver)) {
    throw new Error(`STORAGE_DRIVER=${driver} no está soportado. Valores válidos: ${STORAGE_DRIVERS.join(', ')}.`);
  }
  return local;
}
