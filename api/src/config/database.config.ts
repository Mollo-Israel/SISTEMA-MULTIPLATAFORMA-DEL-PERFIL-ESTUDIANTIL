import { TypeOrmModuleOptions } from '@nestjs/typeorm';
import { ConfigService } from '@nestjs/config';
import * as Entities from '../entities';

export function buildDatabaseConfig(config: ConfigService): TypeOrmModuleOptions {
  return {
    type: 'postgres',
    host: config.get<string>('POSTGRES_HOST', 'localhost'),
    port: config.get<number>('POSTGRES_PORT', 5432),
    username: config.get<string>('POSTGRES_USER', 'perfil_user'),
    password: config.get<string>('POSTGRES_PASSWORD', 'perfil_pass'),
    database: config.get<string>('POSTGRES_DB', 'perfil_estudiantil'),
    entities: Object.values(Entities),
    synchronize: false,
    migrationsRun: false,
  };
}
