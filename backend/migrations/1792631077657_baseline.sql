-- Up Migration

-- Baseline: the tables as they existed in the refactor schema on 2026-10-21
-- (copied from easleydunn, then roles converted to ADMIN/LEAD/USER).
-- The refactor schema already has these, so there this migration is only
-- marked as run (--fake). It exists so the schema can be rebuilt from scratch.

CREATE TABLE users (
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

CREATE TABLE services (
  service_id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  service_name varchar,
  service_code varchar UNIQUE,
  is_active boolean DEFAULT true,
  is_automate boolean
);

CREATE TABLE user_service_access (
  access_id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  user_id bigint CONSTRAINT fk_user_service_access_user REFERENCES users (user_id),
  service_id bigint CONSTRAINT fk_user_service_access_service REFERENCES services (service_id),
  external_account_identifier varchar,
  external_user_identifier varchar,
  role_name varchar,
  is_active boolean,
  last_synced_at timestamp
);

CREATE TABLE log (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  user_id bigint CONSTRAINT log_user_id_fkey REFERENCES users (user_id),
  service_id bigint CONSTRAINT log_service_id_fkey REFERENCES services (service_id),
  command_type varchar,
  status varchar,
  error_message varchar,
  created_at timestamptz NOT NULL DEFAULT now(),
  performed_by varchar
);

CREATE TABLE cerberus_admin_tokens (
  token_id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  user_id bigint,
  token_hash varchar NOT NULL,
  expires_at timestamptz NOT NULL,
  used_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- Session store for express-session / connect-pg-simple.
CREATE TABLE session (
  sid varchar PRIMARY KEY,
  sess jsonb NOT NULL,
  expire timestamptz NOT NULL
);
CREATE INDEX idx_session_expire ON session (expire);
CREATE INDEX idx_session_user ON session ((sess->>'userId'));

-- Down Migration

DROP TABLE session;
DROP TABLE cerberus_admin_tokens;
DROP TABLE log;
DROP TABLE user_service_access;
DROP TABLE services;
DROP TABLE users;
