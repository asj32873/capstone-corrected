const Claim = require("../models/Claim");
const claimService = require("../services/claimService");
const ai = require("../services/aiService");
const { saveDocument } = require("../services/documentService");
async function list(req, res, next) {
  try {
    res.json(await claimService.list(req.query));
  } catch (e) {
    next(e);
  }
}
async function get(req, res, next) {
  try {
    const claim = await claimService.get(req.params.id);
    if (!claim) return res.status(404).json({ error: "Claim not found" });
    res.json(claim);
  } catch (e) {
    next(e);
  }
}
async function updateStatus(req, res, next) {
  try {
    const result = await claimService.updateStatus(
      req.params.id,
      req.body.status,
      req.user,
    );
    req.app
      .get("io")
      .to(`claim:${req.params.id}`)
      .emit("claim:statusChanged", {
        claimId: req.params.id,
        status: result.claim.status,
        updatedAt: result.claim.updatedAt,
      });
    req.app
      .get("io")
      .emit("dashboard:claimUpdated", {
        claimId: req.params.id,
        status: result.claim.status,
      });
    res.json(result.claim);
  } catch (e) {
    next(e);
  }
}
async function upload(req, res, next) {
  try {
    if (!req.file)
      return res.status(400).json({ error: "document file is required" });
    res.status(201).json(await saveDocument(req.params.id, req.file));
  } catch (e) {
    next(e);
  }
}
async function searchPolicies(req, res, next) {
  try {
    if (!req.query.q) return res.status(400).json({ error: "q is required" });
    res.json(
      await ai.searchPolicies(
        req.query.q,
        Math.min(Number(req.query.k) || 5, 10),
      ),
    );
  } catch (e) {
    next(e);
  }
}
async function assessment(req, res, next) {
  try {
    const claim = await Claim.findById(req.params.id).lean();
    if (!claim) return res.status(404).json({ error: "Claim not found" });
    const result = await ai.generateAssessment(claim);
    claim.assessmentSummary =
      result.assessment?.summary || JSON.stringify(result.assessment);
    await Claim.updateOne(
      { _id: claim._id },
      { $set: { assessmentSummary: claim.assessmentSummary } },
    );
    res.json(result);
  } catch (e) {
    next(e);
  }
}
module.exports = {
  list,
  get,
  updateStatus,
  upload,
  searchPolicies,
  assessment,
};
