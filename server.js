const express = require("express");
const bodyParser = require("body-parser");
const http = require("http");
const mongoose = require("mongoose");
const { ValidationError } = require("express-validation");
const cors = require("cors");
require("dotenv").config({ quiet: true });

const userRoutes = require("./routes/userRoutes");
const messageRoutes = require("./routes/messageRoutes");
const channelRoutes = require("./routes/channelRoutes");

const app = express();
const httpServer = http.Server(app);

global.io = require("./io").initialize(httpServer, {
  cors: {
    origin: "*",
    methods: ["GET", "POST"],
    credentials: true,
  },
});

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

const connectedClients = {};
global.connectedClients = connectedClients;

const getClientStatuses = () =>
  Object.keys(connectedClients).reduce((statuses, id) => {
    statuses[id] = "online";
    return statuses;
  }, {});

const registerSocketHandlers = () => {
  global.io.on("connection", (socket) => {
    const userId = socket.handshake.query.userId;

    if (userId) {
      connectedClients[userId] = socket.id;
      global.io.emit("clientStatusChanged", { userId, status: "online" });
    }

    console.log(`${userId} connected with IP: ${socket.conn.remoteAddress}`);

    socket.on("requestClientStatuses", () => {
      socket.emit("currentClientStatuses", getClientStatuses());
    });

    socket.on("join_channel", (channelId) => {
      if (channelId) {
        socket.join(`channel:${channelId}`);
      }
    });

    socket.on("leave_channel", (channelId) => {
      if (channelId) {
        socket.leave(`channel:${channelId}`);
      }
    });

    socket.on("typing", ({ channelId, userId: typingUserId, username }) => {
      if (!channelId || !typingUserId) {
        return;
      }
      socket.to(`channel:${channelId}`).emit("typing", {
        channelId,
        userId: typingUserId,
        username,
      });
    });

    socket.on("stop_typing", ({ channelId, userId: typingUserId }) => {
      if (!channelId || !typingUserId) {
        return;
      }
      socket.to(`channel:${channelId}`).emit("stop_typing", {
        channelId,
        userId: typingUserId,
      });
    });

    socket.on("disconnect", () => {
      if (userId && connectedClients[userId]) {
        delete connectedClients[userId];
        global.io.emit("clientStatusChanged", { userId, status: "offline" });
      }
      console.log(`${userId} disconnected`);
    });
  });
};

registerSocketHandlers();

const connectToDB = async () => {
  try {
    await mongoose.connect(dbUrl);
    console.log("MongoDB connection successful");
  } catch (err) {
    console.error("MongoDB connection error:", err);
  }
};

// Central error handler for API responses.
app.use((err, req, res, next) => {
  if (err instanceof ValidationError) {
    return res.status(err.statusCode).json(err);
  }
  console.error(err.stack);
  res.status(500).send(err.stack);
});

const startServer = async (port = PORT) => {
  await connectToDB();
  return httpServer.listen(port, () => {
    console.log(`Server is listening on port ${port}`);
  });
};

if (require.main === module) {
  startServer();
}

module.exports = {
  app,
  httpServer,
  startServer,
  connectToDB,
  connectedClients,
};
