import React, { memo } from "react";
import { Search, Loader2 } from "lucide-react";
import { Card, CardHeader, CardTitle, CardContent } from "./ui/card";
import { Input } from "./ui/input";
import { getAvatarColor, getInitials } from "../utils/helpers";

function UserList({
  users,
  filteredUsers,
  selectedUser,
  searchQuery,
  onSearchChange,
  onUserSelect,
  isLoading
}) {
  return (
    <Card className="h-full flex flex-col border border-gray-200/80 shadow-md rounded-3xl overflow-hidden bg-white">
      <CardHeader className="flex flex-row items-center justify-between pb-4 border-b">
        <CardTitle className="text-xl font-bold text-gray-900">All Users</CardTitle>
        <span className="text-sm font-semibold text-gray-400">
          {filteredUsers.length} of {users.length}
        </span>
      </CardHeader>
      <CardContent className="p-0 flex flex-col flex-1">
        <div className="p-4 border-b">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-gray-400" />
            <Input
              type="text"
              placeholder="Search by name..."
              value={searchQuery}
              onChange={(e) => onSearchChange(e.target.value)}
              className="pl-9 bg-[#f8fafc] border-gray-200 rounded-xl"
            />
          </div>
        </div>
        <div className="divide-y divide-gray-100 max-h-[450px] overflow-y-auto flex-1">
          {isLoading ? (
            <div className="p-8 flex justify-center text-gray-500">
              <Loader2 className="animate-spin size-6" />
            </div>
          ) : filteredUsers.length > 0 ? (
            filteredUsers.map((user) => {
              const isSelected = selectedUser?.user_id === user.user_id;
              return (
                <button
                  key={user.user_id}
                  onClick={() => onUserSelect(user)}
                  className={`w-full px-6 py-4 text-left transition-colors flex items-center justify-between group ${isSelected ? "bg-[#eff6ff]" : "hover:bg-gray-50 bg-white"
                    }`}
                >
                  <div className="flex items-center gap-3.5 min-w-0">
                    <div
                      className={`size-10 rounded-full flex items-center justify-center font-bold text-sm flex-shrink-0 ${getAvatarColor(
                        user.name
                      )}`}
                    >
                      {getInitials(user.name)}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <p className="font-semibold text-gray-900 truncate text-[15px]">
                          {user.name}
                        </p>
                        <span
                          className={`size-2 rounded-full flex-shrink-0 ${user.is_active ? "bg-[#10b981]" : "bg-[#ef4444]"
                            }`}
                        />
                      </div>
                    </div>
                  </div>
                  {isSelected && (
                    <svg
                      className="size-4 text-blue-500 flex-shrink-0"
                      fill="none"
                      viewBox="0 0 24 24"
                      stroke="currentColor"
                      strokeWidth="2.5"
                    >
                      <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
                    </svg>
                  )}
                </button>
              );
            })
          ) : (
            <div className="p-8 text-center text-gray-500">
              <p>No users found matching "{searchQuery}"</p>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

export default memo(UserList);
