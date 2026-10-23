/**
 * @file Select.js
 * @description A dropdown that looks like the rest of the console rather than
 * the operating system's own control.
 *
 * A native <select> is kept underneath — it stays keyboard and screen-reader
 * friendly, and behaves correctly on a phone — but its platform styling is
 * switched off and the chevron is drawn inside the field, with room reserved
 * for it so the text never runs underneath.
 */

import React from "react";
import { ChevronDown } from "lucide-react";

export default function Select({ label, value, onChange, children, className = "" }) {
  return (
    <span className={`relative inline-flex items-center ${className}`}>
      <select
        aria-label={label}
        value={value}
        onChange={onChange}
        className="appearance-none w-full h-8 pl-2.5 pr-8 bg-white border border-slate-300 rounded-md text-[13px] font-medium text-slate-700 cursor-pointer hover:border-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
      >
        {children}
      </select>
      <ChevronDown aria-hidden="true" className="w-3.5 h-3.5 text-slate-500 absolute right-2 pointer-events-none" />
    </span>
  );
}
