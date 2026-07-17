import React, { memo } from "react";
import { UserMinus, Loader2, XCircle } from "lucide-react";
import { Card, CardHeader, CardContent } from "./ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "./ui/tabs";
import AccessTabContent from "./AccessTabContent";

function OffboardAccessCard({
  selectedUser,
  isAccessLoading,
  userAccesses,
  manualAccess,
  automateAccess,
  onManualToggle,
  onAutomateToggle,
  onOffboardManualClick,
  onOffboardAutomateClick,
  isOffboarding
}) {
  if (!selectedUser) {
    return (
      <Card className="h-full flex items-center justify-center border-dashed border-2 min-h-[300px]">
        <CardContent className="text-center py-12">
          <UserMinus className="size-16 text-gray-300 mx-auto mb-4" />
          <p className="text-gray-500">Select a user to view offboarding options</p>
        </CardContent>
      </Card>
    );
  }

  const manualActiveAccesses = userAccesses.filter((a) => a.is_active && !a.is_automate);
  const automateActiveAccesses = userAccesses.filter((a) => a.is_active && a.is_automate);

  return (
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
        ) : !selectedUser.is_active ? (
          <div className="py-12 flex flex-col items-center justify-center text-center flex-grow">
            <div className="p-4 bg-[#fdebeb] text-[#d91e36] rounded-3xl flex items-center justify-center shadow-xs">
              <XCircle className="size-10" />
            </div>
            <h4 className="font-bold text-gray-900 text-lg mt-5">User is Inactive</h4>
            <p className="text-[#8e98a8] text-sm font-medium mt-2 max-w-[200px] leading-relaxed">
              No active access to revoke for this user.
            </p>
          </div>
        ) : (
          <Tabs defaultValue="automate" className="w-full flex-1 flex flex-col">
            <TabsList className="grid w-full grid-cols-2 bg-[#f3f4f6] p-1 rounded-2xl h-12">
              <TabsTrigger
                value="automate"
                className="rounded-xl h-10 data-[state=active]:bg-white data-[state=active]:shadow-sm data-[state=active]:text-gray-900 text-gray-500 font-semibold text-sm transition-all"
              >
                Automate
              </TabsTrigger>
              <TabsTrigger
                value="manual"
                className="rounded-xl h-10 data-[state=active]:bg-white data-[state=active]:shadow-sm data-[state=active]:text-gray-900 text-gray-500 font-semibold text-sm transition-all"
              >
                Manual
              </TabsTrigger>
            </TabsList>

            {/* Offboard Manual Tab */}
            <TabsContent value="manual" className="mt-4 flex-grow flex flex-col justify-between">
              <AccessTabContent
                items={manualActiveAccesses}
                selectedSet={manualAccess}
                onToggle={onManualToggle}
                onActionClick={onOffboardManualClick}
                actionText="Offboard"
                actionIcon={UserMinus}
                actionColor="bg-[#d91e36] hover:bg-[#c0152b]"
                isLoading={isOffboarding}
                loadingText="Offboarding..."
                emptyText="No active manual permissions found."
                type="offboard"
                rowKey="access_id"
              />
            </TabsContent>

            {/* Offboard Automate Tab */}
            <TabsContent value="automate" className="mt-4 flex-grow flex flex-col justify-between">
              <AccessTabContent
                items={automateActiveAccesses}
                selectedSet={automateAccess}
                onToggle={onAutomateToggle}
                onActionClick={onOffboardAutomateClick}
                actionText="Offboard"
                actionIcon={UserMinus}
                actionColor="bg-[#d91e36] hover:bg-[#c0152b]"
                isLoading={isOffboarding}
                loadingText="Offboarding..."
                emptyText="No active automated permissions found."
                type="offboard"
                rowKey="access_id"
              />
            </TabsContent>
          </Tabs>
        )}
      </CardContent>
    </Card>
  );
}

export default memo(OffboardAccessCard);
