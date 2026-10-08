import React from "react";
import { act, fireEvent, render, waitFor } from "@testing-library/react-native";
import MyPatrolScreen from "../../src/screens/patrol/MyPatrolScreen";
import PatrolCardPreview, { validatedTrail } from "../../src/components/patrol/PatrolCardPreview";
import { recordedDuration } from "../../src/components/patrol/PatrolListCard";
import { getMyPatrol, getPatrolLocations } from "../../src/services/patrolApi";
import useRangerPatrols from "../../src/hooks/useRangerPatrols";
import { buildPlannedMapDocument } from "../../src/components/patrol/plannedMapDocument";
jest.mock("../../src/services/patrolApi", () => ({ getMyPatrol: jest.fn(), getPatrolLocations: jest.fn() }));
jest.mock("../../src/hooks/useRangerPatrols");
jest.mock("../../src/hooks/usePatrolClock", () => () => new Date("2026-10-08T09:00:00+05:30"));
jest.mock("../../src/components/patrol/PatrolMapSurface", () => ({ html }) => <>{require("react").createElement(require("react-native").View, { testID: "card-map", html })}</>);
const points = [{ type: "START", order: 0, latitude: 7.2, longitude: 80.2 }, { type: "CHECKPOINT", order: 1, latitude: 7.3, longitude: 80.3 }];
const record = (id) => ({ id, routeName: `Route ${id}`, park: { name: "Actual Park" }, scheduledDate: "2026-10-08", startTime: "2026-10-08T08:00:00Z", endTime: "2026-10-08T12:00:00Z", actualStartTime: "2026-10-08T08:15:00Z", status: "IN_PROGRESS", priority: "HIGH", patrolType: "ROUTINE" });
beforeEach(() => {
  jest.clearAllMocks();
  getMyPatrol.mockImplementation(async (id) => ({ ...record(id), plannedRoute: id === "a" ? points : points.map((p) => ({ ...p, longitude: p.longitude + 1 })) }));
  getPatrolLocations.mockResolvedValue([{ latitude: 7.21, longitude: 80.21 }, { latitude: 7.22, longitude: 80.22 }]);
  useRangerPatrols.mockReturnValue({ patrols: [record("a"), record("b")], loading: false, error: null, refresh: jest.fn() });
});
test("visible cards load automatically with correct coordinates and cached return visits", async () => {
  const navigation = { navigate: jest.fn() };
  const screen = render(<MyPatrolScreen route={{}} navigation={navigation} />);
  expect(screen.queryAllByTestId("card-map")).toHaveLength(0);
  expect(getMyPatrol).not.toHaveBeenCalled();
  fireEvent(screen.getByTestId("patrol-list"), "onViewableItemsChanged", { viewableItems: [{ isViewable: true, item: record("a") }] });
  await waitFor(() => expect(screen.getAllByTestId("card-map")).toHaveLength(1));
  expect(getMyPatrol).toHaveBeenCalledWith("a", expect.anything());
  expect(getPatrolLocations).toHaveBeenCalledWith("a", expect.anything());
  expect(screen.getByTestId("card-map").props.html).toContain('"longitude":80.2');
  fireEvent(screen.getByTestId("patrol-list"), "onViewableItemsChanged", { viewableItems: [{ isViewable: true, item: record("b") }] });
  await waitFor(() => expect(getMyPatrol).toHaveBeenCalledWith("b", expect.anything()));
  await waitFor(() => expect(screen.getAllByTestId("card-map")).toHaveLength(1));
  expect(screen.getByTestId("card-map").props.html).toContain('"longitude":81.2');
  fireEvent(screen.getByTestId("patrol-list"), "onViewableItemsChanged", { viewableItems: [{ isViewable: true, item: record("a") }] });
  await waitFor(() => expect(screen.getAllByTestId("card-map")).toHaveLength(1));
  expect(getMyPatrol).toHaveBeenCalledTimes(2); // Cached on reopen.
  fireEvent.press(screen.getByLabelText("Completed"));
  expect(screen.queryAllByTestId("card-map")).toHaveLength(0);
});
test("empty route and failed preview retry are honest and do not affect details navigation", async () => {
  getMyPatrol.mockRejectedValueOnce(new Error("network"));
  getMyPatrol.mockResolvedValue({ id: "a", plannedRoute: [] });
  const screen = render(<PatrolCardPreview patrolId="a" open onToggle={jest.fn()} />);
  await waitFor(() => expect(screen.getByText(/could not be loaded/)).toBeTruthy());
  fireEvent.press(screen.getByLabelText("Retry route preview: a"));
  await waitFor(() => expect(screen.getByText("Route not available")).toBeTruthy());
  expect(getPatrolLocations).not.toHaveBeenCalled();
});
test("mismatched patrol response cannot display another patrol's route", async () => {
  getMyPatrol.mockResolvedValue({ id: "wrong", plannedRoute: points });
  const screen = render(<PatrolCardPreview patrolId="a" open onToggle={jest.fn()} />);
  await waitFor(() => expect(screen.getByText(/could not be loaded/)).toBeTruthy());
  expect(screen.queryByTestId("card-map")).toBeNull();
});
test("duration uses actual times only; preview document fits planned and actual coordinates", () => {
  expect(recordedDuration({ actualStartTime: "2026-10-08T08:15Z", actualEndTime: "2026-10-08T10:00Z" })).toBe("1h 45m");
  expect(recordedDuration(record("a"))).toBeNull();
  expect(validatedTrail([{ latitude: 999, longitude: 80 }])).toEqual([]);
  const html = buildPlannedMapDocument([], [], false, [{ latitude: 7.5, longitude: 80.5 }]);
  expect(html).toContain('"latitude":7.5');
  expect(html).toContain("positions=positions.concat(data.trail");
  expect(html).toContain("color:'#c76b19'");
});

test.each([["SCHEDULED", "Start Patrol"], ["IN_PROGRESS", "Continue Patrol"], ["COMPLETED", "View Summary"]])("%s retains its original details action without lifecycle mutation", (status, action) => {
  useRangerPatrols.mockReturnValue({ patrols: [{ ...record("a"), status }], loading: false, error: null, refresh: jest.fn() });
  const navigation = { navigate: jest.fn() };
  const screen = render(<MyPatrolScreen route={{}} navigation={navigation} />);
  fireEvent.press(screen.getByLabelText(action));
  expect(navigation.navigate).toHaveBeenCalledWith("PatrolDetails", { patrolId: "a" });
  expect(getMyPatrol).not.toHaveBeenCalled();
});

test("closing a pending preview aborts its requests", () => {
  getMyPatrol.mockImplementation(() => new Promise(() => {}));
  const screen = render(<PatrolCardPreview patrolId="a" open onToggle={jest.fn()} />);
  const signal = getMyPatrol.mock.calls[0][1];
  screen.rerender(<PatrolCardPreview patrolId="a" open={false} onToggle={jest.fn()} />);
  expect(signal.aborted).toBe(true);
  expect(getPatrolLocations).not.toHaveBeenCalled();
});

test("cached route survives virtualization unmount without another request", async () => {
 const cache = new Map();
 const first = render(<PatrolCardPreview patrolId="a" open cache={cache} />);
 await waitFor(() => expect(first.getByTestId("card-map")).toBeTruthy());
 first.unmount();
 const second = render(<PatrolCardPreview patrolId="a" open cache={cache} />);
 expect(second.getByTestId("card-map")).toBeTruthy();
 expect(getMyPatrol).toHaveBeenCalledTimes(1);
 second.rerender(<PatrolCardPreview patrolId="a" open={false} cache={cache} />);
 expect(second.queryByTestId("card-map")).toBeNull();
 second.rerender(<PatrolCardPreview patrolId="a" open cache={cache} />);
 expect(second.getByTestId("card-map")).toBeTruthy();
 expect(getMyPatrol).toHaveBeenCalledTimes(1);
});

test("blur releases visible maps; focus and filter return reuse cached route", async () => {
 const listeners = {};
 const screen = render(<MyPatrolScreen route={{}} navigation={{ navigate: jest.fn(), addListener: (name, fn) => { listeners[name] = fn; return jest.fn(); } }} />);
 fireEvent(screen.getByTestId("patrol-list"), "onViewableItemsChanged", { viewableItems: [{ isViewable: true, item: record("a") }] });
 await waitFor(() => expect(screen.getByTestId("card-map")).toBeTruthy());
 act(() => listeners.blur());
 expect(screen.queryByTestId("card-map")).toBeNull();
 act(() => listeners.focus());
 expect(screen.getByTestId("card-map")).toBeTruthy();
 fireEvent.press(screen.getByLabelText("Completed"));
 fireEvent.press(screen.getByLabelText("All"));
 await waitFor(() => expect(screen.getByTestId("card-map")).toBeTruthy());
 expect(getMyPatrol).toHaveBeenCalledTimes(1);
});

test("completed patrol loads its recorded trail and simultaneously visible cards keep separate routes", async () => {
 getMyPatrol.mockImplementation(async (id) => ({ ...record(id), status: "COMPLETED", plannedRoute: id === "a" ? points : points.map((point) => ({ ...point, longitude: point.longitude + 1 })) }));
 const screen = render(<MyPatrolScreen route={{}} navigation={{ navigate: jest.fn() }} />);
 fireEvent(screen.getByTestId("patrol-list"), "onViewableItemsChanged", { viewableItems: ["a", "b"].map((id) => ({ isViewable: true, item: record(id) })) });
 await waitFor(() => expect(screen.getAllByTestId("card-map")).toHaveLength(2));
 expect(screen.getAllByTestId("card-map")[0].props.html).toContain('"longitude":80.2');
 expect(screen.getAllByTestId("card-map")[1].props.html).toContain('"longitude":81.2');
 expect(screen.getAllByTestId("card-map")[0].props.html).toContain('"latitude":7.21');
 expect(getPatrolLocations).toHaveBeenCalledWith("a", expect.anything());
 expect(getPatrolLocations).toHaveBeenCalledWith("b", expect.anything());
});
