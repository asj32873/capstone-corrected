const dotenv = require("dotenv");
dotenv.config({ path: require("path").resolve(__dirname, "../../../.env") });

const required = ["MONGODB_URI", "JWT_SECRET", "AI_SERVICE_URL"];
for (const key of required)
  if (!process.env[key]) console.warn(`[config] ${key} is not set`);

module.exports = {
  port: Number(process.env.API_PORT || 4000),
  mongoUri: process.env.MONGODB_URI,
  jwtSecret: process.env.JWT_SECRET,
  jwtExpiresIn: process.env.JWT_EXPIRES_IN || "8h",
  aiServiceUrl: process.env.AI_SERVICE_URL || "http://localhost:4100",
  corsOrigin: process.env.CORS_ORIGIN || "*",
  maxDocumentBytes: Number(process.env.MAX_DOCUMENT_BYTES || 10 * 1024 * 1024),
};
