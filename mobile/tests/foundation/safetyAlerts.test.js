import React from "react";
import { render, screen, fireEvent, waitFor } from "@testing-library/react-native";
import { Share, Alert as NativeAlert } from "react-native";
import AlertsScreen from "../../src/screens/alerts/AlertsScreen";
import AlertDetailsScreen, {
  formatAlertDetailTime,
  getAlertTypeLabel,
} from "../../src/screens/alerts/AlertDetailsScreen";
import AlertCard, {
  formatAlertDate,
  formatAffectedArea,
} from "../../src/components/AlertCard";
import * as alertApi from "../../src/services/alertApi";

jest.mock("../../src/services/alertApi", () => ({
  listAlerts: jest.fn(),
  getAlertById: jest.fn(),
  acknowledgeAlert: jest.fn(),
  markAlertAsRead: jest.fn(),
  getUnreadAlertsCount: jest.fn(),
  markAllAlertsAsRead: jest.fn(),
}));

jest.mock("../../src/hooks/useAuth", () => ({
  useAuth: () => ({
    user: { id: "user-test-1", name: "Community Member", role: "COMMUNITY_USER" },
  }),
}));

describe("Task 9: Community Safety & Wildlife Alerts", () => {
  const mockActiveAlerts = [
    {
      id: "alert-1",
      riskLevel: "CRITICAL",
      title: "CRITICAL Wildlife Alert - Sector 3 Buffer",
      shortMessage: "Elephant herd spotted crossing near residential perimeter.",
      message: "Elephant herd spotted crossing near residential perimeter.",
      status: "ACTIVE",
      isAcknowledged: false,
      generatedAt: "2026-10-08T08:00:00.000Z",
      affectedArea: "Sector 3 Buffer (Yala National Park)",
      animal: { species: "Elephas maximus", animalCode: "ELE-01" },
      riskZone: {
        name: "Sector 3 Buffer",
        centerLatitude: 6.35,
        centerLongitude: 81.42,
        radiusMeters: 500,
        park: { name: "Yala National Park" },
      },
      safetyInstructions: [
        "Avoid using torch lights directly at the herd.",
        "Clear all pathways and avoid travel along boundary tracks.",
      ],
    },
    {
      id: "alert-2",
      riskLevel: "MEDIUM",
      title: "MEDIUM Wildlife Alert - Northern Ridge",
      shortMessage: "Leopard track observed near waterhole.",
      message: "Leopard track observed near waterhole.",
      status: "ACTIVE",
      isAcknowledged: true,
      generatedAt: "2026-10-08T07:30:00.000Z",
      affectedArea: "Northern Ridge (Yala National Park)",
      animal: { species: "Panthera pardus kotiya" },
      riskZone: { name: "Northern Ridge" },
      safetyInstructions: ["Maintain standard caution around forest buffers."],
    },
  ];

  const mockResolvedAlert = {
    id: "alert-3",
    riskLevel: "HIGH",
    title: "HIGH Wildlife Alert - Southern Canal",
    shortMessage: "Crocodile sighted in irrigation stream.",
    message: "Crocodile sighted in irrigation stream.",
    status: "RESOLVED",
    resolvedAt: "2026-10-08T09:00:00.000Z",
    isAcknowledged: true,
    generatedAt: "2026-10-08T06:00:00.000Z",
    affectedArea: "Southern Canal",
    riskZone: { name: "Southern Canal" },
    safetyInstructions: ["Avoid swimming or washing cattle in canal."],
  };

  beforeEach(() => {
    jest.clearAllMocks();
    jest.spyOn(NativeAlert, "alert").mockImplementation(() => {});
    jest.spyOn(Share, "share").mockResolvedValue({ action: "sharedAction" });
    alertApi.markAlertAsRead.mockResolvedValue({ success: true, readAt: "2026-10-08T08:30:00.000Z" });
    alertApi.getUnreadAlertsCount.mockResolvedValue({ success: true, unreadCount: 1 });
    alertApi.markAllAlertsAsRead.mockResolvedValue({ success: true });
  });

  afterEach(() => {
    NativeAlert.alert.mockRestore();
    if (Share.share.mockRestore) Share.share.mockRestore();
  });

  test("helper functions format date and affected area robustly", () => {
    expect(formatAlertDate(null)).toBe("Date not recorded");
    expect(formatAlertDate("invalid-date")).toBe("Date not recorded");
    expect(formatAlertDate("2026-10-08T08:00:00.000Z")).toMatch(/Oct/);

    expect(formatAffectedArea(null)).toBe("Unspecified Perimeter");
    expect(formatAffectedArea({ affectedArea: "Direct Area Name" })).toBe("Direct Area Name");
    expect(
      formatAffectedArea({
        riskZone: { name: "Buffer Zone", park: { name: "Wilpattu" } },
      })
    ).toBe("Buffer Zone (Wilpattu)");
    expect(
      formatAffectedArea({
        riskZone: { centerLatitude: 6.5432, centerLongitude: 80.1234 },
      })
    ).toBe("GPS: 6.5432, 80.1234");
    expect(formatAffectedArea({})).toBe("General Buffer Perimeter");
  });

  test("AlertCard displays severity, unread pill, title, area, and handles acknowledge action", () => {
    const onAcknowledge = jest.fn();
    const onPress = jest.fn();

    render(
      <AlertCard
        alert={mockActiveAlerts[0]}
        onPress={onPress}
        onAcknowledge={onAcknowledge}
      />
    );

    expect(screen.getByText("CRITICAL ALERT")).toBeTruthy();
    expect(screen.getByText("UNREAD")).toBeTruthy();
    expect(screen.getByText("CRITICAL Wildlife Alert - Sector 3 Buffer")).toBeTruthy();
    expect(screen.getByText("Sector 3 Buffer (Yala National Park)")).toBeTruthy();
    expect(screen.getByText("Elephas maximus")).toBeTruthy();

    const ackButton = screen.getByText("Acknowledge");
    fireEvent.press(ackButton);
    expect(onAcknowledge).toHaveBeenCalledTimes(1);

    const guidanceButton = screen.getByText("Safety Guidance");
    fireEvent.press(guidanceButton);
    expect(onPress).toHaveBeenCalledTimes(1);
  });

  test("AlertCard renders acknowledged read pill for already-acknowledged alert", () => {
    render(<AlertCard alert={mockActiveAlerts[1]} onPress={jest.fn()} />);

    expect(screen.getByText("MEDIUM ALERT")).toBeTruthy();
    expect(screen.getByText("READ")).toBeTruthy();
    expect(screen.getByText("Acknowledged")).toBeTruthy();
  });

  test("AlertsScreen loads active alerts, displays unread notice banner, and navigates to details", async () => {
    alertApi.listAlerts.mockResolvedValueOnce({
      success: true,
      alerts: mockActiveAlerts,
    });

    const navigation = { navigate: jest.fn() };
    render(<AlertsScreen navigation={navigation} />);

    // Initially loading
    expect(screen.getByText("Checking active safety alerts...")).toBeTruthy();

    await waitFor(() => {
      expect(screen.getByText("1 unacknowledged safety notice requires your attention.")).toBeTruthy();
    });

    expect(alertApi.listAlerts).toHaveBeenCalledWith(
      expect.objectContaining({ status: "ACTIVE" })
    );

    expect(screen.getByText("CRITICAL Wildlife Alert - Sector 3 Buffer")).toBeTruthy();
    expect(screen.getByText("MEDIUM Wildlife Alert - Northern Ridge")).toBeTruthy();

    // Click to open details
    const guidanceButtons = screen.getAllByText("Safety Guidance");
    fireEvent.press(guidanceButtons[0]);
    expect(navigation.navigate).toHaveBeenCalledWith("AlertDetails", {
      alertId: "alert-1",
      alertData: mockActiveAlerts[0],
    });
  });

  test("AlertsScreen acknowledges alert and updates unread status locally", async () => {
    alertApi.listAlerts.mockResolvedValueOnce({
      success: true,
      alerts: [mockActiveAlerts[0]],
    });
    alertApi.acknowledgeAlert.mockResolvedValueOnce({ success: true });

    render(<AlertsScreen navigation={{ navigate: jest.fn() }} />);

    await waitFor(() => {
      expect(screen.getByText("Acknowledge")).toBeTruthy();
    });

    fireEvent.press(screen.getByText("Acknowledge"));

    await waitFor(() => {
      expect(alertApi.acknowledgeAlert).toHaveBeenCalledWith("alert-1");
      expect(screen.getByText("Acknowledged")).toBeTruthy();
      expect(screen.getByText("READ")).toBeTruthy();
    });
  });

  test("AlertsScreen switches to Alert History tab and queries status=HISTORY", async () => {
    alertApi.listAlerts
      .mockResolvedValueOnce({ success: true, alerts: mockActiveAlerts })
      .mockResolvedValueOnce({ success: true, alerts: [mockResolvedAlert] });

    render(<AlertsScreen navigation={{ navigate: jest.fn() }} />);

    await waitFor(() => {
      expect(screen.getByText("CRITICAL Wildlife Alert - Sector 3 Buffer")).toBeTruthy();
    });

    // Switch to Alert History tab
    const historyTab = screen.getByLabelText("Alert History");
    fireEvent.press(historyTab);

    await waitFor(() => {
      expect(alertApi.listAlerts).toHaveBeenCalledWith(
        expect.objectContaining({ status: "HISTORY" })
      );
      expect(screen.getByText("HIGH Wildlife Alert - Southern Canal")).toBeTruthy();
      expect(screen.getByText("RESOLVED")).toBeTruthy();
    });
  });

  test("AlertsScreen filters by severity (riskLevel)", async () => {
    alertApi.listAlerts
      .mockResolvedValueOnce({ success: true, alerts: mockActiveAlerts })
      .mockResolvedValueOnce({ success: true, alerts: [mockActiveAlerts[0]] });

    render(<AlertsScreen navigation={{ navigate: jest.fn() }} />);

    await waitFor(() => {
      expect(screen.getByText("CRITICAL Wildlife Alert - Sector 3 Buffer")).toBeTruthy();
    });

    // Click Critical filter
    const criticalFilter = screen.getByLabelText("Filter Critical");
    fireEvent.press(criticalFilter);

    await waitFor(() => {
      expect(alertApi.listAlerts).toHaveBeenCalledWith(
        expect.objectContaining({ status: "ACTIVE", riskLevel: "CRITICAL" })
      );
    });
  });

  test("AlertsScreen handles empty state and refresh button", async () => {
    alertApi.listAlerts
      .mockResolvedValueOnce({ success: true, alerts: [] })
      .mockResolvedValueOnce({ success: true, alerts: mockActiveAlerts });

    render(<AlertsScreen navigation={{ navigate: jest.fn() }} />);

    await waitFor(() => {
      expect(screen.getByText("Perimeters Clear")).toBeTruthy();
      expect(
        screen.getByText("No critical wildlife alerts or active geofence breaches detected in this region.")
      ).toBeTruthy();
    });

    const refreshButton = screen.getByText("Refresh Alerts");
    fireEvent.press(refreshButton);

    await waitFor(() => {
      expect(alertApi.listAlerts).toHaveBeenCalledTimes(2);
      expect(screen.getByText("CRITICAL Wildlife Alert - Sector 3 Buffer")).toBeTruthy();
    });
  });

  test("AlertsScreen handles network error and allows retry", async () => {
    alertApi.listAlerts
      .mockRejectedValueOnce(new Error("Network Error"))
      .mockResolvedValueOnce({ success: true, alerts: mockActiveAlerts });

    render(<AlertsScreen navigation={{ navigate: jest.fn() }} />);

    await waitFor(() => {
      expect(screen.getByText("Network Error")).toBeTruthy();
      expect(screen.getByText("Retry")).toBeTruthy();
    });

    fireEvent.press(screen.getByText("Retry"));

    await waitFor(() => {
      expect(alertApi.listAlerts).toHaveBeenCalledTimes(2);
      expect(screen.getByText("CRITICAL Wildlife Alert - Sector 3 Buffer")).toBeTruthy();
    });
  });

  test("AlertDetailsScreen displays complete alert metadata, guidance, and allows acknowledging", async () => {
    const route = { params: { alertData: mockActiveAlerts[0] } };
    alertApi.acknowledgeAlert.mockResolvedValueOnce({ success: true });

    render(<AlertDetailsScreen route={route} navigation={{ goBack: jest.fn() }} />);

    expect(screen.getByText("CRITICAL SAFETY ALERT")).toBeTruthy();
    expect(screen.getByText("STATUS: ACTIVE")).toBeTruthy();
    expect(screen.getByText("CRITICAL Wildlife Alert - Sector 3 Buffer")).toBeTruthy();
    expect(screen.getByText("Species: Elephas maximus")).toBeTruthy();
    expect(screen.getByText("Collar Tracking Tag: ELE-01")).toBeTruthy();
    expect(screen.getByText("Area: Sector 3 Buffer (Yala National Park)")).toBeTruthy();
    expect(screen.getByText("Park: Yala National Park")).toBeTruthy();
    expect(screen.getByText("Coordinates: 6.3500, 81.4200")).toBeTruthy();
    expect(screen.getByText("Avoid using torch lights directly at the herd.")).toBeTruthy();

    // Acknowledge button
    const ackBtn = screen.getByText("Acknowledge This Alert");
    fireEvent.press(ackBtn);

    await waitFor(() => {
      expect(alertApi.acknowledgeAlert).toHaveBeenCalledWith("alert-1");
      expect(screen.getByText("✓ Alert Acknowledged")).toBeTruthy();
    });

    // Share button
    const shareBtn = screen.getByText("Share Alert with Community");
    fireEvent.press(shareBtn);
    expect(Share.share).toHaveBeenCalled();
  });

  test("AlertDetailsScreen loads by ID when alertData param is absent", async () => {
    const route = { params: { alertId: "alert-1" } };
    alertApi.getAlertById.mockResolvedValueOnce(mockActiveAlerts[0]);

    render(<AlertDetailsScreen route={route} navigation={{ goBack: jest.fn() }} />);

    await waitFor(() => {
      expect(alertApi.getAlertById).toHaveBeenCalledWith("alert-1");
      expect(screen.getByText("CRITICAL SAFETY ALERT")).toBeTruthy();
    });
  });

  test("Task 10 helper functions format detail time and alert type labels accurately", () => {
    expect(formatAlertDetailTime(null)).toBe("Date not recorded");
    expect(formatAlertDetailTime("invalid")).toBe("Date not recorded");
    expect(formatAlertDetailTime("2026-10-08T08:00:00.000Z")).toMatch(/2026/);

    expect(getAlertTypeLabel("WILDLIFE_PROXIMITY")).toBe("Wildlife Proximity Notice");
    expect(getAlertTypeLabel("ZONE_ADVISORY")).toBe("Perimeter Zone Advisory");
    expect(getAlertTypeLabel("HUMAN_WILDLIFE_CONFLICT")).toBe("Active Conflict Warning");
    expect(getAlertTypeLabel(null)).toBe("Community Safety Notice");
  });

  test("AlertDetailsScreen toggles map view when coordinates are present", () => {
    const route = { params: { alertData: mockActiveAlerts[0] } };
    render(<AlertDetailsScreen route={route} navigation={{ goBack: jest.fn() }} />);

    const mapButton = screen.getByLabelText("View on Map");
    expect(mapButton).toBeTruthy();

    fireEvent.press(mapButton);
    expect(screen.getByLabelText("Hide Map")).toBeTruthy();

    fireEvent.press(screen.getByLabelText("Hide Map"));
    expect(screen.getByLabelText("View on Map")).toBeTruthy();
  });

  test("AlertDetailsScreen handles missing alert (404) with back button", async () => {
    const route = { params: { alertId: "missing-1" } };
    alertApi.getAlertById.mockRejectedValueOnce({
      response: { status: 404, data: { message: "Alert not found." } },
    });

    const goBack = jest.fn();
    render(<AlertDetailsScreen route={route} navigation={{ goBack }} />);

    await waitFor(() => {
      expect(screen.getByText("Safety Alert Not Found")).toBeTruthy();
    });

    fireEvent.press(screen.getByText("Back to Alerts"));
    expect(goBack).toHaveBeenCalledTimes(1);
  });

  test("AlertDetailsScreen handles invalid alert ID with appropriate error UI", async () => {
    const route = { params: { alertId: "   " } };
    const goBack = jest.fn();

    render(<AlertDetailsScreen route={route} navigation={{ goBack }} />);

    expect(screen.getByText("Invalid Alert Reference")).toBeTruthy();
    expect(screen.getByText("Invalid alert identifier provided.")).toBeTruthy();

    fireEvent.press(screen.getByText("Back to Alerts"));
    expect(goBack).toHaveBeenCalledTimes(1);
  });

  test("AlertDetailsScreen handles network error with retry button", async () => {
    const route = { params: { alertId: "alert-1" } };
    alertApi.getAlertById
      .mockRejectedValueOnce(new Error("Network Error"))
      .mockResolvedValueOnce(mockActiveAlerts[0]);

    render(<AlertDetailsScreen route={route} navigation={{ goBack: jest.fn() }} />);

    await waitFor(() => {
      expect(screen.getByText("Unable to Load Alert")).toBeTruthy();
      expect(screen.getByText("Retry")).toBeTruthy();
    });

    fireEvent.press(screen.getByText("Retry"));

    await waitFor(() => {
      expect(screen.getByText("CRITICAL SAFETY ALERT")).toBeTruthy();
    });
  });

  test("AlertDetailsScreen displays resolved alert banner and resolved time", () => {
    const route = { params: { alertData: mockResolvedAlert } };
    render(<AlertDetailsScreen route={route} navigation={{ goBack: jest.fn() }} />);

    expect(screen.getByText("ALL CLEAR — ALERT RESOLVED")).toBeTruthy();
    expect(screen.getByText("STATUS: RESOLVED")).toBeTruthy();
    expect(screen.getByText("Alert Resolved (No Action Needed)")).toBeTruthy();
  });

  test("AlertDetailsScreen displays expired alert banner when active alert is expired", () => {
    const expiredAlert = {
      ...mockActiveAlerts[0],
      isExpired: true,
      isResolved: false,
      status: "ACTIVE",
    };
    const route = { params: { alertData: expiredAlert } };
    render(<AlertDetailsScreen route={route} navigation={{ goBack: jest.fn() }} />);

    expect(screen.getByText("NOTICE EXPIRED")).toBeTruthy();
    expect(screen.getByText("STATUS: EXPIRED")).toBeTruthy();
  });
});

describe("Task 11: Alert Read/Unread Management", () => {
  const unreadAlert = {
    id: "alert-unread-1",
    riskLevel: "HIGH",
    title: "HIGH Wildlife Alert - Sector 5",
    shortMessage: "Elephant herd spotted near village border.",
    message: "Elephant herd spotted near village border.",
    status: "ACTIVE",
    isAcknowledged: false,
    isRead: false,
    generatedAt: "2026-10-08T09:00:00.000Z",
    affectedArea: "Sector 5 (Yala)",
    riskZone: { name: "Sector 5" },
    safetyInstructions: ["Stay indoors."],
  };

  const readAlert = {
    id: "alert-read-2",
    riskLevel: "LOW",
    title: "LOW Wildlife Alert - Sector 2",
    shortMessage: "Deer spotted near road.",
    message: "Deer spotted near road.",
    status: "ACTIVE",
    isAcknowledged: true,
    isRead: true,
    readAt: "2026-10-08T09:15:00.000Z",
    generatedAt: "2026-10-08T08:00:00.000Z",
    affectedArea: "Sector 2 (Yala)",
    riskZone: { name: "Sector 2" },
    safetyInstructions: ["Drive carefully."],
  };

  beforeEach(() => {
    jest.clearAllMocks();
    jest.spyOn(NativeAlert, "alert").mockImplementation(() => {});
    alertApi.markAlertAsRead.mockResolvedValue({
      success: true,
      readAt: "2026-10-08T09:30:00.000Z",
    });
    alertApi.getUnreadAlertsCount.mockResolvedValue({ success: true, unreadCount: 1 });
    alertApi.markAllAlertsAsRead.mockResolvedValue({ success: true });
    alertApi.acknowledgeAlert.mockResolvedValue({ success: true });
  });

  afterEach(() => {
    if (NativeAlert.alert.mockRestore) NativeAlert.alert.mockRestore();
  });

  test("AlertCard displays UNREAD badge for unread alert and READ badge when marked as read", () => {
    const { unmount } = render(<AlertCard alert={unreadAlert} onPress={jest.fn()} />);
    expect(screen.getByText("UNREAD")).toBeTruthy();
    expect(screen.queryByText("READ")).toBeNull();
    unmount();

    render(<AlertCard alert={readAlert} onPress={jest.fn()} />);
    expect(screen.getByText("READ")).toBeTruthy();
    expect(screen.queryByText("UNREAD")).toBeNull();
  });

  test("AlertDetailsScreen automatically calls markAlertAsRead on mount for an unread active alert", async () => {
    const route = { params: { alertData: unreadAlert } };
    render(<AlertDetailsScreen route={route} navigation={{ goBack: jest.fn() }} />);

    await waitFor(() => {
      expect(alertApi.markAlertAsRead).toHaveBeenCalledWith("alert-unread-1");
    });
  });

  test("AlertDetailsScreen does NOT call markAlertAsRead when alert is already read or acknowledged", async () => {
    const route = { params: { alertData: readAlert } };
    render(<AlertDetailsScreen route={route} navigation={{ goBack: jest.fn() }} />);

    await waitFor(() => {
      expect(alertApi.markAlertAsRead).not.toHaveBeenCalled();
    });
  });

  test("AlertDetailsScreen handleAcknowledge optimistically marks alert acknowledged with rollback on error", async () => {
    const route = { params: { alertData: unreadAlert } };
    alertApi.acknowledgeAlert.mockRejectedValueOnce(new Error("Network timeout"));

    render(<AlertDetailsScreen route={route} navigation={{ goBack: jest.fn() }} />);

    // Click acknowledge button
    const ackBtn = screen.getByText("Acknowledge This Alert");
    fireEvent.press(ackBtn);

    // Immediately updates optimistically
    expect(screen.getByLabelText("✓ Alert Acknowledged")).toBeTruthy();

    // After failure, rolls back
    await waitFor(() => {
      expect(screen.getByText("Acknowledge This Alert")).toBeTruthy();
      expect(NativeAlert.alert).toHaveBeenCalledWith(
        "Error",
        expect.stringMatching(/Network timeout/)
      );
    });
  });

  test("AlertsScreen handleAcknowledge optimistically marks alert as read/acknowledged with rollback on error", async () => {
    alertApi.listAlerts.mockResolvedValueOnce({
      success: true,
      alerts: [unreadAlert],
    });
    alertApi.acknowledgeAlert.mockRejectedValueOnce(new Error("Server error"));

    render(<AlertsScreen navigation={{ navigate: jest.fn() }} />);

    await waitFor(() => {
      expect(screen.getByText("Acknowledge")).toBeTruthy();
    });

    fireEvent.press(screen.getByText("Acknowledge"));

    // Optimistically shows Acknowledged
    expect(screen.getByText("Acknowledged")).toBeTruthy();

    // Reverts on error
    await waitFor(() => {
      expect(screen.getByText("Acknowledge")).toBeTruthy();
      expect(screen.getByText("Server error")).toBeTruthy();
    });
  });

  test("AlertsScreen Mark All Read button optimistically clears unread notice and updates alerts", async () => {
    alertApi.listAlerts.mockResolvedValueOnce({
      success: true,
      alerts: [unreadAlert],
    });
    alertApi.markAllAlertsAsRead.mockResolvedValueOnce({ success: true });

    render(<AlertsScreen navigation={{ navigate: jest.fn() }} />);

    await waitFor(() => {
      expect(screen.getByText("1 unacknowledged safety notice requires your attention.")).toBeTruthy();
      expect(screen.getByText("Mark All Read")).toBeTruthy();
    });

    fireEvent.press(screen.getByText("Mark All Read"));

    // Optimistically clears unread banner and shows acknowledged
    await waitFor(() => {
      expect(alertApi.markAllAlertsAsRead).toHaveBeenCalled();
      expect(screen.queryByText("1 unacknowledged safety notice requires your attention.")).toBeNull();
      expect(screen.getByText("Acknowledged")).toBeTruthy();
    });
  });

  test("AlertsScreen Mark All Read button rolls back and displays error when backend call fails", async () => {
    alertApi.listAlerts.mockResolvedValueOnce({
      success: true,
      alerts: [unreadAlert],
    });
    alertApi.markAllAlertsAsRead.mockRejectedValueOnce(new Error("Failed to mark all read"));

    render(<AlertsScreen navigation={{ navigate: jest.fn() }} />);

    await waitFor(() => {
      expect(screen.getByText("Mark All Read")).toBeTruthy();
    });

    fireEvent.press(screen.getByText("Mark All Read"));

    // Reverts back on error and displays message
    await waitFor(() => {
      expect(screen.getByText("1 unacknowledged safety notice requires your attention.")).toBeTruthy();
      expect(screen.getByText("Failed to mark all read")).toBeTruthy();
    });
  });
});

describe("Task 12: Acknowledge Safety Alert (Explicit Acknowledgement)", () => {
  const readUnacknowledgedAlert = {
    id: "alert-read-unack",
    riskLevel: "CRITICAL",
    title: "CRITICAL Wildlife Alert - Border Ridge",
    shortMessage: "Elephant herd spotted near ridge.",
    message: "Elephant herd spotted near ridge.",
    status: "ACTIVE",
    isAcknowledged: false,
    isRead: true,
    readAt: "2026-10-08T09:00:00.000Z",
    generatedAt: "2026-10-08T08:00:00.000Z",
    affectedArea: "Border Ridge (Yala)",
    safetyInstructions: ["Stay inside secure shelters."],
  };

  const fullyAcknowledgedAlert = {
    id: "alert-ack-1",
    riskLevel: "HIGH",
    title: "HIGH Wildlife Alert - Sector 7",
    shortMessage: "Bear sighted near trail.",
    message: "Bear sighted near trail.",
    status: "ACTIVE",
    isAcknowledged: true,
    acknowledgedAt: "2026-10-08T09:45:00.000Z",
    isRead: true,
    readAt: "2026-10-08T09:10:00.000Z",
    userState: "ACKNOWLEDGED",
    generatedAt: "2026-10-08T08:30:00.000Z",
    affectedArea: "Sector 7 (Yala)",
    safetyInstructions: ["Avoid solo travel."],
  };

  const resolvedAlert = {
    id: "alert-resolved-1",
    riskLevel: "MEDIUM",
    title: "MEDIUM Wildlife Alert - Waterhole",
    shortMessage: "Animal returned to sanctuary.",
    message: "Animal returned to sanctuary.",
    status: "RESOLVED",
    resolvedAt: "2026-10-08T10:00:00.000Z",
    isAcknowledged: false,
    isRead: true,
    generatedAt: "2026-10-08T07:00:00.000Z",
    safetyInstructions: ["Perimeter is safe."],
  };

  const expiredAlert = {
    id: "alert-expired-1",
    riskLevel: "LOW",
    title: "LOW Wildlife Alert - Past Notice",
    shortMessage: "Past animal movement notice.",
    message: "Past animal movement notice.",
    status: "ACTIVE",
    isExpired: true,
    isAcknowledged: false,
    isRead: true,
    generatedAt: "2026-10-05T08:00:00.000Z",
    safetyInstructions: ["Historical advisory."],
  };

  beforeEach(() => {
    jest.clearAllMocks();
    jest.spyOn(NativeAlert, "alert").mockImplementation(() => {});
    alertApi.acknowledgeAlert.mockResolvedValue({
      success: true,
      message: "Alert acknowledged successfully. Stay safe and adhere to safety instructions.",
    });
    alertApi.markAlertAsRead.mockResolvedValue({ success: true });
  });

  afterEach(() => {
    if (NativeAlert.alert.mockRestore) NativeAlert.alert.mockRestore();
  });

  test("AlertCard distinguishes READ from ACKNOWLEDGED: allows acknowledging read alert", () => {
    const onAcknowledge = jest.fn();
    render(
      <AlertCard
        alert={readUnacknowledgedAlert}
        onPress={jest.fn()}
        onAcknowledge={onAcknowledge}
      />
    );

    // Shows READ badge in header, but Acknowledge button is still active
    expect(screen.getByText("READ")).toBeTruthy();
    const ackButton = screen.getByText("Acknowledge");
    expect(ackButton).toBeTruthy();

    fireEvent.press(ackButton);
    expect(onAcknowledge).toHaveBeenCalledTimes(1);
  });

  test("AlertCard renders Acknowledged indicator and no acknowledge button when already acknowledged", () => {
    render(<AlertCard alert={fullyAcknowledgedAlert} onPress={jest.fn()} />);

    expect(screen.getByText("Acknowledged")).toBeTruthy();
    expect(screen.queryByText("Acknowledge")).toBeNull();
  });

  test("AlertCard renders Resolved / Expired status and does not allow acknowledging non-applicable alerts", () => {
    const onAcknowledge = jest.fn();
    const { unmount } = render(
      <AlertCard alert={resolvedAlert} onPress={jest.fn()} onAcknowledge={onAcknowledge} />
    );

    expect(screen.getByText("Resolved")).toBeTruthy();
    expect(screen.queryByText("Acknowledge")).toBeNull();
    unmount();

    render(<AlertCard alert={expiredAlert} onPress={jest.fn()} onAcknowledge={onAcknowledge} />);
    expect(screen.getByText("Expired")).toBeTruthy();
    expect(screen.queryByText("Acknowledge")).toBeNull();
  });

  test("AlertDetailsScreen displays SAFETY INSTRUCTIONS ACKNOWLEDGED banner with formatted timestamp", () => {
    const route = { params: { alertData: fullyAcknowledgedAlert } };
    render(<AlertDetailsScreen route={route} navigation={{ goBack: jest.fn() }} />);

    expect(screen.getByText("SAFETY INSTRUCTIONS ACKNOWLEDGED")).toBeTruthy();
    expect(screen.getByText(/You confirmed understanding on/)).toBeTruthy();
    expect(screen.getByText("✓ Alert Acknowledged")).toBeTruthy();
  });

  test("AlertDetailsScreen provides confirmation feedback and enters acknowledged state upon button press", async () => {
    const route = { params: { alertData: readUnacknowledgedAlert } };
    render(<AlertDetailsScreen route={route} navigation={{ goBack: jest.fn() }} />);

    const ackBtn = screen.getByText("Acknowledge This Alert");
    fireEvent.press(ackBtn);

    await waitFor(() => {
      expect(alertApi.acknowledgeAlert).toHaveBeenCalledWith("alert-read-unack");
      expect(NativeAlert.alert).toHaveBeenCalledWith(
        "Acknowledged",
        expect.stringMatching(/acknowledged/)
      );
      expect(screen.getByText("SAFETY INSTRUCTIONS ACKNOWLEDGED")).toBeTruthy();
      expect(screen.getByText("✓ Alert Acknowledged")).toBeTruthy();
    });
  });

  test("AlertDetailsScreen disables acknowledge button for resolved and expired alerts", () => {
    const { unmount } = render(
      <AlertDetailsScreen route={{ params: { alertData: resolvedAlert } }} navigation={{ goBack: jest.fn() }} />
    );
    expect(screen.getByText("Alert Resolved (No Action Needed)")).toBeTruthy();
    unmount();

    render(
      <AlertDetailsScreen route={{ params: { alertData: expiredAlert } }} navigation={{ goBack: jest.fn() }} />
    );
    expect(screen.getByText("Notice Expired")).toBeTruthy();
  });
});


