require("dotenv").config({
  path: require("path").resolve(__dirname, "../../.env"),
});

const http = require("http");
const express = require("express");
const cors = require("cors");
const helmet = require("helmet");
const rateLimit = require("express-rate-limit");
const { Server } = require("socket.io");

const env = require("./config/env");
const { connectDB } = require("./config/db");
const routes = require("./routes");
const { errorHandler } = require("./middleware/errorHandler");
const { configureSocket } = require("./sockets/socket");

async function start() {
  await connectDB();

  const app = express();

  app.use(helmet());

  app.use(
    cors({
      origin: env.corsOrigin,
      credentials: true,
    }),
  );

  app.use(express.json({ limit: "2mb" }));

  app.use(
    rateLimit({
      windowMs: 60_000,
      limit: 200,
      standardHeaders: true,
      legacyHeaders: false,
    }),
  );

  app.use(routes);
  app.use(errorHandler);

  const server = http.createServer(app);

  const io = new Server(server, {
    cors: {
      origin: env.corsOrigin,
      credentials: true,
    },
  });

  configureSocket(io);
  app.set("io", io);

  server.listen(env.port, () => {
    console.log(`[api] listening on http://localhost:${env.port}`);
  });
}

start().catch((err) => {
  console.error("[api] startup failed:", err);
  process.exit(1);
});
