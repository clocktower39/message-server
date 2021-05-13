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
const SALT_WORK_FACTOR = Number(process.env.SALT_WORK_FACTOR);

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

let UserSchema = mongoose.Schema({
    username: { type: String, required: true, index: { unique: true } },
    firstName: { type: String, required: true },
    lastName: { type: String, required: true },
    email: { type: String, required: true },
    password: { type: String, required: true },
});

UserSchema.pre('save', function(next) {
    let user = this;

    // only hash the password if it has been modified (or is new)
    if (!user.isModified('password')) return next();

    // generate a salt
    bcrypt.genSalt(SALT_WORK_FACTOR, function(err, salt) {
        if (err) return next(err);

        // hash the password using our new salt
        bcrypt.hash(user.password, salt, function(err, hash) {
            if (err) return next(err);
            // override the cleartext password with the hashed one
            user.password = hash;
            next();
        });
    });
});

UserSchema.methods.comparePassword = function(candidatePassword, cb) {
    bcrypt.compare(candidatePassword, this.password, function(err, isMatch) {
        if (err) return cb(err);
        cb(null, isMatch);
    });
};

let User = mongoose.model('User', UserSchema);

app.post('/signup', (req, res) => {
    let user = new User(req.body);
    
    let saveUser = () => {
        user.save((err)=>{
            if(err){
                res.send({error: {...err.errors}});
            }
            else{
                res.send({
                    status: 'success',
                    user
                })
            }
        });
    }
    saveUser();
})

app.post('/login', (req, res) => {
    User.findOne({ username: req.body.username }, function(err, user) {
        if (err) throw err;
        if(!user){
            res.send({
                authenticated: false,
                error: {username: 'Username not found'}
            })
        }
        else {
            user.comparePassword(req.body.password, function(err, isMatch) {
                if (err){
                    res.send({
                        authenticated: false,
                    })
                }
                //if the password does not match and previous session was not authenticated, do not authenticate
                if(req.body.authenticated && isMatch || req.body.authenticated === 'true'){
                    res.send({
                        authenticated: true,
                        user: user._doc
                    })
                }
                else{
                    res.send({
                        authenticated: false,
                        error: {password: 'Incorrect Password'}
                    })
                }
            });
        }
    });
})

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

