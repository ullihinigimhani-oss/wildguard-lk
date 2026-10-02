const service = require('../services/auth.service');
const { validateRegistration, validateLogin } = require('../validators/auth.validator');
exports.login = async (req, res, next) => {
  try { res.set('Cache-Control', 'no-store').json({ success: true, ...await service.login(validateLogin(req.body)) }); }
  catch (error) { next(error); }
};
exports.me = (req, res) => res.set('Cache-Control', 'no-store').json({ success: true, user: req.user });
exports.register = async (req, res, next) => {
  try {
    const user = await service.register(validateRegistration(req.body));
    res.status(201).json({ success: true, message: 'Account created successfully', user });
  } catch (error) { next(error); }
};
