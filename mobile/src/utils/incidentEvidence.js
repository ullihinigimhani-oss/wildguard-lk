import { Platform } from "react-native";
import { File, Paths } from "expo-file-system";
const IMAGE_LIMIT = 10 * 1024 * 1024,
  VIDEO_LIMIT = 50 * 1024 * 1024;
export const evidenceLimits = { IMAGE_LIMIT, VIDEO_LIMIT, MAX_ITEMS: 5 };
function preparationError(step, key, mimeType, size) {
  console.warn(
    JSON.stringify({
      requestId: key,
      stage: "client_file_prepare",
      step,
      code: "LOCAL_MEDIA_UNAVAILABLE",
      ...(typeof mimeType === "string" &&
        /^(image|video)\/[a-z0-9.+-]+$/.test(mimeType) && { mimeType }),
      ...(Number.isFinite(size) && { fileSize: size }),
    }),
  );
  return Object.assign(
    new Error(
      "The selected file is unavailable. Remove it and select it again.",
    ),
    {
      code: "LOCAL_MEDIA_UNAVAILABLE",
      evidenceDiagnostic: {
        requestId: key,
        stage: "client_file_prepare",
        step,
      },
      reselectRequired: true,
    },
  );
}
export function discardEvidenceFile(item) {
  if (Platform.OS === "web") {
    if (item?.ownedBlobUri === item?.uri && item.uri?.startsWith("blob:"))
      URL.revokeObjectURL(item.uri);
    return;
  }
  if (!item?.prepared) return;
  try {
    const prefix = new File(Paths.document, "wg-evidence-").uri;
    if (item.uri !== item.ownedUri || !item.uri.startsWith(prefix)) return;
    const file = new File(item.ownedUri);
    if (file.exists) file.delete();
  } catch {
    /* Cleanup must never delete the picker original or mask upload success. */
  }
}
export async function prepareEvidenceItem(asset, source, kind, uploadKey, photoMode = "original") {
  const started = Date.now();
  if (Platform.OS === "web") {
    const item = selectionItem(asset, source, kind);
    if (photoMode !== "optimized" || item.video) return item;
    let context, image, savedUri;
    try {
      const { ImageManipulator, SaveFormat } = require("expo-image-manipulator");
      context = ImageManipulator.manipulate(asset.uri);
      image = await context.renderAsync();
      const { width, height } = image;
      if (!(width > 0 && height > 0)) throw new Error();
      URL.revokeObjectURL(image.uri);
      image.release(); image = null;
      if (Math.max(width, height) > 1600)
        context.resize(width >= height ? { width: 1600 } : { height: 1600 });
      image = await context.renderAsync();
      const result = await image.saveAsync({ compress: 0.8, format: SaveFormat.JPEG });
      savedUri = result.uri;
      const file = await (await fetch(result.uri)).blob();
      if (!file.size || file.size > IMAGE_LIMIT) throw new Error();
      console.info(JSON.stringify({ requestId: item.uploadKey, stage: "mobile_image_preparation", elapsedMs: Date.now() - started, originalSize: item.size, fileSize: file.size, mode: "optimized" }));
      return { ...item, uri: result.uri, ownedBlobUri: result.uri, file, name: item.name.replace(/\.[^.]+$/, "") + ".jpg", mimeType: "image/jpeg", originalSize: item.size, size: file.size, photoMode: "optimized" };
    } catch {
      if (savedUri) URL.revokeObjectURL(savedUri);
      throw new Error("This photo could not be optimized on this device. Select it again using Original quality; HEIC decoding depends on device support.");
    } finally { if (image?.uri) URL.revokeObjectURL(image.uri); image?.release(); context?.release(); }
  }
  const key =
    uploadKey ||
    `${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}-${Math.random().toString(36).slice(2)}`;
  let step = "uri_normalization",
    destination,
    size;
  try {
    const uri =
      typeof asset.uri === "string" && asset.uri.startsWith("/")
        ? `file://${asset.uri}`
        : asset.uri;
    if (typeof uri !== "string" || !/^(file|content):\/\//.test(uri))
      throw new Error();
    step = "source_stat";
    selectionItem({ ...asset, uri }, source, kind);
    const original = new File(uri);
    if (!original.exists) throw new Error();
    size = original.size;
    if (!Number.isFinite(size) || size <= 0) throw new Error();
    let item = selectionItem({ ...asset, uri, fileSize: size }, source, kind);
    let uploadFile = original;
    let rendered, context, temporary;
    if (photoMode === "optimized" && !item.video) {
      step = "image_optimization";
      try {
        const { ImageManipulator, SaveFormat } = require("expo-image-manipulator");
        context = ImageManipulator.manipulate(uri);
        // Read decoded dimensions, including manually imported HEIC; never upscale.
        rendered = await context.renderAsync();
        const { width, height } = rendered;
        if (!(width > 0 && height > 0)) throw new Error();
        rendered.release();
        rendered = null;
        if (Math.max(width, height) > 1600)
          context.resize(width >= height ? { width: 1600 } : { height: 1600 });
        rendered = await context.renderAsync();
        const saved = await rendered.saveAsync({ compress: 0.8, format: SaveFormat.JPEG });
        temporary = new File(saved.uri);
        if (!temporary.exists || !(temporary.size > 0)) throw new Error();
        uploadFile = temporary;
        item = { ...item, name: item.name.replace(/\.[^.]+$/, "") + ".jpg", mimeType: "image/jpeg", originalSize: size, photoMode: "optimized" };
        size = temporary.size;
        if (size > IMAGE_LIMIT) throw new Error("Photos must be at most 10 MB.");
        // One copy into owned storage. The camera/gallery original is never changed.
        destination = new File(Paths.document, `wg-evidence-${key}.jpg`);
        step = "stable_copy";
        await uploadFile.copy(destination);
      } finally {
        rendered?.release();
        context?.release();
        if (temporary?.exists) temporary.delete();
      }
    }
    const extension =
      /\.(jpg|jpeg|png|webp|heic|mp4|mov|webm)$/i.exec(item.name)?.[0] || "";
    destination ||= new File(Paths.document, `wg-evidence-${key}${extension}`);
    step = "stable_copy";
    // Expo SDK 57 File.copy is Promise<void>. Never stat before it completes.
    if (uploadFile === original) await original.copy(destination);
    step = "stable_stat";
    if (!destination.exists || destination.size !== size) throw new Error();
    console.info(JSON.stringify({ requestId: key, stage: "mobile_image_preparation", elapsedMs: Date.now() - started, fileSize: size, originalSize: item.originalSize || size, mode: item.photoMode || "original" }));
    return {
      ...item,
      uploadKey: key,
      uri: destination.uri,
      ownedUri: destination.uri,
      size,
      prepared: true,
      extension,
    };
  } catch (error) {
    try {
      if (destination?.exists) destination.delete();
    } catch {
      /* Failed partial copy only. */
    }
    if (
      error.message?.startsWith("Photos must") ||
      error.message?.startsWith("Use a JPEG")
    )
      throw error;
    if (step === "image_optimization") {
      console.warn(JSON.stringify({ requestId: key, stage: "client_file_prepare", step, code: "IMAGE_OPTIMIZATION_FAILED", elapsedMs: Date.now() - started }));
      throw new Error("This photo could not be optimized on this device. Select it again using Original quality; HEIC decoding depends on device support.");
    }
    throw preparationError(step, key, asset.mimeType, size);
  }
}
export async function ensureEvidencePrepared(item) {
  if (Platform.OS === "web") return item;
  if (!item.prepared) {
    const prepared = await prepareEvidenceItem(
      { uri: item.uri, fileName: item.name, mimeType: item.mimeType },
      item.source,
      item.video ? "video" : "image",
      item.uploadKey,
    );
    // Upgrade drafts already open when the bundle changes, keeping retry identity.
    Object.assign(item, {
      uri: prepared.uri,
      ownedUri: prepared.uri,
      size: prepared.size,
      prepared: true,
      extension: prepared.extension,
    });
  }
  try {
    const file = new File(item.uri);
    if (!file.exists || file.size !== item.size) throw new Error();
  } catch {
    throw preparationError(
      "stable_stat",
      item.uploadKey,
      item.mimeType,
      item.size,
    );
  }
  return item;
}
export async function validateEvidenceDraft(items, existingCount = 0) {
  if (items.length + existingCount > 5)
    throw new Error("Maximum five evidence items per incident.");
  for (const item of items) {
    if (item.cleanupBlocked)
      throw new Error(
        "Private asset cleanup requires administrator assistance before retrying.",
      );
    if (item.source === "CAMERA_TRAP" && !item.cameraTrapId.trim())
      throw new Error(`Enter the camera trap ID for ${item.name}.`);
    if (
      item.capturedAt &&
      (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{1,3})?(?:Z|[+-]\d{2}:\d{2})$/.test(
        item.capturedAt,
      ) ||
        !Number.isFinite(Date.parse(item.capturedAt)))
    )
      throw new Error(
        "Use an ISO capture date/time with seconds and timezone.",
      );
    if (Platform.OS !== "web") {
      await ensureEvidencePrepared(item);
    } else if (!item.file) {
      try {
        const response = await fetch(item.uri);
        if (!response.ok || (await response.blob()).size !== item.size)
          throw new Error();
      } catch {
        throw new Error(
          `The selected file ${item.name} is unavailable. Remove it and select it again.`,
        );
      }
    }
  }
}
export function selectionItem(asset, source, kind) {
  const name =
    asset.fileName ||
    asset.name ||
    asset.uri?.split("/").pop()?.split("?")[0] ||
    "evidence";
  const mimeType =
    asset.mimeType || asset.file?.type || "application/octet-stream";
  const video =
    kind === "video" ||
    asset.type === "video" ||
    mimeType.startsWith("video/") ||
    /\.(mp4|mov|webm)$/i.test(name);
  const size =
    asset.fileSize ??
    asset.size ??
    asset.file?.size ??
    (Platform.OS !== "web" ? new File(asset.uri).size : null);
  if (!asset.uri || !Number.isFinite(size) || size <= 0)
    throw new Error(
      "The file size could not be verified. Select the file again.",
    );
  if (size > (video ? VIDEO_LIMIT : IMAGE_LIMIT))
    throw new Error("Photos must be at most 10 MB and videos at most 50 MB.");
  if (
    mimeType !== "application/octet-stream" &&
    ![
      "image/jpeg",
      "image/png",
      "image/webp",
      "image/heic",
      "video/mp4",
      "video/quicktime",
      "video/webm",
    ].includes(mimeType)
  )
    throw new Error(
      "Use a JPEG, PNG, WebP, HEIC photo or MP4, MOV, WebM video.",
    );
  return {
    uri: asset.uri,
    file: asset.file,
    name,
    mimeType,
    size,
    video,
    source,
    uploadKey: `${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}-${Math.random().toString(36).slice(2)}`,
    status: "selected",
    progress: 0,
    caption: "",
    cameraTrapId: "",
    capturedAt: source === "PHONE_CAMERA" ? new Date().toISOString() : "",
    notes: "",
  };
}
