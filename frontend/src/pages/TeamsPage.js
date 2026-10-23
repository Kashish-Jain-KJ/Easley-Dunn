/**
 * @file TeamsPage.js
 * @description Teams and their members. Admin only (the routes behind /teams
 * are gated on the server).
 *
 * Leads are set here and nowhere else: making a member a lead is what gives a
 * user the LEAD role. Server messages are shown as they are, because they name
 * the exact rule that stopped an action.
 */

import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { useNavigate, useOutletContext, useParams } from "react-router-dom";
import { Plus, Search, RefreshCw, MoreHorizontal, TriangleAlert, Star, ChevronRight } from "lucide-react";
import Toasts, { useToasts } from "../components/Toasts";
import ResizableSplit, { useResizableList } from "../components/ResizableSplit";
import * as teamsApi from "../api/teams";

const AVATAR_COLORS = [
  "#1E40AF", "#9A3412", "#065F46", "#6D28D9", "#9D174D", "#155E75", "#3F6212", "#7C2D12", "#374151",
];

function initials(name) {
  const parts = (name || "").trim().split(/\s+/).filter(Boolean);
  if (!parts.length) return "?";
  return (parts.length > 1 ? parts[0][0] + parts[1][0] : parts[0].slice(0, 2)).toUpperCase();
}

function avatarColor(id) {
  return AVATAR_COLORS[Math.abs(Number(id) || 0) % AVATAR_COLORS.length];
}

function fullName(person) {
  const name = `${person.first_name || ""} ${person.last_name || ""}`.trim();
  return name || person.name || person.email;
}

function Avatar({ id, name, size = 36 }) {
  return (
    <span
      aria-hidden="true"
      style={{ width: size, height: size, background: avatarColor(id) }}
      className="flex-shrink-0 rounded-full text-white flex items-center justify-center text-xs font-semibold"
    >
      {initials(name)}
    </span>
  );
}

function LeadBadge() {
  return (
    <span className="inline-flex items-center gap-1 px-2.5 py-[3px] rounded-full bg-blue-100 text-blue-800 text-[11px] font-bold tracking-wide">
      <Star className="w-3 h-3 fill-amber-400 text-amber-700" />
      LEAD
    </span>
  );
}

export default function TeamsPage() {
  const { teamId } = useParams();
  const navigate = useNavigate();

  const [teams, setTeams] = useState([]);
  const [team, setTeam] = useState(null);
  const [people, setPeople] = useState([]);
  const [query, setQuery] = useState("");
  const [isLoading, setIsLoading] = useState(true);
  const [isTeamLoading, setIsTeamLoading] = useState(false);
  const [menuFor, setMenuFor] = useState(null);
  const [dialog, setDialog] = useState(null); // { kind, ... }
  const [draft, setDraft] = useState({ name: "", description: "" });
  const [editing, setEditing] = useState(false);
  const [busy, setBusy] = useState(false);
  const [showArchived, setShowArchived] = useState(false);
  const [personQuery, setPersonQuery] = useState("");

  const { toasts, push, dismiss } = useToasts();
  const say = push;

  const loadTeams = useCallback(async () => {
    try {
      const { data } = await teamsApi.listTeams();
      setTeams(data);
      return data;
    } catch (err) {
      say("error", err.message);
      return [];
    } finally {
      setIsLoading(false);
    }
  }, [say]);

  // The list is the index; the detail is fetched per team so members stay fresh.
  const loadTeam = useCallback(async (id) => {
    setIsTeamLoading(true);
    try {
      const { data } = await teamsApi.getTeam(id);
      setTeam(data);
    } catch (err) {
      say("error", err.message);
      setTeam(null);
    } finally {
      setIsTeamLoading(false);
    }
  }, [say]);

  useEffect(() => {
    loadTeams().then((list) => {
      // Land on the first active team so the page is never empty on arrival.
      if (!teamId && list.length) {
        const first = list.find((t) => t.is_active) || list[0];
        navigate(`/teams/${first.team_id}`, { replace: true });
      }
    });
  }, [loadTeams, navigate, teamId]);

  useEffect(() => {
    if (teamId) {
      setMenuFor(null);
      setEditing(false);
      loadTeam(teamId);
    }
  }, [teamId, loadTeam]);

  // Any click outside a row menu closes it.
  useEffect(() => {
    if (menuFor === null) return undefined;
    const close = () => setMenuFor(null);
    const id = window.setTimeout(() => window.addEventListener("click", close, { once: true }), 0);
    return () => {
      window.clearTimeout(id);
      window.removeEventListener("click", close);
    };
  }, [menuFor]);

  const refresh = useCallback(async () => {
    await Promise.all([loadTeams(), teamId ? loadTeam(teamId) : Promise.resolve()]);
  }, [loadTeams, loadTeam, teamId]);

  /** Runs one API call, reports its own error, and refreshes on success. */
  const run = useCallback(async (fn, successText) => {
    setBusy(true);
    try {
      await fn();
      await refresh();
      if (successText) say("success", successText);
      return true;
    } catch (err) {
      say("error", err.message);
      return false;
    } finally {
      setBusy(false);
    }
  }, [refresh, say]);

  const openAddMember = useCallback(async () => {
    setPersonQuery("");
    setDialog({ kind: "add" });
    try {
      const { data } = await teamsApi.listUsers();
      setPeople(data || []);
    } catch (err) {
      say("error", err.message);
    }
  }, [say]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return teams.filter((t) => !q || t.name.toLowerCase().includes(q));
  }, [teams, query]);

  const members = useMemo(() => team?.members || [], [team]);
  const activeTeams = filtered.filter((t) => t.is_active);
  const archivedTeams = filtered.filter((t) => !t.is_active);

  // The group opens itself the first time you land on an archived team, so the
  // selected one is visible — and after that the toggle wins.
  //
  // It used to be `showArchived || <the selection is archived>`, which made the
  // button dead for as long as an archived team was selected: the click flipped
  // showArchived, the selection held the group open regardless, and nothing
  // happened on screen. Opening once through state, rather than deriving it on
  // every render, is what lets it be closed again.
  //
  // Checked against `teams` rather than the filtered list: a search that hides
  // the selected team shouldn't change whether the group opened for it.
  // The section's toolbar row lives in TeamsSection; the actions below belong
  // to this view, so they are rendered into it rather than duplicated.
  const { toolbarNode } = useOutletContext() || {};
  const { width: listWidth, isWide, setWidth: setListWidth, containerRef } = useResizableList(
    "cerberus.teams.listWidth"
  );

  // Counted off the unfiltered list: a search narrows what you see, not how
  // many teams there are.
  const totalActive = teams.filter((t) => t.is_active).length;
  const totalArchived = teams.length - totalActive;

  const autoOpenedFor = useRef(null);
  useEffect(() => {
    if (!teamId || autoOpenedFor.current === String(teamId)) return;
    if (teams.some((t) => !t.is_active && String(t.team_id) === String(teamId))) {
      autoOpenedFor.current = String(teamId);
      setShowArchived(true);
    }
  }, [teamId, teams]);

  const isActive = !!team?.is_active;

  // Who could join: not already here, active, not an admin. Each one carries the
  // teams they are already in, which is more use than their email address.
  const candidates = useMemo(() => {
    const taken = new Set(members.map((m) => String(m.user_id)));
    const q = personQuery.trim().toLowerCase();
    return people
      .filter((p) => !taken.has(String(p.user_id)) && p.is_active !== false && String(p.Role).toUpperCase() !== "ADMIN")
      .map((p) => ({
        ...p,
        teamNames: teams
          .filter((t) => t.is_active && (t.members || []).some((m) => String(m.user_id) === String(p.user_id)))
          .map((t) => t.name)
          .join(", "),
      }))
      .filter((p) => !q || fullName(p).toLowerCase().includes(q));
  }, [people, members, teams, personQuery]);

  return (
    // Wide enough for both panes: nothing scrolls but the panes themselves, so
    // the list's footer — the Archived group — is always on screen. Narrower,
    // where the two stack, the whole thing scrolls as one page instead.
    <main className="flex-1 min-h-0 overflow-y-auto lg:overflow-hidden scroll-soft px-6 py-4">
      {toolbarNode &&
        createPortal(
          <>
            <span className="text-[13px] text-slate-600">
              {totalActive} {totalActive === 1 ? "team" : "teams"}
              {totalArchived > 0 && ` · ${totalArchived} archived`}
            </span>
            <button
              type="button"
              onClick={() => { setDraft({ name: "", description: "" }); setDialog({ kind: "new" }); }}
              className="flex items-center gap-1.5 min-h-[36px] px-3 rounded-lg bg-blue-600 hover:bg-blue-700 text-white text-[13px] font-semibold cursor-pointer"
            >
              <Plus className="w-4 h-4" /> New team
            </button>
          </>,
          toolbarNode
        )}

      <div
        ref={containerRef}
        className="flex flex-wrap lg:flex-nowrap items-start lg:items-stretch gap-5 lg:h-full"
      >
        {/* Team list */}
        <section
          aria-label="Team list"
          // Width is the drag handle's business on a wide screen; below that the
          // panes stack and the basis class takes over again.
          style={isWide ? { flex: `0 0 ${listWidth}px` } : undefined}
          // lg: the height comes from the flex row, so it can't disagree with
          // the chrome above it. The old max-h subtracted a fixed 7.5rem, which
          // stopped being right the day the List / Map tabs were added above
          // this page — the panel ran past the fold and its footer went with it.
          className="flex-1 basis-[280px] min-w-0 sticky top-0 lg:static max-h-[calc(100vh-11rem)] lg:max-h-none lg:h-full bg-white border border-slate-200 rounded-xl p-4 flex flex-col gap-3 overflow-hidden"
        >
          {/* No heading here: the TopBar and the toolbar row above both already
              say Teams, and the panel is more useful with the height back. */}
          <label className="relative block">
            <span className="sr-only">Search teams</span>
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-3" />
            <input
              type="search"
              placeholder="Search teams"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              className="w-full min-h-[40px] pl-9 pr-3 bg-slate-50 border border-slate-300 rounded-lg text-sm focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </label>

          {isLoading ? (
            <p className="py-6 text-center text-sm text-slate-500">Loading teams…</p>
          ) : (
            <div className="flex-1 min-h-0 overflow-y-auto scroll-soft -mr-1 pr-1">
              <div className="flex flex-col gap-0.5">
                {activeTeams.map((t) => {
                  const selected = String(t.team_id) === String(teamId);
                  return (
                    <button
                      key={t.team_id}
                      type="button"
                      onClick={() => navigate(`/teams/${t.team_id}`)}
                      aria-current={selected}
                      className={`flex items-center justify-between gap-2 w-full min-h-[44px] px-2.5 rounded-lg text-left cursor-pointer ${
                        selected ? "bg-blue-50 border border-blue-200" : "border border-transparent hover:bg-slate-50"
                      }`}
                    >
                      <span className="font-semibold truncate">{t.name}</span>
                      <span className="flex items-center gap-2 flex-shrink-0">
                        {t.member_count > 0 && !t.leads?.length && (
                          <span className="flex items-center gap-1 px-2 py-0.5 rounded-full bg-amber-100 text-amber-800 text-[11px] font-semibold">
                            <TriangleAlert className="w-3 h-3" /> No lead
                          </span>
                        )}
                        <span className="text-xs text-slate-600">
                          {t.member_count} {t.member_count === 1 ? "member" : "members"}
                        </span>
                      </span>
                    </button>
                  );
                })}
                {!activeTeams.length && (
                  <p className="my-2 mx-1 text-[13px] text-slate-600">
                    {query ? `No team matches “${query}”.` : "No teams yet."}
                  </p>
                )}
              </div>

            </div>
          )}

          {archivedTeams.length > 0 && (
            <div className="flex-shrink-0 border-t border-slate-200 pt-2">
              <button
                type="button"
                onClick={() => setShowArchived((v) => !v)}
                aria-expanded={showArchived}
                className="flex items-center gap-1.5 w-full min-h-[36px] px-1.5 rounded-lg text-left text-[11px] font-semibold uppercase tracking-wider text-slate-600 hover:bg-slate-50 cursor-pointer"
              >
                <ChevronRight className={`w-3.5 h-3.5 transition-transform ${showArchived ? "rotate-90" : ""}`} />
                Archived
                <span className="font-medium normal-case tracking-normal">({archivedTeams.length})</span>
              </button>

              {showArchived && (
                <div className="mt-1 max-h-[180px] overflow-y-auto scroll-soft flex flex-col gap-0.5">
                  {archivedTeams.map((t) => {
                    const selected = String(t.team_id) === String(teamId);
                    return (
                      <button
                        key={t.team_id}
                        type="button"
                        onClick={() => navigate(`/teams/${t.team_id}`)}
                        aria-current={selected}
                        className={`flex items-center justify-between gap-2 w-full min-h-[44px] px-2.5 rounded-lg text-left cursor-pointer ${
                          selected ? "bg-blue-50 border border-blue-200" : "border border-transparent hover:bg-slate-50"
                        }`}
                      >
                        <span className="text-slate-600 truncate">{t.name}</span>
                        <span className="text-xs text-slate-600 flex-shrink-0">Archived</span>
                      </button>
                    );
                  })}
                </div>
              )}
            </div>
          )}
        </section>

        {/* Team detail */}
        <ResizableSplit
          containerRef={containerRef}
          width={listWidth}
          setWidth={setListWidth}
          label="Resize the team list"
        />

        {/* Scrolls on its own, so a long team doesn't drag the list out of view. */}
        <section
          aria-label="Team detail"
          className="flex-[999] basis-[520px] min-w-0 flex flex-col gap-4 lg:h-full lg:overflow-y-auto lg:scroll-soft lg:pr-1"
        >
          {!team ? (
            <div className="bg-white border border-slate-200 rounded-xl p-12 text-center text-slate-600">
              {isTeamLoading ? "Loading team…" : "Select a team."}
            </div>
          ) : (
            <>
              <div className="bg-white border border-slate-200 rounded-xl p-5">
                {editing ? (
                  <form
                    className="flex flex-col gap-3"
                    onSubmit={async (e) => {
                      e.preventDefault();
                      const ok = await run(
                        () => teamsApi.updateTeam(team.team_id, draft),
                        `Team '${draft.name.trim()}' updated.`
                      );
                      if (ok) setEditing(false);
                    }}
                  >
                    <label className="flex flex-col gap-1 text-[13px] font-semibold">
                      Team name
                      <input
                        type="text"
                        value={draft.name}
                        onChange={(e) => setDraft((d) => ({ ...d, name: e.target.value }))}
                        className="min-h-[40px] px-3 border border-slate-300 rounded-lg font-normal text-sm"
                      />
                    </label>
                    <label className="flex flex-col gap-1 text-[13px] font-semibold">
                      Description
                      <textarea
                        rows={2}
                        value={draft.description}
                        onChange={(e) => setDraft((d) => ({ ...d, description: e.target.value }))}
                        className="px-3 py-2 border border-slate-300 rounded-lg font-normal text-sm resize-y"
                      />
                    </label>
                    <div className="flex justify-end gap-2">
                      <button type="button" onClick={() => setEditing(false)} className="min-h-[40px] px-3.5 border border-slate-300 rounded-lg bg-white cursor-pointer">
                        Cancel
                      </button>
                      <button type="submit" disabled={busy} className="min-h-[40px] px-4 rounded-lg bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white font-semibold cursor-pointer">
                        Save
                      </button>
                    </div>
                  </form>
                ) : (
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div className="min-w-0">
                      <div className="flex items-center gap-2.5 flex-wrap">
                        <h2 className="m-0 text-[22px] font-bold">{team.name}</h2>
                        {!isActive && (
                          <span className="px-2.5 py-0.5 rounded-full bg-slate-200 text-slate-700 text-xs font-semibold">
                            Archived · read only
                          </span>
                        )}
                      </div>
                      <p className="mt-1.5 mb-0 text-slate-700">{team.description || "No description."}</p>
                    </div>
                    {isActive && (
                      <div className="flex gap-2">
                        <button
                          type="button"
                          onClick={() => { setDraft({ name: team.name, description: team.description || "" }); setEditing(true); }}
                          className="min-h-[40px] px-3.5 border border-slate-300 rounded-lg bg-white font-medium cursor-pointer"
                        >
                          Edit
                        </button>
                        <button
                          type="button"
                          onClick={() => setDialog({ kind: "archive" })}
                          className="min-h-[40px] px-3.5 border border-slate-300 rounded-lg bg-white font-medium text-red-700 cursor-pointer"
                        >
                          Archive
                        </button>
                      </div>
                    )}
                  </div>
                )}
              </div>

              <div className="bg-white border border-slate-200 rounded-xl p-5 flex flex-col gap-3">
                <div className="flex items-center justify-between gap-2">
                  <h3 className="m-0 text-[15px] font-semibold">
                    Members <span className="text-slate-600 font-medium">({members.length})</span>
                  </h3>
                  <div className="flex items-center gap-2">
                    <button type="button" onClick={refresh} title="Refresh" aria-label="Refresh" className="w-9 h-9 flex items-center justify-center rounded-lg text-slate-500 hover:bg-slate-100 cursor-pointer">
                      <RefreshCw className={`w-4 h-4 ${isTeamLoading ? "animate-spin" : ""}`} />
                    </button>
                    {isActive && (
                      <button
                        type="button"
                        onClick={openAddMember}
                        className="flex items-center gap-1.5 min-h-[36px] px-3 border border-blue-200 rounded-lg bg-blue-50 text-blue-700 text-[13px] font-semibold cursor-pointer"
                      >
                        <Plus className="w-4 h-4" /> Add member
                      </button>
                    )}
                  </div>
                </div>

                {!members.length && (
                  <p className="m-0 py-5 text-center text-slate-600 bg-slate-50 rounded-lg">No members.</p>
                )}

                <div role="list" className="flex flex-col">
                  {members.map((m) => {
                    const name = fullName(m);
                    const open = menuFor === m.user_id;
                    return (
                      <div key={m.user_id} role="listitem" className="relative flex flex-wrap items-center gap-3 px-1 py-2.5 border-t border-slate-100">
                        <Avatar id={m.user_id} name={name} />
                        <div className="flex-1 basis-[200px] min-w-0">
                          <div className="font-semibold truncate">{name}</div>
                          <div className="text-xs text-slate-600 truncate">{m.email}</div>
                        </div>
                        <span className="min-w-[56px]">{m.is_lead && <LeadBadge />}</span>
                        {isActive && (
                          <button
                            type="button"
                            aria-label={`Actions for ${name}`}
                            aria-expanded={open}
                            onClick={(e) => { e.stopPropagation(); setMenuFor(open ? null : m.user_id); }}
                            className="w-10 h-10 flex items-center justify-center rounded-lg text-slate-700 hover:bg-slate-100 cursor-pointer"
                          >
                            <MoreHorizontal className="w-[18px] h-[18px]" />
                          </button>
                        )}
                        {open && (
                          <div
                            role="menu"
                            onKeyDown={(e) => { if (e.key === "Escape") setMenuFor(null); }}
                            className="absolute right-1 top-[52px] z-10 min-w-[200px] bg-white border border-slate-200 rounded-[10px] shadow-lg p-1.5 flex flex-col"
                          >
                            {m.is_lead ? (
                              <button
                                type="button"
                                role="menuitem"
                                onClick={() => run(() => teamsApi.setLead(team.team_id, m.user_id, false), `${name} is no longer a lead of ${team.name}.`)}
                                className="text-left min-h-[40px] px-3 rounded-md hover:bg-slate-100 cursor-pointer"
                              >
                                Remove lead
                              </button>
                            ) : (
                              <button
                                type="button"
                                role="menuitem"
                                onClick={() => setDialog({ kind: "makeLead", userId: m.user_id, name })}
                                className="text-left min-h-[40px] px-3 rounded-md hover:bg-slate-100 cursor-pointer"
                              >
                                Make lead
                              </button>
                            )}
                            <button
                              type="button"
                              role="menuitem"
                              onClick={() => setDialog({ kind: "remove", userId: m.user_id, name, isLead: m.is_lead })}
                              className="text-left min-h-[40px] px-3 rounded-md text-red-700 hover:bg-red-50 cursor-pointer"
                            >
                              Remove from team
                            </button>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>

              <div className="border border-dashed border-slate-300 rounded-xl px-5 py-4 text-slate-600">
                <h3 className="m-0 text-sm font-semibold text-slate-700">Access pool</h3>
                <p className="mt-1 mb-0 text-[13px]">
                  Comes later: the services this team can hand out, and the highest access level a lead may grant.
                </p>
              </div>
            </>
          )}
        </section>
      </div>

      <Toasts toasts={toasts} onDismiss={dismiss} />

      {dialog && (
        <Dialog
          dialog={dialog}
          team={team}
          candidates={candidates}
          personQuery={personQuery}
          setPersonQuery={setPersonQuery}
          draft={draft}
          setDraft={setDraft}
          busy={busy}
          onClose={() => setDialog(null)}
          onRun={run}
          navigate={navigate}
        />
      )}
    </main>
  );
}

function Dialog({ dialog, team, candidates, personQuery, setPersonQuery, draft, setDraft, busy, onClose, onRun, navigate }) {
  const close = () => onClose();

  const body = () => {
    switch (dialog.kind) {
      case "new":
        return (
          <form
            className="flex flex-col gap-3"
            onSubmit={async (e) => {
              e.preventDefault();
              let created = null;
              const ok = await onRun(async () => {
                const { data } = await teamsApi.createTeam(draft);
                created = data;
              }, `Team '${draft.name.trim()}' created.`);
              if (ok) {
                close();
                if (created) navigate(`/teams/${created.team_id}`);
              }
            }}
          >
            <h2 className="m-0 text-lg font-bold">New team</h2>
            <label className="flex flex-col gap-1 text-[13px] font-semibold">
              Team name
              <input
                type="text"
                autoFocus
                placeholder="e.g. Game Studio"
                value={draft.name}
                onChange={(e) => setDraft((d) => ({ ...d, name: e.target.value }))}
                className="min-h-[40px] px-3 border border-slate-300 rounded-lg font-normal text-sm"
              />
            </label>
            <label className="flex flex-col gap-1 text-[13px] font-semibold">
              Description (optional)
              <textarea
                rows={2}
                value={draft.description}
                onChange={(e) => setDraft((d) => ({ ...d, description: e.target.value }))}
                className="px-3 py-2 border border-slate-300 rounded-lg font-normal text-sm resize-y"
              />
            </label>
            <div className="flex justify-end gap-2 pt-1">
              <button type="button" onClick={close} className="min-h-[40px] px-3.5 border border-slate-300 rounded-lg bg-white cursor-pointer">Cancel</button>
              <button type="submit" disabled={busy} className="min-h-[40px] px-4 rounded-lg bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white font-semibold cursor-pointer">
                Create team
              </button>
            </div>
          </form>
        );

      case "add":
        return (
          <>
            <h2 className="m-0 text-lg font-bold">Add member to {team?.name}</h2>
            <label className="relative block">
              <span className="sr-only">Search users by name</span>
              <Search className="w-4 h-4 text-slate-400 absolute left-3 top-3" />
              <input
                type="search"
                autoFocus
                placeholder="Search by name"
                value={personQuery}
                onChange={(e) => setPersonQuery(e.target.value)}
                className="w-full min-h-[40px] pl-9 pr-3 bg-slate-50 border border-slate-300 rounded-lg text-sm focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </label>
            <div className="flex flex-col max-h-[300px] overflow-y-auto scroll-soft border border-slate-200 rounded-[10px]">
              {candidates.map((p) => {
                const name = fullName(p);
                return (
                  <div key={p.user_id} className="flex items-center gap-2.5 px-2.5 py-2 border-b border-slate-100 last:border-b-0">
                    <Avatar id={p.user_id} name={name} size={32} />
                    <div className="flex-1 min-w-0">
                      <div className="font-semibold truncate">{name}</div>
                      <div className="text-xs text-slate-600 truncate">{p.teamNames || "No team"}</div>
                    </div>
                    <button
                      type="button"
                      disabled={busy}
                      onClick={() => onRun(() => teamsApi.addMember(team.team_id, p.user_id), `${name} added to ${team.name}.`)}
                      className="min-h-[36px] px-3 border border-blue-200 rounded-lg bg-blue-50 text-blue-700 font-semibold disabled:opacity-50 cursor-pointer"
                    >
                      Add
                    </button>
                  </div>
                );
              })}
              {!candidates.length && (
                <p className="m-0 p-4 text-slate-600">
                  {personQuery ? `Nobody matches “${personQuery}”.` : "Everyone eligible is already in this team."}
                </p>
              )}
            </div>
            <p className="m-0 text-xs text-slate-500">
              They join as a member. Admins, inactive users and current members aren&apos;t listed.
            </p>
            <div className="flex justify-end">
              <button type="button" onClick={close} className="min-h-[40px] px-3.5 border border-slate-300 rounded-lg bg-white cursor-pointer">Done</button>
            </div>
          </>
        );

      case "makeLead":
        return (
          <Confirm
            title={`Make ${dialog.name} a lead?`}
            body={`This gives ${dialog.name} the LEAD role: they will be able to grant access from this team's pool to its members. A team can have more than one lead, and a person can lead only one team.`}
            confirmLabel="Make lead"
            tone="blue"
            busy={busy}
            onClose={close}
            onConfirm={async () => {
              const ok = await onRun(() => teamsApi.setLead(team.team_id, dialog.userId, true), `${dialog.name} is now a lead of ${team.name}.`);
              if (ok) close();
            }}
          />
        );

      case "remove":
        return (
          <Confirm
            title={`Remove ${dialog.name}?`}
            body={
              dialog.isLead
                ? `${dialog.name} leads ${team.name}. Removing them leaves the team without a lead until you pick another, and their role goes back to USER.`
                : `${dialog.name} will be removed from ${team.name}. Once teams hand out access, the access they got through this team is checked and revoked first.`
            }
            confirmLabel="Remove"
            tone="red"
            busy={busy}
            onClose={close}
            onConfirm={async () => {
              const ok = await onRun(() => teamsApi.removeMember(team.team_id, dialog.userId), `${dialog.name} removed from ${team.name}.`);
              if (ok) close();
            }}
          />
        );

      case "archive":
        return (
          <Confirm
            title={`Archive ${team?.name}?`}
            body={`The team becomes read-only and its ${team?.members?.length || 0} member(s) are removed. Each removal is recorded in the audit log.`}
            confirmLabel="Archive"
            tone="red"
            busy={busy}
            onClose={close}
            onConfirm={async () => {
              const ok = await onRun(() => teamsApi.archiveTeam(team.team_id), `${team.name} archived.`);
              if (ok) close();
            }}
          />
        );

      default:
        return null;
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/45 flex items-start justify-center px-4 pt-24 pb-4">
      <div role="dialog" aria-modal="true" className="w-full max-w-[480px] bg-white rounded-2xl shadow-2xl p-5 flex flex-col gap-3.5">
        {body()}
      </div>
    </div>
  );
}

function Confirm({ title, body, confirmLabel, tone, busy, onClose, onConfirm }) {
  return (
    <>
      <h2 className="m-0 text-lg font-bold">{title}</h2>
      <p className="m-0 text-slate-700 leading-relaxed">{body}</p>
      <div className="flex justify-end gap-2">
        <button type="button" onClick={onClose} className="min-h-[40px] px-3.5 border border-slate-300 rounded-lg bg-white cursor-pointer">Cancel</button>
        <button
          type="button"
          disabled={busy}
          onClick={onConfirm}
          className={`min-h-[40px] px-4 rounded-lg text-white font-semibold disabled:opacity-50 cursor-pointer ${
            tone === "red" ? "bg-red-700 hover:bg-red-800" : "bg-blue-600 hover:bg-blue-700"
          }`}
        >
          {confirmLabel}
        </button>
      </div>
    </>
  );
}
