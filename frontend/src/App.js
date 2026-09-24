import { useState, useEffect, useMemo, useCallback } from "react";
import { GoogleOAuthProvider } from "@react-oauth/google";
import { AuthProvider, useAuth } from "./context/AuthContext";
import LoginPage from "./components/LoginPage";
import RoleManagementCard from "./components/RoleManagementCard";
import ResetPasswordModal from "./components/ResetPasswordModal";
import Header from "./components/Header";
import UserList from "./components/UserList";
import UserInfoCard from "./components/UserInfoCard";
import OnboardAccessCard from "./components/OnboardAccessCard";
import OffboardAccessCard from "./components/OffboardAccessCard";
import ConfirmModal from "./components/ConfirmModal";
import ToastContainer from "./components/ToastContainer";
import ActivityLogsCard from "./components/ActivityLogsCard";
import { fetchWithAuth } from "./utils/fetchWithAuth";
import { Users, ShieldCheck, RefreshCw } from "lucide-react";

const API_URL = process.env.REACT_APP_API_URL || "http://localhost:5001";
const GOOGLE_CLIENT_ID = process.env.REACT_APP_GOOGLE_CLIENT_ID || "1000000000000-dummyclientid.apps.googleusercontent.com";

function MainDashboard() {
  const { role, isAuthenticated, requiresPasswordChange, isLoading: isAuthLoading } = useAuth();
  const [activeTab, setActiveTab] = useState("access"); // "access" | "roles"

  const [users, setUsers] = useState([]);
  const [services, setServices] = useState([]);
  const [selectedUser, setSelectedUser] = useState(null);
  const [manualAccess, setManualAccess] = useState(new Set());
  const [automateAccess, setAutomateAccess] = useState(new Set());
  const [onboardManualAccess, setOnboardManualAccess] = useState(new Set());
  const [onboardAutomateAccess, setOnboardAutomateAccess] = useState(new Set());
  const [userAccesses, setUserAccesses] = useState([]);
  const [userLogs, setUserLogs] = useState([]);
  const [logsSummary, setLogsSummary] = useState(null);
  const [discordStatus, setDiscordStatus] = useState(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [isLoading, setIsLoading] = useState(true);
  const [isAccessLoading, setIsAccessLoading] = useState(false);
  const [isLogsLoading, setIsLogsLoading] = useState(false);
  const [isOffboarding, setIsOffboarding] = useState(false);
  const [isOnboarding, setIsOnboarding] = useState(false);
  const [toasts, setToasts] = useState([]);
  const [confirmModal, setConfirmModal] = useState({
    isOpen: false,
    type: "onboard",
    isAutomate: false,
    permissions: [],
    userName: ""
  });

  const canManageRoles = role === "ADMIN" || role === "MANAGER";

  const showToast = useCallback((toast) => {
    const id = Date.now() + Math.random().toString(36).substr(2, 9);
    setToasts(prev => [...prev, { ...toast, id }]);
    setTimeout(() => {
      setToasts(prev => prev.filter(t => t.id !== id));
    }, 6000);
  }, []);

  const handleOnboardManualToggle = useCallback((access) => {
    setOnboardManualAccess(prev => {
      const newAccess = new Set(prev);
      if (newAccess.has(access)) {
        newAccess.delete(access);
      } else {
        newAccess.add(access);
      }
      return newAccess;
    });
  }, []);

  const handleOnboardAutomateToggle = useCallback((access) => {
    setOnboardAutomateAccess(prev => {
      const newAccess = new Set(prev);
      if (newAccess.has(access)) {
        newAccess.delete(access);
      } else {
        newAccess.add(access);
      }
      return newAccess;
    });
  }, []);

  const fetchUserAccesses = useCallback(async (userId) => {
    try {
      const res = await fetchWithAuth(`${API_URL}/users/${userId}/access`);
      const json = await res.json();
      if (json.success) {
        const activeAccesses = json.data.map(item => {
          const serviceDetails = services.find(s => s.service_id?.toString() === item.service?.service_id?.toString());
          return {
            ...item,
            is_automate: serviceDetails ? serviceDetails.is_automate : false
          };
        });

        setUserAccesses(activeAccesses);

        const manualAcc = activeAccesses.filter(item => !item.is_automate).map(item => item.service?.service_name).filter(Boolean);
        const automateAcc = activeAccesses.filter(item => item.is_automate).map(item => item.service?.service_name).filter(Boolean);

        setSelectedUser(prev => prev ? { ...prev, manualAccesses: manualAcc, automateAccesses: automateAcc } : null);
        setManualAccess(new Set(manualAcc));
        setAutomateAccess(new Set(automateAcc));
      }
    } catch (err) {
      console.error("Failed to fetch accesses", err);
    }
  }, [services]);

  const fetchDiscordStatus = useCallback(async (userId) => {
    try {
      const res = await fetchWithAuth(`${API_URL}/discord/users/${userId}/status`);
      const json = await res.json();
      setDiscordStatus(json.success ? json : null);
    } catch (err) {
      console.error("Failed to fetch Discord status", err);
      setDiscordStatus(null);
    }
  }, []);

  const fetchUserLogs = useCallback(async (userId) => {
    if (!userId) return;
    setIsLogsLoading(true);
    try {
      const res = await fetchWithAuth(`${API_URL}/users/${userId}/logs`);
      const json = await res.json();
      if (json.success) {
        setUserLogs(json.data || []);
        setLogsSummary(json.summary || null);
      }
    } catch (err) {
      console.error("Failed to fetch user logs", err);
    } finally {
      setIsLogsLoading(false);
    }
  }, []);

  const fetchUsers = useCallback(async () => {
    try {
      const res = await fetchWithAuth(`${API_URL}/users`);
      const json = await res.json();
      if (json.success) {
        setUsers(json.data);
      }
    } catch (err) {
      console.error("Failed to fetch users", err);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!isAuthenticated) return;

    const fetchServices = async () => {
      try {
        const res = await fetchWithAuth(`${API_URL}/services`);
        const json = await res.json();
        if (json.success) {
          setServices(json.data);
        }
      } catch (err) {
        console.error("Failed to fetch services", err);
      }
    };
    fetchUsers();
    fetchServices();
  }, [isAuthenticated, fetchUsers]);

  const handleManualAccessToggle = useCallback((access) => {
    setManualAccess(prev => {
      const newAccess = new Set(prev);
      if (newAccess.has(access)) {
        newAccess.delete(access);
      } else {
        newAccess.add(access);
      }
      return newAccess;
    });
  }, []);

  const handleAutomateAccessToggle = useCallback((access) => {
    setAutomateAccess(prev => {
      const newAccess = new Set(prev);
      if (newAccess.has(access)) {
        newAccess.delete(access);
      } else {
        newAccess.add(access);
      }
      return newAccess;
    });
  }, []);

  const offboardAccesses = useCallback(async (accessesToOffboard, isAutomate) => {
    if (!selectedUser) return;
    setIsOffboarding(true);

    const promises = accessesToOffboard.map(async (serviceName) => {
      const accessRecord = userAccesses.find(a => a.service?.service_name === serviceName);
      if (!accessRecord) {
        showToast({
          type: "offboard",
          isAutomate,
          success: false,
          title: `Failed to revoke "${serviceName}" Permission from ${selectedUser.name}`,
          subtitle: "Error: Access record not found",
          details: []
        });
        return { name: serviceName, success: false };
      }

      const serviceCode = accessRecord.service?.service_code;
      let endpoint = "";
      let method = "DELETE";

      if (serviceCode === "GOOGLE_PLAY_CONSOLE") {
        endpoint = `${API_URL}/google-play/users/${selectedUser.id}`;
      } else if (serviceCode === "BIG_QUERY") {
        endpoint = `${API_URL}/bigquery/users/${selectedUser.id}`;
      } else if (serviceCode === "GOOGLE_DRIVE") {
        endpoint = `${API_URL}/google-drive/users/${selectedUser.id}`;
      } else if (serviceCode === "GOOGLE_ANALYTICS") {
        endpoint = `${API_URL}/google-analytics/users/${selectedUser.id}`;
      } else if (serviceCode === "APPLE_STORE_CONNECT") {
        endpoint = `${API_URL}/appleStoreConnect/users/${selectedUser.id}`;
      } else if (serviceCode === "GOOGLE_CLOUD") {
        endpoint = `${API_URL}/google-cloud/users/${selectedUser.id}`;
      } else if (serviceCode === "FIREBASE") {
        endpoint = `${API_URL}/firebase/users/${selectedUser.id}`;
      } else if (serviceCode === "KANBOARD") {
        endpoint = `${API_URL}/kanboard/users/${selectedUser.id}`;
      } else if (serviceCode === "DISCORD") {
        endpoint = `${API_URL}/discord/users/${selectedUser.id}`;
      } else {
        endpoint = `${API_URL}/users/${selectedUser.id}/access/${accessRecord.access_id}`;
      }

      try {
        const response = await fetchWithAuth(endpoint, { method });
        const data = await response.json();
        const isSuccess = response.ok && data.success;
        showToast({
          type: "offboard",
          isAutomate,
          success: isSuccess,
          title: isSuccess
            ? `Successfully Revoked "${serviceName}" Permission from ${selectedUser.name}`
            : `Failed to revoke "${serviceName}" Permission from ${selectedUser.name}`,
          subtitle: isSuccess ? (data.message || "") : (data.message || data.error || "Unknown error"),
          details: data.data || []
        });
        return { name: serviceName, success: isSuccess };
      } catch (err) {
        showToast({
          type: "offboard",
          isAutomate,
          success: false,
          title: `Failed to revoke "${serviceName}" Permission from ${selectedUser.name}`,
          subtitle: `Error: ${err.message}`,
          details: []
        });
        return { name: serviceName, success: false };
      }
    });

    await Promise.all(promises);
    setIsOffboarding(false);
    fetchUserAccesses(selectedUser.id);
    fetchUserLogs(selectedUser.id);
    if (selectedUser) fetchDiscordStatus(selectedUser.id);
  }, [selectedUser, userAccesses, showToast, fetchUserAccesses, fetchUserLogs, fetchDiscordStatus]);

  const onboardAccesses = useCallback(async (accessesToOnboard, isAutomate) => {
    if (!selectedUser) return;
    setIsOnboarding(true);

    const promises = accessesToOnboard.map(async (serviceName) => {
      const serviceObj = services.find(s => s.service_name === serviceName);
      if (!serviceObj) {
        showToast({
          type: "onboard",
          isAutomate,
          success: false,
          title: `Failed to grant "${serviceName}" Permission to ${selectedUser.name}`,
          subtitle: "Error: Service details not found",
          details: []
        });
        return { name: serviceName, success: false };
      }

      const serviceCode = serviceObj.service_code;
      let endpoint = "";
      let method = "POST";
      let bodyData = null;

      if (serviceCode === "GOOGLE_PLAY_CONSOLE") {
        endpoint = `${API_URL}/google-play/users/${selectedUser.id}`;
      } else if (serviceCode === "BIG_QUERY") {
        endpoint = `${API_URL}/bigquery/users/${selectedUser.id}`;
      } else if (serviceCode === "GOOGLE_DRIVE") {
        endpoint = `${API_URL}/google-drive/users/${selectedUser.id}`;
      } else if (serviceCode === "GOOGLE_ANALYTICS") {
        endpoint = `${API_URL}/google-analytics/users/${selectedUser.id}`;
      } else if (serviceCode === "APPLE_STORE_CONNECT") {
        endpoint = `${API_URL}/appleStoreConnect/users/${selectedUser.id}`;
      } else if (serviceCode === "GOOGLE_CLOUD") {
        endpoint = `${API_URL}/google-cloud/users/${selectedUser.id}`;
      } else if (serviceCode === "FIREBASE") {
        endpoint = `${API_URL}/firebase/users/${selectedUser.id}`;
      } else if (serviceCode === "KANBOARD") {
        endpoint = `${API_URL}/kanboard/users/${selectedUser.id}`;
      } else if (serviceCode === "DISCORD") {
        endpoint = `${API_URL}/discord/users/${selectedUser.id}`;
      } else {
        endpoint = `${API_URL}/users/${selectedUser.id}/access`;
        bodyData = JSON.stringify({ service_id: serviceObj.service_id });
      }

      try {
        const fetchOpts = { method };
        if (bodyData) fetchOpts.body = bodyData;
        const response = await fetchWithAuth(endpoint, fetchOpts);
        const data = await response.json();
        const isSuccess = response.ok && data.success;
        showToast({
          type: "onboard",
          isAutomate,
          success: isSuccess,
          title: isSuccess
            ? `Successfully Granted "${serviceName}" Permission to ${selectedUser.name}`
            : `Failed to grant "${serviceName}" Permission to ${selectedUser.name}`,
          subtitle: isSuccess ? (data.message || "") : (data.message || data.error || "Unknown error"),
          details: data.data || []
        });
        return { name: serviceName, success: isSuccess };
      } catch (err) {
        showToast({
          type: "onboard",
          isAutomate,
          success: false,
          title: `Failed to grant "${serviceName}" Permission to ${selectedUser.name}`,
          subtitle: `Error: ${err.message}`,
          details: []
        });
        return { name: serviceName, success: false };
      }
    });

    await Promise.all(promises);
    setIsOnboarding(false);
    setOnboardManualAccess(new Set());
    setOnboardAutomateAccess(new Set());
    fetchUserAccesses(selectedUser.id);
    fetchUserLogs(selectedUser.id);
    if (selectedUser) fetchDiscordStatus(selectedUser.id);
  }, [selectedUser, services, showToast, fetchUserAccesses, fetchUserLogs, fetchDiscordStatus]);

  const handleUserSelect = useCallback((user) => {
    setSelectedUser(user);
    setManualAccess(new Set());
    setAutomateAccess(new Set());
    setOnboardManualAccess(new Set());
    setOnboardAutomateAccess(new Set());
    setIsAccessLoading(true);
    fetchUserAccesses(user.id).finally(() => setIsAccessLoading(false));
    fetchDiscordStatus(user.id);
    fetchUserLogs(user.id);
  }, [fetchUserAccesses, fetchDiscordStatus, fetchUserLogs]);

  const handleManualOffboard = useCallback(() => {
    const permissions = Array.from(manualAccess);
    if (permissions.length === 0) return;
    setConfirmModal({
      isOpen: true,
      type: "offboard",
      isAutomate: false,
      permissions,
      userName: selectedUser?.name || ""
    });
  }, [manualAccess, selectedUser]);

  const handleAutomateOffboard = useCallback(() => {
    const permissions = Array.from(automateAccess);
    if (permissions.length === 0) return;
    setConfirmModal({
      isOpen: true,
      type: "offboard",
      isAutomate: true,
      permissions,
      userName: selectedUser?.name || ""
    });
  }, [automateAccess, selectedUser]);

  const handleOnboardManual = useCallback(() => {
    const permissions = Array.from(onboardManualAccess);
    if (permissions.length === 0) return;
    setConfirmModal({
      isOpen: true,
      type: "onboard",
      isAutomate: false,
      permissions,
      userName: selectedUser?.name || ""
    });
  }, [onboardManualAccess, selectedUser]);

  const handleOnboardAutomate = useCallback(() => {
    const permissions = Array.from(onboardAutomateAccess);
    if (permissions.length === 0) return;
    setConfirmModal({
      isOpen: true,
      type: "onboard",
      isAutomate: true,
      permissions,
      userName: selectedUser?.name || ""
    });
  }, [onboardAutomateAccess, selectedUser]);

  const filteredUsers = useMemo(() => {
    if (!searchQuery.trim()) return users;
    const query = searchQuery.toLowerCase();
    return users.filter(u =>
      u.name.toLowerCase().includes(query) ||
      u.email.toLowerCase().includes(query)
    );
  }, [users, searchQuery]);

  const activeCount = useMemo(() => users.filter(u => u.is_active).length, [users]);
  const inactiveCount = useMemo(() => users.filter(u => !u.is_active).length, [users]);

  const inactiveServices = useMemo(() => {
    return services.filter(service => {
      return !userAccesses.some(a => a.service?.service_id?.toString() === service.service_id?.toString());
    });
  }, [services, userAccesses]);

  const onboardManualServices = useMemo(() => inactiveServices.filter(s => !s.is_automate), [inactiveServices]);
  const onboardAutomateServices = useMemo(() => inactiveServices.filter(s => s.is_automate), [inactiveServices]);

  const handleCloseModal = useCallback(() => {
    setConfirmModal(prev => ({ ...prev, isOpen: false }));
  }, []);

  const handleConfirmModal = useCallback(() => {
    setConfirmModal(prev => {
      const { type, isAutomate, permissions } = prev;
      if (type === "onboard") {
        onboardAccesses(permissions, isAutomate);
      } else {
        offboardAccesses(permissions, isAutomate);
      }
      return { ...prev, isOpen: false };
    });
  }, [onboardAccesses, offboardAccesses]);

  const handleCloseToast = useCallback((id) => {
    setToasts(prev => prev.filter(t => t.id !== id));
  }, []);

  if (isAuthLoading) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center">
        <div className="flex flex-col items-center gap-3">
          <RefreshCw className="w-8 h-8 text-blue-600 animate-spin" />
          <p className="text-sm font-medium text-slate-600">Verifying session...</p>
        </div>
      </div>
    );
  }

  if (!isAuthenticated) {
    return <LoginPage />;
  }

  return (
    <div className="size-full bg-slate-50 p-8 min-h-screen">
      <div className="mx-auto max-w-7xl">
        <Header activeCount={activeCount} inactiveCount={inactiveCount} />

        {/* Navigation Tabs for Managers & Admins */}
        {canManageRoles && (
          <div className="inline-flex p-1.5 bg-slate-200/60 rounded-2xl mb-6 backdrop-blur border border-slate-200/80 shadow-inner">
            <button
              onClick={() => {
                setActiveTab("access");
                fetchUsers();
                if (selectedUser?.id) {
                  fetchUserAccesses(selectedUser.id);
                  fetchDiscordStatus(selectedUser.id);
                  fetchUserLogs(selectedUser.id);
                }
              }}
              className={`px-4 py-2 font-semibold text-xs sm:text-sm rounded-xl flex items-center gap-2 transition-all cursor-pointer ${activeTab === "access"
                  ? "bg-white text-blue-600 shadow-sm shadow-slate-200 font-bold"
                  : "text-slate-600 hover:text-slate-900"
                }`}
            >
              <Users className="w-4 h-4" />
              Software Access Management
            </button>
            <button
              onClick={() => setActiveTab("roles")}
              className={`px-4 py-2 font-semibold text-xs sm:text-sm rounded-xl flex items-center gap-2 transition-all cursor-pointer ${activeTab === "roles"
                  ? "bg-white text-blue-600 shadow-sm shadow-slate-200 font-bold"
                  : "text-slate-600 hover:text-slate-900"
                }`}
            >
              <ShieldCheck className="w-4 h-4" />
              Cerberus Console Roles & Access
            </button>
          </div>
        )}

        {/* Content Section */}
        {activeTab === "roles" && canManageRoles ? (
          <RoleManagementCard showToast={showToast} />
        ) : (
          <>
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 items-stretch">
              <div className="lg:col-span-1">
                <OnboardAccessCard
                  selectedUser={selectedUser}
                  isAccessLoading={isAccessLoading}
                  onboardManualServices={onboardManualServices}
                  onboardAutomateServices={onboardAutomateServices}
                  onboardManualAccess={onboardManualAccess}
                  onboardAutomateAccess={onboardAutomateAccess}
                  onManualToggle={handleOnboardManualToggle}
                  onAutomateToggle={handleOnboardAutomateToggle}
                  onOnboardManualClick={handleOnboardManual}
                  onOnboardAutomateClick={handleOnboardAutomate}
                  isOnboarding={isOnboarding}
                />
              </div>

              <div className="lg:col-span-1 flex flex-col gap-6">
                <UserInfoCard selectedUser={selectedUser} />
                <UserList
                  users={users}
                  filteredUsers={filteredUsers}
                  selectedUser={selectedUser}
                  searchQuery={searchQuery}
                  onSearchChange={setSearchQuery}
                  onUserSelect={handleUserSelect}
                  isLoading={isLoading}
                  onRefreshUsers={fetchUsers}
                />
              </div>

              <div className="lg:col-span-1">
                <OffboardAccessCard
                  selectedUser={selectedUser}
                  isAccessLoading={isAccessLoading}
                  userAccesses={userAccesses}
                  manualAccess={manualAccess}
                  automateAccess={automateAccess}
                  onManualToggle={handleManualAccessToggle}
                  onAutomateToggle={handleAutomateAccessToggle}
                  onOffboardManualClick={handleManualOffboard}
                  onOffboardAutomateClick={handleAutomateOffboard}
                  isOffboarding={isOffboarding}
                  discordStatus={discordStatus}
                />
              </div>
            </div>

            {selectedUser && (
              <ActivityLogsCard
                selectedUser={selectedUser}
                logs={userLogs}
                isLoading={isLogsLoading}
                summary={logsSummary}
              />
            )}
          </>
        )}

        <ConfirmModal
          isOpen={confirmModal.isOpen}
          type={confirmModal.type}
          isAutomate={confirmModal.isAutomate}
          permissions={confirmModal.permissions}
          userName={confirmModal.userName}
          onClose={handleCloseModal}
          onConfirm={handleConfirmModal}
        />

        <ToastContainer
          toasts={toasts}
          onCloseToast={handleCloseToast}
        />

        {requiresPasswordChange && <ResetPasswordModal />}
      </div>
    </div>
  );
}

export default function App() {
  return (
    <GoogleOAuthProvider clientId={GOOGLE_CLIENT_ID}>
      <AuthProvider>
        <MainDashboard />
      </AuthProvider>
    </GoogleOAuthProvider>
  );
}