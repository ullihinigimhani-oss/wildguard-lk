import React from "react";
import { render, screen, fireEvent, waitFor } from "@testing-library/react-native";
import { Alert as NativeAlert, Linking } from "react-native";
import CommunityReportScreen from "../../src/screens/community/CommunityReportScreen";
import {
  buildSmsReportText,
  simulateSmsReport,
  getSmsFormat,
} from "../../src/services/smsReportApi";

jest.mock("../../src/services/smsReportApi", () => {
  const actual = jest.requireActual("../../src/services/smsReportApi");
  return {
    ...actual,
    simulateSmsReport: jest.fn(),
    getSmsFormat: jest.fn(),
  };
});

jest.mock("../../src/services/communityReportApi", () => ({
  submitReport: jest.fn(),
  uploadEvidence: jest.fn(),
}));

jest.mock("../../src/hooks/useAuth", () => ({
  useAuth: () => ({
    user: { id: "user-1", name: "Community User", phone: "+94771234567" },
  }),
}));

describe("Task 16: SMS Community Reporting", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    jest.spyOn(NativeAlert, "alert").mockImplementation(() => {});
    jest.spyOn(Linking, "canOpenURL").mockResolvedValue(true);
    jest.spyOn(Linking, "openURL").mockResolvedValue(true);
  });

  describe("buildSmsReportText helper", () => {
    test("formats standard sighting report", () => {
      const text = buildSmsReportText({
        reportType: "WILDLIFE_SIGHTING",
        location: "Yala Sector 3",
        description: "Elephant herd spotted near paddy boundary",
        isAnonymous: false,
      });

      expect(text).toBe("REPORT SIGHTING # Yala Sector 3 # Elephant herd spotted near paddy boundary");
    });

    test("formats conflict report with CONFLICT keyword", () => {
      const text = buildSmsReportText({
        reportType: "HUMAN_WILDLIFE_CONFLICT",
        location: "Wilpattu Border Village",
        description: "Wild boar damaged crop storehouse",
        isAnonymous: false,
      });

      expect(text).toBe("REPORT CONFLICT # Wilpattu Border Village # Wild boar damaged crop storehouse");
    });

    test("formats suspicious report with SUSPICIOUS keyword", () => {
      const text = buildSmsReportText({
        reportType: "SUSPICIOUS_ACTIVITY",
        location: "Northern Canal Track",
        description: "Wire snares set along forest path",
        isAnonymous: false,
      });

      expect(text).toBe("REPORT SUSPICIOUS # Northern Canal Track # Wire snares set along forest path");
    });

    test("formats anonymous report with REPORT ANON prefix", () => {
      const text = buildSmsReportText({
        reportType: "WILDLIFE_SIGHTING",
        location: "Kataragama Road",
        description: "Leopard crossing highway",
        isAnonymous: true,
      });

      expect(text).toBe("REPORT ANON SIGHTING # Kataragama Road # Leopard crossing highway");
    });

    test("handles empty/fallback values cleanly", () => {
      const text = buildSmsReportText({});
      expect(text).toContain("REPORT SIGHTING # Location not specified # Observed wildlife event");
    });
  });

  describe("CommunityReportScreen SMS UI & Fallback", () => {
    test("renders SMS offline reporting option card", () => {
      render(<CommunityReportScreen navigation={{ navigate: jest.fn() }} />);
      expect(screen.getByText("No Data? Report via SMS (1919)")).toBeTruthy();
    });

    test("toggles SMS section to view generated SMS preview", () => {
      render(<CommunityReportScreen navigation={{ navigate: jest.fn() }} />);

      // Initially closed
      expect(screen.queryByText("Generated SMS Preview:")).toBeNull();

      // Toggle open
      const toggleBtn = screen.getByLabelText("Toggle SMS Reporting Options");
      fireEvent.press(toggleBtn);

      expect(screen.getByText("Generated SMS Preview:")).toBeTruthy();
      expect(screen.getByText("Open SMS App")).toBeTruthy();
      expect(screen.getByText("Test Gateway")).toBeTruthy();
    });

    test("opens native SMS app with pre-filled message body when tapped", async () => {
      render(<CommunityReportScreen navigation={{ navigate: jest.fn() }} />);

      // Toggle open
      fireEvent.press(screen.getByLabelText("Toggle SMS Reporting Options"));

      const openSmsBtn = screen.getByText("Open SMS App");
      fireEvent.press(openSmsBtn);

      await waitFor(() => {
        expect(Linking.canOpenURL).toHaveBeenCalled();
        expect(Linking.openURL).toHaveBeenCalledWith(
          expect.stringContaining("sms:1919?body=")
        );
      });
    });

    test("triggers simulated SMS gateway submission and displays confirmation", async () => {
      simulateSmsReport.mockResolvedValueOnce({
        success: true,
        replyText: "WildGuard LK: Safety report #SMS101 received. Type: WILDLIFE SIGHTING. Location: Community Buffer Zone. Thank you for helping protect wildlife.",
        report: {
          id: "rep-sms-sim-101",
          reportType: "WILDLIFE_SIGHTING",
          description: "Observed wildlife activity near settlement boundary",
          status: "PENDING",
        },
      });

      render(<CommunityReportScreen navigation={{ navigate: jest.fn() }} />);

      // Toggle open
      fireEvent.press(screen.getByLabelText("Toggle SMS Reporting Options"));

      const testGatewayBtn = screen.getByText("Test Gateway");
      fireEvent.press(testGatewayBtn);

      await waitFor(() => {
        expect(simulateSmsReport).toHaveBeenCalledWith(
          expect.objectContaining({
            senderPhone: "+94771234567",
            message: expect.stringContaining("REPORT SIGHTING"),
          })
        );
        expect(NativeAlert.alert).toHaveBeenCalledWith(
          "SMS Report Ingested",
          expect.stringContaining("Safety report #SMS101 received")
        );
      });
    });
  });
});
