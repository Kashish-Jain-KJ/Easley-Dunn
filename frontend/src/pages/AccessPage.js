/**
 * @file AccessPage.js
 * @description What the signed-in person can get into, who gave it to them,
 * and when they last signed in.
 *
 * This absorbed the Activity tab. A student with three services produced a
 * paginated log that was almost entirely "Signed in · Success", with the two
 * events they cared about buried in it — an audit log is a tool for
 * reconstructing what happened across many people, which is not this. The part
 * worth keeping is on each row: who granted it and when.
 *
 * Read-only by design for now: nothing a student can do about their own access
 * is built yet. When access requests exist, this is where asking starts and a
 * Requests tab takes the slot Activity used to hold.
 */

import React, { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { RefreshCw, KeyRound } from "lucide-react";
import * as userApi from "../api/user";

/** The level on a grant, when the connector recorded one. */
function Level({ roleName }) {
  if (!roleName) return <span className="text-slate-400">—</span>;
  return (
    <span className="inline-block px-2 py-0.5 rounded-md bg-slate-100 text-slate-700 text-xs font-medium">
      {roleName}
    </span>
  );
}

/** "by Prof. Easley, 3 Oct" — or a dash when the log predates the grant. */
function Granted({ at, by }) {
  if (!at && !by) return <span className="text-slate-400">—</span>;
  return (
    <span className="text-slate-600" title={at ? new Date(at).toLocaleString() : ""}>
      {by && `by ${by}`}
      {by && at && ", "}
      {at && new Date(at).toLocaleDateString()}
    </span>
  );
}

export default function AccessPage() {
  const [access, setAccess] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    let cancelled = false;

    userApi
      .getAccess()
      .then(({ data }) => {
        if (!cancelled) setAccess(data);
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

  return (
    <main className="flex-1 min-h-0 overflow-y-auto scroll-soft px-6 py-4">
      {error && (
        <div className="mb-3 px-3 py-2.5 rounded-xl bg-red-50 border border-red-200 text-[13px] text-red-700">
          {error}
        </div>
      )}

      <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
        <table className="w-full text-left text-[13px]">
          <thead>
            <tr className="bg-slate-50 border-b border-slate-200 text-[11px] uppercase font-semibold tracking-wide text-slate-500">
              <th className="py-2 px-3">Service</th>
              <th className="py-2 px-3">Level</th>
              <th className="py-2 px-3">Granted</th>
              <th className="py-2 px-3">Account used</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {isLoading ? (
              <tr>
                <td colSpan="4" className="py-10 text-center text-slate-500">
                  <RefreshCw className="w-4 h-4 animate-spin inline-block mr-2 align-text-bottom" />
                  Loading your access…
                </td>
              </tr>
            ) : access.length === 0 ? (
              <tr>
                <td colSpan="4" className="py-12 text-center">
                  <KeyRound className="w-7 h-7 text-slate-300 mx-auto mb-2" />
                  <p className="m-0 font-semibold text-slate-900">You don't have access to anything yet</p>
                  <p className="mt-1 mb-0 text-slate-600">
                    Access is granted by the admin. Your{" "}
                    <Link to="/team" className="text-blue-700 hover:underline">
                      team
                    </Link>{" "}
                    page shows who to ask.
                  </p>
                </td>
              </tr>
            ) : (
              access.map((a) => (
                <tr key={a.access_id} className="hover:bg-slate-50/80">
                  <td className="py-2 px-3 font-medium text-slate-900">
                    {a.service?.service_name || "Unknown service"}
                    {a.service && !a.service.is_active && (
                      <span className="ml-2 text-xs font-normal text-amber-700">service inactive</span>
                    )}
                  </td>
                  <td className="py-2 px-3">
                    <Level roleName={a.role_name} />
                  </td>
                  <td className="py-2 px-3 whitespace-nowrap">
                    <Granted at={a.grantedAt} by={a.grantedBy} />
                  </td>
                  <td className="py-2 px-3 text-slate-600 break-all">
                    {a.external_user_identifier || a.external_account_identifier || (
                      <span className="text-slate-400">—</span>
                    )}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {!isLoading && access.length > 0 && (
        <p className="mt-2 text-xs text-slate-500">
          {access.length} {access.length === 1 ? "service" : "services"}. Need something that isn't here? Your{" "}
          <Link to="/team" className="text-blue-700 hover:underline">
            team
          </Link>{" "}
          page shows who to ask.
        </p>
      )}

    </main>
  );
}
