/**
 * @file Sidebar.js
 * @description Left icon rail. One entry per section; the current one is shown
 * with a soft filled pill rather than an accent bar.
 *
 * SECTIONS is the one place that says which sections a role has. The routes in
 * App.js and the landing page both read it, so a section cannot appear in the
 * rail without a route or be reachable without appearing — the drift that
 * happens when each of those keeps its own list.
 *
 * It decides what is *shown*. It is not a permission check: every endpoint
 * behind these screens enforces the role itself.
 */

import React, { memo } from "react";
import { NavLink } from "react-router-dom";
import { Users, Users2, ScrollText, ShieldCheck, KeyRound } from "lucide-react";

export const SECTIONS = [
  // Overview is out of the rail until it has something on it: it was the first
  // admin section, so signing in landed on "not built yet". The route and the
  // page are still there — put the entry back when the screen is real.
  { to: "/people", label: "People", Icon: Users, roles: ["ADMIN"] },
  { to: "/teams", label: "Teams", Icon: Users2, roles: ["ADMIN"] },
  { to: "/audit", label: "Audit log", Icon: ScrollText, roles: ["ADMIN"] },

  // A lead and a student see the same two for now. A lead's own team screen
  // drops in here against ["LEAD"] alone, and Requests joins both once there
  // is something to request.
  { to: "/access", label: "Access", Icon: KeyRound, roles: ["LEAD", "USER"] },
  { to: "/team", label: "Team", Icon: Users2, roles: ["LEAD", "USER"] },
];

/** The sections this role has, in rail order. First one is where they land. */
export function sectionsFor(role) {
  return SECTIONS.filter((section) => section.roles.includes(role));
}

function Sidebar({ sections }) {
  return (
    <nav
      aria-label="Sections"
      className="flex flex-row md:flex-col items-center gap-1 flex-shrink-0 w-full md:w-[76px] px-3 py-2 md:px-0 md:py-3.5 bg-white border-b md:border-b-0 md:border-r border-slate-200 overflow-x-auto scroll-soft"
    >
      <div
        aria-hidden="true"
        className="w-10 h-10 mr-2 md:mr-0 md:mb-3 rounded-[10px] bg-blue-600 text-white flex items-center justify-center flex-shrink-0"
      >
        <ShieldCheck className="w-[22px] h-[22px]" />
      </div>

      {sections.map(({ to, label, Icon }) => (
        <NavLink
          key={to}
          to={to}
          title={label}
          className={({ isActive }) =>
            `w-16 min-h-[56px] flex-shrink-0 flex flex-col items-center justify-center gap-1 rounded-[10px] no-underline transition-colors ${
              isActive
                ? "bg-[#ECEAE4] text-slate-900 font-semibold"
                : "text-slate-600 hover:bg-[#F5F4F1]"
            }`
          }
        >
          <Icon className="w-[22px] h-[22px]" strokeWidth={1.75} />
          <span className="text-[11px] font-medium">{label}</span>
        </NavLink>
      ))}
    </nav>
  );
}

export default memo(Sidebar);
