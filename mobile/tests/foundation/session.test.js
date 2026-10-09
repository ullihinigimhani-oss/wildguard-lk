import React from "react";
import { AppState, Text, Pressable } from "react-native";
import { render, fireEvent, waitFor, act } from "@testing-library/react-native";
import { AuthProvider, useAuth } from "../../src/hooks/useAuth";
import { loginAccount, getSessionUser } from "../../src/services/authApi";
import { api } from "../../src/services/api";
jest.mock("../../src/services/authApi", () => ({ loginAccount: jest.fn(), getSessionUser: jest.fn() }));
jest.mock("../../src/services/api", () => ({ api: { defaults: { headers: { common: {} } }, interceptors: { response: { use: jest.fn(), eject: jest.fn() } } } }));
const user = { id: "u1", name: "Community User", email: "user@example.test", role: "COMMUNITY_USER" };
function Harness() {
  const auth = useAuth();
  const [error, setError] = React.useState("");
  return <><Text>{auth.isAuthenticated ? auth.user.role : "signed out"}</Text><Text>{error}</Text>
    <Pressable accessibilityRole="button" accessibilityLabel="Login" onPress={() => auth.login({ email: user.email, password: "Testing123!" }).catch(() => setError("rejected"))} />
    <Pressable accessibilityRole="button" accessibilityLabel="Logout" onPress={auth.logout} />
  </>;
}
beforeEach(() => {
  loginAccount.mockReset().mockResolvedValue({ token: "verified-token", expiresAt: Date.now() + 3600000, user: { ...user, role: "RANGER" } });
  getSessionUser.mockReset().mockResolvedValue(user);
  delete api.defaults.headers.common.Authorization;
});
test("uses the verified database role rather than the login response role and clears token on logout", async () => {
  const ui = render(<AuthProvider><Harness /></AuthProvider>);
  fireEvent.press(ui.getByLabelText("Login"));
  await ui.findByText("COMMUNITY_USER");
  expect(getSessionUser).toHaveBeenCalledWith("verified-token");
  expect(api.defaults.headers.common.Authorization).toBe("Bearer verified-token");
  fireEvent.press(ui.getByLabelText("Logout"));
  expect(ui.getByText("signed out")).toBeTruthy();
  expect(api.defaults.headers.common.Authorization).toBeUndefined();
});
test("failed account verification never grants a session", async () => {
  getSessionUser.mockRejectedValue({ response: { status: 401 } });
  const ui = render(<AuthProvider><Harness /></AuthProvider>);
  fireEvent.press(ui.getByLabelText("Login"));
  await ui.findByText("rejected");
  expect(ui.getByText("signed out")).toBeTruthy();
  expect(api.defaults.headers.common.Authorization).toBeUndefined();
});
test("logout cancels an in-flight login", async () => {
  let resolve;
  getSessionUser.mockReturnValue(new Promise(r => { resolve = r; }));
  const ui = render(<AuthProvider><Harness /></AuthProvider>);
  fireEvent.press(ui.getByLabelText("Login"));
  await waitFor(() => expect(getSessionUser).toHaveBeenCalled());
  fireEvent.press(ui.getByLabelText("Logout"));
  await act(async () => resolve(user));
  expect(ui.getByText("signed out")).toBeTruthy();
  expect(api.defaults.headers.common.Authorization).toBeUndefined();
});

test("offline foreground preserves an unexpired verified session but HTTP rejection revokes it", async () => {
  let foreground;
  const spy = jest.spyOn(AppState, "addEventListener").mockImplementation((_event, listener) => { foreground = listener; return { remove: jest.fn() }; });
  const ui = render(<AuthProvider><Harness /></AuthProvider>);
  fireEvent.press(ui.getByLabelText("Login")); await ui.findByText("COMMUNITY_USER");
  getSessionUser.mockRejectedValueOnce(new Error("offline")); await act(async () => foreground("active"));
  expect(ui.getByText("COMMUNITY_USER")).toBeTruthy();
  getSessionUser.mockRejectedValueOnce({ response: { status: 403 } }); await act(async () => foreground("active"));
  expect(ui.getByText("signed out")).toBeTruthy(); spy.mockRestore();
});

test("offline authorization still expires at its original token deadline", async () => {
  jest.useFakeTimers();
  const listener = jest.spyOn(AppState, "addEventListener").mockImplementation(() => ({ remove: jest.fn() }));
  loginAccount.mockResolvedValue({ token: "verified-token", expiresAt: Date.now() + 1000 });
  const ui = render(<AuthProvider><Harness /></AuthProvider>);
  fireEvent.press(ui.getByLabelText("Login")); await ui.findByText("COMMUNITY_USER");
  await act(async () => jest.advanceTimersByTime(1001));
  expect(ui.getByText("signed out")).toBeTruthy(); expect(api.defaults.headers.common.Authorization).toBeUndefined();
  ui.unmount(); listener.mockRestore(); jest.useRealTimers();
});
