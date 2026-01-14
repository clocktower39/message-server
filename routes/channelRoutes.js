const express = require('express');
const channelController = require('../controllers/channelController');
const { verifyAccessToken, verifyRefreshToken } = require("../middleware/auth");

const router = express.Router();

router.get('/api/channels', verifyAccessToken, channelController.get_channels);
router.post('/api/channels', verifyAccessToken, channelController.create_channel);
router.patch('/api/channels/:id', verifyAccessToken, channelController.update_channel);
router.delete('/api/channels/:id', verifyAccessToken, channelController.delete_channel);

module.exports = router;
