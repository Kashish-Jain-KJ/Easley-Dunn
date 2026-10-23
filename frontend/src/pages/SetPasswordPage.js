/**
 * @file SetPasswordPage.js
 * @description Where a one-time link lands: the person chooses a password, then
 * signs in with it. Serves both the invite to a new account and a password
 * reset, which differ only in their wording and their endpoint.
 *
 * Public, and deliberately outside the console frame — whoever opens an invite
 * has no account yet, and whoever opens a reset cannot get in. The link is the
 * only secret involved, so the page says who it is for and nothing else about
 * them.
 *
 * It is inside AuthProvider even so, because of one case: this browser may
 * already be signed in as somebody else, typically the admin who sent the
 * invite. "Go to sign in" would then drop them into that person's console
 * without a password prompt, which looks like the new account letting them
 * straight in. So the page names whose session it is and offers to end it.
 */

import React, { useCallback, useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { ShieldCheck, Lock, RefreshCw, CheckCircle2, AlertCircle, LogOut, Eye, EyeOff } from "lucide-react";
import { useAuth } from "../context/AuthContext";
import PasswordRules from "../components/PasswordRules";
import { MIN_LENGTH, passwordRules, passwordIsValid } from "../utils/passwordPolicy";

const API_URL = process.env.REACT_APP_API_URL || "http://localhost:5001";

// Everything that differs between the two links. Keeping it in one table is
// what stops the second mode drifting into a near-copy of the first.
const COPY = {
  invite: {
    path: "invite",
    heading: (p) => `Welcome, ${p.name}`,
    blurb: (p) => `Choose a password for ${p.email}.`,
    submit: "Set password",
    doneHeading: "Your password is set",
  },
  reset: {
    path: "reset",
    heading: () => "Choose a new password",
    blurb: (p) => `For ${p.email}.`,
    submit: "Reset password",
    doneHeading: "Your password has been reset",
  },
};

export default function SetPasswordPage({ mode = "invite" }) {
  const copy = COPY[mode];
  const { token } = useParams();
  const { user, logout, refreshAuth } = useAuth();
  const [person, setPerson] = useState(null);
  const [problem, setProblem] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [error, setError] = useState("");
  const [done, setDone] = useState(false);
  const [checking, setChecking] = useState(true);
  const [busy, setBusy] = useState(false);
  const [reveal, setReveal] = useState(false);

  const rules = passwordRules(password, confirm);

  const check = useCallback(async () => {
    try {
      const res = await fetch(`${API_URL}/auth/${copy.path}/${token}`);
      const data = await res.json();
      if (!res.ok || !data.success) throw new Error(data.message || "This link cannot be used.");
      setPerson(data.data);
    } catch (err) {
      setProblem(err.message);
    } finally {
      setChecking(false);
    }
  }, [token, copy.path]);

  useEffect(() => { check(); }, [check]);

  const submit = async (e) => {
    e.preventDefault();
    setBusy(true);
    setError("");
    try {
      const res = await fetch(`${API_URL}/auth/${copy.path}/${token}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ password }),
      });
      const data = await res.json();
      if (!res.ok || !data.success) throw new Error(data.message || "Could not set your password.");
      setDone(true);
      // Setting the password ended every session belonging to this account, so
      // a cached one may now be dead. Re-check before the panel below decides
      // what to offer, or it would name a session the server has dropped.
      refreshAuth();
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  };

  const card = "w-full max-w-[420px] bg-white border border-slate-200 rounded-2xl shadow-sm p-6";

  return (
    <div className="min-h-screen bg-slate-100 flex items-center justify-center p-6">
      <div className="flex flex-col items-center gap-4">
        <div className="flex items-center gap-2.5 text-slate-900">
          <span className="w-9 h-9 rounded-[10px] bg-blue-600 text-white flex items-center justify-center">
            <ShieldCheck className="w-5 h-5" />
          </span>
          <span className="font-bold">Easley-Dunn Cerberus</span>
        </div>

        {checking ? (
          <div className={`${card} text-center`}>
            <RefreshCw className="w-6 h-6 mx-auto text-blue-600 animate-spin" />
          </div>
        ) : problem ? (
          <div className={card}>
            <div className="flex items-start gap-2.5">
              <AlertCircle className="w-5 h-5 text-amber-600 flex-shrink-0 mt-0.5" />
              <div>
                <h1 className="m-0 text-base font-bold text-slate-900">This link cannot be used</h1>
                <p className="mt-1 mb-0 text-sm text-slate-600">{problem}</p>
              </div>
            </div>
          </div>
        ) : done ? (
          <div className={card}>
            <div className="flex items-start gap-2.5">
              <CheckCircle2 className="w-5 h-5 text-emerald-600 flex-shrink-0 mt-0.5" />
              <div>
                <h1 className="m-0 text-base font-bold text-slate-900">{copy.doneHeading}</h1>
                {user ? (
                  <>
                    <p className="mt-1 mb-3 text-sm text-slate-600">
                      This browser is already signed in as{" "}
                      <strong className="font-semibold text-slate-900">{user.email}</strong>. Sign
                      out to use {person.email} and the password you just chose.
                    </p>
                    <button
                      type="button"
                      onClick={logout}
                      className="inline-flex h-9 px-3.5 items-center gap-2 rounded-md bg-blue-600 hover:bg-blue-700 text-white text-sm font-semibold cursor-pointer"
                    >
                      <LogOut className="w-4 h-4" />
                      Sign out
                    </button>
                  </>
                ) : (
                  <>
                    <p className="mt-1 mb-3 text-sm text-slate-600">Sign in with {person.email} and the password you just chose.</p>
                    <Link to="/" className="inline-flex h-9 px-3.5 items-center rounded-md bg-blue-600 hover:bg-blue-700 text-white text-sm font-semibold no-underline">
                      Go to sign in
                    </Link>
                  </>
                )}
              </div>
            </div>
          </div>
        ) : (
          <form onSubmit={submit} className={`${card} flex flex-col gap-4`}>
            <div>
              <h1 className="m-0 text-base font-bold text-slate-900">{copy.heading(person)}</h1>
              <p className="mt-1 mb-0 text-sm text-slate-600">{copy.blurb(person)}</p>
            </div>

            <label className="flex flex-col gap-1 text-xs font-semibold uppercase text-slate-500">
              Password
              <span className="relative">
                <Lock className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
                <input
                  type={reveal ? "text" : "password"}
                  required
                  autoFocus
                  minLength={MIN_LENGTH}
                  aria-describedby="password-rules"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full h-9 pl-9 pr-10 bg-slate-50 border border-slate-200 rounded-lg text-sm font-normal normal-case text-slate-900 focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
                {/* Showing the password beats forcing a blind retype: the
                    person is alone with a one-time link, and a typo they
                    cannot see is the usual reason the second field fails. */}
                <button
                  type="button"
                  onClick={() => setReveal((v) => !v)}
                  aria-label={reveal ? "Hide password" : "Show password"}
                  aria-pressed={reveal}
                  className="absolute right-2 top-1.5 w-6 h-6 flex items-center justify-center rounded text-slate-500 hover:text-slate-900 cursor-pointer"
                >
                  {reveal ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </span>
            </label>

            <label className="flex flex-col gap-1 text-xs font-semibold uppercase text-slate-500">
              Confirm password
              <input
                type={reveal ? "text" : "password"}
                required
                aria-describedby="password-rules"
                value={confirm}
                onChange={(e) => setConfirm(e.target.value)}
                className="h-9 px-3 bg-slate-50 border border-slate-200 rounded-lg text-sm font-normal normal-case text-slate-900 focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </label>

            <PasswordRules id="password-rules" rules={rules} />

            {error && <p role="alert" className="m-0 px-3 py-2 rounded-lg bg-red-50 text-red-800 text-[13px]">{error}</p>}

            <button
              type="submit"
              disabled={busy || !passwordIsValid(password, confirm)}
              className="h-9 px-4 rounded-md bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white text-sm font-semibold flex items-center justify-center gap-2 cursor-pointer"
            >
              {busy && <RefreshCw className="w-4 h-4 animate-spin" />}
              {copy.submit}
            </button>
          </form>
        )}
      </div>
    </div>
  );
}
