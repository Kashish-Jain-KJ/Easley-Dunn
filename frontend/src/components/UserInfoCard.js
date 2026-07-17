import React, { memo } from "react";
import { Mail } from "lucide-react";
import { Card } from "./ui/card";
import { getAvatarColor, getInitials } from "../utils/helpers";

function UserInfoCard({ selectedUser }) {
  if (!selectedUser) return null;

  return (
    <Card className="relative overflow-hidden border border-gray-200/80 shadow-md rounded-3xl bg-white p-6">
      <div className="absolute top-0 left-0 right-0 h-1.5 bg-gradient-to-r from-emerald-400 via-cyan-500 to-indigo-500" />
      <div className="flex items-center gap-5">
        <div
          className={`size-16 rounded-full flex items-center justify-center font-bold text-xl flex-shrink-0 ${getAvatarColor(
            selectedUser.name
          )}`}
        >
          {getInitials(selectedUser.name)}
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2.5 flex-wrap">
            <h2 className="text-xl font-bold text-gray-900 leading-tight">
              {selectedUser.name}
            </h2>
            <div
              className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold border ${
                selectedUser.is_active
                  ? "bg-[#f0fdf4] border-[#bbf7d0] text-[#16a34a]"
                  : "bg-[#fdf2f2] border-[#fbc4c4] text-[#dc2626]"
              }`}
            >
              {selectedUser.is_active ? (
                <>
                  <svg
                    className="size-3.5 text-[#16a34a] flex-shrink-0"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                    strokeWidth="3"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"
                    />
                  </svg>
                  Active
                </>
              ) : (
                <>
                  <svg
                    className="size-3.5 text-[#dc2626] flex-shrink-0"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                    strokeWidth="3"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      d="M10 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2m7-2a9 9 0 11-18 0 9 9 0 0118 0z"
                    />
                  </svg>
                  Inactive
                </>
              )}
            </div>
          </div>
          <div className="flex items-center gap-2 text-sm text-gray-600 mt-2">
            <Mail className="size-4 text-gray-400 flex-shrink-0" />
            <span className="truncate">{selectedUser.email}</span>
          </div>
        </div>
      </div>
    </Card>
  );
}

export default memo(UserInfoCard);
