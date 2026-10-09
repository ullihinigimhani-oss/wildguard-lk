import React from "react";
import { fireEvent, render, screen, waitFor } from "@testing-library/react-native";
import CommunityReportScreen from "../../src/screens/community/CommunityReportScreen";
import * as Location from "expo-location";
import * as communityApi from "../../src/services/communityReportApi";

jest.mock("expo-location", () => ({
  requestForegroundPermissionsAsync: jest.fn(),
  isLocationEnabledAsync: jest.fn(),
  getCurrentPositionAsync: jest.fn(),
  Accuracy: { Balanced: 3 },
}));

jest.mock("../../src/hooks/useAuth", () => ({
  useAuth: () => ({
    user: { id: "u-comm", name: "Sunil Silva", role: "COMMUNITY_USER" },
    isAuthenticated: true,
    isDemo: false,
  }),
}));

jest.mock("../../src/services/communityReportApi", () => ({
  submitReport: jest.fn(),
}));

describe("Community Report Location Handling (Task 4)", () => {
  const mockNavigate = jest.fn();
  const navigation = { navigate: mockNavigate };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  test("acquires GPS location when permission is granted and services are enabled", async () => {
    Location.isLocationEnabledAsync.mockResolvedValueOnce(true);
    Location.requestForegroundPermissionsAsync.mockResolvedValueOnce({
      status: "granted",
      canAskAgain: true,
    });
    Location.getCurrentPositionAsync.mockResolvedValueOnce({
      coords: {
        latitude: 6.425123,
        longitude: 81.332845,
        accuracy: 8,
      },
    });

    render(<CommunityReportScreen navigation={navigation} />);

    fireEvent.press(screen.getByLabelText("Use Current Location"));

    await waitFor(() => {
      expect(screen.getByText(/Coordinates: 6.4251°, 81.3328° \(±8m\)/)).toBeTruthy();
    });

    // Verify map view and clear button are present
    expect(screen.getByTestId("location-map-webview")).toBeTruthy();
    expect(screen.getByText("Clear GPS")).toBeTruthy();

    // Verify coordinate input values are updated
    expect(screen.getByDisplayValue("6.425123")).toBeTruthy();
    expect(screen.getByDisplayValue("81.332845")).toBeTruthy();
  });

  test("handles permission denied error and preserves existing report data", async () => {
    Location.isLocationEnabledAsync.mockResolvedValueOnce(true);
    Location.requestForegroundPermissionsAsync.mockResolvedValueOnce({
      status: "denied",
      canAskAgain: false,
    });

    render(<CommunityReportScreen navigation={navigation} />);

    // Pre-enter description and landmark
    fireEvent.changeText(
      screen.getByPlaceholderText(
        "Describe what occurred, animal count, heading direction, behavior, or damages observed..."
      ),
      "Two elephants crossing road near sugarcane field."
    );
    fireEvent.changeText(
      screen.getByPlaceholderText("e.g. Near Weerawila Tank, 2km post from main gate"),
      "Sugarcane field border culvert"
    );

    fireEvent.press(screen.getByLabelText("Use Current Location"));

    await waitFor(() => {
      expect(
        screen.getByText(
          "Location permission denied. You can enter the location manually below or enable permissions in app settings."
        )
      ).toBeTruthy();
    });

    // Ensure pre-entered data was NOT wiped or lost
    expect(screen.getByDisplayValue("Two elephants crossing road near sugarcane field.")).toBeTruthy();
    expect(screen.getByDisplayValue("Sugarcane field border culvert")).toBeTruthy();
  });

  test("handles GPS disabled error and retries when services are turned on", async () => {
    Location.isLocationEnabledAsync.mockResolvedValueOnce(false);

    render(<CommunityReportScreen navigation={navigation} />);

    fireEvent.press(screen.getByLabelText("Use Current Location"));

    await waitFor(() => {
      expect(
        screen.getByText(
          "Device GPS/Location services are disabled. Please enable GPS in device settings or enter location manually."
        )
      ).toBeTruthy();
      expect(screen.getByLabelText("Retry GPS")).toBeTruthy();
    });

    // Mock successful retry
    Location.isLocationEnabledAsync.mockResolvedValueOnce(true);
    Location.requestForegroundPermissionsAsync.mockResolvedValueOnce({ status: "granted" });
    Location.getCurrentPositionAsync.mockResolvedValueOnce({
      coords: { latitude: 6.5, longitude: 80.5, accuracy: 12 },
    });

    fireEvent.press(screen.getByLabelText("Retry GPS"));

    await waitFor(() => {
      expect(screen.getByText(/Coordinates: 6.5000°, 80.5000° \(±12m\)/)).toBeTruthy();
    });
  });

  test("handles location timeout error with retry option", async () => {
    Location.isLocationEnabledAsync.mockResolvedValueOnce(true);
    Location.requestForegroundPermissionsAsync.mockResolvedValueOnce({ status: "granted" });
    Location.getCurrentPositionAsync.mockRejectedValueOnce(
      Object.assign(new Error("Location request timed out."), { name: "TimeoutError" })
    );

    render(<CommunityReportScreen navigation={navigation} />);

    fireEvent.press(screen.getByLabelText("Use Current Location"));

    await waitFor(() => {
      expect(
        screen.getByText(
          "GPS request timed out. Please retry with a clear view of the sky or enter location manually."
        )
      ).toBeTruthy();
    });
  });

  test("allows manual location fallback with area/village and landmark details", async () => {
    communityApi.submitReport.mockResolvedValueOnce({
      success: true,
      report: { id: "rep-loc-1", reportType: "WILDLIFE_SIGHTING", status: "PENDING" },
    });

    render(<CommunityReportScreen navigation={navigation} />);

    fireEvent.changeText(
      screen.getByPlaceholderText(
        "Describe what occurred, animal count, heading direction, behavior, or damages observed..."
      ),
      "Wild elephants feeding near canal."
    );

    // Enter Area / Village
    fireEvent.changeText(
      screen.getByPlaceholderText("e.g. Weerawila South, Kataragama border"),
      "Weerawila South"
    );

    // Enter Landmark Description
    fireEvent.changeText(
      screen.getByPlaceholderText("e.g. Near Weerawila Tank, 2km post from main gate"),
      "Canal gate #4"
    );

    fireEvent.press(screen.getByLabelText("Submit Incident Report"));

    await waitFor(() => {
      expect(communityApi.submitReport).toHaveBeenCalledWith(
        expect.objectContaining({
          manualLocation: "Weerawila South - Canal gate #4",
        })
      );
    });

    expect(await screen.findByText("Report Received")).toBeTruthy();
  });

  test("allows clearing GPS coordinates and reverting to manual location", async () => {
    Location.isLocationEnabledAsync.mockResolvedValueOnce(true);
    Location.requestForegroundPermissionsAsync.mockResolvedValueOnce({ status: "granted" });
    Location.getCurrentPositionAsync.mockResolvedValueOnce({
      coords: { latitude: 6.4251, longitude: 81.3328, accuracy: 5 },
    });

    render(<CommunityReportScreen navigation={navigation} />);

    fireEvent.press(screen.getByLabelText("Use Current Location"));

    await waitFor(() => {
      expect(screen.getByText("Clear GPS")).toBeTruthy();
    });

    fireEvent.press(screen.getByText("Clear GPS"));

    expect(screen.queryByText(/Coordinates: 6.4251°/)).toBeNull();
    expect(screen.queryByTestId("location-map-webview")).toBeNull();
  });
});
