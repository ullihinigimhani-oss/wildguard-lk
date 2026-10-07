import React from "react";
import { render, fireEvent } from "@testing-library/react-native";
import HomeScreen from "../../src/screens/home/HomeScreen";
import MyPatrolScreen from "../../src/screens/patrol/MyPatrolScreen";
import ProfileScreen from "../../src/screens/profile/ProfileScreen";
import RangerShell from "../../src/navigation/RangerShell";
import useRangerPatrols from "../../src/hooks/useRangerPatrols";
jest.mock("@expo/vector-icons/Ionicons", () => {
  const React = require("react");
  const { View } = require("react-native");
  return (props) => <View {...props} />;
});
jest.mock("../../src/hooks/useAuth", () => ({
  useAuth: () => ({
    user: {
      id: "a",
      name: "Real Ranger",
      email: "ranger@example.test",
      role: "RANGER",
      approvalStatus: "APPROVED",
      park: { name: "Confirmed Park" },
      requestedPark: { name: "Requested Park" },
    },
    logout: jest.fn(),
  }),
}));
jest.mock("../../src/hooks/useRangerPatrols");
jest.mock(
  "../../src/hooks/usePatrolClock",
  () => () => new Date("2026-10-07T09:00:00+05:30"),
);
const patrol = (overrides = {}) => ({
  id: "today",
  routeName: "Boundary sweep",
  status: "SCHEDULED",
  park: { name: "Patrol Area" },
  scheduledDate: "2026-10-07T00:00:00Z",
  startTime: "2026-10-07T08:00:00+05:30",
  endTime: "2026-10-07T12:00:00+05:30",
  patrolType: "ANTI_POACHING",
  priority: "HIGH",
  ...overrides,
});
const next = () =>
  patrol({
    id: "next",
    routeName: "Future sweep",
    scheduledDate: "2026-10-10T00:00:00Z",
    startTime: "2026-10-10T08:00:00+05:30",
    endTime: "2026-10-10T12:00:00+05:30",
  });
const overdue = () =>
  patrol({
    id: "overdue",
    routeName: "Past sweep",
    scheduledDate: "2026-10-06T00:00:00Z",
    startTime: "2026-10-06T08:00:00+05:30",
    endTime: "2026-10-06T12:00:00+05:30",
  });
const navigation = () => ({ navigate: jest.fn() });
const loaded = (patrols) =>
  useRangerPatrols.mockReturnValue({
    patrols,
    loading: false,
    error: null,
    refresh: jest.fn(),
  });
beforeEach(() => loaded([]));
test("dashboard shows real confirmed user details, empty state and quick actions", () => {
  const nav = navigation();
  const ui = render(<HomeScreen navigation={nav} />);
  expect(ui.getByText("Good morning, Real")).toBeTruthy();
  expect(ui.getByLabelText("WildGuard LK logo").props.source).toBeTruthy();
  expect(ui.getByText("Confirmed Park")).toBeTruthy();
  expect(ui.queryByText("Requested Park")).toBeNull();
  expect(ui.getByText("No patrol scheduled for today.")).toBeTruthy();
  fireEvent.press(ui.getByLabelText("My Patrols"));
  expect(nav.navigate).toHaveBeenCalledWith("Patrol");
  fireEvent.press(ui.getByLabelText("Report Incident"));
  expect(nav.navigate).toHaveBeenCalledWith("Incident");
});
test.each([
  [patrol(), "TODAY", "Start Patrol"],
  [patrol({ status: "IN_PROGRESS" }), "IN PROGRESS", "Continue Patrol"],
  [overdue(), "OVERDUE", "Start Patrol"],
  [next(), "UPCOMING", "View Details"],
])("dashboard operational badge and action for %j", (record, badge, action) => {
  loaded([record]);
  const nav = navigation();
  const ui = render(<HomeScreen navigation={nav} />);
  expect(ui.getByText(badge)).toBeTruthy();
  expect(ui.getByLabelText("Priority: HIGH")).toBeTruthy();
  expect(ui.getByText("Anti-Poaching Operation")).toBeTruthy();
  fireEvent.press(ui.getByLabelText(action));
  expect(nav.navigate).toHaveBeenCalledWith("PatrolDetails", {
    patrolId: record.id,
  });
});
test("J: future card is labeled Next Patrol, alongside no-today state", () => {
  loaded([next()]);
  const ui = render(<HomeScreen navigation={navigation()} />);
  expect(ui.getByText("No patrol scheduled for today.")).toBeTruthy();
  expect(ui.getByText("NEXT PATROL")).toBeTruthy();
  expect(ui.queryByText("TODAY'S PATROL")).toBeNull();
});
test("completed assignments leave the dashboard action card and remain accessible in history", () => {
  loaded([
    patrol({ status: "COMPLETED", actualEndTime: "2026-10-07T08:45:00+05:30" }),
  ]);
  const nav = navigation();
  const ui = render(<HomeScreen navigation={nav} />);
  expect(ui.getByText("Today's patrols are completed.")).toBeTruthy();
  expect(ui.queryByLabelText("Start Patrol")).toBeNull();
  fireEvent.press(ui.getByLabelText("View today's completed patrols"));
  expect(nav.navigate).toHaveBeenCalledWith("Patrol", { filter: "COMPLETED" });
});
test("K: real overdue count navigates to Overdue filter", () => {
  loaded([overdue(), { ...overdue(), id: "overdue-b", status: "IN_PROGRESS" }]);
  const nav = navigation();
  const ui = render(<HomeScreen navigation={nav} />);
  fireEvent.press(ui.getByLabelText("2 overdue patrols require attention"));
  expect(nav.navigate).toHaveBeenCalledWith("Patrol", { filter: "OVERDUE" });
  expect(ui.getByText("ACTIVE PATROL")).toBeTruthy();
});
test("all six filters, completed-late history and removal from overdue", () => {
  const active = patrol({
    id: "active",
    routeName: "Active sweep",
    status: "IN_PROGRESS",
  });
  const completed = patrol({
    id: "done",
    routeName: "Finished sweep",
    status: "COMPLETED",
    actualEndTime: "2026-10-07T13:35:00+05:30",
  });
  loaded([patrol(), next(), overdue(), active, completed]);
  const ui = render(<MyPatrolScreen route={{}} navigation={navigation()} />);
  expect(ui.getAllByRole("header")).toHaveLength(5);
  for (const [label, title] of [
    ["Today", "Boundary sweep"],
    ["Upcoming", "Future sweep"],
    ["In Progress", "Active sweep"],
    ["Overdue", "Past sweep"],
    ["Completed", "Finished sweep"],
  ]) {
    fireEvent.press(ui.getByRole("button", { name: label }));
    expect(ui.getAllByRole("header")).toHaveLength(1);
    expect(ui.getByText(title)).toBeTruthy();
  }
  expect(ui.getByText("COMPLETED LATE")).toBeTruthy();
  expect(ui.getByText("Completed 1h 35m after expected end")).toBeTruthy();
  fireEvent.press(ui.getByRole("button", { name: "Overdue" }));
  expect(ui.queryByText("Finished sweep")).toBeNull();
});
test.each([
  ["TODAY", "No patrol scheduled for today."],
  ["UPCOMING", "No upcoming patrols."],
  ["IN_PROGRESS", "No patrol currently in progress."],
  ["OVERDUE", "No overdue patrols."],
  ["COMPLETED", "No completed patrols yet."],
])("empty state for %s", (filter, text) => {
  const ui = render(
    <MyPatrolScreen route={{ params: { filter } }} navigation={navigation()} />,
  );
  expect(ui.getByText(text)).toBeTruthy();
});
test("profile displays approval and confirmed assignment", () => {
  const ui = render(<ProfileScreen />);
  expect(ui.getByText("APPROVED")).toBeTruthy();
  expect(ui.getByText("Confirmed Park")).toBeTruthy();
  expect(ui.getByText("ranger@example.test")).toBeTruthy();
});
test("bottom navigation contains exactly four working tabs", () => {
  const nav = navigation();
  const ui = render(<RangerShell navigation={nav} route={{ name: "Home" }} />);
  expect(ui.getAllByRole("tab")).toHaveLength(4);
  expect(ui.getByLabelText("Dashboard").props.accessibilityState.selected).toBe(
    true,
  );
  for (const [label, route] of [
    ["Dashboard", "Home"],
    ["My Patrol", "Patrol"],
    ["Report Incident", "Incident"],
    ["Profile", "Profile"],
  ]) {
    fireEvent.press(ui.getByLabelText(label));
    expect(nav.navigate).toHaveBeenCalledWith(route);
  }
});

test("dashboard presents active and next upcoming assignments together with their original actions", () => {
  const active = patrol({
    id: "active",
    status: "IN_PROGRESS",
    routeName: "Active field patrol",
  });
  loaded([active, next()]);
  const nav = navigation();
  const ui = render(<HomeScreen navigation={nav} />);
  expect(ui.getByText("Active field patrol")).toBeTruthy();
  expect(ui.getByText("Future sweep")).toBeTruthy();
  fireEvent.press(ui.getByLabelText("Continue Patrol"));
  expect(nav.navigate).toHaveBeenCalledWith("PatrolDetails", {
    patrolId: "active",
  });
  fireEvent.press(ui.getByLabelText("View Details"));
  expect(nav.navigate).toHaveBeenCalledWith("PatrolDetails", {
    patrolId: "next",
  });
});
test("dashboard shows loading and error recovery without invented patrol cards", () => {
  const refresh = jest.fn();
  useRangerPatrols.mockReturnValue({
    patrols: [],
    loading: true,
    error: null,
    refresh,
  });
  const ui = render(<HomeScreen navigation={navigation()} />);
  expect(ui.getByLabelText("Loading assigned patrols")).toBeTruthy();
  expect(ui.queryByLabelText("Continue Patrol")).toBeNull();
  useRangerPatrols.mockReturnValue({
    patrols: [],
    loading: false,
    error: "Unable to load assigned patrols.",
    refresh,
  });
  ui.rerender(<HomeScreen navigation={navigation()} />);
  fireEvent.press(ui.getByLabelText("Retry"));
  expect(refresh).toHaveBeenCalledTimes(1);
  expect(ui.queryByLabelText("Start Patrol")).toBeNull();
});
