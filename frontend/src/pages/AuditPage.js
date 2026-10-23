/**
 * @file AuditPage.js
 * @description The audit log: who did what, to whom, and whether it worked.
 *
 * This page is the filters; the table itself is shared with a person's
 * Activity tab so the two cannot drift apart.
 */

import React, { useEffect, useMemo, useState } from "react";
import { fetchWithAuth } from "../utils/fetchWithAuth";
import * as teamsApi from "../api/teams";
import Select from "../components/Select";
import AuditTable from "../components/AuditTable";

const API_URL = process.env.REACT_APP_API_URL || "http://localhost:5001";

const WINDOWS = [
  { id: "1", label: "Last 24 hours" },
  { id: "7", label: "Last 7 days" },
  { id: "30", label: "Last 30 days" },
  { id: "all", label: "All time" },
];

export default function AuditPage() {
  const [teams, setTeams] = useState([]);
  const [services, setServices] = useState([]);

  const [windowDays, setWindowDays] = useState("7");
  const [outcome, setOutcome] = useState("");
  const [teamId, setTeamId] = useState("");
  const [serviceId, setServiceId] = useState("");

  const filters = useMemo(() => {
    const f = {};
    if (windowDays !== "all") f.since = new Date(Date.now() - Number(windowDays) * 86400000).toISOString();
    if (outcome) f.outcome = outcome;
    if (teamId) f.teamId = teamId;
    if (serviceId) f.serviceId = serviceId;
    return f;
  }, [windowDays, outcome, teamId, serviceId]);

  useEffect(() => {
    fetchWithAuth(`${API_URL}/services`).then((r) => r.json()).then((j) => setServices(j.data || [])).catch(() => {});
    teamsApi.listTeams().then(({ data }) => setTeams(data)).catch(() => {});
  }, []);

  return (
    <main className="flex-1 min-h-0 overflow-y-auto scroll-soft px-6 py-4">
      <div className="flex flex-wrap items-center gap-1.5 mb-2.5">
        <Select label="Time range" value={windowDays} onChange={(e) => setWindowDays(e.target.value)}>
          {WINDOWS.map((w) => <option key={w.id} value={w.id}>{w.label}</option>)}
        </Select>
        <Select label="Result" value={outcome} onChange={(e) => setOutcome(e.target.value)}>
          <option value="">Any result</option>
          <option value="SUCCESS">Success</option>
          <option value="FAILED">Failed</option>
        </Select>
        <Select label="Team" value={teamId} onChange={(e) => setTeamId(e.target.value)}>
          <option value="">All teams</option>
          {teams.map((t) => <option key={t.team_id} value={t.team_id}>{t.name}</option>)}
        </Select>
        <Select label="Service" value={serviceId} onChange={(e) => setServiceId(e.target.value)}>
          <option value="">All services</option>
          {services.map((s) => <option key={s.service_id} value={s.service_id}>{s.service_name}</option>)}
        </Select>
      </div>

      <AuditTable filters={filters} exportable categories />
    </main>
  );
}
