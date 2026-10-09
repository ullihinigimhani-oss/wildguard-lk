import Users from "../pages/Users/Users";
import Incidents from "../pages/Incidents/Incidents";
import PatrolReports from "../pages/Incidents/PatrolReports";
import IncidentDetailsPage from "../pages/Incidents/IncidentDetailsPage";
import Register from "../pages/Register/Register";
import PatrolManagement from "../pages/PatrolManagement/PatrolManagement";
import EditPatrol from "../pages/PatrolManagement/EditPatrol";
import CreatePatrol from "../pages/PatrolManagement/CreatePatrol";
import PatrolDetails from "../pages/PatrolManagement/PatrolDetails";
import CommunityReports from "../pages/CommunityReports/CommunityReports";
import CommunityReportDetailsPage from "../pages/CommunityReports/CommunityReportDetailsPage";
import Analytics from "../pages/Analytics/Analytics";
import RangerMonitoring from "../pages/RangerMonitoring/RangerMonitoring";
import RangerTrack from "../pages/RangerMonitoring/RangerTrack";
import Reporting from "../pages/Reporting/Reporting";
import FieldMap from "../pages/FieldMap/FieldMap";
import WildlifeMonitoring from "../pages/WildlifeMonitoring/WildlifeMonitoring";
import ConservationReports from "../pages/ConservationReports/ConservationReports";
import { Navigate, Route, Routes } from "react-router-dom";
import { useAuth } from "../hooks/useAuth";
import OperationsLayout from "../layouts/OperationsLayout";
import Login from "../pages/Login/Login";
import Dashboard from "../pages/Dashboard/Dashboard";
import Profile from "../pages/Profile/Profile";
import Placeholder from "../pages/Placeholder";
import NotFound from "../pages/NotFound";
import { modules } from "../constants/navigation";
import Landing from "../pages/Landing/Landing";
import ProtectedRoute from "./ProtectedRoute";
function RegistrationEntry() {
  const { user, isAuthenticated = false, isLoading } = useAuth();
  if (isLoading) return <p role="status">Restoring your session…</p>;
  return user && isAuthenticated ? (
    <Navigate to="/dashboard" replace />
  ) : (
    <Register />
  );
}
export default function AppRoutes() {
  return (
    <Routes>
      <Route path="/" element={<Landing />} />
      <Route path="/register" element={<RegistrationEntry />} />
      <Route path="/login" element={<Login />} />
      <Route
        path="/forgot-password"
        element={<Placeholder title="Password recovery" publicPage />}
      />
      <Route element={<ProtectedRoute />}>
        <Route element={<OperationsLayout />}>
          <Route path="/dashboard" element={<Dashboard />} />
          <Route path="/profile" element={<Profile />} />
          <Route element={<ProtectedRoute allowedRoles={["PARK_MANAGER"]} />}>
            <Route path="/users" element={<Users />} />
            <Route path="/patrols" element={<PatrolManagement />} />
            <Route path="/patrols/new" element={<CreatePatrol />} />
            <Route path="/patrols/live" element={<RangerMonitoring />} />
            <Route path="/patrols/:id/track" element={<RangerTrack />} />
            <Route path="/patrols/:id/edit" element={<EditPatrol />} />
            <Route path="/patrols/:id" element={<PatrolDetails />} />
            <Route
              path="/incidents"
              element={<Incidents />}
            />
            <Route path="/incidents/patrol/:patrolId" element={<PatrolReports />} />
            <Route path="/incidents/patrol/:patrolId/:incidentId" element={<IncidentDetailsPage />} />
            <Route path="/incidents/unassigned/:incidentId" element={<IncidentDetailsPage />} />
            <Route path="/community-reports" element={<CommunityReports />} />
            <Route path="/community-reports/:reportId" element={<CommunityReportDetailsPage />} />
            <Route path="/analytics" element={<Analytics />} />
            <Route path="/conservation-reports" element={<ConservationReports />} />
          </Route>
          <Route
            element={
              <ProtectedRoute allowedRoles={["RESEARCHER"]} />
            }
          >
            <Route path="/reporting" element={<Reporting />} />
          </Route>
          <Route element={<ProtectedRoute />}>
            {modules
              .filter(
                (item) =>
                  !["users", "patrols", "incidents", "community-reports", "analytics", "conservation-reports", "reporting", "map", "wildlife"].includes(
                    item.path,
                  ),
              )
              .map((item) => (
                <Route
                  key={item.path}
                  path={`/${item.path}`}
                  element={<Placeholder title={item.title} />}
                />
              ))}
            <Route path="/map" element={<FieldMap />} />
            <Route path="/wildlife" element={<WildlifeMonitoring />} />
          </Route>
        </Route>
      </Route>
      <Route path="*" element={<NotFound />} />
    </Routes>
  );
}
