const express = require("express");
const bodyParser = require("body-parser");
const http = require("http");
const mongoose = require("mongoose");
const { ValidationError } = require("express-validation");
const cors = require("cors");
require("dotenv").config({ quiet: true });
const jwt = require("jsonwebtoken");
const User = require("./models/user");
const Channel = require("./models/channel");

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
const ACCESS_TOKEN_SECRET = process.env.ACCESS_TOKEN_SECRET;

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

const canAccessChannel = async (userId, channelId) => {
  const channel = await Channel.findById(channelId).lean();
  if (!channel) {
    return false;
  }

  const normalizedUserId = userId.toString();
  const bannedIds = (channel.bannedUsers || []).map((id) => id.toString());
  if (bannedIds.includes(normalizedUserId)) {
    return false;
  }

  if (channel.isPublic) {
    return true;
  }

  const userIds = (channel.users || []).map((id) => id.toString());
  return userIds.includes(normalizedUserId);
};

global.io.use((socket, next) => {
  const token = socket.handshake.auth?.token || socket.handshake.query?.token;
  if (!token) {
    return next(new Error("Unauthorized"));
  }

  jwt.verify(token, ACCESS_TOKEN_SECRET, (err, user) => {
    if (err) {
      return next(new Error("Unauthorized"));
    }
    socket.user = user;
    next();
  });
});

const registerSocketHandlers = () => {
  global.io.on("connection", (socket) => {
    const userId = socket.user?._id;

    if (userId) {
      connectedClients[userId] = socket.id;
      global.io.emit("clientStatusChanged", { userId, status: "online" });
    }

    console.log(`${userId} connected with IP: ${socket.conn.remoteAddress}`);

    socket.on("requestClientStatuses", () => {
      socket.emit("currentClientStatuses", getClientStatuses());
    });

    socket.on("join_channel", async (channelId) => {
      if (!channelId || !userId) {
        return;
      }
      const allowed = await canAccessChannel(userId, channelId);
      if (allowed) {
        socket.join(`channel:${channelId}`);
      }
    });

    socket.on("leave_channel", (channelId) => {
      if (channelId) {
        socket.leave(`channel:${channelId}`);
      }
    });

    socket.on("typing", async ({ channelId, userId: typingUserId, username }) => {
      if (!channelId || !typingUserId || typingUserId !== userId) {
        return;
      }
      const allowed = await canAccessChannel(userId, channelId);
      if (!allowed) {
        return;
      }
      socket.to(`channel:${channelId}`).emit("typing", {
        channelId,
        userId: typingUserId,
        username,
      });
    });

    socket.on("stop_typing", async ({ channelId, userId: typingUserId }) => {
      if (!channelId || !typingUserId || typingUserId !== userId) {
        return;
      }
      const allowed = await canAccessChannel(userId, channelId);
      if (!allowed) {
        return;
      }
      socket.to(`channel:${channelId}`).emit("stop_typing", {
        channelId,
        userId: typingUserId,
      });
    });

    socket.on("disconnect", () => {
      console.log(`${userId} disconnected`);
      if (userId && connectedClients[userId]) {
        delete connectedClients[userId];
        const lastSeenAt = new Date();
        global.io.emit("clientStatusChanged", { userId, status: "offline", lastSeenAt });
        if (mongoose.connection.readyState === 1) {
          User.findByIdAndUpdate(userId, { lastSeenAt }).catch(() => null);
        }
        return;
      }
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
