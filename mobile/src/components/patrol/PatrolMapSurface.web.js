import React, { useEffect, useRef } from "react";
// Expo web preview uses the identical map document in an isolated iframe.
export default function PatrolMapSurface({ html, onMessage, onError }) {
  const frame = useRef(null);
  useEffect(() => {
    const receive = (event) => {
      if (event.source === frame.current?.contentWindow) onMessage(event.data);
    };
    window.addEventListener("message", receive);
    return () => window.removeEventListener("message", receive);
  }, [onMessage]);
  return (
    <iframe
      ref={frame}
      title="Planned patrol route map"
      srcDoc={html}
      sandbox="allow-scripts allow-popups allow-popups-to-escape-sandbox"
      onError={onError}
      style={{ width: "100%", height: "100%", border: 0 }}
    />
  );
}
