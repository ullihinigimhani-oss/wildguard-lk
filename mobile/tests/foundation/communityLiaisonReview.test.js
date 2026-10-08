import React from "react";
import { render, screen, fireEvent, waitFor } from "@testing-library/react-native";
import LiaisonReviewScreen, {
  formatDateTime,
  formatLocationSummary,
} from "../../src/screens/community/LiaisonReviewScreen";
import * as communityApi from "../../src/services/communityReportApi";
import { Alert } from "react-native";

jest.mock("../../src/services/communityReportApi", () => ({
  listAllReports: jest.fn(),
  updateReportStatus: jest.fn(),
  escalateReport: jest.fn(),
  getReportById: jest.fn(),
}));

describe("Task 8: Community Liaison Report Review", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    jest.spyOn(Alert, "alert").mockImplementation((title, msg, buttons) => {
      // Auto confirm for test execution if buttons provided
      if (buttons && buttons.length > 1 && buttons[1].onPress) {
        buttons[1].onPress();
      }
    });
  });

  afterEach(() => {
    Alert.alert.mockRestore();
  });

  test("helper functions format date/time and location accurately", () => {
    expect(formatDateTime(null)).toBe("Date not recorded");
    expect(formatDateTime("2026-10-08T09:30:00.000Z")).toMatch(/2026/);

    expect(formatLocationSummary(null)).toBe("Location not recorded");
    expect(
      formatLocationSummary({ manualLocation: "Post 14", latitude: 6.5, longitude: 80.5 })
    ).toBe("Post 14 (6.5000, 80.5000)");
  });

  test("renders incoming reports with types, locations, evidence, and privacy-protected reporter info", async () => {
    communityApi.listAllReports.mockResolvedValueOnce({
      success: true,
      total: 2,
      page: 1,
      pageSize: 10,
      reports: [
        {
          id: "rep-anon-1",
          reportType: "HUMAN_WILDLIFE_CONFLICT",
          species: "Asian Elephant",
          description: "Elephant broke perimeter fence into agricultural block.",
          manualLocation: "North Boundary Fence Post 32",
          latitude: 6.1234,
          longitude: 81.2345,
          status: "PENDING",
          isAnonymous: true,
          reporterName: null,
          reporterPhone: null,
          submittedAt: "2026-10-08T09:00:00.000Z",
          evidence: [
            { id: "ev-1", fileUrl: "https://example.com/fence.jpg", fileType: "image/jpeg" },
          ],
        },
        {
          id: "rep-ident-2",
          reportType: "WILDLIFE_SIGHTING",
          species: "Sri Lankan Leopard",
          description: "Solitary leopard spotted near rock outcrop.",
          manualLocation: "Rock cluster sector B",
          status: "UNDER_REVIEW",
          isAnonymous: false,
          reporterName: "Sunil Silva",
          reporterPhone: "0719876543",
          submittedAt: "2026-10-08T08:30:00.000Z",
          evidence: [],
        },
      ],
    });

    render(<LiaisonReviewScreen />);

    await waitFor(() => {
      // 1. Report types & operational indicators
      expect(screen.getByText("HUMAN WILDLIFE CONFLICT")).toBeTruthy();
      expect(screen.getByText("CONFLICT RESPONSE")).toBeTruthy();
      expect(screen.getByText("WILDLIFE SIGHTING")).toBeTruthy();

      // 2. Anonymity without exposing protected identity
      expect(screen.getByText("ANONYMOUS")).toBeTruthy();
      expect(screen.getByText("Reporter: Anonymous Community Member")).toBeTruthy();
      expect(screen.getByText("Phone: Protected (Anonymous Report)")).toBeTruthy();

      // 3. Identified reporter shows name and call button
      expect(screen.getByText("Reporter: Sunil Silva")).toBeTruthy();
      expect(screen.getByText("Call")).toBeTruthy();

      // 4. Evidence count
      expect(screen.getByText("Evidence Files (1):")).toBeTruthy();

      // 5. Status badges
      expect(screen.getByText("PENDING")).toBeTruthy();
      expect(screen.getByText("UNDER REVIEW")).toBeTruthy();
    });
  });

  test("handles status transitions: Start Review, Mark Resolved, and Invalidate/Reject", async () => {
    communityApi.listAllReports.mockResolvedValue({
      success: true,
      total: 2,
      page: 1,
      pageSize: 10,
      reports: [
        {
          id: "rep-pending",
          reportType: "WILDLIFE_SIGHTING",
          description: "Spotted deer",
          status: "PENDING",
          submittedAt: "2026-10-08T09:00:00.000Z",
        },
        {
          id: "rep-review",
          reportType: "WILDLIFE_SIGHTING",
          description: "Elephant sighting",
          status: "UNDER_REVIEW",
          submittedAt: "2026-10-08T09:00:00.000Z",
        },
      ],
    });

    communityApi.updateReportStatus.mockResolvedValue({ success: true });

    render(<LiaisonReviewScreen />);

    await waitFor(() => {
      expect(screen.getByLabelText("Start Review")).toBeTruthy();
      expect(screen.getByLabelText("Mark Resolved")).toBeTruthy();
    });

    // 1. Start Review
    fireEvent.press(screen.getByLabelText("Start Review"));
    await waitFor(() => {
      expect(communityApi.updateReportStatus).toHaveBeenCalledWith("rep-pending", "UNDER_REVIEW");
    });

    // 2. Mark Resolved
    fireEvent.press(screen.getByLabelText("Mark Resolved"));
    await waitFor(() => {
      expect(communityApi.updateReportStatus).toHaveBeenCalledWith("rep-review", "RESOLVED");
    });

    // 3. Reject / Invalidate
    const rejectButtons = screen.getAllByLabelText("Reject Report");
    fireEvent.press(rejectButtons[0]);
    await waitFor(() => {
      expect(communityApi.updateReportStatus).toHaveBeenCalledWith("rep-pending", "REJECTED");
    });
  });

  test("dispatches operational escalation with urgency and review notes", async () => {
    communityApi.listAllReports.mockResolvedValueOnce({
      success: true,
      total: 1,
      page: 1,
      pageSize: 10,
      reports: [
        {
          id: "rep-conflict",
          reportType: "HUMAN_WILDLIFE_CONFLICT",
          description: "Elephant in village school compound",
          status: "UNDER_REVIEW",
          submittedAt: "2026-10-08T09:00:00.000Z",
        },
      ],
    });

    communityApi.escalateReport.mockResolvedValueOnce({
      success: true,
      message: "Community report escalated to operational response.",
    });

    render(<LiaisonReviewScreen />);

    await waitFor(() => {
      expect(screen.getByLabelText("Dispatch Response")).toBeTruthy();
    });

    // Tap Dispatch Response to open escalation modal
    fireEvent.press(screen.getByLabelText("Dispatch Response"));

    await waitFor(() => {
      expect(screen.getByText("OPERATIONAL ESCALATION")).toBeTruthy();
      expect(screen.getByText("Dispatch Urgency:")).toBeTruthy();
      expect(screen.getByText("Confirm Dispatch")).toBeTruthy();
    });

    // Enter optional review notes
    fireEvent.changeText(
      screen.getByPlaceholderText("E.g. Sent patrol unit, contacted area ranger..."),
      "Notified mobile patrol unit Alpha."
    );

    // Confirm dispatch
    fireEvent.press(screen.getByText("Confirm Dispatch"));

    await waitFor(() => {
      expect(communityApi.escalateReport).toHaveBeenCalledWith("rep-conflict", {
        urgency: "HIGH",
        notes: "Notified mobile patrol unit Alpha.",
      });
    });
  });

  test("filters by status tabs and category chips", async () => {
    communityApi.listAllReports.mockResolvedValue({
      success: true,
      total: 0,
      page: 1,
      pageSize: 10,
      reports: [],
    });

    render(<LiaisonReviewScreen />);

    await waitFor(() => {
      expect(communityApi.listAllReports).toHaveBeenCalledWith(
        expect.objectContaining({ status: "PENDING" })
      );
    });

    // Filter by Under Review status
    fireEvent.press(screen.getByLabelText("Status Under Review"));

    await waitFor(() => {
      expect(communityApi.listAllReports).toHaveBeenCalledWith(
        expect.objectContaining({ status: "UNDER_REVIEW" })
      );
    });

    // Filter by Conflicts category
    fireEvent.press(screen.getByLabelText("Category Conflicts"));

    await waitFor(() => {
      expect(communityApi.listAllReports).toHaveBeenCalledWith(
        expect.objectContaining({ reportType: "HUMAN_WILDLIFE_CONFLICT" })
      );
    });
  });

  test("handles keyword search with clear action", async () => {
    communityApi.listAllReports.mockResolvedValue({
      success: true,
      total: 0,
      page: 1,
      pageSize: 10,
      reports: [],
    });

    render(<LiaisonReviewScreen />);

    const searchInput = screen.getByPlaceholderText("Search species, location, description...");
    fireEvent.changeText(searchInput, "elephant");
    fireEvent.press(screen.getByText("Search"));

    await waitFor(() => {
      expect(communityApi.listAllReports).toHaveBeenCalledWith(
        expect.objectContaining({ search: "elephant" })
      );
    });

    // Clear search
    fireEvent.press(screen.getByLabelText("Clear search"));

    await waitFor(() => {
      expect(communityApi.listAllReports).toHaveBeenCalledWith(
        expect.not.objectContaining({ search: "elephant" })
      );
    });
  });
});
