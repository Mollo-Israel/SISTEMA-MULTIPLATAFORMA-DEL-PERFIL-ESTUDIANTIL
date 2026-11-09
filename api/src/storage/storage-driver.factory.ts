import type { ConfigService } from '@nestjs/config';
import { R2StorageDriver, readR2Settings } from './r2-storage.driver';

/** Drivers de almacenamiento disponibles (V3 RNF08: la configuración manda). */
export const STORAGE_DRIVERS = ['local', 'r2'] as const;

/**
 * Elige el driver según `STORAGE_DRIVER`. Un valor desconocido o una
 * configuración incompleta detiene el arranque: ignorarlo en silencio guardaría
 * los archivos donde nadie espera.
 */
export function storageDriverFactory<T>(config: Pick<ConfigService, 'get'>, local: T): T | R2StorageDriver {
  const driver = (config.get<string>('STORAGE_DRIVER') ?? 'local').trim().toLowerCase() || 'local';
  if (!(STORAGE_DRIVERS as readonly string[]).includes(driver)) {
    throw new Error(`STORAGE_DRIVER=${driver} no está soportado. Valores válidos: ${STORAGE_DRIVERS.join(', ')}.`);
  }
  if (driver === 'r2') {
    const { settings, missing } = readR2Settings(config);
    if (missing.length) throw new Error(`STORAGE_DRIVER=r2 necesita: ${missing.join(', ')}.`);
    return new R2StorageDriver(settings);
  }
  return local;
}
