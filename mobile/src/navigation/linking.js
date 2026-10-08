import { getStateFromPath } from "@react-navigation/native";
import { authenticatedDestination } from "../constants/roles";

export const publicPaths = {
  Onboarding1: "onboarding/1",
  Onboarding2: "onboarding/2",
  Onboarding3: "onboarding/3",
  Welcome: "welcome",
  Login: "login",
  Register: "register",
};
export const rangerPaths = {
  Home: "ranger",
  Patrol: "ranger/patrols",
  PatrolDetails: "ranger/patrols/:patrolId",
  PatrolRoute: "ranger/patrols/:patrolId/route",
  PatrolNavigation: "ranger/patrols/:patrolId/navigation",
  Incident: "ranger/incidents",
  IncidentCreate: "ranger/patrols/:patrolId/incidents/new",
  IncidentReports: "ranger/patrols/:patrolId/incidents",
  IncidentDetails: "ranger/incidents/:incidentId",
  IncidentEdit: "ranger/incidents/:incidentId/edit",
  Alerts: "ranger/alerts",
  Sync: "ranger/sync",
};
const stateFor = (name) => ({ routes: [{ name }] });

// Both existing navigators are the container's root stack, so paths are flat.
export function createLinking({
  user,
  isAuthenticated,
  isDemo,
  hasCompletedOnboarding,
  hasLoggedOut,
}) {
  const destination = isAuthenticated ? authenticatedDestination(user) : null;
  const signedIn = !!destination;
  const ranger = destination === "Home";
  const paths = {
    ...publicPaths,
    ...Object.fromEntries(
      Object.entries(rangerPaths).map(([name, path]) => [
        name,
        isDemo ? `demo/${path}` : path,
      ]),
    ),
    Profile: isDemo ? "demo/account" : "account",
  };
  const config = { screens: paths };
  return {
    prefixes: ["wildguard-lk://"],
    config,
    getStateFromPath(path) {
      const cleanPath = path.split(/[?#]/)[0].replace(/^\/+|\/+$/g, "");
      const fallback = signedIn
        ? destination
        : isDemo
          ? "Home"
          : hasCompletedOnboarding || hasLoggedOut
            ? "Welcome"
            : "Onboarding1";
      if (!cleanPath) return stateFor(fallback);
      const parsed = getStateFromPath(path, config);
      const name =
        parsed?.routes[parsed.index ?? parsed.routes.length - 1]?.name;
      const protectedPath = /^(ranger|account|demo)(\/|$)/.test(cleanPath);
      if (!parsed)
        return stateFor(
          protectedPath && !signedIn && !isDemo ? "Login" : fallback,
        );
      if (Object.hasOwn(publicPaths, name)) {
        if (signedIn || isDemo) return stateFor(fallback);
        // A direct later-onboarding link still has sensible in-app Back behavior.
        if (/^Onboarding[23]$/.test(name)) {
          const page = Number(name.slice(-1));
          return {
            index: page - 1,
            routes: Array.from({ length: page }, (_, index) => ({
              name: `Onboarding${index + 1}`,
            })),
          };
        }
        return parsed;
      }
      if (!signedIn && !isDemo) return stateFor("Login");
      if (Object.hasOwn(rangerPaths, name) && !ranger && !isDemo)
        return stateFor(destination);
      if (ranger && !isDemo && ["Alerts", "Sync"].includes(name))
        return stateFor("Home");
      if (
        isDemo &&
        [
          "PatrolDetails",
          "PatrolRoute",
          "PatrolNavigation",
          "IncidentCreate",
          "IncidentReports",
          "IncidentDetails",
          "IncidentEdit",
        ].includes(name)
      )
        return stateFor("Home");
      if (
        [
          "IncidentCreate",
          "IncidentReports",
          "IncidentDetails",
          "IncidentEdit",
        ].includes(name)
      )
        return {
          index: 1,
          routes: [
            { name: "Incident" },
            parsed.routes[parsed.index ?? parsed.routes.length - 1],
          ],
        };
      if (["PatrolRoute", "PatrolNavigation"].includes(name)) {
        const route = parsed.routes[parsed.index ?? parsed.routes.length - 1];
        return {
          index: 2,
          routes: [
            { name: "Patrol" },
            {
              name: "PatrolDetails",
              params: { patrolId: route.params.patrolId },
            },
            route,
          ],
        };
      }
      if (name === "PatrolDetails")
        return {
          index: 1,
          routes: [
            { name: "Patrol" },
            parsed.routes[parsed.index ?? parsed.routes.length - 1],
          ],
        };
      return parsed;
    },
  };
}
