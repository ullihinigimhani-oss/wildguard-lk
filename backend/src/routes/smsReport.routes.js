const router = require("express").Router();
const controller = require("../controllers/smsReport.controller");

// 1. Webhook endpoint for receiving SMS from telecom provider (Twilio or generic gateway)
router.post("/incoming", controller.handleIncomingSms);

// 2. Demo & Simulation endpoint for academic testing without live telco credentials
router.post("/simulate", controller.simulateSmsReport);

// 3. Public endpoint returning expected SMS formats, instructions, and examples
router.get("/format", controller.getSmsFormat);

module.exports = router;
