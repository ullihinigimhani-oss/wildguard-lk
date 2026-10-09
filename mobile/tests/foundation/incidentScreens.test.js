import { kickSync } from "../../src/services/offlineSync";
import LocalDrafts from "../../src/components/incident/LocalDrafts";
import { useOffline } from "../../src/hooks/useOffline";
import * as offlineStore from "../../src/storage/offlineStorage";
jest.mock("../../src/hooks/useOffline", () => ({ useOffline: jest.fn() }));
jest.mock("../../src/storage/offlineStorage", () => ({ offlineId: jest.fn(() => "local-id"), cachedPatrols: jest.fn(), readDraft: jest.fn(), saveDraft: jest.fn(), listDrafts: jest.fn() }));
jest.mock("../../src/services/offlineSync", () => ({ kickSync: jest.fn(async () => {}) }));
import React from "react";
import { act, fireEvent, render, waitFor } from "@testing-library/react-native";
import { RefreshControl } from "react-native";
import Landing from "../../src/screens/incident/RangerIncidentScreen";
import Form from "../../src/screens/incident/ReportIncidentScreen";
import Details from "../../src/screens/incident/IncidentDetailsScreen";
import Reports from "../../src/screens/incident/MyIncidentReportsScreen";
import useRangerPatrols from "../../src/hooks/useRangerPatrols";
import useForegroundLocation from "../../src/hooks/useForegroundLocation";
import { getMyPatrol } from "../../src/services/patrolApi";
import * as picker from "expo-image-picker";
import * as documents from "expo-document-picker";
import { File } from "expo-file-system";
import { uploadIncidentEvidence } from "../../src/services/incidentEvidenceApi";
jest.mock("expo-image-picker", () => ({
  requestCameraPermissionsAsync: jest.fn(),
  requestMediaLibraryPermissionsAsync: jest.fn(),
  launchCameraAsync: jest.fn(),
  launchImageLibraryAsync: jest.fn(),
}));
jest.mock("expo-document-picker", () => ({ getDocumentAsync: jest.fn() }));
jest.mock("expo-file-system", () => ({
  Paths: { document: "file:///owned/" },
  File: jest.fn(() => ({ exists: true, size: 1000 })),
}));
jest.mock("../../src/services/incidentEvidenceApi", () => ({
  ...jest.requireActual("../../src/services/incidentEvidenceApi"),
  uploadIncidentEvidence: jest.fn(),
}));
jest.setTimeout(15000);
import {
  createIncident,
  editIncident,
  getIncident,
  listPatrolIncidents,
  withdrawIncident,
} from "../../src/services/incidentApi";
let mockPrevent,
  mockFocused = true;
jest.mock("@expo/vector-icons/Ionicons", () => require("react-native").View);
jest.mock("@react-navigation/native", () => ({
  useIsFocused: () => mockFocused,
  useFocusEffect: (callback) => {
    const React = require("react");
    React.useEffect(
      () => (mockFocused ? callback() : undefined),
      [callback, mockFocused],
    );
  },
  usePreventRemove: (enabled, callback) => {
    mockPrevent = enabled ? callback : null;
  },
}));
jest.mock("../../src/hooks/useAuth", () => ({
  useAuth: () => ({ user: { id: "r", name: "Authenticated Ranger" } }),
}));
jest.mock("../../src/hooks/useRangerPatrols", () => jest.fn());
jest.mock("../../src/hooks/useForegroundLocation", () => jest.fn());
jest.mock("../../src/services/patrolApi", () => ({ getMyPatrol: jest.fn() }));
jest.mock("../../src/services/incidentApi", () => ({
  createIncident: jest.fn(),
  editIncident: jest.fn(),
  getIncident: jest.fn(),
  listPatrolIncidents: jest.fn(),
  withdrawIncident: jest.fn(),
}));
const patrol = {
  id: "p",
  routeName: "Boundary patrol",
  park: { name: "Actual Park" },
  status: "IN_PROGRESS",
  ranger: { id: "r" },
};
const incident = {
  id: "i",
  patrolId: "p",
  reporterId: "r",
  reporter: { name: "Authenticated Ranger" },
  park: patrol.park,
  patrol,
  title: "Snare at stream",
  incidentType: "POACHING_SNARE",
  description: "Wire snare near the stream",
  status: "PENDING",
  occurredAt: "2026-01-01T04:30:00Z",
  latitude: 7.2,
  longitude: 80.2,
  evidenceCount: 0,
  evidence: [],
};
const nav = () => ({
  setParams: jest.fn(),
  navigate: jest.fn(),
  replace: jest.fn(),
  dispatch: jest.fn(),
});
beforeEach(() => {
  jest.resetAllMocks();
  useOffline.mockReturnValue(null);
  offlineStore.listDrafts.mockResolvedValue([]);
  offlineStore.offlineId.mockReturnValue("local-id");
  kickSync.mockResolvedValue(undefined);
  mockFocused = true;
  mockPrevent = null;
  File.mockImplementation((parent, name) => ({
    uri: name ? parent + name : parent,
    exists: true,
    size: 1000,
    copy: async (destination) => {
      destination.size = 1000;
    },
    delete: jest.fn(),
  }));
  picker.requestCameraPermissionsAsync.mockResolvedValue({ granted: true });
  picker.requestMediaLibraryPermissionsAsync.mockResolvedValue({
    granted: true,
  });
  picker.launchImageLibraryAsync.mockResolvedValue({
    canceled: false,
    assets: [
      {
        uri: "file:///a.jpg",
        fileName: "a.jpg",
        mimeType: "image/jpeg",
        fileSize: 1000,
      },
    ],
  });
  picker.launchCameraAsync.mockResolvedValue({
    canceled: false,
    assets: [
      {
        uri: "file:///a.jpg",
        fileName: "a.jpg",
        mimeType: "image/jpeg",
        fileSize: 1000,
      },
    ],
  });
  uploadIncidentEvidence.mockResolvedValue({ id: "e" });
  getMyPatrol.mockResolvedValue(patrol);
  getIncident.mockResolvedValue(incident);
  createIncident.mockResolvedValue(incident);
  editIncident.mockResolvedValue(incident);
  withdrawIncident.mockResolvedValue({
    ...incident,
    withdrawnAt: "2026-01-01T05:00:00Z",
    withdrawn: true,
  });
  listPatrolIncidents.mockResolvedValue({
    incidents: [incident],
    total: 1,
    page: 1,
    pageSize: 25,
  });
  useRangerPatrols.mockReturnValue({
    patrols: [patrol],
    loading: false,
    error: null,
    refresh: jest.fn(),
  });
  useForegroundLocation.mockReturnValue({
    position: null,
    waiting: false,
    error: null,
    retry: jest.fn(),
    openSettings: jest.fn(),
  });
});
async function form(edit = false, navigation = nav()) {
  const ui = render(
    <Form
      route={{ params: edit ? { incidentId: "i" } : { patrolId: "p" } }}
      navigation={navigation}
    />,
  );
  await waitFor(() =>
    expect(ui.getByLabelText("Incident title *")).toBeTruthy(),
  );
  return { ui, navigation };
}
function fill(ui) {
  fireEvent.press(ui.getByLabelText("Poaching / Snare"));
  fireEvent.changeText(
    ui.getByLabelText("Incident title *"),
    "Snare at stream",
  );
  fireEvent.changeText(
    ui.getByLabelText("Description *"),
    "Wire snare near the stream",
  );
  fireEvent.changeText(ui.getByLabelText("Occurred date *"), "2026-01-01");
  fireEvent.changeText(ui.getByLabelText("Occurred time *"), "10:00");
  fireEvent.press(ui.getByLabelText("Enter known coordinates manually"));
  fireEvent.changeText(ui.getByLabelText("Latitude *"), "7.2");
  fireEvent.changeText(ui.getByLabelText("Longitude *"), "80.2");
}
test("active patrol selection and contextual actions use actual selected ID", () => {
  useRangerPatrols.mockReturnValue({
    patrols: [patrol, { ...patrol, id: "p2", routeName: "South boundary" }],
    loading: false,
  });
  const navigation = nav(),
    ui = render(<Landing navigation={navigation} />);
  fireEvent.press(ui.getByLabelText("South boundary"));
  fireEvent.press(ui.getByLabelText("Report New Incident"));
  expect(navigation.navigate).toHaveBeenLastCalledWith("IncidentCreate", {
    patrolId: "p2",
  });
  fireEvent.press(ui.getByLabelText("My Incident Reports"));
  expect(navigation.navigate).toHaveBeenLastCalledWith("IncidentReports", {
    patrolId: "p2",
  });
});
test("no active patrol blocks create but completed report history remains accessible", () => {
  useRangerPatrols.mockReturnValue({
    patrols: [{ ...patrol, status: "COMPLETED" }],
    loading: false,
  });
  const navigation = nav(),
    ui = render(<Landing navigation={navigation} />);
  expect(ui.getByText("No active patrol")).toBeTruthy();
  expect(ui.queryByLabelText("Report New Incident")).toBeNull();
  fireEvent.press(ui.getByLabelText("Go to My Patrols"));
  expect(navigation.navigate).toHaveBeenCalledWith("Patrol");
  fireEvent.press(ui.getByLabelText("View reports: Boundary patrol"));
  expect(navigation.navigate).toHaveBeenLastCalledWith("IncidentReports", {
    patrolId: "p",
  });
});
test("type selection, required validation and optional evidence picker without early permissions", async () => {
  const { ui } = await form();
  fireEvent.press(ui.getByLabelText("Submit Incident"));
  expect(ui.getByText("Select an incident type.")).toBeTruthy();
  expect(createIncident).not.toHaveBeenCalled();
  fireEvent.press(ui.getByLabelText("Animal Carcass"));
  expect(
    ui.getByLabelText("Animal Carcass").props.accessibilityState.checked,
  ).toBe(true);
  expect(ui.getByLabelText("Choose from Gallery")).toBeTruthy();
  expect(ui.queryByLabelText("Manage Evidence")).toBeNull();
  expect(useForegroundLocation).toHaveBeenLastCalledWith(false);
});

async function selectEvidence(ui, count = 1) {
  picker.launchImageLibraryAsync.mockResolvedValue({
    canceled: false,
    assets: Array.from({ length: count }, (_, index) => ({
      uri: `file:///${index}.jpg`,
      fileName: `${index}.jpg`,
      mimeType: "image/jpeg",
      fileSize: 1000,
    })),
  });
  fireEvent.press(ui.getByLabelText("Choose from Gallery"));
  await ui.findByLabelText("Selected evidence: 0.jpg");
}
test("pre-submit evidence selection, removal, field edits and validation preserve a guarded draft", async () => {
  const { ui } = await form();
  await selectEvidence(ui, 2);
  expect(createIncident).not.toHaveBeenCalled();
  expect(uploadIncidentEvidence).not.toHaveBeenCalled();
  fireEvent.changeText(ui.getByLabelText("Incident title *"), "Draft");
  fireEvent.press(ui.getByLabelText("Submit Incident"));
  expect(ui.getByLabelText("Selected evidence: 0.jpg")).toBeTruthy();
  fireEvent.press(ui.getByLabelText("Remove selection: 1.jpg"));
  expect(ui.queryByLabelText("Selected evidence: 1.jpg")).toBeNull();
  act(() => mockPrevent({ data: { action: { type: "GO_BACK" } } }));
  fireEvent.press(ui.getByLabelText("Keep Editing"));
  expect(ui.getByLabelText("Selected evidence: 0.jpg")).toBeTruthy();
});
test("five-item limit disables selection and rejects oversized picker batches", async () => {
  const { ui } = await form();
  await selectEvidence(ui, 5);
  expect(
    ui.getByLabelText("Take Photo").props.accessibilityState.disabled,
  ).toBe(true);
  fireEvent.press(ui.getByLabelText("Remove selection: 4.jpg"));
  picker.launchImageLibraryAsync.mockResolvedValue({
    canceled: false,
    assets: [0, 1].map((index) => ({
      uri: `file:///extra${index}.jpg`,
      fileName: `extra${index}.jpg`,
      fileSize: 1000,
    })),
  });
  fireEvent.press(ui.getByLabelText("Choose from Gallery"));
  await ui.findByText(/Maximum five evidence items/);
  expect(ui.queryByLabelText("Selected evidence: extra0.jpg")).toBeNull();
});
test("creation precedes sequential uploads and prevents duplicate submissions", async () => {
  let finish;
  createIncident.mockReturnValue(
    new Promise((resolve) => {
      finish = resolve;
    }),
  );
  const { ui, navigation } = await form();
  fill(ui);
  await selectEvidence(ui, 2);
  fireEvent.press(ui.getByLabelText("Submit Incident"));
  fireEvent.press(ui.getByLabelText("Submit Incident"));
  await waitFor(() => expect(createIncident).toHaveBeenCalledTimes(1));
  expect(uploadIncidentEvidence).not.toHaveBeenCalled();
  expect(ui.getByText("Saving incident...")).toBeTruthy();
  await act(async () => finish(incident));
  await waitFor(() =>
    expect(navigation.replace).toHaveBeenCalledWith("IncidentDetails", {
      incidentId: "i",
      confirmation: "created",
    }),
  );
  expect(uploadIncidentEvidence.mock.calls.map((call) => call[1].name)).toEqual(
    ["0.jpg", "1.jpg"],
  );
  expect(getIncident).toHaveBeenCalledWith("i");
});
test("partial failure retains incident and retries only failed evidence with the same identity", async () => {
  uploadIncidentEvidence
    .mockResolvedValueOnce({ id: "e1" })
    .mockRejectedValueOnce({ response: { status: 503 } })
    .mockResolvedValue({ id: "e2" });
  const { ui, navigation } = await form();
  fill(ui);
  await selectEvidence(ui, 2);
  fireEvent.press(ui.getByLabelText("Submit Incident"));
  await ui.findByText("Incident saved, but some evidence failed.");
  expect(navigation.replace).not.toHaveBeenCalled();
  expect(ui.getAllByText("Evidence saved")).toHaveLength(1);
  fireEvent.press(ui.getByLabelText("View Saved Incident"));
  expect(ui.getByText("Discard unsaved changes?")).toBeTruthy();
  fireEvent.press(ui.getByLabelText("Keep Editing"));
  expect(ui.getByLabelText("Selected evidence: 1.jpg")).toBeTruthy();
  const key = uploadIncidentEvidence.mock.calls[1][1].uploadKey;
  fireEvent.press(ui.getByLabelText("Retry Failed Uploads"));
  await waitFor(() => expect(navigation.replace).toHaveBeenCalled());
  expect(createIncident).toHaveBeenCalledTimes(1);
  expect(uploadIncidentEvidence).toHaveBeenCalledTimes(3);
  expect(uploadIncidentEvidence.mock.calls[2][0]).toBe("i");
  expect(uploadIncidentEvidence.mock.calls[2][1].uploadKey).toBe(key);
  expect(
    uploadIncidentEvidence.mock.calls.filter(
      (call) => call[1].name === "0.jpg",
    ),
  ).toHaveLength(1);
});
test("creation failure preserves selections; unavailable iOS files require reselection before saving", async () => {
  createIncident.mockRejectedValue({ response: { status: 503 } });
  const { ui } = await form();
  fill(ui);
  await selectEvidence(ui);
  fireEvent.press(ui.getByLabelText("Submit Incident"));
  await waitFor(() => expect(createIncident).toHaveBeenCalledTimes(1));
  await waitFor(() =>
    expect(
      ui.getByLabelText("Submit Incident").props.accessibilityState.disabled,
    ).toBe(false),
  );
  expect(ui.getByLabelText("Selected evidence: 0.jpg")).toBeTruthy();
  File.mockImplementation(() => ({ exists: false, size: 0 }));
  fireEvent.press(ui.getByLabelText("Submit Incident"));
  await ui.findByText(/unavailable.*select it again/);
  expect(createIncident).toHaveBeenCalledTimes(1);
});
test("editing shows existing evidence separately and uploads only newly selected files", async () => {
  getIncident.mockResolvedValue({
    ...incident,
    evidenceCount: 4,
    evidence: [1, 2, 3, 4].map((id) => ({
      id: `existing${id}`,
      originalFileName: `saved${id}.jpg`,
    })),
  });
  const { ui, navigation } = await form(true);
  expect(ui.getByText("Already uploaded")).toBeTruthy();
  await selectEvidence(ui);
  expect(
    ui.getByLabelText("Take Photo").props.accessibilityState.disabled,
  ).toBe(true);
  fireEvent.press(ui.getByLabelText("Save Changes"));
  await waitFor(() => expect(navigation.replace).toHaveBeenCalled());
  expect(editIncident).not.toHaveBeenCalled();
  expect(createIncident).not.toHaveBeenCalled();
  expect(uploadIncidentEvidence).toHaveBeenCalledTimes(1);
  expect(uploadIncidentEvidence.mock.calls[0][1].name).toBe("0.jpg");
});
test("camera capture and manual trap evidence validate metadata before incident creation", async () => {
  const { ui } = await form();
  fill(ui);
  fireEvent.press(ui.getByLabelText("Take Photo"));
  await ui.findByLabelText("Selected evidence: a.jpg");
  expect(picker.requestCameraPermissionsAsync).toHaveBeenCalledTimes(1);
  documents.getDocumentAsync.mockResolvedValue({
    canceled: false,
    assets: [
      {
        uri: "file:///trap.mov",
        name: "trap.mov",
        mimeType: "video/quicktime",
        size: 1000,
      },
    ],
  });
  fireEvent.press(ui.getByLabelText("Import Camera Trap Evidence"));
  await ui.findByLabelText("Camera trap ID: trap.mov");
  fireEvent.press(ui.getByLabelText("Submit Incident"));
  await ui.findByText(/Enter the camera trap ID/);
  expect(createIncident).not.toHaveBeenCalled();
  fireEvent.changeText(ui.getByLabelText("Camera trap ID: trap.mov"), "Trap-1");
  fireEvent.press(ui.getByLabelText("Submit Incident"));
  await waitFor(() => expect(uploadIncidentEvidence).toHaveBeenCalledTimes(2));
});
test("text-only create waits for backend, prevents double taps, uses numeric GPS and confirmed ID", async () => {
  let resolve;
  createIncident.mockReturnValue(
    new Promise((r) => {
      resolve = r;
    }),
  );
  const { ui, navigation } = await form();
  fill(ui);
  fireEvent.press(ui.getByLabelText("Submit Incident"));
  fireEvent.press(ui.getByLabelText("Submit Incident"));
  expect(createIncident).toHaveBeenCalledTimes(1);
  expect(navigation.replace).not.toHaveBeenCalled();
  expect(createIncident).toHaveBeenCalledWith("p", {
    title: incident.title,
    description: incident.description,
    incidentType: "POACHING_SNARE",
    occurredAt: "2026-01-01T10:00:00+05:30",
    latitude: 7.2,
    longitude: 80.2,
  });
  await act(async () => resolve({ ...incident, id: "server-id" }));
  expect(navigation.replace).toHaveBeenCalledWith("IncidentDetails", {
    incidentId: "server-id",
    confirmation: "created",
  });
});
test("new form instances allow independent incidents on the same patrol", async () => {
  const first = await form();
  fill(first.ui);
  fireEvent.press(first.ui.getByLabelText("Submit Incident"));
  await waitFor(() => expect(first.navigation.replace).toHaveBeenCalled());
  first.ui.unmount();
  createIncident.mockResolvedValue({ ...incident, id: "second" });
  const second = await form();
  expect(second.ui.getByLabelText("Incident title *").props.value).toBe("");
  fill(second.ui);
  fireEvent.press(second.ui.getByLabelText("Submit Incident"));
  await waitFor(() =>
    expect(second.navigation.replace).toHaveBeenCalledWith("IncidentDetails", {
      incidentId: "second",
      confirmation: "created",
    }),
  );
  expect(createIncident).toHaveBeenCalledTimes(2);
});
test.each([401, 403, 404, 409, 503, undefined])(
  "failure %s preserves draft and does not show success",
  async (status) => {
    createIncident.mockRejectedValue({ response: { status } });
    const { ui, navigation } = await form();
    fill(ui);
    fireEvent.press(ui.getByLabelText("Submit Incident"));
    await waitFor(() =>
      expect(
        ui.getByText(
          /Your session has expired|permission|no longer available|has changed|Evidence uploads are unavailable|Unable to reach/,
        ),
      ).toBeTruthy(),
    );
    expect(ui.getByLabelText("Incident title *").props.value).toBe(
      incident.title,
    );
    expect(navigation.replace).not.toHaveBeenCalled();
  },
);
test("400 maps server fields while keeping input", async () => {
  createIncident.mockRejectedValue({
    response: {
      status: 400,
      data: { errors: { title: "Server title validation" } },
    },
  });
  const { ui } = await form();
  fill(ui);
  fireEvent.press(ui.getByLabelText("Submit Incident"));
  await ui.findByText("Server title validation");
  expect(ui.getByLabelText("Incident title *").props.value).toBe(
    incident.title,
  );
});
test("409 completion refresh locks submission without discarding draft", async () => {
  const { ui } = await form();
  fill(ui);
  createIncident.mockRejectedValue({ response: { status: 409 } });
  getMyPatrol.mockResolvedValue({ ...patrol, status: "COMPLETED" });
  fireEvent.press(ui.getByLabelText("Submit Incident"));
  await ui.findByText(/This report is read-only/);
  expect(
    ui.getByLabelText("Submit Incident").props.accessibilityState.disabled,
  ).toBe(true);
  expect(ui.getByLabelText("Description *").props.value).toBe(
    incident.description,
  );
});
test("discard protection keeps draft or dispatches original back action", async () => {
  const { ui, navigation } = await form();
  expect(mockPrevent).toBeNull();
  fireEvent.changeText(ui.getByLabelText("Incident title *"), "Draft report");
  const action = { type: "GO_BACK" };
  act(() => mockPrevent({ data: { action } }));
  expect(ui.getByText("Discard unsaved changes?")).toBeTruthy();
  fireEvent.press(ui.getByLabelText("Keep Editing"));
  expect(navigation.dispatch).not.toHaveBeenCalled();
  expect(ui.getByLabelText("Incident title *").props.value).toBe(
    "Draft report",
  );
  act(() => mockPrevent({ data: { action } }));
  fireEvent.press(ui.getByLabelText("Discard Changes"));
  expect(navigation.dispatch).toHaveBeenCalledWith(action);
});
test.each(["PERMISSION_DENIED", "SERVICES_DISABLED", "INVALID_FIX"])(
  "GPS %s has error/retry and never fabricates coordinates",
  async (code) => {
    const gps = {
      position: null,
      waiting: false,
      error: "Location unavailable for live patrol navigation.",
      errorCode: code,
      canOpenSettings: code === "PERMISSION_DENIED",
      retry: jest.fn(),
      openSettings: jest.fn(),
    };
    useForegroundLocation.mockReturnValue(gps);
    const { ui } = await form();
    fireEvent.press(ui.getByLabelText("Use Current GPS Location"));
    expect(useForegroundLocation).toHaveBeenLastCalledWith(true);
    expect(
      ui.getByText("Location unavailable for incident location."),
    ).toBeTruthy();
    fireEvent.press(ui.getByLabelText("Retry GPS"));
    expect(gps.retry).toHaveBeenCalled();
    if (gps.canOpenSettings) {
      fireEvent.press(ui.getByLabelText("Open Settings"));
      expect(gps.openSettings).toHaveBeenCalled();
    }
    fireEvent.press(ui.getByLabelText("Cancel GPS capture"));
    fireEvent.press(ui.getByLabelText("Submit Incident"));
    expect(createIncident).not.toHaveBeenCalled();
  },
);
test("valid GPS capture stops watcher and stale capture requires explicit confirmation", async () => {
  const { ui } = await form();
  fill(ui);
  fireEvent.press(ui.getByLabelText("Hide manual coordinates"));
  const fix = {
    latitude: 7.25,
    longitude: 80.25,
    accuracy: 12,
    timestamp: Date.now(),
  };
  useForegroundLocation.mockReturnValue({
    position: fix,
    waiting: false,
    retry: jest.fn(),
  });
  fireEvent.press(ui.getByLabelText("Use Current GPS Location"));
  await waitFor(() => expect(ui.getByText(/Accuracy: 12 m/)).toBeTruthy());
  expect(useForegroundLocation).toHaveBeenLastCalledWith(false);
  const clock = jest.spyOn(Date, "now").mockReturnValue(fix.timestamp + 31000);
  fireEvent.press(ui.getByLabelText("Submit Incident"));
  expect(createIncident).not.toHaveBeenCalled();
  expect(ui.getByText(/GPS fix is older/)).toBeTruthy();
  fireEvent.press(ui.getByLabelText("Confirm captured incident location"));
  fireEvent.press(ui.getByLabelText("Submit Incident"));
  await waitFor(() =>
    expect(createIncident).toHaveBeenCalledWith(
      "p",
      expect.objectContaining({ latitude: 7.25, longitude: 80.25 }),
    ),
  );
  clock.mockRestore();
});
test("edit prepopulates and PATCHes same incident with unchanged association", async () => {
  const { ui, navigation } = await form(true);
  expect(ui.getByLabelText("Incident title *").props.value).toBe(
    incident.title,
  );
  fireEvent.changeText(
    ui.getByLabelText("Incident title *"),
    "Updated snare report",
  );
  fireEvent.press(ui.getByLabelText("Save Changes"));
  await waitFor(() =>
    expect(editIncident).toHaveBeenCalledWith(
      "i",
      expect.objectContaining({ title: "Updated snare report" }),
    ),
  );
  expect(createIncident).not.toHaveBeenCalled();
  expect(editIncident.mock.calls[0][1]).not.toHaveProperty("patrolId");
  await waitFor(() =>
    expect(navigation.replace).toHaveBeenCalledWith("IncidentDetails", {
      incidentId: "i",
      confirmation: "edited",
    }),
  );
});
test.each(["COMPLETED", "CANCELLED", "SCHEDULED"])(
  "%s form cannot create or edit",
  async (status) => {
    getMyPatrol.mockResolvedValue({ ...patrol, status });
    getIncident.mockResolvedValue({
      ...incident,
      patrol: { ...patrol, status },
    });
    const create = await form();
    expect(
      create.ui.getByLabelText("Submit Incident").props.accessibilityState
        .disabled,
    ).toBe(true);
    create.ui.unmount();
    const edit = await form(true);
    expect(
      edit.ui.getByLabelText("Save Changes").props.accessibilityState.disabled,
    ).toBe(true);
    expect(createIncident).not.toHaveBeenCalled();
    expect(editIncident).not.toHaveBeenCalled();
  },
);
test("list loading, multiple reports, withdrawn filter, detail navigation and refresh", async () => {
  listPatrolIncidents.mockResolvedValue({
    incidents: [
      incident,
      { ...incident, id: "i2", title: "Second report" },
      {
        ...incident,
        id: "i3",
        title: "Withdrawn report",
        withdrawnAt: "2026-01-01",
      },
    ],
    total: 3,
    page: 1,
    pageSize: 25,
  });
  const navigation = nav(),
    ui = render(
      <Reports route={{ params: { patrolId: "p" } }} navigation={navigation} />,
    );
  expect(ui.getByLabelText("Loading incident data")).toBeTruthy();
  await ui.findByText("Second report");
  expect(ui.queryByText("Withdrawn report")).toBeNull();
  fireEvent.press(ui.getByLabelText("Open report: Second report"));
  expect(navigation.navigate).toHaveBeenCalledWith("IncidentDetails", {
    incidentId: "i2",
  });
  fireEvent.press(ui.getByLabelText("Include withdrawn history"));
  await ui.findByText("Withdrawn report");
  expect(listPatrolIncidents).toHaveBeenLastCalledWith(
    "p",
    expect.objectContaining({ includeWithdrawn: true }),
  );
  act(() => ui.UNSAFE_getByType(RefreshControl).props.onRefresh());
  await waitFor(() => expect(listPatrolIncidents).toHaveBeenCalledTimes(3));
});
test("list error/retry, empty, pagination and focus refresh cancel pending reads", async () => {
  listPatrolIncidents
    .mockRejectedValueOnce(new Error("offline"))
    .mockResolvedValue({ incidents: [], total: 26, page: 1, pageSize: 25 });
  const ui = render(
    <Reports route={{ params: { patrolId: "p" } }} navigation={nav()} />,
  );
  await ui.findByLabelText("Retry");
  fireEvent.press(ui.getByLabelText("Retry"));
  await ui.findByText("No incident reports");
  fireEvent.press(ui.getByLabelText("Next page"));
  await waitFor(() =>
    expect(listPatrolIncidents).toHaveBeenLastCalledWith(
      "p",
      expect.objectContaining({ page: 2 }),
    ),
  );
  await ui.findByLabelText("Previous page");
  const signal = listPatrolIncidents.mock.calls.at(-1)[1].signal;
  mockFocused = false;
  ui.rerender(
    <Reports route={{ params: { patrolId: "p" } }} navigation={nav()} />,
  );
  expect(signal.aborted).toBe(true);
  mockFocused = true;
  ui.rerender(
    <Reports route={{ params: { patrolId: "p" } }} navigation={nav()} />,
  );
  await waitFor(() => expect(listPatrolIncidents).toHaveBeenCalledTimes(4));
  ui.unmount();
  expect(listPatrolIncidents.mock.calls.at(-1)[1].signal.aborted).toBe(true);
});
test("details show real fields and metadata; editing navigates with correct ID", async () => {
  getIncident.mockResolvedValue({
    ...incident,
    evidenceCount: 1,
    evidence: [
      {
        id: "e",
        fileType: "VIDEO",
        caption: "Camera trap capture",
        metadata: { source: "CAMERA_TRAP", cameraTrapId: "trap-7" },
      },
    ],
  });
  const navigation = nav(),
    ui = render(
      <Details
        route={{ params: { incidentId: "i", confirmation: "created" } }}
        navigation={navigation}
      />,
    );
  await ui.findByText("Snare at stream");
  expect(ui.getByText("Authenticated Ranger")).toBeTruthy();
  expect(ui.getByText("trap-7")).toBeTruthy();
  expect(ui.getByText("Incident submitted")).toBeTruthy();
  fireEvent.press(ui.getByLabelText("Edit Incident"));
  expect(navigation.navigate).toHaveBeenCalledWith("IncidentEdit", {
    incidentId: "i",
  });
  fireEvent.press(ui.getByLabelText("Report Another Incident"));
  expect(navigation.navigate).toHaveBeenLastCalledWith("IncidentCreate", {
    patrolId: "p",
  });
});
test.each([
  { patrol: { ...patrol, status: "COMPLETED" } },
  { patrol: { ...patrol, status: "CANCELLED" } },
  { status: "UNDER_REVIEW" },
  { withdrawnAt: "2026-01-01" },
  { reporterId: "other" },
])("locked details hide mutations %j", async (overrides) => {
  getIncident.mockResolvedValue({ ...incident, ...overrides });
  const ui = render(
    <Details route={{ params: { incidentId: "i" } }} navigation={nav()} />,
  );
  await ui.findByText("Read-only report");
  expect(ui.queryByLabelText("Edit Incident")).toBeNull();
  expect(ui.queryByLabelText("Withdraw Incident")).toBeNull();
  expect(ui.getByText(incident.description)).toBeTruthy();
});
test("withdraw requires confirmation, keep cancels, soft withdrawal updates readonly details", async () => {
  const ui = render(
    <Details route={{ params: { incidentId: "i" } }} navigation={nav()} />,
  );
  await ui.findByLabelText("Withdraw Incident");
  fireEvent.press(ui.getByLabelText("Withdraw Incident"));
  expect(withdrawIncident).not.toHaveBeenCalled();
  expect(ui.getByText(/retained in the system's records/)).toBeTruthy();
  fireEvent.press(ui.getByLabelText("Keep Report"));
  expect(ui.queryByText("Withdraw this incident?")).toBeNull();
  fireEvent.press(ui.getByLabelText("Withdraw Incident"));
  getIncident.mockResolvedValue({ ...incident, withdrawnAt: "2026-01-01" });
  fireEvent.press(ui.getByLabelText("Withdraw Incident"));
  fireEvent.press(ui.getByLabelText("Withdraw Incident"));
  await ui.findByText("Read-only report");
  expect(withdrawIncident).toHaveBeenCalledTimes(1);
  expect(withdrawIncident).toHaveBeenCalledWith("i");
  expect(ui.getAllByText("Withdrawn").length).toBeGreaterThan(0);
});
test("withdraw conflict refreshes authoritative completed state", async () => {
  const ui = render(
    <Details route={{ params: { incidentId: "i" } }} navigation={nav()} />,
  );
  await ui.findByLabelText("Withdraw Incident");
  fireEvent.press(ui.getByLabelText("Withdraw Incident"));
  withdrawIncident.mockRejectedValue({ response: { status: 409 } });
  getIncident.mockResolvedValue({
    ...incident,
    patrol: { ...patrol, status: "COMPLETED" },
  });
  fireEvent.press(ui.getByLabelText("Withdraw Incident"));
  await ui.findByText("Read-only report");
  expect(ui.queryByLabelText("Withdraw Incident")).toBeNull();
});

test("incident-only edit leaves precise occurrence timestamp and other fields intact", async () => {
  getIncident.mockResolvedValue({
    ...incident,
    occurredAt: "2026-01-01T04:30:45.123Z",
  });
  const { ui } = await form(true);
  fireEvent.changeText(ui.getByLabelText("Incident title *"), "Revised title");
  fireEvent.press(ui.getByLabelText("Save Changes"));
  await waitFor(() =>
    expect(editIncident).toHaveBeenCalledWith("i", { title: "Revised title" }),
  );
});

test("details navigates eligible owner to evidence for the saved incident and hides upload after completion", async () => {
  const navigation = nav();
  const ui = render(
    <Details route={{ params: { incidentId: "i" } }} navigation={navigation} />,
  );
  await ui.findByLabelText("Add Evidence");
  fireEvent.press(ui.getByLabelText("Add Evidence"));
  expect(navigation.navigate).toHaveBeenCalledWith("IncidentEvidence", {
    incidentId: "i",
  });
  ui.unmount();
  getIncident.mockResolvedValue({
    ...incident,
    patrol: { ...patrol, status: "COMPLETED" },
  });
  const completed = render(
    <Details route={{ params: { incidentId: "i" } }} navigation={nav()} />,
  );
  await completed.findByText("Read-only report");
  expect(completed.queryByLabelText("Add Evidence")).toBeNull();
});

test("offline form saves a partial draft without HTTP submission", async () => {
  useOffline.mockReturnValue({ owner: "r", online: false }); offlineStore.cachedPatrols.mockResolvedValue([patrol]);
  offlineStore.saveDraft.mockResolvedValue("local-id");
  const { ui } = await form(); fireEvent.changeText(ui.getByLabelText("Incident title *"), "Offline notes");
  fireEvent.press(ui.getByLabelText("Save Draft on Device"));
  await waitFor(() => expect(ui.getByText("Draft saved on device")).toBeTruthy());
  expect(offlineStore.saveDraft.mock.calls[0][3].title).toBe("Offline notes");
  expect(offlineStore.saveDraft.mock.calls[0][6]).toBe(false); expect(createIncident).not.toHaveBeenCalled(); expect(getMyPatrol).not.toHaveBeenCalled();
});
test("offline submit validates then queues once, without claiming server success", async () => {
  useOffline.mockReturnValue({ owner: "r", online: false }); offlineStore.cachedPatrols.mockResolvedValue([patrol]);
  offlineStore.saveDraft.mockResolvedValue("local-id"); offlineStore.readDraft.mockResolvedValue({ status: "PENDING_SYNC" });
  const { ui, navigation } = await form(); fill(ui);
  fireEvent.press(ui.getByLabelText("Submit Incident")); fireEvent.press(ui.getByLabelText("Submit Incident"));
  await waitFor(() => expect(ui.getByText("Saved on device — Pending Sync")).toBeTruthy());
  expect(offlineStore.saveDraft).toHaveBeenCalledTimes(1); expect(offlineStore.saveDraft.mock.calls[0][6]).toBe(true);
  expect(createIncident).not.toHaveBeenCalled(); expect(navigation.replace).not.toHaveBeenCalled();
  expect(navigation.setParams).toHaveBeenCalledWith({ localDraftId: "local-id" });
  expect(ui.queryByLabelText("Submit Incident")).toBeNull();
});
test("saved local draft reopens in the existing form with owned evidence", async () => {
  useOffline.mockReturnValue({ owner: "r", online: false }); offlineStore.cachedPatrols.mockResolvedValue([patrol]);
  offlineStore.readDraft.mockResolvedValue({ form: { title: "Stored draft", description: "Offline observations", incidentType: "POACHING_SNARE", date: "2026-01-01", time: "10:00", latitude: "7.2", longitude: "80.2" }, items: [], status: "LOCAL_DRAFT" });
  const ui = render(<Form route={{ params: { patrolId: "p", localDraftId: "local-id" } }} navigation={nav()} />);
  await waitFor(() => expect(ui.getByLabelText("Incident title *").props.value).toBe("Stored draft"));
  expect(offlineStore.readDraft).toHaveBeenCalledWith("r", "local-id"); expect(getMyPatrol).not.toHaveBeenCalled();
});

test("account switch hides the previous local draft before the new account query resolves", async () => {
  useOffline.mockReturnValue({ owner: "r", online: false });
  offlineStore.listDrafts.mockImplementation(owner => owner === "r" ? Promise.resolve([{ id: "local", patrol_id: "p", form: { title: "Private draft" }, status: "LOCAL_DRAFT" }]) : new Promise(() => {}));
  const navigation = nav(), ui = render(<LocalDrafts navigation={navigation} />);
  await ui.findByText("Private draft");
  useOffline.mockReturnValue({ owner: "other", online: false }); ui.rerender(<LocalDrafts navigation={navigation} />);
  expect(ui.queryByText("Private draft")).toBeNull();
});


test("queued form clears selections immediately without waiting for sync and keeps media referenced", async () => {
  kickSync.mockReturnValue(new Promise(() => {}));
  useOffline.mockReturnValue({ owner: "r", online: false });
  offlineStore.cachedPatrols.mockResolvedValue([patrol]);
  offlineStore.saveDraft.mockResolvedValue("local-id");
  offlineStore.readDraft.mockResolvedValue({ status: "PENDING_SYNC" });
  const { ui } = await form(); fill(ui);
  fireEvent.press(ui.getByLabelText("Choose from Gallery"));
  await ui.findByLabelText("Remove selection: a.jpg");
  fireEvent.press(ui.getByLabelText("Submit Incident"));
  await ui.findByLabelText("Retry Sync");
  expect(ui.queryByLabelText("Submit Incident")).toBeNull();
  expect(ui.queryByLabelText("Incident title *")).toBeNull();
  expect(ui.queryByLabelText("Remove selection: a.jpg")).toBeNull();
  expect(offlineStore.saveDraft.mock.calls[0][5]).toHaveLength(1);
  expect(File.mock.results.every(result => !result.value.delete.mock.calls.length)).toBe(true);
});

test("failed local persistence preserves fields and retries the same UUID", async () => {
  useOffline.mockReturnValue({ owner: "r", online: false });
  offlineStore.cachedPatrols.mockResolvedValue([patrol]);
  offlineStore.saveDraft.mockRejectedValueOnce(new Error("Device storage full. Free space and retry.")).mockResolvedValue("local-id");
  offlineStore.readDraft.mockResolvedValue({ status: "PENDING_SYNC" });
  const { ui } = await form(); fill(ui);
  fireEvent.press(ui.getByLabelText("Choose from Gallery"));
  await ui.findByLabelText("Remove selection: a.jpg");
  fireEvent.press(ui.getByLabelText("Submit Incident"));
  await ui.findByText("Device storage full. Free space and retry.");
  expect(ui.getByLabelText("Remove selection: a.jpg")).toBeTruthy();
  expect(ui.getByLabelText("Incident title *").props.value).toBeTruthy();
  fireEvent.press(ui.getByLabelText("Submit Incident"));
  await ui.findByLabelText("Retry Sync");
  expect(offlineStore.offlineId).toHaveBeenCalledTimes(1);
  expect(offlineStore.saveDraft.mock.calls.map(call => call[2])).toEqual(["local-id", "local-id"]);
});

test.each(["PENDING_SYNC", "SYNCING", "SYNC_FAILED", "SYNCED", "NEEDS_REVIEW"])("remount of %s shows receipt instead of resubmittable form", async status => {
  useOffline.mockReturnValue({ owner: "r", online: false });
  offlineStore.cachedPatrols.mockResolvedValue([patrol]);
  offlineStore.readDraft.mockResolvedValue({ status, form: { title: "Already submitted" }, items: [], server_id: status === "SYNCED" ? "i" : null });
  const ui = render(<Form route={{ params: { patrolId: "p", localDraftId: "local-id" } }} navigation={nav()} />);
  await ui.findByLabelText("Retry Sync");
  expect(ui.queryByLabelText("Submit Incident")).toBeNull();
  expect(ui.queryByText("Already submitted")).toBeNull();
  expect(offlineStore.saveDraft).not.toHaveBeenCalled();
});

test("a delayed queued receipt read cannot replace a different opened draft", async () => {
  useOffline.mockReturnValue({ owner: "r", online: false });
  offlineStore.cachedPatrols.mockResolvedValue([patrol]);
  let resolveOld;
  offlineStore.readDraft.mockImplementation((owner, id) => id === "old" ? new Promise(resolve => { resolveOld = resolve; }) : Promise.resolve({ status: "LOCAL_DRAFT", form: { title: "Different draft" }, items: [] }));
  const navigation = nav();
  const ui = render(<Form route={{ params: { patrolId: "p", localDraftId: "old" } }} navigation={navigation} />);
  await waitFor(() => expect(resolveOld).toBeDefined());
  ui.rerender(<Form route={{ params: { patrolId: "p", localDraftId: "new-draft" } }} navigation={navigation} />);
  await waitFor(() => expect(ui.getByLabelText("Incident title *").props.value).toBe("Different draft"));
  await act(async () => resolveOld({ status: "SYNCED", server_id: "i" }));
  expect(ui.getByLabelText("Incident title *").props.value).toBe("Different draft");
});



test("automatic sync refreshes the receipt without restoring fields or creating another report", async () => {
  useOffline.mockReturnValue({ owner: "r", online: false });
  offlineStore.cachedPatrols.mockResolvedValue([patrol]);
  offlineStore.readDraft.mockResolvedValue({ status: "PENDING_SYNC" });
  const ui = render(<Form route={{ params: { patrolId: "p", localDraftId: "local-id" } }} navigation={nav()} />);
  await ui.findByLabelText("Retry Sync");
  await waitFor(() => expect(offlineStore.readDraft).toHaveBeenCalledTimes(2));
  offlineStore.readDraft.mockResolvedValue({ status: "SYNCED", server_id: "i", form: { title: "Old submitted title" }, items: [] });
  await ui.findByText("Incident synced", {}, { timeout: 6500 });
  expect(ui.getByLabelText("View Saved Incident")).toBeTruthy();
  expect(ui.queryByLabelText("Submit Incident")).toBeNull();
  expect(ui.queryByText("Old submitted title")).toBeNull();
  expect(offlineStore.saveDraft).not.toHaveBeenCalled();
  expect(createIncident).not.toHaveBeenCalled();
});
