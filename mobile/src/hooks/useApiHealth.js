import { useEffect, useState } from "react";
import { getHealth } from "../services/api";
export default function useApiHealth() {
  const [status, setStatus] = useState("Checking API");
  useEffect(() => {
    const controller = new AbortController();
    getHealth(controller.signal)
      .then((data) => {
        if (!controller.signal.aborted)
          setStatus(
            data.success && data.database === "connected"
              ? "API connected"
              : "API unavailable",
          );
      })
      .catch(() => {
        if (!controller.signal.aborted)
          setStatus("API unavailable or not configured");
      });
    return () => controller.abort();
  }, []);
  return status;
}
