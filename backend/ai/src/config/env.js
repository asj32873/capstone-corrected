require("dotenv").config({
  path: require("path").resolve(__dirname, "../../../.env"),
});
module.exports = {
  port: Number(process.env.AI_PORT || 4100),
  hfToken: process.env.HF_TOKEN || process.env.HUGGINGFACEHUB_API_KEY,
  hfModel: process.env.HF_MODEL || "Qwen/Qwen2.5-Coder-3B-Instruct",
  chromaHost: process.env.CHROMA_HOST || "api.trychroma.com",
  chromaApiKey: process.env.CHROMA_API_KEY,
  chromaTenant: process.env.CHROMA_TENANT,
  chromaDatabase: process.env.CHROMA_DATABASE || "capstone",
  chromaCollection: process.env.CHROMA_COLLECTION || "insurance_products",
};
