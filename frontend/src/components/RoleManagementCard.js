import React, { useState, useEffect, useCallback, useMemo } from "react";
import { useAuth } from "../context/AuthContext";
import { fetchWithAuth } from "../utils/fetchWithAuth";
import {
  UserCheck,
  Shield,
  Mail,
  Lock,
  CheckCircle,
  AlertCircle,
  RefreshCw,
  Edit2,
  X,
  Crown,
  User,
  Users,
  UserPlus,
  Search,
  ShieldCheck,
} from "lucide-react";

const API_URL = process.env.REACT_APP_API_URL || "http://localhost:5001";

const ALL_ROLES_CONFIG = [
  {
    value: "MEMBER",
    title: "Standard Member",
    tier: "Tier 4",
    desc: "Tracked system employee onboarded across integrated software",
    icon: User,
    activeBorder: "border-slate-500 bg-slate-50 ring-2 ring-slate-400/30",
    badgeBg: "bg-slate-100 text-slate-700 border-slate-300",
    iconBg: "bg-slate-100 text-slate-600 border-slate-200",
    activeText: "text-slate-900",
  },
  {
    value: "OPERATOR",
    title: "Access Operator",
    tier: "Tier 3",
    desc: "Onboard & offboard employees across connected tools",
    icon: UserCheck,
    activeBorder: "border-emerald-500 bg-emerald-50/60 ring-2 ring-emerald-500/30",
    badgeBg: "bg-emerald-100 text-emerald-800 border-emerald-200",
    iconBg: "bg-emerald-100 text-emerald-600 border-emerald-200",
    activeText: "text-emerald-900",
  },
  {
    value: "MANAGER",
    title: "Access Manager",
    tier: "Tier 2",
    desc: "Delegate Operator access & manage software integrations",
    icon: Shield,
    activeBorder: "border-blue-500 bg-blue-50/60 ring-2 ring-blue-500/30",
    badgeBg: "bg-blue-100 text-blue-800 border-blue-200",
    iconBg: "bg-blue-100 text-blue-600 border-blue-200",
    activeText: "text-blue-900",
  },
  {
    value: "ADMIN",
    title: "Super Admin",
    tier: "Tier 1",
    desc: "Full system control, role delegation & console administration",
    icon: Crown,
    activeBorder: "border-purple-500 bg-purple-50/60 ring-2 ring-purple-500/30",
    badgeBg: "bg-purple-100 text-purple-800 border-purple-200",
    iconBg: "bg-purple-100 text-purple-600 border-purple-200",
    activeText: "text-purple-900",
  },
];

function RoleCardSelector({ value, onChange, availableRoles }) {
  const filtered = ALL_ROLES_CONFIG.filter((r) => availableRoles.includes(r.value));

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
      {filtered.map((role) => {
        const isSelected = value === role.value;
        const IconComponent = role.icon;
        return (
          <button
            key={role.value}
            type="button"
            onClick={() => onChange(role.value)}
            className={`p-3.5 rounded-xl border text-left transition-all duration-200 relative flex flex-col justify-between cursor-pointer group ${isSelected
                ? `${role.activeBorder} shadow-sm scale-[1.01]`
                : "border-slate-200 bg-white hover:border-slate-300 hover:bg-slate-50/60"
              }`}
          >
            <div>
              <div className="flex items-center justify-between mb-2">
                <div className={`p-2 rounded-lg border ${role.iconBg}`}>
                  <IconComponent className="w-4 h-4" />
                </div>
                <span className={`text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full border ${role.badgeBg}`}>
                  {role.tier}
                </span>
              </div>
              <h4 className={`font-bold text-sm ${isSelected ? role.activeText : "text-slate-900 group-hover:text-blue-600"} transition-colors`}>
                {role.title}
              </h4>
              <p className="text-xs text-slate-500 mt-1 leading-relaxed">
                {role.desc}
              </p>
            </div>
            <div className="mt-3 pt-2 border-t border-slate-200/50 flex items-center justify-between text-xs">
              {isSelected ? (
                <span className="text-[11px] text-blue-600 font-bold flex items-center gap-1">
                  <CheckCircle className="w-3.5 h-3.5" /> Selected Role
                </span>
              ) : (
                <span className="text-[11px] text-slate-400 group-hover:text-slate-600 font-medium">
                  Click to select
                </span>
              )}
            </div>
          </button>
        );
      })}
    </div>
  );
}

export default function RoleManagementCard({ showToast }) {
  const { user: currentUser, role: userRole } = useAuth();
  const [users, setUsers] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [activeRoleFilter, setActiveRoleFilter] = useState("ALL");

  // Grant New Access Modal state
  const [grantModal, setGrantModal] = useState({
    isOpen: false,
    email: "",
    name: "",
    password: "",
    role: "OPERATOR",
    isSubmitting: false,
  });

  // Edit User Modal state
  const [editModal, setEditModal] = useState({
    isOpen: false,
    user: null,
    email: "",
    name: "",
    password: "",
    role: "OPERATOR",
    isSubmitting: false,
  });

  const [togglingUserId, setTogglingUserId] = useState(null);

  let availableRoles = [];
  if (userRole === "ADMIN") {
    availableRoles = ["MEMBER", "OPERATOR", "MANAGER", "ADMIN"];
  } else if (userRole === "MANAGER") {
    availableRoles = ["MEMBER", "OPERATOR", "MANAGER"];
  } else {
    availableRoles = ["MEMBER", "OPERATOR"];
  }

  const fetchUsers = useCallback(async () => {
    setIsLoading(true);
    try {
      const res = await fetchWithAuth(`${API_URL}/admin/roles/users`);
      const data = await res.json();
      if (res.ok && data.success) {
        setUsers(data.users || []);
      }
    } catch (err) {
      console.error("Failed to fetch role users:", err);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchUsers();
  }, [fetchUsers]);

  // KPI Metrics Calculation
  const metrics = useMemo(() => {
    const totalUsers = users.length;
    const adminCount = users.filter((u) => u.role === "ADMIN").length;
    const managerCount = users.filter((u) => u.role === "MANAGER").length;
    const operatorCount = users.filter((u) => u.role === "OPERATOR").length;
    const memberCount = users.filter((u) => u.role === "MEMBER").length;
    const consoleAdminsCount = adminCount + managerCount + operatorCount;

    return {
      totalUsers,
      adminCount,
      managerCount,
      operatorCount,
      memberCount,
      consoleAdminsCount,
    };
  }, [users]);

  // Filtered User List
  const filteredUsers = useMemo(() => {
    return users.filter((u) => {
      const matchesSearch =
        u.name.toLowerCase().includes(searchQuery.toLowerCase().trim()) ||
        u.email.toLowerCase().includes(searchQuery.toLowerCase().trim());

      const matchesFilter =
        activeRoleFilter === "ALL" || String(u.role).toUpperCase() === activeRoleFilter;

      return matchesSearch && matchesFilter;
    });
  }, [users, searchQuery, activeRoleFilter]);

  // Grant role to a NEW user (Modal submit)
  const handleGrantNewUser = async (e) => {
    e.preventDefault();
    const { email, name, password, role } = grantModal;
    if (!email) return;

    const isConsoleRole = role !== "MEMBER";
    if (isConsoleRole && (!password || password.trim().length === 0)) {
      showToast &&
        showToast({
          type: "error",
          title: "Initial Password Required",
          message: `Please set an initial password for ${email} so they can log into the Cerberus console.`,
        });
      return;
    }

    setGrantModal((prev) => ({ ...prev, isSubmitting: true }));
    try {
      const res = await fetchWithAuth(`${API_URL}/admin/roles/grant`, {
        method: "POST",
        body: JSON.stringify({ email, name, role, password }),
      });

      const data = await res.json();

      if (res.ok && data.success) {
        showToast &&
          showToast({
            type: "success",
            title: "User Access Granted",
            message: `${email} is assigned as '${role}'. ${data.emailSent ? "Notification email sent!" : ""
              }`,
          });
        setGrantModal({
          isOpen: false,
          email: "",
          name: "",
          password: "",
          role: "OPERATOR",
          isSubmitting: false,
        });
        fetchUsers();
      } else {
        showToast &&
          showToast({
            type: "error",
            title: "Action Failed",
            message: data.message || "Failed to grant role access.",
          });
      }
    } catch (err) {
      showToast &&
        showToast({
          type: "error",
          title: "Action Failed",
          message: err.message || "Network error.",
        });
    } finally {
      setGrantModal((prev) => ({ ...prev, isSubmitting: false }));
    }
  };

  // Open Edit Modal for existing user
  const openEditModal = (u) => {
    const defaultRole = availableRoles.includes(u.role) ? u.role : "OPERATOR";
    setEditModal({
      isOpen: true,
      user: u,
      email: u.email,
      name: u.name || "",
      password: "",
      role: defaultRole,
      isSubmitting: false,
    });
  };

  // Close Edit Modal
  const closeEditModal = () => {
    setEditModal({
      isOpen: false,
      user: null,
      email: "",
      name: "",
      password: "",
      role: "OPERATOR",
      isSubmitting: false,
    });
  };

  // Save changes for an EXISTING user (In Modal)
  const handleUpdateExistingUser = async (e) => {
    e.preventDefault();
    const { user, email: targetEmail, name: targetName, role: targetRole, password: targetPassword } = editModal;
    if (!targetEmail) return;

    const isConsoleRole = targetRole !== "MEMBER";
    const userNeedsPassword = isConsoleRole && (!user || !user.hasPassword);
    if (userNeedsPassword && (!targetPassword || targetPassword.trim().length === 0)) {
      showToast &&
        showToast({
          type: "error",
          title: "Initial Password Required",
          message: `Please set an initial password for ${targetEmail} so they can log into the Cerberus console.`,
        });
      return;
    }

    setEditModal((prev) => ({ ...prev, isSubmitting: true }));
    try {
      const res = await fetchWithAuth(`${API_URL}/admin/roles/grant`, {
        method: "POST",
        body: JSON.stringify({ email: targetEmail, name: targetName, role: targetRole, password: targetPassword }),
      });

      const data = await res.json();

      if (res.ok && data.success) {
        showToast &&
          showToast({
            type: "success",
            title: "Role Access Updated",
            message: `${targetEmail} updated to '${targetRole}'. ${data.emailSent ? "Notification email sent!" : ""
              }`,
          });
        closeEditModal();
        fetchUsers();
      } else {
        showToast &&
          showToast({
            type: "error",
            title: "Action Failed",
            message: data.message || "Failed to update role access.",
          });
      }
    } catch (err) {
      showToast &&
        showToast({
          type: "error",
          title: "Action Failed",
          message: err.message || "Network error.",
        });
    } finally {
      setEditModal((prev) => ({ ...prev, isSubmitting: false }));
    }
  };

  // Toggle user active status
  const handleToggleUserStatus = async (userToToggle) => {
    if (!userToToggle || !userToToggle.userId) return;
    setTogglingUserId(userToToggle.userId);

    try {
      const res = await fetchWithAuth(`${API_URL}/admin/roles/${userToToggle.userId}/status`, {
        method: "PATCH",
      });
      const data = await res.json();

      if (res.ok && data.success) {
        showToast &&
          showToast({
            type: "success",
            success: true,
            title: "User Status Updated",
            message: data.message || `Status updated for ${userToToggle.email}`,
          });
        fetchUsers();
      } else {
        showToast &&
          showToast({
            type: "error",
            success: false,
            title: "Action Failed",
            message: data.message || "Failed to update user status.",
          });
      }
    } catch (err) {
      showToast &&
        showToast({
          type: "error",
          title: "Action Failed",
          message: err.message || "Network error.",
        });
    } finally {
      setTogglingUserId(null);
    }
  };

  // Hierarchy enforcement check for Edit/Revoke permissions
  const canModifyUser = (targetUser) => {
    if (String(currentUser?.userId) === String(targetUser.userId)) {
      return false; // Self-modification blocked
    }
    const targetRole = String(targetUser.role || "MEMBER").toUpperCase();
    if (userRole === "ADMIN") return true;
    if (userRole === "MANAGER") {
      return targetRole !== "ADMIN";
    }
    if (userRole === "OPERATOR") {
      return targetRole === "MEMBER" || targetRole === "OPERATOR";
    }
    return false;
  };

  const getBadgeStyle = (role) => {
    switch (role) {
      case "ADMIN":
        return "bg-purple-100 text-purple-800 border-purple-200 font-bold";
      case "MANAGER":
        return "bg-blue-100 text-blue-800 border-blue-200 font-bold";
      case "OPERATOR":
        return "bg-emerald-100 text-emerald-800 border-emerald-200 font-bold";
      case "MEMBER":
        return "bg-slate-100 text-slate-700 border-slate-300 font-medium";
      default:
        return "bg-slate-100 text-slate-600 border-slate-200";
    }
  };

  return (
    <div className="space-y-6">
      {/* KPI Overview Metrics Bar */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        {/* Metric 1 */}
        <div className="bg-white rounded-2xl p-5 border border-slate-200/80 shadow-sm flex items-center gap-4">
          <div className="w-12 h-12 rounded-xl bg-blue-50 border border-blue-100 text-blue-600 flex items-center justify-center flex-shrink-0">
            <Users className="w-6 h-6" />
          </div>
          <div>
            <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Total Registered Users</p>
            <h3 className="text-2xl font-extrabold text-slate-900 mt-0.5">{metrics.totalUsers}</h3>
            <p className="text-[11px] text-slate-400 font-medium truncate mt-0.5">Accounts in System Directory</p>
          </div>
        </div>

        {/* Metric 2 */}
        <div className="bg-white rounded-2xl p-5 border border-slate-200/80 shadow-sm flex items-center gap-4">
          <div className="w-12 h-12 rounded-xl bg-purple-50 border border-purple-100 text-purple-600 flex items-center justify-center flex-shrink-0">
            <ShieldCheck className="w-6 h-6" />
          </div>
          <div>
            <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Console Administrators</p>
            <h3 className="text-2xl font-extrabold text-purple-900 mt-0.5">{metrics.consoleAdminsCount}</h3>
            <p className="text-[11px] text-slate-500 font-medium truncate mt-0.5">
              {metrics.adminCount} Admin • {metrics.managerCount} Mgr • {metrics.operatorCount} Op
            </p>
          </div>
        </div>

        {/* Metric 3 */}
        <div className="bg-white rounded-2xl p-5 border border-slate-200/80 shadow-sm flex items-center gap-4">
          <div className="w-12 h-12 rounded-xl bg-slate-100 border border-slate-200 text-slate-600 flex items-center justify-center flex-shrink-0">
            <User className="w-6 h-6" />
          </div>
          <div>
            <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Tracked Members</p>
            <h3 className="text-2xl font-extrabold text-slate-900 mt-0.5">{metrics.memberCount}</h3>
            <p className="text-[11px] text-slate-400 font-medium truncate mt-0.5">Onboarded System Employees</p>
          </div>
        </div>
      </div>

      {/* Main Unified Roles Command Table */}
      <div className="bg-white rounded-2xl shadow-md border border-slate-200/80 overflow-hidden">
        {/* Table Controls Header */}
        <div className="p-6 border-b border-slate-100 space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <h2 className="text-xl font-bold text-slate-900 tracking-tight">Cerberus Console Roles & Access</h2>
              <p className="text-sm text-slate-500 mt-0.5">
                Manage administrative privileges, authentication credentials, and user delegation.
              </p>
            </div>

            <button
              onClick={() => setGrantModal({ isOpen: true, email: "", name: "", password: "", role: "OPERATOR", isSubmitting: false })}
              className="px-5 py-2.5 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white font-semibold text-sm rounded-xl shadow-md shadow-blue-500/20 flex items-center justify-center gap-2 transition-all hover:scale-[1.02] cursor-pointer whitespace-nowrap"
            >
              <UserPlus className="w-4 h-4" />
              <span>Grant Role Access</span>
            </button>
          </div>

          {/* Filter & Search Bar */}
          <div className="flex flex-col sm:flex-row items-center justify-between gap-3 pt-2">
            {/* Search Input */}
            <div className="relative w-full sm:w-80">
              <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-3" />
              <input
                type="text"
                placeholder="Search user by name or email..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-9 pr-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-500 transition-all"
              />
            </div>

            {/* Role Filter Pills */}
            <div className="flex items-center gap-1 overflow-x-auto w-full sm:w-auto pb-1 sm:pb-0">
              {[
                { label: "All Users", value: "ALL" },
                { label: "Admin", value: "ADMIN" },
                { label: "Manager", value: "MANAGER" },
                { label: "Operator", value: "OPERATOR" },
                { label: "Member", value: "MEMBER" },
              ].map((filter) => (
                <button
                  key={filter.value}
                  onClick={() => setActiveRoleFilter(filter.value)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer whitespace-nowrap ${activeRoleFilter === filter.value
                      ? "bg-slate-900 text-white shadow-sm"
                      : "bg-slate-100 text-slate-600 hover:bg-slate-200/70"
                    }`}
                >
                  {filter.label}
                </button>
              ))}
              <button
                onClick={fetchUsers}
                disabled={isLoading}
                className="p-2 text-slate-500 hover:text-slate-900 rounded-lg hover:bg-slate-100 transition-all ml-1 cursor-pointer"
                title="Refresh Table"
              >
                <RefreshCw className={`w-4 h-4 ${isLoading ? "animate-spin" : ""}`} />
              </button>
            </div>
          </div>
        </div>

        {/* Directory Table */}
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead>
              <tr className="bg-slate-50/80 border-b border-slate-200 text-xs uppercase font-semibold text-slate-500">
                <th className="py-3.5 px-6">User</th>
                <th className="py-3.5 px-4">Email Address</th>
                <th className="py-3.5 px-4">Cerberus Role</th>
                <th className="py-3.5 px-4">Password Status</th>
                <th className="py-3.5 px-4">Account Status</th>
                <th className="py-3.5 px-4">Last Login</th>
                <th className="py-3.5 px-6 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filteredUsers.length > 0 ? (
                filteredUsers.map((u) => {
                  const canModify = canModifyUser(u);
                  const isCurrentSelf = String(currentUser?.userId) === String(u.userId);

                  return (
                    <tr key={u.userId} className="hover:bg-slate-50/80 transition-colors group">
                      <td className="py-3.5 px-6 font-semibold text-slate-900">
                        {u.name} {isCurrentSelf && <span className="text-xs text-blue-600 font-bold ml-1">(You)</span>}
                      </td>
                      <td className="py-3.5 px-4 text-slate-600 font-medium">{u.email}</td>
                      <td className="py-3.5 px-4">
                        <span
                          className={`inline-flex items-center px-3 py-1 rounded-full text-xs font-bold border ${getBadgeStyle(
                            u.role
                          )}`}
                        >
                          {u.role}
                        </span>
                      </td>
                      <td className="py-3.5 px-4 text-xs">
                        {u.role === "MEMBER" ? (
                          <span className="inline-flex items-center gap-1 text-slate-500 font-medium bg-slate-100 px-2.5 py-0.5 rounded-md border border-slate-200" title="Standard Members do not have Cerberus Console login access">
                            N/A (No Console Login)
                          </span>
                        ) : u.hasPassword ? (
                          <span className="inline-flex items-center gap-1 text-emerald-700 font-semibold bg-emerald-50 px-2.5 py-0.5 rounded-md border border-emerald-200">
                            <CheckCircle className="w-3.5 h-3.5 text-emerald-600" /> Configured
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 text-amber-700 font-semibold bg-amber-50 px-2.5 py-0.5 rounded-md border border-amber-200">
                            <AlertCircle className="w-3.5 h-3.5 text-amber-600" /> Not set
                          </span>
                        )}
                      </td>
                      <td className="py-3.5 px-4">
                        {canModify && !isCurrentSelf ? (
                          <button
                            type="button"
                            onClick={() => handleToggleUserStatus(u)}
                            disabled={togglingUserId === u.userId}
                            title={u.isActive ? "Click to Deactivate user & revoke access" : "Click to Activate user"}
                            className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold border transition-all cursor-pointer ${
                              u.isActive
                                ? "bg-emerald-50 hover:bg-emerald-100 text-emerald-700 border-emerald-200/80 shadow-xs"
                                : "bg-slate-100 hover:bg-slate-200/70 text-slate-600 border-slate-200"
                            }`}
                          >
                            {togglingUserId === u.userId ? (
                              <RefreshCw className="w-3 h-3 animate-spin text-slate-500" />
                            ) : (
                              <span
                                className={`w-2 h-2 rounded-full transition-colors ${
                                  u.isActive ? "bg-emerald-500 shadow-sm shadow-emerald-500/50" : "bg-slate-400"
                                }`}
                              />
                            )}
                            <span>{u.isActive ? "Active" : "Inactive"}</span>
                          </button>
                        ) : u.isActive ? (
                          <span className="inline-flex items-center text-xs font-semibold text-emerald-700 gap-1.5 px-2.5 py-1 rounded-full bg-emerald-50/60 border border-emerald-100">
                            <span className="w-2 h-2 rounded-full bg-emerald-500 shadow-sm shadow-emerald-500/50" /> Active
                          </span>
                        ) : (
                          <span className="inline-flex items-center text-xs font-semibold text-slate-400 gap-1.5 px-2.5 py-1 rounded-full bg-slate-100 border border-slate-200">
                            <span className="w-2 h-2 rounded-full bg-slate-400" /> Inactive
                          </span>
                        )}
                      </td>
                      <td className="py-3.5 px-4 text-xs text-slate-500 font-medium">
                        {u.lastLoginAt ? new Date(u.lastLoginAt).toLocaleString() : "Never"}
                      </td>
                      <td className="py-3.5 px-6 text-right">
                        {canModify && u.isActive ? (
                          <div className="flex items-center justify-end gap-1">
                            <button
                              onClick={() => openEditModal(u)}
                              className="p-1.5 text-slate-500 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors cursor-pointer"
                              title="Edit Role & Credentials"
                            >
                              <Edit2 className="w-4 h-4" />
                            </button>
                          </div>
                        ) : (
                          <span className="text-xs text-slate-300 italic font-medium">
                            {!canModify ? "No permission" : "—"}
                          </span>
                        )}
                      </td>
                    </tr>
                  );
                })
              ) : (
                <tr>
                  <td colSpan="7" className="py-12 text-center text-slate-400">
                    <p className="text-sm font-medium">No users found matching your search or filter.</p>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Grant Role Access Modal Overlay (NEW User) */}
      {grantModal.isOpen && (
        <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-2xl p-6 max-w-3xl w-full shadow-2xl border border-slate-100 space-y-5">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center font-bold text-sm border border-blue-100">
                  <UserPlus className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-lg font-bold text-slate-900">Grant Cerberus Console Role Access</h3>
                  <p className="text-xs text-slate-500">Assign role privileges and credentials to a new user account.</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setGrantModal((prev) => ({ ...prev, isOpen: false }))}
                className="p-1.5 text-slate-400 hover:text-slate-600 rounded-lg hover:bg-slate-100 transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleGrantNewUser} className="space-y-5">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div>
                  <label className="block text-xs font-semibold uppercase text-slate-500 mb-1">
                    Recipient Email <span className="text-red-500">*</span>
                  </label>
                  <div className="relative">
                    <input
                      type="email"
                      required
                      placeholder="user@example.com"
                      value={grantModal.email}
                      onChange={(e) => setGrantModal((prev) => ({ ...prev, email: e.target.value }))}
                      className="w-full pl-9 pr-3 py-2.5 text-sm bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-500 transition-all"
                    />
                    <Mail className="w-4 h-4 text-slate-400 absolute left-3 top-3" />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-semibold uppercase text-slate-500 mb-1">
                    Full Name (Optional)
                  </label>
                  <input
                    type="text"
                    placeholder="John Doe"
                    value={grantModal.name}
                    onChange={(e) => setGrantModal((prev) => ({ ...prev, name: e.target.value }))}
                    className="w-full px-3.5 py-2.5 text-sm bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-500 transition-all"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold uppercase text-slate-500 mb-1">
                    {grantModal.role !== "MEMBER" ? (
                      <>
                        Initial Password <span className="text-red-500">*</span>
                      </>
                    ) : (
                      "Initial Password (Optional)"
                    )}
                  </label>
                  <div className="relative">
                    <input
                      type="password"
                      placeholder={
                        grantModal.role !== "MEMBER"
                          ? "Set initial password (Required for login)"
                          : "No password required for Standard Members"
                      }
                      value={grantModal.password}
                      onChange={(e) => setGrantModal((prev) => ({ ...prev, password: e.target.value }))}
                      className={`w-full pl-9 pr-3 py-2.5 text-sm rounded-xl focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-500 transition-all ${grantModal.role !== "MEMBER"
                          ? "bg-amber-50/50 border border-amber-300"
                          : "bg-slate-50 border border-slate-200"
                        }`}
                    />
                    <Lock className="w-4 h-4 text-slate-400 absolute left-3 top-3" />
                  </div>
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold uppercase text-slate-500 mb-2">
                  Select Role Tier <span className="text-red-500">*</span>
                </label>
                <RoleCardSelector
                  value={grantModal.role}
                  onChange={(r) => setGrantModal((prev) => ({ ...prev, role: r }))}
                  availableRoles={availableRoles}
                />
              </div>

              <div className="flex justify-end gap-3 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setGrantModal((prev) => ({ ...prev, isOpen: false }))}
                  className="px-4 py-2 text-sm font-medium text-slate-600 hover:bg-slate-100 rounded-xl transition-colors cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={
                    grantModal.isSubmitting ||
                    !grantModal.email ||
                    (grantModal.role !== "MEMBER" && !grantModal.password)
                  }
                  className="px-5 py-2 text-sm font-bold text-white bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 disabled:opacity-50 rounded-xl shadow-md shadow-blue-500/20 flex items-center gap-2 transition-all cursor-pointer"
                >
                  {grantModal.isSubmitting && <RefreshCw className="w-4 h-4 animate-spin" />}
                  Grant Role Access
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Edit User Modal Overlay */}
      {editModal.isOpen && (
        <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-2xl p-6 max-w-3xl w-full shadow-2xl border border-slate-100 space-y-5">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center font-bold text-sm border border-blue-100">
                  <UserCheck className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-lg font-bold text-slate-900">Edit User Role & Credentials</h3>
                  <p className="text-xs text-slate-500">{editModal.email}</p>
                </div>
              </div>
              <button
                type="button"
                onClick={closeEditModal}
                className="p-1.5 text-slate-400 hover:text-slate-600 rounded-lg hover:bg-slate-100 transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleUpdateExistingUser} className="space-y-5">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold uppercase text-slate-500 mb-1">
                    Recipient Email
                  </label>
                  <div className="relative">
                    <input
                      type="email"
                      disabled
                      value={editModal.email}
                      className="w-full pl-9 pr-3 py-2.5 text-sm bg-slate-100 text-slate-500 border border-slate-200 rounded-xl cursor-not-allowed"
                    />
                    <Mail className="w-4 h-4 text-slate-400 absolute left-3 top-3" />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-semibold uppercase text-slate-500 mb-1">
                    Full Name (Optional)
                  </label>
                  <input
                    type="text"
                    placeholder="John Doe"
                    value={editModal.name}
                    onChange={(e) => setEditModal((prev) => ({ ...prev, name: e.target.value }))}
                    className="w-full px-3.5 py-2.5 text-sm bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-500 transition-all"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold uppercase text-slate-500 mb-1">
                  {editModal.role !== "MEMBER" && !editModal.user?.hasPassword ? (
                    <>
                      Initial Password <span className="text-red-500">*</span>
                    </>
                  ) : (
                    "Reset Password (Optional)"
                  )}
                </label>
                <div className="relative">
                  <input
                    type="password"
                    placeholder={
                      editModal.role !== "MEMBER" && !editModal.user?.hasPassword
                        ? "Set initial password (Required for console login)"
                        : editModal.role === "MEMBER"
                        ? "No password required for Standard Members"
                        : "Reset Password (Leave blank to keep current)"
                    }
                    value={editModal.password}
                    onChange={(e) => setEditModal((prev) => ({ ...prev, password: e.target.value }))}
                    className={`w-full pl-9 pr-3 py-2.5 text-sm rounded-xl focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-500 transition-all ${
                      editModal.role !== "MEMBER" && !editModal.user?.hasPassword
                        ? "bg-amber-50/50 border border-amber-300"
                        : "bg-slate-50 border border-slate-200"
                    }`}
                  />
                  <Lock className="w-4 h-4 text-slate-400 absolute left-3 top-3" />
                </div>
                {editModal.role !== "MEMBER" && !editModal.user?.hasPassword && (
                  <p className="text-[11px] text-amber-700 mt-1 flex items-center gap-1 font-medium">
                    <AlertCircle className="w-3 h-3 text-amber-600 flex-shrink-0" /> Password not set yet. Initial password is required for Console access roles.
                  </p>
                )}
              </div>

              <div>
                <label className="block text-xs font-semibold uppercase text-slate-500 mb-2">
                  Assign Role <span className="text-red-500">*</span>
                </label>
                <RoleCardSelector
                  value={editModal.role}
                  onChange={(r) => setEditModal((prev) => ({ ...prev, role: r }))}
                  availableRoles={availableRoles}
                />
              </div>

              <div className="flex justify-end gap-3 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={closeEditModal}
                  className="px-4 py-2 text-sm font-medium text-slate-600 hover:bg-slate-100 rounded-xl transition-colors cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={
                    editModal.isSubmitting ||
                    (editModal.role !== "MEMBER" && !editModal.user?.hasPassword && !editModal.password)
                  }
                  className="px-5 py-2 text-sm font-bold text-white bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 disabled:opacity-50 rounded-xl shadow-md shadow-blue-500/20 flex items-center gap-2 transition-all cursor-pointer"
                >
                  {editModal.isSubmitting && <RefreshCw className="w-4 h-4 animate-spin" />}
                  Update Role Access
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
