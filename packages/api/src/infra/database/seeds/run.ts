import { AppDataSource } from '../typeorm.config';
import { seedCurrencies } from './currencies.seed';

async function main() {
  await AppDataSource.initialize();
  try {
    await seedCurrencies(AppDataSource);
    console.log('seed: done');
  } finally {
    await AppDataSource.destroy();
  }
}

void main().catch((err) => {
  console.error(err);
  process.exit(1);
});
