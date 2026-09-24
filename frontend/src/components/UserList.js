import React, { useState, memo } from "react";
import { Search, Loader2, UserPlus, X, Check, Mail, User } from "lucide-react";
import { Card, CardHeader, CardTitle, CardContent } from "./ui/card";
import { Input } from "./ui/input";
import { getAvatarColor, getInitials } from "../utils/helpers";
import { fetchWithAuth } from "../utils/fetchWithAuth";

const API_URL = process.env.REACT_APP_API_URL || "http://localhost:5001";

function UserList({
  users,
  filteredUsers,
  selectedUser,
  searchQuery,
  onSearchChange,
  onUserSelect,
  isLoading,
  onRefreshUsers
}) {
  const [showAddForm, setShowAddForm] = useState(false);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [addError, setAddError] = useState("");

  const handleAddEmployee = async (e) => {
    e.preventDefault();
    if (!email) return;

    setIsSubmitting(true);
    setAddError("");
    try {
      const res = await fetchWithAuth(`${API_URL}/users`, {
        method: "POST",
        body: JSON.stringify({ name, email }),
      });
      const data = await res.json();

      if (res.ok && data.success) {
        setName("");
        setEmail("");
        setShowAddForm(false);
        if (onRefreshUsers) onRefreshUsers();
      } else {
        setAddError(data.message || "Failed to register employee.");
      }
    } catch (err) {
      setAddError(err.message || "Network error.");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Card className="h-full flex flex-col border border-slate-200/80 shadow-md rounded-3xl overflow-hidden bg-white">
      <CardHeader className="flex flex-row items-center justify-between pb-4 border-b border-slate-100 gap-3">
        <div className="min-w-0">
          <CardTitle className="text-xl font-bold text-slate-900 tracking-tight">Tracked Employees</CardTitle>
          <p className="text-xs text-slate-500 font-normal truncate mt-0.5">
            Software onboarding & offboarding accounts
          </p>
        </div>

        <div className="flex items-center gap-2 flex-shrink-0">
          <span className="whitespace-nowrap px-2.5 py-1 bg-slate-100 text-slate-600 rounded-full text-xs font-medium border border-slate-200">
            {filteredUsers.length} of {users.length}
          </span>
          <button
            onClick={() => setShowAddForm(!showAddForm)}
            className="px-3 py-1.5 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white rounded-xl shadow-sm shadow-blue-500/20 font-semibold text-xs flex items-center gap-1.5 transition-all hover:scale-[1.02] cursor-pointer whitespace-nowrap"
            title="Register new employee"
          >
            <UserPlus className="w-3.5 h-3.5" />
            <span>Add</span>
          </button>
        </div>
      </CardHeader>

      <CardContent className="p-0 flex flex-col flex-1">
        {showAddForm && (
          <form
            onSubmit={handleAddEmployee}
            className="p-4 bg-gradient-to-b from-blue-50/90 to-slate-50 border-b border-blue-100 space-y-3 shadow-inner"
          >
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold uppercase tracking-wider text-blue-900 flex items-center gap-1.5">
                <UserPlus className="w-3.5 h-3.5 text-blue-600" /> Register System Employee
              </span>
              <button
                type="button"
                onClick={() => setShowAddForm(false)}
                className="text-slate-400 hover:text-slate-600 p-1 rounded-md transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {addError && (
              <div className="text-xs text-red-600 bg-red-50 p-2 rounded-lg border border-red-200">
                {addError}
              </div>
            )}

            <div className="space-y-2">
              <div className="relative">
                <User className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-2.5" />
                <Input
                  type="text"
                  placeholder="Full Name (e.g. Jane Doe)"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="pl-8 bg-white border-slate-200 text-xs rounded-lg"
                />
              </div>

              <div className="relative">
                <Mail className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-2.5" />
                <Input
                  type="email"
                  required
                  placeholder="employee@domain.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="pl-8 bg-white border-slate-200 text-xs rounded-lg"
                />
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-1">
              <button
                type="button"
                onClick={() => setShowAddForm(false)}
                className="px-3 py-1.5 bg-white hover:bg-slate-100 text-slate-600 rounded-lg text-xs font-medium border border-slate-200 transition-colors"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={isSubmitting || !email}
                className="px-3.5 py-1.5 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white rounded-lg text-xs font-semibold flex items-center gap-1 shadow-sm shadow-blue-500/20 transition-all cursor-pointer"
              >
                {isSubmitting ? (
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                ) : (
                  <Check className="w-3.5 h-3.5" />
                )}
                Save Employee
              </button>
            </div>
          </form>
        )}

        <div className="p-4 border-b border-slate-100 bg-slate-50/50">
          <div className="relative">
            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 size-4 text-slate-400" />
            <Input
              type="text"
              placeholder="Search by name or email..."
              value={searchQuery}
              onChange={(e) => onSearchChange(e.target.value)}
              className="pl-9 bg-white border-slate-200 rounded-xl text-sm focus:ring-2 focus:ring-blue-500/20 shadow-sm"
            />
          </div>
        </div>

        <div className="divide-y divide-slate-100 max-h-[450px] overflow-y-auto flex-1">
          {isLoading ? (
            <div className="p-8 flex justify-center text-slate-500">
              <Loader2 className="animate-spin size-6 text-blue-600" />
            </div>
          ) : filteredUsers.length > 0 ? (
            filteredUsers.map((user) => {
              const isSelected = selectedUser?.user_id === user.user_id;
              return (
                <button
                  key={user.user_id}
                  onClick={() => onUserSelect(user)}
                  className={`w-full px-5 py-3.5 text-left transition-all flex items-center justify-between group cursor-pointer ${
                    isSelected
                      ? "bg-blue-50/80 border-l-4 border-blue-600"
                      : "hover:bg-slate-50/80 bg-white"
                  }`}
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <div
                      className={`size-10 rounded-full flex items-center justify-center font-bold text-sm flex-shrink-0 shadow-sm ${getAvatarColor(
                        user.name
                      )}`}
                    >
                      {getInitials(user.name)}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <p className="font-semibold text-slate-900 truncate text-[14px]">
                          {user.name}
                        </p>
                        <span
                          className={`size-2 rounded-full flex-shrink-0 ${
                            user.is_active ? "bg-emerald-500 shadow-sm shadow-emerald-500/50" : "bg-red-400"
                          }`}
                        />
                      </div>
                      <p className="text-xs text-slate-400 truncate mt-0.5">{user.email}</p>
                    </div>
                  </div>
                  {isSelected && (
                    <div className="w-6 h-6 rounded-full bg-blue-100 text-blue-600 flex items-center justify-center flex-shrink-0">
                      <svg
                        className="size-3.5"
                        fill="none"
                        viewBox="0 0 24 24"
                        stroke="currentColor"
                        strokeWidth="3"
                      >
                        <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
                      </svg>
                    </div>
                  )}
                </button>
              );
            })
          ) : (
            <div className="p-8 text-center text-slate-400">
              <p className="text-sm">No employees found matching "{searchQuery}"</p>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

export default memo(UserList);
