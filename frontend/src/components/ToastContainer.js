/**
 * @file ToastContainer.js
 * @description The grant / revoke notifications.
 *
 * Three outcomes, not two: a request that changed some of its targets and not
 * others is neither a success nor a failure, and showing it as either is how
 * a half-finished revoke goes unnoticed. Amber means go and look.
 *
 * The per-target rows come from the connector itself and are read through
 * summarize(), which knows their real shape — see connectorResults.js for what
 * this component used to get wrong.
 *
 * A toast is a notification, not a record. Once the grants table lands
 * (DESIGN.md section 4) a failed target keeps its own row on the person's
 * access screen, and this stops being the only place a failure is ever shown.
 */

import React from "react";
import { X } from "lucide-react";
import { summarize } from "../utils/connectorResults";

const STYLES = {
  ok: {
    panel: "bg-[#f0fdf4] border-[#bbf7d0] text-[#15803d]",
    badge: "bg-[#16a34a]",
    glyph: "✓",
  },
  partial: {
    panel: "bg-[#fffbeb] border-[#fde68a] text-[#b45309]",
    badge: "bg-[#d97706]",
    glyph: "!",
  },
  failed: {
    panel: "bg-[#fdf2f2] border-[#fbc4c4] text-[#9b1c1c]",
    badge: "bg-[#d91e36]",
    glyph: "!",
  },
};

export default function ToastContainer({ toasts, onCloseToast }) {
  if (!toasts || toasts.length === 0) return null;

  return (
    <div className="fixed top-6 right-6 z-50 flex flex-col gap-3 max-w-[400px] w-full pointer-events-none">
      {toasts.map((toast) => {
        const { items, okCount, failCount, total, outcome } = summarize(toast.details);

        // The per-target rows are the evidence; the response's own flag is
        // only consulted when there are none to read.
        const state = outcome || (toast.success === true || toast.type === "success" ? "ok" : "failed");
        const style = STYLES[state];

        return (
          <div
            key={toast.id}
            className={`pointer-events-auto w-full p-5 rounded-[24px] border shadow-lg flex items-start gap-4 transition-all duration-300 transform translate-x-0 ${style.panel}`}
          >
            {/* Icon */}
            <div className="flex-shrink-0 mt-0.5">
              <div
                className={`w-8 h-8 rounded-full ${style.badge} text-white flex items-center justify-center font-bold text-[18px] select-none`}
              >
                {style.glyph}
              </div>
            </div>

            {/* Text Area */}
            <div className="flex-grow min-w-0">
              <h4 className="font-bold text-[15px] leading-tight text-gray-900">{toast.title}</h4>

              {state === "partial" ? (
                <p className="text-xs font-semibold text-[#b45309] mt-1">
                  {okCount} of {total} went through. {failCount} did not — see below.
                </p>
              ) : (
                (toast.subtitle || toast.message) && (
                  <p className="text-xs font-semibold text-gray-500 mt-1">{toast.subtitle || toast.message}</p>
                )
              )}

              {/* One row per target the connector touched. */}
              {items.length > 0 && (
                <div className="mt-3 space-y-1.5 border-t border-gray-100 pt-2.5">
                  {items.map((item, idx) => (
                    <div key={idx}>
                      <div className="flex items-center justify-between text-xs font-medium">
                        <span className="text-gray-700 truncate mr-2" title={item.label}>
                          {item.label}
                        </span>
                        <span className={item.ok ? "text-green-600 font-bold" : "text-red-600 font-bold"}>
                          {item.ok ? "Success" : "Failed"}
                        </span>
                      </div>
                      {/* The connector said why. Dropping it was why a failure
                          here told you nothing you could act on. */}
                      {!item.ok && item.error && (
                        <p className="m-0 mt-0.5 text-[11px] text-red-700/80 break-words">{item.error}</p>
                      )}
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
        );
      })}
    </div>
  );
}
