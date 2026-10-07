import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import PatrolManagement from "../../src/pages/PatrolManagement/PatrolManagement";
import {
  createPatrol,
  listAssignableRangers,
} from "../../src/services/patrolApi";
import { listParks } from "../../src/services/parkApi";
vi.mock("../../src/services/patrolApi", () => ({
  listAssignableRangers: vi.fn(),
  createPatrol: vi.fn(),
}));
vi.mock("../../src/services/parkApi", () => ({ listParks: vi.fn() }));
const rangers = [
  {
    id: "ranger-1",
    name: "A. Perera",
    email: "ranger1@example.test",
    parkId: "park-a",
    park: { id: "park-a", name: "Yala National Park" },
  },
  {
    id: "ranger-2",
    name: "B. Silva",
    email: "ranger2@example.test",
    parkId: null,
    park: null,
  },
];
const created = {
  id: "patrol-1",
  routeName: "Northern boundary sweep",
  status: "SCHEDULED",
  scheduledDate: "2026-10-10T00:00:00.000Z",
  startTime: "2026-10-10T01:00:00.000Z",
  endTime: "2026-10-10T04:30:00.000Z",
  patrolType: "ROUTINE",
  priority: "MEDIUM",
  startLocation: null,
  latitude: null,
  longitude: null,
  description: null,
  park: { id: "park-a", name: "Yala National Park" },
  ranger: { id: "ranger-1", name: "A. Perera", email: "ranger1@example.test" },
  createdBy: { id: "manager", name: "Existing Manager" },
};
beforeEach(() => {
  vi.clearAllMocks();
  listParks.mockResolvedValue([
    { id: "park-a", name: "Yala National Park" },
    { id: "park-b", name: "Wilpattu National Park" },
  ]);
  listAssignableRangers.mockResolvedValue(rangers);
  createPatrol.mockResolvedValue({
    success: true,
    message: "Patrol created successfully.",
    patrol: created,
  });
});
const change = (label, value) =>
  fireEvent.change(screen.getByLabelText(label), { target: { value } });
async function fillValidForm(events) {
  await screen.findByRole("option", { name: /A\. Perera/ });
  await screen.findByRole("option", { name: "Yala National Park" });
  await events.selectOptions(
    screen.getByLabelText("Park / Ranger Area *"),
    "park-a",
  );
  await events.selectOptions(
    screen.getByLabelText("Assigned Ranger *"),
    "ranger-1",
  );
  await events.type(
    screen.getByLabelText("Patrol Title *"),
    "Northern boundary sweep",
  );
  change("Patrol Date *", "2026-10-10");
  change("Start Time *", "06:30");
  change("Expected End Time *", "10:00");
}
test("loads parks and approved rangers into the form", async () => {
  render(<PatrolManagement />);
  expect(await screen.findByRole("option", { name: /A\. Perera/ })).toBeVisible();
  expect(screen.getByRole("option", { name: /B\. Silva/ })).toBeVisible();
  expect(
    await screen.findByRole("option", { name: "Yala National Park" }),
  ).toBeVisible();
  expect(screen.getByRole("option", { name: "Wilpattu National Park" })).toBeVisible();
  expect(listAssignableRangers).toHaveBeenCalledTimes(1);
  expect(listParks).toHaveBeenCalledTimes(1);
});
test("client validation blocks an incomplete submission", async () => {
  const events = userEvent.setup();
  render(<PatrolManagement />);
  await screen.findByRole("option", { name: /A\. Perera/ });
  await events.click(screen.getByRole("button", { name: "Create Patrol" }));
  expect(
    await screen.findByText("Enter a patrol title of 3 to 150 characters."),
  ).toBeVisible();
  expect(screen.getByText("Select a valid park or ranger area.")).toBeVisible();
  expect(
    screen.getByText("Select the ranger leading this patrol."),
  ).toBeVisible();
  expect(screen.getByText("Enter a valid patrol date.")).toBeVisible();
  expect(screen.getByText("Enter a valid start time.")).toBeVisible();
  expect(createPatrol).not.toHaveBeenCalled();
});
test("creates a patrol and shows the scheduled confirmation", async () => {
  const events = userEvent.setup();
  render(<PatrolManagement />);
  await fillValidForm(events);
  await events.click(screen.getByRole("button", { name: "Create Patrol" }));
  await waitFor(() => expect(createPatrol).toHaveBeenCalledTimes(1));
  expect(createPatrol).toHaveBeenCalledWith({
    patrol_title: "Northern boundary sweep",
    park_ranger_area: "park-a",
    assigned_ranger: "ranger-1",
    patrol_date: "2026-10-10",
    start_time: "06:30",
    expected_end_time: "10:00",
    patrol_type: "ROUTINE",
    priority: "MEDIUM",
  });
  expect(await screen.findByText("Patrol created successfully.")).toBeVisible();
  expect(screen.getByText("SCHEDULED")).toBeVisible();
  expect(screen.getByText("Northern boundary sweep")).toBeVisible();
  expect(screen.getByText("A. Perera")).toBeVisible();
  expect(screen.getByText("2026-10-10")).toBeVisible();
  await waitFor(() =>
    expect(screen.getByLabelText("Patrol Title *")).toHaveValue(""),
  );
  expect(screen.getByLabelText("Park / Ranger Area *")).toHaveValue("");
  expect(screen.getByLabelText("Assigned Ranger *")).toHaveValue("");
});
test("expected end time must follow the start time", async () => {
  const events = userEvent.setup();
  render(<PatrolManagement />);
  await fillValidForm(events);
  change("Expected End Time *", "05:00");
  await events.click(screen.getByRole("button", { name: "Create Patrol" }));
  expect(
    await screen.findByText(
      "Expected end time must be after the start time.",
    ),
  ).toBeVisible();
  expect(createPatrol).not.toHaveBeenCalled();
});
test("server field errors are shown next to the form", async () => {
  createPatrol.mockRejectedValue({
    response: {
      status: 400,
      data: {
        message: "Please check your patrol details.",
        errors: {
          patrol_date: "Enter a valid patrol date as YYYY-MM-DD.",
        },
      },
    },
  });
  const events = userEvent.setup();
  render(<PatrolManagement />);
  await fillValidForm(events);
  await events.click(screen.getByRole("button", { name: "Create Patrol" }));
  expect(
    await screen.findByText("Please check your patrol details."),
  ).toBeVisible();
  expect(
    screen.getByText("Enter a valid patrol date as YYYY-MM-DD."),
  ).toBeVisible();
  expect(
    screen.getByLabelText("Patrol Title *"),
  ).toHaveValue("Northern boundary sweep");
});
test("ranger loading failure offers a working retry", async () => {
  listAssignableRangers.mockRejectedValueOnce(new Error("offline"));
  const events = userEvent.setup();
  render(<PatrolManagement />);
  expect(await screen.findByText(/Unable to load rangers/)).toBeVisible();
  expect(
    screen.getByRole("button", { name: "Retry rangers" }),
  ).toBeEnabled();
  await events.click(screen.getByRole("button", { name: "Retry rangers" }));
  expect(await screen.findByRole("option", { name: /A\. Perera/ })).toBeVisible();
  expect(listAssignableRangers).toHaveBeenCalledTimes(2);
});
test("duplicate submissions are ignored while a patrol is being saved", async () => {
  let resolve;
  createPatrol.mockReturnValue(new Promise((r) => (resolve = r)));
  const events = userEvent.setup();
  render(<PatrolManagement />);
  await fillValidForm(events);
  const button = screen.getByRole("button", { name: "Create Patrol" });
  await events.click(button);
  await waitFor(() =>
    expect(screen.getByRole("button", { name: "Creating patrol…" })).toBeDisabled(),
  );
  await events.click(
    screen.getByRole("button", { name: "Creating patrol…" }),
  );
  resolve({
    success: true,
    message: "Patrol created successfully.",
    patrol: created,
  });
  expect(await screen.findByText("Patrol created successfully.")).toBeVisible();
  expect(createPatrol).toHaveBeenCalledTimes(1);
});
test("extra patrol details are sent when provided", async () => {
  const events = userEvent.setup();
  render(<PatrolManagement />);
  await fillValidForm(events);
  await events.selectOptions(screen.getByLabelText("Patrol Type *"), "ANTI_POACHING");
  await events.selectOptions(screen.getByLabelText("Priority *"), "HIGH");
  await events.type(screen.getByLabelText("Starting Point (optional)"), "Main gate");
  fireEvent.change(screen.getByLabelText("Latitude (optional)"), {
    target: { value: "7.5" },
  });
  fireEvent.change(screen.getByLabelText("Longitude (optional)"), {
    target: { value: "80.7" },
  });
  await events.type(
    screen.getByLabelText("Instructions & Notes (optional)"),
    "Check the northern fence line.",
  );
  await events.click(screen.getByRole("button", { name: "Create Patrol" }));
  await waitFor(() => expect(createPatrol).toHaveBeenCalledTimes(1));
  expect(createPatrol).toHaveBeenCalledWith({
    patrol_title: "Northern boundary sweep",
    park_ranger_area: "park-a",
    assigned_ranger: "ranger-1",
    patrol_date: "2026-10-10",
    start_time: "06:30",
    expected_end_time: "10:00",
    patrol_type: "ANTI_POACHING",
    priority: "HIGH",
    start_location: "Main gate",
    latitude: 7.5,
    longitude: 80.7,
    instructions_notes: "Check the northern fence line.",
  });
});
