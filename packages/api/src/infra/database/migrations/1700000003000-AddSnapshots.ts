import type { MigrationInterface, QueryRunner } from 'typeorm';

export class AddSnapshots1700000003000 implements MigrationInterface {
  name = 'AddSnapshots1700000003000';

  public async up(q: QueryRunner): Promise<void> {
    await q.query(`CREATE TYPE snapshot_source AS ENUM ('MANUAL','IMPORT')`);

    await q.query(`
      CREATE TABLE snapshot_batch (
        id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        group_id       UUID NOT NULL REFERENCES finance_group(id) ON DELETE CASCADE,
        snapshot_date  DATE NOT NULL,
        source         snapshot_source NOT NULL DEFAULT 'MANUAL',
        note           TEXT,
        base_currency  CHAR(3) NOT NULL REFERENCES currency(code),
        total_base     NUMERIC(20,2) NOT NULL DEFAULT 0,
        entry_count    INTEGER NOT NULL DEFAULT 0,
        created_by     UUID NOT NULL REFERENCES app_user(id),
        created_at     TIMESTAMPTZ NOT NULL DEFAULT NOW()
      )
    `);

    await q.query(
      `CREATE INDEX ix_snapshot_batch_group_date ON snapshot_batch(group_id, snapshot_date DESC, created_at DESC)`,
    );

    await q.query(`
      CREATE TABLE balance_snapshot (
        id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        batch_id       UUID NOT NULL REFERENCES snapshot_batch(id) ON DELETE CASCADE,
        wallet_id      UUID NOT NULL REFERENCES wallet(id) ON DELETE RESTRICT,
        wallet_name    TEXT NOT NULL,
        wallet_type    wallet_type NOT NULL,
        currency_code  CHAR(3) NOT NULL REFERENCES currency(code),
        amount         NUMERIC(20,2) NOT NULL,
        amount_base    NUMERIC(20,2) NOT NULL,
        fx_rate        NUMERIC(20,10) NOT NULL,
        fx_rate_date   DATE NOT NULL,
        fx_source      fx_rate_source NOT NULL,
        created_at     TIMESTAMPTZ NOT NULL DEFAULT NOW()
      )
    `);

    await q.query(
      `CREATE UNIQUE INDEX uq_balance_snapshot_batch_wallet ON balance_snapshot(batch_id, wallet_id)`,
    );
    await q.query(
      `CREATE INDEX ix_balance_snapshot_wallet_date ON balance_snapshot(wallet_id, created_at DESC)`,
    );
  }

  public async down(q: QueryRunner): Promise<void> {
    await q.query(`DROP TABLE IF EXISTS balance_snapshot`);
    await q.query(`DROP TABLE IF EXISTS snapshot_batch`);
    await q.query(`DROP TYPE IF EXISTS snapshot_source`);
  }
}
