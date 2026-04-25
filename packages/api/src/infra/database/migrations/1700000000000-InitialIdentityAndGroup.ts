import type { MigrationInterface, QueryRunner } from 'typeorm';

export class InitialIdentityAndGroup1700000000000 implements MigrationInterface {
  name = 'InitialIdentityAndGroup1700000000000';

  public async up(q: QueryRunner): Promise<void> {
    await q.query(`CREATE EXTENSION IF NOT EXISTS "pgcrypto"`);
    await q.query(`CREATE EXTENSION IF NOT EXISTS "citext"`);

    await q.query(`
      CREATE TYPE group_member_role AS ENUM ('OWNER','ADMIN','MEMBER','VIEWER')
    `);

    await q.query(`
      CREATE TABLE app_user (
        id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        email             CITEXT NOT NULL UNIQUE,
        password_hash     TEXT NOT NULL,
        display_name      TEXT NOT NULL,
        locale            TEXT NOT NULL DEFAULT 'pt-BR',
        timezone          TEXT NOT NULL DEFAULT 'America/Sao_Paulo',
        base_currency     CHAR(3) NOT NULL DEFAULT 'BRL',
        email_verified_at TIMESTAMPTZ,
        created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        updated_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        deleted_at        TIMESTAMPTZ
      )
    `);

    await q.query(`
      CREATE TABLE auth_refresh_token (
        id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        user_id     UUID NOT NULL REFERENCES app_user(id) ON DELETE CASCADE,
        family_id   UUID NOT NULL,
        token_hash  TEXT NOT NULL,
        expires_at  TIMESTAMPTZ NOT NULL,
        revoked_at  TIMESTAMPTZ,
        ip          INET,
        user_agent  TEXT,
        created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
      )
    `);
    await q.query(
      `CREATE INDEX ix_refresh_user_active ON auth_refresh_token(user_id) WHERE revoked_at IS NULL`,
    );
    await q.query(`CREATE INDEX ix_refresh_family ON auth_refresh_token(family_id)`);

    await q.query(`
      CREATE TABLE auth_password_reset (
        id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        user_id     UUID NOT NULL REFERENCES app_user(id) ON DELETE CASCADE,
        token_hash  TEXT NOT NULL,
        expires_at  TIMESTAMPTZ NOT NULL,
        used_at     TIMESTAMPTZ,
        created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
      )
    `);

    await q.query(`
      CREATE TABLE finance_group (
        id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        name          TEXT NOT NULL,
        base_currency CHAR(3) NOT NULL,
        created_by    UUID NOT NULL REFERENCES app_user(id),
        created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        updated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        archived_at   TIMESTAMPTZ
      )
    `);

    await q.query(`
      CREATE TABLE group_member (
        group_id  UUID NOT NULL REFERENCES finance_group(id) ON DELETE CASCADE,
        user_id   UUID NOT NULL REFERENCES app_user(id) ON DELETE CASCADE,
        role      group_member_role NOT NULL,
        joined_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        PRIMARY KEY (group_id, user_id)
      )
    `);
    await q.query(`CREATE INDEX ix_member_user ON group_member(user_id)`);

    await q.query(`
      CREATE OR REPLACE FUNCTION check_group_has_owner() RETURNS TRIGGER AS $$
      BEGIN
        IF NOT EXISTS (
          SELECT 1 FROM group_member
          WHERE group_id = COALESCE(OLD.group_id, NEW.group_id) AND role = 'OWNER'
        ) THEN
          RAISE EXCEPTION 'group_must_have_owner';
        END IF;
        RETURN NULL;
      END;
      $$ LANGUAGE plpgsql;
    `);
    await q.query(`
      CREATE CONSTRAINT TRIGGER trg_group_owner
        AFTER UPDATE OR DELETE ON group_member
        DEFERRABLE INITIALLY DEFERRED
        FOR EACH ROW EXECUTE FUNCTION check_group_has_owner();
    `);

    await q.query(`
      CREATE TABLE group_invite (
        id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        group_id    UUID NOT NULL REFERENCES finance_group(id) ON DELETE CASCADE,
        email       CITEXT NOT NULL,
        role        group_member_role NOT NULL DEFAULT 'MEMBER',
        token_hash  TEXT NOT NULL,
        expires_at  TIMESTAMPTZ NOT NULL,
        accepted_at TIMESTAMPTZ,
        invited_by  UUID NOT NULL REFERENCES app_user(id),
        created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
      )
    `);
    await q.query(
      `CREATE UNIQUE INDEX uq_invite_pending ON group_invite(group_id, email) WHERE accepted_at IS NULL`,
    );

    await q.query(`
      CREATE TABLE currency (
        code           CHAR(3) PRIMARY KEY,
        name           TEXT NOT NULL,
        symbol         TEXT NOT NULL,
        decimal_places SMALLINT NOT NULL CHECK (decimal_places BETWEEN 0 AND 4),
        is_active      BOOLEAN NOT NULL DEFAULT TRUE
      )
    `);

    await q.query(`
      CREATE TABLE audit_log (
        id            BIGSERIAL PRIMARY KEY,
        occurred_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        actor_user_id UUID REFERENCES app_user(id) ON DELETE SET NULL,
        group_id      UUID REFERENCES finance_group(id) ON DELETE SET NULL,
        action        TEXT NOT NULL,
        entity_type   TEXT,
        entity_id     UUID,
        before        JSONB,
        after         JSONB,
        ip            INET,
        user_agent    TEXT
      )
    `);
    await q.query(`CREATE INDEX ix_audit_actor  ON audit_log(actor_user_id, occurred_at DESC)`);
    await q.query(`CREATE INDEX ix_audit_group  ON audit_log(group_id, occurred_at DESC)`);
    await q.query(`CREATE INDEX ix_audit_entity ON audit_log(entity_type, entity_id)`);
  }

  public async down(q: QueryRunner): Promise<void> {
    await q.query(`DROP TABLE IF EXISTS audit_log`);
    await q.query(`DROP TABLE IF EXISTS currency`);
    await q.query(`DROP TABLE IF EXISTS group_invite`);
    await q.query(`DROP TRIGGER IF EXISTS trg_group_owner ON group_member`);
    await q.query(`DROP FUNCTION IF EXISTS check_group_has_owner()`);
    await q.query(`DROP TABLE IF EXISTS group_member`);
    await q.query(`DROP TABLE IF EXISTS finance_group`);
    await q.query(`DROP TABLE IF EXISTS auth_password_reset`);
    await q.query(`DROP TABLE IF EXISTS auth_refresh_token`);
    await q.query(`DROP TABLE IF EXISTS app_user`);
    await q.query(`DROP TYPE IF EXISTS group_member_role`);
  }
}
