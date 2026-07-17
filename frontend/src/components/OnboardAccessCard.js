import React, { memo } from "react";
import { UserPlus, Loader2, XCircle } from "lucide-react";
import { Card, CardHeader, CardContent } from "./ui/card";
import { Button } from "./ui/button";
import { Checkbox } from "./ui/checkbox";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "./ui/tabs";
import { getServiceIcon } from "../utils/helpers";

function OnboardAccessCard({
  selectedUser,
  isAccessLoading,
  onboardManualServices,
  onboardAutomateServices,
  onboardManualAccess,
  onboardAutomateAccess,
  onManualToggle,
  onAutomateToggle,
  onOnboardManualClick,
  onOnboardAutomateClick,
  isOnboarding
}) {
  if (!selectedUser) {
    return (
      <Card className="h-full flex items-center justify-center border-dashed border-2 min-h-[300px]">
        <CardContent className="text-center py-12">
          <UserPlus className="size-16 text-gray-300 mx-auto mb-4" />
          <p className="text-gray-500">Select a user to view onboarding options</p>
        </CardContent>
      </Card>
    );
  }

  return (
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
        ) : !selectedUser.is_active ? (
          <div className="py-12 flex flex-col items-center justify-center text-center flex-grow">
            <div className="p-4 bg-[#fdebeb] text-[#d91e36] rounded-3xl flex items-center justify-center shadow-xs">
              <XCircle className="size-10" />
            </div>
            <h4 className="font-bold text-gray-900 text-lg mt-5">User is Inactive</h4>
            <p className="text-[#8e98a8] text-sm font-medium mt-2 max-w-[200px] leading-relaxed">
              Cannot onboard permissions for this user.
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

            {/* Onboard Manual Tab */}
            <TabsContent value="manual" className="mt-4 flex-grow flex flex-col justify-between">
              <div>
                <p className="text-[#8e98a8] text-sm mb-3 font-medium">Select permissions</p>
                <div className="space-y-2.5 max-h-[350px] overflow-y-auto pr-1">
                  {onboardManualServices.length > 0 ? (
                    onboardManualServices.map((service) => {
                      const name = service.service_name;
                      const code = service.service_code;
                      const isSelected = onboardManualAccess.has(name);
                      const IconComponent = getServiceIcon(code, name);
                      return (
                        <div
                          key={service.service_id}
                          onClick={() => onManualToggle(name)}
                          className={`flex items-center gap-3.5 px-4 py-3 rounded-2xl border transition-all duration-150 cursor-pointer select-none ${
                            isSelected
                              ? "bg-[#f0fdf4] border-[#bbf7d0] text-slate-800"
                              : "bg-white border-gray-200 text-gray-700 hover:border-gray-300"
                          }`}
                        >
                          <Checkbox
                            id={`onboard-manual-${service.service_id}`}
                            checked={isSelected}
                            onClick={(e) => e.stopPropagation()}
                            onCheckedChange={() => onManualToggle(name)}
                            className="size-5 rounded-[6px] border-gray-300 data-[state=checked]:bg-[#111827] data-[state=checked]:border-[#111827] data-[state=checked]:text-white transition-colors"
                          />
                          <IconComponent className="size-5 flex-shrink-0 text-gray-400" />
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
                  onClick={onOnboardManualClick}
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
                  {onboardAutomateServices.length > 0 ? (
                    onboardAutomateServices.map((service) => {
                      const name = service.service_name;
                      const code = service.service_code;
                      const isSelected = onboardAutomateAccess.has(name);
                      const IconComponent = getServiceIcon(code, name);
                      return (
                        <div
                          key={service.service_id}
                          onClick={() => onAutomateToggle(name)}
                          className={`flex items-center gap-3.5 px-4 py-3 rounded-2xl border transition-all duration-150 cursor-pointer select-none ${
                            isSelected
                              ? "bg-[#f0fdf4] border-[#bbf7d0] text-slate-800"
                              : "bg-white border-gray-200 text-gray-700 hover:border-gray-300"
                          }`}
                        >
                          <Checkbox
                            id={`onboard-automate-${service.service_id}`}
                            checked={isSelected}
                            onClick={(e) => e.stopPropagation()}
                            onCheckedChange={() => onAutomateToggle(name)}
                            className="size-5 rounded-[6px] border-gray-300 data-[state=checked]:bg-[#111827] data-[state=checked]:border-[#111827] data-[state=checked]:text-white transition-colors"
                          />
                          <IconComponent className="size-5 flex-shrink-0 text-gray-400" />
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
                  onClick={onOnboardAutomateClick}
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
  );
}

export default memo(OnboardAccessCard);
