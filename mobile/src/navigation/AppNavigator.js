import React from "react";
import { createNativeStackNavigator } from "@react-navigation/native-stack";
import { useDemoAuth } from "../hooks/useDemoAuth";
import AuthNavigator from "./AuthNavigator";
import HomeScreen from "../screens/home/HomeScreen";
import ProfileScreen from "../screens/profile/ProfileScreen";
import AlertsScreen from "../screens/alerts/AlertsScreen";
import SyncScreen from "../screens/placeholders/SyncScreen";
import PlaceholderScreen from "../screens/placeholders/PlaceholderScreen";
const Stack = createNativeStackNavigator();
export default function AppNavigator() {
  const { user } = useDemoAuth();
  if (!user) return <AuthNavigator />;
  return (
    <Stack.Navigator
      screenOptions={{ headerTintColor: "#245b44", headerShadowVisible: false }}
    >
      <Stack.Screen
        name="Home"
        component={HomeScreen}
        options={{ title: "WildGuard LK · Demo" }}
      />
      <Stack.Screen name="Patrol" options={{ title: "My Patrol" }}>
        {(props) => <PlaceholderScreen {...props} title="Ranger patrol" />}
      </Stack.Screen>
      <Stack.Screen name="Incident" options={{ title: "Field incident" }}>
        {(props) => (
          <PlaceholderScreen {...props} title="Report Field Incident" />
        )}
      </Stack.Screen>
      <Stack.Screen
        name="Alerts"
        component={AlertsScreen}
        options={{ title: "Wildlife alerts" }}
      />
      <Stack.Screen
        name="Sync"
        component={SyncScreen}
        options={{ title: "Offline / Sync Status" }}
      />
      <Stack.Screen name="Profile" component={ProfileScreen} />
    </Stack.Navigator>
  );
}
