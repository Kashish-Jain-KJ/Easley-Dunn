/**
 * @file ThemeToggle.js
 * @description Sun / moon switch in the top bar. The knob slides to the side
 * of the theme in use and carries its icon; the other icon stays faint in the
 * track to show what a click switches to.
 */

import React, { useState } from "react";
import { Sun, Moon } from "lucide-react";
import { currentTheme, setTheme } from "../utils/theme";

export default function ThemeToggle() {
  const [theme, setThemeState] = useState(currentTheme);
  const dark = theme === "dark";

  function toggle() {
    const next = dark ? "light" : "dark";
    setTheme(next);
    setThemeState(next);
  }

  return (
    <button
      type="button"
      role="switch"
      aria-checked={dark}
      aria-label="Dark mode"
      title={dark ? "Switch to light mode" : "Switch to dark mode"}
      onClick={toggle}
      className="relative w-[60px] h-8 flex-shrink-0 rounded-full border border-slate-200 bg-slate-100 cursor-pointer transition-colors hover:border-slate-300 focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500"
    >
      <Sun aria-hidden="true" className="absolute left-2 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400" />
      <Moon aria-hidden="true" className="absolute right-2 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400" />
      <span
        aria-hidden="true"
        className={`absolute top-[3px] left-[3px] w-6 h-6 rounded-full bg-white border border-slate-200 shadow-sm flex items-center justify-center transition-transform duration-200 ${
          dark ? "translate-x-7" : "translate-x-0"
        }`}
      >
        {dark ? <Moon className="w-3.5 h-3.5 text-slate-900" /> : <Sun className="w-3.5 h-3.5 text-amber-500" />}
      </span>
    </button>
  );
}
