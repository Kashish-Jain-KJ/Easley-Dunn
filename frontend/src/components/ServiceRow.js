import React, { memo } from "react";
import { Checkbox } from "./ui/checkbox";
import { getServiceIcon } from "../utils/helpers";

function ServiceRow({ id, name, serviceCode, isSelected, onToggle, type, pendingConfirmation }) {
  const IconComponent = getServiceIcon(serviceCode, name);

  const selectedClasses =
    type === "onboard"
      ? "bg-[#f0fdf4] dark:bg-[#04160b] border-[#bbf7d0] dark:border-[#14532d] text-slate-800"
      : "bg-[#fdf2f2] dark:bg-[#1a0607] border-[#fbc4c4] dark:border-[#5c1f1f] text-[#9b1c1c] dark:text-[#fca5a5]";

  const iconClasses =
    type === "onboard"
      ? "size-5 flex-shrink-0 text-gray-400"
      : `size-5 flex-shrink-0 ${isSelected ? "text-[#d91e36] dark:text-[#f87171]" : "text-gray-400"}`;

  return (
    <div
      onClick={() => onToggle(name)}
      className={`flex items-center gap-3.5 px-4 py-3 rounded-2xl border transition-all duration-150 cursor-pointer select-none ${
        isSelected ? selectedClasses : "bg-white border-gray-200 text-gray-700 hover:border-gray-300"
      }`}
    >
      <Checkbox
        id={`${type}-checkbox-${id}`}
        checked={isSelected}
        onClick={(e) => e.stopPropagation()}
        onCheckedChange={() => onToggle(name)}
        className="size-5 rounded-[6px] border-gray-300 data-[state=checked]:bg-[#111827] data-[state=checked]:border-[#111827] data-[state=checked]:text-white dark:data-[state=checked]:bg-[#f2f2f2] dark:data-[state=checked]:border-[#f2f2f2] dark:data-[state=checked]:text-black transition-colors"
      />
      <IconComponent className={iconClasses} />
      <span className="font-semibold text-[15px]">{name}</span>
      {pendingConfirmation && (
        <span className="ml-auto flex-shrink-0 text-[11px] font-semibold px-2 py-0.5 rounded-full bg-amber-100 text-amber-700 border border-amber-200">
          Pending confirmation
        </span>
      )}
    </div>
  );
}

export default memo(ServiceRow);
