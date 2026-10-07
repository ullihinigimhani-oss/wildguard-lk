import React from "react";
import { render, fireEvent, waitFor } from "@testing-library/react-native";
import PatrolDetailsScreen from "../../src/screens/patrol/PatrolDetailsScreen";
import {
  getMyPatrol,
  startMyPatrol,
  completeMyPatrol,
} from "../../src/services/patrolApi";
import { plannedRoute } from "../fixtures/plannedRoute";
jest.mock("@expo/vector-icons/Ionicons", () => {
  const { View } = require("react-native");
  return View;
});
jest.mock("@react-navigation/native", () => ({
  useFocusEffect: (callback) => {
    const React = require("react");
    React.useEffect(callback, [callback]);
  },
}));
jest.mock(
  "../../src/hooks/usePatrolClock",
  () => () => new Date("2026-10-07T11:35:00+05:30"),
);
jest.mock("../../src/hooks/useAuth", () => ({
  useAuth: () => ({ user: { id: "a", name: "Assigned Ranger" } }),
}));
jest.mock("../../src/services/patrolApi", () => ({
  getMyPatrol: jest.fn(),
  startMyPatrol: jest.fn(),
  completeMyPatrol: jest.fn(),
}));
const record = () => ({
  id: "assignment",
  routeName: "Boundary patrol",
  status: "SCHEDULED",
  park: { name: "Confirmed Park" },
  ranger: { name: "Assigned Ranger" },
  scheduledDate: "2026-10-07T00:00:00Z",
  startTime: "2026-10-07T08:00:00+05:30",
  endTime: "2026-10-07T10:00:00+05:30",
  startLocation: "Main Gate",
  description: "Check the northern boundary.",
  priority: "HIGH",
  patrolType: "ANTI_POACHING",
});
const mount = () =>
  render(
    <PatrolDetailsScreen route={{ params: { patrolId: "assignment" } }} />,
  );
beforeEach(() => {
  getMyPatrol.mockReset().mockResolvedValue(record());
  startMyPatrol.mockReset();
  completeMyPatrol.mockReset();
});
test("overdue assignment starts, continues and completes late with original schedule intact", async () => {
  const ui = mount();
  await ui.findByText("Boundary patrol");
  expect(ui.getByText("Main Gate")).toBeTruthy();
  expect(ui.getByText("Check the northern boundary.")).toBeTruthy();
  expect(ui.queryByText("assignment")).toBeNull();
  startMyPatrol.mockResolvedValue({
    ...record(),
    status: "IN_PROGRESS",
    actualStartTime: "2026-10-07T10:30:00+05:30",
  });
  fireEvent.press(ui.getByLabelText("Start Patrol"));
  await ui.findByText("IN PROGRESS");
  expect(ui.getByText("OVERDUE")).toBeTruthy();
  expect(startMyPatrol).toHaveBeenCalledWith("assignment");
  fireEvent.press(ui.getByLabelText("Complete Patrol"));
  expect(completeMyPatrol).not.toHaveBeenCalled();
  completeMyPatrol.mockResolvedValue({
    ...record(),
    status: "COMPLETED",
    actualStartTime: "2026-10-07T10:30:00+05:30",
    actualEndTime: "2026-10-07T11:35:00+05:30",
  });
  fireEvent.press(ui.getByLabelText("Confirm Completion"));
  await ui.findByText("COMPLETED LATE");
  expect(completeMyPatrol).toHaveBeenCalledWith("assignment");
  expect(ui.queryByText("OVERDUE")).toBeNull();
  expect(ui.getByText("Completed 1h 35m after expected end")).toBeTruthy();
  expect(ui.getByText("08:00")).toBeTruthy();
  expect(ui.getByText("10:00")).toBeTruthy();
  expect(ui.getByText("Actual Start")).toBeTruthy();
  expect(ui.getByText("Actual Completion")).toBeTruthy();
});
test("future details show instructions without allowing an early start", async () => {
  getMyPatrol.mockResolvedValue({
    ...record(),
    scheduledDate: "2026-10-10T00:00:00Z",
    startTime: "2026-10-10T08:00:00+05:30",
    endTime: "2026-10-10T10:00:00+05:30",
  });
  const ui = mount();
  await ui.findByText("UPCOMING");
  expect(ui.queryByLabelText("Start Patrol")).toBeNull();
  expect(ui.getByText("Check the northern boundary.")).toBeTruthy();
});
test("details retry network errors and never expose database information", async () => {
  getMyPatrol.mockRejectedValueOnce(new Error("private Prisma details"));
  const ui = mount();
  await ui.findByText("Unable to load this patrol. Please try again.");
  expect(ui.queryByText("private Prisma details")).toBeNull();
  fireEvent.press(ui.getByLabelText("Retry"));
  await ui.findByText("Boundary patrol");
});
test("failed mutation preserves information and offers refresh", async () => {
  const ui = mount();
  await ui.findByText("Boundary patrol");
  startMyPatrol.mockRejectedValue({ response: { status: 409 } });
  fireEvent.press(ui.getByLabelText("Start Patrol"));
  await ui.findByText(
    "This patrol's state or schedule has changed. Refresh it before trying again.",
  );
  expect(ui.getByText("Boundary patrol")).toBeTruthy();
});
test("missing or foreign patrol is unavailable", async () => {
  getMyPatrol.mockRejectedValue({ response: { status: 404 } });
  const ui = mount();
  await ui.findByText("This patrol is not available.");
  expect(ui.queryByLabelText("Start Patrol")).toBeNull();
});
test("View Route navigates with the selected id separately from Start Patrol", async () => {
  getMyPatrol.mockResolvedValue({ ...record(), plannedRoute: plannedRoute() });
  const navigation = { navigate: jest.fn() };
  const ui = render(
    <PatrolDetailsScreen
      route={{ params: { patrolId: "assignment" } }}
      navigation={navigation}
    />,
  );
  await ui.findByLabelText("View Route");
  fireEvent.press(ui.getByLabelText("View Route"));
  expect(navigation.navigate).toHaveBeenCalledWith("PatrolRoute", {
    patrolId: "assignment",
  });
  expect(startMyPatrol).not.toHaveBeenCalled();
  expect(completeMyPatrol).not.toHaveBeenCalled();
  expect(ui.getByLabelText("Start Patrol")).toBeTruthy();
});
test("old patrol details load without a route button", async () => {
  const ui = mount();
  await ui.findByText("No Planned Route");
  expect(ui.queryByLabelText("View Route")).toBeNull();
  expect(ui.getByLabelText("Start Patrol")).toBeTruthy();
});
test("successful start automatically opens navigation, while active patrol can resume", async () => {
  const navigation = { navigate: jest.fn() };
  startMyPatrol.mockResolvedValue({
    ...record(),
    status: "IN_PROGRESS",
    actualStartTime: new Date().toISOString(),
  });
  const ui = render(
    <PatrolDetailsScreen
      route={{ params: { patrolId: "assignment" } }}
      navigation={navigation}
    />,
  );
  await ui.findByLabelText("Start Patrol");
  fireEvent.press(ui.getByLabelText("Start Patrol"));
  await waitFor(() =>
    expect(navigation.navigate).toHaveBeenCalledWith("PatrolNavigation", {
      patrolId: "assignment",
    }),
  );
  fireEvent.press(ui.getByLabelText("Open Navigation"));
  expect(navigation.navigate).toHaveBeenCalledTimes(2);
});

test("pending or failed Start Patrol never opens navigation or changes status optimistically", async () => {
  const navigation = { navigate: jest.fn() };
  let reject;
  startMyPatrol.mockImplementation(
    () =>
      new Promise((resolve, fail) => {
        reject = fail;
      }),
  );
  const ui = render(
    <PatrolDetailsScreen
      route={{ params: { patrolId: "assignment" } }}
      navigation={navigation}
    />,
  );
  await ui.findByLabelText("Start Patrol");
  fireEvent.press(ui.getByLabelText("Start Patrol"));
  expect(navigation.navigate).not.toHaveBeenCalled();
  expect(ui.queryByLabelText("Open Navigation")).toBeNull();
  reject({ response: { status: 409 } });
  await ui.findByText(
    "This patrol's state or schedule has changed. Refresh it before trying again.",
  );
  expect(navigation.navigate).not.toHaveBeenCalled();
  expect(ui.queryByLabelText("Open Navigation")).toBeNull();
});
