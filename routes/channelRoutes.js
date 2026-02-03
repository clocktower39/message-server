const express = require('express');
const channelController = require('../controllers/channelController');
const { verifyAccessToken } = require("../middleware/auth");

const router = express.Router();

router.get('/api/channels', verifyAccessToken, channelController.get_channels);
router.post('/api/channels', verifyAccessToken, channelController.create_channel);
router.patch('/api/channels/:id', verifyAccessToken, channelController.update_channel);
router.delete('/api/channels/:id', verifyAccessToken, channelController.delete_channel);
router.post('/api/channels/:id/kick', verifyAccessToken, channelController.kick_user);
router.post('/api/channels/:id/ban', verifyAccessToken, channelController.ban_user);
router.post('/api/channels/:id/unban', verifyAccessToken, channelController.unban_user);

module.exports = router;
