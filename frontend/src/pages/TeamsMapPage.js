/**
 * @file TeamsMapPage.js
 * @description The map view of Teams: how the lab is structured — the admin at the top, every team in
 * one horizontally scrolling row beneath, and the people who are in no team at
 * the bottom.
 *
 * Read-only apart from adding someone to a team, which adds them as a member.
 * Leads are set on the Teams page.
 */

import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { ZoomIn, ZoomOut, ChevronDown, ChevronLeft, ChevronRight, Plus, Star } from "lucide-react";
import { useAuth } from "../context/AuthContext";
import Toasts, { useToasts } from "../components/Toasts";
import * as teamsApi from "../api/teams";

const COL_WIDTH = 260;
const MIN_ZOOM = 0.5;
const MAX_ZOOM = 2;
const MIN_MAP_HEIGHT = 240;

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

function Avatar({ id, name, size = 28 }) {
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

export default function TeamsMapPage() {
  const { user } = useAuth();
  const viewportRef = useRef(null);

  const [teams, setTeams] = useState([]);
  const [people, setPeople] = useState([]);
  const [expanded, setExpanded] = useState({});
  const [hover, setHover] = useState(null); // { userId, teamId }
  const [zoom, setZoom] = useState(1);
  const [mapHeight, setMapHeight] = useState(440);
  const [pickFor, setPickFor] = useState(null);
  const [pickTeam, setPickTeam] = useState(null);
  const { toasts, push, dismiss } = useToasts();
  const [isLoading, setIsLoading] = useState(true);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    try {
      // Two requests for the whole page: the team list carries its members, and
      // the user list is what shows who is in no team at all.
      const [teamList, userList] = await Promise.all([teamsApi.listTeams(), teamsApi.listUsers()]);
      setTeams(teamList.data.filter((t) => t.is_active));
      setPeople(userList.data || []);
    } catch (err) {
      push("error", err.message);
    } finally {
      setIsLoading(false);
    }
  }, [push]);

  useEffect(() => { load(); }, [load]);

  const teamsOf = useCallback(
    (userId) =>
      teams
        .filter((t) => t.members.some((m) => String(m.user_id) === String(userId)))
        .map((t) => ({
          name: t.name,
          part: t.members.some((m) => String(m.user_id) === String(userId) && m.is_lead) ? "Lead" : "Member",
        })),
    [teams]
  );

  const unassigned = useMemo(() => {
    const inTeam = new Set();
    teams.forEach((t) => t.members.forEach((m) => inTeam.add(String(m.user_id))));
    return people.filter(
      (p) => !inTeam.has(String(p.user_id)) && p.is_active !== false && String(p.Role).toUpperCase() !== "ADMIN"
    );
  }, [teams, people]);

  const leadlessCount = teams.filter((t) => !t.members.some((m) => m.is_lead)).length;
  const picked = pickFor ? people.find((p) => String(p.user_id) === String(pickFor)) : null;

  const clampZoom = (next) => setZoom(Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, Math.round(next * 100) / 100)));

  const scrollBy = (factor) => {
    const v = viewportRef.current;
    if (v) v.scrollBy({ left: v.clientWidth * factor, behavior: "smooth" });
  };

  // Drag the bar to trade height between the map and the list below it.
  const startDrag = (e) => {
    e.preventDefault();
    const startY = e.clientY;
    const startH = mapHeight;
    const max = Math.max(MIN_MAP_HEIGHT, (e.currentTarget.parentElement?.clientHeight || 900) - 150);
    const move = (ev) => setMapHeight(Math.min(max, Math.max(MIN_MAP_HEIGHT, startH + (ev.clientY - startY))));
    const up = () => {
      window.removeEventListener("mousemove", move);
      window.removeEventListener("mouseup", up);
    };
    window.addEventListener("mousemove", move);
    window.addEventListener("mouseup", up);
  };

  const handleKey = (e) => {
    if (e.key !== "ArrowUp" && e.key !== "ArrowDown") return;
    e.preventDefault();
    const max = Math.max(MIN_MAP_HEIGHT, (e.currentTarget.parentElement?.clientHeight || 900) - 150);
    setMapHeight((h) => Math.min(max, Math.max(MIN_MAP_HEIGHT, h + (e.key === "ArrowDown" ? 24 : -24))));
  };

  const addToTeam = async () => {
    if (!picked || !pickTeam) return;
    setBusy(true);
    try {
      await teamsApi.addMember(pickTeam, picked.user_id);
      const target = teams.find((t) => String(t.team_id) === String(pickTeam));
      push("success", `${fullName(picked)} added to ${target?.name}.`);
      setPickFor(null);
      setPickTeam(null);
      await load();
    } catch (err) {
      push("error", err.message);
      setPickFor(null);
      setPickTeam(null);
    } finally {
      setBusy(false);
    }
  };

  return (
    <main className="flex-1 min-h-0 px-6 py-4 flex flex-col">
      <div className="flex-shrink-0 mb-3 flex flex-wrap items-center justify-between gap-3">
        <p className="m-0 text-slate-700">
          <strong>{teams.length}</strong> active teams · <strong>{leadlessCount}</strong> without a lead
        </p>
      </div>

      {/* The map */}
      <div
        style={{ height: mapHeight }}
        className="relative flex-shrink-0 min-h-0 overflow-hidden bg-white border border-slate-200 rounded-xl pt-6 pb-3 flex flex-col items-center"
      >
        <div role="group" aria-label="Zoom" className="absolute top-3.5 right-3.5 z-10 flex items-center gap-1 p-1 bg-white border border-slate-200 rounded-[10px] shadow-sm">
          <button type="button" onClick={() => clampZoom(zoom - 0.05)} aria-label="Zoom out" className="w-10 h-10 flex items-center justify-center rounded-lg text-slate-700 hover:bg-slate-100 cursor-pointer">
            <ZoomOut className="w-5 h-5" />
          </button>
          <input
            type="range"
            min={MIN_ZOOM * 100}
            max={MAX_ZOOM * 100}
            step={1}
            value={Math.round(zoom * 100)}
            onChange={(e) => clampZoom(Number(e.target.value) / 100)}
            aria-label="Zoom level"
            className="w-40 cursor-pointer accent-blue-600"
          />
          <button type="button" onClick={() => clampZoom(zoom + 0.05)} aria-label="Zoom in" className="w-10 h-10 flex items-center justify-center rounded-lg text-slate-700 hover:bg-slate-100 cursor-pointer">
            <ZoomIn className="w-5 h-5" />
          </button>
          <button type="button" onClick={() => setZoom(1)} title="Back to actual size (100%)" className="min-w-[58px] h-10 px-2 border-l border-slate-200 rounded-r-lg text-right text-[13px] font-semibold text-slate-700 cursor-pointer">
            {Math.round(zoom * 100)}%
          </button>
        </div>

        <div className="flex items-center gap-3 px-[18px] py-3 border border-violet-300 bg-violet-50 rounded-xl">
          <span aria-hidden="true" className="w-11 h-11 rounded-full bg-violet-800 text-white flex items-center justify-center font-bold">
            {initials(user?.name || user?.email)}
          </span>
          <div>
            <div className="font-bold text-[15px]">{user?.name || user?.email}</div>
            <div className="flex items-center gap-2 mt-0.5">
              <span className="px-2 py-0.5 rounded-full bg-violet-100 text-violet-800 text-[11px] font-bold tracking-wide">ADMIN</span>
            </div>
          </div>
        </div>
        <div aria-hidden="true" className="w-0.5 h-7 bg-slate-400" />

        <div className="relative w-full flex-1 min-h-0 flex flex-col">
          <div aria-hidden="true" className="absolute left-0 top-0 bottom-0 w-14 z-[3] pointer-events-none bg-gradient-to-r from-white to-transparent" />
          <div aria-hidden="true" className="absolute right-0 top-0 bottom-0 w-14 z-[3] pointer-events-none bg-gradient-to-l from-white to-transparent" />
          <button type="button" onClick={() => scrollBy(-0.8)} aria-label="Scroll teams left" className="absolute left-2 top-[34px] z-[4] w-10 h-10 flex items-center justify-center border border-slate-300 rounded-full bg-white shadow cursor-pointer">
            <ChevronLeft className="w-[18px] h-[18px]" />
          </button>
          <button type="button" onClick={() => scrollBy(0.8)} aria-label="Scroll teams right" className="absolute right-2 top-[34px] z-[4] w-10 h-10 flex items-center justify-center border border-slate-300 rounded-full bg-white shadow cursor-pointer">
            <ChevronRight className="w-[18px] h-[18px]" />
          </button>

          <div ref={viewportRef} tabIndex={0} role="region" aria-label="Teams. Scroll sideways to see more." className="flex-1 min-h-0 overflow-auto scroll-soft pb-3">
            {isLoading ? (
              <p className="py-10 text-center text-slate-500">Loading teams…</p>
            ) : (
              <div role="list" aria-label="Teams" style={{ zoom, width: "max-content", padding: "0 40px" }} className="flex items-start">
                {teams.map((t, i) => {
                  const open = !!expanded[t.team_id];
                  const sorted = [...t.members].sort((a, b) => Number(b.is_lead) - Number(a.is_lead));
                  const leadless = !t.members.some((m) => m.is_lead);
                  return (
                    <div key={t.team_id} role="listitem" style={{ flex: `0 0 ${COL_WIDTH}px` }} className="relative flex flex-col box-border">
                      <div aria-hidden="true" className="flex h-7">
                        <div className={`flex-1 ${i === 0 ? "" : "border-t-2 border-slate-400"}`} />
                        <div className="w-0.5 bg-slate-400" />
                        <div className={`flex-1 ${i === teams.length - 1 ? "" : "border-t-2 border-slate-400"}`} />
                      </div>
                      <div className={`mx-2.5 bg-white rounded-xl flex flex-col border ${open ? "border-blue-300" : "border-slate-300"}`}>
                        <button
                          type="button"
                          onClick={() => setExpanded((e) => ({ ...e, [t.team_id]: !open }))}
                          aria-expanded={open}
                          className="flex items-center justify-between gap-2 w-full min-h-[56px] px-3.5 py-2.5 rounded-xl text-left cursor-pointer"
                        >
                          <span className="min-w-0 flex flex-col gap-0.5">
                            <span className="font-bold text-[15px] truncate">{t.name}</span>
                            <span className="text-xs text-slate-600">
                              {t.members.length} {t.members.length === 1 ? "member" : "members"}
                            </span>
                          </span>
                          <span className="flex-shrink-0 flex items-center gap-2">
                            {leadless && (
                              <span className="px-2 py-0.5 rounded-full bg-amber-100 text-amber-800 text-[11px] font-semibold">No lead</span>
                            )}
                            <ChevronDown className={`w-4 h-4 text-slate-600 transition-transform ${open ? "rotate-180" : ""}`} />
                          </span>
                        </button>

                        {open && (
                          <div className="px-2 pt-1 pb-2.5 border-t border-slate-200 flex flex-col gap-0.5">
                            {sorted.map((m) => {
                              const name = fullName(m);
                              const marked = String(hover?.userId) === String(m.user_id);
                              const showCard = marked && String(hover?.teamId) === String(t.team_id);
                              const memberTeams = teamsOf(m.user_id);
                              return (
                                <div key={m.user_id} className="relative">
                                  <button
                                    type="button"
                                    onMouseEnter={() => setHover({ userId: m.user_id, teamId: t.team_id })}
                                    onMouseLeave={() => setHover(null)}
                                    onFocus={() => setHover({ userId: m.user_id, teamId: t.team_id })}
                                    onBlur={() => setHover(null)}
                                    className={`flex items-center gap-2.5 w-full min-h-[40px] px-2 py-1 rounded-lg text-left cursor-default border ${
                                      marked ? "bg-blue-50 border-blue-600" : "border-transparent"
                                    }`}
                                  >
                                    <Avatar id={m.user_id} name={name} />
                                    <span className="flex-1 min-w-0 flex items-center gap-1.5">
                                      <span className="font-medium truncate">{name}</span>
                                      {m.is_lead && <Star className="w-3.5 h-3.5 flex-shrink-0 fill-amber-400 text-amber-700" aria-label="Lead" />}
                                    </span>
                                  </button>

                                  {showCard && (
                                    <div
                                      role="tooltip"
                                      style={{ width: 260, [i === teams.length - 1 ? "right" : "left"]: "calc(100% + 16px)" }}
                                      className="absolute -top-1.5 z-10 bg-white border border-slate-300 rounded-xl shadow-xl p-3.5 flex flex-col gap-2.5"
                                    >
                                      <div className="flex items-center gap-2.5">
                                        <Avatar id={m.user_id} name={name} size={40} />
                                        <div className="min-w-0">
                                          <div className="font-bold truncate">{name}</div>
                                          <div className="text-xs text-slate-600 truncate">{m.email}</div>
                                        </div>
                                      </div>
                                      <div className="flex flex-wrap items-center gap-1.5 text-xs text-slate-700">
                                        <span className="px-2.5 py-[3px] rounded-full bg-emerald-50 text-emerald-800 text-[11px] font-semibold">
                                          {m.is_active === false ? "Inactive" : "Active"}
                                        </span>
                                        {m.added_at && <span>In the team since {new Date(m.added_at).toLocaleDateString()}</span>}
                                      </div>
                                      {memberTeams.length > 1 && (
                                        <div>
                                          <div className="mb-1 text-[11px] font-semibold uppercase tracking-wider text-slate-600">Also in</div>
                                          {memberTeams
                                            .filter((x) => x.name !== t.name)
                                            .map((x) => (
                                              <div key={x.name} className="flex items-center justify-between gap-2 py-[3px] text-[13px]">
                                                <span>{x.name}</span>
                                                <span className="text-xs text-slate-600">{x.part}</span>
                                              </div>
                                            ))}
                                        </div>
                                      )}
                                    </div>
                                  )}
                                </div>
                              );
                            })}
                            <Link to={`/teams/${t.team_id}`} className="mt-1 mx-1 text-[13px] font-semibold text-blue-700 no-underline">
                              Manage in Teams →
                            </Link>
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })}
                {!teams.length && <p className="px-10 py-10 text-slate-500">No active teams yet.</p>}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Drag to resize */}
      <div
        role="separator"
        aria-orientation="horizontal"
        aria-label="Drag to resize the map"
        aria-valuenow={Math.round(mapHeight)}
        tabIndex={0}
        onMouseDown={startDrag}
        onKeyDown={handleKey}
        title="Drag to resize (or use the arrow keys)"
        className="flex-shrink-0 h-[18px] flex items-center justify-center cursor-row-resize"
      >
        <span aria-hidden="true" className="w-14 h-1 rounded-full bg-slate-300" />
      </div>

      {/* Not in any team */}
      <div className="flex-1 min-h-[72px] overflow-y-auto scroll-soft bg-white border border-slate-200 rounded-xl px-5 py-4">
        <div className="flex flex-wrap items-center gap-2.5">
          <h2 className="m-0 text-sm font-semibold">
            Not in any team <span className="text-slate-600 font-medium">({unassigned.length})</span>
          </h2>
        </div>

        {unassigned.length ? (
          <div className="mt-2.5 flex flex-wrap items-center gap-2">
            {unassigned.map((p) => {
              const name = fullName(p);
              return (
                <span key={p.user_id} className="group flex items-center gap-2 min-h-[44px] pl-1 pr-1.5 py-1 bg-white border border-slate-200 rounded-full">
                  <Avatar id={p.user_id} name={name} />
                  <span className="font-medium">{name}</span>
                  <button
                    type="button"
                    onClick={() => { setPickFor(p.user_id); setPickTeam(null); }}
                    title="Add to a team"
                    aria-label={`Add ${name} to a team`}
                    className="w-8 h-8 flex items-center justify-center rounded-full bg-blue-50 text-blue-700 opacity-0 group-hover:opacity-100 focus:opacity-100 transition-opacity cursor-pointer"
                  >
                    <Plus className="w-4 h-4" strokeWidth={2.5} />
                  </button>
                </span>
              );
            })}
          </div>
        ) : (
          <p className="mt-2.5 mb-0 text-slate-600">Everyone is in a team.</p>
        )}
      </div>

      <Toasts toasts={toasts} onDismiss={dismiss} />

      {picked && (
        <div className="fixed inset-0 z-50 bg-slate-900/45 flex items-start justify-center px-4 pt-24 pb-4">
          <div role="dialog" aria-modal="true" aria-label="Add to a team" className="w-full max-w-[440px] bg-white rounded-2xl shadow-2xl p-5 flex flex-col gap-3.5">
            <div className="flex items-center gap-2.5">
              <Avatar id={picked.user_id} name={fullName(picked)} size={40} />
              <div className="min-w-0">
                <h2 className="m-0 text-base font-bold">Add {fullName(picked)} to a team</h2>
                <p className="m-0 mt-0.5 text-xs text-slate-600 truncate">{picked.email}</p>
              </div>
            </div>

            <div role="radiogroup" aria-label="Choose a team" className="max-h-[260px] overflow-y-auto scroll-soft border border-slate-200 rounded-[10px]">
              {teams.map((t) => {
                const checked = String(pickTeam) === String(t.team_id);
                return (
                  <button
                    key={t.team_id}
                    type="button"
                    role="radio"
                    aria-checked={checked}
                    onClick={() => setPickTeam(t.team_id)}
                    className={`flex items-center gap-2 w-full min-h-[44px] px-3 border-b border-slate-100 last:border-b-0 text-left cursor-pointer ${
                      checked ? "bg-blue-100 text-blue-900 font-semibold" : "bg-white"
                    }`}
                  >
                    <span className="flex-1 min-w-0 truncate">{t.name}</span>
                    {!t.members.some((m) => m.is_lead) && (
                      <span className="flex-shrink-0 px-2 py-0.5 rounded-full bg-amber-100 text-amber-800 text-[11px] font-semibold">No lead</span>
                    )}
                  </button>
                );
              })}
            </div>

            <p className="m-0 text-xs text-slate-500">They join as a member. Leads are set in the Teams tab.</p>

            <div className="flex justify-end gap-2 pt-0.5 border-t border-slate-100">
              <button type="button" onClick={() => { setPickFor(null); setPickTeam(null); }} className="min-h-[40px] px-3.5 border border-slate-300 rounded-lg bg-white cursor-pointer">
                Cancel
              </button>
              <button
                type="button"
                onClick={addToTeam}
                disabled={!pickTeam || busy}
                className="min-h-[40px] px-4 rounded-lg bg-blue-600 hover:bg-blue-700 disabled:bg-slate-400 disabled:cursor-not-allowed text-white font-semibold cursor-pointer"
              >
                Add to team
              </button>
            </div>
          </div>
        </div>
      )}
    </main>
  );
}
