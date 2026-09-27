import { DemoAuthProvider } from "./hooks/useDemoAuth";
import AppRoutes from "./routes/AppRoutes";
export default function App() {
  return (
    <DemoAuthProvider>
      <AppRoutes />
    </DemoAuthProvider>
  );
}
