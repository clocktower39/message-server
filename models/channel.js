const mongoose = require("mongoose");

const ChannelSchema = new mongoose.Schema({
  name: { type: String, required: true, unique: true },
  description: { type: String },
  isPublic: { type: Boolean, default: true },
  createdBy: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
  admins: [{ type: mongoose.Schema.Types.ObjectId, ref: "User" }],
  users: [{ type: mongoose.Schema.Types.ObjectId, ref: "User" }],
});

const Channel = mongoose.model("Channel", ChannelSchema);
module.exports = Channel;
