/**
 * @file fetchWithAuth.js
 * @description fetch wrapper that sends the session cookie and reacts to an
 * expired or revoked session.
 *
 * Every data call in the app goes through here, which makes it the one place
 * that needs to notice a 401. On one, it raises a window event that
 * AuthContext listens for and clears the session state — otherwise React keeps
 * rendering a dashboard full of stale data that the server is already
 * rejecting.
 *
 * Only 401 (not authenticated) triggers this. A 403 means the session is valid
 * but the action isn't allowed — for example a forced password change still
 * outstanding — and must not sign the user out.
 */

export const UNAUTHENTICATED_EVENT = "cerberus:unauthenticated";

export async function fetchWithAuth(url, options = {}) {
  const defaultOptions = {
    credentials: "include",
    headers: {
      "Content-Type": "application/json",
      ...options.headers,
    },
  };

  const finalOptions = {
    ...options,
    ...defaultOptions,
    headers: {
      ...defaultOptions.headers,
      ...options.headers,
    },
  };

  const response = await fetch(url, finalOptions);

  if (response.status === 401) {
    window.dispatchEvent(new CustomEvent(UNAUTHENTICATED_EVENT));
  }

  return response;
}
