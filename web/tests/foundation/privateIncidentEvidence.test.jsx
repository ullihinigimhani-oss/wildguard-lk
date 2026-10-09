import {
  act,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import PrivateEvidence from "../../src/components/incident/PrivateEvidence";
import { getEvidenceAccess } from "../../src/services/incidentApi";
vi.mock("../../src/services/incidentApi", async () => ({
  ...(await vi.importActual("../../src/services/incidentApi")),
  getEvidenceAccess: vi.fn(),
}));
const photo = {
  id: "e1",
  fileType: "PHOTO",
  mediaAvailable: true,
  caption: "Field photo",
  metadata: {
    source: "CAMERA_TRAP",
    cameraTrapId: "trap-a",
    originalFileName: "photo.jpg",
    capturedAt: "2026-10-08T04:00:00Z",
    notes: "Manual import",
  },
};

beforeEach(() => {
  vi.clearAllMocks();
  getEvidenceAccess.mockResolvedValue({
    uri: "https://example.test/api/private-media?ticket=mock",
    expiresAt: new Date(Date.now() + 60000).toISOString(),
  });
});
afterEach(() => vi.useRealTimers());
test("expired private media is removed and a fresh authorized ticket is requested on retry", async () => {
  vi.useFakeTimers();
  getEvidenceAccess.mockResolvedValue({
    uri: "https://example.test/api/media?ticket=one",
    expiresAt: new Date(Date.now() + 1000).toISOString(),
  });
  render(<PrivateEvidence incidentId="i1" evidence={photo} />);
  await act(async () =>
    fireEvent.click(
      screen.getByRole("button", { name: "View private evidence" }),
    ),
  );
  expect(screen.getByRole("img")).toBeVisible();
  await act(async () => vi.advanceTimersByTime(1001));
  expect(screen.queryByRole("img")).toBeNull();
  expect(screen.getByRole("alert")).toHaveTextContent("expired");
  getEvidenceAccess.mockResolvedValue({
    uri: "https://example.test/api/media?ticket=two",
    expiresAt: new Date(Date.now() + 60000).toISOString(),
  });
  await act(async () =>
    fireEvent.click(
      screen.getByRole("button", { name: "View private evidence" }),
    ),
  );
  expect(getEvidenceAccess).toHaveBeenCalledTimes(2);
});
test("videos use private backend delivery; legacy public URLs are never rendered", async () => {
  const video = { ...photo, fileType: "VIDEO" };
  const { container, rerender } = render(
    <PrivateEvidence incidentId="i1" evidence={video} />,
  );
  fireEvent.click(
    screen.getByRole("button", { name: "View private evidence" }),
  );
  await waitFor(() =>
    expect(container.querySelector("video")).toHaveAttribute("controls"),
  );
  vi.spyOn(HTMLMediaElement.prototype, "pause").mockImplementation(() => {});
  rerender(
    <PrivateEvidence
      incidentId="i1"
      evidence={{
        ...photo,
        mediaAvailable: false,
        fileUrl: "https://public.example/leak",
      }}
    />,
  );
  // In production different evidence IDs remount the gallery component.
  expect(container.innerHTML).not.toContain("public.example");
  expect(container.querySelector("img")).toBeNull();
  vi.restoreAllMocks();
});
test("a failed media response requests a fresh ticket only when the manager retries", async () => {
  render(<PrivateEvidence incidentId="i1" evidence={photo} />);
  fireEvent.click(
    screen.getByRole("button", { name: "View private evidence" }),
  );
  fireEvent.error(await screen.findByRole("img"));
  expect(screen.queryByRole("img")).toBeNull();
  expect(getEvidenceAccess).toHaveBeenCalledTimes(1);
  fireEvent.click(
    screen.getByRole("button", { name: "View private evidence" }),
  );
  await screen.findByRole("img");
  expect(getEvidenceAccess).toHaveBeenCalledTimes(2);
});
test("changing evidence aborts pending access and cannot render another item's response", async () => {
  let finish;
  getEvidenceAccess.mockReturnValue(
    new Promise((resolve) => {
      finish = resolve;
    }),
  );
  const { rerender, unmount } = render(
    <PrivateEvidence incidentId="i1" evidence={photo} />,
  );
  fireEvent.click(
    screen.getByRole("button", { name: "View private evidence" }),
  );
  const signal = getEvidenceAccess.mock.calls[0][2];
  rerender(
    <PrivateEvidence incidentId="i1" evidence={{ ...photo, id: "another" }} />,
  );
  expect(signal.aborted).toBe(true);
  await act(async () =>
    finish({
      uri: "https://example.test/stale",
      expiresAt: new Date(Date.now() + 60000).toISOString(),
    }),
  );
  expect(screen.queryByRole("img")).toBeNull();
  fireEvent.click(
    screen.getByRole("button", { name: "View private evidence" }),
  );
  const nextSignal = getEvidenceAccess.mock.calls[1][2];
  unmount();
  expect(nextSignal.aborted).toBe(true);
});
