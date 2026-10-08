const cloudinary = require("cloudinary").v2;
const { evidenceError } = require("../validators/incidentEvidence.validator");
function configure() {
  const { CLOUDINARY_CLOUD_NAME, CLOUDINARY_API_KEY, CLOUDINARY_API_SECRET } =
    process.env;
  if (
    ![CLOUDINARY_CLOUD_NAME, CLOUDINARY_API_KEY, CLOUDINARY_API_SECRET].every(
      (value) => typeof value === "string" && value.trim(),
    )
  )
    throw evidenceError(
      503,
      "EVIDENCE_STORAGE_UNAVAILABLE",
      "Secure evidence storage is not configured.",
    );
  cloudinary.config({
    cloud_name: CLOUDINARY_CLOUD_NAME,
    api_key: CLOUDINARY_API_KEY,
    api_secret: CLOUDINARY_API_SECRET,
    secure: true,
  });
}
exports.assertConfigured = configure;
function uploadFailure(error) {
  const code = [401, 403].includes(error?.http_code)
    ? "CLOUDINARY_AUTH_FAILED"
    : error?.http_code === 404
      ? "CLOUDINARY_CONFIG_REJECTED"
      : ["ETIMEDOUT", "ESOCKETTIMEDOUT", "ECONNABORTED"].includes(
            error?.code,
          ) || error?.http_code === 499
        ? "CLOUDINARY_TIMEOUT"
        : "MEDIA_UPLOAD_FAILED";
  return evidenceError(
    503,
    code,
    "Private storage upload failed. The incident is saved; retry this evidence item.",
  );
}
exports.upload = (media, publicId) => {
  configure();
  return new Promise((resolve, reject) => {
    try {
      const stream = cloudinary.uploader.upload_stream(
        {
          public_id: publicId,
          resource_type: media.resourceType,
          type: "authenticated",
          overwrite: false,
          unique_filename: false,
          allowed_formats: [media.format],
          timeout: 120000,
        },
        (error, asset) =>
          error ? reject(uploadFailure(error)) : resolve(asset),
      );
      stream.on("error", (error) => reject(uploadFailure(error)));
      stream.end(media.buffer);
    } catch (error) {
      reject(uploadFailure(error));
    }
  });
};
exports.remove = async (publicId, resourceType) => {
  configure();
  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      const result = await cloudinary.uploader.destroy(publicId, {
        resource_type: resourceType,
        type: "authenticated",
        invalidate: true,
        timeout: 15000,
      });
      if (["ok", "not found"].includes(result?.result)) return;
    } catch {
      /* Never expose SDK errors, signed URLs or credentials. */
    }
  }
  throw evidenceError(
    503,
    "MEDIA_CLEANUP_FAILED",
    "Evidence was not saved and private asset cleanup could not be confirmed. Contact an administrator before retrying.",
  );
};
// This URL contains SDK authentication parameters. It stays inside the backend.
exports.downloadUrl = (storage) => {
  configure();
  return cloudinary.utils.private_download_url(
    storage.publicId,
    storage.format,
    {
      resource_type: storage.resourceType,
      type: "authenticated",
      attachment: false,
      expires_at: Math.floor(Date.now() / 1000) + 60,
      secure: true,
    },
  );
};
