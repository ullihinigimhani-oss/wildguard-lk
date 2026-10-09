import { api } from "../../src/services/api";
import { uploadEvidence } from "../../src/services/communityReportApi";

jest.mock("../../src/services/api", () => ({
  api: {
    defaults: { baseURL: "https://wildguard.example/api" },
    post: jest.fn(),
  },
}));

describe("community report API", () => {
  afterEach(() => jest.clearAllMocks());

  test("shows evidence validation details returned by the server", async () => {
    api.post.mockRejectedValue({
      response: {
        data: {
          message: "Please check the uploaded file.",
          errors: { fileType: "The file content does not match its image type." },
        },
      },
      message: "Request failed with status code 400",
    });

    await expect(
      uploadEvidence({ data: "invalid", mimeType: "image/jpeg" }),
    ).rejects.toThrow("The file content does not match its image type.");
  });

  test("shows upload failure messages returned by the server", async () => {
    api.post.mockRejectedValue({
      response: {
        data: {
          code: "CLOUDINARY_AUTH_FAILED",
          message: "Evidence storage upload failed. Retry this evidence item.",
        },
      },
      message: "Request failed with status code 503",
    });

    await expect(
      uploadEvidence({ data: "base64", mimeType: "image/jpeg" }),
    ).rejects.toThrow(
      "CLOUDINARY_AUTH_FAILED: Evidence storage upload failed. Retry this evidence item.",
    );
  });
});
