const mongoose = require('mongoose');

const MessageSchema = new mongoose.Schema({
    name: String,
    message: String,
    timeStamp: { type: Date, default: Date.now },
    ip: String,
}, { minimize: false })

const Message = mongoose.model('Message', MessageSchema);
module.exports = Message;