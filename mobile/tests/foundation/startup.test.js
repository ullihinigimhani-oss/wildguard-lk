import React from "react";
import { fireEvent, render, screen, waitFor } from "@testing-library/react-native";
import { NavigationContainer } from "@react-navigation/native";
import OnboardingScreen1 from "../../src/screens/onboarding/OnboardingScreen1";
import OnboardingScreen2 from "../../src/screens/onboarding/OnboardingScreen2";
import OnboardingScreen3 from "../../src/screens/onboarding/OnboardingScreen3";
import WelcomeScreen from "../../src/screens/auth/WelcomeScreen";

jest.mock("../../src/hooks/useOnboarding", () => ({ useOnboarding: () => ({ completeOnboarding: jest.fn().mockResolvedValue() }) }));
const navigation = { navigate: jest.fn(), goBack: jest.fn(), reset: jest.fn() };
const show = Component => render(<NavigationContainer><Component navigation={navigation} /></NavigationContainer>);

test("first onboarding advances or skips to a clean Welcome stack", async () => {
  show(OnboardingScreen1);
  expect(screen.getByText("Protect Sri Lanka's Wildlife")).toBeTruthy();
  expect(screen.getByLabelText("Page 1 of 3")).toBeTruthy();
  fireEvent.press(screen.getByRole("button", { name: "Next" }));
  expect(navigation.navigate).toHaveBeenCalledWith("Onboarding2");
  fireEvent.press(screen.getByRole("button", { name: "Skip" }));
  await waitFor(() => expect(navigation.reset).toHaveBeenCalledWith({ index: 0, routes: [{ name: "Welcome" }] }));
});

test("second onboarding supports forward and back navigation", () => {
  show(OnboardingScreen2);
  expect(screen.getByLabelText("Page 2 of 3")).toBeTruthy();
  fireEvent.press(screen.getByRole("button", { name: "Next" }));
  expect(navigation.navigate).toHaveBeenCalledWith("Onboarding3");
  fireEvent.press(screen.getByRole("button", { name: "Back" }));
  expect(navigation.goBack).toHaveBeenCalledTimes(1);
});

test("Get Started clears onboarding history and opens Welcome", async () => {
  show(OnboardingScreen3);
  expect(screen.getByLabelText("Page 3 of 3")).toBeTruthy();
  fireEvent.press(screen.getByRole("button", { name: "Get Started" }));
  await waitFor(() => expect(navigation.reset).toHaveBeenCalledWith({ index: 0, routes: [{ name: "Welcome" }] }));
  fireEvent.press(screen.getByRole("button", { name: "Back" }));
  expect(navigation.goBack).toHaveBeenCalledTimes(1);
});

test("welcome contains only the hero and uses the existing authentication routes", () => {
  show(WelcomeScreen);
  const communityButtons = screen.getAllByRole("button", { name: "Join the Community" });
  expect(communityButtons).toHaveLength(1);
  communityButtons.forEach(button => {
    fireEvent.press(button);
    expect(navigation.navigate).toHaveBeenLastCalledWith("Register");
  });
  const rangerButtons = screen.getAllByRole("button", { name: "Login" });
  expect(rangerButtons).toHaveLength(1);
  rangerButtons.forEach(button => {
    fireEvent.press(button);
    expect(navigation.navigate).toHaveBeenLastCalledWith("Login");
  });
  expect(screen.getAllByRole("button")).toHaveLength(2);
  expect(screen.queryByText("OUR MISSION")).toBeNull();
  expect(screen.queryByText("One platform. Better conservation.")).toBeNull();
  expect(screen.queryByText("University Prototype")).toBeNull();
});
