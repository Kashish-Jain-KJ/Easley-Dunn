import React, { useState, memo } from "react";
import {
  AlertTriangle,
  X,
  Copy,
  Check,
  Terminal,
  User,
  Server,
  Activity,
  Calendar
} from "lucide-react";

function formatDate(dateString) {
  if (!dateString) return "—";
  try {
    const d = new Date(dateString);
    if (isNaN(d.getTime())) return dateString;

    const monthNames = [
      "Jan", "Feb", "Mar", "Apr", "May", "Jun",
      "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"
    ];
    const month = monthNames[d.getMonth()];
    const day = d.getDate();

    let hours = d.getHours();
    const minutes = d.getMinutes().toString().padStart(2, "0");
    const seconds = d.getSeconds().toString().padStart(2, "0");
    const ampm = hours >= 12 ? "PM" : "AM";
    hours = hours % 12;
    hours = hours ? hours : 12;

    return `${month} ${day}, ${d.getFullYear()} at ${hours.toString().padStart(2, "0")}:${minutes}:${seconds} ${ampm}`;
  } catch (e) {
    return dateString;
  }
}

function ErrorDetailsModal({ isOpen, log, userName, onClose }) {
  const [copied, setCopied] = useState(false);

  if (!isOpen || !log) return null;

  const handleCopy = () => {
    const errorText = log.error_message || "No error message logged";
    navigator.clipboard.writeText(errorText);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-gray-900/60 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="relative w-full max-w-2xl bg-white rounded-3xl shadow-2xl overflow-hidden border border-gray-100 flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-5 border-b border-gray-100 bg-rose-50/50">
          <div className="flex items-center gap-3">
            <div className="size-10 rounded-2xl bg-rose-100 flex items-center justify-center text-rose-600 flex-shrink-0">
              <AlertTriangle className="size-5" />
            </div>
            <div>
              <h3 className="text-lg font-bold text-gray-900 leading-snug">
                Execution Error Details
              </h3>
              <p className="text-xs font-medium text-rose-700 mt-0.5">
                Log Entry #{log.id} • {log.service_name || "Service Action"}
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-2 rounded-xl text-gray-400 hover:text-gray-600 hover:bg-gray-200/60 transition-colors"
          >
            <X className="size-5" />
          </button>
        </div>

        {/* Content Body */}
        <div className="p-6 overflow-y-auto space-y-5 flex-1">
          {/* Metadata Grid */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 bg-gray-50/80 p-4 rounded-2xl border border-gray-100 text-xs">
            <div>
              <span className="text-gray-400 font-medium flex items-center gap-1.5 mb-1">
                <User className="size-3.5" /> User
              </span>
              <p className="font-semibold text-gray-900 truncate">
                {userName || `User ID #${log.user_id}`}
              </p>
            </div>

            <div>
              <span className="text-gray-400 font-medium flex items-center gap-1.5 mb-1">
                <Server className="size-3.5" /> Service
              </span>
              <p className="font-semibold text-gray-900 truncate">
                {log.service_name || "Unknown"}
              </p>
            </div>

            <div>
              <span className="text-gray-400 font-medium flex items-center gap-1.5 mb-1">
                <Activity className="size-3.5" /> Action Type
              </span>
              <span className={`inline-block font-bold text-[11px] px-2 py-0.5 rounded ${
                log.command_type === "ONBOARD"
                  ? "bg-emerald-100 text-emerald-800"
                  : "bg-amber-100 text-amber-800"
              }`}>
                {log.command_type}
              </span>
            </div>

            <div>
              <span className="text-gray-400 font-medium flex items-center gap-1.5 mb-1">
                <Calendar className="size-3.5" /> Timestamp
              </span>
              <p className="font-semibold text-gray-900 text-[11px] truncate">
                {formatDate(log.created_at)}
              </p>
            </div>
          </div>

          {/* Code Block / Error Payload */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-bold text-gray-700 flex items-center gap-1.5">
                <Terminal className="size-4 text-rose-600" /> Error Payload / Stack Trace
              </span>
              <button
                onClick={handleCopy}
                className="inline-flex items-center gap-1.5 px-3 py-1 text-xs font-semibold text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-xl transition-colors"
              >
                {copied ? (
                  <>
                    <Check className="size-3.5 text-emerald-600" />
                    <span className="text-emerald-700">Copied!</span>
                  </>
                ) : (
                  <>
                    <Copy className="size-3.5 text-gray-500" />
                    <span>Copy Error</span>
                  </>
                )}
              </button>
            </div>

            <pre className="w-full p-4 bg-slate-900 text-rose-300 font-mono text-xs rounded-2xl overflow-x-auto whitespace-pre-wrap break-words border border-slate-800 leading-relaxed max-h-60 shadow-inner">
              {log.error_message || "No specific error payload recorded for this run."}
            </pre>
          </div>
        </div>

        {/* Footer Actions */}
        <div className="flex items-center justify-end px-6 py-4 border-t border-gray-100 bg-gray-50/50">
          <button
            onClick={onClose}
            className="px-5 py-2 text-xs font-bold text-gray-700 bg-white border border-gray-200 hover:bg-gray-100 rounded-xl shadow-sm transition-colors"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}

export default memo(ErrorDetailsModal);
