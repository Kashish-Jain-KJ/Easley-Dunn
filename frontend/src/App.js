import { useState, useEffect } from "react";
import { Button } from "./components/ui/button";
import { Checkbox } from "./components/ui/checkbox";
import { Card, CardContent, CardHeader, CardTitle } from "./components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "./components/ui/tabs";
import { Input } from "./components/ui/input";
import {
  UserCircle,
  Search,
  Loader2,
  UserPlus,
  UserMinus,
  Shield,
  Play,
  Database,
  BarChart2,
  Mail,
  Bolt,
  Lock,
  Calendar,
  FileText,
  X
} from "lucide-react";
import { Badge } from "./components/ui/badge";

const API_URL = process.env.REACT_APP_API_URL || "http://localhost:5001";

const getServiceIcon = (serviceCode, serviceName) => {
  const code = serviceCode?.toUpperCase() || "";
  const name = serviceName?.toLowerCase() || "";

  if (code.includes("PLAY") || name.includes("play")) return Play;
  if (code.includes("BIG_QUERY") || code.includes("BIGQUERY") || name.includes("bigquery") || name.includes("big query") || name.includes("database")) return Database;
  if (code.includes("DRIVE") || name.includes("drive")) return Shield;
  if (code.includes("ANALYTICS") || name.includes("analytics")) return BarChart2;
  if (name.includes("email") || name.includes("mail")) return Mail;
  if (name.includes("slack")) return Bolt;
  if (name.includes("github") || name.includes("organization") || name.includes("vpn") || name.includes("access")) return Lock;
  if (name.includes("calendar")) return Calendar;
  if (name.includes("confluence") || name.includes("jira") || name.includes("wiki")) return FileText;

  return Shield;
};




export default function App() {
  const [users, setUsers] = useState([]);
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

  const showToast = (toast) => {
    const id = Date.now() + Math.random().toString(36).substr(2, 9);
    setToasts(prev => [...prev, { ...toast, id }]);
    setTimeout(() => {
      setToasts(prev => prev.filter(t => t.id !== id));
    }, 6000);
  };

  const handleOnboardManualToggle = access => {
    const newAccess = new Set(onboardManualAccess);
    if (newAccess.has(access)) {
      newAccess.delete(access);
    } else {
      newAccess.add(access);
    }
    setOnboardManualAccess(newAccess);
  };

  const handleOnboardAutomateToggle = access => {
    const newAccess = new Set(onboardAutomateAccess);
    if (newAccess.has(access)) {
      newAccess.delete(access);
    } else {
      newAccess.add(access);
    }
    setOnboardAutomateAccess(newAccess);
  };

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
    fetchUsers();
  }, []);

  const handleManualAccessToggle = access => {
    const newAccess = new Set(manualAccess);
    if (newAccess.has(access)) {
      newAccess.delete(access);
    } else {
      newAccess.add(access);
    }
    setManualAccess(newAccess);
  };

  const handleAutomateAccessToggle = access => {
    const newAccess = new Set(automateAccess);
    if (newAccess.has(access)) {
      newAccess.delete(access);
    } else {
      newAccess.add(access);
    }
    setAutomateAccess(newAccess);
  };

  const offboardAccesses = async (accessesToOffboard, isAutomate) => {
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
      const accessId = accessRecord.access_id;
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
        } else {
          // Fallback to manual/generic endpoint for automated services
          endpoint = `${API_URL}/users/${selectedUser.user_id}/access/${accessId}/offboard`;
          method = "POST";
        }
      } else {
        // Fallback to manual/generic endpoint for manual services
        endpoint = `${API_URL}/users/${selectedUser.user_id}/access/${accessId}/offboard`;
        method = "POST";
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
        const newAutomateAccess = new Set(automateAccess);
        successfulNames.forEach(name => newAutomateAccess.delete(name));
        setAutomateAccess(newAutomateAccess);
      } else {
        const newManualAccess = new Set(manualAccess);
        successfulNames.forEach(name => newManualAccess.delete(name));
        setManualAccess(newManualAccess);
      }

      // Update selectedUser list to remove offboarded accesses from display
      setSelectedUser(prev => {
        if (!prev) return null;
        if (isAutomate) {
          return {
            ...prev,
            automateAccesses: (prev.automateAccesses || []).filter(name => !successfulNames.includes(name))
          };
        } else {
          return {
            ...prev,
            manualAccesses: (prev.manualAccesses || []).filter(name => !successfulNames.includes(name))
          };
        }
      });

      // Update userAccesses state
      setUserAccesses(prev =>
        prev.map(a => {
          if (a.service?.service_name && successfulNames.includes(a.service.service_name)) {
            return { ...a, is_active: false };
          }
          return a;
        })
      );
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
  };

  const handleManualOffboard = () => {
    if (!selectedUser || manualAccess.size === 0) return;
    setConfirmModal({
      isOpen: true,
      type: "offboard",
      isAutomate: false,
      permissions: Array.from(manualAccess),
      userName: selectedUser.name
    });
  };

  const handleAutomateOffboard = () => {
    if (!selectedUser || automateAccess.size === 0) return;
    setConfirmModal({
      isOpen: true,
      type: "offboard",
      isAutomate: true,
      permissions: Array.from(automateAccess),
      userName: selectedUser.name
    });
  };

  const onboardAccesses = async (accessesToOnboard, isAutomate) => {
    if (!selectedUser) return;
    setIsOnboarding(true);

    const results = [];
    for (const serviceName of accessesToOnboard) {
      const accessRecord = userAccesses.find(a => a.service?.service_name === serviceName);
      if (!accessRecord) {
        results.push({ name: serviceName, success: false, message: "Access record not found" });
        continue;
      }

      const serviceCode = accessRecord.service?.service_code;
      const accessId = accessRecord.access_id;
      let endpoint = "";
      let method = "POST";

      if (isAutomate) {
        if (serviceCode === "GOOGLE_PLAY_CONSOLE") {
          endpoint = `${API_URL}/google-play/users/${selectedUser.user_id}`;
        } else if (serviceCode === "GOOGLE_DRIVE") {
          endpoint = `${API_URL}/google-drive/users/${selectedUser.user_id}`;
        } else if (serviceCode === "BIG_QUERY") {
          endpoint = `${API_URL}/bigquery/users/${selectedUser.user_id}`;
        } else {
          // Fallback to manual/generic endpoint for automated services
          endpoint = `${API_URL}/users/${selectedUser.user_id}/access/${accessId}/onboard`;
        }
      } else {
        // Manual access onboarding via generic endpoint
        endpoint = `${API_URL}/users/${selectedUser.user_id}/access/${accessId}/onboard`;
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
        const newOnboardAutomate = new Set(onboardAutomateAccess);
        successfulNames.forEach(name => newOnboardAutomate.delete(name));
        setOnboardAutomateAccess(newOnboardAutomate);
      } else {
        const newOnboardManual = new Set(onboardManualAccess);
        successfulNames.forEach(name => newOnboardManual.delete(name));
        setOnboardManualAccess(newOnboardManual);
      }

      // Add to Offboard card selection (pre-check)
      if (isAutomate) {
        const newAutomateAccess = new Set(automateAccess);
        successfulNames.forEach(name => newAutomateAccess.add(name));
        setAutomateAccess(newAutomateAccess);
      } else {
        const newManualAccess = new Set(manualAccess);
        successfulNames.forEach(name => newManualAccess.add(name));
        setManualAccess(newManualAccess);
      }

      // Update userAccesses state
      setUserAccesses(prev =>
        prev.map(a => {
          if (a.service?.service_name && successfulNames.includes(a.service.service_name)) {
            return { ...a, is_active: true };
          }
          return a;
        })
      );
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
  };

  const handleOnboardManual = () => {
    if (!selectedUser || onboardManualAccess.size === 0) return;
    setConfirmModal({
      isOpen: true,
      type: "onboard",
      isAutomate: false,
      permissions: Array.from(onboardManualAccess),
      userName: selectedUser.name
    });
  };

  const handleOnboardAutomate = () => {
    if (!selectedUser || onboardAutomateAccess.size === 0) return;
    setConfirmModal({
      isOpen: true,
      type: "onboard",
      isAutomate: true,
      permissions: Array.from(onboardAutomateAccess),
      userName: selectedUser.name
    });
  };

  const handleUserSelect = async (user) => {
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
    try {
      const res = await fetch(`${API_URL}/users/${user.user_id}/access`);
      const json = await res.json();
      if (json.success) {
        setUserAccesses(json.data);
        const activeAccesses = json.data.filter(item => item.is_active);
        const manualAcc = activeAccesses.filter(item => !item.is_automate).map(item => item.service?.service_name).filter(Boolean);
        const automateAcc = activeAccesses.filter(item => item.is_automate).map(item => item.service?.service_name).filter(Boolean);

        const updatedUser = { ...user, manualAccesses: manualAcc, automateAccesses: automateAcc };
        setSelectedUser(updatedUser);
        setManualAccess(new Set(manualAcc));
        setAutomateAccess(new Set(automateAcc));
      }
    } catch (err) {
      console.error("Failed to fetch accesses", err);
    } finally {
      setIsAccessLoading(false);
    }
  };

  // Filter users based on search query
  const filteredUsers = users.filter(user => {
    const query = searchQuery.toLowerCase();
    const matchesName = user.name?.toLowerCase().includes(query) || false;
    const matchesEmail = user.email?.toLowerCase().includes(query) || false;
    return matchesName || matchesEmail;
  });

  return <div className="size-full bg-gray-50 p-8 min-h-screen">
    <div className="mx-auto max-w-7xl">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900">User Access Management</h1>
        <p className="mt-2 text-gray-600">Manage user access and offboarding</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 items-stretch">
        {/* Onboard Access (Left Column) */}
        <div className="lg:col-span-1">
          {selectedUser ? (
            <Card className="flex flex-col h-full border border-gray-200/80 shadow-md rounded-3xl overflow-hidden bg-white">
              <CardHeader className="bg-[#f2faf5] border-b border-[#e2f0e8] pb-5 pt-6 px-6">
                <div className="flex items-center gap-4">
                  <div className="p-3 bg-[#e6f6ee] rounded-2xl text-[#10a353] flex items-center justify-center shadow-xs">
                    <UserPlus className="size-6" />
                  </div>
                  <div>
                    <h3 className="font-bold text-gray-900 text-lg leading-tight">Onboard Access</h3>
                    <p className="text-xs text-gray-500 font-medium mt-0.5">Grant new permissions</p>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="pt-6 px-6 flex-1 flex flex-col">
                {isAccessLoading ? (
                  <div className="py-24 flex justify-center text-gray-500 flex-1 items-center">
                    <Loader2 className="animate-spin size-10 text-[#10a353]" />
                  </div>
                ) : (
                  <Tabs defaultValue="manual" className="w-full flex-1 flex flex-col">
                    <TabsList className="grid w-full grid-cols-2 bg-[#f3f4f6] p-1 rounded-2xl h-12">
                      <TabsTrigger value="manual" className="rounded-xl h-10 data-[state=active]:bg-white data-[state=active]:shadow-sm data-[state=active]:text-gray-900 text-gray-500 font-semibold text-sm transition-all">Manual</TabsTrigger>
                      <TabsTrigger value="automate" className="rounded-xl h-10 data-[state=active]:bg-white data-[state=active]:shadow-sm data-[state=active]:text-gray-900 text-gray-500 font-semibold text-sm transition-all">Automate</TabsTrigger>
                    </TabsList>

                    {/* Onboard Manual Tab */}
                    <TabsContent value="manual" className="mt-4 flex-grow flex flex-col justify-between">
                      <div>
                        <p className="text-[#8e98a8] text-sm mb-3 font-medium">Select permissions</p>
                        <div className="space-y-2.5 max-h-[350px] overflow-y-auto pr-1">
                          {userAccesses.filter(a => !a.is_active && !a.is_automate).length > 0 ? (
                            userAccesses
                              .filter(a => !a.is_active && !a.is_automate)
                              .map(access => {
                                const name = access.service?.service_name || "Unknown Service";
                                const code = access.service?.service_code || "";
                                const isSelected = onboardManualAccess.has(name);
                                const IconComponent = getServiceIcon(code, name);
                                return (
                                  <div
                                    key={access.access_id}
                                    onClick={() => handleOnboardManualToggle(name)}
                                    className={`flex items-center gap-3.5 px-4 py-3 rounded-2xl border transition-all duration-150 cursor-pointer select-none ${isSelected
                                      ? "bg-[#e8f8f0] border-[#a3e2bc] text-[#0d592f]"
                                      : "bg-white border-gray-200 text-gray-700 hover:border-gray-300"
                                      }`}
                                  >
                                    <Checkbox
                                      id={`onboard-manual-${access.access_id}`}
                                      checked={isSelected}
                                      onClick={(e) => e.stopPropagation()}
                                      onCheckedChange={() => handleOnboardManualToggle(name)}
                                      className="size-5 rounded-[6px] border-gray-300 data-[state=checked]:bg-[#111827] data-[state=checked]:border-[#111827] data-[state=checked]:text-white transition-colors"
                                    />
                                    <IconComponent className={`size-5 flex-shrink-0 ${isSelected ? "text-[#10a353]" : "text-gray-400"}`} />
                                    <span className="font-semibold text-[15px]">{name}</span>
                                  </div>
                                );
                              })
                          ) : (
                            <div className="py-12 text-center">
                              <p className="text-gray-400 text-sm">No manual permissions to onboard.</p>
                            </div>
                          )}
                        </div>
                      </div>

                      <div className="pt-4 mt-4 border-t border-gray-100">
                        <Button
                          onClick={handleOnboardManual}
                          className="w-full bg-[#10a353] hover:bg-[#0d8c47] text-white font-semibold rounded-xl py-6 text-base shadow-xs flex items-center justify-center gap-2 transition-colors"
                          disabled={onboardManualAccess.size === 0 || isOnboarding}
                        >
                          {isOnboarding ? (
                            <>
                              <Loader2 className="animate-spin mr-2 size-5" />
                              Onboarding...
                            </>
                          ) : (
                            <>
                              <UserPlus className="size-5" />
                              Onboard • {onboardManualAccess.size} selected
                            </>
                          )}
                        </Button>
                      </div>
                    </TabsContent>

                    {/* Onboard Automate Tab */}
                    <TabsContent value="automate" className="mt-4 flex-grow flex flex-col justify-between">
                      <div>
                        <p className="text-[#8e98a8] text-sm mb-3 font-medium">Select permissions</p>
                        <div className="space-y-2.5 max-h-[350px] overflow-y-auto pr-1">
                          {userAccesses.filter(a => !a.is_active && a.is_automate).length > 0 ? (
                            userAccesses
                              .filter(a => !a.is_active && a.is_automate)
                              .map(access => {
                                const name = access.service?.service_name || "Unknown Service";
                                const code = access.service?.service_code || "";
                                const isSelected = onboardAutomateAccess.has(name);
                                const IconComponent = getServiceIcon(code, name);
                                return (
                                  <div
                                    key={access.access_id}
                                    onClick={() => handleOnboardAutomateToggle(name)}
                                    className={`flex items-center gap-3.5 px-4 py-3 rounded-2xl border transition-all duration-150 cursor-pointer select-none ${isSelected
                                      ? "bg-[#e8f8f0] border-[#a3e2bc] text-[#0d592f]"
                                      : "bg-white border-gray-200 text-gray-700 hover:border-gray-300"
                                      }`}
                                  >
                                    <Checkbox
                                      id={`onboard-automate-${access.access_id}`}
                                      checked={isSelected}
                                      onClick={(e) => e.stopPropagation()}
                                      onCheckedChange={() => handleOnboardAutomateToggle(name)}
                                      className="size-5 rounded-[6px] border-gray-300 data-[state=checked]:bg-[#111827] data-[state=checked]:border-[#111827] data-[state=checked]:text-white transition-colors"
                                    />
                                    <IconComponent className={`size-5 flex-shrink-0 ${isSelected ? "text-[#10a353]" : "text-gray-400"}`} />
                                    <span className="font-semibold text-[15px]">{name}</span>
                                  </div>
                                );
                              })
                          ) : (
                            <div className="py-12 text-center">
                              <p className="text-gray-400 text-sm">No automated permissions to onboard.</p>
                            </div>
                          )}
                        </div>
                      </div>

                      <div className="pt-4 mt-4 border-t border-gray-100">
                        <Button
                          onClick={handleOnboardAutomate}
                          className="w-full bg-[#10a353] hover:bg-[#0d8c47] text-white font-semibold rounded-xl py-6 text-base shadow-xs flex items-center justify-center gap-2 transition-colors"
                          disabled={onboardAutomateAccess.size === 0 || isOnboarding}
                        >
                          {isOnboarding ? (
                            <>
                              <Loader2 className="animate-spin mr-2 size-5" />
                              Onboarding...
                            </>
                          ) : (
                            <>
                              <UserPlus className="size-5" />
                              Onboard • {onboardAutomateAccess.size} selected
                            </>
                          )}
                        </Button>
                      </div>
                    </TabsContent>
                  </Tabs>
                )}
              </CardContent>
            </Card>
          ) : (
            <Card className="h-full flex items-center justify-center border-dashed border-2">
              <CardContent className="text-center py-12">
                <UserPlus className="size-16 text-gray-300 mx-auto mb-4" />
                <p className="text-gray-500">Select a user to view onboarding options</p>
              </CardContent>
            </Card>
          )}
        </div>

        {/* Selected User Info & All Users List (Middle Column) */}
        <div className="lg:col-span-1">
          <Card className="h-full flex flex-col">
            {selectedUser ? (
              <CardHeader className="pb-4 border-b">
                <div className="flex items-center gap-3">
                  <UserCircle className="size-12 text-gray-400 flex-shrink-0" />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <p className="font-semibold text-gray-900 truncate text-base leading-tight">{selectedUser.name}</p>
                      <Badge className={`text-white text-[10px] px-1.5 py-0 ${selectedUser.is_active ? "bg-green-500 hover:bg-green-600" : "bg-red-500 hover:bg-red-600"}`}>
                        {selectedUser.is_active ? "Active" : "Inactive"}
                      </Badge>
                    </div>
                    <p className="text-xs text-gray-600 truncate mt-0.5">{selectedUser.email}</p>

                  </div>
                </div>
              </CardHeader>
            ) : (
              <CardHeader>
                <CardTitle>All Users</CardTitle>
              </CardHeader>
            )}
            <CardContent className="p-0 flex flex-col flex-1">
              <div className="p-4 border-b">
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-gray-400" />
                  <Input type="text" placeholder="Search users..." value={searchQuery} onChange={e => setSearchQuery(e.target.value)} className="pl-9" />
                </div>
              </div>
              <div className="divide-y max-h-[450px] overflow-y-auto flex-1">
                {isLoading ? (
                  <div className="p-8 flex justify-center text-gray-500">
                    <Loader2 className="animate-spin size-6" />
                  </div>
                ) : filteredUsers.length > 0 ? filteredUsers.map(user => (
                  <button key={user.user_id} onClick={() => handleUserSelect(user)} className={`w-full p-4 text-left hover:bg-gray-50 transition-colors ${selectedUser?.user_id === user.user_id ? "bg-blue-50 border-l-4 border-blue-500" : ""}`}>
                    <div className="flex items-start gap-3">
                      <UserCircle className="size-10 text-gray-400 flex-shrink-0" />
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <p className="font-medium text-gray-900 truncate">{user.name}</p>
                          <Badge className={`text-white ${user.is_active ? "bg-green-500 hover:bg-green-600" : "bg-red-500 hover:bg-red-600"}`}>
                            {user.is_active ? "Active" : "Inactive"}
                          </Badge>
                        </div>
                        <p className="text-sm text-gray-600 truncate">{user.email}</p>
                      </div>
                    </div>
                  </button>
                )) : (
                  <div className="p-8 text-center text-gray-500">
                    <p>No users found matching "{searchQuery}"</p>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Offboard Access (Right Column) */}
        <div className="lg:col-span-1">
          {selectedUser ? (
            <Card className="flex flex-col h-full border border-gray-200/80 shadow-md rounded-3xl overflow-hidden bg-white">
              <CardHeader className="bg-[#fff8f8] border-b border-[#fce3e3] pb-5 pt-6 px-6">
                <div className="flex items-center gap-4">
                  <div className="p-3 bg-[#fdebeb] rounded-2xl text-[#d91e36] flex items-center justify-center shadow-xs">
                    <UserMinus className="size-6" />
                  </div>
                  <div>
                    <h3 className="font-bold text-gray-900 text-lg leading-tight">Offboard Access</h3>
                    <p className="text-xs text-gray-500 font-medium mt-0.5">Revoke existing permissions</p>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="pt-6 px-6 flex-1 flex flex-col">
                {isAccessLoading ? (
                  <div className="py-24 flex justify-center text-gray-500 flex-1 items-center">
                    <Loader2 className="animate-spin size-10 text-[#d91e36]" />
                  </div>
                ) : (
                  <Tabs defaultValue="manual" className="w-full flex-1 flex flex-col">
                    <TabsList className="grid w-full grid-cols-2 bg-[#f3f4f6] p-1 rounded-2xl h-12">
                      <TabsTrigger value="manual" className="rounded-xl h-10 data-[state=active]:bg-white data-[state=active]:shadow-sm data-[state=active]:text-gray-900 text-gray-500 font-semibold text-sm transition-all">Manual</TabsTrigger>
                      <TabsTrigger value="automate" className="rounded-xl h-10 data-[state=active]:bg-white data-[state=active]:shadow-sm data-[state=active]:text-gray-900 text-gray-500 font-semibold text-sm transition-all">Automate</TabsTrigger>
                    </TabsList>

                    {/* Offboard Manual Tab */}
                    <TabsContent value="manual" className="mt-4 flex-grow flex flex-col justify-between">
                      <div>
                        <p className="text-[#8e98a8] text-sm mb-3 font-medium">Select permissions</p>
                        <div className="space-y-2.5 max-h-[350px] overflow-y-auto pr-1">
                          {userAccesses.filter(a => a.is_active && !a.is_automate).length > 0 ? (
                            userAccesses
                              .filter(a => a.is_active && !a.is_automate)
                              .map(access => {
                                const name = access.service?.service_name || "Unknown Service";
                                const code = access.service?.service_code || "";
                                const isSelected = manualAccess.has(name);
                                const IconComponent = getServiceIcon(code, name);
                                return (
                                  <div
                                    key={access.access_id}
                                    onClick={() => handleManualAccessToggle(name)}
                                    className={`flex items-center gap-3.5 px-4 py-3 rounded-2xl border transition-all duration-150 cursor-pointer select-none ${isSelected
                                      ? "bg-[#fdf2f2] border-[#fbc4c4] text-[#9b1c1c]"
                                      : "bg-white border-gray-200 text-gray-700 hover:border-gray-300"
                                      }`}
                                  >
                                    <Checkbox
                                      id={`offboard-manual-${access.access_id}`}
                                      checked={isSelected}
                                      onClick={(e) => e.stopPropagation()}
                                      onCheckedChange={() => handleManualAccessToggle(name)}
                                      className="size-5 rounded-[6px] border-gray-300 data-[state=checked]:bg-[#111827] data-[state=checked]:border-[#111827] data-[state=checked]:text-white transition-colors"
                                    />
                                    <IconComponent className={`size-5 flex-shrink-0 ${isSelected ? "text-[#d91e36]" : "text-gray-400"}`} />
                                    <span className="font-semibold text-[15px]">{name}</span>
                                  </div>
                                );
                              })
                          ) : (
                            <div className="py-12 text-center">
                              <p className="text-gray-400 text-sm">No active manual permissions found.</p>
                            </div>
                          )}
                        </div>
                      </div>

                      <div className="pt-4 mt-4 border-t border-gray-100">
                        <Button
                          onClick={handleManualOffboard}
                          className="w-full bg-[#d91e36] hover:bg-[#c0152b] text-white font-semibold rounded-xl py-6 text-base shadow-xs flex items-center justify-center gap-2 transition-colors"
                          disabled={manualAccess.size === 0 || isOffboarding}
                        >
                          {isOffboarding ? (
                            <>
                              <Loader2 className="animate-spin mr-2 size-5" />
                              Offboarding...
                            </>
                          ) : (
                            <>
                              <UserMinus className="size-5" />
                              Offboard • {manualAccess.size} selected
                            </>
                          )}
                        </Button>
                      </div>
                    </TabsContent>

                    {/* Offboard Automate Tab */}
                    <TabsContent value="automate" className="mt-4 flex-grow flex flex-col justify-between">
                      <div>
                        <p className="text-[#8e98a8] text-sm mb-3 font-medium">Select permissions</p>
                        <div className="space-y-2.5 max-h-[350px] overflow-y-auto pr-1">
                          {userAccesses.filter(a => a.is_active && a.is_automate).length > 0 ? (
                            userAccesses
                              .filter(a => a.is_active && a.is_automate)
                              .map(access => {
                                const name = access.service?.service_name || "Unknown Service";
                                const code = access.service?.service_code || "";
                                const isSelected = automateAccess.has(name);
                                const IconComponent = getServiceIcon(code, name);
                                return (
                                  <div
                                    key={access.access_id}
                                    onClick={() => handleAutomateAccessToggle(name)}
                                    className={`flex items-center gap-3.5 px-4 py-3 rounded-2xl border transition-all duration-150 cursor-pointer select-none ${isSelected
                                      ? "bg-[#fdf2f2] border-[#fbc4c4] text-[#9b1c1c]"
                                      : "bg-white border-gray-200 text-gray-700 hover:border-gray-300"
                                      }`}
                                  >
                                    <Checkbox
                                      id={`offboard-automate-${access.access_id}`}
                                      checked={isSelected}
                                      onClick={(e) => e.stopPropagation()}
                                      onCheckedChange={() => handleAutomateAccessToggle(name)}
                                      className="size-5 rounded-[6px] border-gray-300 data-[state=checked]:bg-[#111827] data-[state=checked]:border-[#111827] data-[state=checked]:text-white transition-colors"
                                    />
                                    <IconComponent className={`size-5 flex-shrink-0 ${isSelected ? "text-[#d91e36]" : "text-gray-400"}`} />
                                    <span className="font-semibold text-[15px]">{name}</span>
                                  </div>
                                );
                              })
                          ) : (
                            <div className="py-12 text-center">
                              <p className="text-gray-400 text-sm">No active automated permissions found.</p>
                            </div>
                          )}
                        </div>
                      </div>

                      <div className="pt-4 mt-4 border-t border-gray-100">
                        <Button
                          onClick={handleAutomateOffboard}
                          className="w-full bg-[#d91e36] hover:bg-[#c0152b] text-white font-semibold rounded-xl py-6 text-base shadow-xs flex items-center justify-center gap-2 transition-colors"
                          disabled={automateAccess.size === 0 || isOffboarding}
                        >
                          {isOffboarding ? (
                            <>
                              <Loader2 className="animate-spin mr-2 size-5" />
                              Offboarding...
                            </>
                          ) : (
                            <>
                              <UserMinus className="size-5" />
                              Offboard • {automateAccess.size} selected
                            </>
                          )}
                        </Button>
                      </div>
                    </TabsContent>
                  </Tabs>
                )}
              </CardContent>
            </Card>
          ) : (
            <Card className="h-full flex items-center justify-center border-dashed border-2">
              <CardContent className="text-center py-12">
                <UserMinus className="size-16 text-gray-300 mx-auto mb-4" />
                <p className="text-gray-500">Select a user to view offboarding options</p>
              </CardContent>
            </Card>
          )}
        </div>
      </div>
      {/* Custom Confirmation Modal */}
      {confirmModal.isOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm transition-opacity animate-in fade-in duration-200">
          <div className="relative w-full max-w-[440px] bg-white rounded-[32px] p-8 shadow-2xl border border-gray-100 flex flex-col gap-6 animate-in zoom-in-95 duration-200">
            {/* Close button (X) */}
            <button
              onClick={() => setConfirmModal(prev => ({ ...prev, isOpen: false }))}
              className="absolute top-6 right-6 text-gray-400 hover:text-gray-600 transition-colors"
            >
              <X className="size-5" />
            </button>

            {/* Top Icon Badge */}
            <div className="flex justify-start">
              <div className={`p-4 rounded-[22px] flex items-center justify-center shadow-xs ${confirmModal.type === "onboard"
                ? "bg-[#e6f6ee] text-[#10a353]"
                : "bg-[#fdebeb] text-[#d91e36]"
                }`}>
                {confirmModal.type === "onboard" ? (
                  <UserPlus className="size-7" />
                ) : (
                  <UserMinus className="size-7" />
                )}
              </div>
            </div>

            {/* Title & Subtitle */}
            <div>
              <h3 className="text-[22px] font-bold text-gray-900 leading-tight">
                {confirmModal.isAutomate ? "Automated" : "Manual"}{" "}
                {confirmModal.type === "onboard" ? "Onboarding" : "Offboarding"}
              </h3>
              <p className="text-[#8e98a8] text-base font-medium mt-2">
                {confirmModal.type === "onboard" ? "Granting" : "Revoking"}{" "}
                <span className="font-bold text-gray-900">{confirmModal.permissions.length} permissions</span>{" "}
                {confirmModal.type === "onboard" ? "to" : "from"}{" "}
                <span className="font-bold text-gray-900">{confirmModal.userName}</span>
              </p>
            </div>

            {/* Permissions List container */}
            <div className="bg-[#f8f9fa] rounded-2xl p-5 border border-gray-100 max-h-[220px] overflow-y-auto">
              <ul className="space-y-3">
                {confirmModal.permissions.map((name, idx) => (
                  <li key={idx} className="flex items-center gap-3 text-[15px] font-semibold text-gray-700">
                    <span className={`w-2 h-2 rounded-full ${confirmModal.type === "onboard" ? "bg-[#10a353]" : "bg-[#d91e36]"
                      }`} />
                    {name}
                  </li>
                ))}
              </ul>
            </div>

            {/* Action Buttons */}
            <div className="flex gap-4">
              <Button
                onClick={() => setConfirmModal(prev => ({ ...prev, isOpen: false }))}
                className="flex-1 bg-white hover:bg-gray-50 border border-gray-200 text-gray-900 font-semibold rounded-2xl py-6 text-base shadow-xs transition-colors"
              >
                Cancel
              </Button>
              <Button
                onClick={() => {
                  const { type, isAutomate, permissions } = confirmModal;
                  setConfirmModal(prev => ({ ...prev, isOpen: false }));
                  if (type === "onboard") {
                    onboardAccesses(permissions, isAutomate);
                  } else {
                    offboardAccesses(permissions, isAutomate);
                  }
                }}
                className={`flex-1 text-white font-semibold rounded-2xl py-6 text-base shadow-xs transition-colors ${confirmModal.type === "onboard"
                  ? "bg-[#10a353] hover:bg-[#0d8c47]"
                  : "bg-[#d91e36] hover:bg-[#c0152b]"
                  }`}
              >
                Confirm
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Toast Notifications Container */}
      <div className="fixed top-6 right-6 z-50 flex flex-col gap-3 max-w-[400px] w-full pointer-events-none">
        {toasts.map(toast => (
          <div
            key={toast.id}
            className={`pointer-events-auto w-full p-5 rounded-[24px] border shadow-lg flex items-start gap-4 transition-all duration-300 transform translate-x-0 ${toast.success
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
              onClick={() => setToasts(prev => prev.filter(t => t.id !== toast.id))}
              className="flex-shrink-0 text-gray-400 hover:text-gray-600 transition-colors mt-0.5"
            >
              <X className="size-4" />
            </button>
          </div>
        ))}
      </div>
    </div>
  </div>;
}