import React from "react";
import { StatusBar } from "react-native";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { NavigationContainer } from "@react-navigation/native";
import { DemoAuthProvider } from "./src/hooks/useDemoAuth";
import AppNavigator from "./src/navigation/AppNavigator";
export default function App() {
  return (
    <SafeAreaProvider>
      <StatusBar barStyle="dark-content" />
      <DemoAuthProvider>
        <NavigationContainer>
          <AppNavigator />
        </NavigationContainer>
      </DemoAuthProvider>
    </SafeAreaProvider>
  );
}
