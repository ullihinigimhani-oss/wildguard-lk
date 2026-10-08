import React from "react";
import { render } from "@testing-library/react-native";
import { StyleSheet } from "react-native";
import { useFonts } from "expo-font";
import App from "../../App";
import { fontFamily, fallbackFont } from "../../src/constants/typography";
jest.mock("expo-font", () => ({ useFonts: jest.fn() }));
jest.mock("@expo-google-fonts/plus-jakarta-sans/400Regular", () => ({ PlusJakartaSans_400Regular: 1 }));
jest.mock("@expo-google-fonts/plus-jakarta-sans/500Medium", () => ({ PlusJakartaSans_500Medium: 2 }));
jest.mock("@expo-google-fonts/plus-jakarta-sans/600SemiBold", () => ({ PlusJakartaSans_600SemiBold: 3 }));
jest.mock("@expo-google-fonts/plus-jakarta-sans/700Bold", () => ({ PlusJakartaSans_700Bold: 4 }));
jest.mock("../../src/hooks/useAuth", () => ({
  AuthProvider: ({ children }) => children,
  useAuth: () => ({ user: null }),
}));
jest.mock("../../src/hooks/useOnboarding", () => ({
  OnboardingProvider: ({ children }) => children,
  useOnboarding: () => ({ isReady: true, hasCompletedOnboarding: true }),
}));
jest.mock("@react-navigation/native", () => ({
  NavigationContainer: ({ children }) => children,
  DefaultTheme: { fonts: {}, colors: {} },
}));
jest.mock("../../src/navigation/AppNavigator", () => () => {
  const { Text } = require("../../src/components/common/Typography");
  return <Text>Navigation ready</Text>;
});
test("root holds main UI until all four requested fonts are loaded", () => {
  useFonts.mockReturnValue([false, null]);
  const ui = render(<App />);
  expect(ui.getByLabelText("Loading app")).toBeTruthy();
  expect(ui.queryByText("Navigation ready")).toBeNull();
  expect(Object.keys(useFonts.mock.calls[0][0])).toEqual(
    Object.values(fontFamily),
  );
  useFonts.mockReturnValue([true, null]);
  ui.rerender(<App />);
  expect(
    StyleSheet.flatten(ui.getByText("Navigation ready").props.style).fontFamily,
  ).toBe(fontFamily.regular);
});
test("font failure opens the existing navigation with a system-font fallback", () => {
  useFonts.mockReturnValue([false, new Error("Font unavailable")]);
  const ui = render(<App />);
  expect(ui.queryByLabelText("Loading app")).toBeNull();
  expect(
    StyleSheet.flatten(ui.getByText("Navigation ready").props.style).fontFamily,
  ).toBe(fallbackFont);
});
