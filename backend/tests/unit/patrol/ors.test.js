jest.mock("../../../src/config/environment", () => ({
  ORS_API_KEY: "isolated-test-key-not-real",
  ORS_BASE_URL: "https://api.heigit.org",
}));
let ors;
const input = () => ({
  rangerId: "a",
  patrolId: "p",
  destination: {
    id: "w",
    type: "START",
    label: "Start",
    latitude: 49.420318,
    longitude: 8.687872,
  },
  currentLocation: { latitude: 49.41461, longitude: 8.681495 },
});
const data = () => ({
  features: [
    {
      geometry: {
        type: "LineString",
        coordinates: [
          [8.681495, 49.41461, 0],
          [8.687872, 49.420318, 0],
        ],
      },
      properties: {
        summary: { distance: 1200, duration: 900 },
        private: "hidden",
      },
    },
  ],
  metadata: { secret: "not-returned" },
});
beforeEach(() => {
  jest.resetModules();
  ors = require("../../../src/services/ors.service");
  global.fetch = jest
    .fn()
    .mockResolvedValue({ ok: true, status: 200, json: async () => data() });
});
afterEach(() => {
  delete global.fetch;
  jest.useRealTimers();
});
test("server-only foot walking endpoint, Authorization header and sanitized GeoJSON response", async () => {
  const route = await ors.walkingRoute(input());
  const [url, options] = fetch.mock.calls[0];
  expect(String(url)).toBe(
    "https://api.heigit.org/openrouteservice/v2/directions/foot-walking/geojson",
  );
  expect(options.headers.Authorization).toBe("isolated-test-key-not-real");
  expect(JSON.parse(options.body).coordinates).toEqual([
    [8.681495, 49.41461],
    [8.687872, 49.420318],
  ]);
  expect(route.geometry.coordinates[0]).toEqual([8.681495, 49.41461]);
  expect(route.distanceMeters).toBe(1200);
  expect(route.durationSeconds).toBe(900);
  expect(JSON.stringify(route)).not.toContain("isolated-test-key");
  expect(route.metadata).toBeUndefined();
});
test("nearby duplicate requests reuse cache and significant changes obey cooldown", async () => {
  await ors.walkingRoute(input());
  await ors.walkingRoute(input());
  expect(fetch).toHaveBeenCalledTimes(1);
  await expect(
    ors.walkingRoute({
      ...input(),
      currentLocation: { latitude: 49.41561, longitude: 8.681495 },
    }),
  ).rejects.toMatchObject({ status: 429 });
});
test("concurrent duplicate requests coalesce while different destination is blocked", async () => {
  let release;
  fetch.mockImplementation(
    () =>
      new Promise((resolve) => {
        release = resolve;
      }),
  );
  const first = ors.walkingRoute(input()),
    second = ors.walkingRoute(input());
  await expect(
    ors.walkingRoute({
      ...input(),
      destination: { ...input().destination, id: "different" },
    }),
  ).rejects.toMatchObject({ status: 429 });
  release({ ok: true, status: 200, json: async () => data() });
  expect(await first).toEqual(await second);
  expect(fetch).toHaveBeenCalledTimes(1);
});
test.each([
  [404, 422, "NO_WALKING_ROUTE"],
  [400, 422, "NO_WALKING_ROUTE"],
  [429, 429, "ROUTE_RATE_LIMIT"],
  [401, 503, "ROUTING_UNAVAILABLE"],
  [500, 503, "ROUTING_UNAVAILABLE"],
])("HTTP %s yields sanitized %s %s", async (status, expected, code) => {
  fetch.mockResolvedValue({
    ok: false,
    status,
    json: async () => ({ secret: "provider-secret" }),
  });
  await expect(ors.walkingRoute(input())).rejects.toMatchObject({
    status: expected,
    code,
  });
});
test("network and timeout errors exclude upstream content", async () => {
  fetch.mockRejectedValue(
    Object.assign(new Error("secret upstream payload"), {
      name: "TimeoutError",
    }),
  );
  await expect(ors.walkingRoute(input())).rejects.toMatchObject({
    status: 504,
    message:
      "Walking route is currently unavailable. Check your connection and try again.",
  });
});
test.each([
  {},
  {
    features: [
      {
        geometry: {
          type: "LineString",
          coordinates: [
            [999, 0],
            [0, 0],
          ],
        },
        properties: { summary: { distance: 1, duration: 1 } },
      },
    ],
  },
  {
    features: [
      {
        geometry: {
          type: "LineString",
          coordinates: [
            [0, 0],
            [1, 1],
          ],
        },
        properties: { summary: { distance: -1, duration: 1 } },
      },
    ],
  },
])("malformed provider geometry/summary is rejected", async (body) => {
  fetch.mockResolvedValue({ ok: true, status: 200, json: async () => body });
  await expect(ors.walkingRoute(input())).rejects.toMatchObject({
    status: 502,
    code: "INVALID_ROUTE",
  });
});
test("deprecated host is refused without any request", async () => {
  require("../../../src/config/environment").ORS_BASE_URL =
    "https://api.openrouteservice.org";
  await expect(ors.walkingRoute(input())).rejects.toMatchObject({
    status: 503,
  });
  expect(fetch).not.toHaveBeenCalled();
});
const zone = (id = "risk", longitude = 8.683) => ({
  id,
  name: "Known zone",
  description: null,
  riskLevel: "HIGH",
  geometry: require("../../../../shared/riskGeometry").zonePolygon({
    centerLatitude: 49.416,
    centerLongitude: longitude,
    radiusMeters: 25,
  }),
});
test("one zone supplies Polygon avoidance and longer provider distance/ETA are returned", async () => {
  const z = zone("risk", 8.69);
  const body = data();
  body.features[0].properties.summary = { distance: 1800, duration: 1300 };
  fetch.mockResolvedValue({ ok: true, status: 200, json: async () => body });
  const route = await ors.walkingRoute({ ...input(), riskZones: [z] });
  expect(
    JSON.parse(fetch.mock.calls[0][1].body).options.avoid_polygons,
  ).toEqual(z.geometry);
  expect(route.riskAvoidance).toEqual({ applied: true, zoneCount: 1 });
  expect(route.distanceMeters).toBe(1800);
  expect(route.durationSeconds).toBe(1300);
});
test("multiple zones supply MultiPolygon and normal route omits options entirely", async () => {
  const zones = [zone("a", 8.69), zone("b", 8.691)];
  await ors.walkingRoute({ ...input(), riskZones: zones });
  expect(
    JSON.parse(fetch.mock.calls[0][1].body).options.avoid_polygons.type,
  ).toBe("MultiPolygon");
  await ors.walkingRoute({ ...input(), rangerId: "normal" });
  expect(JSON.parse(fetch.mock.calls[1][1].body).options).toBeUndefined();
});
test("intersecting avoidance result is rejected even when segment endpoints are outside", async () => {
  const middle = {
    id: "crossing",
    geometry: require("../../../../shared/riskGeometry").zonePolygon({
      centerLatitude: (49.41461 + 49.420318) / 2,
      centerLongitude: (8.681495 + 8.687872) / 2,
      radiusMeters: 50,
    }),
  };
  await expect(
    ors.walkingRoute({ ...input(), riskZones: [middle] }),
  ).rejects.toMatchObject({ code: "NO_RISK_AVOIDING_ROUTE", status: 422 });
  expect(fetch).toHaveBeenCalledTimes(1);
});
test.each([400, 404])(
  "HTTP %s with avoidance returns structured no alternative without retrying unprotected",
  async (status) => {
    fetch.mockResolvedValue({
      ok: false,
      status,
      json: async () => ({
        error: { code: 2009, message: "private provider payload" },
      }),
    });
    await expect(
      ors.walkingRoute({ ...input(), riskZones: [zone()] }),
    ).rejects.toMatchObject({ code: "NO_RISK_AVOIDING_ROUTE" });
    expect(fetch).toHaveBeenCalledTimes(1);
  },
);
test("provider geometry restrictions sanitized without dropping avoidance", async () => {
  fetch.mockResolvedValue({
    ok: false,
    status: 400,
    json: async () => ({
      error: { code: 2003, message: "private restriction body" },
    }),
  });
  await expect(
    ors.walkingRoute({ ...input(), riskZones: [zone()] }),
  ).rejects.toMatchObject({ code: "RISK_AVOIDANCE_UNAVAILABLE" });
  expect(fetch).toHaveBeenCalledTimes(1);
});
test("cache fingerprint changes with risk geometry and prevents stale non-avoiding route reuse", async () => {
  await ors.walkingRoute(input());
  await expect(
    ors.walkingRoute({ ...input(), riskZones: [zone()] }),
  ).rejects.toMatchObject({ status: 429 });
  expect(fetch).toHaveBeenCalledTimes(1);
});
test("rerouting after cooldown keeps avoidance options, and changed-zone geometry is not cached", async () => {
  jest.useFakeTimers();
  const z = zone("risk", 8.69);
  await ors.walkingRoute({ ...input(), riskZones: [z] });
  jest.advanceTimersByTime(21000);
  await ors.walkingRoute({
    ...input(),
    currentLocation: { latitude: 49.41361, longitude: 8.681495 },
    riskZones: [z],
  });
  expect(fetch).toHaveBeenCalledTimes(2);
  expect(
    fetch.mock.calls.every(
      ([, options]) =>
        JSON.parse(options.body).options.avoid_polygons.type === "Polygon",
    ),
  ).toBe(true);
});
test("coalesced nearby origin is revalidated when its connector crosses a small avoided zone", async () => {
  const zone = {
    id: "small",
    geometry: require("../../../../shared/riskGeometry").zonePolygon({
      centerLatitude: 49.41461,
      centerLongitude: 8.68154,
      radiusMeters: 1,
    }),
  };
  let release;
  fetch.mockImplementation(
    () =>
      new Promise((resolve) => {
        release = resolve;
      }),
  );
  const first = ors.walkingRoute({ ...input(), riskZones: [zone] });
  const second = ors.walkingRoute({
    ...input(),
    riskZones: [zone],
    currentLocation: { latitude: 49.41461, longitude: 8.6816 },
  });
  release({ ok: true, status: 200, json: async () => data() });
  expect((await first).riskAvoidance.applied).toBe(true);
  await expect(second).rejects.toMatchObject({
    code: "NO_RISK_AVOIDING_ROUTE",
  });
  expect(fetch).toHaveBeenCalledTimes(1);
});

const fullInput = () => {
  const waypoints = [
    "START",
    "CHECKPOINT",
    "CHECKPOINT",
    "OBSERVATION",
    "END",
  ].map((type, i) => ({
    id: "full-" + i,
    type,
    label: type,
    order: i,
    latitude: 49.41461 + i * 0.001,
    longitude: 8.681495,
  }));
  return {
    ...input(),
    currentLocation: waypoints[0],
    destination: waypoints.at(-1),
    waypoints,
  };
};
const fullData = () => ({
  features: [
    {
      geometry: {
        type: "LineString",
        coordinates: fullInput().waypoints.map((p) => [
          p.longitude,
          p.latitude,
        ]),
      },
      properties: {
        summary: { distance: 600, duration: 450 },
        way_points: [0, 1, 2, 3, 4],
      },
    },
  ],
});
function mockFull(body = fullData()) {
  fetch.mockResolvedValue({ ok: true, status: 200, json: async () => body });
}
test("full patrol uses one ordered multi-coordinate walking request with avoidance and sanitized legs", async () => {
  mockFull();
  const z = zone("outside", 8.69);
  const result = await ors.walkingRoute({ ...fullInput(), riskZones: [z] });
  const body = JSON.parse(fetch.mock.calls[0][1].body);
  expect(body.coordinates).toEqual(
    fullInput().waypoints.map((p) => [p.longitude, p.latitude]),
  );
  expect(body.options.avoid_polygons).toEqual(z.geometry);
  expect(result.legs.map((l) => l.destinationWaypointId)).toEqual([
    "full-1",
    "full-2",
    "full-3",
    "full-4",
  ]);
  expect(result.riskAvoidance.applied).toBe(true);
  expect(JSON.stringify(result)).not.toContain("isolated-test-key");
  expect(fetch).toHaveBeenCalledTimes(1);
});
test("full cache is independent of live cache, coalesces duplicates, and shares cooldown", async () => {
  mockFull();
  const first = ors.walkingRoute(fullInput()),
    second = ors.walkingRoute(fullInput());
  expect(await first).toEqual(await second);
  await ors.walkingRoute(fullInput());
  expect(fetch).toHaveBeenCalledTimes(1);
  await expect(ors.walkingRoute(input())).rejects.toMatchObject({
    status: 429,
  });
});
test("full cache reused past live expiry; changed intermediate waypoint invalidates cache", async () => {
  jest.useFakeTimers();
  mockFull();
  await ors.walkingRoute(fullInput());
  jest.advanceTimersByTime(60000);
  await ors.walkingRoute(fullInput());
  expect(fetch).toHaveBeenCalledTimes(1);
  const changed = fullInput();
  changed.waypoints[2].latitude += 0.0001;
  await ors.walkingRoute(changed);
  expect(fetch).toHaveBeenCalledTimes(2);
});
test.each([
  [0, 1, 4],
  [0, 3, 2, 3, 4],
  [0, 1, 2, 3, 99],
])(
  "invalid provider waypoint indices %j never create a fake full route",
  async (indices) => {
    const body = fullData();
    body.features[0].properties.way_points = indices;
    mockFull(body);
    await expect(ors.walkingRoute(fullInput())).rejects.toMatchObject({
      code: "INVALID_ROUTE",
    });
  },
);
test("provider no alternative full route preserves avoidance with no fallback request", async () => {
  fetch.mockResolvedValue({
    ok: false,
    status: 404,
    json: async () => ({ error: { code: 2009 } }),
  });
  await expect(
    ors.walkingRoute({ ...fullInput(), riskZones: [zone()] }),
  ).rejects.toMatchObject({ code: "NO_RISK_AVOIDING_ROUTE" });
  expect(fetch).toHaveBeenCalledTimes(1);
  expect(
    JSON.parse(fetch.mock.calls[0][1].body).options.avoid_polygons,
  ).toBeDefined();
});

test("full route reports an unmapped required point without exposing upstream content or dropping avoidance", async () => {
  fetch.mockResolvedValue({
    ok: false,
    status: 404,
    json: async () => ({
      error: { code: 2010, message: "private upstream content" },
    }),
  });
  await expect(
    ors.walkingRoute({ ...fullInput(), riskZones: [zone()] }),
  ).rejects.toMatchObject({ code: "PATROL_POINT_UNMAPPED", status: 422 });
  expect(fetch).toHaveBeenCalledTimes(1);
});
test("intermediate waypoint connector crossing a RiskZone rejects the entire full route", async () => {
  const body = fullData();
  body.features[0].geometry.coordinates[2][0] += 0.001;
  mockFull(body);
  const risk = {
    id: "connector-risk",
    geometry: require("../../../../shared/riskGeometry").zonePolygon({
      centerLatitude: fullInput().waypoints[2].latitude,
      centerLongitude: 8.681995,
      radiusMeters: 10,
    }),
  };
  await expect(
    ors.walkingRoute({ ...fullInput(), riskZones: [risk] }),
  ).rejects.toMatchObject({ code: "NO_RISK_AVOIDING_ROUTE" });
  expect(fetch).toHaveBeenCalledTimes(1);
});

test.each([[true,0,"PATROL_POINT_UNMAPPED"],[false,0,"CURRENT_LOCATION_UNMAPPED"],[false,1,"DESTINATION_POINT_UNMAPPED"]])("2010 safely identifies full=%s point=%s",async(full,index,code)=>{
 const req=input();
 if(full)req.waypoints=[{...req.currentLocation,id:"s",type:"START"},req.destination];
 fetch.mockResolvedValue({ok:false,status:404,json:async()=>({error:{code:2010,message:"Could not find "+(full?"coordinate ":"point ")+index+": PRIVATE COORDINATES within a radius of 350.0 meters. SECRET"}})});
 let failure;try{await ors.walkingRoute(req);}catch(e){failure=e;}
 expect(failure).toMatchObject({code,status:422,providerCode:2010,routingPoint:{index}});
 expect(failure.message).not.toMatch(/PRIVATE|SECRET/);
 expect(JSON.stringify(failure)).not.toMatch(/PRIVATE|SECRET/);
});
test("provider parameter error is distinct from disconnected network",async()=>{
 fetch.mockResolvedValue({ok:false,status:400,json:async()=>({error:{code:2003,message:"private"}})});
 await expect(ors.walkingRoute(input())).rejects.toMatchObject({code:"ROUTING_REQUEST_INVALID"});
});
