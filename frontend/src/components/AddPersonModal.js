/**
 * @file AddPersonModal.js
 * @description Adds someone to the lab and emails them an invite.
 *
 * No password field: the admin never sets, sees or sends one. The invite is a
 * one-time link and the person chooses their own password at the end of it.
 *
 * They are added as a user. A team can be picked here, including a new one, but
 * leads are still only set from the team's own page.
 */

import React, { useEffect, useState } from "react";
import { X, Mail, RefreshCw, Plus, Copy, Check, TriangleAlert } from "lucide-react";
import { fetchWithAuth } from "../utils/fetchWithAuth";
import * as teamsApi from "../api/teams";
import Select from "./Select";

const API_URL = process.env.REACT_APP_API_URL || "http://localhost:5001";

export default function AddPersonModal({ teams = [], onClose, onAdded, onTeamsChanged }) {
  const [email, setEmail] = useState("");
  const [name, setName] = useState("");
  const [teamId, setTeamId] = useState("");
  const [newTeamName, setNewTeamName] = useState("");
  const [creatingTeam, setCreatingTeam] = useState(false);
  const [pendingTeam, setPendingTeam] = useState(null);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  // Shown only when the invite could not be emailed, so the admin can still
  // pass the link on by hand.
  const [fallbackLink, setFallbackLink] = useState(null);
  const [copied, setCopied] = useState(false);
  // Checked before anything is created, so a mail server that cannot be reached
  // is noticed now rather than after the account exists.
  const [mailProblem, setMailProblem] = useState(null);

  useEffect(() => {
    fetchWithAuth(`${API_URL}/users/mail-status`)
      .then((r) => r.json())
      .then((j) => setMailProblem(j.data?.ok ? null : j.data?.reason || "Email is not working."))
      .catch(() => {});
  }, []);

  const activeTeams = teams.filter((t) => t.is_active);

  // Held, not created. A team typed here is only made when the user is
  // actually added: closing this dialog must not leave a team behind.
  const confirmNewTeam = () => {
    const trimmed = newTeamName.trim();
    if (!trimmed) return;
    if (activeTeams.some((t) => t.name.toLowerCase() === trimmed.toLowerCase())) {
      setError(`There is already a team called '${trimmed}'. Pick it from the list instead.`);
      return;
    }
    setError("");
    setPendingTeam(trimmed);
    setTeamId("");
    setCreatingTeam(false);
  };

  const submit = async (e) => {
    e.preventDefault();
    setBusy(true);
    setError("");
    try {
      let joinTeamId = teamId ? Number(teamId) : null;

      // A new team is created here, immediately before the user who needs it,
      // so an abandoned dialog leaves nothing behind.
      if (pendingTeam) {
        const { data } = await teamsApi.createTeam({ name: pendingTeam });
        joinTeamId = data.team_id;
        if (onTeamsChanged) await onTeamsChanged();
      }

      const res = await fetchWithAuth(`${API_URL}/users`, {
        method: "POST",
        body: JSON.stringify({ email, name, ...(joinTeamId ? { teamId: joinTeamId } : {}) }),
      });
      const data = await res.json();
      if (!res.ok || !data.success) throw new Error(data.message || "Could not add this user.");

      if (data.teamError) setError(`Added, but not to the team: ${data.teamError}`);

      if (data.inviteSent) {
        onAdded(data.message, data.data?.user_id);
        onClose();
      } else {
        // The account exists either way; the invite just needs delivering.
        setFallbackLink(data.inviteLink);
        if (onAdded) onAdded(data.message, data.data?.user_id, { keepOpen: true });
      }
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  };

  if (fallbackLink) {
    return (
      <div className="fixed inset-0 z-50 bg-slate-900/45 flex items-start justify-center px-4 pt-24 pb-4">
        <div role="dialog" aria-modal="true" aria-label="Invite could not be emailed" className="w-full max-w-[520px] bg-white rounded-2xl shadow-2xl p-5 flex flex-col gap-3.5">
          <h2 className="m-0 text-lg font-bold text-slate-900">{name || email} was added</h2>
          <p className="m-0 text-sm text-slate-700">
            The invite email could not be sent, so pass this link on yourself. It works once and expires in seven days.
          </p>
          <div className="flex items-center gap-2">
            <input
              readOnly
              value={fallbackLink}
              onFocus={(e) => e.target.select()}
              className="flex-1 min-w-0 h-9 px-2.5 bg-slate-50 border border-slate-300 rounded-md text-[13px] font-mono"
            />
            <button
              type="button"
              onClick={() => { navigator.clipboard?.writeText(fallbackLink); setCopied(true); }}
              className="flex items-center gap-1.5 h-9 px-3 border border-slate-300 rounded-md bg-white text-[13px] font-medium cursor-pointer hover:bg-slate-50"
            >
              {copied ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5" />}
              {copied ? "Copied" : "Copy"}
            </button>
          </div>
          <div className="flex justify-end">
            <button type="button" onClick={onClose} className="h-9 px-3.5 border border-slate-300 rounded-md bg-white text-sm font-medium cursor-pointer">
              Done
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/45 flex items-start justify-center px-4 pt-24 pb-4">
      <div role="dialog" aria-modal="true" aria-label="Add user" className="w-full max-w-[460px] bg-white rounded-2xl shadow-2xl p-5 flex flex-col gap-4">
        <div className="flex items-start justify-between gap-3">
          <div>
            <h2 className="m-0 text-lg font-bold text-slate-900">Add user</h2>
            <p className="m-0 mt-0.5 text-sm text-slate-600">They choose their own password from the invite.</p>
          </div>
          <button type="button" onClick={onClose} aria-label="Close" className="p-1.5 text-slate-400 hover:text-slate-600 rounded-lg hover:bg-slate-100">
            <X className="w-4 h-4" />
          </button>
        </div>

        <form onSubmit={submit} className="flex flex-col gap-3.5">
          <label className="flex flex-col gap-1 text-xs font-semibold uppercase text-slate-500">
            Email
            <span className="relative">
              <Mail className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
              <input
                type="email"
                required
                autoFocus
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="name@example.com"
                className="w-full h-9 pl-9 pr-3 bg-slate-50 border border-slate-200 rounded-lg text-sm font-normal normal-case text-slate-900 focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </span>
          </label>

          <label className="flex flex-col gap-1 text-xs font-semibold uppercase text-slate-500">
            Full name
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Jane Doe"
              className="h-9 px-3 bg-slate-50 border border-slate-200 rounded-lg text-sm font-normal normal-case text-slate-900 focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </label>

          <div className="flex flex-col gap-1 text-xs font-semibold uppercase text-slate-500">
            Team (optional)
            {creatingTeam ? (
              <div className="flex items-center gap-2">
                <input
                  type="text"
                  autoFocus
                  value={newTeamName}
                  onChange={(e) => setNewTeamName(e.target.value)}
                  onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); confirmNewTeam(); } }}
                  placeholder="New team name"
                  className="flex-1 min-w-0 h-9 px-3 bg-slate-50 border border-slate-200 rounded-lg text-sm font-normal normal-case text-slate-900 focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
                <button type="button" onClick={confirmNewTeam} disabled={!newTeamName.trim()} className="h-9 px-3 rounded-md bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white text-[13px] font-medium cursor-pointer">
                  Use this
                </button>
                <button type="button" onClick={() => { setCreatingTeam(false); setNewTeamName(""); }} className="h-9 px-3 border border-slate-300 rounded-md bg-white text-[13px] font-medium cursor-pointer">
                  Cancel
                </button>
              </div>
            ) : pendingTeam ? (
              <div className="flex items-center gap-2">
                <span className="flex-1 flex items-center gap-2 h-8 px-2.5 bg-blue-50 border border-blue-200 rounded-md text-[13px] font-medium text-blue-900">
                  {pendingTeam}
                  <span className="text-xs font-normal text-blue-700">— will be created</span>
                </span>
                <button
                  type="button"
                  onClick={() => { setPendingTeam(null); setNewTeamName(""); }}
                  className="h-8 px-2.5 border border-slate-300 rounded-md bg-white text-[13px] font-medium cursor-pointer hover:bg-slate-50"
                >
                  Remove
                </button>
              </div>
            ) : (
              <div className="flex items-center gap-2">
                <Select label="Team" value={teamId} onChange={(e) => setTeamId(e.target.value)} className="flex-1">
                  <option value="">No team</option>
                  {activeTeams.map((t) => (
                    <option key={t.team_id} value={t.team_id}>{t.name}</option>
                  ))}
                </Select>
                <button
                  type="button"
                  onClick={() => setCreatingTeam(true)}
                  className="flex items-center gap-1 h-8 px-2.5 border border-slate-300 rounded-md bg-white text-[13px] font-medium cursor-pointer hover:bg-slate-50"
                >
                  <Plus className="w-3.5 h-3.5" /> New team
                </button>
              </div>
            )}
          </div>

          <p className="m-0 text-xs text-slate-500">
            They join as a user and are emailed a one-time link to set their password. Leads are set from the team&apos;s page.
          </p>

          {mailProblem && (
            <div className="flex items-start gap-2 px-3 py-2 rounded-lg bg-amber-50 border border-amber-200 text-amber-900 text-[13px]">
              <TriangleAlert className="w-4 h-4 flex-shrink-0 mt-0.5" />
              <span>
                The invite can&apos;t be emailed right now, so you&apos;ll be given a link to pass on yourself.
                <span className="block text-amber-700 mt-0.5">{mailProblem}</span>
              </span>
            </div>
          )}

          {error && <p role="alert" className="m-0 px-3 py-2 rounded-lg bg-red-50 text-red-800 text-[13px]">{error}</p>}

          <div className="flex justify-end gap-2 pt-1 border-t border-slate-100">
            <button type="button" onClick={onClose} className="h-9 px-3.5 border border-slate-300 rounded-md bg-white text-sm font-medium cursor-pointer">
              Cancel
            </button>
            <button
              type="submit"
              disabled={busy || !email}
              className="h-9 px-4 rounded-md bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white text-sm font-semibold flex items-center gap-2 cursor-pointer"
            >
              {busy && <RefreshCw className="w-4 h-4 animate-spin" />}
              {mailProblem ? "Add and show link" : "Send invite"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
