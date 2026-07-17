import React from "react";
import { X } from "lucide-react";

export default function ToastContainer({ toasts, onCloseToast }) {
  if (!toasts || toasts.length === 0) return null;

  return (
    <div className="fixed top-6 right-6 z-50 flex flex-col gap-3 max-w-[400px] w-full pointer-events-none">
      {toasts.map((toast) => (
        <div
          key={toast.id}
          className={`pointer-events-auto w-full p-5 rounded-[24px] border shadow-lg flex items-start gap-4 transition-all duration-300 transform translate-x-0 ${
            toast.success
              ? "bg-[#f0fdf4] border-[#bbf7d0] text-[#15803d]"
              : "bg-[#fdf2f2] border-[#fbc4c4] text-[#9b1c1c]"
          }`}
        >
          {/* Icon */}
          <div className="flex-shrink-0 mt-0.5">
            {toast.success ? (
              <div className="w-8 h-8 rounded-full bg-[#16a34a] text-white flex items-center justify-center font-bold text-[18px] select-none">
                ✓
              </div>
            ) : (
              <div className="w-8 h-8 rounded-full bg-[#d91e36] text-white flex items-center justify-center font-bold text-[18px] select-none">
                !
              </div>
            )}
          </div>

          {/* Text Area */}
          <div className="flex-grow min-w-0">
            <h4 className="font-bold text-[15px] leading-tight text-gray-900">
              {toast.title}
            </h4>
            <p className="text-xs font-semibold text-gray-500 mt-1">
              {toast.subtitle}
            </p>

            {/* Service Details List */}
            {toast.details && toast.details.length > 0 && (
              <div className="mt-3 space-y-1.5 border-t border-gray-100 pt-2.5">
                {toast.details.map((detail, idx) => (
                  <div key={idx} className="flex items-center justify-between text-xs font-medium">
                    <span className="text-gray-700 truncate mr-2">{detail.name}</span>
                    <span className={detail.success ? "text-green-600 font-bold" : "text-red-600 font-bold"}>
                      {detail.success ? "Success" : "Failed"}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Close Button */}
          <button
            onClick={() => onCloseToast(toast.id)}
            className="flex-shrink-0 text-gray-400 hover:text-gray-600 transition-colors mt-0.5"
          >
            <X className="size-4" />
          </button>
        </div>
      ))}
    </div>
  );
}
