import React from "react";
import { fireEvent, render, screen } from "@testing-library/react-native";
import { NavigationContainer } from "@react-navigation/native";
import OnboardingScreen1 from "../../src/screens/onboarding/OnboardingScreen1";
import OnboardingScreen2 from "../../src/screens/onboarding/OnboardingScreen2";
import OnboardingScreen3 from "../../src/screens/onboarding/OnboardingScreen3";
import WelcomeScreen from "../../src/screens/auth/WelcomeScreen";

const navigation = { navigate: jest.fn(), goBack: jest.fn(), reset: jest.fn() };
const show = Component => render(<NavigationContainer><Component navigation={navigation} /></NavigationContainer>);

test("first onboarding advances or skips to a clean Welcome stack", () => {
  show(OnboardingScreen1);
  expect(screen.getByText("Protect Sri Lanka's Wildlife")).toBeTruthy();
  expect(screen.getByLabelText("Page 1 of 3")).toBeTruthy();
  fireEvent.press(screen.getByRole("button", { name: "Next" }));
  expect(navigation.navigate).toHaveBeenCalledWith("Onboarding2");
  fireEvent.press(screen.getByRole("button", { name: "Skip" }));
  expect(navigation.reset).toHaveBeenCalledWith({ index: 0, routes: [{ name: "Welcome" }] });
});

test("second onboarding supports forward and back navigation", () => {
  show(OnboardingScreen2);
  expect(screen.getByLabelText("Page 2 of 3")).toBeTruthy();
  fireEvent.press(screen.getByRole("button", { name: "Next" }));
  expect(navigation.navigate).toHaveBeenCalledWith("Onboarding3");
  fireEvent.press(screen.getByRole("button", { name: "Back" }));
  expect(navigation.goBack).toHaveBeenCalledTimes(1);
});

test("Get Started clears onboarding history and opens Welcome", () => {
  show(OnboardingScreen3);
  expect(screen.getByLabelText("Page 3 of 3")).toBeTruthy();
  fireEvent.press(screen.getByRole("button", { name: "Get Started" }));
  expect(navigation.reset).toHaveBeenCalledWith({ index: 0, routes: [{ name: "Welcome" }] });
  fireEvent.press(screen.getByRole("button", { name: "Back" }));
  expect(navigation.goBack).toHaveBeenCalledTimes(1);
});

test("welcome uses the existing community and ranger authentication routes", () => {
  show(WelcomeScreen);
  fireEvent.press(screen.getByRole("button", { name: "Join the Community" }));
  expect(navigation.navigate).toHaveBeenCalledWith("Register");
  fireEvent.press(screen.getByRole("button", { name: "Continue to Ranger Login" }));
  expect(navigation.navigate).toHaveBeenCalledWith("Login");
});
