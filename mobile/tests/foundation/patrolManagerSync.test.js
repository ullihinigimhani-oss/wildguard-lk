import React from "react";
import { AppState } from "react-native";
import { act, render, waitFor } from "@testing-library/react-native";
import MyPatrolScreen from "../../src/screens/patrol/MyPatrolScreen";
import HomeScreen from "../../src/screens/home/HomeScreen";
import { listMyPatrols } from "../../src/services/patrolApi";
let mockFocused = true;
jest.mock("@react-navigation/native", () => ({
  useFocusEffect: callback => {
    const React = require("react");
    React.useEffect(() => mockFocused ? callback() : undefined, [callback, mockFocused]);
  },
}));
jest.mock("@expo/vector-icons/Ionicons", () => require("react-native").View);
jest.mock("../../src/hooks/useAuth", () => ({ useAuth: () => ({ user: { id: "a", name: "Authenticated Ranger", park: { name: "Confirmed Park" } } }) }));
jest.mock("../../src/hooks/usePatrolClock", () => () => new Date("2026-10-07T09:00:00+05:30"));
jest.mock("../../src/services/patrolApi", () => ({ listMyPatrols: jest.fn() }));
const patrol = { id: "assignment", routeName: "Original patrol", status: "SCHEDULED", scheduledDate: "2026-10-07", startTime: "2026-10-07T08:00:00+05:30", endTime: "2026-10-07T11:00:00+05:30", priority: "HIGH", patrolType: "ROUTINE", park: { name: "Confirmed Park" } };
let remove;
beforeEach(() => {
  mockFocused = true; listMyPatrols.mockReset().mockResolvedValue([patrol]);
  remove = jest.fn(); jest.spyOn(AppState, "addEventListener").mockReturnValue({ remove });
});
afterEach(() => { jest.restoreAllMocks(); jest.useRealTimers(); });
test("returning to My Patrol refetches edited details and removes reassigned or cancelled assignments", async () => {
  const navigation = { navigate: jest.fn() };
  const ui = render(<MyPatrolScreen route={{}} navigation={navigation} />);
  await ui.findByText("Original patrol");
  mockFocused = false; ui.rerender(<MyPatrolScreen route={{}} navigation={navigation} />);
  listMyPatrols.mockResolvedValue([{ ...patrol, routeName: "Manager updated patrol" }]);
  mockFocused = true; ui.rerender(<MyPatrolScreen route={{}} navigation={navigation} />);
  await ui.findByText("Manager updated patrol"); expect(ui.queryByText("Original patrol")).toBeNull();
  mockFocused = false; ui.rerender(<MyPatrolScreen route={{}} navigation={navigation} />);
  listMyPatrols.mockResolvedValue([]);
  mockFocused = true; ui.rerender(<MyPatrolScreen route={{}} navigation={navigation} />);
  await ui.findByText("No patrols assigned."); expect(ui.queryByText("Manager updated patrol")).toBeNull();
  expect(listMyPatrols).toHaveBeenCalledTimes(3);
});
test("foreground refresh uses the existing API and cleanup removes interval and subscription", async () => {
  jest.useFakeTimers();
  const ui = render(<MyPatrolScreen route={{}} navigation={{ navigate: jest.fn() }} />);
  await waitFor(() => expect(ui.getByText("Original patrol")).toBeTruthy());
  const listener = AppState.addEventListener.mock.calls[0][1];
  listMyPatrols.mockResolvedValue([]);
  await act(async () => { listener("active"); });
  expect(ui.getByText("No patrols assigned.")).toBeTruthy();
  ui.unmount(); expect(remove).toHaveBeenCalledTimes(1);
  const count = listMyPatrols.mock.calls.length;
  await act(async () => { jest.advanceTimersByTime(60000); });
  expect(listMyPatrols).toHaveBeenCalledTimes(count);
});
test("returning to Dashboard refetches and removes a cancelled patrol card", async () => {
  const navigation = { navigate: jest.fn() };
  const ui = render(<HomeScreen navigation={navigation} />);
  await ui.findByText("Original patrol");
  mockFocused = false; ui.rerender(<HomeScreen navigation={navigation} />);
  // Existing backend list excludes cancelled assignments; no local patrol copies.
  listMyPatrols.mockResolvedValue([]);
  mockFocused = true; ui.rerender(<HomeScreen navigation={navigation} />);
  await ui.findByText("No patrol scheduled for today.");
  expect(ui.queryByText("Original patrol")).toBeNull();
  expect(ui.queryByLabelText("Start Patrol")).toBeNull();
  expect(listMyPatrols).toHaveBeenCalledTimes(2);
});
