-- 001_create_session_table.sql
-- Server-side session store for express-session / connect-pg-simple.
--
-- Applied manually (no migration tooling in this repo yet).
-- Schema-agnostic: set the target schema first (the value of DB_SCHEMA), e.g.
--   SET search_path TO refactor;

CREATE TABLE IF NOT EXISTS session (
  sid    varchar PRIMARY KEY,
  sess   jsonb NOT NULL,
  expire timestamptz(6) NOT NULL
);

-- connect-pg-simple prunes expired rows on an interval; this makes that cheap.
CREATE INDEX IF NOT EXISTS idx_session_expire ON session (expire);

-- Not part of connect-pg-simple's stock schema. Added so that revoking every
-- session for a user (on role revoke, deactivation, or password change) is an
-- index lookup rather than a full scan.
CREATE INDEX IF NOT EXISTS idx_session_user ON session ((sess->>'userId'));
