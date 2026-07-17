import React from "react";
import { X, UserPlus, UserMinus } from "lucide-react";
import { Button } from "./ui/button";

export default function ConfirmModal({
  isOpen,
  type,
  isAutomate,
  permissions,
  userName,
  onClose,
  onConfirm
}) {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm transition-opacity animate-in fade-in duration-200">
      <div className="relative w-full max-w-[440px] bg-white rounded-[32px] p-8 shadow-2xl border border-gray-100 flex flex-col gap-6 animate-in zoom-in-95 duration-200">
        {/* Close button (X) */}
        <button
          onClick={onClose}
          className="absolute top-6 right-6 text-gray-400 hover:text-gray-600 transition-colors"
        >
          <X className="size-5" />
        </button>

        {/* Top Icon Badge */}
        <div className="flex justify-start">
          <div
            className={`p-4 rounded-[22px] flex items-center justify-center shadow-xs ${
              type === "onboard" ? "bg-[#e6f6ee] text-[#10a353]" : "bg-[#fdebeb] text-[#d91e36]"
            }`}
          >
            {type === "onboard" ? <UserPlus className="size-7" /> : <UserMinus className="size-7" />}
          </div>
        </div>

        {/* Title & Subtitle */}
        <div>
          <h3 className="text-[22px] font-bold text-gray-900 leading-tight">
            {isAutomate ? "Automated" : "Manual"} {type === "onboard" ? "Onboarding" : "Offboarding"}
          </h3>
          <p className="text-[#8e98a8] text-base font-medium mt-2">
            {type === "onboard" ? "Granting" : "Revoking"}{" "}
            <span className="font-bold text-gray-900">{permissions?.length || 0} permissions</span>{" "}
            {type === "onboard" ? "to" : "from"}{" "}
            <span className="font-bold text-gray-900">{userName}</span>
          </p>
        </div>

        {/* Permissions List container */}
        <div className="bg-[#f8f9fa] rounded-2xl p-5 border border-gray-100 max-h-[220px] overflow-y-auto">
          <ul className="space-y-3">
            {permissions?.map((name, idx) => (
              <li key={idx} className="flex items-center gap-3 text-[15px] font-semibold text-gray-700">
                <span
                  className={`w-2 h-2 rounded-full ${
                    type === "onboard" ? "bg-[#10a353]" : "bg-[#d91e36]"
                  }`}
                />
                {name}
              </li>
            ))}
          </ul>
        </div>

        {/* Action Buttons */}
        <div className="flex gap-4">
          <Button
            onClick={onClose}
            className="flex-1 bg-white hover:bg-gray-50 border border-gray-200 text-gray-900 font-semibold rounded-2xl py-6 text-base shadow-xs transition-colors"
          >
            Cancel
          </Button>
          <Button
            onClick={onConfirm}
            className={`flex-1 text-white font-semibold rounded-2xl py-6 text-base shadow-xs transition-colors ${
              type === "onboard" ? "bg-[#10a353] hover:bg-[#0d8c47]" : "bg-[#d91e36] hover:bg-[#c0152b]"
            }`}
          >
            Confirm
          </Button>
        </div>
      </div>
    </div>
  );
}
