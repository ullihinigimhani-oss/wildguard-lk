const service = require("../services/alert.service");

exports.listAlerts = async (req, res, next) => {
  try {
    const result = await service.listAlerts(req.query, req.user || null);
    res.set("Cache-Control", "no-store").json({
      success: true,
      ...result,
    });
  } catch (error) {
    next(error);
  }
};

exports.getAlertById = async (req, res, next) => {
  try {
    const alert = await service.getAlertDetails(req.params.id, req.user || null);
    res.set("Cache-Control", "no-store").json({
      success: true,
      alert,
    });
  } catch (error) {
    next(error);
  }
};

exports.getUnreadCount = async (req, res, next) => {
  try {
    const result = await service.getUnreadCount(req.user || null);
    res.set("Cache-Control", "no-store").json(result);
  } catch (error) {
    next(error);
  }
};

exports.acknowledgeAlert = async (req, res, next) => {
  try {
    const result = await service.acknowledgeAlert(req.params.id, req.user);
    res.json(result);
  } catch (error) {
    next(error);
  }
};

exports.markAsRead = async (req, res, next) => {
  try {
    const result = await service.markAsRead(req.params.id, req.user);
    res.json(result);
  } catch (error) {
    next(error);
  }
};

exports.markAllAsRead = async (req, res, next) => {
  try {
    const result = await service.markAllAsRead(req.user);
    res.json(result);
  } catch (error) {
    next(error);
  }
};

exports.updateStatus = async (req, res, next) => {
  try {
    const alert = await service.updateAlertStatus(req.params.id, req.body.status);
    res.json({
      success: true,
      message: "Alert status updated successfully.",
      alert,
    });
  } catch (error) {
    next(error);
  }
};

exports.getAlertsRequiringAttention = async (req, res, next) => {
  try {
    const result = await service.getAlertsRequiringAttention(req.query, req.user);
    res.set("Cache-Control", "no-store").json({
      success: true,
      ...result,
    });
  } catch (error) {
    next(error);
  }
};

exports.respondToAlert = async (req, res, next) => {
  try {
    const result = await service.respondToAlert(req.params.id, req.body, req.user);
    res.json(result);
  } catch (error) {
    next(error);
  }
};

exports.forwardAlert = async (req, res, next) => {
  try {
    const result = await service.forwardAlert(req.params.id, req.body, req.user);
    res.json(result);
  } catch (error) {
    next(error);
  }
};

