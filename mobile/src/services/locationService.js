import * as Location from "expo-location";

export const LocationErrorCode = {
  PERMISSION_DENIED: "PERMISSION_DENIED",
  GPS_DISABLED: "GPS_DISABLED",
  TIMEOUT: "TIMEOUT",
  UNAVAILABLE: "UNAVAILABLE",
};

/**
 * Request foreground location permissions from the user.
 * @returns {Promise<{ granted: boolean, canAskAgain: boolean }>}
 */
export async function requestLocationPermission() {
  try {
    const { status, canAskAgain } = await Location.requestForegroundPermissionsAsync();
    return {
      granted: status === "granted",
      canAskAgain: Boolean(canAskAgain),
    };
  } catch (error) {
    return {
      granted: false,
      canAskAgain: false,
      error: error.message,
    };
  }
}

/**
 * Check if the device's location services (GPS) are enabled.
 * @returns {Promise<boolean>}
 */
export async function isLocationServicesEnabled() {
  try {
    return await Location.isLocationEnabledAsync();
  } catch {
    return true; // Fallback to attempting location request
  }
}

/**
 * Get current GPS coordinates of the device.
 * Handles permissions, disabled GPS, timeouts, and unavailabilities.
 *
 * @param {object} [options]
 * @param {number} [options.timeout=10000] - Timeout in milliseconds
 * @returns {Promise<{
 *   success: boolean,
 *   coords?: { latitude: number, longitude: number, accuracy: number },
 *   error?: string,
 *   errorCode?: string
 * }>}
 */
export async function getCurrentDeviceLocation(options = {}) {
  const timeoutMs = options.timeout || 10000;

  // 1. Check location services enabled
  const servicesEnabled = await isLocationServicesEnabled();
  if (!servicesEnabled) {
    return {
      success: false,
      errorCode: LocationErrorCode.GPS_DISABLED,
      error: "Device GPS/Location services are disabled. Please enable GPS in device settings or enter location manually.",
    };
  }

  // 2. Check/request permission
  const { granted } = await requestLocationPermission();
  if (!granted) {
    return {
      success: false,
      errorCode: LocationErrorCode.PERMISSION_DENIED,
      error: "Location permission denied. You can enter the location manually below or enable permissions in app settings.",
    };
  }

  // 3. Retrieve position with timeout
  try {
    const timeoutPromise = new Promise((_, reject) =>
      setTimeout(() => {
        const err = new Error("Location request timed out.");
        err.name = "TimeoutError";
        reject(err);
      }, timeoutMs)
    );

    const positionPromise = Location.getCurrentPositionAsync({
      accuracy: Location.Accuracy.Balanced,
    });

    const location = await Promise.race([positionPromise, timeoutPromise]);

    if (!location || !location.coords) {
      return {
        success: false,
        errorCode: LocationErrorCode.UNAVAILABLE,
        error: "Location is currently unavailable. Please enter location manually or retry.",
      };
    }

    const { latitude, longitude, accuracy } = location.coords;

    // Validate coordinates
    if (
      typeof latitude !== "number" ||
      typeof longitude !== "number" ||
      Number.isNaN(latitude) ||
      Number.isNaN(longitude) ||
      latitude < -90 ||
      latitude > 90 ||
      longitude < -180 ||
      longitude > 180
    ) {
      return {
        success: false,
        errorCode: LocationErrorCode.UNAVAILABLE,
        error: "Received inaccurate or invalid GPS readings. Please retry or enter manually.",
      };
    }

    return {
      success: true,
      coords: {
        latitude: Number(latitude.toFixed(6)),
        longitude: Number(longitude.toFixed(6)),
        accuracy: accuracy ? Math.round(accuracy) : null,
      },
    };
  } catch (err) {
    if (err.name === "TimeoutError" || err.message?.includes("timed out")) {
      return {
        success: false,
        errorCode: LocationErrorCode.TIMEOUT,
        error: "GPS request timed out. Please retry with a clear view of the sky or enter location manually.",
      };
    }

    return {
      success: false,
      errorCode: LocationErrorCode.UNAVAILABLE,
      error: "Unable to retrieve device GPS location. Please enter location manually or retry.",
    };
  }
}
