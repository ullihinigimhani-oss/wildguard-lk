const service = require("../services/analytics.service");

async function kpis(req, res, next) {
  try {
    const data = await service.kpis(req.user, req.query);
    res.set("Cache-Control", "no-store");
    res.json({ success: true, data });
  } catch (error) {
    next(error);
  }
}

async function incidents(req, res, next) {
  try {
    const data = await service.incidents(req.user, req.query);
    res.set("Cache-Control", "no-store");
    res.json({ success: true, data });
  } catch (error) {
    next(error);
  }
}

async function patrols(req, res, next) {
  try {
    const data = await service.patrols(req.user, req.query);
    res.set("Cache-Control", "no-store");
    res.json({ success: true, data });
  } catch (error) {
    next(error);
  }
}

async function communityReports(req, res, next) {
  try {
    const data = await service.communityReports(req.user, req.query);
    res.set("Cache-Control", "no-store");
    res.json({ success: true, data });
  } catch (error) {
    next(error);
  }
}

module.exports = { kpis, incidents, patrols, communityReports };