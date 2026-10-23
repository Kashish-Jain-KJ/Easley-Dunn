import { BrowserRouter, Routes, Route } from "react-router-dom";
import { GoogleOAuthProvider } from "@react-oauth/google";
import { AuthProvider } from "./context/AuthContext";
import AppLayout, { Landing, RequireAdmin } from "./components/AppLayout";
import TeamsSection from "./pages/TeamsSection";
import TeamsPage from "./pages/TeamsPage";
import TeamsMapPage from "./pages/TeamsMapPage";
import PlaceholderPage from "./pages/PlaceholderPage";
import PeoplePage from "./pages/PeoplePage";
import AuditPage from "./pages/AuditPage";
import SetPasswordPage from "./pages/SetPasswordPage";
import AccessPage from "./pages/AccessPage";
import TeamPage from "./pages/TeamPage";


const GOOGLE_CLIENT_ID = process.env.REACT_APP_GOOGLE_CLIENT_ID || "1000000000000-dummyclientid.apps.googleusercontent.com";

export default function App() {
  return (
    <GoogleOAuthProvider clientId={GOOGLE_CLIENT_ID}>
      <AuthProvider>
        <BrowserRouter>
          <Routes>
            {/* Public: whoever opens an invite has no account yet, and
                whoever opens a reset cannot get in. One page serves both. */}
            <Route path="/invite/:token" element={<SetPasswordPage mode="invite" />} />
            <Route path="/reset/:token" element={<SetPasswordPage mode="reset" />} />
            <Route element={<AppLayout />}>
              {/* Where "/" and anything unrecognised go depends on the role,
                  so both defer to Landing rather than naming a section. */}
              <Route index element={<Landing />} />

              <Route element={<RequireAdmin />}>
                <Route path="/overview" element={<PlaceholderPage title="Overview" />} />
                <Route path="/people" element={<PeoplePage />} />
                <Route path="/people/:userId" element={<PeoplePage />} />
                <Route path="/teams" element={<TeamsSection />}>
                  <Route index element={<TeamsPage />} />
                  <Route path="map" element={<TeamsMapPage />} />
                  <Route path=":teamId" element={<TeamsPage />} />
                </Route>
                <Route path="/audit" element={<AuditPage />} />
              </Route>

              {/* The person's own screens. Any role, admin included: an admin
                  holds access and belongs to teams like anyone else. */}
              <Route path="/access" element={<AccessPage />} />
              <Route path="/team" element={<TeamPage />} />

              <Route path="*" element={<Landing />} />
            </Route>
          </Routes>
        </BrowserRouter>
      </AuthProvider>
    </GoogleOAuthProvider>
  );
}
