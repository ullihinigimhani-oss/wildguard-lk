import React, { useState } from "react";
import {
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

export default function EvidencePicker({
  evidence = [],
  onChange,
  disabled = false,
  maxItems = 5,
}) {
  const [error, setError] = useState("");

  async function pickImage(fromCamera = false) {
    setError("");
    if (evidence.length >= maxItems) {
      setError(`You can attach up to ${maxItems} photos.`);
      return;
    }

    try {
      if (Platform.OS !== "web") {
        const permission = fromCamera
          ? await ImagePicker.requestCameraPermissionsAsync()
          : await ImagePicker.requestMediaLibraryPermissionsAsync();

        if (!permission.granted) {
          setError(
            fromCamera
              ? "Camera permission is required to capture photos."
              : "Photo library access is required to choose photos."
          );
          return;
        }
      }

      const options = {
        mediaTypes: ["images"],
        allowsEditing: true,
        quality: 0.7,
      };

      const result = fromCamera
        ? await ImagePicker.launchCameraAsync(options)
        : await ImagePicker.launchImageLibraryAsync(options);

      if (!result.canceled && result.assets?.[0]?.uri) {
        const newAsset = {
          fileUrl: result.assets[0].uri,
          fileType: "image/jpeg",
        };
        onChange([...evidence, newAsset]);
      }
    } catch {
      setError("Unable to capture or select photo. Please try again.");
    }
  }

  function removeImage(index) {
    const updated = evidence.filter((_, i) => i !== index);
    onChange(updated);
  }

  return (
    <View style={{ gap: 8 }}>
      <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}>
        <Text style={styles.label}>Photo / Evidence ({evidence.length}/{maxItems})</Text>
        <Text style={styles.muted}>Optional</Text>
      </View>

      <View style={{ flexDirection: "row", gap: 10 }}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Take photo with camera"
          disabled={disabled || evidence.length >= maxItems}
          onPress={() => pickImage(true)}
          style={({ pressed }) => ({
            flex: 1,
            flexDirection: "row",
            alignItems: "center",
            justifyContent: "center",
            gap: 6,
            minHeight: 44,
            padding: 10,
            borderRadius: 10,
            borderWidth: 1,
            borderColor: colors.border,
            backgroundColor: colors.white,
            opacity: pressed || disabled || evidence.length >= maxItems ? 0.6 : 1,
          })}
        >
          <Ionicons name="camera-outline" size={18} color={colors.green} />
          <Text style={{ fontSize: 13, fontWeight: "600", color: colors.text }}>Camera</Text>
        </Pressable>

        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Choose from photo gallery"
          disabled={disabled || evidence.length >= maxItems}
          onPress={() => pickImage(false)}
          style={({ pressed }) => ({
            flex: 1,
            flexDirection: "row",
            alignItems: "center",
            justifyContent: "center",
            gap: 6,
            minHeight: 44,
            padding: 10,
            borderRadius: 10,
            borderWidth: 1,
            borderColor: colors.border,
            backgroundColor: colors.white,
            opacity: pressed || disabled || evidence.length >= maxItems ? 0.6 : 1,
          })}
        >
          <Ionicons name="images-outline" size={18} color={colors.green} />
          <Text style={{ fontSize: 13, fontWeight: "600", color: colors.text }}>Gallery</Text>
        </Pressable>
      </View>

      {evidence.length > 0 && (
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 10, paddingVertical: 6 }}>
          {evidence.map((item, index) => (
            <View key={item.fileUrl + index} style={{ position: "relative" }}>
              <Image
                source={{ uri: item.fileUrl }}
                style={{ width: 80, height: 80, borderRadius: 10, borderWidth: 1, borderColor: colors.border }}
              />
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={`Remove photo ${index + 1}`}
                disabled={disabled}
                onPress={() => removeImage(index)}
                style={{
                  position: "absolute",
                  top: -6,
                  right: -6,
                  backgroundColor: colors.error,
                  width: 22,
                  height: 22,
                  borderRadius: 11,
                  alignItems: "center",
                  justifyContent: "center",
                  borderWidth: 1.5,
                  borderColor: colors.white,
                }}
              >
                <Ionicons name="close" size={14} color={colors.white} />
              </Pressable>
            </View>
          ))}
        </ScrollView>
      )}

      {!!error && (
        <Text accessibilityRole="alert" style={styles.error}>
          {error}
        </Text>
      )}
    </View>
  );
}
