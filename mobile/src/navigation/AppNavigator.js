import PatrolRouteScreen from "../screens/patrol/PatrolRouteScreen";
import React from "react";
import { createNativeStackNavigator } from "@react-navigation/native-stack";
import { useAuth } from "../hooks/useAuth";
import { authenticatedDestination } from "../constants/roles";
import AuthNavigator from "./AuthNavigator";
import HomeScreen from "../screens/home/HomeScreen";
import DemoHomeScreen from "../screens/home/DemoHomeScreen";
import MyPatrolScreen from "../screens/patrol/MyPatrolScreen";
import PatrolDetailsScreen from "../screens/patrol/PatrolDetailsScreen";
import RangerIncidentScreen from "../screens/incident/RangerIncidentScreen";
import RangerShell from "./RangerShell";
import ProfileScreen from "../screens/profile/ProfileScreen";
import AlertsScreen from "../screens/alerts/AlertsScreen";
import AlertDetailsScreen from "../screens/alerts/AlertDetailsScreen";
import CommunityReportScreen from "../screens/community/CommunityReportScreen";
import ReportStatusScreen from "../screens/community/ReportStatusScreen";
import LiaisonReviewScreen from "../screens/community/LiaisonReviewScreen";
import CommunityShell from "./CommunityShell";
import LiaisonShell from "./LiaisonShell";
import SyncScreen from "../screens/placeholders/SyncScreen";
import PlaceholderScreen from "../screens/placeholders/PlaceholderScreen";

const Stack = createNativeStackNavigator();

export default function AppNavigator() {
  const { user, isDemo, isAuthenticated } = useAuth();
  if (!user) return <AuthNavigator />;
  const destination = isAuthenticated ? authenticatedDestination(user) : null;
  if (!isDemo && !destination) return <AuthNavigator />;
  const rangerArea = isDemo || destination === "Home";

  // Authenticated Ranger Stack
  if (!isDemo && destination === "Home") {
    return (
      <Stack.Navigator
        key={`${user.id}:ranger`}
        initialRouteName="Home"
        screenOptions={{ headerShown: false, animation: "none" }}
      >
        {[
          ["Home", "Dashboard", HomeScreen],
          ["Patrol", "My Patrol", MyPatrolScreen],
          ["Incident", "Report Incident", RangerIncidentScreen],
          ["Profile", "Profile", ProfileScreen],
        ].map(([name, title, Component]) => (
          <Stack.Screen key={name} name={name} options={{ title, headerBackVisible: false }}>
            {(props) => (
              <RangerShell {...props}>
                <Component {...props} />
              </RangerShell>
            )}
          </Stack.Screen>
        ))}
      </Stack.Navigator>
    );
  }

  // Authenticated Community Member Stack
  if (!isDemo && user.role === "COMMUNITY_USER") {
    return (
      <Stack.Navigator
        key={`${user.id}:community`}
        initialRouteName="SafetyAlerts"
        screenOptions={{ headerShown: false, animation: "none" }}
      >
        {[
          ["SafetyAlerts", "Wildlife Alerts", AlertsScreen],
          ["Report", "Report Incident", CommunityReportScreen],
          ["MyReports", "My Reports", ReportStatusScreen],
          ["Profile", "Profile", ProfileScreen],
        ].map(([name, title, Component]) => (
          <Stack.Screen key={name} name={name} options={{ title, headerBackVisible: false }}>
            {(props) => (
              <CommunityShell {...props}>
                <Component {...props} />
              </CommunityShell>
            )}
          </Stack.Screen>
        ))}
        <Stack.Screen
          name="AlertDetails"
          component={AlertDetailsScreen}
          options={{
            headerShown: true,
            title: "Safety Advisory",
            headerTintColor: "#245b44",
            headerShadowVisible: false,
          }}
        />
        <Stack.Screen
          name="PatrolDetails"
          component={PatrolDetailsScreen}
          options={{
            headerShown: true,
            title: "Patrol Details",
            headerTintColor: "#245b44",
            headerShadowVisible: false,
          }}
        />
        <Stack.Screen
          name="PatrolRoute"
          component={PatrolRouteScreen}
          options={{
            headerShown: true,
            title: "Patrol Route",
            headerTintColor: "#245b44",
            headerShadowVisible: false,
          }}
        />
      </Stack.Navigator>
    );
  }

  // Authenticated Community Liaison Stack
  if (!isDemo && user.role === "COMMUNITY_LIAISON") {
    return (
      <Stack.Navigator
        key={`${user.id}:liaison`}
        initialRouteName="Review"
        screenOptions={{ headerShown: false, animation: "none" }}
      >
        {[
          ["Review", "Incident Review", LiaisonReviewScreen],
          ["SafetyAlerts", "Wildlife Alerts", AlertsScreen],
          ["Report", "New Report", CommunityReportScreen],
          ["Profile", "Profile", ProfileScreen],
        ].map(([name, title, Component]) => (
          <Stack.Screen key={name} name={name} options={{ title, headerBackVisible: false }}>
            {(props) => (
              <LiaisonShell {...props}>
                <Component {...props} />
              </LiaisonShell>
            )}
          </Stack.Screen>
        ))}
        <Stack.Screen
          name="AlertDetails"
          component={AlertDetailsScreen}
          options={{
            headerShown: true,
            title: "Safety Advisory",
            headerTintColor: "#245b44",
            headerShadowVisible: false,
          }}
        />
      </Stack.Navigator>
    );
  }

  // Fallback Stack (Park Manager, Researcher, Demo)
  return (
    <Stack.Navigator
      key={isDemo ? "demo" : `${user.id}:${user.role}`}
      initialRouteName={rangerArea ? "Home" : "Profile"}
      screenOptions={{ headerTintColor: "#245b44", headerShadowVisible: false }}
    >
      {rangerArea && (
        <>
          <Stack.Screen
            name="Home"
            component={DemoHomeScreen}
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
        </>
      )}
      <Stack.Screen name="Profile" component={ProfileScreen} />
    </Stack.Navigator>
  );
}
