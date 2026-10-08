import React from "react";
import { fireEvent, render, screen, waitFor } from "@testing-library/react-native";
import CommunityReportScreen from "../../src/screens/community/CommunityReportScreen";
import ReportStatusScreen from "../../src/screens/community/ReportStatusScreen";
import AlertsScreen from "../../src/screens/alerts/AlertsScreen";
import LiaisonReviewScreen from "../../src/screens/community/LiaisonReviewScreen";
import * as communityApi from "../../src/services/communityReportApi";
import * as alertApi from "../../src/services/alertApi";

jest.mock("../../src/hooks/useAuth", () => ({
  useAuth: () => ({
    user: { id: "u-comm", name: "Sunil Silva", phone: "0771234567", role: "COMMUNITY_USER" },
    isAuthenticated: true,
    isDemo: false,
  }),
}));

jest.mock("../../src/services/communityReportApi", () => ({
  submitReport: jest.fn(),
  listMyReports: jest.fn(),
  listAllReports: jest.fn(),
  updateReportStatus: jest.fn(),
}));

jest.mock("../../src/services/alertApi", () => ({
  listAlerts: jest.fn(),
  acknowledgeAlert: jest.fn(),
}));

describe("Community Reporting & Safety Alert Mobile Screens", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe("CommunityReportScreen", () => {
    test("renders report categories and validates required fields", async () => {
      render(<CommunityReportScreen navigation={{ navigate: jest.fn() }} />);

      expect(screen.getByText("Report Wildlife / Conflict")).toBeTruthy();
      expect(screen.getByText("Wildlife Sighting")).toBeTruthy();
      expect(screen.getByText("Wildlife Conflict")).toBeTruthy();
      expect(screen.getByText("Suspicious Activity")).toBeTruthy();

      // Attempt to submit empty form
      fireEvent.press(screen.getByLabelText("Submit Incident Report"));

      expect(await screen.findByText("Provide a description of at least 5 characters.")).toBeTruthy();
      expect(screen.getByText("Provide a location description or GPS coordinates.")).toBeTruthy();
      expect(communityApi.submitReport).not.toHaveBeenCalled();
    });

    test("submits valid report and shows confirmation screen", async () => {
      communityApi.submitReport.mockResolvedValueOnce({
        success: true,
        report: {
          id: "rep-999",
          reportType: "WILDLIFE_SIGHTING",
          status: "PENDING",
        },
      });

      render(<CommunityReportScreen navigation={{ navigate: jest.fn() }} />);

      // Fill form
      fireEvent.changeText(
        screen.getByPlaceholderText(
          "Describe what occurred, animal count, heading direction, behavior, or damages observed..."
        ),
        "Group of elephants moving towards the southern perimeter fence."
      );
      fireEvent.changeText(
        screen.getByPlaceholderText("e.g. Near Weerawila Tank, 2km post from main gate"),
        "Near Weerawila Tank, gate 2"
      );

      fireEvent.press(screen.getByLabelText("Submit Incident Report"));

      await waitFor(() => {
        expect(communityApi.submitReport).toHaveBeenCalledWith(
          expect.objectContaining({
            reportType: "WILDLIFE_SIGHTING",
            description: "Group of elephants moving towards the southern perimeter fence.",
            manualLocation: "Near Weerawila Tank, gate 2",
            reporterName: "Sunil Silva",
          })
        );
      });

      expect(await screen.findByText("Report Received")).toBeTruthy();
      expect(screen.getByText("Report ID: rep-999")).toBeTruthy();
    });
  });

  describe("AlertsScreen", () => {
    test("renders active safety alerts and acknowledges alert", async () => {
      alertApi.listAlerts.mockResolvedValueOnce({
        success: true,
        alerts: [
          {
            id: "alt-1",
            riskLevel: "CRITICAL",
            message: "Elephants breaching perimeter at sector 4.",
            status: "ACTIVE",
            generatedAt: new Date().toISOString(),
            isAcknowledged: false,
            animal: { species: "Asian Elephant" },
            riskZone: { name: "Sector 4 Buffer" },
          },
        ],
      });
      alertApi.acknowledgeAlert.mockResolvedValueOnce({ success: true });

      render(<AlertsScreen navigation={{ navigate: jest.fn() }} />);

      await waitFor(() => {
        expect(screen.getByText("CRITICAL ALERT")).toBeTruthy();
        expect(screen.getByText("Elephants breaching perimeter at sector 4.")).toBeTruthy();
      });

      fireEvent.press(screen.getByLabelText("Acknowledge alert"));

      await waitFor(() => {
        expect(alertApi.acknowledgeAlert).toHaveBeenCalledWith("alt-1");
      });
    });
  });

  describe("ReportStatusScreen", () => {
    test("renders report history for community user", async () => {
      communityApi.listMyReports.mockResolvedValueOnce({
        success: true,
        reports: [
          {
            id: "rep-1",
            reportType: "WILDLIFE_SIGHTING",
            status: "UNDER_REVIEW",
            species: "Asian Elephant",
            description: "Elephant sighting near irrigation canal.",
            manualLocation: "Kataragama canal road",
            submittedAt: new Date().toISOString(),
          },
        ],
      });

      render(<ReportStatusScreen navigation={{ navigate: jest.fn() }} />);

      await waitFor(() => {
        expect(screen.getByText("WILDLIFE SIGHTING")).toBeTruthy();
        expect(screen.getByText("UNDER REVIEW")).toBeTruthy();
        expect(screen.getByText("Elephant sighting near irrigation canal.")).toBeTruthy();
      });
    });
  });

  describe("LiaisonReviewScreen", () => {
    test("renders liaison desk reports", async () => {
      communityApi.listAllReports.mockResolvedValueOnce({
        success: true,
        reports: [
          {
            id: "rep-2",
            reportType: "HUMAN_WILDLIFE_CONFLICT",
            status: "PENDING",
            species: "Wild Boar",
            description: "Crop damage in banana plantation.",
            manualLocation: "Village Sector 3",
            reporterName: "Nimal",
            reporterPhone: "0770001122",
            submittedAt: new Date().toISOString(),
          },
        ],
      });

      render(<LiaisonReviewScreen />);

      await waitFor(() => {
        expect(screen.getByText("HUMAN WILDLIFE CONFLICT")).toBeTruthy();
        expect(screen.getByText("Crop damage in banana plantation.")).toBeTruthy();
        expect(screen.getByText("Start Review")).toBeTruthy();
      });
    });
  });
});
