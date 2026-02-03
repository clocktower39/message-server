process.env.ACCESS_TOKEN_SECRET = "test-access-secret";
process.env.REFRESH_TOKEN_SECRET = "test-refresh-secret";

const jwt = require("jsonwebtoken");
const mongoose = require("mongoose");
const { MongoMemoryServer } = require("mongodb-memory-server");
const ioClient = require("socket.io-client");
const Channel = require("../models/channel");
const { httpServer, connectToDB } = require("../server");

describe("socket typing events", () => {
  let port;
  let serverInstance;
  let mongoServer;
  let channelId;

  beforeAll(async () => {
    mongoServer = await MongoMemoryServer.create();
    process.env.DBURL = mongoServer.getUri();
    await connectToDB();
    const channel = await Channel.create({
      name: "test-channel",
      description: "Test channel",
      isPublic: true,
      createdBy: new mongoose.Types.ObjectId(),
      admins: [],
      users: [],
    });
    channelId = channel._id.toString();

    await new Promise((resolve) => {
      serverInstance = httpServer.listen(0, () => {
        port = serverInstance.address().port;
        resolve();
      });
    });
  });

  afterAll(async () => {
    if (serverInstance) {
      if (global.io) {
        global.io.close();
      }
      await new Promise((resolve) => serverInstance.close(resolve));
    }
    await mongoose.disconnect();
    if (mongoServer) {
      await mongoServer.stop();
    }
  });

  it("broadcasts typing events to other channel members", (done) => {
    const tokenOne = jwt.sign({ _id: "user-1", username: "user-1" }, process.env.ACCESS_TOKEN_SECRET);
    const tokenTwo = jwt.sign({ _id: "user-2", username: "user-2" }, process.env.ACCESS_TOKEN_SECRET);

    const clientOne = ioClient(`http://localhost:${port}`, {
      auth: { token: tokenOne },
      transports: ["websocket"],
      forceNew: true,
    });

    const clientTwo = ioClient(`http://localhost:${port}`, {
      auth: { token: tokenTwo },
      transports: ["websocket"],
      forceNew: true,
    });

    const cleanup = () => {
      clientOne.close();
      clientTwo.close();
    };

    let connectedCount = 0;
    const maybeEmitTyping = () => {
      connectedCount += 1;
      if (connectedCount === 2) {
        clientOne.emit("join_channel", channelId);
        clientTwo.emit("join_channel", channelId);
        setTimeout(() => {
          clientOne.emit("typing", {
            channelId,
            userId: "user-1",
            username: "Tester",
          });
        }, 50);
      }
    };

    clientTwo.on("typing", (payload) => {
      try {
        expect(payload.channelId).toBe(channelId);
        expect(payload.userId).toBe("user-1");
        expect(payload.username).toBe("Tester");
        cleanup();
        done();
      } catch (error) {
        cleanup();
        done(error);
      }
    });

    clientOne.on("connect", maybeEmitTyping);
    clientTwo.on("connect", maybeEmitTyping);
  });
});
