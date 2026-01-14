const express = require("express");
const bodyParser = require("body-parser");
const app = express();
const http = require("http").Server(app);
const mongoose = require("mongoose");
const { ValidationError } = require("express-validation");
const cors = require("cors");
require("dotenv").config();
global.io = require("./io").initialize(http, {
  cors: {
    origin: "*",
    methods: ["GET", "POST"],
    credentials: true,
  },
});
const userRoutes = require("./routes/userRoutes");
const messageRoutes = require("./routes/messageRoutes");
const channelRoutes = require("./routes/channelRoutes");

const dbUrl = process.env.DBURL;

let PORT = process.env.PORT;
if (PORT == null || PORT == "") {
  PORT = 8000;
}

app.use(cors());
app.use(express.static(__dirname));
app.use(bodyParser.urlencoded({ extended: false }));
app.use(bodyParser.json());
app.use("/", userRoutes);
app.use("/", messageRoutes);
app.use("/", channelRoutes);

let corsWhitelist = ["*"];
var corsOptions = {
  origin: function (origin, callback) {
    if (corsWhitelist.indexOf(origin) !== -1) {
      callback(null, true);
    } else {
      callback(new Error("Not allowed by CORS"));
    }
  },
};

const connectedClients = {};

global.io.on("connection", (socket) => {
  const userId = socket.handshake.query.userId;

  // Save the user's socket ID
  connectedClients[userId] = socket.id;

  // Notify all trainers about the client's online status
  global.io.emit("clientStatusChanged", { userId, status: "online" });

  console.log(`${userId} connected with IP: ${socket.conn.remoteAddress}`);

  // Listen for the 'requestClientStatuses' event and send the current status
  socket.on("requestClientStatuses", () => {
    const clientStatuses = Object.keys(connectedClients).reduce((statuses, id) => {
      statuses[id] = "online";
      return statuses;
    }, {});
    socket.emit("currentClientStatuses", clientStatuses);
  });

  socket.on("disconnect", () => {
    // Remove the client from the connectedClients object
    delete connectedClients[userId];

    // Notify all trainers about the client's offline status
    global.io.emit("clientStatusChanged", { userId, status: "offline" });

    console.log(`${userId} disconnected`);
  });
});

const connectToDB = async () => {
  try {
    await mongoose.connect(dbUrl);
    console.log("MongoDB connection successful");
  } catch (err) {
    console.error("MongoDB connection error:", err);
  }
};

connectToDB();

// Error handling Function
app.use((err, req, res, next) => {
  if (err instanceof ValidationError) {
    return res.status(err.statusCode).json(err);
  }
  console.error(err.stack);
  res.status(500).send(err.stack);
});

let server = http.listen(PORT, () => {
  console.log(`Server is listening on port ${PORT}`);
});
