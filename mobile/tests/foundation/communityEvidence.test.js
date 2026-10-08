import React from "react";
import { fireEvent, render, screen, waitFor } from "@testing-library/react-native";
import EvidencePicker from "../../src/components/EvidencePicker";
import CommunityReportScreen from "../../src/screens/community/CommunityReportScreen";
import * as ImagePicker from "expo-image-picker";
import * as communityApi from "../../src/services/communityReportApi";

jest.mock("expo-image-picker", () => ({
  requestCameraPermissionsAsync: jest.fn(),
  requestMediaLibraryPermissionsAsync: jest.fn(),
  launchCameraAsync: jest.fn(),
  launchImageLibraryAsync: jest.fn(),
}));

jest.mock("../../src/hooks/useAuth", () => ({
  useAuth: () => ({
    user: { id: "u-comm", name: "Sunil Silva", role: "COMMUNITY_USER" },
    isAuthenticated: true,
  }),
}));

jest.mock("../../src/services/communityReportApi", () => ({
  submitReport: jest.fn(),
  uploadEvidence: jest.fn(),
}));

describe("Community Report Photo/Video Evidence (Task 5)", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    ImagePicker.requestCameraPermissionsAsync.mockResolvedValue({ status: "granted" });
    ImagePicker.requestMediaLibraryPermissionsAsync.mockResolvedValue({ status: "granted" });
  });

  describe("EvidencePicker Component", () => {
    test("renders media action buttons and optional label", () => {
      render(<EvidencePicker evidence={[]} onChange={jest.fn()} />);

      expect(screen.getByText(/Photo \/ Video Evidence \(0\/5\)/)).toBeTruthy();
      expect(screen.getByText("Optional")).toBeTruthy();
      expect(screen.getByRole("button", { name: "Take photo or video with camera" })).toBeTruthy();
      expect(screen.getByRole("button", { name: "Choose photo from gallery" })).toBeTruthy();
      expect(screen.getByRole("button", { name: "Choose video from gallery" })).toBeTruthy();
    });

    test("handles camera permission denied gracefully", async () => {
      ImagePicker.requestCameraPermissionsAsync.mockResolvedValueOnce({ status: "denied" });
      const onChange = jest.fn();

      render(<EvidencePicker evidence={[]} onChange={onChange} />);

      fireEvent.press(screen.getByRole("button", { name: "Take photo or video with camera" }));

      await waitFor(() => {
        expect(screen.getByText("Camera permission is required to capture photos and videos.")).toBeTruthy();
      });
      expect(ImagePicker.launchCameraAsync).not.toHaveBeenCalled();
      expect(onChange).not.toHaveBeenCalled();
    });

    test("handles gallery permission denied gracefully", async () => {
      ImagePicker.requestMediaLibraryPermissionsAsync.mockResolvedValueOnce({ status: "denied" });
      const onChange = jest.fn();

      render(<EvidencePicker evidence={[]} onChange={onChange} />);

      fireEvent.press(screen.getByRole("button", { name: "Choose photo from gallery" }));

      await waitFor(() => {
        expect(screen.getByText("Photo/media library permission is required to attach evidence.")).toBeTruthy();
      });
      expect(ImagePicker.launchImageLibraryAsync).not.toHaveBeenCalled();
      expect(onChange).not.toHaveBeenCalled();
    });

    test("captures photo using camera and calls onChange", async () => {
      ImagePicker.launchCameraAsync.mockResolvedValueOnce({
        canceled: false,
        assets: [
          {
            uri: "file:///camera/photo1.jpg",
            type: "image",
            fileName: "photo1.jpg",
            fileSize: 1024 * 500, // 500KB
            base64: "base64-photo-data",
          },
        ],
      });

      const onChange = jest.fn();
      render(<EvidencePicker evidence={[]} onChange={onChange} />);

      fireEvent.press(screen.getByRole("button", { name: "Take photo or video with camera" }));

      await waitFor(() => {
        expect(onChange).toHaveBeenCalledTimes(1);
      });

      const added = onChange.mock.calls[0][0];
      expect(added).toHaveLength(1);
      expect(added[0].fileUrl).toBe("file:///camera/photo1.jpg");
      expect(added[0].fileType).toBe("image/jpeg");
      expect(added[0].isVideo).toBe(false);
      expect(added[0].base64).toBe("base64-photo-data");
    });

    test("chooses video from gallery and flags as video", async () => {
      ImagePicker.launchImageLibraryAsync.mockResolvedValueOnce({
        canceled: false,
        assets: [
          {
            uri: "file:///gallery/clip1.mp4",
            type: "video",
            fileName: "clip1.mp4",
            fileSize: 1024 * 1024 * 5, // 5MB
          },
        ],
      });

      const onChange = jest.fn();
      render(<EvidencePicker evidence={[]} onChange={onChange} />);

      fireEvent.press(screen.getByRole("button", { name: "Choose video from gallery" }));

      await waitFor(() => {
        expect(onChange).toHaveBeenCalledTimes(1);
      });

      const added = onChange.mock.calls[0][0];
      expect(added).toHaveLength(1);
      expect(added[0].fileUrl).toBe("file:///gallery/clip1.mp4");
      expect(added[0].fileType).toBe("video/mp4");
      expect(added[0].isVideo).toBe(true);
    });

    test("rejects photo exceeding 10MB limit", async () => {
      ImagePicker.launchImageLibraryAsync.mockResolvedValueOnce({
        canceled: false,
        assets: [
          {
            uri: "file:///gallery/large.jpg",
            type: "image",
            fileSize: 1024 * 1024 * 12, // 12MB
          },
        ],
      });

      const onChange = jest.fn();
      render(<EvidencePicker evidence={[]} onChange={onChange} />);

      fireEvent.press(screen.getByRole("button", { name: "Choose photo from gallery" }));

      await waitFor(() => {
        expect(screen.getByText("File exceeds the 10MB limit for photos.")).toBeTruthy();
      });
      expect(onChange).not.toHaveBeenCalled();
    });

    test("rejects video exceeding 25MB limit", async () => {
      ImagePicker.launchImageLibraryAsync.mockResolvedValueOnce({
        canceled: false,
        assets: [
          {
            uri: "file:///gallery/huge.mp4",
            type: "video",
            fileSize: 1024 * 1024 * 30, // 30MB
          },
        ],
      });

      const onChange = jest.fn();
      render(<EvidencePicker evidence={[]} onChange={onChange} />);

      fireEvent.press(screen.getByRole("button", { name: "Choose video from gallery" }));

      await waitFor(() => {
        expect(screen.getByText("File exceeds the 25MB limit for videos.")).toBeTruthy();
      });
      expect(onChange).not.toHaveBeenCalled();
    });

    test("rejects empty or zero-byte corrupted file", async () => {
      ImagePicker.launchImageLibraryAsync.mockResolvedValueOnce({
        canceled: false,
        assets: [
          {
            uri: "file:///gallery/corrupt.jpg",
            type: "image",
            fileSize: 0,
          },
        ],
      });

      const onChange = jest.fn();
      render(<EvidencePicker evidence={[]} onChange={onChange} />);

      fireEvent.press(screen.getByRole("button", { name: "Choose photo from gallery" }));

      await waitFor(() => {
        expect(screen.getByText(/empty or corrupted/i)).toBeTruthy();
      });
      expect(onChange).not.toHaveBeenCalled();
    });

    test("previews selected evidence and allows removing items", () => {
      const items = [
        { fileUrl: "file:///p1.jpg", fileType: "image/jpeg", isVideo: false },
        { fileUrl: "file:///v1.mp4", fileType: "video/mp4", isVideo: true },
      ];
      const onChange = jest.fn();

      render(<EvidencePicker evidence={items} onChange={onChange} />);

      expect(screen.getByText(/Photo \/ Video Evidence \(2\/5\)/)).toBeTruthy();
      expect(screen.getByText("VIDEO")).toBeTruthy();

      // Press remove on item 1
      fireEvent.press(screen.getByRole("button", { name: "Remove evidence 1" }));

      expect(onChange).toHaveBeenCalledTimes(1);
      expect(onChange).toHaveBeenCalledWith([items[1]]);
    });

    test("blocks adding more when maxItems limit is reached", () => {
      const items = Array.from({ length: 5 }, (_, i) => ({
        fileUrl: `file:///item${i}.jpg`,
        fileType: "image/jpeg",
        isVideo: false,
      }));

      render(<EvidencePicker evidence={items} onChange={jest.fn()} maxItems={5} />);

      expect(screen.getByText(/Photo \/ Video Evidence \(5\/5\)/)).toBeTruthy();
      expect(screen.getByRole("button", { name: "Take photo or video with camera" }).props.accessibilityState.disabled).toBe(true);
      expect(screen.getByRole("button", { name: "Choose photo from gallery" }).props.accessibilityState.disabled).toBe(true);
    });
  });

  describe("CommunityReportScreen with Evidence Integration", () => {
    test("submits report with uploaded evidence and shows confirmation", async () => {
      communityApi.uploadEvidence.mockResolvedValueOnce({
        success: true,
        fileUrl: "/uploads/evidence/evidence-photo-99.jpg",
        fileType: "image/jpeg",
      });

      communityApi.submitReport.mockResolvedValueOnce({
        success: true,
        report: {
          id: "rep-confirmed-77",
          reportType: "WILDLIFE_SIGHTING",
          status: "PENDING",
          evidence: [{ id: "ev-1", fileUrl: "/uploads/evidence/evidence-photo-99.jpg" }],
        },
      });

      ImagePicker.launchCameraAsync.mockResolvedValueOnce({
        canceled: false,
        assets: [
          {
            uri: "file:///photo.jpg",
            type: "image",
            fileName: "photo.jpg",
            fileSize: 1024 * 200,
            base64: "base64-encoded-data",
          },
        ],
      });

      render(<CommunityReportScreen navigation={{ navigate: jest.fn() }} />);

      // Fill required description and location
      fireEvent.changeText(
        screen.getByPlaceholderText("Describe what occurred, animal count, heading direction, behavior, or damages observed..."),
        "Spotted leopard resting on rocks near border fence"
      );
      fireEvent.changeText(
        screen.getByPlaceholderText("e.g. Weerawila South, Kataragama border"),
        "Yala Block 1 Buffer Zone"
      );

      // Attach evidence via Camera button
      fireEvent.press(screen.getByRole("button", { name: "Take photo or video with camera" }));

      await waitFor(() => {
        expect(screen.getByRole("button", { name: "Remove evidence 1" })).toBeTruthy();
      });

      // Submit report
      fireEvent.press(screen.getByRole("button", { name: "Submit Incident Report" }));

      await waitFor(() => {
        expect(communityApi.uploadEvidence).toHaveBeenCalledWith(
          expect.objectContaining({
            data: "base64-encoded-data",
            mimeType: "image/jpeg",
          })
        );
      });

      await waitFor(() => {
        expect(communityApi.submitReport).toHaveBeenCalledWith(
          expect.objectContaining({
            description: "Spotted leopard resting on rocks near border fence",
            manualLocation: "Yala Block 1 Buffer Zone",
            evidence: [
              {
                fileUrl: "/uploads/evidence/evidence-photo-99.jpg",
                fileType: "image/jpeg",
              },
            ],
          })
        );
      });

      // Confirmation screen displayed with evidence counter
      expect(await screen.findByText("Report Received")).toBeTruthy();
      expect(screen.getByText("Attached Evidence: 1 file")).toBeTruthy();
    });

    test("preserves form fields when evidence upload fails", async () => {
      communityApi.uploadEvidence.mockRejectedValueOnce(
        new Error("Upload timed out. Server unreachable.")
      );

      ImagePicker.launchCameraAsync.mockResolvedValueOnce({
        canceled: false,
        assets: [
          {
            uri: "file:///photo.jpg",
            type: "image",
            fileName: "photo.jpg",
            base64: "dummy-base64",
          },
        ],
      });

      render(<CommunityReportScreen navigation={{ navigate: jest.fn() }} />);

      // Enter description and location
      const descInput = screen.getByPlaceholderText("Describe what occurred, animal count, heading direction, behavior, or damages observed...");
      const locInput = screen.getByPlaceholderText("e.g. Weerawila South, Kataragama border");

      fireEvent.changeText(descInput, "Two elephants destroying paddy storage shed");
      fireEvent.changeText(locInput, "Thanamalwila central junction");

      // Attach evidence
      fireEvent.press(screen.getByRole("button", { name: "Take photo or video with camera" }));

      await waitFor(() => {
        expect(screen.getByRole("button", { name: "Remove evidence 1" })).toBeTruthy();
      });

      // Submit report
      fireEvent.press(screen.getByRole("button", { name: "Submit Incident Report" }));

      // Wait for error banner
      expect(await screen.findByText(/Upload timed out/i)).toBeTruthy();

      // Verify that user's typed data has NOT been lost
      expect(descInput.props.value).toBe("Two elephants destroying paddy storage shed");
      expect(locInput.props.value).toBe("Thanamalwila central junction");
      // And submitReport was NOT called
      expect(communityApi.submitReport).not.toHaveBeenCalled();
    });
  });
});
