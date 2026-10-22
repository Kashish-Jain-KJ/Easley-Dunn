/**
 * @file teams.repo.js
 * @description SQL for the teams table.
 */

"use strict";

const { getPool } = require("../db/database");

const TEAM_COLUMNS = "team_id, name, description, is_active, created_by, created_at, updated_at";

async function findById(teamId, db = getPool()) {
  const { rows } = await db.query(`SELECT ${TEAM_COLUMNS} FROM teams WHERE team_id = $1`, [teamId]);
  return rows[0] || null;
}

// Active team with this name, ignoring case. Archived teams don't block a name.
async function findActiveByName(name, db = getPool()) {
  const { rows } = await db.query(
    `SELECT ${TEAM_COLUMNS} FROM teams WHERE lower(name) = lower($1) AND is_active`,
    [name]
  );
  return rows[0] || null;
}

// Every team with its member count and leads, active teams first.
async function listWithSummary(db = getPool()) {
  const { rows } = await db.query(
    `SELECT t.team_id, t.name, t.description, t.is_active, t.created_at,
            count(m.user_id)::int AS member_count,
            coalesce(
              json_agg(json_build_object('userId', u.user_id, 'email', u.email,
                                         'name', btrim(coalesce(u.first_name, '') || ' ' || coalesce(u.last_name, ''))))
                FILTER (WHERE m.is_lead),
              '[]'
            ) AS leads
       FROM teams t
       LEFT JOIN team_members m ON m.team_id = t.team_id
       LEFT JOIN users u ON u.user_id = m.user_id
      GROUP BY t.team_id
      ORDER BY t.is_active DESC, lower(t.name)`
  );
  return rows;
}

async function create({ name, description, createdBy }, db = getPool()) {
  const { rows } = await db.query(
    `INSERT INTO teams (name, description, created_by)
     VALUES ($1, $2, $3)
     RETURNING ${TEAM_COLUMNS}`,
    [name, description, createdBy]
  );
  return rows[0];
}

async function update(teamId, { name, description }, db = getPool()) {
  const { rows } = await db.query(
    `UPDATE teams SET name = $2, description = $3, updated_at = now()
      WHERE team_id = $1
      RETURNING ${TEAM_COLUMNS}`,
    [teamId, name, description]
  );
  return rows[0] || null;
}

async function archive(teamId, db = getPool()) {
  const { rows } = await db.query(
    `UPDATE teams SET is_active = false, updated_at = now()
      WHERE team_id = $1
      RETURNING ${TEAM_COLUMNS}`,
    [teamId]
  );
  return rows[0] || null;
}

module.exports = { findById, findActiveByName, listWithSummary, create, update, archive };
