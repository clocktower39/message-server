const express = require('express');
const userController = require('../controllers/userController');
const { verifyAccessToken } = require("../middleware/auth");
const { uploadProfilePicture } = require("../mygridfs");

const router = express.Router();

router.get('/users', verifyAccessToken, userController.get_user_list);
router.get('/user/image/:id', userController.get_profile_picture);
router.get('/user/remove/image/', verifyAccessToken, userController.delete_profile_picture);
router.post('/user/image/upload', verifyAccessToken, uploadProfilePicture.single("file"), userController.upload_profile_picture);
router.post('/login', userController.login_user);
router.post('/signup', userController.signup_user);
router.post("/refresh-tokens", userController.refresh_tokens);
router.get("/friends", verifyAccessToken, userController.get_friends);
router.post("/friends/request", verifyAccessToken, userController.request_friend);
router.post("/friends/accept", verifyAccessToken, userController.accept_friend);
router.post("/friends/decline", verifyAccessToken, userController.decline_friend);
router.delete("/friends/remove", verifyAccessToken, userController.remove_friend);

module.exports = router;
