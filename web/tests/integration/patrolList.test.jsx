import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import PatrolManagement from "../../src/pages/PatrolManagement/PatrolManagement";
import {
  getPatrol,
  listAssignableRangers,
  listPatrols,
} from "../../src/services/patrolApi";
vi.mock("../../src/services/patrolApi", () => ({
  listAssignableRangers: vi.fn(),
  createPatrol: vi.fn(),
  listPatrols: vi.fn(),
  getPatrol: vi.fn(),
}));
const patrol = {
  id: "patrol-1",
  routeName: "Northern boundary sweep",
  status: "IN_PROGRESS",
  patrolType: "ANTI_POACHING",
  priority: "HIGH",
  scheduledDate: "2026-10-10T00:00:00.000Z",
  startTime: "2026-10-10T01:00:00.000Z",
  endTime: "2026-10-10T04:30:00.000Z",
  startLocation: "Main gate",
  latitude: 7.5,
  longitude: 80.7,
  description: "Check the fence line.",
  park: { id: "park-a", name: "Yala National Park" },
  ranger: {
    id: "ranger-1",
    name: "A. Perera",
    email: "ranger1@example.test",
  },
};
const rangerOptions = [
  { id: "ranger-1", name: "A. Perera", email: "ranger1@example.test" },
  { id: "ranger-2", name: "B. Silva", email: "ranger2@example.test" },
];
const pageOf = (patrols, total = patrols.length) => ({
  success: true,
  patrols,
  total,
  page: 1,
  pageSize: 25,
});
beforeEach(() => {
  vi.clearAllMocks();
  listPatrols.mockResolvedValue(pageOf([patrol]));
  listAssignableRangers.mockResolvedValue(rangerOptions);
});
const mountPage = () =>
  render(
    <MemoryRouter>
      <PatrolManagement />
    </MemoryRouter>,
  );
test("displays existing patrols with assigned ranger, status and schedule", async () => {
  mountPage();
  expect(await screen.findByText("Northern boundary sweep")).toBeVisible();
  const table = screen.getByRole("table");
  expect(within(table).getByText(/A\. Perera/)).toBeVisible();
  expect(within(table).getByText("Yala National Park")).toBeVisible();
  expect(within(table).getByText("In progress")).toBeVisible();
  expect(within(table).getByText("Anti-poaching operation")).toBeVisible();
  expect(within(table).getByText("High")).toBeVisible();
  expect(within(table).getByText("2026-10-10")).toBeVisible();
  expect(listPatrols).toHaveBeenCalledWith(
    expect.objectContaining({ page: 1 }),
  );
  expect(
    screen.getByRole("link", { name: "Create Patrol" }),
  ).toHaveAttribute("href", "/patrols/new");
  expect(screen.getByRole("link", { name: "View" })).toHaveAttribute(
    "href",
    "/patrols/patrol-1",
  );
});
test("every filter is sent to the backend", async () => {
  const events = userEvent.setup();
  mountPage();
  await screen.findByText("Northern boundary sweep");
  await screen.findByRole("option", { name: "A. Perera" });
  await events.selectOptions(screen.getByLabelText("Status"), "IN_PROGRESS");
  await waitFor(() =>
    expect(listPatrols).toHaveBeenLastCalledWith(
      expect.objectContaining({ status: "IN_PROGRESS", page: 1 }),
    ),
  );
  await events.selectOptions(
    screen.getByLabelText("Assigned ranger"),
    "ranger-1",
  );
  await waitFor(() =>
    expect(listPatrols).toHaveBeenLastCalledWith(
      expect.objectContaining({ rangerId: "ranger-1" }),
    ),
  );
  await events.selectOptions(
    screen.getByLabelText("Patrol type"),
    "ANTI_POACHING",
  );
  await waitFor(() =>
    expect(listPatrols).toHaveBeenLastCalledWith(
      expect.objectContaining({ patrolType: "ANTI_POACHING" }),
    ),
  );
  await events.selectOptions(screen.getByLabelText("Priority"), "HIGH");
  await waitFor(() =>
    expect(listPatrols).toHaveBeenLastCalledWith(
      expect.objectContaining({ priority: "HIGH" }),
    ),
  );
  await events.type(screen.getByLabelText("Search patrol title"), "fence");
  await waitFor(() =>
    expect(listPatrols).toHaveBeenLastCalledWith(
      expect.objectContaining({ search: "fence" }),
    ),
  );
});
test("date filter and clear filters work together", async () => {
  const events = userEvent.setup();
  mountPage();
  await screen.findByText("Northern boundary sweep");
  const date = screen.getByLabelText("Date");
  fireEvent.change(date, { target: { value: "2026-10-10" } });
  await waitFor(() =>
    expect(listPatrols).toHaveBeenLastCalledWith(
      expect.objectContaining({ date: "2026-10-10" }),
    ),
  );
  expect(
    screen.getByRole("button", { name: "Clear filters" }),
  ).toBeVisible();
  await events.click(screen.getByRole("button", { name: "Clear filters" }));
  await waitFor(() =>
    expect(listPatrols).toHaveBeenLastCalledWith({
      search: "",
      status: "",
      rangerId: "",
      date: "",
      patrolType: "",
      priority: "",
      page: 1,
    }),
  );
  expect(
    screen.queryByRole("button", { name: "Clear filters" }),
  ).not.toBeInTheDocument();
  expect(screen.getByLabelText("Status")).toHaveValue("");
  expect(screen.getByLabelText("Date")).toHaveValue("");
});
test("empty results explain whether filters or data are the cause", async () => {
  listPatrols.mockResolvedValue(pageOf([]));
  mountPage();
  expect(await screen.findByText("No patrols yet. Create the first patrol.")).toBeVisible();
  await userEvent.selectOptions(
    screen.getByLabelText("Status"),
    "CANCELLED",
  );
  expect(
    await screen.findByText("No patrols match the current filters."),
  ).toBeVisible();
});
test("shows a loading state while the list request is pending", () => {
  listPatrols.mockReturnValue(new Promise(() => {}));
  mountPage();
  expect(screen.getByText("Loading patrols…")).toBeVisible();
  expect(screen.queryByRole("table")).not.toBeInTheDocument();
});
test("list failures show an error and retry recovers", async () => {
  listPatrols.mockRejectedValueOnce(new Error("offline"));
  const events = userEvent.setup();
  mountPage();
  expect(
    await screen.findByText("Unable to load patrols. Please try again."),
  ).toBeVisible();
  await events.click(screen.getByRole("button", { name: "Retry" }));
  expect(await screen.findByText("Northern boundary sweep")).toBeVisible();
  expect(listPatrols).toHaveBeenCalledTimes(2);
});
test("pagination passes the page to the backend", async () => {
  listPatrols.mockResolvedValue(pageOf([patrol], 30));
  const events = userEvent.setup();
  mountPage();
  expect(await screen.findByText(/30 patrols/)).toBeVisible();
  expect(screen.getByRole("button", { name: "Previous" })).toBeDisabled();
  await events.click(screen.getByRole("button", { name: "Next" }));
  await waitFor(() =>
    expect(listPatrols).toHaveBeenLastCalledWith(
      expect.objectContaining({ page: 2 }),
    ),
  );
  expect(await screen.findByText(/Page 2/)).toBeVisible();
});
test("ranger-updated status is visible after a refresh", async () => {
  listPatrols.mockResolvedValue(pageOf([{ ...patrol, status: "SCHEDULED" }]));
  const first = mountPage();
  expect(await screen.findByText("Scheduled")).toBeVisible();
  first.unmount();
  listPatrols.mockResolvedValue(pageOf([{ ...patrol, status: "IN_PROGRESS" }]));
  mountPage();
  expect(await screen.findByText("In progress")).toBeVisible();
});
