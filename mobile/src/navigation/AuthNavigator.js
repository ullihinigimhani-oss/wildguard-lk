import RegisterScreen from "../screens/auth/RegisterScreen";
import React from "react";
import { createNativeStackNavigator } from "@react-navigation/native-stack";
import WelcomeScreen from "../screens/auth/WelcomeScreen";
import LoginScreen from "../screens/auth/LoginScreen";
const Stack = createNativeStackNavigator();
export default function AuthNavigator() {
  return (
    <Stack.Navigator
      screenOptions={{
        headerTintColor: "#245b44",
        headerShadowVisible: false,
        headerTitleStyle: { fontWeight: "700" },
      }}
    >
      <Stack.Screen
        name="Welcome"
        component={WelcomeScreen}
        options={{ title: "WildGuard LK" }}
      />
      <Stack.Screen
        name="Login"
        component={LoginScreen}
        options={{ title: "Ranger login" }}
      />
      <Stack.Screen name="Register" component={RegisterScreen} options={{ title: "Join the community" }} />
    </Stack.Navigator>
  );
}
