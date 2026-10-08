import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";
export default defineConfig({
  plugins: [react()],
  test: {
    environment: "jsdom",
    globals: true,
    setupFiles: "./tests/setup.js",
    include: [
      "tests/foundation/**/*.test.jsx",
      "tests/integration/patrolManagement.test.jsx",
      "tests/integration/patrolList.test.jsx",
      "tests/integration/patrolDetails.test.jsx",
      "tests/integration/patrolEditCancel.test.jsx",
      "tests/integration/liveMonitoring.test.jsx",
      "tests/integration/rangerTracking.test.jsx",
      "tests/integration/incidentReview.test.jsx",
      "tests/integration/communityReportManagement.test.jsx",
    ],
  },
});
