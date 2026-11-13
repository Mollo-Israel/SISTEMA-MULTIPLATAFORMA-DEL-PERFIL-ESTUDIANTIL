import 'reflect-metadata';
import { join } from 'node:path';
import * as dotenv from 'dotenv';
import { DataSource } from 'typeorm';
import { databaseConnection } from '../config/database-connection';

dotenv.config({ path: join(__dirname, '..', '..', '..', '.env') });

export const AppDataSource = new DataSource({
  type: 'postgres',
  ...databaseConnection((clave) => process.env[clave]),
  entities: [join(__dirname, '..', 'entities', '*.entity.{ts,js}')],
  migrations: [join(__dirname, 'migrations', '*.{ts,js}')],
  synchronize: false,
});
