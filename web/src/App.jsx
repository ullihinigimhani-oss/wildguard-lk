import { AuthProvider } from "./hooks/useAuth";
import AppRoutes from "./routes/AppRoutes";
import ZoneAlertBanner from "./components/ZoneAlertBanner";

export default function App() {
  return (
    <AuthProvider>
      <ZoneAlertBanner />
      <AppRoutes />
    </AuthProvider>
  );
}
