import { renderHook, act, waitFor } from "@testing-library/react-native";
import { AppState, Linking, Platform } from "react-native";
import * as Location from "expo-location";
import useForegroundLocation from "../../src/hooks/useForegroundLocation";
jest.mock("expo-location", () => ({
  Accuracy: { High: 4 },
  hasServicesEnabledAsync: jest.fn(),
  getForegroundPermissionsAsync: jest.fn(),
  requestForegroundPermissionsAsync: jest.fn(),
  watchPositionAsync: jest.fn(),
}));
let receive, remove, change;
beforeEach(() => {
  remove = jest.fn();
  Location.hasServicesEnabledAsync.mockResolvedValue(true);
  Location.getForegroundPermissionsAsync.mockResolvedValue({
    status: "undetermined",
    canAskAgain: true,
  });
  Location.requestForegroundPermissionsAsync.mockResolvedValue({
    status: "granted",
  });
  Location.watchPositionAsync.mockImplementation(async (options, callback) => {
    receive = callback;
    return { remove };
  });
  jest
    .spyOn(AppState, "addEventListener")
    .mockImplementation((event, callback) => {
      change = callback;
      return { remove: jest.fn() };
    });
});
afterEach(() => jest.restoreAllMocks());
test("no startup tracking; granted foreground watcher uses real delivered GPS and stops on blur/unmount", async () => {
  const hook = renderHook(({ enabled }) => useForegroundLocation(enabled), {
    initialProps: { enabled: false },
  });
  expect(Location.requestForegroundPermissionsAsync).not.toHaveBeenCalled();
  hook.rerender({ enabled: true });
  await waitFor(() =>
    expect(Location.watchPositionAsync).toHaveBeenCalledTimes(1),
  );
  act(() =>
    receive({
      coords: { latitude: 7.5, longitude: 80.7, accuracy: 10 },
      timestamp: Date.now(),
    }),
  );
  expect(hook.result.current.position.latitude).toBe(7.5);
  hook.rerender({ enabled: false });
  expect(remove).toHaveBeenCalledTimes(1);
  expect(hook.result.current.position).toBeNull();
  hook.unmount();
});
test("denied permissions show friendly state and never start watcher", async () => {
  Location.requestForegroundPermissionsAsync.mockResolvedValue({
    status: "denied",
  });
  const hook = renderHook(() => useForegroundLocation(true));
  await waitFor(() => expect(hook.result.current.error).toMatch(/permission/));
  expect(hook.result.current.position).toBeNull();
  expect(Location.watchPositionAsync).not.toHaveBeenCalled();
});
test("disabled services do not ask permission or watch", async () => {
  Location.hasServicesEnabledAsync.mockResolvedValue(false);
  const hook = renderHook(() => useForegroundLocation(true));
  await waitFor(() =>
    expect(hook.result.current.errorCode).toBe("SERVICES_DISABLED"),
  );
  expect(Location.watchPositionAsync).not.toHaveBeenCalled();
  expect(Location.requestForegroundPermissionsAsync).not.toHaveBeenCalled();
});
test("background removes watcher and resume starts a fresh subscription", async () => {
  const hook = renderHook(() => useForegroundLocation(true));
  await waitFor(() =>
    expect(Location.watchPositionAsync).toHaveBeenCalledTimes(1),
  );
  act(() => change("background"));
  expect(remove).toHaveBeenCalledTimes(1);
  expect(hook.result.current.active).toBe(false);
  act(() => change("active"));
  await waitFor(() =>
    expect(Location.watchPositionAsync).toHaveBeenCalledTimes(2),
  );
  hook.unmount();
  expect(remove).toHaveBeenCalledTimes(2);
});
test("watcher resolving after navigation exit is removed immediately", async () => {
  let resolve;
  Location.watchPositionAsync.mockImplementation(
    () =>
      new Promise((done) => {
        resolve = done;
      }),
  );
  const hook = renderHook(({ enabled }) => useForegroundLocation(enabled), {
    initialProps: { enabled: true },
  });
  await waitFor(() => expect(resolve).toBeTruthy());
  hook.rerender({ enabled: false });
  await act(async () => resolve({ remove }));
  expect(remove).toHaveBeenCalledTimes(1);
});
test("temporary failure and low/stale accuracy never invent location", async () => {
  const hook = renderHook(() => useForegroundLocation(true));
  await waitFor(() => expect(Location.watchPositionAsync).toHaveBeenCalled());
  act(() =>
    receive({
      coords: { latitude: 7.5, longitude: 80.7, accuracy: 150 },
      timestamp: Date.now(),
    }),
  );
  expect(hook.result.current.position).toBeNull();
  expect(hook.result.current.error).toMatch(/accuracy/);
  act(() =>
    receive({
      coords: { latitude: 7.5, longitude: 80.7, accuracy: 10 },
      timestamp: Date.now() - 60000,
    }),
  );
  expect(hook.result.current.position).toBeNull();
});

test("granted permission waits for a valid real fix without requesting permission again", async () => {
  Location.getForegroundPermissionsAsync.mockResolvedValue({
    status: "granted",
  });
  const hook = renderHook(() => useForegroundLocation(true));
  await waitFor(() =>
    expect(Location.watchPositionAsync).toHaveBeenCalledTimes(1),
  );
  expect(Location.requestForegroundPermissionsAsync).not.toHaveBeenCalled();
  expect(hook.result.current.waiting).toBe(true);
  expect(hook.result.current.position).toBeNull();
  act(() =>
    receive({
      coords: { latitude: 7.5, longitude: 80.7, accuracy: 10 },
      timestamp: Date.now(),
    }),
  );
  expect(hook.result.current.waiting).toBe(false);
  expect(hook.result.current.position.latitude).toBe(7.5);
  hook.unmount();
});
test("permanent denial has settings recovery without repeated permission prompts", async () => {
  Location.getForegroundPermissionsAsync.mockResolvedValue({
    status: "denied",
    canAskAgain: false,
  });
  const open = jest.spyOn(Linking, "openSettings").mockResolvedValue();
  const hook = renderHook(() => useForegroundLocation(true));
  await waitFor(() =>
    expect(hook.result.current.errorCode).toBe("PERMISSION_DENIED"),
  );
  expect(Location.requestForegroundPermissionsAsync).not.toHaveBeenCalled();
  await act(async () => hook.result.current.openSettings());
  expect(open).toHaveBeenCalledTimes(1);
  act(() => hook.result.current.retry());
  await waitFor(() =>
    expect(Location.getForegroundPermissionsAsync).toHaveBeenCalledTimes(2),
  );
  expect(Location.requestForegroundPermissionsAsync).not.toHaveBeenCalled();
  expect(Location.watchPositionAsync).not.toHaveBeenCalled();
  hook.unmount();
});
test("disabled Android services open system Location Settings without enabling services", async () => {
  const previous = Platform.OS;
  Platform.OS = "android";
  const settings = jest.spyOn(Linking, "sendIntent").mockResolvedValue();
  Location.hasServicesEnabledAsync.mockResolvedValue(false);
  try {
    const hook = renderHook(() => useForegroundLocation(true));
    await waitFor(() =>
      expect(hook.result.current.errorCode).toBe("SERVICES_DISABLED"),
    );
    await act(async () => hook.result.current.openSettings());
    expect(settings).toHaveBeenCalledWith(
      "android.settings.LOCATION_SOURCE_SETTINGS",
    );
    expect(Location.requestForegroundPermissionsAsync).not.toHaveBeenCalled();
    hook.unmount();
  } finally {
    Platform.OS = previous;
  }
});

test('[B4-WATCH-01] native subscription rejection shows recovery state and retry establishes new watcher',async()=>{
 Location.watchPositionAsync.mockRejectedValueOnce(new Error('native watcher failed')); const view=renderHook(()=>useForegroundLocation(true)); await waitFor(()=>expect(view.result.current.errorCode).toBe('GPS_UNAVAILABLE'));
 act(()=>view.result.current.retry()); await waitFor(()=>expect(Location.watchPositionAsync).toHaveBeenCalledTimes(2)); const timestamp=Date.now(); act(()=>receive({coords:{latitude:7.51234567,longitude:80.71234567,accuracy:10},timestamp})); expect(view.result.current.position.latitude).toBe(7.51234567); expect(view.result.current.position.timestamp).toBe(timestamp); view.unmount(); expect(remove).toHaveBeenCalledTimes(1);
});
test('[B4-WATCH-02] native watcher error callback clears position without leaking subscription',async()=>{
 const view=renderHook(()=>useForegroundLocation(true)); await waitFor(()=>expect(Location.watchPositionAsync).toHaveBeenCalled()); const failure=Location.watchPositionAsync.mock.calls[0][2]; act(()=>failure(new Error('native private detail'))); expect(view.result.current.position).toBeNull(); expect(view.result.current.error).not.toContain('private'); view.unmount(); expect(remove).toHaveBeenCalledTimes(1);
});
test('[B4-WATCH-03] retry removes old watcher and late old callback cannot update new subscription',async()=>{
 const view=renderHook(()=>useForegroundLocation(true)); await waitFor(()=>expect(Location.watchPositionAsync).toHaveBeenCalled()); const old=receive; act(()=>view.result.current.retry()); await waitFor(()=>expect(Location.watchPositionAsync).toHaveBeenCalledTimes(2)); expect(remove).toHaveBeenCalledTimes(1);
 act(()=>old({coords:{latitude:8,longitude:81,accuracy:10},timestamp:Date.now()})); expect(view.result.current.position).toBeNull(); act(()=>receive({coords:{latitude:7,longitude:80,accuracy:10},timestamp:Date.now()})); expect(view.result.current.position.latitude).toBe(7); view.unmount(); expect(remove).toHaveBeenCalledTimes(2);
});
test('[B4-WATCH-04] missing timestamp and out-of-range coordinates cannot become navigation positions',async()=>{
 const view=renderHook(()=>useForegroundLocation(true)); await waitFor(()=>expect(Location.watchPositionAsync).toHaveBeenCalled());
 for(const fix of [{coords:{latitude:7,longitude:80,accuracy:10}},{coords:{latitude:90.1,longitude:80,accuracy:10},timestamp:Date.now()}]) {act(()=>receive(fix)); expect(view.result.current.position).toBeNull(); expect(view.result.current.errorCode).toBe('GPS_UNAVAILABLE');} view.unmount();
});
test('[B4-WATCH-05] exact fix age and accuracy limits are inclusive, one extra millisecond rejects',async()=>{
 const {NAVIGATION}=require('../../../shared/patrolNavigation'); const now=new Date('2026-01-01T00:00:00Z').getTime(); jest.spyOn(Date,'now').mockReturnValue(now);
 const view=renderHook(()=>useForegroundLocation(true)); await waitFor(()=>expect(Location.watchPositionAsync).toHaveBeenCalled());
 const fix={coords:{latitude:7,longitude:80,accuracy:NAVIGATION.maximumAccuracyMeters},timestamp:now-NAVIGATION.fixMaxAgeMs}; act(()=>receive(fix)); expect(view.result.current.position).toEqual({latitude:7,longitude:80,accuracy:NAVIGATION.maximumAccuracyMeters,timestamp:fix.timestamp});
 act(()=>receive({...fix,timestamp:fix.timestamp-1})); expect(view.result.current.position).toBeNull(); expect(view.result.current.errorCode).toBe('GPS_UNAVAILABLE'); view.unmount();
});
