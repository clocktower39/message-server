const express = require('express');
const messageController = require('../controllers/messageController');
const auth = require("../middleware/auth");

const router = express.Router();

router.get('/messages', auth, messageController.get_messages);
router.post('/messages', auth, messageController.post_message);

module.exports = router;