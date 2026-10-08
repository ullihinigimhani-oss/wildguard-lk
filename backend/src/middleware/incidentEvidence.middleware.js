const multer = require("multer");
const service = require("../services/incidentEvidence.service");
const { id } = require("../validators/incident.validator");
const {
  evidenceError,
  limits,
} = require("../validators/incidentEvidence.validator");
const parser = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: limits.VIDEO_LIMIT,
    files: 1,
    fields: 7,
    fieldSize: 4096,
    parts: 8,
  },
  fileFilter: (req, file, done) => {
    if (
      !/^(image\/(jpeg|png|webp|heic)|video\/(mp4|quicktime|webm)|application\/octet-stream)$/.test(
        file.mimetype,
      )
    )
      return done(
        evidenceError(
          400,
          "MEDIA_UNSUPPORTED",
          "Select a supported photo or video.",
        ),
      );
    done(null, true);
  },
}).single("file");
let active = 0;
const users = new Set();
exports.upload = async (req, res, next) => {
  try {
    req.evidenceTrace?.stage("authorization_preflight");
    await service.preflight(id(req.params.incidentId), req.user);
    if (active >= 2 || users.has(req.user.id))
      throw evidenceError(
        429,
        "UPLOAD_BUSY",
        "Another evidence upload is running. Wait and retry.",
      );
    active++;
    users.add(req.user.id);
    let released = false;
    const release = () => {
      if (!released) {
        released = true;
        active--;
        users.delete(req.user.id);
      }
    };
    req.evidenceRelease = release;
    res.once("finish", () => {
      if (!req.evidenceBackground) release();
    });
    res.once("close", () => {
      if (!req.evidenceFinalizing) release();
    });
    req.evidenceTrace?.stage("multipart_receiving");
    parser(req, res, (error) => {
      if (error) {
        release();
        next(
          error instanceof multer.MulterError
            ? evidenceError(
                error.code === "LIMIT_FILE_SIZE" ? 413 : 400,
                "UPLOAD_LIMIT",
                "Use one file per upload: photos up to 10 MB, videos up to 50 MB.",
              )
            : error.evidenceError
              ? error
              : evidenceError(
                  400,
                  "MULTIPART_INVALID",
                  "The multipart file could not be received. Select the file again and retry.",
                ),
        );
      } else {
        req.evidenceTrace?.stage("file_received");
        req.evidenceFinalizing = true;
        next();
      }
    });
  } catch (error) {
    next(error);
  }
};
