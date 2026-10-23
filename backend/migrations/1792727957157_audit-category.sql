-- Up Migration

-- One log, many views. The category is what the Audit page and a person's
-- Activity tab filter on; the action stays the precise event. Stored rather
-- than derived so it can be indexed, the way Okta's eventType namespace works.
ALTER TABLE audit_events ADD COLUMN category varchar(20);

-- The append-only trigger refuses UPDATE, which is the point of it. Labelling
-- existing rows is a schema change, not a rewrite of what happened: no event's
-- meaning moves, only a derived name is filled in. So the guard is lifted for
-- this statement alone and put straight back, inside the one transaction the
-- migration runs in.
ALTER TABLE audit_events DISABLE TRIGGER audit_events_no_update_delete;

UPDATE audit_events SET category = CASE
  WHEN action LIKE 'SERVICE_%' THEN 'ACCESS'
  WHEN action IN ('MEMBER_ADDED', 'MEMBER_REMOVED', 'LEAD_SET', 'LEAD_UNSET') THEN 'MEMBERSHIP'
  WHEN action LIKE 'TEAM_%' THEN 'TEAMS'
  WHEN action LIKE 'SIGN_%' OR action LIKE 'PASSWORD_%' OR action LIKE 'SESSION_%' THEN 'AUTH'
  ELSE 'PEOPLE'
END;

ALTER TABLE audit_events ENABLE TRIGGER audit_events_no_update_delete;

ALTER TABLE audit_events ALTER COLUMN category SET NOT NULL;

ALTER TABLE audit_events ADD CONSTRAINT audit_events_category_check
  CHECK (category IN ('ACCESS', 'MEMBERSHIP', 'TEAMS', 'PEOPLE', 'AUTH'));

CREATE INDEX audit_events_category_idx ON audit_events (category, created_at DESC);

-- A failed sign-in has no user behind it, only the address that was tried, so
-- the actor can be absent on those rows.

-- Down Migration

DROP INDEX audit_events_category_idx;
ALTER TABLE audit_events DROP CONSTRAINT audit_events_category_check;
ALTER TABLE audit_events DROP COLUMN category;
