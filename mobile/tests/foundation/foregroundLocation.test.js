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
