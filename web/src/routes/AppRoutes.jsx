import Users from "../pages/Users/Users";
import Register from "../pages/Register/Register";
import PatrolManagement from "../pages/PatrolManagement/PatrolManagement";
import EditPatrol from "../pages/PatrolManagement/EditPatrol";
import CreatePatrol from "../pages/PatrolManagement/CreatePatrol";
import PatrolDetails from "../pages/PatrolManagement/PatrolDetails";
import RangerMonitoring from "../pages/RangerMonitoring/RangerMonitoring";
import Reporting from "../pages/Reporting/Reporting";
import FieldMap from "../pages/FieldMap/FieldMap";
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
            <Route path="/patrols/:id/edit" element={<EditPatrol />} />
            <Route path="/patrols/:id" element={<PatrolDetails />} />
            <Route
              path="/incidents"
              element={<Placeholder title="Incidents" />}
            />
          </Route>
          <Route
            element={
              <ProtectedRoute allowedRoles={["COMMUNITY_LIAISON"]} />
            }
          >
            <Route
              path="/community-reports"
              element={<Placeholder title="Community Reports" />}
            />
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
                  !["users", "patrols", "incidents", "community-reports", "reporting", "map"].includes(
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
          </Route>
        </Route>
      </Route>
      <Route path="*" element={<NotFound />} />
    </Routes>
  );
}
