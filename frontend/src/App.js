import { useState, useEffect } from "react";
import { Button } from "./components/ui/button";
import { Checkbox } from "./components/ui/checkbox";
import { Card, CardContent, CardHeader, CardTitle } from "./components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "./components/ui/tabs";
import { Label } from "./components/ui/label";
import { Input } from "./components/ui/input";
import { UserCircle, Search, Loader2, UserPlus, UserMinus } from "lucide-react";
import { Badge } from "./components/ui/badge";

const API_URL = process.env.REACT_APP_API_URL || "http://localhost:5001";




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
    const failed = results.filter(r => !r.success);

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

    // Display summary message
    let msg = "";
    if (successful.length > 0) {
      msg += `Successfully offboarded:\n${successful.map(r => `- ${r.name}`).join("\n")}\n\n`;
    }
    if (failed.length > 0) {
      msg += `Failed to offboard:\n${failed.map(r => `- ${r.name}: ${r.message}`).join("\n")}`;
    }

    alert(msg.trim());
    setIsOffboarding(false);
  };

  const handleManualOffboard = () => {
    if (!selectedUser) return;
    const accessToRevoke = Array.from(manualAccess);
    offboardAccesses(accessToRevoke, false);
  };

  const handleAutomateOffboard = () => {
    if (!selectedUser) return;
    const accessToRevoke = Array.from(automateAccess);
    offboardAccesses(accessToRevoke, true);
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
    const failed = results.filter(r => !r.success);

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

    // Display summary message
    let msg = "";
    if (successful.length > 0) {
      msg += `Successfully onboarded:\n${successful.map(r => `- ${r.name}`).join("\n")}\n\n`;
    }
    if (failed.length > 0) {
      msg += `Failed to onboard:\n${failed.map(r => `- ${r.name}: ${r.message}`).join("\n")}`;
    }

    alert(msg.trim());
    setIsOnboarding(false);
  };

  const handleOnboardManual = () => {
    if (!selectedUser) return;
    onboardAccesses(Array.from(onboardManualAccess), false);
  };

  const handleOnboardAutomate = () => {
    if (!selectedUser) return;
    onboardAccesses(Array.from(onboardAutomateAccess), true);
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
            <Card className="flex flex-col h-full border-t-4 border-green-500">
              <CardHeader className="bg-green-50/30 border-b border-green-100/50 pb-4">
                <div className="flex items-center gap-3">
                  <UserPlus className="size-6 text-green-600" />
                  <CardTitle className="text-green-800 font-semibold text-lg">
                    Onboard Access
                  </CardTitle>
                </div>
              </CardHeader>
              <CardContent className="pt-6">
                {isAccessLoading ? (
                  <div className="py-16 flex justify-center text-gray-500">
                    <Loader2 className="animate-spin size-8 text-green-500" />
                  </div>
                ) : (
                  <Tabs defaultValue="manual" className="w-full">
                    <TabsList className="grid w-full grid-cols-2">
                      <TabsTrigger value="manual">Manual</TabsTrigger>
                      <TabsTrigger value="automate">Automate</TabsTrigger>
                    </TabsList>

                    {/* Onboard Manual Tab */}
                    <TabsContent value="manual" className="mt-6">
                      <div className="space-y-4">
                        <div className="space-y-3 max-h-[300px] overflow-y-auto pr-1">
                          {userAccesses.filter(a => !a.is_active && !a.is_automate).length > 0 ? (
                            userAccesses
                              .filter(a => !a.is_active && !a.is_automate)
                              .map(access => {
                                const name = access.service?.service_name || "Unknown Service";
                                return (
                                  <div key={access.access_id} className="flex items-center space-x-2">
                                    <Checkbox
                                      id={`onboard-manual-${access.access_id}`}
                                      checked={onboardManualAccess.has(name)}
                                      onCheckedChange={() => handleOnboardManualToggle(name)}
                                    />
                                    <Label
                                      htmlFor={`onboard-manual-${access.access_id}`}
                                      className="text-sm font-medium leading-none cursor-pointer"
                                    >
                                      {name}
                                    </Label>
                                  </div>
                                );
                              })
                          ) : (
                            <p className="text-gray-500 text-sm py-4">No manual permissions to onboard.</p>
                          )}
                        </div>

                        <div className="pt-6 border-t">
                          <Button
                            onClick={handleOnboardManual}
                            className="w-full bg-green-600 hover:bg-green-700 text-white"
                            disabled={onboardManualAccess.size === 0 || isOnboarding}
                          >
                            {isOnboarding ? (
                              <>
                                <Loader2 className="animate-spin mr-2 size-4 inline" />
                                Onboarding...
                              </>
                            ) : (
                              `Onboard (${onboardManualAccess.size} selected)`
                            )}
                          </Button>
                        </div>
                      </div>
                    </TabsContent>

                    {/* Onboard Automate Tab */}
                    <TabsContent value="automate" className="mt-6">
                      <div className="space-y-4">
                        <div className="space-y-3 max-h-[300px] overflow-y-auto pr-1">
                          {userAccesses.filter(a => !a.is_active && a.is_automate).length > 0 ? (
                            userAccesses
                              .filter(a => !a.is_active && a.is_automate)
                              .map(access => {
                                const name = access.service?.service_name || "Unknown Service";
                                return (
                                  <div key={access.access_id} className="flex items-center space-x-2">
                                    <Checkbox
                                      id={`onboard-automate-${access.access_id}`}
                                      checked={onboardAutomateAccess.has(name)}
                                      onCheckedChange={() => handleOnboardAutomateToggle(name)}
                                    />
                                    <Label
                                      htmlFor={`onboard-automate-${access.access_id}`}
                                      className="text-sm font-medium leading-none cursor-pointer"
                                    >
                                      {name}
                                    </Label>
                                  </div>
                                );
                              })
                          ) : (
                            <p className="text-gray-500 text-sm py-4">No automated permissions to onboard.</p>
                          )}
                        </div>

                        <div className="pt-6 border-t">
                          <Button
                            onClick={handleOnboardAutomate}
                            className="w-full bg-green-600 hover:bg-green-700 text-white"
                            disabled={onboardAutomateAccess.size === 0 || isOnboarding}
                          >
                            {isOnboarding ? (
                              <>
                                <Loader2 className="animate-spin mr-2 size-4 inline" />
                                Onboarding...
                              </>
                            ) : (
                              `Onboard (${onboardAutomateAccess.size} selected)`
                            )}
                          </Button>
                        </div>
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
            <Card className="flex flex-col h-full border-t-4 border-red-500">
              <CardHeader className="bg-red-50/30 border-b border-red-100/50 pb-4">
                <div className="flex items-center gap-3">
                  <UserMinus className="size-6 text-red-600" />
                  <CardTitle className="text-red-800 font-semibold text-lg">
                    Offboard Access
                  </CardTitle>
                </div>
              </CardHeader>
              <CardContent className="pt-6">
                {isAccessLoading ? (
                  <div className="py-16 flex justify-center text-gray-500">
                    <Loader2 className="animate-spin size-8 text-red-500" />
                  </div>
                ) : (
                  <Tabs defaultValue="manual" className="w-full">
                    <TabsList className="grid w-full grid-cols-2">
                      <TabsTrigger value="manual">Manual</TabsTrigger>
                      <TabsTrigger value="automate">Automate</TabsTrigger>
                    </TabsList>

                    {/* Offboard Manual Tab */}
                    <TabsContent value="manual" className="mt-6">
                      <div className="space-y-4">
                        <div className="space-y-3 max-h-[300px] overflow-y-auto pr-1">
                          {userAccesses.filter(a => a.is_active && !a.is_automate).length > 0 ? (
                            userAccesses
                              .filter(a => a.is_active && !a.is_automate)
                              .map(access => {
                                const name = access.service?.service_name || "Unknown Service";
                                return (
                                  <div key={access.access_id} className="flex items-center space-x-2">
                                    <Checkbox
                                      id={`offboard-manual-${access.access_id}`}
                                      checked={manualAccess.has(name)}
                                      onCheckedChange={() => handleManualAccessToggle(name)}
                                    />
                                    <Label
                                      htmlFor={`offboard-manual-${access.access_id}`}
                                      className="text-sm font-medium leading-none cursor-pointer"
                                    >
                                      {name}
                                    </Label>
                                  </div>
                                );
                              })
                          ) : (
                            <p className="text-gray-500 text-sm py-4">No active manual permissions found.</p>
                          )}
                        </div>

                        <div className="pt-6 border-t">
                          <Button
                            onClick={handleManualOffboard}
                            variant="destructive"
                            className="w-full bg-red-600 hover:bg-red-700 text-white"
                            disabled={manualAccess.size === 0 || isOffboarding}
                          >
                            {isOffboarding ? (
                              <>
                                <Loader2 className="animate-spin mr-2 size-4 inline" />
                                Offboarding...
                              </>
                            ) : (
                              `Offboard (${manualAccess.size} selected)`
                            )}
                          </Button>
                        </div>
                      </div>
                    </TabsContent>

                    {/* Offboard Automate Tab */}
                    <TabsContent value="automate" className="mt-6">
                      <div className="space-y-4">
                        <div className="space-y-3 max-h-[300px] overflow-y-auto pr-1">
                          {userAccesses.filter(a => a.is_active && a.is_automate).length > 0 ? (
                            userAccesses
                              .filter(a => a.is_active && a.is_automate)
                              .map(access => {
                                const name = access.service?.service_name || "Unknown Service";
                                return (
                                  <div key={access.access_id} className="flex items-center space-x-2">
                                    <Checkbox
                                      id={`offboard-automate-${access.access_id}`}
                                      checked={automateAccess.has(name)}
                                      onCheckedChange={() => handleAutomateAccessToggle(name)}
                                    />
                                    <Label
                                      htmlFor={`offboard-automate-${access.access_id}`}
                                      className="text-sm font-medium leading-none cursor-pointer"
                                    >
                                      {name}
                                    </Label>
                                  </div>
                                );
                              })
                          ) : (
                            <p className="text-gray-500 text-sm py-4">No active automated permissions found.</p>
                          )}
                        </div>

                        <div className="pt-6 border-t">
                          <Button
                            onClick={handleAutomateOffboard}
                            variant="destructive"
                            className="w-full bg-red-600 hover:bg-red-700 text-white"
                            disabled={automateAccess.size === 0 || isOffboarding}
                          >
                            {isOffboarding ? (
                              <>
                                <Loader2 className="animate-spin mr-2 size-4 inline" />
                                Offboarding...
                              </>
                            ) : (
                              `Offboard (${automateAccess.size} selected)`
                            )}
                          </Button>
                        </div>
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
    </div>
  </div>;
}