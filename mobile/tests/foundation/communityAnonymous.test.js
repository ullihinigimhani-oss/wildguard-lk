import React from "react";
import { fireEvent, render, screen, waitFor } from "@testing-library/react-native";
import CommunityReportScreen from "../../src/screens/community/CommunityReportScreen";
import * as communityApi from "../../src/services/communityReportApi";

jest.mock("../../src/hooks/useAuth", () => ({
  useAuth: () => ({
    user: { id: "u-comm-88", name: "Sunil Silva", role: "COMMUNITY_USER" },
    isAuthenticated: true,
  }),
}));

jest.mock("../../src/services/communityReportApi", () => ({
  submitReport: jest.fn(),
  uploadEvidence: jest.fn(),
}));

describe("Community Report Anonymous Reporting (Task 6)", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  test("renders 'Submit anonymously' option unchecked by default", () => {
    render(<CommunityReportScreen navigation={{ navigate: jest.fn() }} />);

    const anonCheckbox = screen.getByRole("checkbox", { name: "Submit anonymously" });
    expect(anonCheckbox).toBeTruthy();
    expect(anonCheckbox.props.accessibilityState.checked).toBe(false);
    expect(screen.getByText(/Hide your identity on public and community-facing reports/)).toBeTruthy();
  });

  test("toggles anonymous option when pressed", () => {
    render(<CommunityReportScreen navigation={{ navigate: jest.fn() }} />);

    const anonCheckbox = screen.getByRole("checkbox", { name: "Submit anonymously" });
    expect(anonCheckbox.props.accessibilityState.checked).toBe(false);

    // Toggle on
    fireEvent.press(anonCheckbox);
    expect(anonCheckbox.props.accessibilityState.checked).toBe(true);

    // Toggle off
    fireEvent.press(anonCheckbox);
    expect(anonCheckbox.props.accessibilityState.checked).toBe(false);
  });

  test("submits an identified report (isAnonymous: false) attaching reporter name", async () => {
    communityApi.submitReport.mockResolvedValueOnce({
      success: true,
      report: {
        id: "rep-identified-1",
        reportType: "WILDLIFE_SIGHTING",
        status: "PENDING",
        isAnonymous: false,
        reporterName: "Sunil Silva",
      },
    });

    render(<CommunityReportScreen navigation={{ navigate: jest.fn() }} />);

    fireEvent.changeText(
      screen.getByPlaceholderText(
        "Describe what occurred, animal count, heading direction, behavior, or damages observed..."
      ),
      "Wild elephant crossing road near school boundary."
    );
    fireEvent.changeText(
      screen.getByPlaceholderText("e.g. Weerawila South, Kataragama border"),
      "Palatupana village entrance"
    );

    // Submit without checking anonymous
    fireEvent.press(screen.getByRole("button", { name: "Submit Incident Report" }));

    await waitFor(() => {
      expect(communityApi.submitReport).toHaveBeenCalledWith(
        expect.objectContaining({
          description: "Wild elephant crossing road near school boundary.",
          manualLocation: "Palatupana village entrance",
          isAnonymous: false,
          reporterName: "Sunil Silva",
        })
      );
    });

    // Confirmation screen displays identified status
    expect(await screen.findByText("Report Received")).toBeTruthy();
    expect(screen.getByText("Submission: Identified")).toBeTruthy();
  });

  test("submits an anonymous report (isAnonymous: true) omitting reporter name", async () => {
    communityApi.submitReport.mockResolvedValueOnce({
      success: true,
      report: {
        id: "rep-anon-2",
        reportType: "SUSPICIOUS_ACTIVITY",
        status: "PENDING",
        isAnonymous: true,
        reporterName: null,
      },
    });

    render(<CommunityReportScreen navigation={{ navigate: jest.fn() }} />);

    // Select Suspicious Activity
    fireEvent.press(screen.getByText("Suspicious Activity"));

    fireEvent.changeText(
      screen.getByPlaceholderText(
        "Describe what occurred, animal count, heading direction, behavior, or damages observed..."
      ),
      "Unregistered vehicle seen dropping illegal wire snares."
    );
    fireEvent.changeText(
      screen.getByPlaceholderText("e.g. Weerawila South, Kataragama border"),
      "Lunugamvehera sector 3 fence"
    );

    // Toggle anonymous checkbox
    fireEvent.press(screen.getByRole("checkbox", { name: "Submit anonymously" }));

    // Submit report
    fireEvent.press(screen.getByRole("button", { name: "Submit Incident Report" }));

    await waitFor(() => {
      expect(communityApi.submitReport).toHaveBeenCalledWith(
        expect.objectContaining({
          reportType: "SUSPICIOUS_ACTIVITY",
          description: "Unregistered vehicle seen dropping illegal wire snares.",
          manualLocation: "Lunugamvehera sector 3 fence",
          isAnonymous: true,
          reporterName: undefined,
        })
      );
    });

    // Confirmation screen displays anonymous status
    expect(await screen.findByText("Report Received")).toBeTruthy();
    expect(screen.getByText("Submission: Anonymous")).toBeTruthy();
  });

  test("resets anonymous toggle and inputs when submitting another report", async () => {
    communityApi.submitReport.mockResolvedValueOnce({
      success: true,
      report: {
        id: "rep-anon-3",
        reportType: "WILDLIFE_SIGHTING",
        status: "PENDING",
        isAnonymous: true,
      },
    });

    render(<CommunityReportScreen navigation={{ navigate: jest.fn() }} />);

    fireEvent.changeText(
      screen.getByPlaceholderText(
        "Describe what occurred, animal count, heading direction, behavior, or damages observed..."
      ),
      "Leopard resting near irrigation canal."
    );
    fireEvent.changeText(
      screen.getByPlaceholderText("e.g. Weerawila South, Kataragama border"),
      "Canal gate 4"
    );

    // Check anonymous
    fireEvent.press(screen.getByRole("checkbox", { name: "Submit anonymously" }));
    fireEvent.press(screen.getByRole("button", { name: "Submit Incident Report" }));

    expect(await screen.findByText("Report Received")).toBeTruthy();

    // Click submit another report
    fireEvent.press(screen.getByRole("button", { name: "Submit Another Report" }));

    expect(await screen.findByText("Report Wildlife / Conflict")).toBeTruthy();
    const checkbox = screen.getByRole("checkbox", { name: "Submit anonymously" });
    expect(checkbox.props.accessibilityState.checked).toBe(false);
  });
});
