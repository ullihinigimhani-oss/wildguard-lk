import React, { useState } from "react";
import {
  Pressable,
  Text,
  TextInput,
  View,
} from "react-native";
import Ionicons from "@expo/vector-icons/Ionicons";
import { colors, styles } from "../constants/theme";

export default function LocationPicker({
  manualLocation,
  latitude,
  longitude,
  onChangeManualLocation,
  onChangeLatitude,
  onChangeLongitude,
  error,
  disabled = false,
}) {
  const [showCoords, setShowCoords] = useState(Boolean(latitude || longitude));

  return (
    <View style={{ gap: 8 }}>
      <Text style={styles.label}>
        Incident Location <Text style={{ color: colors.error }}>*</Text>
      </Text>

      <TextInput
        placeholder="e.g. Near Weerawila Tank, 2km post from main gate"
        placeholderTextColor={colors.muted}
        value={manualLocation}
        onChangeText={onChangeManualLocation}
        editable={!disabled}
        maxLength={250}
        style={[styles.input, { minHeight: 48, fontSize: 14 }]}
      />

      <Pressable
        accessibilityRole="button"
        onPress={() => setShowCoords((prev) => !prev)}
        style={{
          flexDirection: "row",
          alignItems: "center",
          gap: 6,
          alignSelf: "flex-start",
          paddingVertical: 4,
        }}
      >
        <Ionicons
          name={showCoords ? "checkbox-outline" : "square-outline"}
          size={18}
          color={colors.green}
        />
        <Text style={{ fontSize: 13, color: colors.green, fontWeight: "600" }}>
          {showCoords ? "Hide GPS Coordinates" : "Add GPS Coordinates (Optional)"}
        </Text>
      </Pressable>

      {showCoords && (
        <View style={{ flexDirection: "row", gap: 10 }}>
          <View style={{ flex: 1, gap: 4 }}>
            <Text style={{ fontSize: 12, fontWeight: "600", color: colors.muted }}>
              Latitude (-90 to 90)
            </Text>
            <TextInput
              placeholder="e.g. 6.4251"
              placeholderTextColor={colors.muted}
              value={latitude}
              onChangeText={onChangeLatitude}
              keyboardType="numeric"
              editable={!disabled}
              maxLength={15}
              style={[styles.input, { minHeight: 42, fontSize: 13, padding: 10 }]}
            />
          </View>

          <View style={{ flex: 1, gap: 4 }}>
            <Text style={{ fontSize: 12, fontWeight: "600", color: colors.muted }}>
              Longitude (-180 to 180)
            </Text>
            <TextInput
              placeholder="e.g. 81.3328"
              placeholderTextColor={colors.muted}
              value={longitude}
              onChangeText={onChangeLongitude}
              keyboardType="numeric"
              editable={!disabled}
              maxLength={15}
              style={[styles.input, { minHeight: 42, fontSize: 13, padding: 10 }]}
            />
          </View>
        </View>
      )}

      {!!error && (
        <Text accessibilityRole="alert" style={styles.error}>
          {error}
        </Text>
      )}
    </View>
  );
}
