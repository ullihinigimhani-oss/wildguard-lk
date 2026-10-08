import React, { useState } from "react";
import {
  ActivityIndicator,
  Pressable,
  Text,
  TextInput,
  View,
} from "react-native";
import Ionicons from "@expo/vector-icons/Ionicons";
import { WebView } from "react-native-webview";
import { colors, styles } from "../constants/theme";
import {
  getCurrentDeviceLocation,
  LocationErrorCode,
} from "../services/locationService";
import { buildReportMapDocument } from "./reportMapDocument";

export default function LocationPicker({
  manualLocation = "",
  villageArea = "",
  landmarkDescription = "",
  latitude = "",
  longitude = "",
  onChangeManualLocation,
  onChangeVillageArea,
  onChangeLandmarkDescription,
  onChangeLatitude,
  onChangeLongitude,
  error,
  disabled = false,
}) {
  const [loadingGps, setLoadingGps] = useState(false);
  const [gpsError, setGpsError] = useState("");
  const [gpsAccuracy, setGpsAccuracy] = useState(null);
  const [showMap, setShowMap] = useState(Boolean(latitude && longitude));
  const [showCoordsInput, setShowCoordsInput] = useState(Boolean(latitude || longitude));

  const hasCoordinates = Boolean(
    latitude !== "" &&
      longitude !== "" &&
      !isNaN(parseFloat(latitude)) &&
      !isNaN(parseFloat(longitude))
  );

  async function handleGetGpsLocation() {
    if (disabled || loadingGps) return;

    setLoadingGps(true);
    setGpsError("");

    try {
      const result = await getCurrentDeviceLocation({ timeout: 10000 });

      if (result.success && result.coords) {
        onChangeLatitude(String(result.coords.latitude));
        onChangeLongitude(String(result.coords.longitude));
        setGpsAccuracy(result.coords.accuracy);
        setGpsError("");
        setShowMap(true);
        setShowCoordsInput(true);
      } else {
        setGpsError(
          result.error ||
            "Unable to get GPS location. Please retry or enter location manually."
        );
      }
    } catch {
      setGpsError(
        "Failed to request device location. Please retry or enter location manually."
      );
    } finally {
      setLoadingGps(false);
    }
  }

  function handleClearCoordinates() {
    onChangeLatitude("");
    onChangeLongitude("");
    setGpsAccuracy(null);
    setShowMap(false);
  }

  function handleMapMessage(event) {
    try {
      const data = JSON.parse(event.nativeEvent?.data || "{}");
      if (data.type === "location-adjusted" && data.latitude && data.longitude) {
        onChangeLatitude(String(data.latitude));
        onChangeLongitude(String(data.longitude));
      }
    } catch {
      // Ignore malformed webview message
    }
  }

  return (
    <View style={{ gap: 10 }}>
      <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}>
        <Text style={styles.label}>
          Incident Location <Text style={{ color: colors.error }}>*</Text>
        </Text>
        {hasCoordinates && (
          <Pressable accessibilityRole="button" onPress={handleClearCoordinates} disabled={disabled}>
            <Text style={{ fontSize: 12, color: colors.muted, fontWeight: "600" }}>Clear GPS</Text>
          </Pressable>
        )}
      </View>

      {/* GPS Location Button */}
      <View style={{ gap: 6 }}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Use Current Location"
          onPress={handleGetGpsLocation}
          disabled={disabled || loadingGps}
          style={({ pressed }) => ({
            flexDirection: "row",
            alignItems: "center",
            justifyContent: "center",
            gap: 8,
            backgroundColor: hasCoordinates ? colors.cream : colors.white,
            borderWidth: 1.5,
            borderColor: hasCoordinates ? colors.green : colors.border,
            borderRadius: 10,
            paddingVertical: 12,
            paddingHorizontal: 16,
            opacity: pressed || disabled ? 0.7 : 1,
          })}
        >
          {loadingGps ? (
            <>
              <ActivityIndicator size="small" color={colors.green} />
              <Text style={{ fontSize: 14, fontWeight: "700", color: colors.green }}>
                Acquiring GPS Signal...
              </Text>
            </>
          ) : (
            <>
              <Ionicons
                name={hasCoordinates ? "locate" : "locate-outline"}
                size={18}
                color={colors.green}
              />
              <Text style={{ fontSize: 14, fontWeight: "700", color: colors.green }}>
                {hasCoordinates ? "Update Current GPS Location" : "Use Current Location"}
              </Text>
            </>
          )}
        </Pressable>

        {/* GPS Error & Retry Notice */}
        {!!gpsError && (
          <View
            style={{
              padding: 10,
              backgroundColor: "#fff7ed",
              borderRadius: 8,
              borderWidth: 1,
              borderColor: "#fed7aa",
              gap: 6,
            }}
          >
            <View style={{ flexDirection: "row", gap: 6, alignItems: "center" }}>
              <Ionicons name="warning-outline" size={16} color="#c2410c" />
              <Text style={{ fontSize: 12, color: "#9a3412", flex: 1, fontWeight: "600" }}>
                {gpsError}
              </Text>
            </View>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Retry GPS"
              onPress={handleGetGpsLocation}
              disabled={disabled || loadingGps}
              style={{
                alignSelf: "flex-start",
                paddingHorizontal: 8,
                paddingVertical: 4,
                backgroundColor: "#ea580c",
                borderRadius: 5,
              }}
            >
              <Text style={{ fontSize: 11, fontWeight: "700", color: colors.white }}>
                Retry GPS
              </Text>
            </Pressable>
          </View>
        )}

        {/* GPS Success Badge */}
        {hasCoordinates && (
          <View
            style={{
              flexDirection: "row",
              alignItems: "center",
              gap: 6,
              backgroundColor: "#f0fdf4",
              paddingHorizontal: 10,
              paddingVertical: 6,
              borderRadius: 6,
              borderWidth: 1,
              borderColor: "#bbf7d0",
            }}
          >
            <Ionicons name="checkmark-circle" size={14} color="#16a34a" />
            <Text style={{ fontSize: 12, color: "#15803d", fontWeight: "600", flex: 1 }}>
              Coordinates: {parseFloat(latitude).toFixed(4)}°, {parseFloat(longitude).toFixed(4)}°
              {gpsAccuracy ? ` (±${gpsAccuracy}m)` : ""}
            </Text>
          </View>
        )}
      </View>

      {/* Map Preview (OpenStreetMap / Leaflet via WebView) */}
      {hasCoordinates && (
        <View style={{ gap: 6 }}>
          <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}>
            <Text style={{ fontSize: 12, fontWeight: "700", color: colors.dark }}>
              Location Map Preview
            </Text>
            <Pressable
              accessibilityRole="button"
              onPress={() => setShowMap((prev) => !prev)}
            >
              <Text style={{ fontSize: 11, color: colors.green, fontWeight: "600" }}>
                {showMap ? "Hide Map" : "Show Map"}
              </Text>
            </Pressable>
          </View>

          {showMap && (
            <View
              style={{
                height: 160,
                borderRadius: 10,
                overflow: "hidden",
                borderWidth: 1,
                borderColor: colors.border,
              }}
            >
              <WebView
                testID="location-map-webview"
                accessibilityLabel="Incident location map preview"
                style={{ flex: 1 }}
                source={{
                  html: buildReportMapDocument(parseFloat(latitude), parseFloat(longitude), true),
                  baseUrl: "https://wildguard-map.invalid/",
                }}
                originWhitelist={["*"]}
                javaScriptEnabled
                scrollEnabled={false}
                nestedScrollEnabled
                onMessage={handleMapMessage}
              />
            </View>
          )}
        </View>
      )}

      {/* Manual Location Fallback Fields */}
      <View style={{ gap: 8 }}>
        <Text style={{ fontSize: 12, fontWeight: "700", color: colors.dark }}>
          Manual Location Description
        </Text>

        {/* Area / Village */}
        {onChangeVillageArea ? (
          <View style={{ gap: 4 }}>
            <Text style={{ fontSize: 11, fontWeight: "600", color: colors.muted }}>
              Area / Village (e.g. Lunugamvehera, Sector 4)
            </Text>
            <TextInput
              placeholder="e.g. Weerawila South, Kataragama border"
              placeholderTextColor={colors.muted}
              value={villageArea}
              onChangeText={onChangeVillageArea}
              editable={!disabled}
              maxLength={120}
              style={[styles.input, { minHeight: 44, fontSize: 13 }]}
            />
          </View>
        ) : null}

        {/* Landmark / Description */}
        <View style={{ gap: 4 }}>
          <Text style={{ fontSize: 11, fontWeight: "600", color: colors.muted }}>
            Landmark or Specific Spot Details
          </Text>
          <TextInput
            placeholder="e.g. Near Weerawila Tank, 2km post from main gate"
            placeholderTextColor={colors.muted}
            value={onChangeLandmarkDescription ? landmarkDescription : manualLocation}
            onChangeText={onChangeLandmarkDescription || onChangeManualLocation}
            editable={!disabled}
            maxLength={250}
            style={[styles.input, { minHeight: 48, fontSize: 13 }]}
          />
        </View>
      </View>

      {/* Manual GPS Coordinate Inputs Toggle */}
      <Pressable
        accessibilityRole="button"
        onPress={() => setShowCoordsInput((prev) => !prev)}
        style={{
          flexDirection: "row",
          alignItems: "center",
          gap: 6,
          alignSelf: "flex-start",
          paddingVertical: 2,
        }}
      >
        <Ionicons
          name={showCoordsInput ? "checkbox-outline" : "square-outline"}
          size={16}
          color={colors.green}
        />
        <Text style={{ fontSize: 12, color: colors.green, fontWeight: "600" }}>
          {showCoordsInput ? "Hide GPS Coordinates" : "Add GPS Coordinates (Optional)"}
        </Text>
      </Pressable>

      {showCoordsInput && (
        <View style={{ flexDirection: "row", gap: 10 }}>
          <View style={{ flex: 1, gap: 4 }}>
            <Text style={{ fontSize: 11, fontWeight: "600", color: colors.muted }}>
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
            <Text style={{ fontSize: 11, fontWeight: "600", color: colors.muted }}>
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

      {/* Validation Error Banner */}
      {!!error && (
        <Text accessibilityRole="alert" style={styles.error}>
          {error}
        </Text>
      )}
    </View>
  );
}
