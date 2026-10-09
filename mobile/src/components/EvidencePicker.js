import React, { useState } from "react";
import {
  ActivityIndicator,
  Image,
  Platform,
  Pressable,
  ScrollView,
  Text,
  View,
} from "react-native";
import * as ImagePicker from "expo-image-picker";
import Ionicons from "@expo/vector-icons/Ionicons";
import { colors, styles } from "../constants/theme";

const MAX_IMAGE_BYTES = 10 * 1024 * 1024; // 10MB
const MAX_VIDEO_BYTES = 25 * 1024 * 1024; // 25MB

export default function EvidencePicker({
  evidence = [],
  onChange,
  disabled = false,
  maxItems = 5,
}) {
  const [error, setError] = useState("");
  const [processing, setProcessing] = useState(false);

  async function checkPermission(type) {
    if (Platform.OS === "web") return true;

    if (type === "camera") {
      const { status } = await ImagePicker.requestCameraPermissionsAsync();
      if (status !== "granted") {
        setError("Camera permission is required to capture photos and videos.");
        return false;
      }
    } else {
      const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (status !== "granted") {
        setError("Photo/media library permission is required to attach evidence.");
        return false;
      }
    }
    return true;
  }

  async function pickMedia(sourceType) {
    setError("");
    if (evidence.length >= maxItems) {
      setError(`You can attach up to ${maxItems} evidence items.`);
      return;
    }

    const hasPermission = await checkPermission(sourceType);
    if (!hasPermission) return;

    setProcessing(true);
    try {
      let result;
      if (sourceType === "camera") {
        result = await ImagePicker.launchCameraAsync({
          mediaTypes: ["images", "videos"],
          allowsEditing: true,
          quality: 0.8,
          base64: true,
        });
      } else if (sourceType === "video") {
        result = await ImagePicker.launchImageLibraryAsync({
          mediaTypes: ["videos"],
          allowsEditing: true,
          quality: 0.8,
        });
      } else {
        result = await ImagePicker.launchImageLibraryAsync({
          mediaTypes: ["images"],
          allowsEditing: true,
          quality: 0.8,
          base64: true,
        });
      }

      if (!result.canceled && result.assets?.[0]?.uri) {
        const asset = result.assets[0];

        // Detect empty / zero-byte corrupted files if fileSize is reported
        if (asset.fileSize !== undefined && asset.fileSize <= 0) {
          setError("The selected file is empty or corrupted. Please select a valid file.");
          return;
        }

        const uriLower = (asset.uri || "").toLowerCase();
        const isVideo =
          asset.type === "video" ||
          uriLower.endsWith(".mp4") ||
          uriLower.endsWith(".mov") ||
          uriLower.endsWith(".webm") ||
          sourceType === "video";

        const isImage =
          asset.type === "image" ||
          uriLower.endsWith(".jpg") ||
          uriLower.endsWith(".jpeg") ||
          uriLower.endsWith(".png") ||
          uriLower.endsWith(".webp") ||
          uriLower.endsWith(".heic") ||
          sourceType === "photo" ||
          (!isVideo && sourceType === "camera");

        if (!isVideo && !isImage) {
          setError("Unsupported file format. Supported formats: JPEG, PNG, WEBP, HEIC, MP4, MOV, WEBM.");
          return;
        }

        let fileType = asset.mimeType || "image/jpeg";
        if (isVideo) {
          if (uriLower.endsWith(".mov")) fileType = "video/quicktime";
          else if (uriLower.endsWith(".webm")) fileType = "video/webm";
          else fileType = "video/mp4";
        } else {
          if (asset.mimeType) fileType = asset.mimeType;
          else if (uriLower.endsWith(".png")) fileType = "image/png";
          else if (uriLower.endsWith(".webp")) fileType = "image/webp";
          else if (uriLower.endsWith(".heic")) fileType = "image/heic";
          else fileType = "image/jpeg";
        }

        const maxLimit = isVideo ? MAX_VIDEO_BYTES : MAX_IMAGE_BYTES;
        const limitMb = isVideo ? 25 : 10;

        if (asset.fileSize && asset.fileSize > maxLimit) {
          setError(`File exceeds the ${limitMb}MB limit for ${isVideo ? "videos" : "photos"}.`);
          return;
        }

        let base64 = asset.base64 || null;
        if (!base64 && asset.uri && !isVideo) {
          try {
            const FileSystem = require("expo-file-system");
            if (FileSystem?.readAsStringAsync) {
              base64 = await FileSystem.readAsStringAsync(asset.uri, {
                encoding: FileSystem.EncodingType?.Base64 || "base64",
              });
            }
          } catch (_) {
            try {
              if (typeof fetch === "function") {
                const resp = await fetch(asset.uri);
                const blob = await resp.blob();
                base64 = await new Promise((resolve) => {
                  const reader = new FileReader();
                  reader.onloadend = () => {
                    const res = reader.result;
                    if (typeof res === "string") {
                      resolve(res.replace(/^data:[a-zA-Z0-9/+-]+;base64,/, ""));
                    } else {
                      resolve(null);
                    }
                  };
                  reader.onerror = () => resolve(null);
                  reader.readAsDataURL(blob);
                });
              }
            } catch (_) {}
          }
        }

        const newEvidenceItem = {
          fileUrl: asset.uri,
          fileType,
          fileName: asset.fileName || `evidence-${Date.now()}.${isVideo ? "mp4" : "jpg"}`,
          isVideo,
          base64: base64 || null,
          fileSize: asset.fileSize || null,
        };

        onChange([...evidence, newEvidenceItem]);
      }
    } catch {
      setError("Unable to capture or select media. Please try again.");
    } finally {
      setProcessing(false);
    }
  }

  function removeEvidence(index) {
    const updated = evidence.filter((_, i) => i !== index);
    onChange(updated);
  }

  return (
    <View style={{ gap: 8 }}>
      <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}>
        <Text style={styles.label}>
          Photo / Video Evidence ({evidence.length}/{maxItems})
        </Text>
        <Text style={styles.muted}>Optional</Text>
      </View>

      {/* Media Source Buttons */}
      <View style={{ flexDirection: "row", gap: 8 }}>
        {/* Camera */}
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Take photo or video with camera"
          disabled={disabled || processing || evidence.length >= maxItems}
          onPress={() => pickMedia("camera")}
          style={({ pressed }) => ({
            flex: 1,
            flexDirection: "row",
            alignItems: "center",
            justifyContent: "center",
            gap: 6,
            minHeight: 42,
            padding: 8,
            borderRadius: 10,
            borderWidth: 1,
            borderColor: colors.border,
            backgroundColor: colors.white,
            opacity: pressed || disabled || processing || evidence.length >= maxItems ? 0.6 : 1,
          })}
        >
          <Ionicons name="camera-outline" size={18} color={colors.green} />
          <Text style={{ fontSize: 13, fontWeight: "600", color: colors.text }}>Camera</Text>
        </Pressable>

        {/* Photo Gallery */}
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Choose photo from gallery"
          disabled={disabled || processing || evidence.length >= maxItems}
          onPress={() => pickMedia("photo")}
          style={({ pressed }) => ({
            flex: 1,
            flexDirection: "row",
            alignItems: "center",
            justifyContent: "center",
            gap: 6,
            minHeight: 42,
            padding: 8,
            borderRadius: 10,
            borderWidth: 1,
            borderColor: colors.border,
            backgroundColor: colors.white,
            opacity: pressed || disabled || processing || evidence.length >= maxItems ? 0.6 : 1,
          })}
        >
          <Ionicons name="images-outline" size={18} color={colors.green} />
          <Text style={{ fontSize: 13, fontWeight: "600", color: colors.text }}>Photo</Text>
        </Pressable>

        {/* Video Gallery */}
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Choose video from gallery"
          disabled={disabled || processing || evidence.length >= maxItems}
          onPress={() => pickMedia("video")}
          style={({ pressed }) => ({
            flex: 1,
            flexDirection: "row",
            alignItems: "center",
            justifyContent: "center",
            gap: 6,
            minHeight: 42,
            padding: 8,
            borderRadius: 10,
            borderWidth: 1,
            borderColor: colors.border,
            backgroundColor: colors.white,
            opacity: pressed || disabled || processing || evidence.length >= maxItems ? 0.6 : 1,
          })}
        >
          <Ionicons name="videocam-outline" size={18} color={colors.green} />
          <Text style={{ fontSize: 13, fontWeight: "600", color: colors.text }}>Video</Text>
        </Pressable>
      </View>

      {/* Processing Spinner */}
      {processing && (
        <View style={{ flexDirection: "row", alignItems: "center", gap: 6, paddingVertical: 4 }}>
          <ActivityIndicator size="small" color={colors.green} />
          <Text style={{ fontSize: 12, color: colors.muted }}>Processing media attachment...</Text>
        </View>
      )}

      {/* Selected Evidence Preview Grid */}
      {evidence.length > 0 && (
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={{ gap: 10, paddingVertical: 6 }}
        >
          {evidence.map((item, index) => {
            const isVideo = item.isVideo || item.fileType?.startsWith("video");
            return (
              <View
                key={item.fileUrl + index}
                style={{
                  position: "relative",
                  width: 84,
                  height: 84,
                  borderRadius: 10,
                  overflow: "hidden",
                  borderWidth: 1,
                  borderColor: colors.border,
                  backgroundColor: colors.background,
                }}
              >
                {isVideo ? (
                  <View
                    style={{
                      flex: 1,
                      alignItems: "center",
                      justifyContent: "center",
                      backgroundColor: "#1e293b",
                    }}
                  >
                    <Ionicons name="videocam" size={28} color={colors.white} />
                    <View
                      style={{
                        position: "absolute",
                        bottom: 4,
                        left: 4,
                        backgroundColor: "#ef4444",
                        paddingHorizontal: 4,
                        paddingVertical: 1,
                        borderRadius: 3,
                      }}
                    >
                      <Text style={{ fontSize: 9, fontWeight: "700", color: colors.white }}>VIDEO</Text>
                    </View>
                  </View>
                ) : (
                  <Image
                    source={{ uri: item.fileUrl }}
                    style={{ width: "100%", height: "100%" }}
                    resizeMode="cover"
                  />
                )}

                {/* Remove Button */}
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel={`Remove evidence ${index + 1}`}
                  disabled={disabled}
                  onPress={() => removeEvidence(index)}
                  style={{
                    position: "absolute",
                    top: 3,
                    right: 3,
                    backgroundColor: "rgba(0,0,0,0.65)",
                    width: 22,
                    height: 22,
                    borderRadius: 11,
                    alignItems: "center",
                    justifyContent: "center",
                  }}
                >
                  <Ionicons name="close" size={14} color={colors.white} />
                </Pressable>
              </View>
            );
          })}
        </ScrollView>
      )}

      {/* Error Alert */}
      {!!error && (
        <Text accessibilityRole="alert" style={styles.error}>
          {error}
        </Text>
      )}
    </View>
  );
}
