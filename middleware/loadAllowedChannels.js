const Channel = require("../models/channel");

const loadAllowedChannels = async (req, res, next) => {
  try {
    const userId = res.locals.user._id;

    // Keep the list to channels the user can access and isn't banned from.
    const allowedChannels = await Channel.find({
      bannedUsers: { $ne: userId },
      $or: [{ isPublic: true }, { users: userId }],
    })
      .select("_id")
      .lean();

    res.locals.allowedChannelIds = allowedChannels.map((channel) => channel._id);
    next();
  } catch (error) {
    next(error);
  }
};

module.exports = loadAllowedChannels;
