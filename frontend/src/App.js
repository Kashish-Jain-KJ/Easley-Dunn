import { useState, useEffect } from "react";
import { Button } from "./components/ui/button";
import { Checkbox } from "./components/ui/checkbox";
import { Card, CardContent, CardHeader, CardTitle } from "./components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "./components/ui/tabs";
import { Label } from "./components/ui/label";
import { Input } from "./components/ui/input";
import { UserCircle, Shield, Search, Loader2 } from "lucide-react";
import { Badge } from "./components/ui/badge";

const API_URL = process.env.REACT_APP_API_URL || "http://localhost:5001";

export default function App() {
  const [users, setUsers] = useState([]);
  const [selectedUser, setSelectedUser] = useState(null);
  const [manualAccess, setManualAccess] = useState(new Set());
  const [automateAccess, setAutomateAccess] = useState(new Set());
  const [searchQuery, setSearchQuery] = useState("");
  const [isLoading, setIsLoading] = useState(true);
  const [isAccessLoading, setIsAccessLoading] = useState(false);

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

  const handleManualOffboard = () => {
    if (!selectedUser) return;
    const accessToRevoke = Array.from(manualAccess);
    alert(`Manual offboarding initiated for ${selectedUser.name}\n\nAccess to revoke:\n${accessToRevoke.join("\n")}`);
  };

  const handleAutomateOffboard = () => {
    if (!selectedUser) return;
    const accessToRevoke = Array.from(automateAccess);
    alert(`Automated offboarding initiated for ${selectedUser.name}\n\nAccess to revoke:\n${accessToRevoke.join("\n")}`);
  };

  const handleUserSelect = async (user) => {
    setSelectedUser(user);
    if (!user.is_active) {
      setManualAccess(new Set());
      setAutomateAccess(new Set());
      return;
    }
    
    setIsAccessLoading(true);
    try {
      const res = await fetch(`${API_URL}/users/${user.user_id}/access`);
      const json = await res.json();
      if (json.success) {
        const manualAcc = json.data.filter(item => !item.is_automate).map(item => item.service?.service_name).filter(Boolean);
        const automateAcc = json.data.filter(item => item.is_automate).map(item => item.service?.service_name).filter(Boolean);
        
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

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Users List */}
          <div className="lg:col-span-1">
            <Card>
              <CardHeader>
                <CardTitle>All Users</CardTitle>
                <div className="mt-4 relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-gray-400" />
                  <Input type="text" placeholder="Search users..." value={searchQuery} onChange={e => setSearchQuery(e.target.value)} className="pl-9" />
                </div>
              </CardHeader>
              <CardContent className="p-0">
                <div className="divide-y max-h-[600px] overflow-y-auto">
                  {isLoading ? (
                    <div className="p-8 flex justify-center text-gray-500">
                      <Loader2 className="animate-spin size-6" />
                    </div>
                  ) : filteredUsers.length > 0 ? filteredUsers.map(user => <button key={user.user_id} onClick={() => handleUserSelect(user)} className={`w-full p-4 text-left hover:bg-gray-50 transition-colors ${selectedUser?.user_id === user.user_id ? "bg-blue-50 border-l-4 border-blue-500" : ""}`}>
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
                    </button>) : <div className="p-8 text-center text-gray-500">
                      <p>No users found matching "{searchQuery}"</p>
                    </div>}
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Access Management */}
          <div className="lg:col-span-2">
            {selectedUser ? <Card>
                <CardHeader>
                  <div className="flex items-center gap-3">
                    <Shield className="size-6 text-blue-600" />
                    <div>
                      <CardTitle className="flex items-center gap-2">
                        Access Control for {selectedUser.name}
                        {!selectedUser.is_active && (
                          <Badge className="text-white bg-red-500 hover:bg-red-600">
                            Inactive
                          </Badge>
                        )}
                      </CardTitle>
                      <p className="text-sm text-gray-600 mt-1">{selectedUser.email}</p>
                    </div>
                  </div>
                </CardHeader>
                <CardContent>
                  {selectedUser.is_active ? (
                    isAccessLoading ? (
                      <div className="py-16 flex justify-center text-gray-500">
                        <Loader2 className="animate-spin size-8 text-blue-500" />
                      </div>
                    ) : (
                      <Tabs defaultValue="manual" className="w-full">
                        <TabsList className="grid w-full grid-cols-2">
                          <TabsTrigger value="manual">Manual</TabsTrigger>
                          <TabsTrigger value="automate">Automate</TabsTrigger>
                        </TabsList>

                        {/* Manual Tab */}
                        <TabsContent value="manual" className="mt-6">
                          <div className="space-y-4">
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                              {(selectedUser.manualAccesses || []).length > 0 ? (selectedUser.manualAccesses || []).map(access => <div key={access} className="flex items-center space-x-2">
                                  <Checkbox id={`manual-${access}`} checked={manualAccess.has(access)} onCheckedChange={() => handleManualAccessToggle(access)} />
                                  <Label htmlFor={`manual-${access}`} className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70 cursor-pointer">
                                    {access}
                                  </Label>
                                </div>) : <p className="text-gray-500 text-sm py-4">No active permissions found.</p>}
                            </div>

                            <div className="pt-6 border-t">
                              <Button onClick={handleManualOffboard} variant="destructive" className="w-full" disabled={manualAccess.size === 0}>
                                Offboard ({manualAccess.size} access{manualAccess.size !== 1 ? "es" : ""} selected)
                              </Button>
                            </div>
                          </div>
                        </TabsContent>

                        {/* Automate Tab */}
                        <TabsContent value="automate" className="mt-6">
                          <div className="space-y-4">
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                              {(selectedUser.automateAccesses || []).length > 0 ? (selectedUser.automateAccesses || []).map(access => <div key={access} className="flex items-center space-x-2">
                                  <Checkbox id={`automate-${access}`} checked={automateAccess.has(access)} onCheckedChange={() => handleAutomateAccessToggle(access)} />
                                  <Label htmlFor={`automate-${access}`} className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70 cursor-pointer">
                                    {access}
                                  </Label>
                                </div>) : <p className="text-gray-500 text-sm py-4">No active permissions found.</p>}
                            </div>

                            <div className="pt-6 border-t">
                              <Button onClick={handleAutomateOffboard} variant="destructive" className="w-full" disabled={automateAccess.size === 0}>
                                Offboard ({automateAccess.size} access{automateAccess.size !== 1 ? "es" : ""} selected)
                              </Button>
                            </div>
                          </div>
                        </TabsContent>
                      </Tabs>
                    )
                  ) : (
                    <div className="flex flex-col items-center justify-center py-16 text-center">
                      <div className="mb-4 flex size-16 items-center justify-center rounded-full bg-red-100">
                        <Shield className="size-8 text-red-600" />
                      </div>
                      <h3 className="mb-2 text-xl font-semibold text-gray-900">User is Inactive</h3>
                      <p className="max-w-md text-gray-500">
                        This user has been deactivated and does not have any active access permissions.
                      </p>
                    </div>
                  )}
                </CardContent>
              </Card> : <Card className="h-full flex items-center justify-center">
                <CardContent className="text-center py-12">
                  <UserCircle className="size-16 text-gray-300 mx-auto mb-4" />
                  <p className="text-gray-500">Select a user to view and manage their access</p>
                </CardContent>
              </Card>}
          </div>
        </div>
      </div>
    </div>;
}