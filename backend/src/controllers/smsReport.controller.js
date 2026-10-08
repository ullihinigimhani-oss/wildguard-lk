/**
 * SMS Community Report Controller
 */

const smsGatewayService = require("../services/sms/smsGateway.service");

exports.handleIncomingSms = async (req, res, next) => {
  try {
    const result = await smsGatewayService.processIncomingSms(req.body, {
      headers: req.headers,
    });

    // If request comes from Twilio webhook, return TwiML XML
    if (req.body.AccountSid || req.headers["x-twilio-signature"]) {
      res.set("Content-Type", "text/xml");
      return res.status(200).send(`<?xml version="1.0" encoding="UTF-8"?>
<Response>
    <Message>${result.replyText}</Message>
</Response>`);
    }

    const statusCode = result.duplicate ? 200 : 201;
    return res.status(statusCode).json(result);
  } catch (err) {
    // If from Twilio, send user-friendly SMS error message in XML
    if (req.body?.AccountSid || req.headers?.["x-twilio-signature"]) {
      res.set("Content-Type", "text/xml");
      const safeMessage = err.message || "Invalid SMS report format.";
      return res.status(200).send(`<?xml version="1.0" encoding="UTF-8"?>
<Response>
    <Message>WildGuard LK Error: ${safeMessage} Format: REPORT SIGHTING # Location # Description</Message>
</Response>`);
    }

    return next(err);
  }
};

exports.simulateSmsReport = async (req, res, next) => {
  try {
    const result = await smsGatewayService.processIncomingSms(req.body);
    const statusCode = result.duplicate ? 200 : 201;
    return res.status(statusCode).json(result);
  } catch (err) {
    return next(err);
  }
};

exports.getSmsFormat = (req, res) => {
  const instructions = smsGatewayService.getSmsFormatInstructions();
  return res.status(200).json(instructions);
};
