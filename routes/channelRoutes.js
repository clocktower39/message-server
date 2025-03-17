const express = require('express');
const channelController = require('../controllers/channelController');
const { verifyAccessToken, verifyRefreshToken } = require("../middleware/auth");

const router = express.Router();

router.get('/api/channels', verifyAccessToken, channelController.get_channels);

module.exports = router;