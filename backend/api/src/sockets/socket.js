const jwt = require("jsonwebtoken");
const env = require("../config/env");
function configureSocket(io) {
  io.use((socket, next) => {
    const token = socket.handshake.auth?.token;
    if (!token) return next(new Error("Authentication required"));
    try {
      socket.user = jwt.verify(token, env.jwtSecret);
      next();
    } catch {
      next(new Error("Invalid token"));
    }
  });
  io.on("connection", (socket) => {
    console.log(
      `[socket.io] client connected ${socket.id} (${socket.user.email || socket.user.sub})`,
    );
    socket.on("disconnect", () =>
      console.log(`[socket.io] client disconnected ${socket.id}`),
    );
    socket.on("claim:subscribe", (claimId) => {
      if (typeof claimId === "string") {
        socket.join(`claim:${claimId}`);
        console.log(`[socket.io] ${socket.id} subscribed to claim:${claimId}`);
      }
    });
    socket.on("claim:unsubscribe", (claimId) => {
      if (typeof claimId === "string") socket.leave(`claim:${claimId}`);
    });
  });
}
module.exports = { configureSocket };
