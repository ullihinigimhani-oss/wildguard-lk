const service = require('../services/auth.service');
module.exports = async (req, res, next) => {
  try {
    console.log('Auth middleware called for:', req.method, req.path);
    console.log('Authorization header:', req.get('Authorization'));
    const match = /^Bearer ([^\s]+)$/.exec(req.get('Authorization') || '');
    if (!match) {
      console.log('No Bearer token found');
      return res.status(401).json({ success: false, message: 'Authentication required.' });
    }
    req.user = await service.authenticate(match[1]);
    console.log('User authenticated:', req.user.id);
    next();
  } catch (error) {
    console.error('Auth middleware error:', error);
    next(error);
  }
};
