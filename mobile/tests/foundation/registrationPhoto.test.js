import React from "react";
import { render, fireEvent, waitFor } from "@testing-library/react-native";
import RegistrationPhoto from "../../src/components/common/RegistrationPhoto";
import RegisterScreen from "../../src/screens/auth/RegisterScreen";
import * as picker from "expo-image-picker";
jest.mock("expo-image-picker", () => ({
  requestMediaLibraryPermissionsAsync: jest.fn(),
  launchImageLibraryAsync: jest.fn(),
}));
jest.mock("../../src/services/authApi", () => ({ registerAccount: jest.fn() }));
beforeEach(() => {
  picker.requestMediaLibraryPermissionsAsync.mockResolvedValue({
    granted: true,
  });
  picker.launchImageLibraryAsync.mockResolvedValue({
    canceled: false,
    assets: [{ uri: "file:///temporary/photo.jpg" }],
  });
});
jest.mock("../../src/services/parkApi", () => ({
  listParks: jest.fn(async () => [
    { id: "park-a", name: "Yala National Park" },
  ]),
}));
test("role is selected before form and can be changed", () => {
  const ui = render(<RegisterScreen navigation={{ navigate: jest.fn() }} />);
  expect(
    ui.getByRole("button", { name: "Continue" }).props.accessibilityState
      .disabled,
  ).toBe(true);
  fireEvent.press(ui.getByText("Park Ranger "));
  fireEvent.press(ui.getByRole("button", { name: "Continue" }));
  expect(ui.getByText("Registering as Park Ranger")).toBeTruthy();
  fireEvent.press(ui.getByRole("button", { name: "Change role" }));
  expect(ui.getByText("Choose Your Role")).toBeTruthy();
});
test("photo stays preview only and can be removed", async () => {
  const ui = render(<RegistrationPhoto />);
  fireEvent.press(ui.getByRole("button", { name: "Add Photo" }));
  await waitFor(() =>
    expect(ui.getByLabelText("Selected profile preview")).toBeTruthy(),
  );
  expect(ui.getByText(/will not be saved/)).toBeTruthy();
  fireEvent.press(ui.getByRole("button", { name: "Remove Photo" }));
  expect(ui.queryByLabelText("Selected profile preview")).toBeNull();
});
test("permission denial is recoverable", async () => {
  picker.requestMediaLibraryPermissionsAsync.mockResolvedValue({
    granted: false,
  });
  const ui = render(<RegistrationPhoto />);
  fireEvent.press(ui.getByRole("button", { name: "Add Photo" }));
  expect(await ui.findByText(/Allow photo library access/)).toBeTruthy();
});

test("public registration offers four roles and no Park Manager card", () => {
  const ui = render(<RegisterScreen navigation={{ navigate: jest.fn() }} />);
  expect(ui.queryByText("Park Manager ")).toBeNull();
  for (const name of [
    "Park Ranger ",
    "Community Liaison ",
    "Wildlife Researcher ",
    "Community Member ",
  ])
    expect(ui.getByText(name)).toBeTruthy();
});
