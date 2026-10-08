import React, { useRef, useState } from "react";
import { View } from "react-native";
import * as picker from "expo-image-picker";
import * as documents from "expo-document-picker";
import { Text } from "../common/Typography";
import { LocalEvidencePreview } from "./EvidenceMedia";
import { IncidentButton, Input, ui } from "./IncidentUI";
import {
  prepareEvidenceItem,
  discardEvidenceFile,
} from "../../utils/incidentEvidence";

export default function EvidenceDraft({
  items,
  setItems,
  existing = [],
  existingCount = existing.length,
  disabled,
  onSelecting,
}) {
  const [error, setError] = useState(null),
    [selecting, setSelecting] = useState(false);
  const pending = useRef(false);
  const capacity =
    5 -
    existingCount -
    items.filter((item) => !existing.some((e) => e.id === item.evidenceId))
      .length;
  async function select(mode) {
    if (pending.current || disabled || capacity <= 0) return;
    pending.current = true;
    setSelecting(true);
    onSelecting?.(true);
    setError(null);
    try {
      let result,
        source = "GALLERY_UPLOAD";
      if (mode === "trap") {
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
        const permission =
          mode === "camera"
            ? await picker.requestCameraPermissionsAsync()
            : await picker.requestMediaLibraryPermissionsAsync();
        if (!permission.granted)
          throw new Error(
            "Allow camera/photo access in device Settings, then select again.",
          );
        if (mode === "camera") {
          source = "PHONE_CAMERA";
          result = await picker.launchCameraAsync({
            mediaTypes: ["images"],
            quality: 1,
          });
        } else
          result = await picker.launchImageLibraryAsync({
            mediaTypes: ["images", "videos"],
            allowsMultipleSelection: true,
            selectionLimit: capacity,
            quality: 1,
          });
      }
      if (result.canceled) return;
      if (result.assets.length > capacity)
        throw new Error(
          `Maximum five evidence items. Select at most ${capacity} more.`,
        );
      const selected = [];
      try {
        for (const asset of result.assets)
          selected.push(await prepareEvidenceItem(asset, source));
      } catch (failure) {
        selected.forEach(discardEvidenceFile);
        throw failure;
      }
      setItems((previous) => [...previous, ...selected]);
    } catch (failure) {
      setError(
        failure.message || "Selection unavailable. Please select again.",
      );
    } finally {
      pending.current = false;
      setSelecting(false);
      onSelecting?.(false);
    }
  }
  const update = (key, patch) =>
    setItems((previous) =>
      previous.map((item) =>
        item.uploadKey === key ? { ...item, ...patch } : item,
      ),
    );
  return (
    <View style={ui.card}>
      <Text style={ui.section}>Evidence (optional)</Text>
      <Text style={ui.muted}>
        Up to five items · Photos 10 MB · Videos 50 MB
      </Text>
      {existing.length > 0 && (
        <>
          <Text style={ui.title}>Already uploaded</Text>
          {existing.map((e) => (
            <Text key={e.id} style={ui.muted}>
              {e.originalFileName ||
                e.caption ||
                e.mediaType ||
                "Saved evidence"}{" "}
              · Saved
            </Text>
          ))}
        </>
      )}
      {[
        ["camera", "Take Photo"],
        ["gallery", "Choose from Gallery"],
        ["trap", "Import Camera Trap Evidence"],
      ].map(([mode, title]) => (
        <IncidentButton
          key={mode}
          title={title}
          secondary
          disabled={disabled || selecting || capacity <= 0}
          onPress={() => select(mode)}
        />
      ))}
      {error && (
        <Text accessibilityRole="alert" style={ui.error}>
          {error}
        </Text>
      )}
      {items.map((item) => (
        <View key={item.uploadKey} style={ui.card}>
          <Text style={ui.title} numberOfLines={2} ellipsizeMode="middle">
            {item.name}
          </Text>
          <Text style={ui.muted}>
            {item.video ? "VIDEO" : "PHOTO"} · {item.source.replace(/_/g, " ")}{" "}
            · {(item.size / 1024 / 1024).toFixed(1)} MB
          </Text>
          <LocalEvidencePreview item={item} />
          <Text accessibilityLiveRegion="polite" style={ui.body}>
            {item.status === "uploaded"
              ? "Evidence saved"
              : item.status === "uploading"
                ? `Uploading · ${item.progress ?? "…"}%`
                : "Selected evidence"}
          </Text>
          {item.error && (
            <Text accessibilityRole="alert" style={ui.error}>
              {item.error}
            </Text>
          )}
          {item.status !== "uploaded" && (
            <>
              <Input
                label="Caption (optional)"
                accessibilityLabel={`Caption: ${item.name}`}
                value={item.caption}
                maxLength={500}
                editable={!disabled && item.status !== "failed"}
                onChangeText={(caption) => update(item.uploadKey, { caption })}
              />
              {item.source === "CAMERA_TRAP" && (
                <>
                  <Input
                    label={`Camera trap ID: ${item.name}`}
                    value={item.cameraTrapId}
                    maxLength={128}
                    editable={!disabled && item.status !== "failed"}
                    onChangeText={(cameraTrapId) =>
                      update(item.uploadKey, { cameraTrapId })
                    }
                  />
                  <Input
                    label={`Capture date/time: ${item.name}`}
                    value={item.capturedAt}
                    placeholder="ISO timestamp with timezone (optional)"
                    editable={!disabled && item.status !== "failed"}
                    onChangeText={(capturedAt) =>
                      update(item.uploadKey, { capturedAt })
                    }
                  />
                </>
              )}
              <IncidentButton
                title={item.reselectRequired ? "Remove and reselect" : "Remove"}
                accessibilityLabel={`Remove selection: ${item.name}`}
                secondary
                disabled={disabled || item.cleanupBlocked}
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
    </View>
  );
}
