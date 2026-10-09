import React from "react";
import { render, screen, fireEvent, waitFor } from "@testing-library/react-native";
import ReportStatusScreen, {
  formatDateTime,
  formatLocationSummary,
} from "../../src/screens/community/ReportStatusScreen";
import * as communityApi from "../../src/services/communityReportApi";
import * as MediaLibrary from "expo-media-library/legacy";
import { File } from "expo-file-system";
import { api } from "../../src/services/api";

jest.mock("../../src/services/communityReportApi", () => ({
  listMyReports: jest.fn(),
  getReportById: jest.fn(),
  resolveEvidenceUrl: jest.requireActual(
    "../../src/services/communityReportApi",
  ).resolveEvidenceUrl,
}));

jest.mock("expo-file-system", () => ({
  File: Object.assign(jest.fn(), { downloadFileAsync: jest.fn() }),
  Paths: { cache: "cache" },
}));

jest.mock("expo-media-library/legacy", () => ({
  requestPermissionsAsync: jest.fn(),
  saveToLibraryAsync: jest.fn(),
}));

describe("Task 7: My Community Reports Screen", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    MediaLibrary.requestPermissionsAsync.mockResolvedValue({ granted: true });
    File.downloadFileAsync.mockResolvedValue({
      uri: "file:///cache/wildguard-evidence.jpg",
    });
  });

  test("resolves backend-relative evidence paths to the configured server", () => {
    const originalBaseUrl = api.defaults.baseURL;
    api.defaults.baseURL = "https://wildguard.example/api";
    try {
      expect(
        communityApi.resolveEvidenceUrl("/uploads/evidence/photo.png"),
      ).toBe("https://wildguard.example/uploads/evidence/photo.png");
    } finally {
      api.defaults.baseURL = originalBaseUrl;
    }
  });

  test("helper functions format date/time and location summaries accurately", () => {
    expect(formatDateTime(null)).toBe("Date not recorded");
    expect(formatDateTime("invalid-date")).toBe("Date not recorded");
    expect(formatDateTime("2026-10-08T09:30:00.000Z")).toMatch(/2026/);

    expect(formatLocationSummary(null)).toBe("Location not recorded");
    expect(
      formatLocationSummary({ manualLocation: "Canal Road Sector 4", latitude: 6.54321, longitude: 80.12345 })
    ).toBe("Canal Road Sector 4 (6.5432, 80.1235)");
    expect(
      formatLocationSummary({ manualLocation: "Canal Road Sector 4" })
    ).toBe("Canal Road Sector 4");
    expect(
      formatLocationSummary({ latitude: 6.54321, longitude: 80.12345 })
    ).toBe("GPS: 6.5432, 80.1235");
  });

  test("displays report list with all required card fields (type, date/time, location, evidence indicator, status)", async () => {
    communityApi.listMyReports.mockResolvedValueOnce({
      success: true,
      total: 2,
      page: 1,
      pageSize: 10,
      reports: [
        {
          id: "rep-1",
          reportType: "WILDLIFE_SIGHTING",
          status: "UNDER_REVIEW",
          species: "Asian Elephant",
          description: "Elephant family crossing near bridge.",
          manualLocation: "Mahaweli bridge side",
          latitude: 7.1234,
          longitude: 80.9876,
          isAnonymous: false,
          submittedAt: "2026-10-08T08:15:00.000Z",
          evidence: [
            { id: "ev-1", fileUrl: "https://example.com/el1.jpg", fileType: "image/jpeg" },
            { id: "ev-2", fileUrl: "https://example.com/el2.jpg", fileType: "image/jpeg" },
          ],
        },
        {
          id: "rep-2",
          reportType: "SUSPICIOUS_ACTIVITY",
          status: "RESPONSE_IN_PROGRESS",
          description: "Cut fence wire detected.",
          manualLocation: "Boundary post 42",
          isAnonymous: true,
          submittedAt: "2026-10-08T07:00:00.000Z",
          evidence: [],
        },
      ],
    });

    render(<ReportStatusScreen navigation={{ navigate: jest.fn() }} />);

    await waitFor(() => {
      // 1. Report types
      expect(screen.getByText("WILDLIFE SIGHTING")).toBeTruthy();
      expect(screen.getByText("SUSPICIOUS ACTIVITY")).toBeTruthy();

      // 2. Statuses
      expect(screen.getByText("UNDER REVIEW")).toBeTruthy();
      expect(screen.getByText("RESPONSE IN PROGRESS")).toBeTruthy();

      // 3. Species
      expect(screen.getByText("Species: Asian Elephant")).toBeTruthy();

      // 4. Evidence indicators
      expect(screen.getByText("2 evidence items")).toBeTruthy();
      expect(screen.getByText("No evidence attached")).toBeTruthy();

      // 5. Anonymous tracking indicator
      expect(screen.getByText("ANONYMOUS")).toBeTruthy();

      // 6. Location summary
      expect(screen.getByText("Mahaweli bridge side (7.1234, 80.9876)")).toBeTruthy();
      expect(screen.getByText("Boundary post 42")).toBeTruthy();
    });
  });

  test("opens report details modal and displays full info and evidence items", async () => {
    const mockReport = {
      id: "rep-1",
      reportType: "WILDLIFE_SIGHTING",
      status: "UNDER_REVIEW",
      species: "Asian Elephant",
      description: "Elephant family crossing near bridge.",
      manualLocation: "Mahaweli bridge side",
      latitude: 7.1234,
      longitude: 80.9876,
      isAnonymous: false,
      submittedAt: "2026-10-08T08:15:00.000Z",
      evidence: [
        { id: "ev-1", fileUrl: "https://example.com/el1.jpg", fileType: "image/jpeg" },
      ],
    };

    communityApi.listMyReports.mockResolvedValueOnce({
      success: true,
      total: 1,
      page: 1,
      pageSize: 10,
      reports: [mockReport],
    });

    communityApi.getReportById.mockResolvedValueOnce(mockReport);

    render(<ReportStatusScreen navigation={{ navigate: jest.fn() }} />);

    await waitFor(() => {
      expect(screen.getByText("WILDLIFE SIGHTING")).toBeTruthy();
    });

    // Open report details
    fireEvent.press(screen.getByLabelText("Open report: WILDLIFE_SIGHTING"));

    await waitFor(() => {
      expect(communityApi.getReportById).toHaveBeenCalledWith("rep-1");
      expect(screen.getByText("REPORT DETAILS")).toBeTruthy();
      expect(screen.getByText("Current Status:")).toBeTruthy();
      expect(screen.getByText("Reported Species:")).toBeTruthy();
      expect(screen.getByText("Standard Submission (Identified)")).toBeTruthy();
      expect(screen.getByText("Evidence Indicator (1):")).toBeTruthy();
    });

    fireEvent.press(screen.getByLabelText("View evidence image 1"));
    expect(screen.getByLabelText("Close evidence preview")).toBeTruthy();
    expect(screen.getByLabelText("Evidence image 1")).toBeTruthy();

    fireEvent.press(screen.getByLabelText("Download image"));
    await waitFor(() => {
      expect(MediaLibrary.requestPermissionsAsync).toHaveBeenCalledWith(
        true,
        ["photo"],
      );
      expect(MediaLibrary.saveToLibraryAsync).toHaveBeenCalledWith(
        "file:///cache/wildguard-evidence.jpg",
      );
      expect(screen.getByText("Image saved to your photo library.")).toBeTruthy();
    });

    fireEvent.press(screen.getByLabelText("Close evidence preview"));

    // Close details modal
    fireEvent.press(screen.getByLabelText("Close details modal"));

    await waitFor(() => {
      expect(screen.queryByText("REPORT DETAILS")).toBeNull();
    });
  });

  test("filters reports by status when filter tab is tapped", async () => {
    communityApi.listMyReports.mockResolvedValue({
      success: true,
      total: 0,
      page: 1,
      pageSize: 10,
      reports: [],
    });

    render(<ReportStatusScreen navigation={{ navigate: jest.fn() }} />);

    await waitFor(() => {
      expect(communityApi.listMyReports).toHaveBeenCalledWith(
        expect.objectContaining({ page: 1 })
      );
    });

    // Tap Pending tab
    fireEvent.press(screen.getByLabelText("Filter Pending"));

    await waitFor(() => {
      expect(communityApi.listMyReports).toHaveBeenCalledWith(
        expect.objectContaining({ status: "PENDING", page: 1 })
      );
    });

    // Tap Resolved tab
    fireEvent.press(screen.getByLabelText("Filter Resolved"));

    await waitFor(() => {
      expect(communityApi.listMyReports).toHaveBeenCalledWith(
        expect.objectContaining({ status: "RESOLVED", page: 1 })
      );
    });
  });

  test("renders empty state with navigation CTA to report incident", async () => {
    const mockNavigate = jest.fn();
    communityApi.listMyReports.mockResolvedValueOnce({
      success: true,
      total: 0,
      page: 1,
      pageSize: 10,
      reports: [],
    });

    render(<ReportStatusScreen navigation={{ navigate: mockNavigate }} />);

    await waitFor(() => {
      expect(screen.getByText("No Reports Found")).toBeTruthy();
      expect(screen.getByText("You haven't filed any wildlife reports yet.")).toBeTruthy();
      expect(screen.getByText("Report an Incident")).toBeTruthy();
    });

    fireEvent.press(screen.getByText("Report an Incident"));
    expect(mockNavigate).toHaveBeenCalledWith("Report");
  });

  test("renders error state and handles retry", async () => {
    communityApi.listMyReports.mockRejectedValueOnce(new Error("Network connection failed"));

    render(<ReportStatusScreen navigation={{ navigate: jest.fn() }} />);

    await waitFor(() => {
      expect(screen.getByText("Network connection failed")).toBeTruthy();
      expect(screen.getByText("Retry")).toBeTruthy();
    });

    communityApi.listMyReports.mockResolvedValueOnce({
      success: true,
      total: 1,
      page: 1,
      pageSize: 10,
      reports: [
        {
          id: "rep-recovered",
          reportType: "WILDLIFE_SIGHTING",
          status: "PENDING",
          description: "Recovered report after retry.",
          submittedAt: "2026-10-08T09:00:00.000Z",
        },
      ],
    });

    fireEvent.press(screen.getByText("Retry"));

    await waitFor(() => {
      expect(screen.getByText("Recovered report after retry.")).toBeTruthy();
    });
  });

  test("supports pagination when reports count exceeds page size", async () => {
    communityApi.listMyReports.mockResolvedValueOnce({
      success: true,
      total: 15,
      page: 1,
      pageSize: 10,
      reports: Array(10).fill(null).map((_, i) => ({
        id: `rep-${i}`,
        reportType: "WILDLIFE_SIGHTING",
        status: "PENDING",
        description: `Elephant sighting record ${i}`,
        submittedAt: "2026-10-08T09:00:00.000Z",
      })),
    });

    render(<ReportStatusScreen navigation={{ navigate: jest.fn() }} />);

    await waitFor(() => {
      expect(screen.getByText("Page 1 of 2")).toBeTruthy();
      expect(screen.getByText("Next")).toBeTruthy();
      expect(screen.getByText("Previous")).toBeTruthy();
    });

    communityApi.listMyReports.mockResolvedValueOnce({
      success: true,
      total: 15,
      page: 2,
      pageSize: 10,
      reports: Array(5).fill(null).map((_, i) => ({
        id: `rep-page2-${i}`,
        reportType: "WILDLIFE_SIGHTING",
        status: "PENDING",
        description: `Elephant sighting record on page 2 - ${i}`,
        submittedAt: "2026-10-08T09:00:00.000Z",
      })),
    });

    fireEvent.press(screen.getByText("Next"));

    await waitFor(() => {
      expect(communityApi.listMyReports).toHaveBeenCalledWith(
        expect.objectContaining({ page: 2 })
      );
    });
  });
});
