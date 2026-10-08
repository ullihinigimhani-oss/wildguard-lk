import { useEffect, useRef, useState } from "react";
import { getEvidenceAccess, incidentError } from "../../services/incidentApi";
export default function PrivateEvidence({ incidentId, evidence }) {
  const [access, setAccess] = useState(null),
    [loading, setLoading] = useState(false),
    [error, setError] = useState("");
  const controller = useRef(null),
    generation = useRef(0),
    media = useRef(null);
  const clear = () => {
    media.current?.pause?.();
    setAccess(null);
  };
  useEffect(() => {
    generation.current++;
    controller.current?.abort();
    setAccess(null);
    setLoading(false);
    setError("");
    return () => {
      generation.current++;
      controller.current?.abort();
      media.current?.pause?.();
    };
  }, [incidentId, evidence.id, evidence.mediaAvailable]);
  useEffect(() => {
    if (!access) return;
    const timer = setTimeout(
      () => {
        clear();
        setError("Media access expired. Open it again for fresh access.");
      },
      Math.max(0, Date.parse(access.expiresAt) - Date.now()),
    );
    const hidden = () => {
      if (document.hidden) {
        generation.current++;
        controller.current?.abort();
        setLoading(false);
        clear();
      }
    };
    document.addEventListener("visibilitychange", hidden);
    return () => {
      clearTimeout(timer);
      document.removeEventListener("visibilitychange", hidden);
    };
  }, [access]);
  async function open() {
    if (loading) return;
    const attempt = ++generation.current;
    controller.current?.abort();
    controller.current = new AbortController();
    setLoading(true);
    setError("");
    clear();
    try {
      const value = await getEvidenceAccess(
        incidentId,
        evidence.id,
        controller.current.signal,
      );
      if (attempt === generation.current && !document.hidden) setAccess(value);
    } catch (failure) {
      if (attempt === generation.current) setError(incidentError(failure));
    } finally {
      if (attempt === generation.current) setLoading(false);
    }
  }
  const info = evidence.metadata || {};
  return (
    <article className="incident-evidence">
      <strong>{info.originalFileName || "Evidence item"}</strong>
      <p>
        {evidence.fileType || "—"} ·{" "}
        {info.source?.replaceAll("_", " ") || "Source unavailable"}
      </p>
      {info.capturedAt && (
        <p>Captured: {new Date(info.capturedAt).toLocaleString()}</p>
      )}
      {info.cameraTrapId && <p>Camera trap: {info.cameraTrapId}</p>}
      {evidence.caption && <p>{evidence.caption}</p>}
      {info.notes && <p>{info.notes}</p>}
      {evidence.mediaAvailable ? (
        <button className="button" onClick={open} disabled={loading}>
          {loading
            ? "Opening…"
            : access
              ? "Refresh media access"
              : "View private evidence"}
        </button>
      ) : (
        <p>Private media unavailable for this record.</p>
      )}
      {error && <p role="alert">{error}</p>}
      {access &&
        evidence.mediaAvailable &&
        (evidence.fileType === "VIDEO" ? (
          <video
            ref={media}
            src={access.uri}
            controls
            preload="metadata"
            onError={() => {
              clear();
              setError("Unable to play media. Request fresh access and retry.");
            }}
          />
        ) : (
          <img
            src={access.uri}
            alt={evidence.caption || "Incident evidence"}
            referrerPolicy="no-referrer"
            onError={() => {
              clear();
              setError("Unable to load media. Request fresh access and retry.");
            }}
          />
        ))}
    </article>
  );
}
