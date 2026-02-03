process.env.ACCESS_TOKEN_SECRET = "test-access-secret";
process.env.REFRESH_TOKEN_SECRET = "test-refresh-secret";
process.env.SALT_WORK_FACTOR = "10";

const jwt = require("jsonwebtoken");
const mongoose = require("mongoose");
const { MongoMemoryServer } = require("mongodb-memory-server");
const request = require("supertest");

const User = require("../models/user");
const Channel = require("../models/channel");
const Message = require("../models/message");

let mongoServer;
let app;
let connectToDB;
let httpServer;

describe("GET /messages pagination", () => {
  let accessToken;
  let channelId;

  beforeAll(async () => {
    mongoServer = await MongoMemoryServer.create();
    process.env.DBURL = mongoServer.getUri();

    ({ app, connectToDB, httpServer } = require("../server"));
    await connectToDB();

    const user = await User.create({
      username: "tester",
      firstName: "Test",
      lastName: "User",
      email: "test@example.com",
      password: "password123",
    });

    const channel = await Channel.create({
      name: "general",
      description: "General chat",
      isPublic: false,
      createdBy: user._id,
      admins: [user._id],
      users: [user._id],
    });

    channelId = channel._id.toString();

    await Message.create([
      {
        message: "First",
        channel: channel._id,
        user: user._id,
        timeStamp: new Date(Date.now() - 30000),
      },
      {
        message: "Second",
        channel: channel._id,
        user: user._id,
        timeStamp: new Date(Date.now() - 20000),
      },
      {
        message: "Third",
        channel: channel._id,
        user: user._id,
        timeStamp: new Date(Date.now() - 10000),
      },
    ]);

    accessToken = jwt.sign(user._doc, process.env.ACCESS_TOKEN_SECRET, {
      expiresIn: "180m",
    });
  });

  afterAll(async () => {
    if (global.io) {
      global.io.close();
    }
    if (httpServer && httpServer.listening) {
      await new Promise((resolve) => httpServer.close(resolve));
    }
    await mongoose.disconnect();
    if (mongoServer) {
      await mongoServer.stop();
    }
  });

  it("returns a paginated page of messages", async () => {
    const response = await request(app)
      .get(`/messages?channelId=${channelId}&limit=2`)
      .set("Authorization", `Bearer ${accessToken}`);

    expect(response.status).toBe(200);
    expect(Array.isArray(response.body.messages)).toBe(true);
    expect(response.body.messages.length).toBe(2);
    expect(response.body.hasMore).toBe(true);
    expect(response.body.nextCursor).toBeTruthy();
  });
});
