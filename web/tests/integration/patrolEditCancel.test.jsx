import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { MemoryRouter, Routes, Route } from "react-router-dom";
import EditPatrol from "../../src/pages/PatrolManagement/EditPatrol";
import PatrolManagement from "../../src/pages/PatrolManagement/PatrolManagement";
import { getPatrol, updatePatrol, createPatrol, cancelPatrol, listPatrols, listAssignableRangers } from "../../src/services/patrolApi";
import { listParks } from "../../src/services/parkApi";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
// Vitest stubs CSS imports; read the actual stylesheet for layout assertions.
const tableStyles = readFileSync(resolve(process.cwd(), "src/styles.css"), "utf8");
vi.mock("../../src/services/patrolApi", () => ({ getPatrol: vi.fn(), updatePatrol: vi.fn(), createPatrol: vi.fn(), cancelPatrol: vi.fn(), listPatrols: vi.fn(), listAssignableRangers: vi.fn() }));
vi.mock("../../src/services/parkApi", () => ({ listParks: vi.fn() }));
vi.mock("../../src/components/patrol/PatrolMap", () => ({ default: () => <div>Existing map planner</div> }));
const patrol = {
  id: "patrol-actual", routeName: "Existing patrol", status: "SCHEDULED", park: { id: "park", name: "Confirmed Park" }, ranger: { id: "a", name: "Ranger A" },
  scheduledDate: "2026-10-07T00:00:00Z", startTime: "2026-10-07T02:30:00Z", endTime: "2026-10-07T05:30:00Z", patrolType: "ANTI_POACHING", priority: "HIGH",
  startLocation: "Gate", latitude: 7.5, longitude: 80.7, description: "Inspect boundary",
  plannedRoute: [{ type: "START", order: 0, label: "Gate", latitude: 7.5, longitude: 80.7, note: "Start note" }, { type: "END", order: 1, label: "End", latitude: 7.6, longitude: 80.8, note: null }],
};
beforeEach(() => {
  vi.clearAllMocks();
  getPatrol.mockResolvedValue(patrol);
  updatePatrol.mockResolvedValue({ success: true, patrol }); cancelPatrol.mockResolvedValue({ success: true, patrol: { ...patrol, status: "CANCELLED" } });
  listParks.mockResolvedValue([patrol.park]);
  listAssignableRangers.mockResolvedValue([{ id: "a", name: "Ranger A", parkId: "park" }, { id: "b", name: "Ranger B", parkId: "park" }]);
  listPatrols.mockResolvedValue({ patrols: [patrol], total: 1 });
});
const mountEdit = () => render(<MemoryRouter initialEntries={["/patrols/patrol-actual/edit"]}><Routes><Route path="/patrols/:id/edit" element={<EditPatrol />} /></Routes></MemoryRouter>);
const mountList = () => render(<MemoryRouter><PatrolManagement /></MemoryRouter>);
test("prepopulates details and route, saves the same ID and reassignment without creating a duplicate", async () => {
  mountEdit(); await screen.findByDisplayValue("Existing patrol");
  await screen.findByRole("option", { name: /Ranger A/ }); await screen.findByRole("option", { name: "Confirmed Park" });
  expect(screen.getByLabelText("Park / Ranger Area *")).toHaveValue("park");
  expect(screen.getByLabelText("Assigned Ranger *")).toHaveValue("a");
  expect(screen.getByLabelText("Start Time *")).toHaveValue("08:00");
  expect(screen.getByLabelText("Expected End Time *")).toHaveValue("11:00");
  expect(screen.getByLabelText("Patrol Date *")).toHaveValue("2026-10-07");
  expect(screen.getByLabelText("Patrol Type *")).toHaveValue("ANTI_POACHING");
  expect(screen.getByLabelText("Priority *")).toHaveValue("HIGH");
  expect(screen.getByLabelText(/Instructions/)).toHaveValue("Inspect boundary");
  expect(screen.getByText("Existing map planner")).toBeVisible();
  fireEvent.change(screen.getByLabelText("Assigned Ranger *"), { target: { value: "b" } });
  fireEvent.change(screen.getByLabelText("Patrol Title *"), { target: { value: "Changed patrol" } });
  // Saved points have stable UI IDs, allowing the existing planner editor to select them.
  fireEvent.click(screen.getByRole("button", { name: /Gate.*Start Point/ }));
  fireEvent.change(screen.getByLabelText("Point name"), { target: { value: "New gate" } });
  fireEvent.click(screen.getByRole("button", { name: "Save Changes" }));
  await screen.findByText("Patrol updated successfully.");
  expect(updatePatrol).toHaveBeenCalledWith("patrol-actual", expect.objectContaining({ patrol_title: "Changed patrol", assigned_ranger: "b", start_time: "08:00", plannedRoute: [expect.objectContaining({ label: "New gate", latitude: 7.5 }), expect.objectContaining({ type: "END" })] }));
  expect(createPatrol).not.toHaveBeenCalled();
});
test("save conflict preserves edits and displays the server conflict", async () => {
  updatePatrol.mockRejectedValue({ response: { status: 409, data: { message: "This patrol changed. Refresh and try again." } } });
  mountEdit(); await screen.findByDisplayValue("Existing patrol");
  fireEvent.click(screen.getByRole("button", { name: "Save Changes" }));
  await screen.findByText("This patrol changed. Refresh and try again.");
  expect(screen.getByLabelText("Patrol Title *")).toHaveValue("Existing patrol");
});
test.each(["IN_PROGRESS", "COMPLETED", "CANCELLED"])("%s hides edit and cancellation; Live Tracking preserved for active patrols", async status => {
  listPatrols.mockResolvedValue({ patrols: [{ ...patrol, status }], total: 1 }); mountList(); await screen.findByText("Existing patrol");
  expect(screen.queryByRole("link", { name: "Edit" })).toBeNull(); expect(screen.queryByRole("button", { name: "Edit" })).toBeNull(); expect(screen.queryByRole("button", { name: "Cancel" })).toBeNull();
  expect(screen.getByRole("link", { name: "View" })).toHaveAttribute("href", "/patrols/patrol-actual");
  if (status === "IN_PROGRESS") expect(screen.getByRole("link", { name: "Live Tracking" })).toHaveAttribute("href", "/patrols/patrol-actual/track");
  else expect(screen.queryByRole("link", { name: "Live Tracking" })).toBeNull();
});
test("scheduled edit uses selected ID; cancellation requires confirmation and refreshes table", async () => {
  mountList(); await screen.findByText("Existing patrol");
  expect(screen.getByRole("link", { name: "Edit" })).toHaveAttribute("href", "/patrols/patrol-actual/edit");
  const row = screen.getByRole("link", { name: "View" }).closest("tr");
  expect(within(row).getAllByRole("link").map(action => action.textContent)).toEqual(["View", "Edit"]);
  expect(within(row).getAllByRole("button").map(action => action.textContent)).toEqual(["Cancel"]);
  fireEvent.click(screen.getByRole("button", { name: "Cancel" }));
  expect(cancelPatrol).not.toHaveBeenCalled(); expect(screen.getByRole("dialog")).toHaveTextContent("This action cannot be undone from this screen.");
  fireEvent.click(screen.getByRole("button", { name: "Keep Patrol" })); expect(screen.queryByRole("dialog")).toBeNull(); expect(cancelPatrol).not.toHaveBeenCalled();
  fireEvent.click(screen.getByRole("button", { name: "Cancel" }));
  listPatrols.mockResolvedValue({ patrols: [{ ...patrol, status: "CANCELLED" }], total: 1 });
  fireEvent.click(screen.getByRole("button", { name: "Confirm Cancellation" }));
  await waitFor(() => expect(cancelPatrol).toHaveBeenCalledWith("patrol-actual"));
  await waitFor(() => expect(within(screen.getByRole("table")).getByText("Cancelled")).toBeVisible());
});
test.each(["SCHEDULED", "IN_PROGRESS"])("%s actions use one compact non-wrapping row with consistent icon buttons", async status => {
  const style = document.createElement("style");
  style.textContent = tableStyles;
  document.head.append(style);
  try {
    listPatrols.mockResolvedValue({ patrols: [{ ...patrol, status }], total: 1 });
    mountList(); await screen.findByText("Existing patrol");
    const view = screen.getByRole("link", { name: "View" });
    const rowStyle = getComputedStyle(view.parentElement);
    expect(rowStyle.display).toBe("flex"); expect(rowStyle.alignItems).toBe("center");
    expect(rowStyle.gap).toBe("8px"); expect(rowStyle.flexWrap).toBe("nowrap");
    expect(rowStyle.whiteSpace).toBe("nowrap");
    expect(getComputedStyle(view.closest("td")).minWidth).toBe("248px");
    expect(getComputedStyle(view.closest(".users-table-wrap")).overflowX).toBe("auto");
    for (const action of Array.from(view.parentElement.children)) {
      expect(getComputedStyle(action).height).toBe("32px");
      expect(getComputedStyle(action).whiteSpace).toBe("nowrap");
      expect(action.querySelector("svg")).toHaveAttribute("aria-hidden", "true");
    }
    if (status === "IN_PROGRESS") expect(getComputedStyle(screen.getByRole("link", { name: "Live Tracking" })).backgroundColor).toBe("rgb(23, 77, 58)");
  } finally { style.remove(); }
});
test("cancellation conflict displays error and keeps history visible", async () => {
  cancelPatrol.mockRejectedValue({ response: { status: 409, data: { message: "Only scheduled patrols can be cancelled." } } });
  mountList(); await screen.findByText("Existing patrol"); fireEvent.click(screen.getByRole("button", { name: "Cancel" })); fireEvent.click(screen.getByRole("button", { name: "Confirm Cancellation" }));
  expect(await screen.findByText("Only scheduled patrols can be cancelled.")).toBeVisible();
});
