/**
 * @file user.js
 * @description Calls to the /user endpoints — the signed-in person's own
 * access, teams and history.
 *
 * None of these take a user id: the server reads who is asking from the
 * session. There is nothing here to pass the wrong value to.
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

export const getAccess = () => call("/user/access");

export const getTeams = () => call("/user/team");

/**
 * @param {Object} [options]
 * @param {string} [options.before]    cursor from a previous page
 * @param {string} [options.category]  ACCESS | MEMBERSHIP | TEAMS | PEOPLE | AUTH
 * @param {number} [options.limit]
 */
export const getActivity = ({ before, category, limit } = {}) => {
  const params = new URLSearchParams();
  if (before) params.set("before", before);
  if (category) params.set("category", category);
  if (limit) params.set("limit", String(limit));
  const query = params.toString();
  return call(`/user/activity${query ? `?${query}` : ""}`);
};
