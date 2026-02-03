const mongoose = require("mongoose");

const ChannelSchema = new mongoose.Schema({
  name: { type: String, required: true, unique: true },
  description: { type: String },
  isPublic: { type: Boolean, default: true },
  isDM: { type: Boolean, default: false },
  dmKey: { type: String, unique: true, sparse: true },
  createdBy: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
  admins: [{ type: mongoose.Schema.Types.ObjectId, ref: "User" }],
  users: [{ type: mongoose.Schema.Types.ObjectId, ref: "User" }],
  bannedUsers: [{ type: mongoose.Schema.Types.ObjectId, ref: "User" }],
});

const Channel = mongoose.model("Channel", ChannelSchema);
module.exports = Channel;
