import React, { useMemo, useContext, useState, useEffect } from "react";
import { ActivityIndicator, StatusBar } from "react-native";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { NavigationContainer, DefaultTheme } from "@react-navigation/native";
import { AuthProvider, useAuth } from "./src/hooks/useAuth";
import AppNavigator from "./src/navigation/AppNavigator";
import { createLinking } from "./src/navigation/linking";
import { OnboardingProvider, useOnboarding } from "./src/hooks/useOnboarding";
import { useFonts } from "expo-font";
import { PlusJakartaSans_400Regular } from "@expo-google-fonts/plus-jakarta-sans/400Regular";
import { PlusJakartaSans_500Medium } from "@expo-google-fonts/plus-jakarta-sans/500Medium";
import { PlusJakartaSans_600SemiBold } from "@expo-google-fonts/plus-jakarta-sans/600SemiBold";
import { PlusJakartaSans_700Bold } from "@expo-google-fonts/plus-jakarta-sans/700Bold";
import { TypographyContext } from "./src/components/common/Typography";
import { fontFamily } from "./src/constants/typography";
import { OfflineProvider } from './src/hooks/useOffline';

const documentTitle = { enabled: true, formatter: () => "WildGuard LK" };

function AppNavigation() {
  const fontsReady = useContext(TypographyContext);
  const theme = useMemo(
    () =>
      fontsReady
        ? {
            ...DefaultTheme,
            fonts: {
              regular: { fontFamily: fontFamily.regular, fontWeight: "normal" },
              medium: { fontFamily: fontFamily.medium, fontWeight: "normal" },
              bold: { fontFamily: fontFamily.semibold, fontWeight: "normal" },
              heavy: { fontFamily: fontFamily.bold, fontWeight: "normal" },
            },
          }
        : DefaultTheme,
    [fontsReady],
  );
  const { user, isAuthenticated, isDemo, hasLoggedOut } = useAuth();
  const { hasCompletedOnboarding, isReady } = useOnboarding();
  const linking = useMemo(
    () =>
      createLinking({
        user,
        isAuthenticated,
        isDemo,
        hasCompletedOnboarding,
        hasLoggedOut,
      }),
    [user, isAuthenticated, isDemo, hasCompletedOnboarding, hasLoggedOut],
  );
  if (!isReady)
    return (
      <ActivityIndicator style={{ flex: 1 }} accessibilityLabel="Loading app" />
    );
  return (
    <NavigationContainer
      linking={linking}
      documentTitle={documentTitle}
      theme={theme}
    >
      <AppNavigator />
    </NavigationContainer>
  );
}
export default function App() {
  const [fontsLoaded, fontError] = useFonts({
    PlusJakartaSans_400Regular,
    PlusJakartaSans_500Medium,
    PlusJakartaSans_600SemiBold,
    PlusJakartaSans_700Bold,
  });
  const [fontTimeout, setFontTimeout] = useState(false);

  useEffect(() => {
    const timer = setTimeout(() => {
      setFontTimeout(true);
    }, 1000);
    return () => clearTimeout(timer);
  }, []);

  const ready = Boolean(fontsLoaded || fontError || fontTimeout);

  return (
    <SafeAreaProvider>
      <StatusBar barStyle="dark-content" />
      {!ready ? (
        <ActivityIndicator
          style={{ flex: 1 }}
          color="#245b44"
          accessibilityLabel="Loading app"
        />
      ) : (
        <TypographyContext.Provider value={Boolean(fontsLoaded)}>
          <OnboardingProvider>
            <AuthProvider>
              <OfflineProvider>
                <AppNavigation />
              </OfflineProvider>
            </AuthProvider>
          </OnboardingProvider>
        </TypographyContext.Provider>
      )}
    </SafeAreaProvider>
  );
}
