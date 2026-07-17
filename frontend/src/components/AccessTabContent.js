import React, { memo } from "react";
import { Loader2 } from "lucide-react";
import { Button } from "./ui/button";
import ServiceRow from "./ServiceRow";

function AccessTabContent({
  items,
  selectedSet,
  onToggle,
  onActionClick,
  actionText,
  actionIcon: ActionIcon,
  actionColor,
  isLoading,
  loadingText,
  emptyText,
  type,
  rowKey
}) {
  return (
    <div className="mt-4 flex-grow flex flex-col justify-between">
      <div>
        <p className="text-[#8e98a8] text-sm mb-3 font-medium">Select permissions</p>
        <div className="space-y-2.5 max-h-[350px] overflow-y-auto pr-1">
          {items.length > 0 ? (
            items.map((item) => {
              // For onboard: item is the service itself
              // For offboard: item is the access record which has a nested service object
              const id = item[rowKey];
              const name = type === "onboard" ? item.service_name : (item.service?.service_name || "Unknown Service");
              const serviceCode = type === "onboard" ? item.service_code : (item.service?.service_code || "");
              const isSelected = selectedSet.has(name);

              return (
                <ServiceRow
                  key={id}
                  id={id}
                  name={name}
                  serviceCode={serviceCode}
                  isSelected={isSelected}
                  onToggle={onToggle}
                  type={type}
                />
              );
            })
          ) : (
            <div className="py-12 text-center">
              <p className="text-gray-400 text-sm">{emptyText}</p>
            </div>
          )}
        </div>
      </div>

      <div className="pt-4 mt-4 border-t border-gray-100">
        <Button
          onClick={onActionClick}
          className={`w-full ${actionColor} text-white font-semibold rounded-xl py-6 text-base shadow-xs flex items-center justify-center gap-2 transition-colors`}
          disabled={selectedSet.size === 0 || isLoading}
        >
          {isLoading ? (
            <>
              <Loader2 className="animate-spin mr-2 size-5" />
              {loadingText}
            </>
          ) : (
            <>
              <ActionIcon className="size-5" />
              {actionText} • {selectedSet.size} selected
            </>
          )}
        </Button>
      </div>
    </div>
  );
}

export default memo(AccessTabContent);
