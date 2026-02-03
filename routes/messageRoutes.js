const express = require('express');
const messageController = require('../controllers/messageController');
const { verifyAccessToken } = require("../middleware/auth");
const loadAllowedChannels = require("../middleware/loadAllowedChannels");
const ensureChannelAccess = require("../middleware/ensureChannelAccess");
const rateLimitMessages = require("../middleware/rateLimitMessages");

const router = express.Router();

router.get('/messages', verifyAccessToken, loadAllowedChannels, messageController.get_messages);
router.post(
  '/messages',
  verifyAccessToken,
  ensureChannelAccess,
  rateLimitMessages,
  messageController.post_message
);
router.post('/deleteMessage', verifyAccessToken, messageController.delete_message);
router.post(
  '/messages/:id/reactions',
  verifyAccessToken,
  loadAllowedChannels,
  messageController.toggle_reaction
);

module.exports = router;
