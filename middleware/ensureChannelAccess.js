const Channel = require("../models/channel");

const ensureChannelAccess = async (req, res, next) => {
  try {
    const channelId = req.body.channel;
    if (!channelId) {
      return res.status(400).send({ error: "Channel is required." });
    }

    const channel = await Channel.findById(channelId).lean();
    if (!channel) {
      return res.status(404).send({ error: "Channel not found." });
    }

    const userId = res.locals.user._id.toString();
    const bannedIds = (channel.bannedUsers || []).map((id) => id.toString());
    if (bannedIds.includes(userId)) {
      return res.status(403).send({ error: "You are banned from this channel." });
    }

    if (!channel.isPublic) {
      const userIds = (channel.users || []).map((id) => id.toString());
      if (!userIds.includes(userId)) {
        return res.status(403).send({ error: "You do not have access to this channel." });
      }
    }

    res.locals.channel = channel;
    next();
  } catch (error) {
    next(error);
  }
};

module.exports = ensureChannelAccess;
