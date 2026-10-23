/**
 * @file teamMembers.repo.js
 * @description SQL for the team_members table.
 */

"use strict";

const { getPool } = require("../db/database");

async function find(teamId, userId, db = getPool()) {
  const { rows } = await db.query(
    `SELECT team_id, user_id, is_lead, added_by, added_at
       FROM team_members
      WHERE team_id = $1 AND user_id = $2`,
    [teamId, userId]
  );
  return rows[0] || null;
}

// Members of a team with the user details the UI needs, leads first.
async function listByTeam(teamId, db = getPool()) {
  const { rows } = await db.query(
    `SELECT m.user_id, u.email, u.first_name, u.last_name, u."Role" AS role, u.is_active,
            m.is_lead, m.added_by, m.added_at
       FROM team_members m
       JOIN users u ON u.user_id = m.user_id
      WHERE m.team_id = $1
      ORDER BY m.is_lead DESC, lower(u.email)`,
    [teamId]
  );
  return rows;
}

// The team this user leads, if any (a user leads at most one).
async function findLedTeam(userId, db = getPool()) {
  const { rows } = await db.query(
    `SELECT t.team_id, t.name
       FROM team_members m
       JOIN teams t ON t.team_id = m.team_id
      WHERE m.user_id = $1 AND m.is_lead`,
    [userId]
  );
  return rows[0] || null;
}

// The teams a user belongs to, each with its members, for that user's own
// view. Members come back in the same request because the point of the screen
// is "who is on my team and who do I ask", which is one question, not one per
// team. Archived teams are left out: archiving removes everyone anyway, so a
// row here would describe a team the user is no longer in.
async function listByUser(userId, db = getPool()) {
  const { rows } = await db.query(
    `SELECT t.team_id, t.name, t.description,
            mine.is_lead AS viewer_is_lead,
            count(m.user_id) FILTER (WHERE u.is_active)::int AS member_count,
            coalesce(
              json_agg(json_build_object('userId', u.user_id, 'email', u.email,
                                         'name', btrim(coalesce(u.first_name, '') || ' ' || coalesce(u.last_name, '')),
                                         'isLead', m.is_lead)
                       ORDER BY m.is_lead DESC, lower(u.email))
                FILTER (WHERE m.user_id IS NOT NULL AND u.is_active),
              '[]'
            ) AS members
       FROM team_members mine
       JOIN teams t ON t.team_id = mine.team_id
       LEFT JOIN team_members m ON m.team_id = t.team_id
       LEFT JOIN users u ON u.user_id = m.user_id
      WHERE mine.user_id = $1 AND t.is_active
      GROUP BY t.team_id, t.name, t.description, mine.is_lead
      ORDER BY lower(t.name)`,
    [userId]
  );
  return rows;
}

async function add({ teamId, userId, isLead, addedBy }, db = getPool()) {
  const { rows } = await db.query(
    `INSERT INTO team_members (team_id, user_id, is_lead, added_by)
     VALUES ($1, $2, $3, $4)
     RETURNING team_id, user_id, is_lead, added_by, added_at`,
    [teamId, userId, isLead, addedBy]
  );
  return rows[0];
}

async function setLead(teamId, userId, isLead, db = getPool()) {
  const { rows } = await db.query(
    `UPDATE team_members SET is_lead = $3
      WHERE team_id = $1 AND user_id = $2
      RETURNING team_id, user_id, is_lead`,
    [teamId, userId, isLead]
  );
  return rows[0] || null;
}

async function remove(teamId, userId, db = getPool()) {
  const { rows } = await db.query(
    `DELETE FROM team_members WHERE team_id = $1 AND user_id = $2
      RETURNING team_id, user_id, is_lead`,
    [teamId, userId]
  );
  return rows[0] || null;
}

// Used when a team is archived: removes everyone and returns who was removed.
async function removeAllFromTeam(teamId, db = getPool()) {
  const { rows } = await db.query(
    `DELETE FROM team_members WHERE team_id = $1 RETURNING user_id, is_lead`,
    [teamId]
  );
  return rows;
}

// Used when a LEAD loses the role: clears their lead flag and returns the team it was on.
async function clearLeadForUser(userId, db = getPool()) {
  const { rows } = await db.query(
    `UPDATE team_members SET is_lead = false
      WHERE user_id = $1 AND is_lead
      RETURNING team_id`,
    [userId]
  );
  return rows;
}

module.exports = { find, listByTeam, listByUser, findLedTeam, add, setLead, remove, removeAllFromTeam, clearLeadForUser };
