import React, { useEffect, useRef, useState } from "react";
import { Image, View } from "react-native";
import { useVideoPlayer, VideoView } from "expo-video";
import { useIsFocused } from "@react-navigation/native";
import { Text } from "../common/Typography";
import {
  getEvidenceAccess,
  evidenceError,
} from "../../services/incidentEvidenceApi";
import { IncidentButton, ui } from "./IncidentUI";
function VideoPreview({ uri, onError }) {
  const focused = useIsFocused();
  const player = useVideoPlayer(uri);
  useEffect(() => {
    if (!focused) player.pause();
  }, [focused, player]);
  useEffect(() => {
    const listener = player.addListener("statusChange", (event) => {
      if (event.status === "error") onError?.();
    });
    return () => listener.remove();
  }, [player, onError]);
  return (
    <VideoView
      player={player}
      style={{ width: "100%", height: 210, borderRadius: 12 }}
      nativeControls
      fullscreenOptions={{ enable: true }}
    />
  );
}
export function LocalEvidencePreview({ item }) {
  const [opened, setOpened] = useState(false),
    [failed, setFailed] = useState(false);
  if (failed)
    return (
      <Text style={ui.muted}>
        Preview unavailable on this device. The server will validate the
        original file.
      </Text>
    );
  return item.video ? (
    opened ? (
      <VideoPreview uri={item.uri} onError={() => setFailed(true)} />
    ) : (
      <IncidentButton
        title={`Preview video: ${item.name}`}
        secondary
        onPress={() => setOpened(true)}
      />
    )
  ) : (
    <Image
      source={{ uri: item.uri }}
      accessibilityLabel={`Selected evidence: ${item.name}`}
      style={{ width: "100%", height: 190, borderRadius: 12 }}
      resizeMode="contain"
      onError={() => setFailed(true)}
    />
  );
}
export default function EvidenceMedia({ incidentId, evidence }) {
  const [access, setAccess] = useState(null),
    [busy, setBusy] = useState(false),
    [error, setError] = useState(null);
  const pending = useRef(false),
    mounted = useRef(true),
    focused = useIsFocused();
  const focus = useRef(focused);
  focus.current = focused;
  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);
  useEffect(() => {
    if (!focused) setAccess(null);
  }, [focused]);
  useEffect(() => {
    if (!access) return;
    const timer = setTimeout(
      () => {
        setAccess(null);
        setError("Media access expired. Open the evidence again.");
      },
      Math.max(0, Date.parse(access.expiresAt) - Date.now()),
    );
    return () => clearTimeout(timer);
  }, [access]);
  async function open() {
    if (pending.current) return;
    pending.current = true;
    setBusy(true);
    setError(null);
    try {
      const value = await getEvidenceAccess(incidentId, evidence.id);
      if (mounted.current && focus.current) setAccess(value);
    } catch (failure) {
      if (mounted.current) setError(evidenceError(failure));
    } finally {
      pending.current = false;
      if (mounted.current) setBusy(false);
    }
  }
  function mediaFailed() {
    setAccess(null);
    setError("Private media could not be displayed. Refresh access and retry.");
  }
  if (!evidence.mediaAvailable)
    return (
      <Text style={ui.muted}>
        This historical evidence has no verified private media asset.
      </Text>
    );
  return (
    <View style={{ gap: 10 }}>
      {access &&
        (evidence.fileType === "VIDEO" ? (
          <VideoPreview uri={access.uri} onError={mediaFailed} />
        ) : (
          <Image
            source={{ uri: access.uri }}
            accessibilityLabel="Private incident evidence photo"
            style={{ width: "100%", height: 220, borderRadius: 12 }}
            resizeMode="contain"
            onError={mediaFailed}
          />
        ))}
      {error && (
        <Text accessibilityRole="alert" style={ui.error}>
          {error}
        </Text>
      )}
      <IncidentButton
        title={
          access
            ? "Refresh media access"
            : error
              ? "Retry private media"
              : evidence.fileType === "VIDEO"
                ? "View private video"
                : "View private photo"
        }
        secondary
        loading={busy}
        onPress={open}
      />
      {access && (
        <Text style={ui.muted}>
          Private viewing access expires in five minutes or when your sign-in
          session ends.
        </Text>
      )}
    </View>
  );
}
