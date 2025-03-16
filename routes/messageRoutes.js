const express = require('express');
const messageController = require('../controllers/messageController');
const { verifyAccessToken, verifyRefreshToken } = require("../middleware/auth");

const router = express.Router();

router.get('/messages', verifyAccessToken, messageController.get_messages);
router.post('/messages', verifyAccessToken, messageController.post_message);
router.post('/deleteMessage', verifyAccessToken, messageController.delete_message);

module.exports = router;