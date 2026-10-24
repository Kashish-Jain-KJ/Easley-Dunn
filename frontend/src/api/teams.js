/**
 * @file teams.js
 * @description Calls to the /teams endpoints.
 *
 * Every function returns the parsed body and throws an Error carrying the
 * server's own message on failure, so screens can show the exact reason
 * ("Maya Chen already leads 'Web Platform'.") rather than a generic one.
 */

import { fetchWithAuth } from "../utils/fetchWithAuth";

const API_URL = process.env.REACT_APP_API_URL || "http://localhost:5001";

async function call(path, options) {
  const res = await fetchWithAuth(`${API_URL}${path}`, options);

  let body = null;
  try {
    body = await res.json();
  } catch {
    // A body-less response (or HTML from a proxy) still needs a usable error.
  }

  if (!res.ok || !body?.success) {
    throw new Error(body?.message || `Request failed (${res.status}).`);
  }
  return body;
}

export const listTeams = () => call("/teams");

export const getTeam = (teamId) => call(`/teams/${teamId}`);

export const createTeam = ({ name, description }) =>
  call("/teams", { method: "POST", body: JSON.stringify({ name, description }) });

export const updateTeam = (teamId, { name, description }) =>
  call(`/teams/${teamId}`, { method: "PATCH", body: JSON.stringify({ name, description }) });

export const archiveTeam = (teamId) => call(`/teams/${teamId}/archive`, { method: "POST" });

export const addMember = (teamId, userId) =>
  call(`/teams/${teamId}/members`, { method: "POST", body: JSON.stringify({ userId }) });

/** Leads are set here and nowhere else: this is what gives a user the LEAD role. */
export const setLead = (teamId, userId, isLead) =>
  call(`/teams/${teamId}/members/${userId}`, { method: "PATCH", body: JSON.stringify({ isLead }) });

export const removeMember = (teamId, userId) =>
  call(`/teams/${teamId}/members/${userId}`, { method: "DELETE" });

export const listUsers = () => call("/users");
