-- Up Migration

-- Teams and their members (DESIGN.md §4.1). Teams are archived, never deleted.
CREATE TABLE teams (
  team_id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  name varchar(100) NOT NULL,
  description varchar(1000),
  is_active boolean NOT NULL DEFAULT true,
  created_by bigint NOT NULL REFERENCES users (user_id),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT teams_name_not_blank CHECK (btrim(name) <> '')
);

-- Two active teams can't share a name (case-insensitive). Archived teams don't count.
CREATE UNIQUE INDEX teams_active_name_key ON teams (lower(name)) WHERE is_active;

CREATE TABLE team_members (
  team_id bigint NOT NULL REFERENCES teams (team_id),
  user_id bigint NOT NULL REFERENCES users (user_id),
  -- Which team a LEAD leads. Only users with role LEAD may have this set (checked in
  -- teams.service.js; a CHECK constraint can't read the users table).
  is_lead boolean NOT NULL DEFAULT false,
  added_by bigint NOT NULL REFERENCES users (user_id),
  added_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (team_id, user_id)
);

CREATE INDEX team_members_user_id_idx ON team_members (user_id);

-- A user leads at most one team. A team can have several leads, or none.
CREATE UNIQUE INDEX team_members_one_team_per_lead ON team_members (user_id) WHERE is_lead;

-- Down Migration

DROP TABLE team_members;
DROP TABLE teams;
