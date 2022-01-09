const Message = require("../models/message");
const io = require('../io').io();

const get_messages = (req, res) => {
  Message.find({}, (err,messages)=>{
      res.json(messages)
      console.log(req.socket.remoteAddress);
  })
};

const post_message = (req, res) => {
  let message = new Message(req.body);

  let saveMessage = () => {
      message.timeStamp = new Date();
      message.ip = req.socket.remoteAddress.substr(7);
      
      message.save((err)=>{
          if(err){
              sendStatus(500);
          }
          else{
              global.io.emit('message', message)
              res.sendStatus(200);
          }
      });
  }
  
  saveMessage();
};

module.exports = {
  get_messages,
  post_message,
};
