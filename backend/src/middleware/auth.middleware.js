const service = require('../services/auth.service');
module.exports = async (req, res, next) => {
  try {
    const match = /^Bearer ([^\s]+)$/.exec(req.get('Authorization') || '');
    if (!match) {
      return res.status(401).json({ success: false, message: 'Authentication required.' });
    }
    req.user = await service.authenticate(match[1]);
    next();
  } catch (error) {
    next(error);
  }
};
