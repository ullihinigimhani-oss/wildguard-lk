const service = require('../services/auth.service');
const { validateRegistration } = require('../validators/auth.validator');
exports.register = async (req, res, next) => {
  try {
    const user = await service.register(validateRegistration(req.body));
    res.status(201).json({ success: true, message: 'Account created successfully', user });
  } catch (error) { next(error); }
};
