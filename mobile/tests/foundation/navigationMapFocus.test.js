import { runInNewContext } from "node:vm";
import { buildPlannedMapDocument } from "../../src/components/patrol/plannedMapDocument";

function mountMap() {
  const nodes = {};
  const node = () => ({ style: {}, appendChild: jest.fn() });
  const map = {
    createPane: jest.fn(),
    getPane: () => node(),
    invalidateSize: jest.fn(),
    fitBounds: jest.fn(),
    setView: jest.fn(),
  };
  const layer = () => {
    const value = {
      addTo: () => value,
      bindTooltip: () => value,
      bindPopup: () => value,
      on: () => value,
      clearLayers: jest.fn(),
    };
    return value;
  };
  const L = {
    map: () => map,
    layerGroup: layer,
    tileLayer: layer,
    marker: layer,
    circleMarker: jest.fn(layer),
    circle: layer,
    polyline: jest.fn(layer),
    geoJSON: layer,
    divIcon: (x) => x,
    latLngBounds: (x) => x,
  };
  const window = {
    addEventListener: jest.fn(),
    ReactNativeWebView: { postMessage: jest.fn() },
  };
  const document = {
    getElementById: (id) => (nodes[id] ||= node()),
    createElement: node,
    body: {
      appendChild: (button) => {
        nodes[button.id] = button;
      },
    },
  };
  const html = buildPlannedMapDocument(
    [
      { type: "START", latitude: 7, longitude: 80, color: "green" },
      { type: "END", latitude: 8, longitude: 81, color: "red" },
    ],
    [],
    true,
  );
  const script = [...html.matchAll(/<script>([\s\S]*?)<\/script>/g)].at(-1)[1];
  runInNewContext(script, {
    L,
    window,
    document,
    notify: jest.fn(),
    mapFailure: () => {
      throw Error("Map initialization failed");
    },
  });
  return { map, nodes, L, update: window.updatePatrolNavigation };
}
const payload = {
  currentLocation: { latitude: 7.2, longitude: 80.2, accuracy: 10 },
  destination: { latitude: 7.4, longitude: 80.4 },
  geometry: {
    type: "LineString",
    coordinates: [
      [80.21, 7.21],
      [80.39, 7.39],
    ],
  },
  riskZones: [],
  trail: [],
};
test("first live route fits GPS, route and next destination exactly once; GPS and rerouting preserve user camera", () => {
  const { map, update, L } = mountMap();
  map.fitBounds.mockClear();
  update({ ...payload, geometry: null });
  expect(L.circleMarker).toHaveBeenCalled();
  expect(map.fitBounds).not.toHaveBeenCalled();
  update(payload);
  expect(map.fitBounds).toHaveBeenCalledTimes(1);
  expect(
    Array.from(map.fitBounds.mock.calls[0][0], (p) => Array.from(p)),
  ).toEqual([
    [7.21, 80.21],
    [7.39, 80.39],
    [7.2, 80.2],
    [7.4, 80.4],
  ]);
  update({ ...payload, currentLocation: { latitude: 7.25, longitude: 80.25 } });
  update({
    ...payload,
    geometry: {
      type: "LineString",
      coordinates: [
        [80.25, 7.25],
        [80.4, 7.4],
      ],
    },
  });
  expect(map.fitBounds).toHaveBeenCalledTimes(1);
  expect(map.setView).not.toHaveBeenCalled();
});
test("manual Re-centre uses only real current GPS; Fit Route remains available", () => {
  const { map, nodes, update } = mountMap();
  expect(nodes.recenter.disabled).toBe(true);
  nodes.recenter.onclick();
  expect(map.setView).not.toHaveBeenCalled();
  update(payload);
  expect(nodes.recenter.disabled).toBe(false);
  nodes.recenter.onclick();
  expect(map.setView).toHaveBeenCalledWith([7.2, 80.2], 16);
  map.fitBounds.mockClear();
  nodes.fit.onclick();
  expect(map.fitBounds).toHaveBeenCalledTimes(1);
  update({ ...payload, currentLocation: null });
  expect(nodes.recenter.disabled).toBe(true);
});

test("blue approach and green complete route coexist; reaching START leaves green active leg and full route", () => {
  const { map, nodes, L, update } = mountMap();
  const fullRoute = {
    geometry: {
      type: "LineString",
      coordinates: [
        [80.4, 7.4],
        [80.5, 7.5],
        [80.6, 7.6],
      ],
    },
    legs: [
      {
        destinationWaypointId: "cp",
        geometry: {
          type: "LineString",
          coordinates: [
            [80.4, 7.4],
            [80.5, 7.5],
          ],
        },
      },
      {
        destinationWaypointId: "end",
        geometry: {
          type: "LineString",
          coordinates: [
            [80.5, 7.5],
            [80.6, 7.6],
          ],
        },
      },
    ],
  };
  update({ ...payload, approaching: true, fullRoute, reachedWaypointIds: [] });
  expect(
    L.polyline.mock.calls.some(([p, style]) => style.color === "#1679dc"),
  ).toBe(true);
  expect(
    L.polyline.mock.calls.filter(([p, style]) => style.color === "#27804b"),
  ).toHaveLength(2);
  nodes.fit.onclick();
  expect(
    Array.from(map.fitBounds.mock.calls.at(-1)[0], (p) => Array.from(p)),
  ).toContainEqual([7.6, 80.6]);
  const greenCalls = L.polyline.mock.calls.filter(
    ([p, style]) => style.color === "#27804b",
  ).length;
  L.polyline.mockClear();
  update({
    ...payload,
    approaching: false,
    fullRoute,
    reachedWaypointIds: ["start"],
    destination: { waypointId: "cp", latitude: 7.5, longitude: 80.5 },
  });
  expect(
    L.polyline.mock.calls.some(([p, style]) => style.color === "#1679dc"),
  ).toBe(false);
  expect(
    L.polyline.mock.calls.some(
      ([p, style]) => style.color === "#145b34" && style.weight === 7,
    ),
  ).toBe(true);
  L.polyline.mockClear();
  update({
    ...payload,
    approaching: false,
    fullRoute,
    reachedWaypointIds: ["start"],
    currentLocation: { latitude: 7.3, longitude: 80.3 },
  });
  expect(
    L.polyline.mock.calls.some(([p, style]) => style.color === "#27804b"),
  ).toBe(false);
});
test("Fit Route after checkpoint prioritizes remaining green geometry and END", () => {
  const { map, nodes, update } = mountMap();
  const fullRoute = {
    geometry: {
      type: "LineString",
      coordinates: [
        [80, 7],
        [80.5, 7.5],
        [81, 8],
      ],
    },
    legs: [
      {
        destinationWaypointId: "cp",
        geometry: {
          type: "LineString",
          coordinates: [
            [80, 7],
            [80.5, 7.5],
          ],
        },
      },
      {
        destinationWaypointId: "end",
        geometry: {
          type: "LineString",
          coordinates: [
            [80.5, 7.5],
            [81, 8],
          ],
        },
      },
    ],
  };
  update({
    ...payload,
    approaching: false,
    fullRoute,
    reachedWaypointIds: ["start", "cp"],
  });
  nodes.fit.onclick();
  const positions = Array.from(map.fitBounds.mock.calls.at(-1)[0], (p) =>
    Array.from(p),
  );
  expect(positions).toContainEqual([8, 81]);
  expect(positions).not.toContainEqual([7, 80]);
});
