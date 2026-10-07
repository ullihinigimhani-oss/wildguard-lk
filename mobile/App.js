import React, { useMemo } from "react";
import { ActivityIndicator, StatusBar } from "react-native";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { NavigationContainer } from "@react-navigation/native";
import { AuthProvider, useAuth } from "./src/hooks/useAuth";
import AppNavigator from "./src/navigation/AppNavigator";
import { createLinking } from "./src/navigation/linking";
import { OnboardingProvider, useOnboarding } from "./src/hooks/useOnboarding";

function AppNavigation() {
  const { user, isAuthenticated, isDemo, hasLoggedOut } = useAuth();
  const { hasCompletedOnboarding, isReady } = useOnboarding();
  const linking = useMemo(() => createLinking({ user, isAuthenticated, isDemo, hasCompletedOnboarding, hasLoggedOut }), [user, isAuthenticated, isDemo, hasCompletedOnboarding, hasLoggedOut]);
  if (!isReady) return <ActivityIndicator style={{ flex: 1 }} accessibilityLabel="Loading app" />;
  return <NavigationContainer linking={linking}><AppNavigator /></NavigationContainer>;
}
export default function App() {
  return (
    <SafeAreaProvider>
      <StatusBar barStyle="dark-content" />
      <OnboardingProvider><AuthProvider>
        <AppNavigation />
      </AuthProvider></OnboardingProvider>
    </SafeAreaProvider>
  );
}
