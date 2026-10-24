/**
 * @file PersonDetail.js
 * @description The right-hand pane of the People section: the selected
 * person's details and their service access.
 *
 * This replaces the old Access tab, which listed every user again and made you
 * hunt for someone before you could change anything. Access belongs to the
 * person, which is how Okta and Entra arrange it too.
 *
 * The onboard / offboard logic here is moved from App.js unchanged, including
 * its per-service endpoints. Replacing those with the connector contract
 * (DESIGN.md section 5) is a separate piece of work.
 */

import React, { useState, useEffect, useMemo, useCallback } from "react";
import { Link } from "react-router-dom";
import { Pencil, Power, Send, Copy, Check } from "lucide-react";
import UserInfoCard from "./UserInfoCard";
import EditPersonModal from "./EditPersonModal";
import OnboardAccessCard from "./OnboardAccessCard";
import OffboardAccessCard from "./OffboardAccessCard";
import ConfirmModal from "./ConfirmModal";
import ToastContainer from "./ToastContainer";
import AuditTable from "./AuditTable";
import { fetchWithAuth } from "../utils/fetchWithAuth";
import { summarize } from "../utils/connectorResults";

const API_URL = process.env.REACT_APP_API_URL || "http://localhost:5001";

// The server's own titles, from roles.config.js. USER used to render as a
// dash on the idea that "user" said nothing worth saying; in a list where
// every other role is spelled out, a dash reads as missing data instead.
const ROLE_TITLES = { ADMIN: "Admin", LEAD: "Team Lead", USER: "User" };

const TABS = [
  { id: "details", label: "User details" },
  { id: "access", label: "Access control" },
  { id: "activity", label: "Activity" },
];

function Field({ label, children }) {
  return (
    <div>
      <dt className="text-[11px] font-semibold uppercase tracking-wider text-slate-500">{label}</dt>
      <dd className="m-0 mt-0.5 text-slate-900">{children}</dd>
    </div>
  );
}

export default function PersonDetail({ person, teams = [], services = [], onPersonChanged }) {
  const userId = person?.user_id;
  const [tab, setTab] = useState("details");
  const [editing, setEditing] = useState(false);

  const [manualAccess, setManualAccess] = useState(new Set());
  const [automateAccess, setAutomateAccess] = useState(new Set());
  const [onboardManualAccess, setOnboardManualAccess] = useState(new Set());
  const [onboardAutomateAccess, setOnboardAutomateAccess] = useState(new Set());
  const [userAccesses, setUserAccesses] = useState([]);
  const [discordStatus, setDiscordStatus] = useState(null);
  const [isAccessLoading, setIsAccessLoading] = useState(false);
  const [isOffboarding, setIsOffboarding] = useState(false);
  const [isOnboarding, setIsOnboarding] = useState(false);
  const [toasts, setToasts] = useState([]);
  const [confirmModal, setConfirmModal] = useState({
    isOpen: false,
    type: "onboard",
    isAutomate: false,
    permissions: [],
    userName: "",
  });

  const showToast = useCallback((toast) => {
    const id = Date.now() + Math.random().toString(36).substr(2, 9);
    setToasts((prev) => [...prev, { ...toast, id }]);
    setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id));
    }, 6000);
  }, []);

  const [togglingStatus, setTogglingStatus] = useState(false);
  const [inviting, setInviting] = useState(false);
  // Set when the invite could not be emailed, so the link can still be handed over.
  const [inviteLink, setInviteLink] = useState(null);
  const [linkCopied, setLinkCopied] = useState(false);

  const handleOnboardManualToggle = useCallback((access) => {
    setOnboardManualAccess((prev) => {
      const next = new Set(prev);
      if (next.has(access)) next.delete(access);
      else next.add(access);
      return next;
    });
  }, []);

  const handleOnboardAutomateToggle = useCallback((access) => {
    setOnboardAutomateAccess((prev) => {
      const next = new Set(prev);
      if (next.has(access)) next.delete(access);
      else next.add(access);
      return next;
    });
  }, []);

  const handleManualAccessToggle = useCallback((access) => {
    setManualAccess((prev) => {
      const next = new Set(prev);
      if (next.has(access)) next.delete(access);
      else next.add(access);
      return next;
    });
  }, []);

  const handleAutomateAccessToggle = useCallback((access) => {
    setAutomateAccess((prev) => {
      const next = new Set(prev);
      if (next.has(access)) next.delete(access);
      else next.add(access);
      return next;
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


  // Everything except this person's own access is already in hand from the
  // page, so selecting someone costs one request, not six.
  const selectedUser = useMemo(
    () => (person ? { ...person, id: person.user_id, hasPassword: !!person.has_password } : null),
    [person]
  );

  // Services decide the Automate / Manual split, so this runs again when they
  // land. It does not wait for them: a slow or failed services call should not
  // leave the tab empty with no explanation.
  useEffect(() => {
    if (!userId) return;
    setIsAccessLoading(true);
    fetchUserAccesses(userId).finally(() => setIsAccessLoading(false));
  }, [userId, services, fetchUserAccesses]);

  // Only the revoke card reads this, so it waits until that tab is opened.
  useEffect(() => {
    if (userId && tab === "access") fetchDiscordStatus(userId);
  }, [userId, tab, fetchDiscordStatus]);

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
        // The per-target rows decide this, not data.success: a connector
        // reports success as soon as *one* target worked, so a revoke that
        // left a folder behind used to come back green.
        const { outcome } = summarize(data.data);
        const isSuccess = outcome ? outcome === "ok" : response.ok && data.success;
        showToast({
          type: "offboard",
          isAutomate,
          success: isSuccess,
          title: outcome === "partial"
            ? `Partly revoked "${serviceName}" for ${selectedUser.name}`
            : isSuccess
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
    if (selectedUser) fetchDiscordStatus(selectedUser.id);
  }, [selectedUser, userAccesses, showToast, fetchUserAccesses, fetchDiscordStatus]);

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
        // See the note in offboardAccesses: the rows are the evidence, the
        // top-level flag calls a half-done grant a success.
        const { outcome } = summarize(data.data);
        const isSuccess = outcome ? outcome === "ok" : response.ok && data.success;
        showToast({
          type: "onboard",
          isAutomate,
          success: isSuccess,
          title: outcome === "partial"
            ? `Partly granted "${serviceName}" for ${selectedUser.name}`
            : isSuccess
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
    if (selectedUser) fetchDiscordStatus(selectedUser.id);
  }, [selectedUser, services, showToast, fetchUserAccesses, fetchDiscordStatus]);

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

  const toggleStatus = useCallback(async () => {
    setTogglingStatus(true);
    try {
      const res = await fetchWithAuth(`${API_URL}/admin/roles/${userId}/status`, { method: "PATCH" });
      const data = await res.json();
      if (!res.ok || !data.success) throw new Error(data.message || "Could not change the status.");
      showToast({ type: "success", title: "Status updated", message: data.message });
      if (onPersonChanged) onPersonChanged();
    } catch (err) {
      showToast({ type: "error", title: "Action failed", message: err.message });
    } finally {
      setTogglingStatus(false);
    }
  }, [userId, showToast, onPersonChanged]);

  // Sending again is always allowed while they have no password: an email can
  // fail, bounce or be lost long after the account exists.
  const resendInvite = useCallback(async () => {
    setInviting(true);
    setInviteLink(null);
    try {
      const res = await fetchWithAuth(`${API_URL}/users/${userId}/invite`, { method: "POST" });
      const data = await res.json();
      if (!res.ok || !data.success) throw new Error(data.message || "Could not send the invite.");
      if (data.inviteSent) {
        showToast({ type: "success", title: "Invite sent", message: data.message });
      } else {
        setInviteLink(data.inviteLink);
        setLinkCopied(false);
        showToast({ type: "error", title: "Email failed", message: data.inviteError || data.message });
      }
    } catch (err) {
      showToast({ type: "error", title: "Could not send the invite", message: err.message });
    } finally {
      setInviting(false);
    }
  }, [userId, showToast]);

  const memberships = useMemo(
    () =>
      teams
        .filter((t) => (t.members || []).some((m) => String(m.user_id) === String(userId)))
        .map((t) => ({
          ...t,
          isLead: (t.members || []).some((m) => String(m.user_id) === String(userId) && m.is_lead),
        })),
    [teams, userId]
  );


  return (
    <div className="flex flex-col gap-4">
        <UserInfoCard selectedUser={selectedUser} teams={memberships} />

        <div role="tablist" aria-label="User views" className="inline-flex gap-1 p-1 bg-slate-200/70 rounded-xl self-start">
          {TABS.map((t) => (
            <button
              key={t.id}
              type="button"
              role="tab"
              aria-selected={tab === t.id}
              onClick={() => setTab(t.id)}
              className={`min-h-[36px] px-3.5 rounded-lg text-[13px] font-semibold cursor-pointer ${
                tab === t.id ? "bg-white text-slate-900 shadow-sm" : "text-slate-600 hover:text-slate-900"
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>

        {tab === "details" && (
          <div className="bg-white border border-slate-200 rounded-xl p-5 flex flex-col gap-4">
            <div className="flex items-center justify-between gap-3">
              <h2 className="m-0 text-[15px] font-semibold">Details</h2>
              <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setEditing(true)}
                className="flex items-center gap-1.5 min-h-[36px] px-3 border border-slate-300 rounded-lg bg-white text-[13px] font-semibold cursor-pointer hover:bg-slate-50"
              >
                <Pencil className="w-3.5 h-3.5" /> Edit details
              </button>
              <button
                type="button"
                onClick={toggleStatus}
                disabled={togglingStatus}
                className={`flex items-center gap-1.5 min-h-[36px] px-3 border rounded-lg bg-white text-[13px] font-semibold cursor-pointer disabled:opacity-50 ${
                  selectedUser.is_active ? "border-slate-300 text-red-700 hover:bg-red-50" : "border-slate-300 hover:bg-slate-50"
                }`}
              >
                <Power className="w-3.5 h-3.5" />
                {selectedUser.is_active ? "Deactivate" : "Activate"}
              </button>
              </div>
            </div>
            <dl className="grid grid-cols-2 lg:grid-cols-4 gap-5 m-0">
            <Field label="Email">{selectedUser.email}</Field>
            <Field label="Role">{ROLE_TITLES[selectedUser.Role] || selectedUser.Role || "—"}</Field>
            <Field label="Status">{selectedUser.is_active ? "Active" : "Inactive"}</Field>
            <Field label="Started">
              {selectedUser.start_date ? new Date(selectedUser.start_date).toLocaleDateString() : "—"}
            </Field>
            <Field label="Last login">
              {selectedUser.last_login_at ? new Date(selectedUser.last_login_at).toLocaleString() : "Never"}
            </Field>
            <Field label="Password">
              {selectedUser.hasPassword ? (
                "Set"
              ) : (
                <span className="flex flex-col items-start gap-1">
                  <span className="text-amber-700">Not set — invited, cannot sign in yet</span>
                  <button
                    type="button"
                    onClick={resendInvite}
                    disabled={inviting}
                    className="flex items-center gap-1.5 h-7 px-2 border border-slate-300 rounded-md bg-white text-xs font-medium disabled:opacity-50 cursor-pointer hover:bg-slate-50"
                  >
                    <Send className="w-3 h-3" /> {inviting ? "Sending…" : "Resend invite"}
                  </button>
                </span>
              )}
            </Field>
            <Field label="Active services">{userAccesses.length}</Field>
            </dl>

            {inviteLink && (
              <div className="border-t border-slate-100 pt-4">
                <h3 className="m-0 mb-1.5 text-[11px] font-semibold uppercase tracking-wider text-slate-500">
                  Invite link — pass this on yourself
                </h3>
                <div className="flex items-center gap-2">
                  <input
                    readOnly
                    value={inviteLink}
                    onFocus={(e) => e.target.select()}
                    className="flex-1 min-w-0 h-8 px-2.5 bg-slate-50 border border-slate-300 rounded-md text-[13px] font-mono"
                  />
                  <button
                    type="button"
                    onClick={() => { navigator.clipboard?.writeText(inviteLink); setLinkCopied(true); }}
                    className="flex items-center gap-1.5 h-8 px-2.5 border border-slate-300 rounded-md bg-white text-[13px] font-medium cursor-pointer hover:bg-slate-50"
                  >
                    {linkCopied ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5" />}
                    {linkCopied ? "Copied" : "Copy"}
                  </button>
                </div>
                <p className="mt-1 mb-0 text-xs text-slate-500">Works once, and expires in seven days.</p>
              </div>
            )}

            <div className="border-t border-slate-100 pt-4">
              <h3 className="m-0 mb-1.5 text-[11px] font-semibold uppercase tracking-wider text-slate-500">Teams</h3>
              {memberships.length ? (
                <ul className="m-0 p-0 list-none flex flex-col">
                  {memberships.map((t) => (
                    <li key={t.team_id} className="flex items-center justify-between gap-3 py-2 border-b border-slate-100 last:border-b-0">
                      <Link to={`/teams/${t.team_id}`} className="font-semibold text-blue-700 no-underline">
                        {t.name}
                      </Link>
                      <span className="text-xs text-slate-600">
                        {t.isLead ? "Lead" : "Member"}
                        {!t.is_active && " · archived"}
                      </span>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="m-0 text-slate-600">
                  Not in any team. Add them from <Link to="/teams" className="text-blue-700 no-underline">Teams</Link>.
                </p>
              )}
            </div>
          </div>
        )}

        {tab === "access" && (
          <>
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 items-stretch">
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

          </>
        )}

        {tab === "activity" && (
          <AuditTable
            filters={{ targetUserId: userId }}
            showTarget={false}
            categories
            emptyText="Nothing recorded for this user yet."
          />
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

        {editing && (
          <EditPersonModal
            person={{
              email: selectedUser.email,
              name: selectedUser.name,
              role: selectedUser.Role,
              hasPassword: selectedUser.hasPassword,
            }}
            teamNames={memberships.map((t) => t.name).join(", ")}
            onClose={() => setEditing(false)}
            onSaved={(text) => {
              showToast({ type: "success", title: "Saved", message: text });
              if (onPersonChanged) onPersonChanged();
            }}
          />
        )}

        <ToastContainer toasts={toasts} onCloseToast={handleCloseToast} />
    </div>
  );
}
