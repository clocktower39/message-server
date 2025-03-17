const Message = require("../models/message");

const get_messages = (req, res, next) => {
  const allowedChannelIds = res.locals.allowedChannelIds;

  Message.find({ channel: { $in: allowedChannelIds } })
    .lean()
    .populate("user", "username firstName lastName profilePicture")
    .exec()
    .then((messages) => {
      res.json(messages);
      console.log(req.socket.remoteAddress);
    })
    .catch((err) => next(err));
};

const post_message = (req, res, next) => {
  let message = new Message(req.body);
  let saveMessage = () => {
    message.user = res.locals.user._id;
    message.timeStamp = new Date();
    message.ip = req.socket.remoteAddress.substr(7);

    message
      .save()
      .then((savedMessage) => {
        return Message.populate(message, { path: "user" });
      })
      .then((message) => {
        console.log(message)
        global.io.emit("message", message);
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
          global.io.emit("remove_message", req.body.message._id);
        }
        res.send(result);
      })
      .catch((err) => next(err));
  }
};

module.exports = {
  get_messages,
  post_message,
  delete_message,
};
