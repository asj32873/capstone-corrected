const { ChromaClient } = require("chromadb");
const env = require("../config/env");
let client;
let collection;
function getClient() {
  if (!client) {
    client = new ChromaClient({
      path: `https://${env.chromaHost}`,
      auth: {
        provider: "token",
        credentials: env.chromaApiKey,
        tokenHeaderType: "X_CHROMA_TOKEN",
      },
      tenant: env.chromaTenant,
      database: env.chromaDatabase,
    });
  }
  return client;
}
async function getCollection() {
  if (!collection)
    collection = await getClient().getOrCreateCollection({
      name: env.chromaCollection,
      metadata: {
        description: "Insurance policy/product knowledge for claims assessment",
      },
    });
  return collection;
}
async function query(queryText, k = 5, where) {
  const c = await getCollection();
  const result = await c.query({
    queryTexts: [queryText],
    nResults: k,
    ...(where ? { where } : {}),
    include: ["documents", "metadatas", "distances"],
  });
  return (result.documents?.[0] || []).map((document, i) => ({
    document,
    metadata: result.metadatas?.[0]?.[i] || {},
    distance: result.distances?.[0]?.[i],
  }));
}
async function list(limit = 50) {
  const c = await getCollection();
  const result = await c.get({ limit, include: ["documents", "metadatas"] });
  return (result.documents || []).map((document, i) => ({
    document,
    metadata: result.metadatas?.[i] || {},
  }));
}
async function upsert({ ids, documents, metadatas }) {
  const c = await getCollection();
  await c.upsert({ ids, documents, metadatas });
  return { count: ids.length, collection: env.chromaCollection };
}
async function info() {
  const c = await getCollection();
  return {
    host: env.chromaHost,
    database: env.chromaDatabase,
    collection: env.chromaCollection,
    documentCount: await c.count(),
  };
}

module.exports = { query, list, upsert, info };
