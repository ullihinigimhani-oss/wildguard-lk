import React from "react";
import { fireEvent, render, screen, waitFor } from "@testing-library/react-native";
import CommunityHomeScreen from "../../src/screens/community/CommunityHomeScreen";
import * as alertApi from "../../src/services/alertApi";
import * as communityApi from "../../src/services/communityReportApi";

jest.mock("../../src/hooks/useAuth", () => ({
  useAuth: () => ({
    user: { id: "u-comm", name: "Sunil Silva", email: "sunil@wildguard.lk", role: "COMMUNITY_USER" },
    isAuthenticated: true,
    isDemo: false,
  }),
}));

jest.mock("../../src/services/alertApi", () => ({
  listAlerts: jest.fn(),
}));

jest.mock("../../src/services/communityReportApi", () => ({
  listMyReports: jest.fn(),
}));

describe("CommunityHomeScreen", () => {
  const mockNavigate = jest.fn();
  const navigation = { navigate: mockNavigate };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  test("renders user greeting, identity card, and quick action cards", async () => {
    alertApi.listAlerts.mockResolvedValueOnce({ success: true, alerts: [] });
    communityApi.listMyReports.mockResolvedValueOnce({ success: true, reports: [] });

    render(<CommunityHomeScreen navigation={navigation} />);

    expect(screen.getByText("Welcome, Sunil.")).toBeTruthy();
    expect(screen.getByText("Community Wildlife Coordination & Safety")).toBeTruthy();
    expect(screen.getByText("Community Member")).toBeTruthy();
    expect(screen.getByText("sunil@wildguard.lk")).toBeTruthy();

    expect(screen.getByText("Wildlife Sighting")).toBeTruthy();
    expect(screen.getByText("Wildlife Conflict")).toBeTruthy();
    expect(screen.getByText("Suspicious Activity")).toBeTruthy();

    await waitFor(() => {
      expect(screen.getByText("Perimeter Normal")).toBeTruthy();
      expect(screen.getByText("You have not filed any wildlife reports yet.")).toBeTruthy();
    });
  });

  test("navigates to Report screen with appropriate initialReportType on quick action press", async () => {
    alertApi.listAlerts.mockResolvedValueOnce({ success: true, alerts: [] });
    communityApi.listMyReports.mockResolvedValueOnce({ success: true, reports: [] });

    render(<CommunityHomeScreen navigation={navigation} />);

    await waitFor(() => {
      expect(screen.getByText("Perimeter Normal")).toBeTruthy();
    });

    fireEvent.press(screen.getByLabelText("Wildlife Sighting"));
    expect(mockNavigate).toHaveBeenCalledWith("Report", {
      initialReportType: "WILDLIFE_SIGHTING",
    });

    fireEvent.press(screen.getByLabelText("Wildlife Conflict"));
    expect(mockNavigate).toHaveBeenCalledWith("Report", {
      initialReportType: "HUMAN_WILDLIFE_CONFLICT",
    });

    fireEvent.press(screen.getByLabelText("Suspicious Activity"));
    expect(mockNavigate).toHaveBeenCalledWith("Report", {
      initialReportType: "SUSPICIOUS_ACTIVITY",
    });
  });

  test("renders active safety alert summary and unread badge, navigating to SafetyAlerts on press", async () => {
    alertApi.listAlerts.mockResolvedValueOnce({
      success: true,
      alerts: [
        {
          id: "alt-1",
          riskLevel: "CRITICAL",
          message: "Elephant herd spotted near Sector 4 village boundary.",
          isAcknowledged: false,
          generatedAt: new Date().toISOString(),
        },
        {
          id: "alt-2",
          riskLevel: "HIGH",
          message: "Leopard movement detected near south waterhole.",
          isAcknowledged: true,
          generatedAt: new Date().toISOString(),
        },
      ],
    });
    communityApi.listMyReports.mockResolvedValueOnce({ success: true, reports: [] });

    render(<CommunityHomeScreen navigation={navigation} />);

    await waitFor(() => {
      expect(screen.getByText("2 Active Wildlife Alerts")).toBeTruthy();
      expect(screen.getByText("1 Unread")).toBeTruthy();
      expect(screen.getByText("Elephant herd spotted near Sector 4 village boundary.")).toBeTruthy();
      expect(screen.getByText("Open Safety Advisories")).toBeTruthy();
    });

    fireEvent.press(screen.getByLabelText("View safety alerts"));
    expect(mockNavigate).toHaveBeenCalledWith("SafetyAlerts");
  });

  test("renders recent report summary card and navigates to MyReports", async () => {
    alertApi.listAlerts.mockResolvedValueOnce({ success: true, alerts: [] });
    communityApi.listMyReports.mockResolvedValueOnce({
      success: true,
      reports: [
        {
          id: "rep-101",
          reportType: "HUMAN_WILDLIFE_CONFLICT",
          status: "RESPONSE_IN_PROGRESS",
          description: "Crop damage by wild boar along the eastern boundary fence.",
          manualLocation: "East Boundary Plot 12",
          submittedAt: new Date().toISOString(),
        },
      ],
    });

    render(<CommunityHomeScreen navigation={navigation} />);

    await waitFor(() => {
      expect(screen.getByText("HUMAN WILDLIFE CONFLICT")).toBeTruthy();
      expect(screen.getByText("RESPONSE IN PROGRESS")).toBeTruthy();
      expect(
        screen.getByText("Crop damage by wild boar along the eastern boundary fence.")
      ).toBeTruthy();
      expect(screen.getByText("East Boundary Plot 12")).toBeTruthy();
    });

    fireEvent.press(screen.getByLabelText("View latest report details"));
    expect(mockNavigate).toHaveBeenCalledWith("MyReports");
  });

  test("renders View All reports button when user has reports and navigates to MyReports", async () => {
    alertApi.listAlerts.mockResolvedValueOnce({ success: true, alerts: [] });
    communityApi.listMyReports.mockResolvedValueOnce({
      success: true,
      reports: [
        {
          id: "rep-1",
          reportType: "WILDLIFE_SIGHTING",
          status: "PENDING",
          description: "Deer spotted grazing near primary school.",
          submittedAt: new Date().toISOString(),
        },
      ],
    });

    render(<CommunityHomeScreen navigation={navigation} />);

    await waitFor(() => {
      expect(screen.getByText("View All (1)")).toBeTruthy();
    });

    fireEvent.press(screen.getByText("View All (1)"));
    expect(mockNavigate).toHaveBeenCalledWith("MyReports");
  });

  test("renders error state when API fails and retries upon button press", async () => {
    alertApi.listAlerts.mockRejectedValueOnce(new Error("Network timeout"));
    communityApi.listMyReports.mockResolvedValueOnce({ success: true, reports: [] });

    render(<CommunityHomeScreen navigation={navigation} />);

    await waitFor(() => {
      expect(
        screen.getByText("Unable to load community dashboard data. Pull down to retry.")
      ).toBeTruthy();
      expect(screen.getByText("Retry")).toBeTruthy();
    });

    // Mock success on retry
    alertApi.listAlerts.mockResolvedValueOnce({ success: true, alerts: [] });
    communityApi.listMyReports.mockResolvedValueOnce({ success: true, reports: [] });

    fireEvent.press(screen.getByText("Retry"));

    await waitFor(() => {
      expect(screen.getByText("Perimeter Normal")).toBeTruthy();
    });
  });
});
