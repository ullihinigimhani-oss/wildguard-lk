import React, { useState } from "react";
import { Image, Platform, View } from "react-native";
import { Text } from "./Typography";
import * as ImagePicker from "expo-image-picker";
import Button from "./Button";
import { styles } from "../../constants/theme";
export default function RegistrationPhoto({ disabled }) {
  const [photo, setPhoto] = useState(null);
  const [error, setError] = useState("");
  async function choose() {
    setError("");
    try {
      if (Platform.OS !== "web") {
        const permission =
          await ImagePicker.requestMediaLibraryPermissionsAsync();
        if (!permission.granted) {
          setError("Allow photo library access to choose a profile photo.");
          return;
        }
      }
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ["images"],
        allowsEditing: true,
        aspect: [1, 1],
        quality: 0.7,
      });
      if (!result.canceled && result.assets?.[0]?.uri)
        setPhoto(result.assets[0].uri);
    } catch {
      setError("Unable to open the photo library. Please try again.");
    }
  }
  return (
    <View style={{ gap: 10, alignItems: "center" }}>
      <Text style={styles.heading}>Profile Photo (Optional)</Text>
      {photo ? (
        <Image
          source={{ uri: photo }}
          accessibilityLabel="Selected profile preview"
          style={{ width: 96, height: 96, borderRadius: 48 }}
        />
      ) : (
        <View
          style={{
            width: 96,
            height: 96,
            borderRadius: 48,
            backgroundColor: "#e6efdf",
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          <Text style={styles.heading}>♧</Text>
        </View>
      )}
      <Button
        title={photo ? "Change Photo" : "Add Photo"}
        secondary
        disabled={disabled}
        onPress={choose}
      />
      {photo && (
        <Button
          title="Remove Photo"
          secondary
          disabled={disabled}
          onPress={() => setPhoto(null)}
        />
      )}
      <Text style={styles.muted}>
        Optional preview only. Photo storage is not configured; this photo will
        not be saved to your account.
      </Text>
      {!!error && (
        <Text accessibilityRole="alert" style={styles.error}>
          {error}
        </Text>
      )}
    </View>
  );
}
