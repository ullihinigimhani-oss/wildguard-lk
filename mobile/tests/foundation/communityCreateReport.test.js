import React from "react";
import { fireEvent, render, screen, waitFor } from "@testing-library/react-native";
import CommunityReportScreen from "../../src/screens/community/CommunityReportScreen";
import * as communityApi from "../../src/services/communityReportApi";

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

describe("CommunityReportScreen - Create Community Report (Task 3)", () => {
  const mockNavigate = jest.fn();
  const navigation = { navigate: mockNavigate };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  test("renders all 3 supported incident categories and preselects if initialReportType is given", () => {
    render(
      <CommunityReportScreen
        navigation={navigation}
        route={{ params: { initialReportType: "HUMAN_WILDLIFE_CONFLICT" } }}
      />
    );

    expect(screen.getByText("Report Wildlife / Conflict")).toBeTruthy();
    expect(screen.getByText("Wildlife Sighting")).toBeTruthy();
    expect(screen.getByText("Wildlife Conflict")).toBeTruthy();
    expect(screen.getByText("Suspicious Activity")).toBeTruthy();
  });

  test("validates required description, rejecting empty or whitespace-only inputs", async () => {
    render(<CommunityReportScreen navigation={navigation} />);

    // Attempt submit with empty fields
    fireEvent.press(screen.getByLabelText("Submit Incident Report"));

    expect(await screen.findByText("Provide a description of at least 5 characters.")).toBeTruthy();
    expect(screen.getByText("Provide a location description or GPS coordinates.")).toBeTruthy();
    expect(communityApi.submitReport).not.toHaveBeenCalled();

    // Fill whitespace-only description
    fireEvent.changeText(
      screen.getByPlaceholderText(
        "Describe what occurred, animal count, heading direction, behavior, or damages observed..."
      ),
      "      "
    );
    fireEvent.press(screen.getByLabelText("Submit Incident Report"));

    expect(await screen.findByText("Provide a description of at least 5 characters.")).toBeTruthy();
    expect(communityApi.submitReport).not.toHaveBeenCalled();
  });

  test("validates coordinate boundaries and pairing when GPS inputs are used", async () => {
    render(<CommunityReportScreen navigation={navigation} />);

    // Enter valid description
    fireEvent.changeText(
      screen.getByPlaceholderText(
        "Describe what occurred, animal count, heading direction, behavior, or damages observed..."
      ),
      "Large herd of wild elephants spotted in village paddy fields."
    );

    // Reveal GPS fields
    fireEvent.press(screen.getByText("Add GPS Coordinates (Optional)"));

    // Enter only latitude
    fireEvent.changeText(screen.getByPlaceholderText("e.g. 6.4251"), "6.842");
    fireEvent.press(screen.getByLabelText("Submit Incident Report"));

    expect(
      await screen.findByText("Longitude is required when latitude is provided.")
    ).toBeTruthy();
    expect(communityApi.submitReport).not.toHaveBeenCalled();

    // Enter invalid latitude out of range
    fireEvent.changeText(screen.getByPlaceholderText("e.g. 6.4251"), "95.5");
    fireEvent.changeText(screen.getByPlaceholderText("e.g. 81.3328"), "81.33");
    fireEvent.press(screen.getByLabelText("Submit Incident Report"));

    expect(await screen.findByText("Latitude must be between -90 and 90.")).toBeTruthy();
    expect(communityApi.submitReport).not.toHaveBeenCalled();

    // Fix latitude and enter invalid longitude out of range
    fireEvent.changeText(screen.getByPlaceholderText("e.g. 6.4251"), "6.425");
    fireEvent.changeText(screen.getByPlaceholderText("e.g. 81.3328"), "195.0");
    fireEvent.press(screen.getByLabelText("Submit Incident Report"));

    expect(await screen.findByText("Longitude must be between -180 and 180.")).toBeTruthy();
    expect(communityApi.submitReport).not.toHaveBeenCalled();
  });

  test("submits valid report with manual location and verifies server parameters", async () => {
    communityApi.submitReport.mockResolvedValueOnce({
      success: true,
      report: {
        id: "rep-abc-123",
        reportType: "SUSPICIOUS_ACTIVITY",
        status: "PENDING",
      },
    });

    render(<CommunityReportScreen navigation={navigation} />);

    // Select Suspicious Activity
    fireEvent.press(screen.getByText("Suspicious Activity"));

    // Enter description and location
    fireEvent.changeText(
      screen.getByPlaceholderText(
        "Describe what occurred, animal count, heading direction, behavior, or damages observed..."
      ),
      "Suspected illegal snares discovered along boundary trail near river."
    );
    fireEvent.changeText(
      screen.getByPlaceholderText("e.g. Near Weerawila Tank, 2km post from main gate"),
      "River crossing 3, 500m west of main gate"
    );

    fireEvent.press(screen.getByLabelText("Submit Incident Report"));

    await waitFor(() => {
      expect(communityApi.submitReport).toHaveBeenCalledWith(
        expect.objectContaining({
          reportType: "SUSPICIOUS_ACTIVITY",
          description: "Suspected illegal snares discovered along boundary trail near river.",
          manualLocation: "River crossing 3, 500m west of main gate",
          reporterName: "Sunil Silva",
        })
      );
    });

    // Confirmation screen rendered
    expect(await screen.findByText("Report Received")).toBeTruthy();
    expect(screen.getByText("Report ID: rep-abc-123")).toBeTruthy();
    expect(screen.getByText("Type: SUSPICIOUS ACTIVITY")).toBeTruthy();
    expect(screen.getByText("Status: PENDING")).toBeTruthy();
  });

  test("navigates to MyReports, Home, or resets form on confirmation screen", async () => {
    communityApi.submitReport.mockResolvedValueOnce({
      success: true,
      report: {
        id: "rep-nav-1",
        reportType: "WILDLIFE_SIGHTING",
        status: "PENDING",
      },
    });

    render(<CommunityReportScreen navigation={navigation} />);

    fireEvent.changeText(
      screen.getByPlaceholderText(
        "Describe what occurred, animal count, heading direction, behavior, or damages observed..."
      ),
      "Single elephant grazing peacefully near the secondary school."
    );
    fireEvent.changeText(
      screen.getByPlaceholderText("e.g. Near Weerawila Tank, 2km post from main gate"),
      "Secondary school access road"
    );

    fireEvent.press(screen.getByLabelText("Submit Incident Report"));

    expect(await screen.findByText("Report Received")).toBeTruthy();

    // Navigate to View My Reports
    fireEvent.press(screen.getByText("View My Reports"));
    expect(mockNavigate).toHaveBeenCalledWith("MyReports");
  });

  test("navigates to Home from confirmation screen", async () => {
    communityApi.submitReport.mockResolvedValueOnce({
      success: true,
      report: {
        id: "rep-nav-2",
        reportType: "WILDLIFE_SIGHTING",
        status: "PENDING",
      },
    });

    render(<CommunityReportScreen navigation={navigation} />);

    fireEvent.changeText(
      screen.getByPlaceholderText(
        "Describe what occurred, animal count, heading direction, behavior, or damages observed..."
      ),
      "Wild boars crossing near southern village road."
    );
    fireEvent.changeText(
      screen.getByPlaceholderText("e.g. Near Weerawila Tank, 2km post from main gate"),
      "Southern boundary road"
    );

    fireEvent.press(screen.getByLabelText("Submit Incident Report"));

    expect(await screen.findByText("Report Received")).toBeTruthy();

    // Navigate to Return to Home
    fireEvent.press(screen.getByText("Return to Home"));
    expect(mockNavigate).toHaveBeenCalledWith("CommunityDashboard");
  });

  test("displays network error banner when server submission fails", async () => {
    communityApi.submitReport.mockRejectedValueOnce({
      response: {
        data: {
          message: "Database connection failed. Please retry shortly.",
        },
      },
    });

    render(<CommunityReportScreen navigation={navigation} />);

    fireEvent.changeText(
      screen.getByPlaceholderText(
        "Describe what occurred, animal count, heading direction, behavior, or damages observed..."
      ),
      "Elephant spotted near the village perimeter."
    );
    fireEvent.changeText(
      screen.getByPlaceholderText("e.g. Near Weerawila Tank, 2km post from main gate"),
      "Village perimeter gate"
    );

    fireEvent.press(screen.getByLabelText("Submit Incident Report"));

    expect(
      await screen.findByText("Database connection failed. Please retry shortly.")
    ).toBeTruthy();
  });
});
