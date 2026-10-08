const express = require("express");
const chroma = require("./services/chromaService");
const { assess } = require("./services/assessmentService");
const router = express.Router();
router.get("/health", (req, res) =>
  res.json({
    status: "ok",
    service: "claims-ai",
    model: process.env.HF_MODEL || "Qwen/Qwen2.5-Coder-3B-Instruct:nscale",
    time: new Date().toISOString(),
  }),
);
router.post("/v1/retrieve", async (req, res, next) => {
  try {
    if (!req.body.query)
      return res.status(400).json({ error: "query is required" });
    res.json({
      results: await chroma.query(
        req.body.query,
        Math.min(Number(req.body.k) || 5, 10),
      ),
    });
  } catch (e) {
    next(e);
  }
});
router.post("/v1/assess", async (req, res, next) => {
  try {
    if (!req.body.claim)
      return res.status(400).json({ error: "claim is required" });
    res.json(await assess(req.body.claim));
  } catch (e) {
    next(e);
  }
});
router.use((err, req, res, next) => {
  console.error(`[ai] ${req.method} ${req.path}: ${err.message}`);
  res.status(500).json({ error: "AI service error" });
});
module.exports = router;
