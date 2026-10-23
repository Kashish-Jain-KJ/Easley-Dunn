/**
 * @file AppLayout.js
 * @description The frame every signed-in screen sits in: the section rail on
 * the left, a header naming the current section, and the page itself.
 *
 * It also holds the gates that used to live in App.js — still verifying the
 * session, and not signed in — plus the role-aware pieces: which sections a
 * person has, where they land, and what happens if they ask for a screen that
 * isn't theirs.
 *
 * The rail and the landing page both come from SECTIONS, so a role's screens
 * are declared once.
 */

import React, { useMemo } from "react";
import { Outlet, useLocation, Navigate } from "react-router-dom";
import { RefreshCw, LogOut } from "lucide-react";
import { useAuth } from "../context/AuthContext";
import LoginPage from "./LoginPage";
import ResetPasswordModal from "./ResetPasswordModal";
import Sidebar, { sectionsFor } from "./Sidebar";

const TITLES = {
  "/overview": ["Overview", "What needs attention today"],
  "/people": ["People", "Everyone in the lab, their role and status"],
  "/teams": ["Teams", "Teams, their members and leads"],
  "/audit": ["Audit log", "Who did what, when, and whether it worked"],
  "/access": ["Access", "What you can get into, and who gave it to you"],
  "/team": ["Team", "Your team, and who to ask"],
};

function initials(name, email) {
  const source = (name || email || "").trim();
  if (!source) return "?";
  const parts = source.split(/\s+/);
  return (parts.length > 1 ? parts[0][0] + parts[1][0] : source.slice(0, 2)).toUpperCase();
}

function TopBar({ title, subtitle }) {
  const { user, role, logout } = useAuth();

  return (
    <header className="flex flex-wrap items-center justify-between gap-3 px-6 py-4 bg-white border-b border-slate-200">
      <div>
        <h1 className="m-0 text-xl font-bold text-slate-900">{title}</h1>
        <p className="mt-0.5 text-[13px] text-slate-600">{subtitle}</p>
      </div>

      <div className="flex items-center gap-2.5">
        <div className="flex items-center gap-2.5 min-h-[44px] pl-1 pr-3 py-1 border border-slate-200 rounded-full">
          <span className="w-[34px] h-[34px] rounded-full bg-blue-900 text-white flex items-center justify-center text-xs font-semibold">
            {initials(user?.name, user?.email)}
          </span>
          <span className="flex flex-col items-start leading-tight">
            <span className="text-[13px] font-semibold text-slate-900">{user?.name || user?.email}</span>
            <span className="text-[11px] text-slate-600">{role}</span>
          </span>
        </div>
        <button
          type="button"
          onClick={logout}
          title="Log out of Cerberus"
          aria-label="Log out"
          className="w-11 h-11 flex items-center justify-center border border-slate-200 rounded-[10px] text-slate-600 hover:text-red-600 hover:border-red-200 hover:bg-red-50 transition-all cursor-pointer"
        >
          <LogOut className="w-[18px] h-[18px]" />
        </button>
      </div>
    </header>
  );
}

/**
 * Sends someone to the first section their role has. Used for "/" and for any
 * address that matches nothing, so a stale link lands somewhere real.
 */
export function Landing() {
  const { role } = useAuth();
  const [first] = sectionsFor(role);
  return first ? <Navigate to={first.to} replace /> : null;
}

/**
 * Wraps the admin-only screens. A lead or student who reaches one — a
 * bookmark, or the back button after signing in as someone else — is sent to
 * their own landing page instead of being shown a console they can't use.
 *
 * This is for their benefit, not for safety: every endpoint behind those
 * screens checks the role server-side, so the worst a bypass here would show
 * is an empty page full of failed requests.
 */
export function RequireAdmin() {
  const { role } = useAuth();
  return role === "ADMIN" ? <Outlet /> : <Landing />;
}

export default function AppLayout() {
  const { role, isAuthenticated, requiresPasswordChange, isLoading } = useAuth();
  const { pathname } = useLocation();
  const sections = useMemo(() => sectionsFor(role), [role]);

  if (isLoading) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center">
        <div className="flex flex-col items-center gap-3">
          <RefreshCw className="w-8 h-8 text-blue-600 animate-spin" />
          <p className="text-sm font-medium text-slate-600">Verifying session...</p>
        </div>
      </div>
    );
  }

  if (!isAuthenticated) return <LoginPage />;

  const [title, subtitle] = TITLES[`/${pathname.split("/")[1]}`] || TITLES[sections[0]?.to] || ["Cerberus", ""];

  return (
    // overflow-hidden matters: a wrapped flex line is sized by its content, so
    // without it the whole console scrolls instead of the pane inside it.
    <div className="h-screen overflow-hidden flex flex-wrap bg-slate-100 text-slate-900">
      {sections.length > 0 && <Sidebar sections={sections} />}
      <div className="flex-1 h-full min-w-0 min-h-0 flex flex-col basis-[560px] grow-[999]">
        <TopBar title={title} subtitle={subtitle} />
        {/* A role with no sections at all. Nothing reaches this today, but it
            is what the old "not an admin" screen was, and that screen had no
            way off it: no rail, no header, so no log out button either, and
            reloading landed straight back on it. Keeping the frame means
            whoever lands here can always leave. */}
        {sections.length === 0 ? (
          <main className="flex-1 min-h-0 overflow-y-auto scroll-soft px-6 py-4">
            <div className="bg-white border border-slate-200 rounded-xl px-6 py-12 text-center">
              <h2 className="m-0 text-lg font-semibold text-slate-900">Your portal is not available yet</h2>
              <p className="mt-2 mb-0 text-slate-600">
                Nothing is set up for your role yet. Contact the admin, or log out using the button above.
              </p>
            </div>
          </main>
        ) : (
          <Outlet />
        )}
      </div>
      {requiresPasswordChange && <ResetPasswordModal />}
    </div>
  );
}
