-- Up Migration

-- Indexes shaped to the two queries that actually read audit_events
-- (auditEvents.repo.js: `list` and `listForUser`). Three changes, each paying
-- for itself on an append-only table where every index also costs on INSERT.
--
-- Why now rather than when it hurts: audit_events is the one table here that
-- grows without bound — every sign-in, every refused attempt and every access
-- change appends a row, while users and teams stay at lab size. Building these
-- is instant today and a locking problem later, and the table is small enough
-- that the planner will still choose a sequential scan for a while either way.
-- That is why this is reasoned from the query shapes, not measured: on the
-- current row count a measurement would show no difference and prove nothing.

-- 1. The actor side of a person's own history.
--
-- `listForUser` filters (actor_user_id = $1 OR target_user_id = $1). Postgres
-- can only serve an OR across two columns by combining an index scan on each
-- (BitmapOr). target_user_id had one and actor_user_id did not, so neither was
-- usable and every person's Activity tab scanned the whole log.
--
-- created_at DESC rides along because both readers order by it and take a
-- page: with it the scan stops at the page size instead of collecting all of
-- that person's rows and sorting them. Same shape as audit_events_category_idx.
CREATE INDEX audit_events_actor_user_idx ON audit_events (actor_user_id, created_at DESC);

-- 2. Widen the target side to match, for the same reason.
DROP INDEX audit_events_target_user_idx;
CREATE INDEX audit_events_target_user_idx ON audit_events (target_user_id, created_at DESC);

-- 3. The keyset cursor.
--
-- Both readers sort by (created_at DESC, event_id DESC) and page with
-- WHERE (created_at, event_id) < ($ts, $id). A row comparison can be an index
-- condition only when an index carries both columns in that order; against the
-- single-column index it was a filter applied after the fact, and the event_id
-- tie-break needed a sort on top.
--
-- The old index is dropped rather than kept: created_at leads the new one, so
-- everything the single-column index served (the `since` filter, the ordering)
-- is still served, and a redundant index on an append-only table is pure write
-- cost on every audited action.
CREATE INDEX audit_events_created_at_event_idx ON audit_events (created_at DESC, event_id DESC);
DROP INDEX audit_events_created_at_idx;

-- 4. The filter dropdown.
--
-- `listActions` runs SELECT DISTINCT action, with no WHERE, once per visit to
-- the Audit page. That reads every row of the log to return about a dozen
-- strings, and it is the one read here whose cost grows with no ceiling.
--
-- This index does not remove the scan — Postgres has no skip scan, so DISTINCT
-- still walks the whole thing — but it lets it walk an index-only scan over one
-- narrow column instead of the full heap, where each row also drags its jsonb
-- detail. Same query, a fraction of the pages. A loose index scan (a recursive
-- CTE) would be the asymptotic fix and is worth revisiting if the log ever gets
-- big enough to notice; it is not worth the complexity at lab scale.
CREATE INDEX audit_events_action_idx ON audit_events (action);

-- team_id and service_id are deliberately left as they are. They are occasional
-- admin filters with no equivalent of `listForUser` behind them, so widening
-- them would add an INSERT cost on every audited action to speed up a query
-- nobody runs in a loop.

-- Down Migration

DROP INDEX audit_events_action_idx;

CREATE INDEX audit_events_created_at_idx ON audit_events (created_at);
DROP INDEX audit_events_created_at_event_idx;

DROP INDEX audit_events_target_user_idx;
CREATE INDEX audit_events_target_user_idx ON audit_events (target_user_id);

DROP INDEX audit_events_actor_user_idx;
