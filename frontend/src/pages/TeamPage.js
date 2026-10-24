/**
 * @file TeamPage.js
 * @description The signed-in person's own teams and who else is on them.
 *
 * Its real job is answering "who do I ask?", so leads come first and every
 * name is a mailto. The admin's Teams screen is the one that can change any of
 * this; here it is only shown.
 */

import React, { useEffect, useState } from "react";
import { RefreshCw, Users2, Crown } from "lucide-react";
import { useAuth } from "../context/AuthContext";
import * as userApi from "../api/user";

function Member({ member, isViewer }) {
  return (
    <li className="flex flex-wrap items-center gap-2 py-2 border-b border-slate-100 last:border-b-0">
      <span className="w-7 h-7 rounded-full bg-slate-100 text-slate-600 flex items-center justify-center text-[11px] font-semibold flex-shrink-0">
        {(member.name || member.email || "?").slice(0, 2).toUpperCase()}
      </span>
      <span className="font-medium text-slate-900">{member.name || member.email}</span>
      {member.isLead && (
        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-amber-50 border border-amber-200 text-amber-700 text-[11px] font-semibold">
          <Crown className="w-3 h-3" /> Lead
        </span>
      )}
      {isViewer && (
        <span className="px-2 py-0.5 rounded-md bg-slate-100 text-slate-600 text-[11px] font-semibold">You</span>
      )}
      <a
        href={`mailto:${member.email}`}
        className="ml-auto text-[13px] text-blue-700 no-underline hover:underline break-all"
      >
        {member.email}
      </a>
    </li>
  );
}

export default function TeamPage() {
  const { user } = useAuth();
  const viewerUserId = user?.userId;
  const [teams, setTeams] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    let cancelled = false;

    userApi
      .getTeams()
      .then(({ data }) => {
        if (!cancelled) setTeams(data);
      })
      .catch((err) => {
        if (!cancelled) setError(err.message);
      })
      .finally(() => {
        if (!cancelled) setIsLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, []);

  if (isLoading) {
    return (
      <main className="flex-1 min-h-0 overflow-y-auto scroll-soft px-6 py-4">
        <div className="bg-white border border-slate-200 rounded-xl py-12 text-center text-slate-500">
          <RefreshCw className="w-4 h-4 animate-spin inline-block mr-2 align-text-bottom" />
          Loading your team…
        </div>
      </main>
    );
  }

  return (
    <main className="flex-1 min-h-0 overflow-y-auto scroll-soft px-6 py-4">
      {error && (
        <div className="mb-3 px-3 py-2.5 rounded-xl bg-red-50 border border-red-200 text-[13px] text-red-700">
          {error}
        </div>
      )}

      {teams.length === 0 && !error ? (
        <div className="bg-white border border-slate-200 rounded-xl py-12 px-6 text-center">
          <Users2 className="w-7 h-7 text-slate-300 mx-auto mb-2" />
          <p className="m-0 font-semibold text-slate-900">You're not on a team yet</p>
          <p className="mt-1 mb-0 text-[13px] text-slate-600">
            The admin adds people to teams. Once you're on one, its members show up here.
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {teams.map((team) => (
            <section key={team.team_id} className="bg-white border border-slate-200 rounded-xl px-5 py-4">
              <div className="flex flex-wrap items-baseline gap-2">
                <h2 className="m-0 text-base font-bold text-slate-900">{team.name}</h2>
                <span className="text-[13px] text-slate-500">
                  {team.member_count} {team.member_count === 1 ? "member" : "members"}
                </span>
                {team.viewer_is_lead && (
                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-amber-50 border border-amber-200 text-amber-700 text-[11px] font-semibold">
                    <Crown className="w-3 h-3" /> You lead this team
                  </span>
                )}
              </div>

              {team.description && <p className="mt-1 mb-0 text-[13px] text-slate-600">{team.description}</p>}

              <ul className="list-none m-0 mt-3 p-0">
                {team.members.map((member) => (
                  <Member key={member.userId} member={member} isViewer={member.userId === viewerUserId} />
                ))}
              </ul>
            </section>
          ))}
        </div>
      )}
    </main>
  );
}
