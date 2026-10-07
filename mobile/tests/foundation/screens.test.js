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
jest.mock("../../src/services/authApi", () => ({
  loginAccount: jest.fn().mockRejectedValue({ response: { status: 401 } }),
  getSessionUser: jest.fn(),
}));
jest.mock("../../src/services/api", () => ({
  api: {
    defaults: { headers: { common: {} } },
    interceptors: { response: { use: jest.fn(), eject: jest.fn() } },
  },
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
test("common login renders, validates and toggles password visibility", () => {
  render(
    <DemoAuthProvider>
      <LoginScreen />
    </DemoAuthProvider>,
  );
  expect(screen.getByLabelText("Email address")).toBeTruthy();
  expect(screen.getByLabelText("Password").props.secureTextEntry).toBe(true);
  fireEvent.press(screen.getByLabelText("Login"));
  expect(screen.getByText("Enter a valid email address.")).toBeTruthy();
  expect(screen.getByText("Enter your password.")).toBeTruthy();
  fireEvent.press(screen.getByLabelText("Show password"));
  expect(screen.getByLabelText("Password").props.secureTextEntry).toBe(false);
});
test("invalid credentials are rejected and the password is cleared", async () => {
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
  fireEvent.press(screen.getByLabelText("Login"));
  await screen.findByText("Invalid email or password.");
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

test.each([
  [
    "PENDING",
    "Account Pending Approval",
    "Your account has not been approved yet. Please wait for a Park Manager to verify your account. Once approved, you can sign in to WildGuard LK.",
  ],
  [
    "REJECTED",
    "Account Not Approved",
    "Your account request has been rejected. Please contact the Park Manager if you need further assistance.",
  ],
])(
  "approval restriction shows professional status for %s",
  async (approvalStatus, title, message) => {
    const {
      loginAccount,
      getSessionUser,
    } = require("../../src/services/authApi");
    loginAccount.mockRejectedValueOnce({
      response: {
        status: 403,
        data: { code: "ACCOUNT_NOT_APPROVED", approvalStatus },
      },
    });
    render(
      <DemoAuthProvider>
        <LoginScreen />
      </DemoAuthProvider>,
    );
    fireEvent.changeText(
      screen.getByLabelText("Email address"),
      "staff@example.test",
    );
    fireEvent.changeText(screen.getByLabelText("Password"), "Testing123!");
    fireEvent.press(screen.getByLabelText("Login"));
    expect(await screen.findByText(title)).toBeTruthy();
    expect(screen.getByText(message)).toBeTruthy();
    expect(getSessionUser).not.toHaveBeenCalled();
    expect(screen.getByLabelText("Password").props.value).toBe("");
  },
);
