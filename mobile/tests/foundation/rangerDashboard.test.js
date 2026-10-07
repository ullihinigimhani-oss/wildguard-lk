import React from "react";
import { render, fireEvent } from "@testing-library/react-native";
import HomeScreen from "../../src/screens/home/HomeScreen";
import MyPatrolScreen from "../../src/screens/patrol/MyPatrolScreen";
import ProfileScreen from "../../src/screens/profile/ProfileScreen";
import RangerShell from "../../src/navigation/RangerShell";
import useRangerPatrols from "../../src/hooks/useRangerPatrols";
import { todayPatrol } from "../../src/utils/rangerPatrol";
jest.mock("../../src/hooks/useAuth", () => ({ useAuth: () => ({ user: { id: "a", name: "Real Ranger", email: "ranger@example.test", role: "RANGER", approvalStatus: "APPROVED", park: { name: "Confirmed Park" }, requestedPark: { name: "Requested Park" } }, logout: jest.fn() }) }));
jest.mock("../../src/hooks/useRangerPatrols");
const patrol = status => ({ id: status, routeName: status + " route", status, park: { name: "Patrol Area" }, scheduledDate: new Date().toISOString(), startTime: new Date().toISOString(), endTime: new Date().toISOString(), patrolType: "ROUTINE", priority: "HIGH" });
beforeEach(() => useRangerPatrols.mockReturnValue({ patrols: [], loading: false, error: null, refresh: jest.fn() }));
test("dashboard shows confirmed user details, empty state and routes quick actions", () => {
  const navigation = { navigate: jest.fn() };
  const ui = render(<HomeScreen navigation={navigation} />);
  expect(ui.getByText("Hello, Real.")).toBeTruthy();
  expect(ui.getByText("Confirmed Park")).toBeTruthy();
  expect(ui.queryByText("Requested Park")).toBeNull();
  expect(ui.getByText("No patrol assigned for today.")).toBeTruthy();
  fireEvent.press(ui.getByLabelText("My Patrol"));
  expect(navigation.navigate).toHaveBeenCalledWith("Patrol");
  fireEvent.press(ui.getByLabelText("Report Incident"));
  expect(navigation.navigate).toHaveBeenCalledWith("Incident");
});
test("all three filters display only matching real patrols", () => {
  useRangerPatrols.mockReturnValue({ patrols: ["SCHEDULED", "IN_PROGRESS", "COMPLETED"].map(patrol), loading: false });
  const ui = render(<MyPatrolScreen route={{}} />);
  expect(ui.getByText("SCHEDULED route")).toBeTruthy();
  fireEvent.press(ui.getByRole("button", { name: "In Progress" }));
  expect(ui.getByText("IN_PROGRESS route")).toBeTruthy();
  expect(ui.queryByText("SCHEDULED route")).toBeNull();
  fireEvent.press(ui.getByRole("button", { name: "Completed" }));
  expect(ui.getByText("COMPLETED route")).toBeTruthy();
});
test("today selection uses Sri Lanka midnight and prioritizes active patrol", () => {
  const data = [patrol("COMPLETED"), patrol("SCHEDULED"), patrol("IN_PROGRESS")].map(p => ({ ...p, scheduledDate: "2026-10-08T00:00:00Z" }));
  expect(todayPatrol(data, new Date("2026-10-07T18:30:00Z")).status).toBe("IN_PROGRESS");
  expect(todayPatrol(data, new Date("2026-10-07T18:29:00Z"))).toBeUndefined();
});
test("profile displays approval and confirmed assignment", () => {
  const ui = render(<ProfileScreen />);
  expect(ui.getByText("APPROVED")).toBeTruthy();
  expect(ui.getByText("Confirmed Park")).toBeTruthy();
  expect(ui.getByText("ranger@example.test")).toBeTruthy();
});
test("bottom navigation contains exactly four working tabs", () => {
  const navigation = { navigate: jest.fn() };
  const ui = render(<RangerShell navigation={navigation} route={{ name: "Home" }} />);
  expect(ui.getAllByRole("tab")).toHaveLength(4);
  fireEvent.press(ui.getByLabelText("Profile"));
  expect(navigation.navigate).toHaveBeenCalledWith("Profile");
});
