/**
 * @file TeamsSection.js
 * @description Wraps the two ways of looking at the same teams — the list and
 * the map — so one section owns teams rather than two sidebar entries showing
 * the same data.
 *
 * It also owns the section's toolbar: the view tabs on the left and a slot on
 * the right that the view itself fills. The tabs live here and the "New team"
 * button lives with the list that knows how to open the dialog, so the only
 * way to get them onto one line is for the view to render into a node this
 * component owns. The view does that with a portal — see TeamsPage.
 *
 * Before, the tabs sat alone on a full-width row and the list panel below
 * carried its own heading and button, so "Teams" appeared three times down the
 * screen and the row in between was empty.
 */

import React, { useState } from "react";
import { NavLink, Outlet, useLocation } from "react-router-dom";
import { List, Network } from "lucide-react";

const VIEWS = [
  { to: "/teams", label: "List", Icon: List },
  { to: "/teams/map", label: "Map", Icon: Network },
];

export default function TeamsSection() {
  const { pathname } = useLocation();
  const onMap = pathname.startsWith("/teams/map");

  // A callback ref into state, so the view re-renders once the node exists and
  // its portal has somewhere to go.
  const [toolbarNode, setToolbarNode] = useState(null);

  return (
    <div className="flex-1 min-h-0 flex flex-col">
      <div className="flex-shrink-0 flex flex-wrap items-center gap-3 px-6 pt-4">
        <div role="tablist" aria-label="Team views" className="inline-flex gap-1 p-1 bg-slate-200/70 rounded-xl">
          {VIEWS.map(({ to, label, Icon }) => {
            const active = to === "/teams/map" ? onMap : !onMap;
            return (
              <NavLink
                key={to}
                to={to}
                role="tab"
                aria-selected={active}
                className={`flex items-center gap-1.5 min-h-[36px] px-3 rounded-lg text-[13px] font-semibold no-underline transition-colors ${
                  active ? "bg-white text-slate-900 shadow-sm" : "text-slate-600 hover:text-slate-900"
                }`}
              >
                <Icon className="w-4 h-4" />
                {label}
              </NavLink>
            );
          })}
        </div>

        {/* Filled by the current view. Empty on the map, which has no actions. */}
        <div ref={setToolbarNode} className="flex flex-wrap items-center gap-3 ml-auto" />
      </div>

      <Outlet context={{ toolbarNode }} />
    </div>
  );
}
