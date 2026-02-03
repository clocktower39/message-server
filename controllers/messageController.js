const Message = require("../models/message");

const DEFAULT_LIMIT = 30;
const MAX_LIMIT = 100;

const get_messages = async (req, res, next) => {
  try {
    const allowedChannelIds = (res.locals.allowedChannelIds || []).map((id) => id.toString());
    const { channelId, cursor, limit } = req.query;

    if (!channelId) {
      const messages = await Message.find({ channel: { $in: allowedChannelIds } })
        .lean()
        .populate("user", "username firstName lastName profilePicture")
        .exec();
      return res.json({ messages, hasMore: false, nextCursor: null });
    }

    if (!allowedChannelIds.includes(channelId)) {
      return res.status(403).send({ error: "Not authorized for this channel." });
    }

    const parsedLimit = Math.min(Number(limit) || DEFAULT_LIMIT, MAX_LIMIT);
    const query = { channel: channelId };
    if (cursor) {
      const cursorDate = new Date(cursor);
      if (!Number.isNaN(cursorDate.getTime())) {
        query.timeStamp = { $lt: cursorDate };
      }
    }

    const page = await Message.find(query)
      .sort({ timeStamp: -1 })
      .limit(parsedLimit + 1)
      .lean()
      .populate("user", "username firstName lastName profilePicture")
      .exec();

    const hasMore = page.length > parsedLimit;
    if (hasMore) {
      page.pop();
    }

    const messages = page.reverse();
    const nextCursor = messages.length
      ? new Date(messages[0].timeStamp).toISOString()
      : null;

    res.json({ messages, hasMore, nextCursor });
    console.log(req.socket.remoteAddress);
  } catch (err) {
    next(err);
  }
};

const post_message = (req, res, next) => {
  let message = new Message(req.body);
  let saveMessage = () => {
    message.user = res.locals.user._id;
    if (res.locals.channel?._id) {
      message.channel = res.locals.channel._id;
    }
    message.timeStamp = new Date();
    message.ip = req.socket.remoteAddress.substr(7);

    message
      .save()
      .then((savedMessage) => {
        return Message.populate(message, { path: "user" });
      })
      .then((message) => {
        const channelId = message.channel?.toString();
        if (channelId) {
          global.io.to(`channel:${channelId}`).emit("message", message);
        } else {
          global.io.emit("message", message);
        }
        res.send({ status: 200 });
      })
      .catch((err) => next(err));
  };

  saveMessage();
};

const delete_message = (req, res, next) => {
  if (req.body.message.user._id === res.locals.user._id) {
    Message.deleteOne({ _id: req.body.message._id })
      .then((result) => {
        if (result.deletedCount > 0) {
          const channelId = req.body.message?.channel?.toString();
          if (channelId) {
            global.io.to(`channel:${channelId}`).emit("remove_message", req.body.message._id);
          } else {
            global.io.emit("remove_message", req.body.message._id);
          }
        }
        res.send(result);
      })
      .catch((err) => next(err));
  }
};

const toggle_reaction = async (req, res, next) => {
  try {
    const userId = res.locals.user._id.toString();
    const { emoji } = req.body;

    if (!emoji) {
      return res.status(400).send({ error: "Emoji is required." });
    }

    const message = await Message.findById(req.params.id);
    if (!message) {
      return res.status(404).send({ error: "Message not found." });
    }

    const allowedChannelIds = (res.locals.allowedChannelIds || []).map((id) => id.toString());
    const channelId = message.channel?.toString();
    if (!channelId || !allowedChannelIds.includes(channelId)) {
      return res.status(403).send({ error: "Not authorized for this channel." });
    }

    const reactions = message.reactions || [];
    const reactionIndex = reactions.findIndex((entry) => entry.emoji === emoji);
    if (reactionIndex === -1) {
      reactions.push({ emoji, users: [userId] });
    } else {
      const users = (reactions[reactionIndex].users || []).map((id) => id.toString());
      if (users.includes(userId)) {
        reactions[reactionIndex].users = reactions[reactionIndex].users.filter(
          (id) => id.toString() !== userId
        );
      } else {
        reactions[reactionIndex].users.push(userId);
      }

      if (reactions[reactionIndex].users.length === 0) {
        reactions.splice(reactionIndex, 1);
      }
    }

    message.reactions = reactions;
    await message.save();

    if (channelId) {
      global.io.to(`channel:${channelId}`).emit("message_reaction", {
        messageId: message._id.toString(),
        reactions: message.reactions,
      });
    }

    res.json({
      messageId: message._id.toString(),
      reactions: message.reactions,
    });
  } catch (err) {
    next(err);
  }
};

module.exports = {
  get_messages,
  post_message,
  delete_message,
  toggle_reaction,
};
