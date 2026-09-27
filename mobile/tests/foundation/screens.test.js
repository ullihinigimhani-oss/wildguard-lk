import React from "react";
import {
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react-native";
import { DemoAuthProvider, useDemoAuth } from "../../src/hooks/useDemoAuth";
import LoginScreen from "../../src/screens/auth/LoginScreen";
import HomeScreen from "../../src/screens/home/HomeScreen";
import SyncScreen from "../../src/screens/placeholders/SyncScreen";
jest.mock("../../src/services/api", () => ({
  getHealth: jest
    .fn()
    .mockResolvedValue({ success: true, database: "connected" }),
}));
const navigation = { navigate: jest.fn() };
function Preview() {
  return useDemoAuth().user ? (
    <HomeScreen navigation={navigation} />
  ) : (
    <LoginScreen />
  );
}
test("ranger login renders, validates and toggles password visibility", () => {
  render(
    <DemoAuthProvider>
      <LoginScreen />
    </DemoAuthProvider>,
  );
  expect(screen.getByLabelText("Email address")).toBeTruthy();
  expect(screen.getByLabelText("Password").props.secureTextEntry).toBe(true);
  fireEvent.press(screen.getByLabelText("Log in"));
  expect(screen.getByText("Enter a valid email address.")).toBeTruthy();
  expect(screen.getByText("Enter your password.")).toBeTruthy();
  fireEvent.press(screen.getByLabelText("Show password"));
  expect(screen.getByLabelText("Password").props.secureTextEntry).toBe(false);
});
test("credentials cannot authenticate and are cleared after UI availability check", async () => {
  render(
    <DemoAuthProvider>
      <Preview />
    </DemoAuthProvider>,
  );
  fireEvent.changeText(
    screen.getByLabelText("Email address"),
    "person@example.test",
  );
  fireEvent.changeText(screen.getByLabelText("Password"), "sample-only");
  fireEvent.press(screen.getByLabelText("Log in"));
  await screen.findByText(/Staff sign-in is coming soon/);
  expect(screen.getByLabelText("Password").props.value).toBe("");
});
test("explicit demo entry renders ranger home and routes field actions", async () => {
  render(
    <DemoAuthProvider>
      <Preview />
    </DemoAuthProvider>,
  );
  fireEvent.press(screen.getByLabelText("Explore ranger demo"));
  await waitFor(() =>
    expect(screen.getByText("Live backend: API connected")).toBeTruthy(),
  );
  expect(screen.getByText("Yala National Park")).toBeTruthy();
  fireEvent.press(screen.getByLabelText("Report Field Incident"));
  expect(navigation.navigate).toHaveBeenCalledWith("Incident");
  fireEvent.press(screen.getByLabelText("Offline / Sync Status"));
  expect(navigation.navigate).toHaveBeenCalledWith("Sync");
});
test("sync previews are clearly simulated and switch state", () => {
  render(<SyncScreen />);
  fireEvent.press(screen.getByLabelText("Preview Offline"));
  expect(screen.getByText("Offline")).toBeTruthy();
  fireEvent.press(screen.getByLabelText("Preview Pending Sync"));
  expect(screen.getByText("Pending Sync: 3 sample items")).toBeTruthy();
  expect(screen.getByText("SIMULATED SYNC STATUS")).toBeTruthy();
});
