const router = require('express').Router();
router.post('/register', require('../controllers/auth.controller').register);
module.exports = router;
