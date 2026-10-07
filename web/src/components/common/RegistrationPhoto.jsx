import { useEffect, useRef, useState } from "react";
export default function RegistrationPhoto({ disabled }) {
  const [photo, setPhoto] = useState(null);
  const [error, setError] = useState("");
  const input = useRef(null);
  useEffect(
    () => () => {
      if (photo) URL.revokeObjectURL(photo);
    },
    [photo],
  );
  function choose(event) {
    const file = event.target.files?.[0];
    if (!file) return;
    if (
      !["image/jpeg", "image/png", "image/webp"].includes(file.type) ||
      file.size > 10 * 1024 * 1024
    ) {
      setError("Choose a JPG, PNG or WebP image under 10 MB.");
      return;
    }
    setError("");
    setPhoto(URL.createObjectURL(file));
    event.target.value = "";
  }
  return (
    <div className="registration-photo">
      <strong>Profile Photo (Optional)</strong>
      <span className="avatar large-avatar">
        {photo ? <img src={photo} alt="Selected profile preview" /> : "♧"}
      </span>
      <input
        ref={input}
        type="file"
        accept="image/jpeg,image/png,image/webp"
        hidden
        onChange={choose}
        disabled={disabled}
      />
      <button
        type="button"
        className="text-button"
        disabled={disabled}
        onClick={() => input.current.click()}
      >
        {photo ? "Change Photo" : "Add Photo"}
      </button>
      {photo && (
        <button
          type="button"
          className="text-button"
          disabled={disabled}
          onClick={() => setPhoto(null)}
        >
          Remove Photo
        </button>
      )}
      <p className="small muted">
        Optional preview only. Photo storage is not configured; this photo will
        not be saved to your account.
      </p>
      {error && <p role="alert">{error}</p>}
    </div>
  );
}
