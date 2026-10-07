import React from "react";
import { View } from "react-native";
import { render } from "@testing-library/react-native";
import AppNavigator from "../../src/navigation/AppNavigator";
import { useAuth } from "../../src/hooks/useAuth";
import { authenticatedDestination } from "../../src/constants/roles";
jest.mock("../../src/hooks/useOnboarding", () => ({ useOnboarding: () => ({ hasCompletedOnboarding: false }) }));
jest.mock("../../src/hooks/useAuth", () => ({ useAuth: jest.fn() }));
jest.mock("@react-navigation/native-stack", () => {
  const React = require("react");
  const { View } = require("react-native");
  return { createNativeStackNavigator: () => ({
  Navigator: ({ children }) => <View>{children}</View>,
  Screen: ({ name }) => <View testID={`route-${name}`} />,
}) };
});
test.each(["PARK_MANAGER", "COMMUNITY_LIAISON", "RESEARCHER", "COMMUNITY_USER"])("%s cannot navigate to ranger routes", role => {
  const user = { id: "u1", role };
  useAuth.mockReturnValue({ user, isAuthenticated: true, isDemo: false });
  const ui = render(<AppNavigator />);
  expect(authenticatedDestination(user)).toBe("Profile");
  expect(ui.getByTestId("route-Profile")).toBeTruthy();
  ["Home", "Patrol", "Incident", "Alerts", "Sync"].forEach(route => expect(ui.queryByTestId(`route-${route}`)).toBeNull());
});
test("authenticated ranger uses existing Home and field routes", () => {
  const user = { id: "u1", role: "RANGER" };
  useAuth.mockReturnValue({ user, isAuthenticated: true, isDemo: false });
  const ui = render(<AppNavigator />);
  expect(authenticatedDestination(user)).toBe("Home");
  expect(ui.getByTestId("route-Home")).toBeTruthy();
  expect(ui.getByTestId("route-Patrol")).toBeTruthy();
});
test("unknown roles fail closed", () => {
  const user = { id: "u1", role: "ADMIN" };
  useAuth.mockReturnValue({ user, isAuthenticated: true, isDemo: false });
  const ui = render(<AppNavigator />);
  expect(authenticatedDestination(user)).toBeNull();
  expect(ui.queryByTestId("route-Home")).toBeNull();
  expect(ui.getByTestId("route-Login")).toBeTruthy();
});
