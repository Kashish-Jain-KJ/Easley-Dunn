import React, { memo } from "react";
import { Users } from "lucide-react";

function Header({ activeCount, inactiveCount }) {
  return (
    <div className="mb-8 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
      <div>
        <h1 className="text-3xl font-bold text-gray-900">Easley-Dunn Access Management</h1>
        <p className="mt-2 text-gray-600">Manage user's onboarding and offboarding</p>
      </div>
      <div className="flex items-center">
        <div className="inline-flex items-center gap-2 px-3.5 py-1.5 bg-[#f1f5f9] text-[#64748b] rounded-full font-medium text-sm select-none border border-slate-100">
          <Users className="size-4.5 text-[#64748b]" />
          <span>{activeCount} active</span>
          <span className="text-slate-300">·</span>
          <span>{inactiveCount} inactive</span>
        </div>
      </div>
    </div>
  );
}

export default memo(Header);
