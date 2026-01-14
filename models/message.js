const mongoose = require("mongoose");

const MessageSchema = new mongoose.Schema(
  {
    message: String,
    timeStamp: { type: Date, default: Date.now },
    ip: String,
    user: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
    channel: { type: mongoose.Schema.Types.ObjectId, ref: "Channel", required: true },
  },
  { minimize: false }
);

const Message = mongoose.model("Message", MessageSchema);
module.exports = Message;
