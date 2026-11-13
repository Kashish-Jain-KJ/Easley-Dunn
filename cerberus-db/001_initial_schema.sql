-- Consolidated, idempotent PostgreSQL schema for Cerberus.
-- Schema-agnostic: targets whichever schema is active on search_path (default: public).

BEGIN;

-- ── Core Identity & Services ─────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS users (
  user_id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  email varchar UNIQUE,
  is_active boolean,
  start_date date,
  first_name varchar,
  last_name varchar,
  "Role" varchar NOT NULL DEFAULT 'USER',
  last_login_at timestamptz,
  password_hash varchar,
  requires_password_change boolean DEFAULT false,
  CONSTRAINT users_role_check CHECK ("Role" IN ('ADMIN', 'LEAD', 'USER'))
);

CREATE TABLE IF NOT EXISTS services (
  service_id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  service_name varchar,
  service_code varchar UNIQUE,
  is_active boolean DEFAULT true,
  is_automate boolean
);

CREATE TABLE IF NOT EXISTS user_service_access (
  access_id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  user_id bigint CONSTRAINT fk_user_service_access_user REFERENCES users (user_id),
  service_id bigint CONSTRAINT fk_user_service_access_service REFERENCES services (service_id),
  external_account_identifier varchar,
  external_user_identifier varchar,
  role_name varchar,
  is_active boolean,
  last_synced_at timestamp
);

-- Legacy activity log table (retained for compatibility with existing service queries).
CREATE TABLE IF NOT EXISTS log (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  user_id bigint CONSTRAINT log_user_id_fkey REFERENCES users (user_id),
  service_id bigint CONSTRAINT log_service_id_fkey REFERENCES services (service_id),
  command_type varchar,
  status varchar,
  error_message varchar,
  created_at timestamptz NOT NULL DEFAULT now(),
  performed_by varchar
);

-- One-time hashed invite and password-reset tokens.
CREATE TABLE IF NOT EXISTS cerberus_admin_tokens (
  token_id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  user_id bigint NOT NULL,
  token_hash varchar NOT NULL,
  purpose varchar(20) NOT NULL DEFAULT 'INVITE',
  expires_at timestamptz NOT NULL,
  used_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT cerberus_admin_tokens_user_fkey
    FOREIGN KEY (user_id) REFERENCES users (user_id) ON DELETE CASCADE,
  CONSTRAINT cerberus_admin_tokens_purpose_check
    CHECK (purpose IN ('INVITE', 'PASSWORD_RESET'))
);

CREATE UNIQUE INDEX IF NOT EXISTS cerberus_admin_tokens_hash_key
  ON cerberus_admin_tokens (token_hash);

CREATE INDEX IF NOT EXISTS cerberus_admin_tokens_user_idx
  ON cerberus_admin_tokens (user_id, purpose);

-- ── Sessions ─────────────────────────────────────────────────────────────────

-- Server-side session store for express-session / connect-pg-simple.
CREATE TABLE IF NOT EXISTS session (
  sid varchar PRIMARY KEY,
  sess jsonb NOT NULL,
  expire timestamptz NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_session_expire ON session (expire);
CREATE INDEX IF NOT EXISTS idx_session_user ON session ((sess->>'userId'));

-- ── Teams ────────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS teams (
  team_id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  name varchar(100) NOT NULL,
  description varchar(1000),
  is_active boolean NOT NULL DEFAULT true,
  created_by bigint NOT NULL REFERENCES users (user_id),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT teams_name_not_blank CHECK (btrim(name) <> '')
);

-- Two active teams cannot share a name (case-insensitive); archived teams are excluded.
CREATE UNIQUE INDEX IF NOT EXISTS teams_active_name_key
  ON teams (lower(name)) WHERE is_active;

CREATE TABLE IF NOT EXISTS team_members (
  team_id bigint NOT NULL REFERENCES teams (team_id),
  user_id bigint NOT NULL REFERENCES users (user_id),
  is_lead boolean NOT NULL DEFAULT false,
  added_by bigint NOT NULL REFERENCES users (user_id),
  added_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (team_id, user_id)
);

CREATE INDEX IF NOT EXISTS team_members_user_id_idx
  ON team_members (user_id);

-- A user can lead at most one team.
CREATE UNIQUE INDEX IF NOT EXISTS team_members_one_team_per_lead
  ON team_members (user_id) WHERE is_lead;

-- ── Append-Only Audit Events ─────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS audit_events (
  event_id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  actor_user_id bigint REFERENCES users (user_id),
  action varchar(50) NOT NULL,
  category varchar(20) NOT NULL,
  outcome varchar(10) NOT NULL,
  target_user_id bigint REFERENCES users (user_id),
  team_id bigint REFERENCES teams (team_id),
  service_id bigint REFERENCES services (service_id),
  detail jsonb NOT NULL DEFAULT '{}',
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT audit_events_outcome_check
    CHECK (outcome IN ('SUCCESS', 'FAILED')),
  CONSTRAINT audit_events_category_check
    CHECK (category IN ('ACCESS', 'MEMBERSHIP', 'TEAMS', 'PEOPLE', 'AUTH'))
);

CREATE INDEX IF NOT EXISTS audit_events_actor_user_idx
  ON audit_events (actor_user_id, created_at DESC);

CREATE INDEX IF NOT EXISTS audit_events_target_user_idx
  ON audit_events (target_user_id, created_at DESC);

CREATE INDEX IF NOT EXISTS audit_events_team_idx
  ON audit_events (team_id);

CREATE INDEX IF NOT EXISTS audit_events_service_idx
  ON audit_events (service_id);

CREATE INDEX IF NOT EXISTS audit_events_category_idx
  ON audit_events (category, created_at DESC);

CREATE INDEX IF NOT EXISTS audit_events_created_at_event_idx
  ON audit_events (created_at DESC, event_id DESC);

CREATE INDEX IF NOT EXISTS audit_events_action_idx
  ON audit_events (action);

CREATE OR REPLACE FUNCTION audit_events_append_only() RETURNS trigger
LANGUAGE plpgsql AS $$
BEGIN
  RAISE EXCEPTION 'audit_events is append-only: % is not allowed', TG_OP;
END;
$$;

DROP TRIGGER IF EXISTS audit_events_no_update_delete ON audit_events;
CREATE TRIGGER audit_events_no_update_delete
  BEFORE UPDATE OR DELETE ON audit_events
  FOR EACH ROW EXECUTE FUNCTION audit_events_append_only();

DROP TRIGGER IF EXISTS audit_events_no_truncate ON audit_events;
CREATE TRIGGER audit_events_no_truncate
  BEFORE TRUNCATE ON audit_events
  FOR EACH STATEMENT EXECUTE FUNCTION audit_events_append_only();

COMMIT;

