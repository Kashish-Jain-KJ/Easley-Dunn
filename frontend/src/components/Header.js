import React, { memo } from "react";
import { Users, LogOut, ShieldCheck } from "lucide-react";
import { useAuth } from "../context/AuthContext";

function Header({ activeCount, inactiveCount }) {
  const { user, role, logout } = useAuth();

  const getRoleBadgeStyle = (r) => {
    switch (r) {
      case "ADMIN":
        return "bg-purple-100 text-purple-800 border-purple-200";
      case "MANAGER":
        return "bg-blue-100 text-blue-800 border-blue-200";
      case "OPERATOR":
        return "bg-emerald-100 text-emerald-800 border-emerald-200";
      default:
        return "bg-slate-100 text-slate-600 border-slate-200";
    }
  };

  return (
    <div className="mb-8 flex flex-col md:flex-row md:items-center md:justify-between gap-4 bg-white p-6 rounded-xl border border-slate-200 shadow-sm">
      <div>
        <div className="flex items-center gap-3">
          <h1 className="text-2xl font-bold text-slate-900 tracking-tight">Easley-Dunn Access Management</h1>
          {role && (
            <span
              className={`inline-flex items-center gap-1 px-3 py-0.5 rounded-full text-xs font-bold border uppercase tracking-wider ${getRoleBadgeStyle(
                role
              )}`}
            >
              <ShieldCheck className="w-3.5 h-3.5" />
              {role}
            </span>
          )}
        </div>
        <p className="mt-1 text-sm text-slate-500">
          Cerberus Automated Onboarding & Offboarding Console
        </p>
      </div>

      <div className="flex items-center gap-4">
        <div className="hidden sm:inline-flex items-center gap-2 px-3.5 py-1.5 bg-slate-100 text-slate-600 rounded-full font-medium text-xs select-none border border-slate-200">
          <Users className="w-4 h-4 text-slate-500" />
          <span>{activeCount} active</span>
          <span className="text-slate-300">·</span>
          <span>{inactiveCount} inactive</span>
        </div>

        {user && (
          <div className="flex items-center gap-3 pl-2 border-l border-slate-200">
            <div className="text-right text-xs">
              <div className="font-semibold text-slate-800">{user.name || user.email}</div>
              <div className="text-slate-400 truncate max-w-[160px]">{user.email}</div>
            </div>
            <button
              onClick={logout}
              className="p-2 text-slate-500 hover:text-red-600 hover:bg-red-50 rounded-lg border border-slate-200 hover:border-red-200 transition-all cursor-pointer"
              title="Log out of Cerberus"
            >
              <LogOut className="w-4 h-4" />
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

export default memo(Header);
