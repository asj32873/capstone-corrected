const Claim = require('../models/Claim');
const transitions = {
  NEW: ['UNDER_REVIEW'],
  UNDER_REVIEW: ['ADDITIONAL_INFO_REQUIRED','APPROVED','REJECTED'],
  ADDITIONAL_INFO_REQUIRED: ['UNDER_REVIEW'],
  APPROVED: ['SETTLEMENT_IN_PROGRESS'],
  REJECTED: ['CLOSED'],
  SETTLEMENT_IN_PROGRESS: ['CLOSED'],
  CLOSED: []
};
async function list({ type, status, priority, page = 1, limit = 50 }) {
  const filter = {};
  if (type) filter.claimType = type;
  if (status) filter.status = status;
  if (priority) filter.priority = priority;
  const safeLimit = Math.min(Number(limit) || 50, 100);
  const skip = (Math.max(Number(page) || 1, 1) - 1) * safeLimit;
  const [items, total] = await Promise.all([Claim.find(filter).sort({ updatedAt: -1 }).skip(skip).limit(safeLimit).lean(), Claim.countDocuments(filter)]);
  return { items, total, page: Number(page) || 1, limit: safeLimit };
}
async function get(id) { return Claim.findById(id).lean(); }
async function updateStatus(id, nextStatus, actor) {
  const claim = await Claim.findById(id);
  if (!claim) { const e = new Error('Claim not found'); e.status = 404; throw e; }
  if (!transitions[claim.status]?.includes(nextStatus)) {
    const e = new Error(`Invalid status transition: ${claim.status} -> ${nextStatus}`); e.status = 409; throw e;
  }
  claim.status = nextStatus;
  await claim.save();
  return { claim: claim.toObject(), actor: { id: actor.sub, name: actor.name, role: actor.role } };
}
module.exports = { list, get, updateStatus, transitions };
