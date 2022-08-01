const express = require('express');
const bodyParser = require('body-parser');
const app = express();
const http = require('http').Server(app);
const mongoose = require('mongoose');
const cors = require('cors');
require('dotenv').config();
global.io = require('./io').initialize(http, {
  cors: {
    origin: "*",
    methods: ["GET", "POST"],
    credentials: true
  }
});
const userRoutes = require('./routes/userRoutes');
const messageRoutes = require('./routes/messageRoutes');

const dbUrl = process.env.DBURL;

let PORT = process.env.PORT;
if( PORT == null || PORT == ""){
    PORT = 8000;
}


app.use(cors())
app.use(express.static(__dirname));
app.use(bodyParser.urlencoded({extended: false}))
app.use(bodyParser.json());
app.use('/', userRoutes);
app.use('/', messageRoutes);

let corsWhitelist = ['*'];
var corsOptions = {
  origin: function (origin, callback) {
    if (corsWhitelist.indexOf(origin) !== -1) {
      callback(null, true)
    } else {
      callback(new Error('Not allowed by CORS'))
    }
  }
}

global.io.on('connection', (socket) => {
    console.log('a user connected')
});

mongoose.connect(dbUrl, 
    {
        useUnifiedTopology: true,
        useNewUrlParser: true,
        useCreateIndex: true,
        useFindAndModify: false,
    } , (err) => {
    console.log('mongo db connection', err)
})

let server = http.listen(PORT, ()=> {
    console.log(`Server is listening on port ${PORT}`);
});

