require("dotenv").config({
  path: require("path").resolve(__dirname, "../../../.env"),
});

module.exports = {
  port: Number(process.env.AI_PORT || 4100),

  ollamaUrl: process.env.OLLAMA_URL || "http://localhost:11434",
  ollamaModel: process.env.OLLAMA_MODEL || "qwen2.5:1.5b",
  ollamaTimeoutMs: Number(process.env.OLLAMA_TIMEOUT_MS) || 180000,

  chromaHost: process.env.CHROMA_HOST || "api.trychroma.com",
  chromaApiKey: process.env.CHROMA_API_KEY,
  chromaTenant: process.env.CHROMA_TENANT,
  chromaDatabase: process.env.CHROMA_DATABASE || "capstone",
  chromaCollection: process.env.CHROMA_COLLECTION || "insurance_products",
};
