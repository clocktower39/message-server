process.env.ACCESS_TOKEN_SECRET = "test-access-secret";
process.env.REFRESH_TOKEN_SECRET = "test-refresh-secret";

const ioClient = require("socket.io-client");
const { httpServer } = require("../server");

describe("socket typing events", () => {
  let port;
  let serverInstance;

  beforeAll((done) => {
    serverInstance = httpServer.listen(0, () => {
      port = serverInstance.address().port;
      done();
    });
  });

  afterAll((done) => {
    if (serverInstance) {
      if (global.io) {
        global.io.close();
      }
      serverInstance.close(done);
    } else {
      done();
    }
  });

  it("broadcasts typing events to other channel members", (done) => {
    const channelId = "channel-test-1";

    const clientOne = ioClient(`http://localhost:${port}`, {
      query: { userId: "user-1" },
      transports: ["websocket"],
      forceNew: true,
    });

    const clientTwo = ioClient(`http://localhost:${port}`, {
      query: { userId: "user-2" },
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
