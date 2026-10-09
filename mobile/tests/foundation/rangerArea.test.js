import React from "react";
import { render, fireEvent, waitFor } from "@testing-library/react-native";
import RegisterScreen from "../../src/screens/auth/RegisterScreen";
import { registerAccount } from "../../src/services/authApi";
jest.mock("expo-image-picker", () => ({}));
jest.mock("../../src/services/parkApi", () => ({
  listParks: jest.fn(async () => [
    { id: "park-a", name: "Yala National Park" },
  ]),
}));
jest.mock("../../src/services/authApi", () => ({ registerAccount: jest.fn() }));
beforeEach(() => registerAccount.mockReset());
function mount(label) {
  const ui = render(<RegisterScreen navigation={{ navigate: jest.fn() }} />);
  fireEvent.press(ui.getByText(label + " "));
  fireEvent.press(ui.getByRole("button", { name: "Continue" }));
  return ui;
}
test("ranger cannot submit without area and can choose a database park", async () => {
  registerAccount.mockResolvedValue({
    user: { id: "ranger", approvalStatus: "PENDING" },
  });
  const ui = mount("Park Ranger");
  for (const [label, value] of Object.entries({
    "Full Name": "Nimal Perera",
    "Email Address": "nimal@example.test",
    Password: "Testing123!",
    "Confirm Password": "Testing123!",
  }))
    fireEvent.changeText(ui.getByLabelText(label), value);
  fireEvent.press(ui.getByRole("checkbox"));
  fireEvent.press(ui.getByRole("button", { name: "Create Account" }));
  expect(ui.getByText("Select a park or ranger area.")).toBeTruthy();
  expect(registerAccount).not.toHaveBeenCalled();
  await waitFor(() =>
    expect(
      ui.getByLabelText("Park / Ranger Area").props.accessibilityState.disabled,
    ).toBe(false),
  );
  fireEvent.press(ui.getByLabelText("Park / Ranger Area"));
  fireEvent.changeText(ui.getByLabelText("Search parks"), "Yala");
  fireEvent.press(
    ui.getByRole("button", { name: "Select Yala National Park" }),
  );
  fireEvent.press(ui.getByRole("button", { name: "Create Account" }));
  await waitFor(() =>
    expect(registerAccount).toHaveBeenCalledWith(
      expect.objectContaining({ role: "RANGER", requestedParkId: "park-a" }),
    ),
  );
});
test.each(["Community Liaison", "Wildlife Researcher", "Community Member"])(
  "%s has no ranger area input",
  (label) => {
    const ui = mount(label);
    expect(ui.queryByLabelText("Park / Ranger Area")).toBeNull();
  },
);
