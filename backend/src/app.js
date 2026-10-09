require("./config/environment");
const express = require("express");
const cors = require("cors");
const path = require("path");
const healthRoutes = require("./routes/health.routes");
const errorHandler = require("./middleware/error.middleware");

const app = express();
app.disable("x-powered-by");
app.use(cors());
app.use(express.json({ limit: "35mb" }));
app.use(
  "/uploads",
  express.static(path.resolve(__dirname, "../uploads"), {
    maxAge: "1d",
    dotfiles: "deny",
  })
);
app.use("/api/health", healthRoutes);
app.use("/api/auth", require("./routes/auth.routes"));
app.use("/api/parks", require("./routes/park.routes"));
app.use("/api/users", require("./routes/user.routes"));
app.use("/api/patrols", require("./routes/patrol.routes"));
app.use("/api/incidents", require("./routes/incident.routes"));
app.use("/api/navigation", require("./routes/navigation.routes"));
app.use("/api/community-reports", require("./routes/communityReport.routes"));
app.use("/api/analytics", require("./routes/analytics.routes"));
app.use("/api/alerts", require("./routes/alert.routes"));
app.use("/api/sensors", require("./routes/sensor.routes"));
app.use("/api/risk-zones", require("./routes/riskZone.routes"));
app.use((req, res) => {
  res.status(404).json({ success: false, message: "Route not found" });
});
app.use(errorHandler);

module.exports = app;
