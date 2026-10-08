import { getPathFromState } from "@react-navigation/native";
import {
  createLinking,
  publicPaths,
  rangerPaths,
} from "../../src/navigation/linking";
const publicLinking = createLinking({});
const selected = (state) =>
  state.routes[state.index ?? state.routes.length - 1].name;
test.each(Object.entries(publicPaths))(
  "direct %s links round-trip to /%s",
  (name, path) => {
    const state = publicLinking.getStateFromPath("/" + path);
    expect(selected(state)).toBe(name);
    expect(getPathFromState(state, publicLinking.config)).toBe("/" + path);
  },
);
test("root and invalid paths preserve startup", () => {
  expect(selected(publicLinking.getStateFromPath("/"))).toBe("Onboarding1");
  expect(selected(publicLinking.getStateFromPath("/does-not-exist"))).toBe(
    "Onboarding1",
  );
});
test.each([...Object.values(rangerPaths), "account", "demo/ranger"])(
  "signed-out /%s goes to common login",
  (path) => {
    expect(selected(publicLinking.getStateFromPath("/" + path))).toBe("Login");
  },
);
test.each([
  "COMMUNITY_USER",
  "PARK_MANAGER",
  "COMMUNITY_LIAISON",
  "RESEARCHER",
])("%s cannot enter ranger URLs", (role) => {
  const linking = createLinking({
    user: { id: "u1", role },
    isAuthenticated: true,
  });
  Object.values(rangerPaths).forEach((path) =>
    expect(selected(linking.getStateFromPath("/" + path))).toBe("Profile"),
  );
  expect(selected(linking.getStateFromPath("/"))).toBe("Profile");
  expect(
    getPathFromState(linking.getStateFromPath("/account"), linking.config),
  ).toBe("/account");
});
test.each(
  Object.entries(rangerPaths).filter(
    ([name]) =>
      ![
        "Alerts",
        "Sync",
        "PatrolDetails",
        "PatrolRoute",
        "PatrolNavigation",
      ].includes(name),
  ),
)("verified ranger can load %s at /%s", (name, path) => {
  const linking = createLinking({
    user: { id: "u1", role: "RANGER" },
    isAuthenticated: true,
  });
  const state = linking.getStateFromPath("/" + path);
  expect(selected(state)).toBe(name);
  expect(getPathFromState(state, linking.config)).toBe("/" + path);
});
test("patrol detail links preserve a contextual Back destination and patrol ID", () => {
  const linking = createLinking({
    user: { id: "u1", role: "RANGER" },
    isAuthenticated: true,
  });
  const state = linking.getStateFromPath("/ranger/patrols/assigned-record");
  expect(state.routes.map((route) => route.name)).toEqual([
    "Patrol",
    "PatrolDetails",
  ]);
  expect(state.routes[1].params.patrolId).toBe("assigned-record");
});
test.each(["ranger/alerts", "ranger/sync"])(
  "removed prototype route /%s returns to Dashboard",
  (path) => {
    const linking = createLinking({
      user: { id: "u1", role: "RANGER" },
      isAuthenticated: true,
    });
    expect(selected(linking.getStateFromPath("/" + path))).toBe("Home");
  },
);
test("demo links stay separate and never authenticate a user", () => {
  const linking = createLinking({ isDemo: true });
  expect(
    getPathFromState(linking.getStateFromPath("/demo/ranger"), linking.config),
  ).toBe("/demo/ranger");
});
test("route links preserve My Patrol and Details back destinations", () => {
  const linking = createLinking({
    user: { id: "u1", role: "RANGER" },
    isAuthenticated: true,
  });
  const state = linking.getStateFromPath(
    "/ranger/patrols/assigned-record/route",
  );
  expect(state.routes.map((route) => route.name)).toEqual([
    "Patrol",
    "PatrolDetails",
    "PatrolRoute",
  ]);
  expect(state.routes[1].params.patrolId).toBe("assigned-record");
  expect(state.routes[2].params.patrolId).toBe("assigned-record");
});
test("demo cannot open an authenticated planned route", () => {
  expect(
    selected(
      createLinking({ isDemo: true }).getStateFromPath(
        "/demo/ranger/patrols/assigned-record/route",
      ),
    ),
  ).toBe("Home");
});
test("live navigation deep links preserve contextual back and reject demo", () => {
  const linking = createLinking({
    user: { id: "a", role: "RANGER" },
    isAuthenticated: true,
  });
  expect(
    linking
      .getStateFromPath("/ranger/patrols/p/navigation")
      .routes.map((route) => route.name),
  ).toEqual(["Patrol", "PatrolDetails", "PatrolNavigation"]);
  expect(
    selected(
      createLinking({ isDemo: true }).getStateFromPath(
        "/demo/ranger/patrols/p/navigation",
      ),
    ),
  ).toBe("Home");
});

test.each([
  ["ranger/patrols/p/incidents/new", "IncidentCreate", "patrolId", "p"],
  ["ranger/patrols/p/incidents", "IncidentReports", "patrolId", "p"],
  ["ranger/incidents/i", "IncidentDetails", "incidentId", "i"],
  ["ranger/incidents/i/edit", "IncidentEdit", "incidentId", "i"],
])(
  "incident link %s preserves tab back destination and excludes demo",
  (path, name, key, id) => {
    const linking = createLinking({
      user: { id: "a", role: "RANGER" },
      isAuthenticated: true,
    });
    const state = linking.getStateFromPath(path);
    expect(state.routes.map((r) => r.name)).toEqual(["Incident", name]);
    expect(state.routes[1].params[key]).toBe(id);
    expect(
      selected(
        createLinking({ isDemo: true }).getStateFromPath("demo/" + path),
      ),
    ).toBe("Home");
  },
);
