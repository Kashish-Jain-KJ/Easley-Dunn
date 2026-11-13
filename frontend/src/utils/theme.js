/**
 * @file theme.js
 * @description Light / dark theme. The theme is the `dark` class on <html>;
 * public/theme-init.js sets it before the first paint, and this module reads
 * and changes it afterwards.
 *
 * KEEP IN SYNC with public/theme-init.js (storage key and values).
 */

const STORAGE_KEY = "cerberus-theme";

export function currentTheme() {
  return document.documentElement.classList.contains("dark") ? "dark" : "light";
}

/** Applies the theme and remembers it for this browser. */
export function setTheme(theme) {
  document.documentElement.classList.toggle("dark", theme === "dark");
  try {
    window.localStorage.setItem(STORAGE_KEY, theme);
  } catch {
    // Storage blocked: the choice still holds until the page is reloaded.
  }
}
