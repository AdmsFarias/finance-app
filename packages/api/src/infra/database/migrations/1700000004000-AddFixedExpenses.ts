import type { MigrationInterface, QueryRunner } from 'typeorm';

export class AddFixedExpenses1700000004000 implements MigrationInterface {
  name = 'AddFixedExpenses1700000004000';

  public async up(q: QueryRunner): Promise<void> {
    await q.query(`CREATE TYPE recurrence_freq AS ENUM ('MONTHLY','WEEKLY','YEARLY','CUSTOM')`);

    await q.query(`
      CREATE TABLE fixed_expense (
        id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        group_id       UUID NOT NULL REFERENCES finance_group(id) ON DELETE CASCADE,
        name           TEXT NOT NULL,
        amount         NUMERIC(20,2) NOT NULL CHECK (amount >= 0),
        currency_code  CHAR(3) NOT NULL REFERENCES currency(code),
        day_of_month   INTEGER NOT NULL CHECK (day_of_month BETWEEN 1 AND 31),
        recurrence     recurrence_freq NOT NULL DEFAULT 'MONTHLY',
        note           TEXT,
        archived_at    TIMESTAMPTZ,
        created_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        updated_at     TIMESTAMPTZ NOT NULL DEFAULT NOW()
      )
    `);

    await q.query(
      `CREATE INDEX ix_fixed_expense_group_active ON fixed_expense(group_id) WHERE archived_at IS NULL`,
    );
    await q.query(
      `CREATE UNIQUE INDEX uq_fixed_expense_group_name_active ON fixed_expense(group_id, lower(name)) WHERE archived_at IS NULL`,
    );

    await q.query(`
      CREATE TABLE fixed_expense_check (
        id                 UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        fixed_expense_id   UUID NOT NULL REFERENCES fixed_expense(id) ON DELETE CASCADE,
        year_month         CHAR(7) NOT NULL CHECK (year_month ~ '^[0-9]{4}-(0[1-9]|1[0-2])$'),
        paid_at            TIMESTAMPTZ NOT NULL,
        paid_amount        NUMERIC(20,2),
        note               TEXT,
        created_by         UUID NOT NULL REFERENCES app_user(id),
        created_at         TIMESTAMPTZ NOT NULL DEFAULT NOW()
      )
    `);

    await q.query(
      `CREATE UNIQUE INDEX uq_fixed_expense_check_expense_month ON fixed_expense_check(fixed_expense_id, year_month)`,
    );
  }

  public async down(q: QueryRunner): Promise<void> {
    await q.query(`DROP TABLE IF EXISTS fixed_expense_check`);
    await q.query(`DROP TABLE IF EXISTS fixed_expense`);
    await q.query(`DROP TYPE IF EXISTS recurrence_freq`);
  }
}
