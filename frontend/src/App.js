import { useState, useEffect, useMemo, useCallback } from "react";
import Header from "./components/Header";
import UserList from "./components/UserList";
import UserInfoCard from "./components/UserInfoCard";
import OnboardAccessCard from "./components/OnboardAccessCard";
import OffboardAccessCard from "./components/OffboardAccessCard";
import ConfirmModal from "./components/ConfirmModal";
import ToastContainer from "./components/ToastContainer";

const API_URL = process.env.REACT_APP_API_URL;

export default function App() {
  const [users, setUsers] = useState([]);
  const [services, setServices] = useState([]);
  const [selectedUser, setSelectedUser] = useState(null);
  const [manualAccess, setManualAccess] = useState(new Set());
  const [automateAccess, setAutomateAccess] = useState(new Set());
  const [onboardManualAccess, setOnboardManualAccess] = useState(new Set());
  const [onboardAutomateAccess, setOnboardAutomateAccess] = useState(new Set());
  const [userAccesses, setUserAccesses] = useState([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [isLoading, setIsLoading] = useState(true);
  const [isAccessLoading, setIsAccessLoading] = useState(false);
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
      const res = await fetch(`${API_URL}/users/${userId}/access`);
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

  useEffect(() => {
    const fetchUsers = async () => {
      try {
        const res = await fetch(`${API_URL}/users`);
        const json = await res.json();
        if (json.success) {
          setUsers(json.data);
        }
      } catch (err) {
        console.error("Failed to fetch users", err);
      } finally {
        setIsLoading(false);
      }
    };
    const fetchServices = async () => {
      try {
        const res = await fetch(`${API_URL}/services`);
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
  }, []);

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

    const results = [];
    for (const serviceName of accessesToOffboard) {
      const accessRecord = userAccesses.find(a => a.service?.service_name === serviceName);
      if (!accessRecord) {
        results.push({ name: serviceName, success: false, message: "Access record not found" });
        continue;
      }

      const serviceCode = accessRecord.service?.service_code;
      let endpoint = "";
      let method = "DELETE";

      if (isAutomate) {
        if (serviceCode === "GOOGLE_PLAY_CONSOLE") {
          endpoint = `${API_URL}/google-play/users/${selectedUser.user_id}`;
        } else if (serviceCode === "BIG_QUERY") {
          endpoint = `${API_URL}/bigquery/users/${selectedUser.user_id}`;
        } else if (serviceCode === "GOOGLE_DRIVE") {
          endpoint = `${API_URL}/google-drive/users/${selectedUser.user_id}`;
        } else if (serviceCode === "GOOGLE_ANALYTICS") {
          endpoint = `${API_URL}/google-analytics/users/${selectedUser.user_id}`;
        } else if (serviceCode === "APPLE_STORE_CONNECT") {
          endpoint = `${API_URL}/appleStoreConnect/users/${selectedUser.user_id}`;
        } else {
          results.push({ name: serviceName, success: false, message: "No endpoint created" });
          continue;
        }
      } else {
        results.push({ name: serviceName, success: false, message: "No endpoint created" });
        continue;
      }

      try {
        const response = await fetch(endpoint, {
          method: method
        });
        const data = await response.json();
        if (response.ok && data.success) {
          results.push({ name: serviceName, success: true, message: data.message });
        } else {
          results.push({ name: serviceName, success: false, message: data.message || "Failed to offboard" });
        }
      } catch (err) {
        results.push({ name: serviceName, success: false, message: err.message || "Network error" });
      }
    }

    // Process results
    const successful = results.filter(r => r.success);

    if (successful.length > 0) {
      const successfulNames = successful.map(r => r.name);

      // Update sets
      if (isAutomate) {
        setAutomateAccess(prev => {
          const newAutomateAccess = new Set(prev);
          successfulNames.forEach(name => newAutomateAccess.delete(name));
          return newAutomateAccess;
        });
      } else {
        setManualAccess(prev => {
          const newManualAccess = new Set(prev);
          successfulNames.forEach(name => newManualAccess.delete(name));
          return newManualAccess;
        });
      }

      await fetchUserAccesses(selectedUser.user_id);
    }

    results.forEach(result => {
      const title = result.success
        ? `${result.name} Permission successfully revoked from ${selectedUser.name}`
        : `Failed to revoke "${result.name}" Permission from ${selectedUser.name}`;
      const subtitle = result.success
        ? `${isAutomate ? "Automated" : "Manual"} offboarding complete`
        : `Error: ${result.message || "Request failed"}`;
      showToast({
        type: "offboard",
        isAutomate,
        success: result.success,
        title,
        subtitle,
        details: []
      });
    });

    setIsOffboarding(false);
  }, [selectedUser, userAccesses, fetchUserAccesses, showToast]);

  const handleManualOffboard = useCallback(() => {
    if (!selectedUser || manualAccess.size === 0) return;
    setConfirmModal({
      isOpen: true,
      type: "offboard",
      isAutomate: false,
      permissions: Array.from(manualAccess),
      userName: selectedUser.name
    });
  }, [selectedUser, manualAccess]);

  const handleAutomateOffboard = useCallback(() => {
    if (!selectedUser || automateAccess.size === 0) return;
    setConfirmModal({
      isOpen: true,
      type: "offboard",
      isAutomate: true,
      permissions: Array.from(automateAccess),
      userName: selectedUser.name
    });
  }, [selectedUser, automateAccess]);

  const onboardAccesses = useCallback(async (accessesToOnboard, isAutomate) => {
    if (!selectedUser) return;
    setIsOnboarding(true);

    const results = [];
    for (const serviceName of accessesToOnboard) {
      const service = services.find(s => s.service_name === serviceName);
      if (!service) {
        results.push({ name: serviceName, success: false, message: "Service definition not found" });
        continue;
      }

      const serviceCode = service.service_code;
      let endpoint = "";
      let method = "POST";

      if (serviceCode === "GOOGLE_PLAY_CONSOLE") {
        endpoint = `${API_URL}/google-play/users/${selectedUser.user_id}`;
      } else if (serviceCode === "GOOGLE_DRIVE") {
        endpoint = `${API_URL}/google-drive/users/${selectedUser.user_id}`;
      } else if (serviceCode === "BIG_QUERY") {
        endpoint = `${API_URL}/bigquery/users/${selectedUser.user_id}`;
      } else if (serviceCode === "APPLE_STORE_CONNECT") {
        endpoint = `${API_URL}/appleStoreConnect/users/${selectedUser.user_id}`;
      } else {
        results.push({ name: serviceName, success: false, message: "No endpoint created" });
        continue;
      }

      try {
        const response = await fetch(endpoint, {
          method: method,
          headers: {
            "Content-Type": "application/json"
          }
        });
        const data = await response.json();
        if (response.ok && data.success) {
          results.push({ name: serviceName, success: true, message: data.message });
        } else {
          results.push({ name: serviceName, success: false, message: data.message || "Failed to onboard" });
        }
      } catch (err) {
        results.push({ name: serviceName, success: false, message: err.message || "Network error" });
      }
    }

    // Process results
    const successful = results.filter(r => r.success);

    if (successful.length > 0) {
      const successfulNames = successful.map(r => r.name);

      // Clear the selections on Onboard card
      if (isAutomate) {
        setOnboardAutomateAccess(prev => {
          const newOnboardAutomate = new Set(prev);
          successfulNames.forEach(name => newOnboardAutomate.delete(name));
          return newOnboardAutomate;
        });
      } else {
        setOnboardManualAccess(prev => {
          const newOnboardManual = new Set(prev);
          successfulNames.forEach(name => newOnboardManual.delete(name));
          return newOnboardManual;
        });
      }

      await fetchUserAccesses(selectedUser.user_id);
    }

    results.forEach(result => {
      const title = result.success
        ? `${result.name} Permission successfully granted to ${selectedUser.name}`
        : `Failed to grant "${result.name}" Permission to ${selectedUser.name}`;
      const subtitle = result.success
        ? `${isAutomate ? "Automated" : "Manual"} onboarding complete`
        : `Error: ${result.message || "Request failed"}`;
      showToast({
        type: "onboard",
        isAutomate,
        success: result.success,
        title,
        subtitle,
        details: []
      });
    });

    setIsOnboarding(false);
  }, [selectedUser, services, fetchUserAccesses, showToast]);

  const handleOnboardManual = useCallback(() => {
    if (!selectedUser || onboardManualAccess.size === 0) return;
    setConfirmModal({
      isOpen: true,
      type: "onboard",
      isAutomate: false,
      permissions: Array.from(onboardManualAccess),
      userName: selectedUser.name
    });
  }, [selectedUser, onboardManualAccess]);

  const handleOnboardAutomate = useCallback(() => {
    if (!selectedUser || onboardAutomateAccess.size === 0) return;
    setConfirmModal({
      isOpen: true,
      type: "onboard",
      isAutomate: true,
      permissions: Array.from(onboardAutomateAccess),
      userName: selectedUser.name
    });
  }, [selectedUser, onboardAutomateAccess]);

  const handleUserSelect = useCallback(async (user) => {
    setSelectedUser(user);
    setOnboardManualAccess(new Set());
    setOnboardAutomateAccess(new Set());
    setManualAccess(new Set());
    setAutomateAccess(new Set());

    if (!user.is_active) {
      setUserAccesses([]);
      return;
    }

    setIsAccessLoading(true);
    await fetchUserAccesses(user.user_id);
    setIsAccessLoading(false);
  }, [fetchUserAccesses]);

  // Filter users based on search query
  const filteredUsers = useMemo(() => {
    const query = searchQuery.toLowerCase();
    return users.filter(user => {
      const matchesName = user.name?.toLowerCase().includes(query) || false;
      const matchesEmail = user.email?.toLowerCase().includes(query) || false;
      return matchesName || matchesEmail;
    });
  }, [users, searchQuery]);

  const activeCount = useMemo(() => users.filter(u => u.is_active).length, [users]);
  const inactiveCount = useMemo(() => users.filter(u => !u.is_active).length, [users]);

  // Get all services that the user does NOT have active access to
  const inactiveServices = useMemo(() => {
    return services.filter(service => {
      return !userAccesses.some(a => a.service?.service_id?.toString() === service.service_id?.toString());
    });
  }, [services, userAccesses]);

  const onboardManualServices = useMemo(() => inactiveServices.filter(s => !s.is_automate), [inactiveServices]);
  const onboardAutomateServices = useMemo(() => inactiveServices.filter(s => s.is_automate), [inactiveServices]);

  return (
    <div className="size-full bg-gray-50 p-8 min-h-screen">
      <div className="mx-auto max-w-7xl">
        <Header activeCount={activeCount} inactiveCount={inactiveCount} />

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 items-stretch">
          {/* Onboard Access (Left Column) */}
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

          {/* Selected User Info & All Users List (Middle Column) */}
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
            />
          </div>

          {/* Offboard Access (Right Column) */}
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
            />
          </div>
        </div>

        {/* Confirmation Modal */}
        <ConfirmModal
          isOpen={confirmModal.isOpen}
          type={confirmModal.type}
          isAutomate={confirmModal.isAutomate}
          permissions={confirmModal.permissions}
          userName={confirmModal.userName}
          onClose={useCallback(() => setConfirmModal(prev => ({ ...prev, isOpen: false })), [])}
          onConfirm={useCallback(() => {
            setConfirmModal(prev => {
              const { type, isAutomate, permissions } = prev;
              if (type === "onboard") {
                onboardAccesses(permissions, isAutomate);
              } else {
                offboardAccesses(permissions, isAutomate);
              }
              return { ...prev, isOpen: false };
            });
          }, [onboardAccesses, offboardAccesses])}
        />

        {/* Toast Notifications */}
        <ToastContainer
          toasts={toasts}
          onCloseToast={useCallback(id => setToasts(prev => prev.filter(t => t.id !== id)), [])}
        />
      </div>
    </div>
  );
}