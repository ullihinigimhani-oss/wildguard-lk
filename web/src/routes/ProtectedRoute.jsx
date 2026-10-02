import { Navigate, Outlet, useLocation } from "react-router-dom";
import { useDemoAuth } from "../hooks/useDemoAuth";

// Demo state is not authentication. Only the read-only demo dashboard/profile opt in.
// Future real authentication must populate isAuthenticated after server verification.
export default function ProtectedRoute({ allowDemoPreview = false }) {
  const { user, isAuthenticated = false } = useDemoAuth();
  const location = useLocation();
  if (user && (isAuthenticated || allowDemoPreview)) return <Outlet />;
  return (
    <Navigate to="/register" replace state={{ from: location.pathname }} />
  );
}
