import { useEffect, useState } from "react";
import { AppState, Linking, Platform } from "react-native";
import * as Location from "expo-location";
import { NAVIGATION, validCoordinate } from "../../../shared/patrolNavigation";

export default function useForegroundLocation(enabled) {
  const [appActive, setAppActive] = useState(
    AppState.currentState !== "background" &&
      AppState.currentState !== "inactive",
  );
  const [revision, setRevision] = useState(0);
  const [state, setState] = useState({
    position: null,
    error: null,
    waiting: true,
    errorCode: null,
    canOpenSettings: false,
  });
  useEffect(() => {
    const listener = AppState.addEventListener("change", (value) =>
      setAppActive(value === "active"),
    );
    return () => listener.remove();
  }, []);
  const active = enabled && appActive;
  useEffect(() => {
    let cancelled = false,
      subscription,
      staleTimer;
    setState({
      position: null,
      error: null,
      waiting: active,
      errorCode: null,
      canOpenSettings: false,
    });
    if (!active) return;
    function failure(
      message,
      errorCode = "GPS_UNAVAILABLE",
      canOpenSettings = false,
    ) {
      if (!cancelled)
        setState({
          position: null,
          error: message,
          waiting: false,
          errorCode,
          canOpenSettings,
        });
    }
    function receive(fix) {
      if (cancelled) return;
      const position = {
        latitude: fix?.coords?.latitude,
        longitude: fix?.coords?.longitude,
        accuracy: fix?.coords?.accuracy,
        timestamp: fix?.timestamp,
      };
      if (
        !validCoordinate(position) ||
        !Number.isFinite(position.timestamp) ||
        Math.abs(Date.now() - position.timestamp) > NAVIGATION.fixMaxAgeMs ||
        !Number.isFinite(position.accuracy) ||
        position.accuracy < 0 ||
        position.accuracy > NAVIGATION.maximumAccuracyMeters
      ) {
        failure("GPS accuracy is low. Move to an open area and retry.");
        return;
      }
      clearTimeout(staleTimer);
      staleTimer = setTimeout(
        () =>
          failure(
            "GPS signal is temporarily unavailable. Move to an open area or retry.",
          ),
        NAVIGATION.fixMaxAgeMs,
      );
      setState({
        position,
        error: null,
        waiting: false,
        errorCode: null,
        canOpenSettings: false,
      });
    }
    (async () => {
      try {
        if (!(await Location.hasServicesEnabledAsync())) {
          failure(
            "Location Services are turned off. Enable Location Services to use live patrol navigation.",
            "SERVICES_DISABLED",
            Platform.OS !== "web",
          );
          return;
        }
        if (cancelled) return;
        let permission = await Location.getForegroundPermissionsAsync();
        if (cancelled) return;
        if (permission.status !== "granted" && permission.canAskAgain !== false)
          permission = await Location.requestForegroundPermissionsAsync();
        if (cancelled) return;
        if (permission.status !== "granted") {
          failure(
            "Location permission is required for live patrol navigation.",
            "PERMISSION_DENIED",
            Platform.OS !== "web",
          );
          return;
        }
        staleTimer = setTimeout(
          () =>
            failure(
              "Waiting for a usable GPS signal. Move to an open area or retry.",
            ),
          NAVIGATION.fixMaxAgeMs,
        );
        const watcher = await Location.watchPositionAsync(
          {
            accuracy: Location.Accuracy.High,
            timeInterval: NAVIGATION.watchIntervalMs,
            distanceInterval: NAVIGATION.watchDistanceMeters,
          },
          receive,
          () => failure("Device GPS is temporarily unavailable. Please retry."),
        );
        if (cancelled) watcher.remove();
        else subscription = watcher;
      } catch {
        failure(
          "Device location is unavailable. Check permissions and location services, then retry.",
        );
      }
    })();
    return () => {
      cancelled = true;
      clearTimeout(staleTimer);
      subscription?.remove();
    };
  }, [active, revision]);
  async function openSettings() {
    try {
      if (Platform.OS === "android" && state.errorCode === "SERVICES_DISABLED")
        await Linking.sendIntent("android.settings.LOCATION_SOURCE_SETTINGS");
      else await Linking.openSettings();
    } catch {
      setState((value) => ({
        ...value,
        error:
          "Unable to open Settings. Open your device Settings, enable location access, then retry.",
      }));
    }
  }
  return {
    ...state,
    active,
    openSettings,
    retry: () => setRevision((value) => value + 1),
  };
}
