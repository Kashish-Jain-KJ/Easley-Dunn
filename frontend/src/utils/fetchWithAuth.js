/**
 * @file fetchWithAuth.js
 * @description Helper wrapper for fetch that automatically attaches credentials: 'include'.
 */

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

  return fetch(url, finalOptions);
}
