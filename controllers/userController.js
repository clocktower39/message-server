const User = require("../models/user");
const mongoose = require("mongoose");
const jwt = require("jsonwebtoken");
const crypto = require("crypto");
const path = require("path");
const { verifyRefreshToken } = require("../middleware/auth");
const ACCESS_TOKEN_SECRET = process.env.ACCESS_TOKEN_SECRET;
const REFRESH_TOKEN_SECRET = process.env.REFRESH_TOKEN_SECRET;

const createTokens = (user) => {
  const accessToken = jwt.sign(user._doc, ACCESS_TOKEN_SECRET, {
    expiresIn: "180m", // Set a shorter expiration for access tokens
  });

  const refreshToken = jwt.sign(user._doc, REFRESH_TOKEN_SECRET, {
    expiresIn: "90d", // Set a longer expiration for refresh tokens
  });

  return { accessToken, refreshToken };
};

const uniqueIds = (ids = []) => {
  const normalized = ids
    .filter(Boolean)
    .map((id) => id.toString());
  return [...new Set(normalized)];
};

const getFriendPayload = async (userId) => {
  const user = await User.findById(userId)
    .populate("friends", "_id username profilePicture lastSeenAt")
    .populate("friendRequests.incoming", "_id username profilePicture lastSeenAt")
    .populate("friendRequests.outgoing", "_id username profilePicture lastSeenAt");

  if (!user) {
    return null;
  }

  return {
    friends: user.friends || [],
    incoming: user.friendRequests?.incoming || [],
    outgoing: user.friendRequests?.outgoing || [],
  };
};

const signup_user = (req, res, next) => {
  let user = new User(req.body);
  let saveUser = () => {
    user
      .save()
      .then(() => {
        res.send({
          status: "success",
          user,
        });
      })
      .catch((err) => next(err));
  };
  saveUser();
};

const login_user = (req, res, next) => {
  User.findOne({ username: req.body.username })
    .then((user) => {
      if (!user) {
        res.send({
          authenticated: false,
          error: { username: "Username not found" },
        });
      } else {
        user
          .comparePassword(req.body.password)
          .then((isMatch) => {
            if (isMatch) {
              const tokens = createTokens(user);
              res.send({
                accessToken: tokens.accessToken,
                refreshToken: tokens.refreshToken,
              });
            } else {
              res.send({
                error: { password: "Incorrect Password" },
              });
            }
          })
          .catch(() => res.send({ authenticated: false }));
      }
    })
    .catch((err) => next(err));
};

const refresh_tokens = (req, res, next) => {
  const { refreshToken } = req.body;

  verifyRefreshToken(refreshToken)
    .then((verifiedRefreshToken) => {
      return User.findById(verifiedRefreshToken._id).exec();
    })
    .then((user) => {
      if (!user) {
        return res.status(404).send({ error: "User not found" });
      }

      const tokens = createTokens(user);
      res.send({
        accessToken: tokens.accessToken,
      });
    })
    .catch((err) => res.status(403).send({ error: "Invalid refresh token", err }));
};

const upload_profile_picture = async (req, res, next) => {
  try {
    const db = mongoose.connection.db;
    const gridfsBucket = new mongoose.mongo.GridFSBucket(db, {
      bucketName: "profilePictures",
    });

    const user = await User.findById(res.locals.user._id);
    if (!user) {
      return res.status(404).send({ error: "User not found" });
    }

    // Check if the user has a profile picture before deleting
    if (user.profilePicture) {
      const existingFile = await gridfsBucket
        .find({ _id: new mongoose.Types.ObjectId(user.profilePicture) })
        .toArray();

      // Add a log to check the existing profile picture details
      console.log("Checking if profile picture exists:", existingFile);

      if (existingFile.length > 0) {
        await gridfsBucket.delete(new mongoose.Types.ObjectId(user.profilePicture));
      } else {
        console.warn(`File not found for id ${user.profilePicture}, skipping delete.`);
      }
    }

    const filename = crypto.randomBytes(16).toString("hex") + path.extname(req.file.originalname);

    // Upload the new profile picture to GridFS
    const uploadStream = gridfsBucket.openUploadStream(filename, {
      contentType: req.file.mimetype,
    });
    uploadStream.end(req.file.buffer);

    uploadStream.on("finish", async () => {
      // Save the new file ID to the user profile
      user.profilePicture = new mongoose.Types.ObjectId(uploadStream.id);
      const savedUser = await user.save();
      const accessToken = jwt.sign(user._doc, ACCESS_TOKEN_SECRET, {
        expiresIn: "30d", // expires in 30 days
      });

      res.status(200).json({
        accessToken,
      });
    });

    uploadStream.on("error", (err) => {
      console.error("Error during file upload:", err);
      res.status(500).send({ error: "Error uploading file", err });
    });
  } catch (err) {
    console.error("Error in profile picture upload process:", err);
    res.status(500).send({ error: "Failed to upload profile picture", err });
  }
};

const get_profile_picture = async (req, res, next) => {
  try {
    const db = mongoose.connection.db;
    const gridfsBucket = new mongoose.mongo.GridFSBucket(db, {
      bucketName: "profilePictures",
    });

    const files = await gridfsBucket
      .find({ _id: new mongoose.Types.ObjectId(req.params.id) })
      .toArray();

    if (!files || files.length === 0) {
      return res.status(404).json({ error: "No profile picture found" });
    }

    if (files[0].contentType === "image/jpeg" || files[0].contentType === "image/png") {
      const readstream = gridfsBucket.openDownloadStream(files[0]._id);
      readstream.pipe(res);
    } else {
      res.status(404).json({ error: "File is not an image" });
    }
  } catch (err) {
    res.status(500).send({ error: "Error retrieving profile picture", err });
  }
};

const delete_profile_picture = async (req, res, next) => {
  try {
    const db = mongoose.connection.db;
    const gridfsBucket = new mongoose.mongo.GridFSBucket(db, {
      bucketName: "profilePictures",
    });

    const user = await User.findById(res.locals.user._id);
    if (user && user.profilePicture) {
      await gridfsBucket.delete(new mongoose.Types.ObjectId(user.profilePicture));
      user.profilePicture = undefined;
      await user.save();
      return res.sendStatus(200);
    } else {
      return res.sendStatus(204); // No content to delete
    }
  } catch (err) {
    res.status(500).send({ error: "Failed to delete profile picture", err });
  }
};

const get_user_list = (req, res, next) => {
  User.find()
    .select("_id username profilePicture lastSeenAt")
    .then((users) => {
      res.send({
        users,
      });
    })
    .catch((err) => next(err));
};

const get_friends = async (req, res, next) => {
  try {
    const payload = await getFriendPayload(res.locals.user._id);
    if (!payload) {
      return res.status(404).send({ error: "User not found" });
    }
    res.send(payload);
  } catch (err) {
    next(err);
  }
};

const request_friend = async (req, res, next) => {
  try {
    const requesterId = res.locals.user._id.toString();
    const { userId } = req.body;

    if (!userId) {
      return res.status(400).send({ error: "User ID is required." });
    }

    if (requesterId === userId.toString()) {
      return res.status(400).send({ error: "Cannot friend yourself." });
    }

    const requester = await User.findById(requesterId);
    const target = await User.findById(userId);
    if (!requester || !target) {
      return res.status(404).send({ error: "User not found." });
    }

    const requesterFriends = uniqueIds(requester.friends || []);
    if (requesterFriends.includes(userId.toString())) {
      return res.status(400).send({ error: "Already friends." });
    }

    const outgoing = uniqueIds(requester.friendRequests?.outgoing || []);
    if (outgoing.includes(userId.toString())) {
      const payload = await getFriendPayload(requesterId);
      return res.send(payload);
    }

    requester.friendRequests = {
      incoming: requester.friendRequests?.incoming || [],
      outgoing: uniqueIds([...(requester.friendRequests?.outgoing || []), userId]),
    };

    target.friendRequests = {
      incoming: uniqueIds([...(target.friendRequests?.incoming || []), requesterId]),
      outgoing: target.friendRequests?.outgoing || [],
    };

    await requester.save();
    await target.save();

    const payload = await getFriendPayload(requesterId);
    res.send(payload);
  } catch (err) {
    next(err);
  }
};

const accept_friend = async (req, res, next) => {
  try {
    const receiverId = res.locals.user._id.toString();
    const { userId } = req.body;

    if (!userId) {
      return res.status(400).send({ error: "User ID is required." });
    }

    const receiver = await User.findById(receiverId);
    const requester = await User.findById(userId);
    if (!receiver || !requester) {
      return res.status(404).send({ error: "User not found." });
    }

    const incoming = uniqueIds(receiver.friendRequests?.incoming || []);
    if (!incoming.includes(userId.toString())) {
      return res.status(400).send({ error: "No pending request from this user." });
    }

    receiver.friendRequests = {
      incoming: incoming.filter((id) => id !== userId.toString()),
      outgoing: receiver.friendRequests?.outgoing || [],
    };
    requester.friendRequests = {
      incoming: requester.friendRequests?.incoming || [],
      outgoing: uniqueIds(requester.friendRequests?.outgoing || []).filter(
        (id) => id !== receiverId
      ),
    };

    receiver.friends = uniqueIds([...(receiver.friends || []), userId]);
    requester.friends = uniqueIds([...(requester.friends || []), receiverId]);

    await receiver.save();
    await requester.save();

    const payload = await getFriendPayload(receiverId);
    res.send(payload);
  } catch (err) {
    next(err);
  }
};

const decline_friend = async (req, res, next) => {
  try {
    const receiverId = res.locals.user._id.toString();
    const { userId } = req.body;

    if (!userId) {
      return res.status(400).send({ error: "User ID is required." });
    }

    const receiver = await User.findById(receiverId);
    const requester = await User.findById(userId);
    if (!receiver || !requester) {
      return res.status(404).send({ error: "User not found." });
    }

    const incoming = uniqueIds(receiver.friendRequests?.incoming || []);
    receiver.friendRequests = {
      incoming: incoming.filter((id) => id !== userId.toString()),
      outgoing: receiver.friendRequests?.outgoing || [],
    };
    requester.friendRequests = {
      incoming: requester.friendRequests?.incoming || [],
      outgoing: uniqueIds(requester.friendRequests?.outgoing || []).filter(
        (id) => id !== receiverId
      ),
    };

    await receiver.save();
    await requester.save();

    const payload = await getFriendPayload(receiverId);
    res.send(payload);
  } catch (err) {
    next(err);
  }
};

const remove_friend = async (req, res, next) => {
  try {
    const requesterId = res.locals.user._id.toString();
    const { userId } = req.body;

    if (!userId) {
      return res.status(400).send({ error: "User ID is required." });
    }

    const requester = await User.findById(requesterId);
    const target = await User.findById(userId);
    if (!requester || !target) {
      return res.status(404).send({ error: "User not found." });
    }

    requester.friends = uniqueIds(requester.friends || []).filter((id) => id !== userId.toString());
    target.friends = uniqueIds(target.friends || []).filter((id) => id !== requesterId);

    await requester.save();
    await target.save();

    const payload = await getFriendPayload(requesterId);
    res.send(payload);
  } catch (err) {
    next(err);
  }
};

module.exports = {
  signup_user,
  login_user,
  upload_profile_picture,
  get_profile_picture,
  delete_profile_picture,
  get_user_list,
  get_friends,
  request_friend,
  accept_friend,
  decline_friend,
  remove_friend,
  refresh_tokens,
};
