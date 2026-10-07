import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import Register from "../../src/pages/Register/Register";
import { registerAccount } from "../../src/services/authApi";
vi.mock("../../src/services/parkApi", () => ({
  listParks: vi.fn(async () => [
    { id: "park-a", name: "Yala National Park" },
    { id: "park-b", name: "Wilpattu National Park" },
  ]),
}));
vi.mock("../../src/services/authApi", () => ({ registerAccount: vi.fn() }));
beforeEach(() => registerAccount.mockReset());
async function mount(label) {
  const events = userEvent.setup();
  render(
    <MemoryRouter>
      <Register />
    </MemoryRouter>,
  );
  await events.click(screen.getByRole("button", { name: new RegExp(label) }));
  await events.click(screen.getByRole("button", { name: "Continue" }));
  return events;
}
test("ranger needs area before submit and sends selected ID", async () => {
  registerAccount.mockResolvedValue({
    user: { id: "ranger", approvalStatus: "PENDING" },
  });
  const events = await mount("Park Ranger");
  for (const [label, value] of Object.entries({
    "Full Name *": "Nimal Perera",
    "Email Address *": "nimal@example.test",
    "Password *": "Testing123!",
    "Confirm Password *": "Testing123!",
  }))
    await events.type(screen.getByLabelText(label, { exact: true }), value);
  await events.click(screen.getByRole("checkbox"));
  await events.click(screen.getByRole("button", { name: "Create Account" }));
  expect(screen.getByText("Select a park or ranger area.")).toBeVisible();
  expect(registerAccount).not.toHaveBeenCalled();
  await screen.findByRole("option", { name: "Yala National Park" });
  await events.selectOptions(
    screen.getByLabelText("Park / Ranger Area *"),
    "park-a",
  );
  await events.click(screen.getByRole("button", { name: "Create Account" }));
  expect(registerAccount).toHaveBeenCalledWith(
    expect.objectContaining({ role: "RANGER", requestedParkId: "park-a" }),
  );
});
test.each(["Community Liaison", "Wildlife Researcher", "Community Member"])(
  "%s has no ranger area input",
  async (label) => {
    await mount(label);
    expect(screen.queryByLabelText("Park / Ranger Area *")).toBeNull();
  },
);
