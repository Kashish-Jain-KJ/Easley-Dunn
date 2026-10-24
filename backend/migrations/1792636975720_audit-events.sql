-- Up Migration

-- Append-only record of every change: who did what, to whom, and whether it worked
-- (DESIGN.md §4.1). Written in the same transaction as the change it records.
-- Replaces the old `log` table once all service code is ported.
CREATE TABLE audit_events (
  event_id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  -- NULL only for system jobs.
  actor_user_id bigint REFERENCES users (user_id),
  action varchar(50) NOT NULL,
  outcome varchar(10) NOT NULL,
  target_user_id bigint REFERENCES users (user_id),
  team_id bigint REFERENCES teams (team_id),
  detail jsonb NOT NULL DEFAULT '{}',
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT audit_events_outcome_check CHECK (outcome IN ('SUCCESS', 'FAILED'))
);

CREATE INDEX audit_events_target_user_idx ON audit_events (target_user_id);
CREATE INDEX audit_events_team_idx ON audit_events (team_id);
CREATE INDEX audit_events_created_at_idx ON audit_events (created_at);

-- Rows can be added, never changed or removed.
CREATE FUNCTION audit_events_append_only() RETURNS trigger
LANGUAGE plpgsql AS $$
BEGIN
  RAISE EXCEPTION 'audit_events is append-only: % is not allowed', TG_OP;
END;
$$;

CREATE TRIGGER audit_events_no_update_delete
  BEFORE UPDATE OR DELETE ON audit_events
  FOR EACH ROW EXECUTE FUNCTION audit_events_append_only();

CREATE TRIGGER audit_events_no_truncate
  BEFORE TRUNCATE ON audit_events
  FOR EACH STATEMENT EXECUTE FUNCTION audit_events_append_only();

-- Down Migration

DROP TABLE audit_events;
DROP FUNCTION audit_events_append_only();
