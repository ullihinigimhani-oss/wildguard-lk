import React from "react";
import { act, fireEvent, render, waitFor } from "@testing-library/react-native";
import { Image } from "react-native";
import * as picker from "expo-image-picker";
import * as documents from "expo-document-picker";
import Screen from "../../src/screens/incident/IncidentEvidenceScreen";
import EvidenceMedia from "../../src/components/incident/EvidenceMedia";
import { getIncident } from "../../src/services/incidentApi";
import {
  getEvidenceAccess,
  uploadIncidentEvidence,
} from "../../src/services/incidentEvidenceApi";
jest.setTimeout(15000);
let mockPrevent,
  mockFocused = true;
jest.mock("@expo/vector-icons/Ionicons", () => require("react-native").View);
jest.mock("@react-navigation/native", () => ({
  useIsFocused: () => mockFocused,
  useFocusEffect: (callback) => {
    const React = require("react");
    React.useEffect(callback, [callback]);
  },
  usePreventRemove: (enabled, callback) => {
    mockPrevent = enabled ? callback : null;
  },
}));
jest.mock("../../src/hooks/useAuth", () => ({
  useAuth: () => ({ user: { id: "r" } }),
}));
jest.mock("../../src/services/incidentApi", () => ({ getIncident: jest.fn() }));
jest.mock("../../src/services/incidentEvidenceApi", () => ({
  ...jest.requireActual("../../src/services/incidentEvidenceApi"),
  getEvidenceAccess: jest.fn(),
  uploadIncidentEvidence: jest.fn(),
}));
jest.mock("expo-image-picker", () => ({
  requestCameraPermissionsAsync: jest.fn(),
  requestMediaLibraryPermissionsAsync: jest.fn(),
  launchCameraAsync: jest.fn(),
  launchImageLibraryAsync: jest.fn(),
}));
jest.mock("expo-document-picker", () => ({ getDocumentAsync: jest.fn() }));
jest.mock("expo-file-system", () => ({
  Paths: { document: "file:///owned/" },
  File: class {
    constructor(parent, name) {
      this.uri = name ? parent + name : parent;
      this.exists = true;
      this.size = 1000;
    }
    async copy(destination) {
      destination.size = this.size;
    }
    delete() {
      this.exists = false;
    }
  },
}));
const incident = {
  id: "i",
  title: "Snare report",
  reporterId: "r",
  status: "PENDING",
  evidenceCount: 0,
  evidence: [],
  patrol: { status: "IN_PROGRESS", ranger: { id: "r" } },
};
const photo = {
  uri: "file:///photo.jpg",
  fileName: "photo.jpg",
  mimeType: "image/jpeg",
  fileSize: 1000,
  type: "image",
};
const video = {
  uri: "file:///video.mp4",
  fileName: "video.mp4",
  mimeType: "video/mp4",
  fileSize: 2000,
  type: "video",
};
const nav = () => ({ navigate: jest.fn(), dispatch: jest.fn() });
beforeEach(() => {
  jest.resetAllMocks();
  mockPrevent = null;
  mockFocused = true;
  getIncident.mockResolvedValue(incident);
  uploadIncidentEvidence.mockResolvedValue({ id: "e" });
  picker.requestCameraPermissionsAsync.mockResolvedValue({ granted: true });
  picker.requestMediaLibraryPermissionsAsync.mockResolvedValue({
    granted: true,
  });
  picker.launchCameraAsync.mockResolvedValue({
    canceled: false,
    assets: [photo],
  });
  picker.launchImageLibraryAsync.mockResolvedValue({
    canceled: false,
    assets: [photo],
  });
  documents.getDocumentAsync.mockResolvedValue({
    canceled: false,
    assets: [{ ...video, name: "video.mp4", size: 2000 }],
  });
  getEvidenceAccess.mockResolvedValue({
    uri: "http://localhost/api/private-ticket-media",
    expiresAt: new Date(Date.now() + 300000).toISOString(),
  });
});
async function mount(navigation = nav()) {
  const ui = render(
    <Screen route={{ params: { incidentId: "i" } }} navigation={navigation} />,
  );
  await waitFor(() =>
    expect(
      ui.getByLabelText("Take Photo").props.accessibilityState.disabled,
    ).toBe(false),
  );
  return { ui, navigation };
}
test("camera permission is requested only after deliberate selection; denied permission does not create evidence", async () => {
  const { ui } = await mount();
  expect(picker.requestCameraPermissionsAsync).not.toHaveBeenCalled();
  picker.requestCameraPermissionsAsync.mockResolvedValue({ granted: false });
  fireEvent.press(ui.getByLabelText("Take Photo"));
  await ui.findByText(/Allow camera access/);
  expect(picker.launchCameraAsync).not.toHaveBeenCalled();
  expect(uploadIncidentEvidence).not.toHaveBeenCalled();
});
test("camera capture, gallery photos, gallery videos and manual camera trap imports use appropriate modes", async () => {
  const { ui } = await mount();
  fireEvent.press(ui.getByLabelText("Take Photo"));
  await ui.findByLabelText("Selected evidence: photo.jpg");
  fireEvent.press(ui.getByLabelText("Remove selection: photo.jpg"));
  fireEvent.press(ui.getByLabelText("Choose Photo from Gallery"));
  await ui.findByLabelText("Selected evidence: photo.jpg");
  expect(picker.launchImageLibraryAsync).toHaveBeenCalledWith(
    expect.objectContaining({
      mediaTypes: ["images"],
      allowsMultipleSelection: true,
    }),
  );
  fireEvent.press(ui.getByLabelText("Remove selection: photo.jpg"));
  picker.launchImageLibraryAsync.mockResolvedValue({
    canceled: false,
    assets: [video],
  });
  fireEvent.press(ui.getByLabelText("Choose Video from Gallery"));
  await ui.findByLabelText("Preview video: video.mp4");
  expect(picker.launchImageLibraryAsync).toHaveBeenLastCalledWith(
    expect.objectContaining({ mediaTypes: ["videos"] }),
  );
  fireEvent.press(ui.getByLabelText("Remove selection: video.mp4"));
  fireEvent.press(ui.getByLabelText("Import Camera Trap Photo/Video"));
  await ui.findByLabelText("Camera trap ID: video.mp4");
  expect(documents.getDocumentAsync).toHaveBeenCalledWith(
    expect.objectContaining({ copyToCacheDirectory: true, multiple: true }),
  );
});
test("multiple items upload independently with progress and duplicate-tap prevention after incident exists", async () => {
  picker.launchImageLibraryAsync.mockResolvedValue({
    canceled: false,
    assets: [
      photo,
      { ...photo, uri: "file:///second.jpg", fileName: "second.jpg" },
    ],
  });
  let finish;
  uploadIncidentEvidence.mockImplementation((id, item, progress) => {
    progress(48);
    return new Promise((resolve) => {
      finish = resolve;
    });
  });
  const { ui } = await mount();
  fireEvent.press(ui.getByLabelText("Choose Photo from Gallery"));
  await ui.findByLabelText("Upload Evidence: photo.jpg");
  fireEvent.press(ui.getByLabelText("Upload Evidence: photo.jpg"));
  fireEvent.press(ui.getByLabelText("Upload Evidence: photo.jpg"));
  expect(uploadIncidentEvidence).toHaveBeenCalledTimes(1);
  expect(ui.getByText("Uploading securely · 48%")).toBeTruthy();
  expect(ui.queryByText("Evidence saved")).toBeNull();
  expect(uploadIncidentEvidence).toHaveBeenCalledWith(
    "i",
    expect.objectContaining({ source: "GALLERY_UPLOAD" }),
    expect.any(Function),
  );
  await act(async () => finish({ id: "e-1" }));
  await ui.findByText("Evidence saved");
  await waitFor(() => expect(getIncident).toHaveBeenCalledTimes(2));
  await waitFor(() =>
    expect(
      ui.getByLabelText("Upload Evidence: second.jpg").props.accessibilityState
        .disabled,
    ).toBe(false),
  );
  uploadIncidentEvidence.mockResolvedValue({ id: "e-2" });
  await act(async () => {
    fireEvent.press(ui.getByLabelText("Upload Evidence: second.jpg"));
  });
  expect(uploadIncidentEvidence).toHaveBeenCalledTimes(2);
  await waitFor(() =>
    expect(ui.getAllByText("Evidence saved")).toHaveLength(2),
  );
  expect(getIncident).toHaveBeenCalledTimes(3);
});
test("upload failure keeps selected file and saved incident; retry reuses key without incident creation", async () => {
  uploadIncidentEvidence
    .mockRejectedValueOnce({ response: { status: 503 } })
    .mockResolvedValue({ id: "e" });
  const { ui } = await mount();
  fireEvent.press(ui.getByLabelText("Choose Photo from Gallery"));
  await ui.findByLabelText("Upload Evidence: photo.jpg");
  fireEvent.press(ui.getByLabelText("Upload Evidence: photo.jpg"));
  await ui.findByLabelText("Retry Upload: photo.jpg");
  const key = uploadIncidentEvidence.mock.calls[0][1].uploadKey;
  expect(ui.getByText("Snare report")).toBeTruthy();
  expect(ui.getByText("Upload failed — incident retained")).toBeTruthy();
  fireEvent.press(ui.getByLabelText("Retry Upload: photo.jpg"));
  await ui.findByText("Evidence saved");
  expect(uploadIncidentEvidence.mock.calls[1][1].uploadKey).toBe(key);
});
test("camera trap metadata required and preserved in real upload request", async () => {
  const { ui } = await mount();
  fireEvent.press(ui.getByLabelText("Import Camera Trap Photo/Video"));
  await ui.findByLabelText("Upload Evidence: video.mp4");
  fireEvent.press(ui.getByLabelText("Upload Evidence: video.mp4"));
  expect(uploadIncidentEvidence).not.toHaveBeenCalled();
  expect(ui.getByText(/Enter the camera trap ID/)).toBeTruthy();
  fireEvent.changeText(
    ui.getByLabelText("Camera trap ID: video.mp4"),
    "trap-7",
  );
  fireEvent.changeText(
    ui.getByLabelText("Capture date/time: video.mp4"),
    "2026-01-01T10:30:00+05:30",
  );
  fireEvent.changeText(
    ui.getByLabelText("Camera trap notes: video.mp4"),
    "Northern trail",
  );
  fireEvent.press(ui.getByLabelText("Upload Evidence: video.mp4"));
  await waitFor(() =>
    expect(uploadIncidentEvidence).toHaveBeenCalledWith(
      "i",
      expect.objectContaining({
        source: "CAMERA_TRAP",
        cameraTrapId: "trap-7",
        capturedAt: "2026-01-01T10:30:00+05:30",
        notes: "Northern trail",
      }),
      expect.any(Function),
    ),
  );
  await ui.findByText("Evidence saved");
  await waitFor(() =>
    expect(
      ui.getByLabelText("Take Photo").props.accessibilityState.disabled,
    ).toBe(false),
  );
});
test("oversized or too many files are blocked before upload", async () => {
  const { ui } = await mount();
  picker.launchImageLibraryAsync.mockResolvedValue({
    canceled: false,
    assets: [{ ...photo, fileSize: 10 * 1024 * 1024 + 1 }],
  });
  fireEvent.press(ui.getByLabelText("Choose Photo from Gallery"));
  await ui.findByText("Photos must be at most 10 MB and videos at most 50 MB.");
  expect(uploadIncidentEvidence).not.toHaveBeenCalled();
  picker.launchImageLibraryAsync.mockResolvedValue({
    canceled: false,
    assets: Array(6).fill(photo),
  });
  fireEvent.press(ui.getByLabelText("Choose Photo from Gallery"));
  await ui.findByText(/Maximum five per incident/);
  expect(ui.queryByLabelText("Upload Evidence: photo.jpg")).toBeNull();
});
test.each([
  { patrol: { ...incident.patrol, status: "COMPLETED" } },
  { status: "UNDER_REVIEW" },
  { withdrawnAt: "2026-01-01" },
  { reporterId: "other" },
])("locked incident cannot select/upload %j", async (override) => {
  getIncident.mockResolvedValue({ ...incident, ...override });
  const ui = render(
    <Screen route={{ params: { incidentId: "i" } }} navigation={nav()} />,
  );
  await ui.findByText(/Evidence uploads are locked/);
  expect(
    ui.getByLabelText("Take Photo").props.accessibilityState.disabled,
  ).toBe(true);
  expect(uploadIncidentEvidence).not.toHaveBeenCalled();
});
test("completed status after selection locks retry while keeping file; cleanup failure needs administrator", async () => {
  uploadIncidentEvidence.mockRejectedValue({ response: { status: 409 } });
  const { ui } = await mount();
  fireEvent.press(ui.getByLabelText("Choose Photo from Gallery"));
  await ui.findByLabelText("Upload Evidence: photo.jpg");
  getIncident.mockResolvedValue({
    ...incident,
    patrol: { ...incident.patrol, status: "COMPLETED" },
  });
  fireEvent.press(ui.getByLabelText("Upload Evidence: photo.jpg"));
  await ui.findByText(/Evidence uploads are locked/);
  expect(
    ui.getByLabelText("Retry Upload: photo.jpg").props.accessibilityState
      .disabled,
  ).toBe(true);
  expect(ui.getByLabelText("Selected evidence: photo.jpg")).toBeTruthy();
});
test("unuploaded selection warns on removal; saved evidence remains", async () => {
  const { ui, navigation } = await mount();
  fireEvent.press(ui.getByLabelText("Choose Photo from Gallery"));
  await ui.findByLabelText("Upload Evidence: photo.jpg");
  const action = { type: "GO_BACK" };
  act(() => mockPrevent({ data: { action } }));
  expect(ui.getByText("Discard selected evidence?")).toBeTruthy();
  fireEvent.press(ui.getByLabelText("Keep Evidence"));
  expect(navigation.dispatch).not.toHaveBeenCalled();
  act(() => mockPrevent({ data: { action } }));
  fireEvent.press(ui.getByLabelText("Discard Selection"));
  expect(navigation.dispatch).toHaveBeenCalledWith(action);
});
test("gallery requests authorized time-limited private access only when opened and retries media failures", async () => {
  const evidence = { id: "e", fileType: "PHOTO", mediaAvailable: true };
  const ui = render(<EvidenceMedia incidentId="i" evidence={evidence} />);
  expect(getEvidenceAccess).not.toHaveBeenCalled();
  fireEvent.press(ui.getByLabelText("View private photo"));
  await ui.findByLabelText("Private incident evidence photo");
  expect(getEvidenceAccess).toHaveBeenCalledWith("i", "e");
  expect(ui.UNSAFE_getByType(Image).props.source.uri).toBe(
    "http://localhost/api/private-ticket-media",
  );
  fireEvent(ui.UNSAFE_getByType(Image), "error");
  await ui.findByLabelText("Retry private media");
});
test("expired media URL is removed and must be refreshed; legacy public URLs are never rendered", async () => {
  jest.useFakeTimers();
  getEvidenceAccess.mockResolvedValue({
    uri: "http://localhost/private",
    expiresAt: new Date(Date.now() + 1000).toISOString(),
  });
  const ui = render(
    <EvidenceMedia
      incidentId="i"
      evidence={{ id: "e", fileType: "PHOTO", mediaAvailable: true }}
    />,
  );
  fireEvent.press(ui.getByLabelText("View private photo"));
  await act(async () => {});
  expect(ui.getByLabelText("Private incident evidence photo")).toBeTruthy();
  act(() => jest.advanceTimersByTime(1001));
  expect(ui.queryByLabelText("Private incident evidence photo")).toBeNull();
  expect(ui.getByText(/Media access expired/)).toBeTruthy();
  ui.unmount();
  jest.useRealTimers();
  const legacy = render(
    <EvidenceMedia
      incidentId="i"
      evidence={{ id: "old", fileUrl: "https://public.example/file.jpg" }}
    />,
  );
  expect(legacy.queryByLabelText("View private photo")).toBeNull();
  expect(legacy.getByText(/no verified private media/)).toBeTruthy();
});

test("cleanup failure blocks blind retry and keeps the incident visible", async () => {
  uploadIncidentEvidence.mockRejectedValue({
    response: { status: 503, data: { code: "MEDIA_CLEANUP_FAILED" } },
  });
  const { ui } = await mount();
  fireEvent.press(ui.getByLabelText("Choose Photo from Gallery"));
  await ui.findByLabelText("Upload Evidence: photo.jpg");
  fireEvent.press(ui.getByLabelText("Upload Evidence: photo.jpg"));
  await ui.findByText(/Contact an administrator/);
  expect(
    ui.getByLabelText("Retry Upload: photo.jpg").props.accessibilityState
      .disabled,
  ).toBe(true);
  expect(ui.getByText("Snare report")).toBeTruthy();
});
test("gallery denial and picker cancellation have no upload side effects", async () => {
  const { ui } = await mount();
  picker.requestMediaLibraryPermissionsAsync.mockResolvedValueOnce({
    granted: false,
  });
  fireEvent.press(ui.getByLabelText("Choose Photo from Gallery"));
  await ui.findByText(/Allow photo\/video library access/);
  expect(picker.launchImageLibraryAsync).not.toHaveBeenCalled();
  picker.launchImageLibraryAsync.mockResolvedValue({ canceled: true });
  fireEvent.press(ui.getByLabelText("Choose Photo from Gallery"));
  await waitFor(() =>
    expect(
      ui.getByLabelText("Choose Photo from Gallery").props.accessibilityState
        .disabled,
    ).toBe(false),
  );
  expect(uploadIncidentEvidence).not.toHaveBeenCalled();
  expect(ui.queryByLabelText("Upload Evidence: photo.jpg")).toBeNull();
});

test("late private access response after blur does not mount private media", async () => {
  let finish;
  getEvidenceAccess.mockReturnValue(
    new Promise((resolve) => {
      finish = resolve;
    }),
  );
  const evidence = { id: "e", fileType: "PHOTO", mediaAvailable: true };
  const ui = render(<EvidenceMedia incidentId="i" evidence={evidence} />);
  fireEvent.press(ui.getByLabelText("View private photo"));
  mockFocused = false;
  ui.rerender(<EvidenceMedia incidentId="i" evidence={evidence} />);
  await act(async () =>
    finish({
      uri: "https://example.test/private-ticket",
      expiresAt: new Date(Date.now() + 300000).toISOString(),
    }),
  );
  expect(ui.queryByLabelText("Private incident evidence photo")).toBeNull();
});
