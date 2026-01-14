const Channel = require("../models/channel");

const uniqueIds = (ids = []) => {
  const normalized = ids
    .filter(Boolean)
    .map((id) => id.toString());
  return [...new Set(normalized)];
};

const canManageChannel = (channel, userId) => {
  const normalizedUserId = userId.toString();
  if (channel.createdBy && channel.createdBy.toString() === normalizedUserId) {
    return true;
  }
  return (channel.admins || []).some((adminId) => adminId.toString() === normalizedUserId);
};

const buildChannelUsers = ({ isPublic, users, admins, createdBy }) => {
  if (isPublic) {
    return uniqueIds(users);
  }

  return uniqueIds([...(users || []), ...(admins || []), createdBy]);
};

const get_channels = (req, res, next) => {
  Channel.find({
    $or: [{ isPublic: true }, { users: res.locals.user._id }],
  })
    .lean()
    .populate("users", "_id username firstName lastName profilePicture")
    .populate("createdBy", "_id username firstName lastName profilePicture")
    .populate("admins", "_id username firstName lastName profilePicture")
    .exec()
    .then((channels) => {
      res.json(channels);
    })
    .catch((err) => next(err));
};

const create_channel = (req, res, next) => {
  const { name, description, isPublic = true, users = [], admins = [] } = req.body;
  const creatorId = res.locals.user._id;

  if (!name) {
    return res.status(400).send({ error: "Channel name is required." });
  }

  const normalizedAdmins = uniqueIds([...admins, creatorId]);
  const normalizedUsers = buildChannelUsers({
    isPublic: Boolean(isPublic),
    users,
    admins: normalizedAdmins,
    createdBy: creatorId,
  });

  const channel = new Channel({
    name,
    description,
    isPublic: Boolean(isPublic),
    createdBy: creatorId,
    admins: normalizedAdmins,
    users: normalizedUsers,
  });

  channel
    .save()
    .then((savedChannel) =>
      savedChannel.populate(
        "users createdBy admins",
        "_id username firstName lastName profilePicture"
      )
    )
    .then((savedChannel) => res.status(201).json(savedChannel))
    .catch((err) => next(err));
};

const update_channel = (req, res, next) => {
  const { name, description, isPublic, users, admins } = req.body;
  const userId = res.locals.user._id;

  Channel.findById(req.params.id)
    .then((channel) => {
      if (!channel) {
        return res.status(404).send({ error: "Channel not found." });
      }

      if (!canManageChannel(channel, userId)) {
        return res.status(403).send({ error: "Not authorized to manage this channel." });
      }

      if (name !== undefined) {
        channel.name = name;
      }

      if (description !== undefined) {
        channel.description = description;
      }

      const nextIsPublic = typeof isPublic === "boolean" ? isPublic : channel.isPublic;
      channel.isPublic = nextIsPublic;

      const nextAdmins =
        admins !== undefined
          ? uniqueIds([...admins, channel.createdBy])
          : uniqueIds(channel.admins);
      channel.admins = nextAdmins;

      const nextUsers = users !== undefined ? users : channel.users;
      channel.users = buildChannelUsers({
        isPublic: nextIsPublic,
        users: nextUsers,
        admins: nextAdmins,
        createdBy: channel.createdBy,
      });

      return channel.save();
    })
    .then((savedChannel) => {
      if (!savedChannel) {
        return null;
      }
      return savedChannel.populate(
        "users createdBy admins",
        "_id username firstName lastName profilePicture"
      );
    })
    .then((savedChannel) => {
      if (savedChannel) {
        res.json(savedChannel);
      }
    })
    .catch((err) => next(err));
};

const delete_channel = (req, res, next) => {
  const userId = res.locals.user._id;

  Channel.findById(req.params.id)
    .then((channel) => {
      if (!channel) {
        return res.status(404).send({ error: "Channel not found." });
      }

      if (!canManageChannel(channel, userId)) {
        return res.status(403).send({ error: "Not authorized to manage this channel." });
      }

      return Channel.deleteOne({ _id: channel._id });
    })
    .then((result) => {
      if (result) {
        res.sendStatus(204);
      }
    })
    .catch((err) => next(err));
};

module.exports = {
  get_channels,
  create_channel,
  update_channel,
  delete_channel,
};
