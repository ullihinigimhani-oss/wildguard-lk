import Users from "../pages/Users/Users";
import Register from "../pages/Register/Register";
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
          </Route>
          <Route element={<ProtectedRoute />}>
            {modules
              .filter((item) => item.path !== "users")
              .map((item) => (
                <Route
                  key={item.path}
                  path={`/${item.path}`}
                  element={<Placeholder title={item.title} />}
                />
              ))}
          </Route>
        </Route>
      </Route>
      <Route path="*" element={<NotFound />} />
    </Routes>
  );
}
