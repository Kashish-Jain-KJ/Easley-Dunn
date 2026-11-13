/*
 * Puts the saved theme on <html> before the page paints, so a dark-mode user
 * never sees a white flash while React loads. Loaded as a file rather than an
 * inline script so it keeps working under a `script-src 'self'` policy.
 *
 * No saved choice means follow the operating system. KEEP IN SYNC with
 * src/utils/theme.js (storage key and values).
 */
(function () {
  var theme = null;
  try {
    theme = window.localStorage.getItem("cerberus-theme");
  } catch (e) {
    // Storage blocked (private window, site data off): fall through to the OS.
  }
  if (theme !== "dark" && theme !== "light") {
    theme = window.matchMedia && window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
  }
  if (theme === "dark") document.documentElement.classList.add("dark");
})();
