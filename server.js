const express = require('express');
const bodyParser = require('body-parser');
const app = express();
const http = require('http').Server(app);
const io = require('socket.io')(http, {
    cors: {
      origin: "*",
      methods: ["GET", "POST"],
      credentials: true
    }
  });

const mongoose = require('mongoose');
const cors = require('cors');

require('dotenv').config();
const dbUrl = process.env.DBURL;
let PORT = process.env.PORT;
if( PORT == null || PORT == ""){
    PORT = 8000;
}

app.use(cors())
app.use(express.static(__dirname));
app.use(bodyParser.urlencoded({extended: false}))
app.use(bodyParser.json());

let corsWhitelist = [
    'http://10.37.39.39:3001',
    'http://mattkearns.ddns.net:3001',
    '*']
var corsOptions = {
  origin: function (origin, callback) {
    if (corsWhitelist.indexOf(origin) !== -1) {
      callback(null, true)
    } else {
      callback(new Error('Not allowed by CORS'))
    }
  }
}

let Message = mongoose.model('Message', {
    name: String,
    message: String,
    timeStamp: { type: Date, default: Date.now },
    ip: String,
});

app.get('/messages', (req,res) => {
    Message.find({}, (err,messages)=>{
        res.json(messages)
        console.log(req.socket.remoteAddress);
    })
})

app.post('/messages', (req,res) => {
    let message = new Message(req.body);

    let saveMessage = () => {
        message.timeStamp = new Date();
        message.ip = req.socket.remoteAddress.substr(7);
        
        message.save((err)=>{
            if(err){
                sendStatus(500);
            }
            else{
                io.emit('message', message)
                res.sendStatus(200);
            }
        });
        console.log('last')
    }
    
    saveMessage();
})

io.on('connection', (socket) => {
    console.log('a user connected')
});

mongoose.connect(dbUrl, 
    {
        useUnifiedTopology: true,
        useNewUrlParser: true,
        useCreateIndex: true
    } , (err) => {
    console.log('mongo db connection', err)
})

let server = http.listen(3000, ()=> {
    console.log(`Server is listening on port ${server.address().port}`);
});

