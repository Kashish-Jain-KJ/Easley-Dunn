import React, { useState, useMemo, memo } from "react";
import {
  Clock,
  Search,
  CheckCircle2,
  XCircle,
  AlertCircle,
  ChevronLeft,
  ChevronRight,
  UserPlus,
  UserMinus,
  ExternalLink
} from "lucide-react";
import { Card, CardHeader, CardTitle, CardContent } from "./ui/card";
import { Input } from "./ui/input";
import ErrorDetailsModal from "./ErrorDetailsModal";

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

    return `${month} ${day}, ${hours.toString().padStart(2, "0")}:${minutes}:${seconds} ${ampm}`;
  } catch (e) {
    return dateString;
  }
}

function ActivityLogsCard({ selectedUser, logs = [], isLoading = false, summary = null }) {
  const [searchQuery, setSearchQuery] = useState("");
  const [typeFilter, setTypeFilter] = useState("ALL"); // ALL, ONBOARD, OFFBOARD
  const [statusFilter, setStatusFilter] = useState("ALL"); // ALL, SUCCESS, FAILED
  const [currentPage, setCurrentPage] = useState(1);
  const [selectedErrorLog, setSelectedErrorLog] = useState(null);
  const itemsPerPage = 10;

  // Calculate summary counts if not provided by backend
  const computedSummary = useMemo(() => {
    if (summary) return summary;
    const total = logs.length;
    const success = logs.filter(l => l.status === "SUCCESS").length;
    const failed = logs.filter(l => l.status === "FAILED").length;
    return { total, success, failed };
  }, [logs, summary]);

  // Filter logs based on search query, type filter, status filter
  const filteredLogs = useMemo(() => {
    return logs.filter(log => {
      // Type filter
      if (typeFilter !== "ALL" && log.command_type !== typeFilter) {
        return false;
      }
      // Status filter
      if (statusFilter !== "ALL" && log.status !== statusFilter) {
        return false;
      }
      // Search query
      if (searchQuery.trim() !== "") {
        const q = searchQuery.toLowerCase();
        const serviceName = (log.service_name || "").toLowerCase();
        const serviceCode = (log.service_code || "").toLowerCase();
        const commandType = (log.command_type || "").toLowerCase();
        const status = (log.status || "").toLowerCase();
        const errorMsg = (log.error_message || "").toLowerCase();
        const performedBy = (log.performed_by || "").toLowerCase();
        const logId = String(log.id);

        const matches =
          serviceName.includes(q) ||
          serviceCode.includes(q) ||
          commandType.includes(q) ||
          status.includes(q) ||
          errorMsg.includes(q) ||
          performedBy.includes(q) ||
          logId.includes(q);

        if (!matches) return false;
      }
      return true;
    });
  }, [logs, typeFilter, statusFilter, searchQuery]);

  // Pagination calculation
  const totalPages = Math.max(1, Math.ceil(filteredLogs.length / itemsPerPage));
  const paginatedLogs = useMemo(() => {
    const start = (currentPage - 1) * itemsPerPage;
    return filteredLogs.slice(start, start + itemsPerPage);
  }, [filteredLogs, currentPage, itemsPerPage]);

  const handlePageChange = (newPage) => {
    if (newPage >= 1 && newPage <= totalPages) {
      setCurrentPage(newPage);
    }
  };

  if (!selectedUser) return null;

  return (
    <Card className="border border-gray-200/80 shadow-md rounded-3xl overflow-hidden bg-white mt-6">
      {/* Top Header */}
      <CardHeader className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-4 border-b border-gray-100 px-6 pt-6">
        <div className="flex items-center gap-3">
          <div className="size-10 rounded-2xl bg-gray-100 flex items-center justify-center text-gray-600 flex-shrink-0">
            <Clock className="size-5 text-gray-600" />
          </div>
          <div>
            <CardTitle className="text-xl font-bold text-gray-900 leading-tight">
              Activity Logs {selectedUser ? `— ${selectedUser.name}` : ""}
            </CardTitle>
            <p className="text-xs font-semibold text-gray-500 mt-1">
              <span className="text-gray-700">{computedSummary.total} total</span>
              {" • "}
              <span className="text-[#065f46]">{computedSummary.success} success</span>
              {" • "}
              <span className="text-rose-600">{computedSummary.failed} failed</span>
            </p>
          </div>
        </div>

        {/* Filters and Search Bar */}
        <div className="flex flex-wrap items-center gap-3">
          {/* Search Box */}
          <div className="relative min-w-[200px] flex-1 md:flex-none">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-gray-400" />
            <Input
              type="text"
              placeholder="Search logs..."
              value={searchQuery}
              onChange={(e) => {
                setSearchQuery(e.target.value);
                setCurrentPage(1);
              }}
              className="pl-9 h-9 text-xs bg-gray-50/80 border-gray-200 rounded-xl focus:bg-white"
            />
          </div>

          {/* Type Filter Pills */}
          <div className="inline-flex p-1 bg-gray-100/80 rounded-xl text-xs font-semibold text-gray-600">
            <button
              onClick={() => { setTypeFilter("ALL"); setCurrentPage(1); }}
              className={`px-2.5 py-1 rounded-lg transition-colors ${typeFilter === "ALL" ? "bg-white text-gray-900 shadow-sm" : "hover:text-gray-900"}`}
            >
              All Types
            </button>
            <button
              onClick={() => { setTypeFilter("ONBOARD"); setCurrentPage(1); }}
              className={`px-2.5 py-1 rounded-lg transition-colors ${typeFilter === "ONBOARD" ? "bg-white text-emerald-700 shadow-sm" : "hover:text-gray-900"}`}
            >
              ONBOARD
            </button>
            <button
              onClick={() => { setTypeFilter("OFFBOARD"); setCurrentPage(1); }}
              className={`px-2.5 py-1 rounded-lg transition-colors ${typeFilter === "OFFBOARD" ? "bg-white text-amber-700 shadow-sm" : "hover:text-gray-900"}`}
            >
              OFFBOARD
            </button>
          </div>

          {/* Status Filter Pills */}
          <div className="inline-flex p-1 bg-gray-100/80 rounded-xl text-xs font-semibold text-gray-600">
            <button
              onClick={() => { setStatusFilter("ALL"); setCurrentPage(1); }}
              className={`px-2.5 py-1 rounded-lg transition-colors ${statusFilter === "ALL" ? "bg-white text-gray-900 shadow-sm" : "hover:text-gray-900"}`}
            >
              All Status
            </button>
            <button
              onClick={() => { setStatusFilter("SUCCESS"); setCurrentPage(1); }}
              className={`px-2.5 py-1 rounded-lg transition-colors ${statusFilter === "SUCCESS" ? "bg-white text-emerald-700 shadow-sm" : "hover:text-gray-900"}`}
            >
              SUCCESS
            </button>
            <button
              onClick={() => { setStatusFilter("FAILED"); setCurrentPage(1); }}
              className={`px-2.5 py-1 rounded-lg transition-colors ${statusFilter === "FAILED" ? "bg-white text-rose-700 shadow-sm" : "hover:text-gray-900"}`}
            >
              FAILED
            </button>
          </div>
        </div>
      </CardHeader>

      {/* Table Content */}
      <CardContent className="p-0">
        {!selectedUser ? (
          <div className="p-12 text-center text-gray-400">
            <Clock className="size-10 mx-auto text-gray-300 mb-3" />
            <p className="font-semibold text-gray-600">No user selected</p>
            <p className="text-sm text-gray-400 mt-1">Select a user from the list above to view their activity logs.</p>
          </div>
        ) : isLoading ? (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="bg-gray-50/70 border-b border-gray-100 text-gray-400 uppercase font-semibold text-[11px] tracking-wider">
                  <th className="py-3 px-6 w-16">ID</th>
                  <th className="py-3 px-6">Service</th>
                  <th className="py-3 px-6">Type</th>
                  <th className="py-3 px-6">Status</th>
                  <th className="py-3 px-6">Performed By</th>
                  <th className="py-3 px-6 max-w-xs">Error</th>
                  <th className="py-3 px-6 text-right">Timestamp</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {[1, 2, 3, 4, 5].map((idx) => (
                  <tr key={idx} className="animate-pulse">
                    <td className="py-4 px-6"><div className="h-4 w-8 bg-gray-200/80 rounded-md" /></td>
                    <td className="py-4 px-6"><div className="h-4 w-32 bg-gray-200/80 rounded-md" /></td>
                    <td className="py-4 px-6"><div className="h-6 w-24 bg-gray-200/80 rounded-full" /></td>
                    <td className="py-4 px-6"><div className="h-6 w-24 bg-gray-200/80 rounded-full" /></td>
                    <td className="py-4 px-6"><div className="h-4 w-28 bg-gray-200/80 rounded-md" /></td>
                    <td className="py-4 px-6"><div className="h-4 w-44 bg-gray-200/80 rounded-md" /></td>
                    <td className="py-4 px-6 text-right"><div className="h-4 w-28 bg-gray-200/80 rounded-md ml-auto" /></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : filteredLogs.length === 0 ? (
          <div className="p-12 text-center text-gray-400">
            <p className="font-semibold text-gray-600">No activity logs found</p>
            <p className="text-xs text-gray-400 mt-1">
              {searchQuery || typeFilter !== "ALL" || statusFilter !== "ALL"
                ? "Try adjusting your search query or filters."
                : "No logs have been recorded for this user yet."}
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="bg-gray-50/70 border-b border-gray-100 text-gray-400 uppercase font-semibold text-[11px] tracking-wider">
                  <th className="py-3 px-6 w-16">ID</th>
                  <th className="py-3 px-6">Service</th>
                  <th className="py-3 px-6">Type</th>
                  <th className="py-3 px-6">Status</th>
                  <th className="py-3 px-6">Performed By</th>
                  <th className="py-3 px-6 max-w-xs">Error</th>
                  <th className="py-3 px-6 text-right">Timestamp</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 text-gray-700 font-medium">
                {paginatedLogs.map((log) => {
                  const isSuccess = log.status === "SUCCESS";
                  const isOnboard = log.command_type === "ONBOARD";
                  const hasError = Boolean(log.error_message);

                  return (
                    <tr
                      key={log.id}
                      onClick={() => hasError && setSelectedErrorLog(log)}
                      className={`transition-colors ${
                        hasError
                          ? "hover:bg-rose-50/40 cursor-pointer group"
                          : "hover:bg-gray-50/60"
                      }`}
                    >
                      {/* ID */}
                      <td className="py-3.5 px-6 font-mono text-gray-400 font-normal">
                        {log.id}
                      </td>

                      {/* Service Name */}
                      <td className="py-3.5 px-6 font-semibold text-gray-900">
                        {log.service_name || "Unknown Service"}
                      </td>

                      {/* Command Type */}
                      <td className="py-3.5 px-6">
                        {isOnboard ? (
                          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[12px] font-bold bg-[#ecfdf5] text-[#065f46]">
                            <UserPlus className="size-4 text-[#065f46] flex-shrink-0" />
                            ONBOARD
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[12px] font-bold bg-[#fff7ed] text-[#c2410c]">
                            <UserMinus className="size-4 text-[#c2410c] flex-shrink-0" />
                            OFFBOARD
                          </span>
                        )}
                      </td>

                      {/* Status */}
                      <td className="py-3.5 px-6">
                        {isSuccess ? (
                          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[12px] font-bold bg-[#ecfdf5] text-[#065f46]">
                            <CheckCircle2 className="size-4 text-[#065f46] flex-shrink-0" />
                            SUCCESS
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[12px] font-bold bg-[#fef2f2] text-[#dc2626]">
                            <XCircle className="size-4 text-[#dc2626] flex-shrink-0" />
                            FAILED
                          </span>
                        )}
                      </td>

                      {/* Performed By */}
                      <td className="py-3.5 px-6 font-medium text-gray-800 whitespace-nowrap">
                        {log.performed_by || "System"}
                      </td>

                      {/* Error Message */}
                      <td className="py-3.5 px-6 max-w-xs truncate">
                        {log.error_message ? (
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              setSelectedErrorLog(log);
                            }}
                            className="flex items-center gap-1.5 text-rose-600 hover:text-rose-800 text-[11px] font-semibold group/btn transition-colors"
                            title="Click to view full error payload"
                          >
                            <AlertCircle className="size-3.5 flex-shrink-0 text-rose-500" />
                            <span className="truncate underline decoration-rose-300 underline-offset-2">
                              {log.error_message}
                            </span>
                            <ExternalLink className="size-3 flex-shrink-0 opacity-0 group-hover/btn:opacity-100 transition-opacity ml-1" />
                          </button>
                        ) : (
                          <span className="text-gray-300">—</span>
                        )}
                      </td>

                      {/* Timestamp */}
                      <td className="py-3.5 px-6 text-right text-gray-500 font-normal whitespace-nowrap">
                        {formatDate(log.created_at)}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

        {/* Footer with Pagination */}
        {selectedUser && filteredLogs.length > 0 && (
          <div className="flex items-center justify-between px-6 py-4 border-t border-gray-100 bg-gray-50/40 text-xs text-gray-500 font-medium">
            <div>
              Showing {Math.min((currentPage - 1) * itemsPerPage + 1, filteredLogs.length)} to{" "}
              {Math.min(currentPage * itemsPerPage, filteredLogs.length)} of {filteredLogs.length} entries
            </div>

            {totalPages > 1 && (
              <div className="flex items-center gap-2">
                <button
                  onClick={() => handlePageChange(currentPage - 1)}
                  disabled={currentPage === 1}
                  className="p-1 rounded-lg border border-gray-200 bg-white hover:bg-gray-50 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                >
                  <ChevronLeft className="size-4 text-gray-600" />
                </button>
                <span className="px-2 font-semibold text-gray-700">
                  Page {currentPage} of {totalPages}
                </span>
                <button
                  onClick={() => handlePageChange(currentPage + 1)}
                  disabled={currentPage === totalPages}
                  className="p-1 rounded-lg border border-gray-200 bg-white hover:bg-gray-50 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                >
                  <ChevronRight className="size-4 text-gray-600" />
                </button>
              </div>
            )}
          </div>
        )}
      </CardContent>

      {/* Error Details Modal */}
      <ErrorDetailsModal
        isOpen={Boolean(selectedErrorLog)}
        log={selectedErrorLog}
        userName={selectedUser?.name}
        onClose={() => setSelectedErrorLog(null)}
      />
    </Card>
  );
}

export default memo(ActivityLogsCard);
