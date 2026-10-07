import { fireEvent, render, screen, within } from "@testing-library/react";
import { useState } from "react";
import PatrolRoutePlanner from "../../src/components/patrol/PatrolRoutePlanner";
import {
  routeDistanceKm,
  normalizeRoute,
  routeError,
  routePayload,
} from "../../src/components/patrol/routePlanning";
vi.mock("../../src/components/patrol/PatrolMap", () => ({
  default: ({ onAdd }) => (
    <button type="button" onClick={() => onAdd({ lat: 7.5, lng: 80.7 })}>
      Map click
    </button>
  ),
}));
function Harness() {
  const [points, setPoints] = useState([]);
  return (
    <>
      <PatrolRoutePlanner points={points} onChange={setPoints} />
      <output data-testid="points">
        {JSON.stringify(routePayload(points))}
      </output>
    </>
  );
}
const click = (name) => fireEvent.click(screen.getByRole("button", { name }));
const points = () => JSON.parse(screen.getByTestId("points").textContent);
test("adds mixed types, prevents duplicate endpoints and preserves order after removal/reorder", () => {
  render(<Harness />);
  click("Map click");
  expect(screen.getByRole("button", { name: "Start Point" })).toBeDisabled();
  click("Map click");
  click("High Risk Area");
  click("Map click");
  click("Observation Point");
  click("Map click");
  click("Checkpoint");
  click("Map click");
  click("End Point");
  click("Map click");
  expect(points().map((p) => p.type)).toEqual([
    "START",
    "CHECKPOINT",
    "HIGH_RISK",
    "OBSERVATION",
    "CHECKPOINT",
    "END",
  ]);
  expect(screen.getByRole("button", { name: "End Point" })).toBeDisabled();
  click("Move point 5 up");
  click("Remove point 2");
  expect(points().map((p) => p.order)).toEqual([0, 1, 2, 3, 4]);
  expect(points().filter((p) => p.type === "CHECKPOINT")[0].label).toBe(
    "Checkpoint 1",
  );
  expect(routeError(points())).toBe("");
});
test("edits metadata safely and clears only after confirmation", () => {
  render(<Harness />);
  click("Map click");
  fireEvent.change(screen.getByLabelText("Point name"), {
    target: { value: "Main gate" },
  });
  fireEvent.change(screen.getByLabelText("Point note (optional)"), {
    target: { value: "Meet here" },
  });
  expect(points()[0]).toMatchObject({ label: "Main gate", note: "Meet here" });
  click("Clear route");
  expect(points()).toHaveLength(1);
  click("Keep route");
  expect(points()).toHaveLength(1);
  click("Clear route");
  fireEvent.click(
    within(screen.getByRole("alertdialog")).getByRole("button", {
      name: "Clear all points",
    }),
  );
  expect(points()).toEqual([]);
});
test("calculates geographic distance, including zero and an equatorial degree", () => {
  expect(routeDistanceKm([])).toBe(0);
  expect(routeDistanceKm([{ latitude: 0, longitude: 0 }])).toBe(0);
  expect(
    routeDistanceKm([
      { latitude: 0, longitude: 0 },
      { latitude: 0, longitude: 1 },
    ]),
  ).toBeCloseTo(111.195, 2);
});
test("normalizes deletion without overwriting custom checkpoint labels", () => {
  const result = normalizeRoute([
    { type: "START", autoLabel: true },
    { type: "CHECKPOINT", autoLabel: false, label: "Water hole" },
    { type: "CHECKPOINT", autoLabel: true },
    { type: "END", autoLabel: true },
  ]);
  expect(result[1].label).toBe("Water hole");
  expect(result[2].label).toBe("Checkpoint 2");
  expect(result.map((p) => p.order)).toEqual([0, 1, 2, 3]);
});
test("missing endpoints produce friendly route errors", () => {
  expect(routeError([])).toMatch(/Start Point and an End Point/);
  expect(routeError([{ type: "CHECKPOINT" }, { type: "END" }])).toMatch(
    /exactly one Start Point/,
  );
  expect(routeError([{ type: "START" }, { type: "CHECKPOINT" }])).toMatch(
    /exactly one End Point/,
  );
});
test("manual fallback rejects invalid coordinates before adding a point", () => {
  render(<Harness />);
  fireEvent.click(screen.getByText("Use manual coordinates instead"));
  fireEvent.change(screen.getByLabelText("Point latitude"), {
    target: { value: "91" },
  });
  fireEvent.change(screen.getByLabelText("Point longitude"), {
    target: { value: "80.7" },
  });
  click("Add coordinates");
  expect(points()).toEqual([]);
  expect(screen.getByText("Enter a latitude from -90 to 90 and longitude from -180 to 180.")).toBeVisible();
});
