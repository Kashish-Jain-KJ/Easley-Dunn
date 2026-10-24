-- Up Migration

-- Service grants and revokes move out of the old `log` table and into
-- audit_events, so there is one record of who changed whose access. They need
-- somewhere to say which service, and it is a column rather than a detail key
-- so the audit page can filter on it.
ALTER TABLE audit_events ADD COLUMN service_id bigint REFERENCES services (service_id);

CREATE INDEX audit_events_service_idx ON audit_events (service_id);

-- Down Migration

DROP INDEX audit_events_service_idx;
ALTER TABLE audit_events DROP COLUMN service_id;
