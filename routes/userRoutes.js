const express = require('express');
const userController = require('../controllers/userController');
const auth = require("../middleware/auth");

const router = express.Router();

router.get('/checkAuthToken', auth, userController.checkAuthLoginToken);
router.post('/login', userController.login_user);
router.post('/signup', userController.signup_user);

module.exports = router;