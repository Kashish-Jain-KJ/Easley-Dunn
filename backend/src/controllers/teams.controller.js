/**
 * @file teams.controller.js
 * @description HTTP layer for teams and team members. Business rules live in
 * services/teams.service.js.
 */

"use strict";

const ApiError = require("../utils/ApiError");
const teamsService = require("../services/teams.service");

function positiveInt(value, name) {
  const n = Number(value);
  if (!Number.isInteger(n) || n <= 0) {
    throw ApiError.badRequest(`${name} must be a positive integer.`);
  }
  return n;
}

function optionalBoolean(value, name) {
  if (value === undefined) return undefined;
  if (typeof value !== "boolean") {
    throw ApiError.badRequest(`${name} must be true or false.`);
  }
  return value;
}

/** GET /teams */
async function listTeams(req, res) {
  const teams = await teamsService.listTeams();
  res.json({ success: true, count: teams.length, data: teams });
}

/** GET /teams/:teamId */
async function getTeam(req, res) {
  const team = await teamsService.getTeam(positiveInt(req.params.teamId, "teamId"));
  res.json({ success: true, data: team });
}

/** POST /teams  Body: { name, description? } */
async function createTeam(req, res) {
  const { name, description } = req.body || {};
  const team = await teamsService.createTeam({ name, description }, req.user.userId);
  res.status(201).json({ success: true, message: `Team '${team.name}' created.`, data: team });
}

/** PATCH /teams/:teamId  Body: { name?, description? } */
async function updateTeam(req, res) {
  const { name, description } = req.body || {};
  const team = await teamsService.updateTeam(positiveInt(req.params.teamId, "teamId"), { name, description }, req.user.userId);
  res.json({ success: true, message: `Team '${team.name}' updated.`, data: team });
}

/** POST /teams/:teamId/archive */
async function archiveTeam(req, res) {
  const team = await teamsService.archiveTeam(positiveInt(req.params.teamId, "teamId"), req.user.userId);
  res.json({
    success: true,
    message: `Team '${team.name}' archived; ${team.membersRemoved} member(s) removed.`,
    data: team,
  });
}

/** POST /teams/:teamId/members  Body: { userId, isLead? } */
async function addMember(req, res) {
  const teamId = positiveInt(req.params.teamId, "teamId");
  const userId = positiveInt((req.body || {}).userId, "userId");
  const isLead = optionalBoolean((req.body || {}).isLead, "isLead") || false;
  const member = await teamsService.addMember(teamId, { userId, isLead }, req.user.userId);
  res.status(201).json({ success: true, message: "Member added.", data: member });
}

/** PATCH /teams/:teamId/members/:userId  Body: { isLead } */
async function setLead(req, res) {
  const teamId = positiveInt(req.params.teamId, "teamId");
  const userId = positiveInt(req.params.userId, "userId");
  const isLead = optionalBoolean((req.body || {}).isLead, "isLead");
  if (isLead === undefined) {
    throw ApiError.badRequest("isLead (true or false) is required.");
  }
  const member = await teamsService.setLead(teamId, userId, isLead, req.user.userId);
  res.json({ success: true, message: isLead ? "Lead set." : "Lead removed.", data: member });
}

/** DELETE /teams/:teamId/members/:userId */
async function removeMember(req, res) {
  const teamId = positiveInt(req.params.teamId, "teamId");
  const userId = positiveInt(req.params.userId, "userId");
  await teamsService.removeMember(teamId, userId, req.user.userId);
  res.json({ success: true, message: "Member removed." });
}

module.exports = { listTeams, getTeam, createTeam, updateTeam, archiveTeam, addMember, setLead, removeMember };
