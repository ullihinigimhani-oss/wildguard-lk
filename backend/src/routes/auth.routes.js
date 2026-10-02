const router = require('express').Router();
router.post('/register', require('../controllers/auth.controller').register);
router.post('/login', require('../controllers/auth.controller').login);
router.get('/me', require('../middleware/auth.middleware'), require('../controllers/auth.controller').me);
module.exports = router;
