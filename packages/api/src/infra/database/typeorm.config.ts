import 'reflect-metadata';
import { DataSource } from 'typeorm';
import { config } from 'dotenv';
import { resolve } from 'node:path';

// Loads .env from the monorepo root (fallback) and from the package
config({ path: resolve(__dirname, '../../../../../.env') });
config({ path: resolve(__dirname, '../../../.env') });

/**
 * DataSource shared between the app runtime and the TypeORM CLI (migrations/seeds).
 * Entities and migrations are added as the phases progress.
 */
export const AppDataSource = new DataSource({
  type: 'postgres',
  url: process.env.DATABASE_URL,
  entities: [__dirname + '/../../modules/**/*.entity.{ts,js}'],
  migrations: [__dirname + '/migrations/*.{ts,js}'],
  migrationsRun: false,
  synchronize: false,
  logging: process.env.NODE_ENV !== 'production' ? ['error', 'warn'] : ['error'],
});
