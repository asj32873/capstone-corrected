const express = require("express");
const multer = require("multer");
const { authenticate, requireRole } = require("../middleware/auth");
const auth = require("../controllers/authController");
const claims = require("../controllers/claimController");
const env = require("../config/env");
const router = express.Router();
const staff = requireRole("CLAIMS_OFFICER", "CLAIMS_MANAGER");
router.post("/auth/login", auth.login);
router.post("/auth/register", auth.register);
router.get("/health", (req, res) =>
  res.json({
    status: "ok",
    service: "claims-api",
    time: new Date().toISOString(),
  }),
);
router.get("/health/ai", async (req, res, next) => {
  try {
    res.json(await require("../services/aiService").health());
  } catch (e) {
    next(e);
  }
});
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: env.maxDocumentBytes },
});
router.use("/api", authenticate);
router.get("/api/claims", claims.list);
router.post("/api/claims", requireRole("CUSTOMER"), claims.create);
router.get("/api/claims/:id", claims.get);
router.patch("/api/claims/:id/status", staff, claims.updateStatus);
router.post(
  "/api/claims/:id/documents",
  upload.single("document"),
  claims.upload,
);
router.get(
  "/api/claims/:id/documents/:docId/download",
  staff,
  claims.downloadDocument,
);
router.post("/api/claims/:id/generate-assessment", staff, claims.assessment);
router.get("/api/policies/search", staff, claims.searchPolicies);
router.get(
  "/api/users/officers",
  requireRole("CLAIMS_MANAGER"),
  auth.listOfficers,
);
router.post(
  "/api/users/officers",
  requireRole("CLAIMS_MANAGER"),
  auth.createOfficer,
);
module.exports = router;
