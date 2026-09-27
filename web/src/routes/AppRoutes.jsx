import Register from "../pages/Register/Register";
import { Navigate, Outlet, Route, Routes } from "react-router-dom";
import { useDemoAuth } from "../hooks/useDemoAuth";
import OperationsLayout from "../layouts/OperationsLayout";
import Login from "../pages/Login/Login";
import Dashboard from "../pages/Dashboard/Dashboard";
import Profile from "../pages/Profile/Profile";
import Placeholder from "../pages/Placeholder";
import NotFound from "../pages/NotFound";
import { modules } from "../constants/navigation";
function DemoGate() {
  return useDemoAuth().user ? <Outlet /> : <Navigate to="/login" replace />;
}
export default function AppRoutes() {
  return (
    <Routes>
      <Route path="/" element={<Navigate to="/dashboard" replace />} />
      <Route path="/register" element={<Register />} />
      <Route path="/login" element={<Login />} />
      <Route
        path="/forgot-password"
        element={<Placeholder title="Password recovery" publicPage />}
      />
      <Route element={<DemoGate />}>
        <Route element={<OperationsLayout />}>
          <Route path="/dashboard" element={<Dashboard />} />
          <Route path="/profile" element={<Profile />} />
          {modules.map((item) => (
            <Route
              key={item.path}
              path={`/${item.path}`}
              element={<Placeholder title={item.title} />}
            />
          ))}
        </Route>
      </Route>
      <Route path="*" element={<NotFound />} />
    </Routes>
  );
}
