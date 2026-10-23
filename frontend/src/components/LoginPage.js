import React, { useState } from "react";
import { useAuth } from "../context/AuthContext";
import { ShieldCheck, Mail, Lock, Eye, EyeOff, AlertCircle, RefreshCw, MailCheck, ArrowLeft } from "lucide-react";

const API_URL = process.env.REACT_APP_API_URL || "http://localhost:5001";

export default function LoginPage() {
  const { login, error, setError, sessionExpired } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  // Asking for a reset is a step on this page, not a destination: the address
  // already typed carries over, and there is nowhere else to go afterwards.
  const [forgot, setForgot] = useState(false);
  const [sent, setSent] = useState("");

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!email || !password) return;

    setIsSubmitting(true);
    setError(null);
    const result = await login(email, password);
    setIsSubmitting(false);

    if (!result.success) {
      // Error handled by AuthContext
    }
  };

  const requestReset = async (e) => {
    e.preventDefault();
    if (!email) return;
    setIsSubmitting(true);
    setError(null);
    try {
      const res = await fetch(`${API_URL}/auth/forgot-password`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
      });
      const data = await res.json();
      // The server answers the same way whether or not the address has an
      // account, so this is shown as-is: second-guessing it here would give
      // away exactly what the endpoint is careful not to.
      if (!res.ok) throw new Error(data.message || "Could not send a reset link.");
      setSent(data.message);
    } catch (err) {
      setError(err.message);
    } finally {
      setIsSubmitting(false);
    }
  };

  const backToSignIn = () => {
    setForgot(false);
    setSent("");
    setError(null);
  };

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col justify-center py-12 sm:px-6 lg:px-8">
      <div className="sm:mx-auto sm:w-full sm:max-w-md">
        <div className="flex justify-center">
          <div className="w-16 h-16 bg-blue-600 rounded-2xl flex items-center justify-center shadow-lg shadow-blue-500/20">
            <ShieldCheck className="w-10 h-10 text-white" />
          </div>
        </div>
        <h2 className="mt-6 text-center text-3xl font-extrabold text-slate-900 tracking-tight">
          Cerberus Access Management
        </h2>
        <p className="mt-2 text-center text-sm text-slate-600">
          Sign in to access your authorized onboarding console
        </p>
      </div>

      <div className="mt-8 sm:mx-auto sm:w-full sm:max-w-md">
        <div className="bg-white py-8 px-4 shadow-xl shadow-slate-200/50 sm:rounded-xl sm:px-10 border border-slate-100">
          {sessionExpired && !error && (
            <div className="mb-6 rounded-lg bg-amber-50 p-4 border border-amber-200">
              <div className="flex">
                <div className="flex-shrink-0">
                  <AlertCircle className="h-5 w-5 text-amber-500" />
                </div>
                <div className="ml-3">
                  <h3 className="text-sm font-medium text-amber-800">Your session expired</h3>
                  <div className="mt-1 text-sm text-amber-700">
                    You were signed out for security. Please log in again to continue.
                  </div>
                </div>
              </div>
            </div>
          )}

          {error && (
            <div className="mb-6 rounded-lg bg-red-50 p-4 border border-red-200">
              <div className="flex">
                <div className="flex-shrink-0">
                  <AlertCircle className="h-5 w-5 text-red-500" />
                </div>
                <div className="ml-3">
                  <h3 className="text-sm font-medium text-red-800">Authentication Failed</h3>
                  <div className="mt-1 text-sm text-red-700">{error}</div>
                </div>
              </div>
            </div>
          )}

          {sent ? (
            <div className="space-y-5">
              <div className="rounded-lg bg-blue-50 p-4 border border-blue-200">
                <div className="flex">
                  <MailCheck className="h-5 w-5 text-blue-500 flex-shrink-0" />
                  <div className="ml-3 text-sm text-blue-900">{sent}</div>
                </div>
              </div>
              <button
                type="button"
                onClick={backToSignIn}
                className="w-full py-2.5 border border-slate-300 bg-white hover:bg-slate-50 text-slate-700 font-medium text-sm rounded-lg flex items-center justify-center gap-2 transition-all cursor-pointer"
              >
                <ArrowLeft className="w-4 h-4" />
                Back to sign in
              </button>
            </div>
          ) : (
          <form onSubmit={forgot ? requestReset : handleSubmit} className="space-y-5">
            {forgot && (
              <p className="m-0 text-sm text-slate-600">
                Enter your email address and we&apos;ll send you a link to choose a new password.
                The link lasts an hour.
              </p>
            )}
            <div>
              <label className="block text-xs font-semibold uppercase text-slate-600 mb-1">
                Email Address
              </label>
              <div className="relative">
                <input
                  type="email"
                  required
                  placeholder="user@example.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full pl-10 pr-3 py-2.5 text-sm bg-slate-50 border border-slate-200 rounded-lg focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all"
                />
                <Mail className="w-4 h-4 text-slate-400 absolute left-3.5 top-3" />
              </div>
            </div>

            <div className={forgot ? "hidden" : ""}>
              <div className="flex items-baseline justify-between mb-1">
                <label className="block text-xs font-semibold uppercase text-slate-600">
                  Password
                </label>
                <button
                  type="button"
                  onClick={() => { setForgot(true); setError(null); }}
                  className="text-xs font-medium text-blue-600 hover:text-blue-700 cursor-pointer bg-transparent border-0 p-0"
                >
                  Forgot password?
                </button>
              </div>
              <div className="relative">
                <input
                  type={showPassword ? "text" : "password"}
                  required={!forgot}
                  placeholder="••••••••••••"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full pl-10 pr-10 py-2.5 text-sm bg-slate-50 border border-slate-200 rounded-lg focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all"
                />
                <Lock className="w-4 h-4 text-slate-400 absolute left-3.5 top-3" />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3.5 top-3 text-slate-400 hover:text-slate-600"
                >
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            <button
              type="submit"
              disabled={isSubmitting || !email || (!forgot && !password)}
              className="w-full py-2.5 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white font-medium text-sm rounded-lg shadow-sm shadow-blue-500/20 flex items-center justify-center gap-2 transition-all cursor-pointer"
            >
              {isSubmitting ? (
                <RefreshCw className="w-4 h-4 animate-spin" />
              ) : forgot ? (
                "Send reset link"
              ) : (
                "Sign In to Cerberus"
              )}
            </button>

            {forgot && (
              <button
                type="button"
                onClick={backToSignIn}
                className="w-full py-2.5 border border-slate-300 bg-white hover:bg-slate-50 text-slate-700 font-medium text-sm rounded-lg flex items-center justify-center gap-2 transition-all cursor-pointer"
              >
                <ArrowLeft className="w-4 h-4" />
                Back to sign in
              </button>
            )}
          </form>
          )}
        </div>
      </div>
    </div>
  );
}
