require("dotenv").config({
  path: require("path").resolve(__dirname, "../../../.env"),
});

module.exports = {
  port: Number(process.env.AI_PORT || 4100),

  openrouterUrl: process.env.OPENROUTER_URL || "https://openrouter.ai/api/v1",
  openrouterApiKey: process.env.OPENROUTER_API_KEY,
  openrouterModel: process.env.OPENROUTER_MODEL || "openai/gpt-4o",
  llmTimeoutMs: Number(process.env.LLM_TIMEOUT_MS) || 180000,

  chromaHost: process.env.CHROMA_HOST || "api.trychroma.com",
  chromaApiKey: process.env.CHROMA_API_KEY,
  chromaTenant: process.env.CHROMA_TENANT,
  chromaDatabase: process.env.CHROMA_DATABASE || "capstone",
  chromaCollection: process.env.CHROMA_COLLECTION || "insurance_products",
};
