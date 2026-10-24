/**
 * @file PeoplePage.js
 * @description Everyone in the lab: a narrow list of names on the left, the
 * selected person on the right. Same shape as Teams, so nothing is a page
 * away — picking a name swaps the pane rather than navigating off somewhere.
 *
 * Inactive people sit in a collapsed group at the bottom, the way archived
 * teams do.
 */

import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { Plus, Search, ChevronRight, RefreshCw } from "lucide-react";
import PersonDetail from "../components/PersonDetail";
import AddPersonModal from "../components/AddPersonModal";
import Toasts, { useToasts } from "../components/Toasts";
import Select from "../components/Select";
import { fetchWithAuth } from "../utils/fetchWithAuth";
import * as teamsApi from "../api/teams";

const API_URL = process.env.REACT_APP_API_URL || "http://localhost:5001";

function fullName(person) {
  const name = `${person.first_name || ""} ${person.last_name || ""}`.trim();
  return name || person.name || person.email;
}

export default function PeoplePage() {
  const { userId } = useParams();
  const navigate = useNavigate();

  const [people, setPeople] = useState([]);
  const [teams, setTeams] = useState([]);
  const [services, setServices] = useState([]);
  const [query, setQuery] = useState("");
  const [teamFilter, setTeamFilter] = useState("ALL"); // ALL | NONE | <team_id>
  const [showInactive, setShowInactive] = useState(false);
  const [adding, setAdding] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const { toasts, push, dismiss } = useToasts();

  const load = useCallback(async () => {
    try {
      const [usersRes, teamList, servicesRes] = await Promise.all([
        fetchWithAuth(`${API_URL}/users`).then((r) => r.json()),
        teamsApi.listTeams(),
        fetchWithAuth(`${API_URL}/services`).then((r) => r.json()),
      ]);
      setPeople(usersRes.data || []);
      setTeams(teamList.data || []);
      setServices(servicesRes.data || []);
    } catch (err) {
      push("error", err.message);
    } finally {
      setIsLoading(false);
    }
  }, [push]);

  useEffect(() => { load(); }, [load]);

  const teamsByUser = useMemo(() => {
    const map = new Map();
    teams.forEach((t) => {
      (t.members || []).forEach((m) => {
        const key = String(m.user_id);
        if (!map.has(key)) map.set(key, []);
        map.get(key).push(t.team_id);
      });
    });
    return map;
  }, [teams]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return people.filter((p) => {
      const matchesSearch = !q || fullName(p).toLowerCase().includes(q) || (p.email || "").toLowerCase().includes(q);
      const inTeams = teamsByUser.get(String(p.user_id)) || [];
      const matchesTeam =
        teamFilter === "ALL" ||
        (teamFilter === "NONE" ? inTeams.length === 0 : inTeams.some((id) => String(id) === String(teamFilter)));
      return matchesSearch && matchesTeam;
    });
  }, [people, query, teamFilter, teamsByUser]);

  const selected = people.find((p) => String(p.user_id) === String(userId)) || null;
  const active = filtered.filter((p) => p.is_active !== false);
  const inactive = filtered.filter((p) => p.is_active === false);

  // Opens itself the first time you land on an inactive person, so the selected
  // one is visible — and after that the toggle wins. Deriving "open" from the
  // selection kept the group open regardless of the button, which made the
  // button dead for as long as an inactive person was selected.
  const autoOpenedFor = useRef(null);
  useEffect(() => {
    if (!userId || autoOpenedFor.current === String(userId)) return;
    if (people.some((p) => p.is_active === false && String(p.user_id) === String(userId))) {
      autoOpenedFor.current = String(userId);
      setShowInactive(true);
    }
  }, [userId, people]);

  // Land on someone so the pane is never empty on arrival.
  useEffect(() => {
    if (!userId && active.length) {
      navigate(`/people/${active[0].user_id}`, { replace: true });
    }
  }, [userId, active, navigate]);

  const row = (p) => {
    const selected = String(p.user_id) === String(userId);
    return (
      <button
        key={p.user_id}
        type="button"
        onClick={() => navigate(`/people/${p.user_id}`)}
        aria-current={selected}
        className={`flex items-center justify-between gap-2 w-full min-h-[44px] px-2.5 rounded-lg text-left cursor-pointer ${
          selected ? "bg-blue-50 border border-blue-200" : "border border-transparent hover:bg-slate-50"
        }`}
      >
        <span className={`truncate ${p.is_active === false ? "text-slate-500" : "font-medium"}`}>{fullName(p)}</span>
        {String(p.Role).toUpperCase() === "ADMIN" && (
          <span className="flex-shrink-0 px-2 py-0.5 rounded-full bg-violet-100 text-violet-800 text-[10px] font-bold tracking-wide">
            ADMIN
          </span>
        )}
      </button>
    );
  };

  return (
    <main className="flex-1 min-h-0 overflow-y-auto scroll-soft px-6 py-4">
      <div className="flex flex-wrap items-start gap-5">
        <section
          aria-label="Users"
          className="flex-1 basis-[260px] min-w-0 sticky top-0 max-h-[calc(100vh-7.5rem)] bg-white border border-slate-200 rounded-xl p-4 flex flex-col gap-3 overflow-hidden"
        >
          <div className="flex items-center justify-between gap-2">
            <h2 className="m-0 text-[15px] font-semibold">People</h2>
            <button
              type="button"
              onClick={() => setAdding(true)}
              className="flex items-center gap-1.5 min-h-[36px] px-3 rounded-lg bg-blue-600 hover:bg-blue-700 text-white text-[13px] font-semibold cursor-pointer"
            >
              <Plus className="w-4 h-4" /> Add user
            </button>
          </div>

          <label className="relative block">
            <span className="sr-only">Search users</span>
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-3" />
            <input
              type="search"
              placeholder="Search users"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              className="w-full min-h-[40px] pl-9 pr-3 bg-slate-50 border border-slate-300 rounded-lg text-sm focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </label>

          <Select label="Filter by team" value={teamFilter} onChange={(e) => setTeamFilter(e.target.value)} className="w-full">
            <option value="ALL">All teams</option>
            <option value="NONE">No team</option>
            {teams.filter((t) => t.is_active).map((t) => (
              <option key={t.team_id} value={t.team_id}>{t.name}</option>
            ))}
          </Select>

          {isLoading ? (
            <p className="py-6 text-center text-sm text-slate-500">Loading users…</p>
          ) : (
            <div className="flex-1 min-h-0 overflow-y-auto scroll-soft -mr-1 pr-1 flex flex-col gap-0.5">
              {active.map(row)}
              {!active.length && (
                <p className="my-2 mx-1 text-[13px] text-slate-600">
                  {query || teamFilter !== "ALL" ? "No users match that." : "No users yet."}
                </p>
              )}
            </div>
          )}

          {inactive.length > 0 && (
            <div className="flex-shrink-0 border-t border-slate-200 pt-2">
              <button
                type="button"
                onClick={() => setShowInactive((v) => !v)}
                aria-expanded={showInactive}
                className="flex items-center gap-1.5 w-full min-h-[36px] px-1.5 rounded-lg text-left text-[11px] font-semibold uppercase tracking-wider text-slate-600 hover:bg-slate-50 cursor-pointer"
              >
                <ChevronRight className={`w-3.5 h-3.5 transition-transform ${showInactive ? "rotate-90" : ""}`} />
                Inactive
                <span className="font-medium normal-case tracking-normal">({inactive.length})</span>
              </button>
              {showInactive && (
                <div className="mt-1 max-h-[180px] overflow-y-auto scroll-soft flex flex-col gap-0.5">{inactive.map(row)}</div>
              )}
            </div>
          )}
        </section>

        <section aria-label="Selected user" className="flex-[999] basis-[520px] min-w-0">
          {isLoading ? (
            <div className="bg-white border border-slate-200 rounded-xl px-6 py-12 text-center">
              <RefreshCw className="w-6 h-6 mx-auto text-blue-600 animate-spin" />
            </div>
          ) : selected ? (
            <PersonDetail
              key={selected.user_id}
              person={selected}
              teams={teams}
              services={services}
              onPersonChanged={load}
            />
          ) : (
            <div className="bg-white border border-slate-200 rounded-xl px-6 py-12 text-center text-slate-600">
              {userId ? "User not found." : "Select a user."}
            </div>
          )}
        </section>
      </div>

      <Toasts toasts={toasts} onDismiss={dismiss} />

      {adding && (
        <AddPersonModal
          teams={teams}
          onTeamsChanged={load}
          onClose={() => setAdding(false)}
          onAdded={(text, newUserId, opts = {}) => {
            push("success", text);
            load();
            if (newUserId && !opts.keepOpen) navigate(`/people/${newUserId}`);
          }}
        />
      )}
    </main>
  );
}
