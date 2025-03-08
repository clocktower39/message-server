const User = require("../models/user");
const mongoose = require("mongoose");
const jwt = require("jsonwebtoken");
const crypto = require('crypto');
const path = require('path');
const ACCESS_TOKEN_SECRET = process.env.ACCESS_TOKEN_SECRET;

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
              const accessToken = jwt.sign(user._doc, ACCESS_TOKEN_SECRET, {
                expiresIn: "30d", // expires in 30 days
              });
              res.send({
                accessToken,
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
    .then((users) => {
      res.send({
        users,
      });
    })
    .catch((err) => next(err));
};

const checkAuthLoginToken = (req, res, next) => {
  res.send("Authorized");
};

module.exports = {
  signup_user,
  login_user,
  upload_profile_picture,
  get_profile_picture,
  delete_profile_picture,
  checkAuthLoginToken,
  get_user_list,
};
