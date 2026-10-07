import React from "react";
import { render, fireEvent, waitFor } from "@testing-library/react-native";
import PatrolRouteScreen from "../../src/screens/patrol/PatrolRouteScreen";
import {
  getMyPatrol,
  startMyPatrol,
  completeMyPatrol,
} from "../../src/services/patrolApi";
import { plannedRoute } from "../fixtures/plannedRoute";
jest.mock("@react-navigation/native", () => ({
  useFocusEffect: (callback) => {
    const React = require("react");
    React.useEffect(callback, [callback]);
  },
}));
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
  routeName: "Boundary Patrol",
  status: "SCHEDULED",
  park: { name: "Confirmed Park" },
  plannedRoute: plannedRoute(),
});
const mount = (params = { patrolId: "assignment" }) =>
  render(<PatrolRouteScreen route={{ params }} />);
beforeEach(() => getMyPatrol.mockReset().mockResolvedValue(record()));
test("fetches assigned route, displays all types/notes and performs no lifecycle mutation", async () => {
  const ui = mount();
  await ui.findByText("Known Snare Zone");
  expect(getMyPatrol).toHaveBeenCalledWith("assignment", expect.anything());
  for (const name of [
    "Boundary Patrol",
    "Confirmed Park",
    "Main Gate",
    "Water Hole",
    "Waterhole Observation",
    "Checkpoint 2",
    "Ranger Post",
    "Check previous snare locations carefully.",
  ])
    expect(ui.getByText(name)).toBeTruthy();
  expect(ui.getByText("3. High Risk Area").props.style).toEqual(
    expect.arrayContaining([expect.objectContaining({ color: "#b42332" })]),
  );
  const view = ui.getByTestId("planned-route-webview");
  expect(view.props.geolocationEnabled).toBe(false);
  expect(view.props.source.html).toContain('"order":5');
  fireEvent(view, "message", {
    nativeEvent: { data: JSON.stringify({ type: "map-ready" }) },
  });
  expect(ui.queryByLabelText("Loading route map")).toBeNull();
  expect(startMyPatrol).not.toHaveBeenCalled();
  expect(completeMyPatrol).not.toHaveBeenCalled();
  expect(record().status).toBe("SCHEDULED");
});
test("no route loads a friendly state without a map", async () => {
  getMyPatrol.mockResolvedValue({ ...record(), plannedRoute: [] });
  const ui = mount();
  await ui.findByText("No Planned Route");
  expect(ui.queryByTestId("planned-route-webview")).toBeNull();
});
test("malformed coordinates warn and suppress a misleading distance", async () => {
  const points = plannedRoute();
  points[2].latitude = null;
  getMyPatrol.mockResolvedValue({ ...record(), plannedRoute: points });
  const ui = mount();
  await ui.findByText("Unavailable — incomplete route");
  expect(ui.getByText(/Some saved route points/)).toBeTruthy();
  expect(ui.getByText("Ranger Post")).toBeTruthy();
});
test.each([401, 403, 404])(
  "unauthorized or unavailable response %s does not expose raw errors",
  async (status) => {
    getMyPatrol.mockRejectedValue({
      response: { status, data: { message: "private Prisma details" } },
    });
    const ui = mount();
    await waitFor(() => expect(ui.getByRole("alert")).toBeTruthy());
    expect(ui.queryByText("private Prisma details")).toBeNull();
    expect(ui.queryByTestId("planned-route-webview")).toBeNull();
  },
);
test("network failures retry using only the selected patrol id", async () => {
  getMyPatrol.mockRejectedValueOnce(new Error("private network details"));
  const ui = mount();
  await ui.findByText(
    "Unable to load the patrol route. Check your connection and try again.",
  );
  fireEvent.press(ui.getByLabelText("Retry"));
  await ui.findByText("Boundary Patrol");
});
test("missing id fails closed without a request", async () => {
  const ui = mount({});
  await ui.findByText("This patrol is not available.");
  expect(getMyPatrol).not.toHaveBeenCalled();
});
test("map load failure retains list and allows map retry without fetching or mutation", async () => {
  const ui = mount();
  await ui.findByText("Boundary Patrol");
  fireEvent(ui.getByTestId("planned-route-webview"), "message", {
    nativeEvent: { data: JSON.stringify({ type: "map-error" }) },
  });
  expect(ui.getByText("Known Snare Zone")).toBeTruthy();
  fireEvent.press(ui.getByLabelText("Retry map"));
  expect(ui.getByLabelText("Loading route map")).toBeTruthy();
  expect(getMyPatrol).toHaveBeenCalledTimes(1);
  expect(startMyPatrol).not.toHaveBeenCalled();
});
