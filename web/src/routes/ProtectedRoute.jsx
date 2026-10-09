import { Navigate, Outlet, useLocation } from "react-router-dom";
import { useAuth } from "../hooks/useAuth";

export default function ProtectedRoute({ allowedRoles }) {
  const { user, isAuthenticated, isLoading } = useAuth();
  const location = useLocation();
  if (isLoading) return <p role="status">Restoring your session…</p>;
  if (isAuthenticated)
    return allowedRoles && !allowedRoles.includes(user?.role) ? (
      <Navigate to="/profile" replace />
    ) : (
      <Outlet />
    );
  return <Navigate to="/login" replace state={{ from: location.pathname }} />;
}
