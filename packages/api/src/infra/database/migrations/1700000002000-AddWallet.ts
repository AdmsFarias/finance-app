import type { MigrationInterface, QueryRunner } from 'typeorm';

export class AddWallet1700000002000 implements MigrationInterface {
  name = 'AddWallet1700000002000';

  public async up(q: QueryRunner): Promise<void> {
    await q.query(`
      CREATE TYPE wallet_type AS ENUM ('CHECKING','SAVINGS','CASH','CREDIT_CARD','INVESTMENT','OTHER')
    `);

    await q.query(`
      CREATE TABLE wallet (
        id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        group_id        UUID NOT NULL REFERENCES finance_group(id) ON DELETE CASCADE,
        name            TEXT NOT NULL,
        type            wallet_type NOT NULL,
        currency_code   CHAR(3) NOT NULL REFERENCES currency(code),
        initial_balance NUMERIC(20,2) NOT NULL DEFAULT 0,
        archived_at     TIMESTAMPTZ,
        created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
      )
    `);

    await q.query(
      `CREATE INDEX ix_wallet_group_active ON wallet(group_id) WHERE archived_at IS NULL`,
    );
    await q.query(
      `CREATE UNIQUE INDEX uq_wallet_group_name_active ON wallet(group_id, lower(name)) WHERE archived_at IS NULL`,
    );
  }

  public async down(q: QueryRunner): Promise<void> {
    await q.query(`DROP TABLE IF EXISTS wallet`);
    await q.query(`DROP TYPE IF EXISTS wallet_type`);
  }
}
