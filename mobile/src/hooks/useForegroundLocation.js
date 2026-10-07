import { useEffect, useState } from "react";
import { AppState } from "react-native";
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
    setState({ position: null, error: null, waiting: active });
    if (!active) return;
    function failure(message) {
      if (!cancelled)
        setState({ position: null, error: message, waiting: false });
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
      setState({ position, error: null, waiting: false });
    }
    (async () => {
      try {
        if (!(await Location.hasServicesEnabledAsync())) {
          failure(
            "Location services are disabled. Enable them in device settings and retry.",
          );
          return;
        }
        if (cancelled) return;
        const permission = await Location.requestForegroundPermissionsAsync();
        if (cancelled) return;
        if (permission.status !== "granted") {
          failure(
            "Location permission is required for live navigation. Allow it in device settings, then retry.",
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
  return { ...state, active, retry: () => setRevision((value) => value + 1) };
}
