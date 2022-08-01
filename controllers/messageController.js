const Message = require("../models/message");

const get_messages = (req, res) => {
  Message.
  find({}).
  lean().
  populate('user', 'username firstName lastName profilePicture').
  exec(function (err, messages) {
    res.json(messages)
    console.log(req.socket.remoteAddress);
  })
};

const post_message = (req, res) => {
  let message = new Message(req.body);

  let saveMessage = () => {
    message.user = res.locals.user._id;
    message.timeStamp = new Date();
    message.ip = req.socket.remoteAddress.substr(7);

    message.save((err) => {
      if (err) {
        sendStatus(500);
      }
      else {
        Message.populate(message, { path: "user" }, function (err, message) {
          global.io.emit('message', message)
          res.send({ status: 200});
        });
      }
    });
  }

  saveMessage();
};

const delete_message = (req, res) => {
  if (req.body.message.user._id === res.locals.user._id) {
    Message.deleteOne({ _id: req.body.message._id }, (err, result) => {
      if (err) {
        res.send({...err});
      }
      else {
        if (result.deletedCount > 0) {
          global.io.emit('remove_message', req.body.message._id)
        }
        res.send(result);
      }
    });
  }
};

module.exports = {
  get_messages,
  post_message,
  delete_message,
};
