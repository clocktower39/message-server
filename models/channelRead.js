const mongoose = require("mongoose");

const ChannelReadSchema = new mongoose.Schema(
  {
    user: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    channel: { type: mongoose.Schema.Types.ObjectId, ref: "Channel", required: true },
    lastReadAt: { type: Date, default: Date.now },
  },
  { minimize: false }
);

ChannelReadSchema.index({ user: 1, channel: 1 }, { unique: true });

const ChannelRead = mongoose.model("ChannelRead", ChannelReadSchema);
module.exports = ChannelRead;
