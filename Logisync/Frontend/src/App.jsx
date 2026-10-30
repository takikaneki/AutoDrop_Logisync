import { Routes, Route, Navigate, Outlet } from "react-router-dom";
import AppLayout from "./components/AppLayout.jsx";
import Login from "./pages/Login.jsx";
import Dashboard from "./pages/Dashboard.jsx";
import Parcels from "./pages/Parcels.jsx";
import ParcelDetails from "./pages/ParcelDetails.jsx";
import Reports from "./pages/Reports.jsx";
import Verification from "./pages/Verification.jsx";
import Riders from "./pages/Riders.jsx";
import Sellers from "./pages/Sellers.jsx";
import Messages from "./pages/Messages.jsx";
import Complaints from "./pages/Complaints.jsx";
import Announcements from "./pages/Announcements.jsx";
import Notifications from "./pages/Notifications.jsx";
import AuditLog from "./pages/AuditLog.jsx";
import Accounts from "./pages/Accounts.jsx";
import ActivityPage from "./pages/shared/ActivityPage.jsx";
import Settings from "./pages/Settings.jsx";
import About from "./pages/About.jsx";
import Contact from "./pages/Contact.jsx";
import Help from "./pages/Help.jsx";
import DashboardLayout from "./components/layout/DashboardLayout.jsx";
import SellerDashboard from "./pages/seller/SellerDashboard.jsx";
import CreateParcel from "./pages/seller/CreateParcel.jsx";
import RiderDashboard from "./pages/rider/RiderDashboard.jsx";
import RiderScan from "./pages/rider/RiderScan.jsx";
import RiderDeliveries from "./pages/rider/RiderDeliveries.jsx";
import RiderReports from "./pages/rider/RiderReports.jsx";
import RiderParcels from "./pages/rider/RiderParcels.jsx";
import PortalNotifications from "./pages/shared/PortalNotifications.jsx";
import PortalComplaints from "./pages/shared/PortalComplaints.jsx";
import ParcelRecords from "./pages/seller/ParcelRecords.jsx";
import ScanUpload from "./pages/seller/ScanUpload.jsx";
import MessagesPage from "./pages/shared/MessagesPage.jsx";
import SettingsPage from "./pages/shared/SettingsPage.jsx";
import HelpPage from "./pages/shared/HelpPage.jsx";
import { isLoggedIn, getRole, clearSession, homePathForRole } from "./api.js";

// Bantay ng mga page: kailangan naka-login AT tama ang role.
// Paalala: para sa tamang daan lang ito. Ang backend (authorizeRoles) ang
// totoong nagbabawal sa maling role, kahit baguhin ang laman ng browser.
function RequireRole({ allow }) {
  if (!isLoggedIn()) return <Navigate to="/login" replace />;

  const role = getRole();
  const home = homePathForRole(role);
  if (!home) {
    clearSession(); // walang role o hindi kilala
    return <Navigate to="/login" replace />;
  }
  return allow.includes(role) ? <Outlet /> : <Navigate to={home} replace />;
}

// Kapag naka-login na, huwag nang ipakita ang login page
function LoginRoute() {
  if (isLoggedIn()) {
    const home = homePathForRole(getRole());
    if (home) return <Navigate to={home} replace />;
    clearSession();
  }
  return <Login />;
}

export default function App() {
  return (
    <Routes>
      <Route path="/login" element={<LoginRoute />} />
      <Route path="/register" element={<Navigate to="/login" replace />} />

      {/* SELLER */}
      <Route element={<RequireRole allow={["seller"]} />}>
        <Route path="/seller" element={<DashboardLayout role="seller" />}>
          <Route index element={<SellerDashboard />} />
          <Route path="parcels" element={<ParcelRecords />} />
          <Route path="create" element={<CreateParcel />} />
          <Route path="scan" element={<ScanUpload />} />
          <Route path="activity" element={<ActivityPage />} />
          <Route path="announcements" element={<Navigate to="/seller/notifications" replace />} />
          <Route path="messages" element={<MessagesPage />} />
          <Route path="complaints" element={<PortalComplaints />} />
          <Route path="notifications" element={<PortalNotifications />} />
          <Route path="settings" element={<SettingsPage />} />
          <Route path="about" element={<About />} />
          <Route path="contact" element={<Contact />} />
          <Route path="help" element={<HelpPage />} />
        </Route>
      </Route>

      {/* RIDER */}
      <Route element={<RequireRole allow={["rider"]} />}>
        <Route path="/rider" element={<DashboardLayout role="rider" />}>
          <Route index element={<RiderDashboard />} />
          <Route path="scan" element={<RiderScan />} />
          <Route path="parcels" element={<RiderParcels />} />
          <Route path="deliveries" element={<RiderDeliveries />} />
          <Route path="pending" element={<Navigate to="/rider/deliveries" replace />} />
          <Route path="delivered" element={<Navigate to="/rider/deliveries?tab=delivered" replace />} />
          <Route path="failed" element={<Navigate to="/rider/deliveries?tab=failed" replace />} />
          <Route path="reports" element={<RiderReports />} />
          <Route path="activity" element={<ActivityPage />} />
          <Route path="announcements" element={<Navigate to="/rider/notifications" replace />} />
          <Route path="messages" element={<MessagesPage />} />
          <Route path="complaints" element={<PortalComplaints />} />
          <Route path="notifications" element={<PortalNotifications />} />
          <Route path="settings" element={<SettingsPage />} />
          <Route path="about" element={<About />} />
          <Route path="contact" element={<Contact />} />
          <Route path="help" element={<HelpPage />} />
        </Route>
      </Route>

      <Route element={<RequireRole allow={["coordinator"]} />}>
        <Route element={<AppLayout />}>
          <Route path="/dashboard" element={<Dashboard />} />
          <Route path="/parcels" element={<Parcels />} />
          <Route path="/parcels/:id" element={<ParcelDetails />} />
          <Route path="/reports" element={<Reports />} />
          <Route path="/verification" element={<Verification />} />
          <Route path="/riders" element={<Riders />} />
          <Route path="/sellers" element={<Sellers />} />
          <Route path="/messages" element={<Messages />} />
          <Route path="/complaints" element={<Complaints />} />
          <Route path="/announcements" element={<Announcements />} />
          <Route path="/notifications" element={<Notifications />} />
          <Route path="/analytics" element={<Navigate to="/dashboard" replace />} />
          <Route path="/audit" element={<AuditLog />} />
          <Route path="/accounts" element={<Accounts />} />
          <Route path="/settings" element={<Settings />} />
          <Route path="/about" element={<About />} />
          <Route path="/contact" element={<Contact />} />
          <Route path="/help" element={<Help />} />
        </Route>
      </Route>
      <Route path="*" element={<Navigate to="/login" replace />} />
    </Routes>
  );
}