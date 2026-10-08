const fs = require("fs");
const path = require("path");
require("dotenv").config({ path: path.resolve(process.cwd(), ".env") });
const { ChromaClient } = require("chromadb");
const products = require("./products.json");
(async () => {
  if (!process.env.CHROMA_API_KEY || !process.env.CHROMA_TENANT)
    throw new Error("CHROMA_API_KEY and CHROMA_TENANT are required");
  const client = new ChromaClient({
    path: `https://${process.env.CHROMA_HOST || "api.trychroma.com"}`,
    auth: {
      provider: "token",
      credentials: process.env.CHROMA_API_KEY,
      tokenHeaderType: "X_CHROMA_TOKEN",
    },
    tenant: process.env.CHROMA_TENANT,
    database: process.env.CHROMA_DATABASE || "capstone",
  });
  const collection = await client.getOrCreateCollection({
    name: process.env.CHROMA_COLLECTION || "insurance_products",
  });
  const ids = products.map((p) => p.id);
  const documents = products.map(
    (p) =>
      `${p.title}\nProduct: ${p.product}\nClaim type: ${p.claimType}\n${p.text}`,
  );
  const metadatas = products.map((p) => ({
    product: p.product,
    claimType: p.claimType,
    title: p.title,
    source: "scripts/products.json",
  }));
  await collection.upsert({ ids, documents, metadatas });
  console.log(
    `Ingested ${products.length} products into ${process.env.CHROMA_COLLECTION || "insurance_products"}`,
  );
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
