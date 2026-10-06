import React from "react";
import { createNativeStackNavigator } from "@react-navigation/native-stack";
import { useAuth } from "../hooks/useAuth";
import { authenticatedDestination } from "../constants/roles";
import AuthNavigator from "./AuthNavigator";
import HomeScreen from "../screens/home/HomeScreen";
import ProfileScreen from "../screens/profile/ProfileScreen";
import AlertsScreen from "../screens/alerts/AlertsScreen";
import SyncScreen from "../screens/placeholders/SyncScreen";
import PlaceholderScreen from "../screens/placeholders/PlaceholderScreen";
const Stack = createNativeStackNavigator();
export default function AppNavigator() {
  const { user, isDemo, isAuthenticated } = useAuth();
  if (!user) return <AuthNavigator />;
  const destination = isAuthenticated ? authenticatedDestination(user) : null;
  if (!isDemo && !destination) return <AuthNavigator />;
  const rangerArea = isDemo || destination === "Home";
  return (
    <Stack.Navigator
      key={isDemo ? "demo" : `${user.id}:${user.role}`}
      initialRouteName={rangerArea ? "Home" : "Profile"}
      screenOptions={{ headerTintColor: "#245b44", headerShadowVisible: false }}
    >
      {rangerArea && <><Stack.Screen
        name="Home"
        component={HomeScreen}
        options={{ title: isDemo ? "WildGuard LK · Demo" : "WildGuard LK" }}
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
      </>}
      <Stack.Screen name="Profile" component={ProfileScreen} />
    </Stack.Navigator>
  );
}
