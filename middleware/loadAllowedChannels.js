const Channel = require("../models/channel");

const loadAllowedChannels = async (req, res, next) => {
  try {
    // Find channels that are either public or include the current user in their users list
    const allowedChannels = await Channel.find({
      $or: [
        { isPublic: true },
        { users: res.locals.user._id }
      ]
    }).select('_id').lean();

    // Attach the allowed channel IDs to res.locals for use in later middleware or controllers
    res.locals.allowedChannelIds = allowedChannels.map(channel => channel._id);
    next();
  } catch (error) {
    next(error);
  }
};

module.exports = loadAllowedChannels;
