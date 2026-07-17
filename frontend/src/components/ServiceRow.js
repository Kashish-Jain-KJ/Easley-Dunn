import React, { memo } from "react";
import { Checkbox } from "./ui/checkbox";
import { getServiceIcon } from "../utils/helpers";

function ServiceRow({ id, name, serviceCode, isSelected, onToggle, type }) {
  const IconComponent = getServiceIcon(serviceCode, name);

  const selectedClasses =
    type === "onboard"
      ? "bg-[#f0fdf4] border-[#bbf7d0] text-slate-800"
      : "bg-[#fdf2f2] border-[#fbc4c4] text-[#9b1c1c]";

  const iconClasses =
    type === "onboard"
      ? "size-5 flex-shrink-0 text-gray-400"
      : `size-5 flex-shrink-0 ${isSelected ? "text-[#d91e36]" : "text-gray-400"}`;

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
        className="size-5 rounded-[6px] border-gray-300 data-[state=checked]:bg-[#111827] data-[state=checked]:border-[#111827] data-[state=checked]:text-white transition-colors"
      />
      <IconComponent className={iconClasses} />
      <span className="font-semibold text-[15px]">{name}</span>
    </div>
  );
}

export default memo(ServiceRow);
