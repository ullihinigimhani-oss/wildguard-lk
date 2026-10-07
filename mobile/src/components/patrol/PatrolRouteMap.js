import React, {
  useCallback,
  useEffect,
  useMemo,
  useState,
  useRef,
} from "react";
import { ActivityIndicator, Text, View } from "react-native";
import Button from "../common/Button";
import { colors, styles } from "../../constants/theme";
import PatrolMapSurface from "./PatrolMapSurface";
import { buildPlannedMapDocument } from "./plannedMapDocument";

export default function PatrolRouteMap({
  points,
  segments,
  onSelect,
  live = false,
  navigationData,
}) {
  const surface = useRef(null);
  const html = useMemo(
    () => buildPlannedMapDocument(points, segments, live),
    [points, segments, live],
  );
  const [revision, setRevision] = useState(0);
  const [status, setStatus] = useState("loading");
  const [tilesUnavailable, setTilesUnavailable] = useState(false);
  useEffect(() => {
    if (status === "ready" && live)
      surface.current?.updateNavigation(navigationData);
  }, [status, live, navigationData]);
  useEffect(() => {
    setStatus("loading");
    setTilesUnavailable(false);
    const timer = setTimeout(
      () => setStatus((value) => (value === "loading" ? "error" : value)),
      20000,
    );
    return () => clearTimeout(timer);
  }, [html, revision]);
  const onMessage = useCallback(
    (message) => {
      if (message?.type === "map-ready") setStatus("ready");
      else if (message?.type === "map-error") setStatus("error");
      else if (message?.type === "tile-error") setTilesUnavailable(true);
      else if (message?.type === "tiles-ready") setTilesUnavailable(false);
      else if (
        message?.type === "point-selected" &&
        points.some((point) => point.order === message.order)
      )
        onSelect?.(message.order);
    },
    [points, onSelect],
  );
  return (
    <View style={{ gap: 10 }}>
      <View
        style={{
          height: live ? 440 : 360,
          borderRadius: 16,
          overflow: "hidden",
          borderWidth: 1,
          borderColor: colors.border,
          backgroundColor: "#edf3ed",
        }}
      >
        <PatrolMapSurface
          ref={surface}
          key={revision}
          html={html}
          onMessage={onMessage}
          onError={() => setStatus("error")}
        />
        {status === "loading" && (
          <View
            pointerEvents="none"
            style={{
              position: "absolute",
              top: 12,
              left: 60,
              right: 90,
              alignItems: "center",
              backgroundColor: "white",
              borderRadius: 8,
              padding: 8,
              gap: 4,
            }}
          >
            <ActivityIndicator
              color={colors.green}
              accessibilityLabel="Loading route map"
            />
            <Text style={styles.muted}>Loading map…</Text>
          </View>
        )}
      </View>
      {(status === "error" || tilesUnavailable) && (
        <>
          <Text accessibilityRole="alert" style={styles.error}>
            {status === "error"
              ? "Unable to load the map. Check your connection; the saved route list is still available below."
              : "Map tiles are unavailable. Saved waypoints and the route list remain available."}
          </Text>
          <Button
            title="Retry map"
            secondary
            onPress={() => setRevision((value) => value + 1)}
          />
        </>
      )}
    </View>
  );
}
