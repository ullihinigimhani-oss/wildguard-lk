require("./config/environment");
const express = require("express");
const cors = require("cors");
const healthRoutes = require("./routes/health.routes");
const errorHandler = require("./middleware/error.middleware");

const app = express();
app.disable("x-powered-by");
app.use(cors());
app.use(express.json());
app.use("/api/health", healthRoutes);
app.use("/api/auth", require("./routes/auth.routes"));
app.use("/api/parks", require("./routes/park.routes"));
app.use("/api/users", require("./routes/user.routes"));
app.use("/api/patrols", require("./routes/patrol.routes"));
app.use((req, res) => {
  res.status(404).json({ success: false, message: "Route not found" });
});
app.use(errorHandler);

module.exports = app;
