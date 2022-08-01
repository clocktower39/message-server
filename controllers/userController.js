const User = require("../models/user");
const mongoose = require("mongoose");
const jwt = require("jsonwebtoken");
const ACCESS_TOKEN_SECRET = process.env.ACCESS_TOKEN_SECRET;

const signup_user = (req, res) => {
  let user = new User(req.body);
  let saveUser = () => {
    user.save((err) => {
      if (err) {
        res.send({ error: { err } });
      } else {
        res.send({
          status: "success",
          user,
        });
      }
    });
  };
  saveUser();
};

const login_user = (req, res) => {
  User.findOne({ username: req.body.username }, function (err, user) {
    if (err) throw err;
    if (!user) {
      res.send({
        authenticated: false,
        error: { username: "Username not found" },
      });
    } else {
      user.comparePassword(req.body.password, function (err, isMatch) {
        if (err) {
          res.send({
            authenticated: false,
          });
        }
        //if the password does not match and previous session was not authenticated, do not authenticate
        if (isMatch) {
          const accessToken = jwt.sign(user._doc, ACCESS_TOKEN_SECRET,{
            expiresIn: '30d' // expires in 30 days
          });
          res.send({
            accessToken: accessToken,
          });
        } else {
          res.send({
            error: { password: "Incorrect Password" },
          });
        }
      });
    }
  });
};

const upload_profile_picture = (req, res) => {
  User.findOneAndUpdate({ username: res.locals.user.username }, { profilePicture: res.req.file.id }, (err, user) => {
    if(err){
      return res.send(err);
    }
    
    return res.json({ src: res.req.file.filename })
  })
}

const get_profile_picture = (req, res) => {
  if(req.params.id) {
  let gridfsBucket = new mongoose.mongo.GridFSBucket(mongoose.connection.db, {
    bucketName: 'profilePictures'
  });

  gridfsBucket.find({ _id: mongoose.Types.ObjectId(req.params.id) }).toArray((err, files) => {
    // Check if files
    if (!files || files.length === 0) {
      return res.status(404).json({
        err: 'No files exist'
      });
    }

    // Check if image
    if (files[0].contentType === 'image/jpeg' || files[0].contentType === 'image/png') {
      // Read output to browser
      const readstream = gridfsBucket.openDownloadStream(files[0]._id);
      readstream.pipe(res);
    } else {
      res.status(404).json({
        err: 'Not an image'
      });
    }
  });
}
else {
  res.status(404).json({
    err: 'Missing parameter',
  })
}
}

const delete_profile_picture = (req, res) => {
  let gridfsBucket = new mongoose.mongo.GridFSBucket(mongoose.connection.db, {
    bucketName: 'profilePictures'
  });

  User.findById(res.locals.user._id, (err, user) => {
    if(err) return res.send(err);
      if(user.profilePicture){
        gridfsBucket.delete(mongoose.Types.ObjectId(user.profilePicture));
        user.profilePicture = undefined;
        user.save((err,u) => {
          if(err) return res.send(err);
          return res.sendStatus(200);
        });
      }
      else {
        return res.sendStatus(204);
      }
  })

  
}

const checkAuthLoginToken = (req, res) => {
  res.send('Authorized')
}

module.exports = {
  signup_user,
  login_user,
  upload_profile_picture,
  get_profile_picture,
  delete_profile_picture,
  checkAuthLoginToken,
};
