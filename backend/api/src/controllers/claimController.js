const Claim = require("../models/Claim");
const claimService = require("../services/claimService");
const ai = require("../services/aiService");
const { saveDocument, getDownloadUrl } = require("../services/documentService");

const wrap = (fn) => async (req, res, next) => {
  try {
    await fn(req, res);
  } catch (e) {
    next(e);
  }
};

const list = wrap(async (req, res) =>
  res.json(await claimService.list(req.user, req.query)),
);
const get = wrap(async (req, res) =>
  res.json(await claimService.get(req.user, req.params.id)),
);
const create = wrap(async (req, res) => {
  const claim = await claimService.create(req.user, req.body);
  req.app.get("io").emit("dashboard:claimUpdated", {
    claimId: claim._id,
    status: claim.status,
  });
  res.status(201).json(claim);
});
const updateStatus = wrap(async (req, res) => {
  const { claim } = await claimService.updateStatus(
    req.user,
    req.params.id,
    req.body.status,
    req.body.note,
  );
  const io = req.app.get("io");
  io.to(`claim:${req.params.id}`).emit("claim:statusChanged", {
    claimId: req.params.id,
    status: claim.status,
    updatedAt: claim.updatedAt,
  });
  io.emit("dashboard:claimUpdated", {
    claimId: req.params.id,
    status: claim.status,
  });
  res.json(claim);
});
const upload = wrap(async (req, res) => {
  if (!req.file)
    return res.status(400).json({ error: "document file is required" });
  await claimService.loadAccessible(req.user, req.params.id);
  res.status(201).json(await saveDocument(req.params.id, req.file, req.user));
});
const downloadDocument = wrap(async (req, res) => {
  const claim = await claimService.loadAccessible(req.user, req.params.id);
  res.json(await getDownloadUrl(claim, req.params.docId));
});
const searchPolicies = wrap(async (req, res) => {
  if (!req.query.q) return res.status(400).json({ error: "q is required" });
  res.json(
    await ai.searchPolicies(
      req.query.q,
      Math.min(Number(req.query.k) || 5, 10),
    ),
  );
});

const degraded = (error) => ({
  degraded: true,
  error,
  assessment: {
    summary: "The AI assessment could not be generated right now.",
    relevantConditions: [],
    missingInformation: ["The AI service was unavailable."],
    recommendedNextAction:
      "Retry the assessment or review policy documents manually.",
    decisionAuthority: "Claims officer",
  },
  policyReferences: [],
});
const assessment = wrap(async (req, res) => {
  const doc = await claimService.loadAccessible(req.user, req.params.id);
  const claim = doc.toObject();
  let result;
  try {
    result = await ai.generateAssessment(claim);
  } catch (e) {
    console.error(`[api] AI assessment request failed: ${e.code || e.message}`);
    return res.json(degraded("AI service unavailable"));
  }
  if (!result.degraded) {
    const summary =
      result.assessment?.summary || JSON.stringify(result.assessment);
    await Claim.updateOne(
      { _id: doc._id },
      {
        $set: { assessmentSummary: summary },
        $push: {
          timeline: {
            event: "AI_ASSESSMENT",
            message: "AI assessment generated",
            actor: claimService.actorOf(req.user),
            internal: true,
          },
        },
      },
    );
  }
  res.json(result);
});

module.exports = {
  list,
  get,
  create,
  updateStatus,
  upload,
  downloadDocument,
  searchPolicies,
  assessment,
};
