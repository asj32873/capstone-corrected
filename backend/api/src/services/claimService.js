const crypto = require("crypto");
const Claim = require("../models/Claim");
const User = require("../models/User");
const env = require("../config/env");

const transitions = {
  NEW: ["UNDER_REVIEW"],
  UNDER_REVIEW: ["ADDITIONAL_INFO_REQUIRED", "APPROVED", "REJECTED"],
  ADDITIONAL_INFO_REQUIRED: ["UNDER_REVIEW"],
  APPROVED: ["SETTLEMENT_IN_PROGRESS"],
  REJECTED: ["CLOSED"],
  SETTLEMENT_IN_PROGRESS: ["CLOSED"],
  CLOSED: [],
};
const CLAIM_TYPES = ["HEALTH", "MOTOR", "TRAVEL", "PROPERTY"];
const fail = (status, message) => {
  const e = new Error(message);
  e.status = status;
  e.publicMessage = message;
  return e;
};
const actorOf = (u) => ({ id: u.sub, name: u.name, role: u.role });

// Officers decide (review/approve/reject); managers own settlement and high-value approvals.
function assertCanTransition(user, claim, next) {
  if (user.role === "CLAIMS_MANAGER") return;
  if (user.role !== "CLAIMS_OFFICER")
    throw fail(403, "Customers cannot change claim status");
  if (
    next === "SETTLEMENT_IN_PROGRESS" ||
    (next === "CLOSED" && claim.status === "SETTLEMENT_IN_PROGRESS")
  )
    throw fail(403, "Settlement is handled by a claims manager");
  if (next === "APPROVED" && claim.claimedAmount > env.officerApprovalLimit)
    throw fail(
      403,
      `Claims above ${env.officerApprovalLimit} require manager approval`,
    );
}

function canAccess(user, claim) {
  if (user.role === "CLAIMS_MANAGER") return true;
  if (user.role === "CLAIMS_OFFICER")
    return (
      String(claim.assignedOfficer?._id || claim.assignedOfficer) === user.sub
    );
  return String(claim.customer) === user.sub;
}

// Customers must not see internal notes, AI output or server file paths.
function present(user, claim) {
  const c = claim.toObject ? claim.toObject() : claim;
  if (c.assignedOfficer?.name) c.assignedOfficerName = c.assignedOfficer.name;
  if (c.assignedOfficer?._id) c.assignedOfficer = c.assignedOfficer._id;
  if (user.role === "CUSTOMER") {
    delete c.assessmentSummary;
    c.timeline = (c.timeline || []).filter((t) => !t.internal);
    c.supportingDocuments = (c.supportingDocuments || []).map(
      ({ path, ...d }) => d,
    );
  }
  return c;
}

async function loadAccessible(user, id) {
  const claim = await Claim.findById(id).populate("assignedOfficer", "name");
  if (!claim) throw fail(404, "Claim not found");
  // Same response for missing and forbidden claims so ids cannot be probed.
  if (!canAccess(user, claim)) throw fail(404, "Claim not found");
  return claim;
}

async function list(user, { type, status, priority, page = 1, limit = 50 }) {
  const filter = {};
  if (user.role === "CUSTOMER") filter.customer = user.sub;
  if (user.role === "CLAIMS_OFFICER") filter.assignedOfficer = user.sub;
  if (type) filter.claimType = type;
  if (status) filter.status = status;
  if (priority) filter.priority = priority;
  const safeLimit = Math.min(Number(limit) || 50, 100);
  const skip = (Math.max(Number(page) || 1, 1) - 1) * safeLimit;
  const [docs, total] = await Promise.all([
    Claim.find(filter)
      .populate("assignedOfficer", "name")
      .sort({ updatedAt: -1 })
      .skip(skip)
      .limit(safeLimit),
    Claim.countDocuments(filter),
  ]);
  return {
    items: docs.map((d) => present(user, d)),
    total,
    page: Number(page) || 1,
    limit: safeLimit,
  };
}

async function get(user, id) {
  return present(user, await loadAccessible(user, id));
}

// Round robin: the active officer who was assigned longest ago gets the claim; the update is atomic.
async function assignNextOfficer() {
  return User.findOneAndUpdate(
    { role: "CLAIMS_OFFICER", active: true },
    { $set: { lastAssignedAt: new Date() } },
    { sort: { lastAssignedAt: 1, _id: 1 }, new: true },
  );
}

function derivePriority(amount) {
  if (amount >= env.officerApprovalLimit) return "HIGH";
  return amount >= 50000 ? "MEDIUM" : "LOW";
}

async function create(user, body) {
  const policyNumber = String(body.policyNumber || "").trim();
  const description = String(body.incidentDescription || "").trim();
  const amount = Number(body.claimedAmount);
  const incidentDate = new Date(body.incidentDate);
  if (!CLAIM_TYPES.includes(body.claimType))
    throw fail(400, `claimType must be one of ${CLAIM_TYPES.join(", ")}`);
  if (!description) throw fail(400, "incidentDescription is required");
  if (!Number.isFinite(amount) || amount <= 0)
    throw fail(400, "claimedAmount must be a positive number");
  if (Number.isNaN(incidentDate.getTime()) || incidentDate > new Date())
    throw fail(
      400,
      "incidentDate must be a valid date that is not in the future",
    );

  const officer = await assignNextOfficer();
  const actor = actorOf(user);
  const timeline = [
    { event: "SUBMITTED", status: "NEW", message: "Claim submitted", actor },
  ];
  if (officer)
    timeline.push({
      event: "ASSIGNED",
      message: `Assigned to ${officer.name}`,
      actor: { name: "System", role: "SYSTEM" },
    });
  const claim = await Claim.create({
    claimNumber: `CLM-${Date.now().toString(36).toUpperCase()}-${crypto.randomBytes(2).toString("hex").toUpperCase()}`,
    policyNumber: policyNumber || undefined,
    customerName: user.name,
    customer: user.sub,
    claimType: body.claimType,
    incidentDate,
    incidentDescription: description,
    claimedAmount: amount,
    priority: derivePriority(amount),
    assignedOfficer: officer?._id,
    assignedAt: officer ? new Date() : undefined,
    timeline,
  });
  await claim.populate("assignedOfficer", "name");
  return present(user, claim);
}

async function updateStatus(user, id, nextStatus, note) {
  const claim = await loadAccessible(user, id);
  if (!transitions[claim.status]?.includes(nextStatus))
    throw fail(
      409,
      `Invalid status transition: ${claim.status} -> ${nextStatus}`,
    );
  assertCanTransition(user, claim, nextStatus);
  const previous = claim.status;
  claim.status = nextStatus;
  claim.timeline.push({
    event: "STATUS_CHANGED",
    status: nextStatus,
    message: note
      ? String(note).slice(0, 500)
      : `Status changed from ${previous} to ${nextStatus}`,
    actor: actorOf(user),
  });
  await claim.save();
  return { claim: present(user, claim) };
}

module.exports = {
  list,
  get,
  create,
  updateStatus,
  loadAccessible,
  actorOf,
  transitions,
};
