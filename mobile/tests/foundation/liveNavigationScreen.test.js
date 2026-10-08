import { useOffline } from "../../src/hooks/useOffline";
import useOfflinePatrolMap from "../../src/hooks/useOfflinePatrolMap";
jest.mock("../../src/hooks/useOffline",()=>({useOffline:jest.fn()}));
jest.mock("../../src/hooks/useOfflinePatrolMap",()=>jest.fn());
let mockOnlinePayload, mockOfflinePayload;
jest.mock("../../src/components/patrol/OfflinePatrolMap",()=>props=>{mockOfflinePayload=props.navigationData;return require('react').createElement(require('react-native').Text,null,'Offline Patrol View — No Basemap');});
import React from "react";
import { render, fireEvent, waitFor } from "@testing-library/react-native";
import LivePatrolNavigationScreen from "../../src/screens/patrol/LivePatrolNavigationScreen";
import useAssignedPatrol from "../../src/hooks/useAssignedPatrol";
import useForegroundLocation from "../../src/hooks/useForegroundLocation";
import useLiveNavigation from "../../src/hooks/useLiveNavigation";
import { completeMyPatrol } from "../../src/services/patrolApi";
jest.mock("@react-navigation/native", () => ({ useIsFocused: () => true }));
jest.mock("../../src/hooks/useAuth", () => ({
  useAuth: () => ({ user: { id: "a" } }),
}));
jest.mock("../../src/hooks/useAssignedPatrol", () => jest.fn());
jest.mock("../../src/hooks/useForegroundLocation", () => jest.fn());
jest.mock("../../src/hooks/useLiveNavigation", () => jest.fn());
jest.mock("../../src/hooks/useFullPatrolRoute", () => () => ({
  route: null,
  loading: false,
  error: null,
}));
jest.mock("../../src/services/patrolApi", () => ({
  completeMyPatrol: jest.fn(),
}));
jest.mock("../../src/components/patrol/PatrolRouteMap", () => props => { mockOnlinePayload=props.navigationData; return require("react").createElement(require("react-native").Text,null,"Online Leaflet map"); });
const patrol = {
  id: "p",
  routeName: "Boundary walk",
  status: "IN_PROGRESS",
  actualStartTime: "session",
  plannedRoute: ["START", "CHECKPOINT", "HIGH_RISK", "OBSERVATION", "END"].map(
    (type, order) => ({
      id: String(order),
      type,
      order,
      latitude: 7.5 + order / 1000,
      longitude: 80.7,
    }),
  ),
};
beforeEach(() => {
  useOffline.mockReturnValue(null);
  useOfflinePatrolMap.mockReturnValue({snapshot:null,error:null});
  mockOnlinePayload=null;mockOfflinePayload=null;
  useAssignedPatrol.mockReturnValue({
    patrol,
    loading: false,
    error: null,
    refresh: jest.fn(),
  });
  useForegroundLocation.mockReturnValue({
    position: null,
    active: true,
    retry: jest.fn(),
  });
  useLiveNavigation.mockReturnValue({
    destinations: [],
    reached: new Set(),
    trail: [],
    complete: false,
  });
  completeMyPatrol.mockResolvedValue({ ...patrol, status: "COMPLETED" });
});
test("END arrival waits for explicit confirmation and stops location after completion", async () => {
  useLiveNavigation.mockReturnValue({
    destinations: [],
    reached: new Set(),
    trail: [],
    complete: true,
  });
  const navigation = { replace: jest.fn(), navigate: jest.fn() };
  const ui = render(
    <LivePatrolNavigationScreen
      route={{ params: { patrolId: "p" } }}
      navigation={navigation}
    />,
  );
  expect(ui.getByText("Patrol route completed.")).toBeTruthy();
  expect(completeMyPatrol).not.toHaveBeenCalled();
  fireEvent.press(ui.getByLabelText("Complete Patrol"));
  expect(completeMyPatrol).not.toHaveBeenCalled();
  fireEvent.press(ui.getByLabelText("Confirm Completion"));
  await waitFor(() =>
    expect(navigation.replace).toHaveBeenCalledWith("PatrolDetails", {
      patrolId: "p",
    }),
  );
  expect(useForegroundLocation).toHaveBeenLastCalledWith(false);
});
test("pre-start planned route never enables device GPS", () => {
  useAssignedPatrol.mockReturnValue({
    patrol: { ...patrol, status: "SCHEDULED" },
    loading: false,
    refresh: jest.fn(),
  });
  const ui = render(
    <LivePatrolNavigationScreen
      route={{ params: { patrolId: "p" } }}
      navigation={{ navigate: jest.fn() }}
    />,
  );
  expect(useForegroundLocation).toHaveBeenLastCalledWith(false);
  expect(ui.getByText(/Live navigation is available only/)).toBeTruthy();
});
test("compact avoidance status and caution appear without a safe-route claim", () => {
  useLiveNavigation.mockReturnValue({
    destinations: [],
    reached: new Set(),
    trail: [],
    complete: false,
    riskReady: true,
    riskZones: [{ id: "zone" }],
    route: { riskAvoidance: { applied: true, zoneCount: 2 } },
    summary: { distanceMeters: 1800, durationSeconds: 1440 },
  });
  const ui = render(
    <LivePatrolNavigationScreen
      route={{ params: { patrolId: "p" } }}
      navigation={{ navigate: jest.fn() }}
    />,
  );
  expect(ui.getByText("Route avoiding 2 known risk zones")).toBeTruthy();
  expect(ui.getByText(/1.8 km/)).toBeTruthy();
  expect(ui.getByText(/24/)).toBeTruthy();
  expect(ui.queryByText(/safe route/i)).toBeNull();
});
test("Ranger and destination inside warnings are separate and remain visible with no route", () => {
  useLiveNavigation.mockReturnValue({
    destinations: [],
    reached: new Set(),
    trail: [],
    complete: false,
    riskReady: true,
    riskZones: [],
    rangerInsideZone: true,
    destinationInsideZone: true,
  });
  const ui = render(
    <LivePatrolNavigationScreen
      route={{ params: { patrolId: "p" } }}
      navigation={{ navigate: jest.fn() }}
    />,
  );
  expect(ui.getByText(/You are currently inside/)).toBeTruthy();
  expect(ui.getByText(/Next patrol point is inside/)).toBeTruthy();
  expect(completeMyPatrol).not.toHaveBeenCalled();
});

test("Locating state and denied permission recovery are clearly labelled", () => {
  useForegroundLocation.mockReturnValue({
    position: null,
    active: true,
    waiting: true,
  });
  const ui = render(
    <LivePatrolNavigationScreen
      route={{ params: { patrolId: "p" } }}
      navigation={{ navigate: jest.fn() }}
    />,
  );
  expect(ui.getByText("Locating you...")).toBeTruthy();
  expect(
    ui.getByText("Getting your current position for patrol navigation."),
  ).toBeTruthy();
  const retry = jest.fn(),
    openSettings = jest.fn();
  useForegroundLocation.mockReturnValue({
    position: null,
    active: true,
    waiting: false,
    error: "Location permission is required for live patrol navigation.",
    errorCode: "PERMISSION_DENIED",
    canOpenSettings: true,
    retry,
    openSettings,
  });
  ui.rerender(
    <LivePatrolNavigationScreen
      route={{ params: { patrolId: "p" } }}
      navigation={{ navigate: jest.fn() }}
    />,
  );
  expect(ui.queryByText("Locating you...")).toBeNull();
  fireEvent.press(ui.getByLabelText("Retry"));
  fireEvent.press(ui.getByLabelText("Open Settings"));
  expect(retry).toHaveBeenCalledTimes(1);
  expect(openSettings).toHaveBeenCalledTimes(1);
});

test("incident entry pushes current patrol context without replacing navigation or completing patrol", () => {
  const navigation = { navigate: jest.fn(), replace: jest.fn() };
  const ui = render(
    <LivePatrolNavigationScreen
      route={{ params: { patrolId: "p" } }}
      navigation={navigation}
    />,
  );
  fireEvent.press(ui.getByLabelText("Report Incident"));
  expect(navigation.navigate).toHaveBeenCalledWith("IncidentCreate", {
    patrolId: "p",
  });
  expect(navigation.replace).not.toHaveBeenCalled();
  expect(completeMyPatrol).not.toHaveBeenCalled();
});


test("online/offline/reconnect swaps views without retaining blue directions or changing GPS activation",()=>{
  const blue={geometry:{type:'LineString',coordinates:[[80,7],[80.01,7.01]]}};
  const green={geometry:{type:'LineString',coordinates:[[80,7],[80.02,7.02]]}};
  const trail=[{latitude:7,longitude:80},{latitude:7.001,longitude:80.001}];
  useLiveNavigation.mockReturnValue({route:blue,destinations:[],reached:new Set(),trail});
  useForegroundLocation.mockReturnValue({active:true,position:{latitude:7,longitude:80},retry:jest.fn()});
  const props={route:{params:{patrolId:'p'}},navigation:{navigate:jest.fn()}};
  const ui=render(<LivePatrolNavigationScreen {...props}/>);
  expect(ui.getByText('Online Leaflet map')).toBeTruthy();
  expect(mockOnlinePayload.geometry).toEqual(blue.geometry);
  useOffline.mockReturnValue({owner:'a',online:false});
  useOfflinePatrolMap.mockReturnValue({snapshot:{route:green,zones:[],warning:'Cached hazards may have changed.'}});
  ui.rerender(<LivePatrolNavigationScreen {...props}/>);
  expect(ui.queryByText('Online Leaflet map')).toBeNull();
  expect(ui.getByText('Offline Patrol View — No Basemap')).toBeTruthy();
  expect(mockOfflinePayload.geometry).toBeNull();
  expect(mockOfflinePayload.fullRoute).toBe(green);
  expect(mockOfflinePayload.trail).toEqual(trail);
  expect(mockOfflinePayload.currentLocation).toEqual({latitude:7,longitude:80});
  expect(ui.getByText('Cached hazards may have changed.')).toBeTruthy();
  expect(ui.queryByLabelText('Download Offline Map')).toBeNull();
  expect(ui.queryByText(/provider is not configured/)).toBeNull();
  useOffline.mockReturnValue({owner:'a',online:true});
  ui.rerender(<LivePatrolNavigationScreen {...props}/>);
  expect(ui.queryByText('Offline Patrol View — No Basemap')).toBeNull();
  expect(ui.getByText('Online Leaflet map')).toBeTruthy();
  expect(mockOnlinePayload.geometry).toEqual(blue.geometry);
  expect(mockOnlinePayload.trail).toEqual(trail);
  expect(useForegroundLocation.mock.calls.every(([active])=>active===true)).toBe(true);
});
test.each(['No matching route','Patrol waypoints changed'])('missing/stale green remains unavailable: %s',warning=>{
  useOffline.mockReturnValue({owner:'a',online:false});
  useOfflinePatrolMap.mockReturnValue({snapshot:{route:null,zones:[],warning}});
  const ui=render(<LivePatrolNavigationScreen route={{params:{patrolId:'p'}}} navigation={{navigate:jest.fn()}}/>);
  expect(mockOfflinePayload.fullRoute).toBeNull();
  expect(ui.getByText(/No matching verified planned route is cached/)).toBeTruthy();
  expect(ui.getByText(warning)).toBeTruthy();
});
