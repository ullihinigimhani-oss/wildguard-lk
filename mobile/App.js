import React, { useMemo } from "react";
import { StatusBar } from "react-native";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { NavigationContainer } from "@react-navigation/native";
import { AuthProvider, useAuth } from "./src/hooks/useAuth";
import AppNavigator from "./src/navigation/AppNavigator";
import { createLinking } from "./src/navigation/linking";

function AppNavigation() {
  const { user, isAuthenticated, isDemo } = useAuth();
  const linking = useMemo(() => createLinking({ user, isAuthenticated, isDemo }), [user, isAuthenticated, isDemo]);
  return <NavigationContainer linking={linking}><AppNavigator /></NavigationContainer>;
}
export default function App() {
  return (
    <SafeAreaProvider>
      <StatusBar barStyle="dark-content" />
      <AuthProvider>
        <AppNavigation />
      </AuthProvider>
    </SafeAreaProvider>
  );
}
