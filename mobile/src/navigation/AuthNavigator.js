import RegisterScreen from "../screens/auth/RegisterScreen";
import React from "react";
import { createNativeStackNavigator } from "@react-navigation/native-stack";
import WelcomeScreen from "../screens/auth/WelcomeScreen";
import LoginScreen from "../screens/auth/LoginScreen";
import OnboardingScreen1 from "../screens/onboarding/OnboardingScreen1";
import OnboardingScreen2 from "../screens/onboarding/OnboardingScreen2";
import OnboardingScreen3 from "../screens/onboarding/OnboardingScreen3";
const Stack = createNativeStackNavigator();
export default function AuthNavigator() {
  return (
    <Stack.Navigator
      initialRouteName="Onboarding1"
      screenOptions={{
        headerTintColor: "#245b44",
        headerShadowVisible: false,
        headerTitleStyle: { fontWeight: "700" },
      }}
    >
      <Stack.Screen name="Onboarding1" component={OnboardingScreen1} options={{ headerShown: false }} />
      <Stack.Screen name="Onboarding2" component={OnboardingScreen2} options={{ headerShown: false }} />
      <Stack.Screen name="Onboarding3" component={OnboardingScreen3} options={{ headerShown: false }} />
      <Stack.Screen
        name="Welcome"
        component={WelcomeScreen}
        options={{ headerShown: false }}
      />
      <Stack.Screen
        name="Login"
        component={LoginScreen}
        options={{ title: "Login" }}
      />
      <Stack.Screen name="Register" component={RegisterScreen} options={{ title: "Join the community" }} />
    </Stack.Navigator>
  );
}
