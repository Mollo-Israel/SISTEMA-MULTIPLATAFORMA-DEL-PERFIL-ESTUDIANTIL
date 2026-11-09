import { TypeOrmModuleOptions } from '@nestjs/typeorm';
import { ConfigService } from '@nestjs/config';
import * as Entities from '../entities';
import { databaseConnection } from './database-connection';

export function buildDatabaseConfig(config: ConfigService): TypeOrmModuleOptions {
  return {
    type: 'postgres',
    ...databaseConnection((clave) => config.get<string>(clave)),
    entities: Object.values(Entities),
    synchronize: false,
    migrationsRun: false,
  };
}
