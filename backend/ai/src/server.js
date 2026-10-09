const express = require("express");
const cors = require("cors");
const helmet = require("helmet");
const env = require("./config/env");
const routes = require("./routes");
const app = express();
app.use(helmet());
app.use(cors());
app.use(express.json({ limit: "2mb" }));
app.use(routes);
// Keep the process alive on stray async errors so in-flight assessments are not reset.
process.on("unhandledRejection", (err) =>
  console.error(`[ai] unhandled rejection: ${err?.message || err}`),
);
process.on("uncaughtException", (err) =>
  console.error(`[ai] uncaught exception: ${err?.message || err}`),
);
app.listen(env.port, () =>
  console.log(`[ai] listening on http://localhost:${env.port}`),
);
