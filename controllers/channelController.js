const Channel = require("../models/channel");

const get_channels = (req, res, next) => {
  Channel.find({
    $or: [{ isPublic: true }, { users: res.locals.user._id }],
  })
    .lean()
    .populate("users", "_id username firstName lastName profilePicture")
    .exec()
    .then((channels) => {
      res.json(channels);
    })
    .catch((err) => next(err));
};

module.exports = {
  get_channels,
};
