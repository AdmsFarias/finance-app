import type { MigrationInterface, QueryRunner } from 'typeorm';

export class AddFxRate1700000001000 implements MigrationInterface {
  name = 'AddFxRate1700000001000';

  public async up(q: QueryRunner): Promise<void> {
    await q.query(`
      CREATE TYPE fx_rate_source AS ENUM ('PROVIDER','MANUAL_OVERRIDE')
    `);

    await q.query(`
      CREATE TABLE fx_rate (
        id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        source     fx_rate_source NOT NULL DEFAULT 'PROVIDER',
        from_code  CHAR(3) NOT NULL,
        to_code    CHAR(3) NOT NULL,
        rate_date  DATE NOT NULL,
        rate       NUMERIC(20,10) NOT NULL CHECK (rate > 0),
        fetched_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      )
    `);

    await q.query(
      `CREATE UNIQUE INDEX uq_fx_rate_source_pair_date ON fx_rate(source, from_code, to_code, rate_date)`,
    );
    await q.query(
      `CREATE INDEX ix_fx_rate_pair_date ON fx_rate(from_code, to_code, rate_date DESC)`,
    );
  }

  public async down(q: QueryRunner): Promise<void> {
    await q.query(`DROP TABLE IF EXISTS fx_rate`);
    await q.query(`DROP TYPE IF EXISTS fx_rate_source`);
  }
}
