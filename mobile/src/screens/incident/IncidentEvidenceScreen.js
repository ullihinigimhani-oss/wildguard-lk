import React, { useCallback, useEffect, useRef, useState } from "react";
import { Keyboard, Modal, View } from "react-native";
import { usePreventRemove } from "@react-navigation/native";
import * as picker from "expo-image-picker";
import * as documents from "expo-document-picker";
import Screen from "../../components/common/Screen";
import { Text } from "../../components/common/Typography";
import { useAuth } from "../../hooks/useAuth";
import useIncidentResource from "../../hooks/useIncidentResource";
import { getIncident } from "../../services/incidentApi";
import {
  uploadIncidentEvidence,
  evidenceError,
} from "../../services/incidentEvidenceApi";
import {
  prepareEvidenceItem,
  discardEvidenceFile,
  evidenceLimits,
} from "../../utils/incidentEvidence";
import { canChangeIncident } from "../../utils/incident";
import { LocalEvidencePreview } from "../../components/incident/EvidenceMedia";
import PhotoUploadMode from "../../components/incident/PhotoUploadMode";
import {
  Heading,
  IncidentButton,
  Input,
  State,
  palette,
  ui,
} from "../../components/incident/IncidentUI";

export default function IncidentEvidenceScreen({ route, navigation }) {
  const id = route.params?.incidentId,
    { user } = useAuth();
  const loader = useCallback((signal) => getIncident(id, signal), [id]);
  const state = useIncidentResource(loader);
  const [items, setItems] = useState([]),
    [error, setError] = useState(null),
    [busy, setBusy] = useState(false),
    [selecting, setSelecting] = useState(false),
    [leave, setLeave] = useState(null),
    [allowLeave, setAllowLeave] = useState(false);
  const pending = useRef(false),
    selectionPending = useRef(false),
    mounted = useRef(true);
  const [photoMode, setPhotoMode] = useState("original");
  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);
  const eligible =
    !state.loading && !state.error && canChangeIncident(state.data, user?.id);
  const unsaved = items.some((item) => item.status !== "uploaded");
  usePreventRemove(!allowLeave && (unsaved || busy), ({ data }) => {
    if (!pending.current) {
      Keyboard.dismiss();
      setLeave(data.action);
    }
  });
  useEffect(() => {
    if (allowLeave && leave) navigation.dispatch(leave);
  }, [allowLeave, leave, navigation]);
  const savedCount = Math.max(
    state.data?.evidenceCount || 0,
    (state.data?.evidenceCount || 0) +
      items.filter(
        (item) =>
          item.status === "uploaded" &&
          !state.data?.evidence?.some((e) => e.id === item.evidenceId),
      ).length,
  );
  const capacity =
    evidenceLimits.MAX_ITEMS -
    savedCount -
    items.filter((item) => item.status !== "uploaded").length;
  function update(key, values) {
    setItems((previous) =>
      previous.map((item) =>
        item.uploadKey === key ? { ...item, ...values } : item,
      ),
    );
  }
  async function select(mode) {
    if (
      selectionPending.current ||
      pending.current ||
      !eligible ||
      capacity <= 0
    )
      return;
    selectionPending.current = true;
    setSelecting(true);
    setError(null);
    try {
      let result,
        source = "GALLERY_UPLOAD",
        kind;
      if (mode === "camera") {
        const permission = await picker.requestCameraPermissionsAsync();
        if (!permission.granted)
          throw new Error(
            "Allow camera access in device Settings, then retry Take Photo.",
          );
        source = "PHONE_CAMERA";
        result = await picker.launchCameraAsync({
          mediaTypes: ["images"],
          quality: 1,
        });
      } else if (mode === "trap") {
        source = "CAMERA_TRAP";
        result = await documents.getDocumentAsync({
          type: [
            "image/jpeg",
            "image/png",
            "image/webp",
            "image/heic",
            "video/mp4",
            "video/quicktime",
            "video/webm",
          ],
          multiple: true,
          copyToCacheDirectory: true,
        });
      } else {
        const permission = await picker.requestMediaLibraryPermissionsAsync();
        if (!permission.granted)
          throw new Error(
            "Allow photo/video library access in device Settings, then retry.",
          );
        kind = mode === "video" ? "video" : "image";
        result = await picker.launchImageLibraryAsync({
          mediaTypes: [mode === "video" ? "videos" : "images"],
          allowsMultipleSelection: true,
          selectionLimit: capacity,
          quality: 1,
        });
      }
      if (result.canceled || !mounted.current) return;
      if (result.assets.length > capacity)
        throw new Error(
          `You can select ${capacity} more evidence item(s). Maximum five per incident.`,
        );
      const selected = [];
      try {
        for (const asset of result.assets)
          selected.push(await prepareEvidenceItem(asset, source, kind, undefined, photoMode));
      } catch (failure) {
        selected.forEach(discardEvidenceFile);
        throw failure;
      }
      setItems((previous) => [...previous, ...selected]);
    } catch (failure) {
      if (mounted.current)
        setError(failure.message || "Media selection failed. Retry.");
    } finally {
      selectionPending.current = false;
      if (mounted.current) setSelecting(false);
    }
  }
  async function upload(item) {
    if (pending.current || !eligible) return;
    if (item.source === "CAMERA_TRAP" && !item.cameraTrapId.trim()) {
      setError("Enter the camera trap ID before uploading.");
      return;
    }
    if (
      item.capturedAt &&
      !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{1,3})?(?:Z|[+-]\d{2}:\d{2})$/.test(
        item.capturedAt,
      )
    ) {
      setError(
        "Use an ISO capture date/time including seconds and timezone, or leave it blank.",
      );
      return;
    }
    pending.current = true;
    setBusy(true);
    setError(null);
    update(item.uploadKey, { status: "uploading", error: null });
    try {
      const evidence = await uploadIncidentEvidence(id, item, (progress) => {
        if (mounted.current) update(item.uploadKey, { progress });
      });
      if (mounted.current) {
        update(item.uploadKey, {
          status: "uploaded",
          progress: 100,
          evidenceId: evidence.id,
        });
        state.refresh();
      }
    } catch (failure) {
      if (mounted.current) {
        update(item.uploadKey, {
          status: "failed",
          error: evidenceError(failure),
          cleanupBlocked:
            failure.response?.data?.code === "MEDIA_CLEANUP_FAILED",
          reselectRequired: failure.reselectRequired,
        });
        if ([403, 404, 409].includes(failure.response?.status)) state.refresh();
      }
    } finally {
      pending.current = false;
      if (mounted.current) setBusy(false);
    }
  }
  return (
    <Screen backgroundColor={palette.background}>
      <Heading
        title="Incident Evidence"
        description="Attach private field photos and videos to this saved incident."
      />
      <State {...state} retry={state.refresh} />
      {state.data && (
        <View style={ui.card}>
          <Text style={ui.title}>{state.data.title || "Incident report"}</Text>
          <Text style={ui.muted}>
            {savedCount} / 5 evidence items saved · Photos up to 10 MB · Videos
            up to 50 MB
          </Text>
        </View>
      )}
      {!state.loading && !state.error && !eligible && (
        <Text accessibilityRole="alert" style={ui.error}>
          Evidence uploads are locked. The report must be pending on your active
          patrol.
        </Text>
      )}
      <View style={ui.card}>
        {[
          ["camera", "Take Photo"],
          ["photo", "Choose Photo from Gallery"],
          ["video", "Choose Video from Gallery"],
          ["trap", "Import Camera Trap Photo/Video"],
        ].map(([mode, title]) => (
          <IncidentButton
            key={mode}
            title={title}
            secondary
            disabled={!eligible || busy || selecting || capacity <= 0}
            onPress={() => select(mode)}
          />
        ))}
        <PhotoUploadMode value={photoMode} onChange={setPhotoMode} disabled={!eligible || busy || selecting} />
        <Text style={ui.muted}>
          Camera trap import is manual. Add its actual ID and capture time if
          known; no automatic camera integration is implied.
        </Text>
      </View>
      {error && (
        <Text accessibilityRole="alert" style={ui.error}>
          {error}
        </Text>
      )}
      {items.map((item) => (
        <View key={item.uploadKey} style={ui.card}>
          <Text style={ui.title}>{item.name}</Text>
          <Text style={ui.muted}>
            {item.video ? "VIDEO" : "PHOTO"} ·{" "}
            {(item.size / 1024 / 1024).toFixed(1)} MB ·{" "}
            {item.source.replace(/_/g, " ")}
          </Text>
          <LocalEvidencePreview item={item} />
          <Text accessibilityLiveRegion="polite" style={ui.body}>
            {item.status === "uploaded"
              ? "Evidence saved"
              : item.status === "uploading"
                ? `Uploading securely${item.progress === null ? "…" : ` · ${item.progress}%`}`
                : item.status === "failed"
                  ? "Upload failed — incident retained"
                  : "Selected · not uploaded"}
          </Text>
          {item.status !== "uploaded" && (
            <>
              <Input
                label={`Caption: ${item.name}`}
                value={item.caption}
                maxLength={500}
                editable={!busy && eligible && item.status !== "failed"}
                onChangeText={(value) =>
                  update(item.uploadKey, { caption: value })
                }
              />
              {item.source === "CAMERA_TRAP" && (
                <>
                  <Input
                    label={`Camera trap ID: ${item.name}`}
                    value={item.cameraTrapId}
                    maxLength={128}
                    editable={!busy && eligible && item.status !== "failed"}
                    onChangeText={(value) =>
                      update(item.uploadKey, { cameraTrapId: value })
                    }
                  />
                  <Input
                    label={`Capture date/time: ${item.name}`}
                    placeholder="2026-10-08T10:30:00+05:30 (optional)"
                    value={item.capturedAt}
                    editable={!busy && eligible && item.status !== "failed"}
                    onChangeText={(value) =>
                      update(item.uploadKey, { capturedAt: value })
                    }
                  />
                  <Input
                    label={`Camera trap notes: ${item.name}`}
                    value={item.notes}
                    maxLength={1000}
                    editable={!busy && eligible && item.status !== "failed"}
                    onChangeText={(value) =>
                      update(item.uploadKey, { notes: value })
                    }
                  />
                </>
              )}
              {item.error && (
                <Text accessibilityRole="alert" style={ui.error}>
                  {item.error}
                </Text>
              )}
              {item.status === "failed" &&
                !item.cleanupBlocked &&
                !item.reselectRequired && (
                  <IncidentButton
                    title={`Edit upload details: ${item.name}`}
                    secondary
                    disabled={busy || !eligible}
                    onPress={() =>
                      update(item.uploadKey, {
                        status: "selected",
                        error: null,
                        uploadKey: `${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}-${Math.random().toString(36).slice(2)}`,
                      })
                    }
                  />
                )}
              <IncidentButton
                title={
                  item.status === "failed"
                    ? `Retry Upload: ${item.name}`
                    : `Upload Evidence: ${item.name}`
                }
                loading={item.status === "uploading"}
                disabled={
                  busy ||
                  !eligible ||
                  item.cleanupBlocked ||
                  item.reselectRequired
                }
                onPress={() => upload(item)}
              />
              <IncidentButton
                title={
                  item.reselectRequired
                    ? "Remove and reselect"
                    : `Remove selection: ${item.name}`
                }
                accessibilityLabel={`Remove selection: ${item.name}`}
                secondary
                disabled={busy}
                onPress={() => {
                  discardEvidenceFile(item);
                  setItems((previous) =>
                    previous.filter(
                      (value) => value.uploadKey !== item.uploadKey,
                    ),
                  );
                }}
              />
            </>
          )}
        </View>
      ))}
      <Modal
        visible={!!leave}
        transparent
        animationType="fade"
        onRequestClose={() => setLeave(null)}
      >
        <View
          style={{
            flex: 1,
            padding: 24,
            justifyContent: "center",
            backgroundColor: "rgba(16,59,46,.4)",
          }}
        >
          <View accessibilityViewIsModal style={ui.card}>
            <Text style={ui.section}>Discard selected evidence?</Text>
            <Text style={ui.body}>
              Unuploaded files will be discarded. Saved evidence and the
              incident remain in the system.
            </Text>
            <IncidentButton
              title="Keep Evidence"
              onPress={() => setLeave(null)}
            />
            <IncidentButton
              title="Discard Selection"
              color={palette.danger}
              secondary
              onPress={() => {
                items.forEach(discardEvidenceFile);
                setAllowLeave(true);
              }}
            />
          </View>
        </View>
      </Modal>
      <IncidentButton
        title="View Incident"
        secondary
        disabled={busy || selecting}
        onPress={() =>
          navigation.navigate("IncidentDetails", { incidentId: id })
        }
      />
    </Screen>
  );
}
