const path = require("path");
require("dotenv").config({ path: path.resolve(__dirname, "../.env") });
const mongoose = require("mongoose");
const bcrypt = require("bcryptjs");
const User = require("../api/src/models/User");
const Claim = require("../api/src/models/Claim");

const PASSWORD = "Password123!";
const SYSTEM = { name: "System", role: "SYSTEM" };

(async () => {
  if (!process.env.MONGODB_URI) throw new Error("MONGODB_URI is required");
  await mongoose.connect(process.env.MONGODB_URI);
  const passwordHash = await bcrypt.hash(PASSWORD, 12);
  const upsert = (email, name, role) =>
    User.findOneAndUpdate(
      { email },
      { email, name, role, passwordHash, active: true },
      { upsert: true, new: true, setDefaultsOnInsert: true },
    );

  const officer = await upsert(
    "officer@example.com",
    "Demo Officer",
    "CLAIMS_OFFICER",
  );
  const officer2 = await upsert(
    "officer2@example.com",
    "Demo Officer Two",
    "CLAIMS_OFFICER",
  );
  const manager = await upsert(
    "manager@example.com",
    "Demo Manager",
    "CLAIMS_MANAGER",
  );
  const customer = await upsert(
    "customer@example.com",
    "Demo Customer",
    "CUSTOMER",
  );

  const day = (d) => new Date(`${d}T09:00:00Z`);
  const customerActor = {
    id: String(customer._id),
    name: customer.name,
    role: "CUSTOMER",
  };
  const officerActor = (o) => ({
    id: String(o._id),
    name: o.name,
    role: "CLAIMS_OFFICER",
  });
  const submitted = (d, o) => [
    {
      event: "SUBMITTED",
      status: "NEW",
      message: "Claim submitted",
      actor: customerActor,
      at: day(d),
    },
    {
      event: "ASSIGNED",
      message: `Assigned to ${o.name}`,
      actor: SYSTEM,
      at: day(d),
    },
  ];

  await Claim.deleteMany({ claimNumber: /^DEMO-/ });
  await Claim.insertMany([
    {
      claimNumber: "DEMO-HEALTH-001",
      policyNumber: "POL-H-1001",
      customerName: customer.name,
      customer: customer._id,
      assignedOfficer: officer._id,
      assignedAt: day("2026-09-18"),
      claimType: "HEALTH",
      status: "NEW",
      priority: "HIGH",
      incidentDate: new Date("2026-09-18"),
      incidentDescription:
        "Hospitalization following an acute medical event; hospital records are available for review.",
      claimedAmount: 42000,
      timeline: submitted("2026-09-18", officer),
    },
    {
      claimNumber: "DEMO-MOTOR-001",
      policyNumber: "POL-M-2001",
      customerName: customer.name,
      customer: customer._id,
      assignedOfficer: officer._id,
      assignedAt: day("2026-09-22"),
      claimType: "MOTOR",
      status: "UNDER_REVIEW",
      priority: "MEDIUM",
      incidentDate: new Date("2026-09-22"),
      incidentDescription:
        "Vehicle collision with front-end damage. Repair estimate and photographs are available.",
      claimedAmount: 185000,
      timeline: [
        ...submitted("2026-09-22", officer),
        {
          event: "STATUS_CHANGED",
          status: "UNDER_REVIEW",
          message: "Status changed from NEW to UNDER_REVIEW",
          actor: officerActor(officer),
          at: day("2026-09-23"),
        },
      ],
    },
    {
      claimNumber: "DEMO-TRAVEL-001",
      policyNumber: "POL-T-3001",
      customerName: customer.name,
      customer: customer._id,
      assignedOfficer: officer2._id,
      assignedAt: day("2026-09-25"),
      claimType: "TRAVEL",
      status: "ADDITIONAL_INFO_REQUIRED",
      priority: "LOW",
      incidentDate: new Date("2026-09-25"),
      incidentDescription:
        "Flight disruption caused additional accommodation and rebooking expenses.",
      claimedAmount: 18000,
      timeline: [
        ...submitted("2026-09-25", officer2),
        {
          event: "STATUS_CHANGED",
          status: "UNDER_REVIEW",
          message: "Status changed from NEW to UNDER_REVIEW",
          actor: officerActor(officer2),
          at: day("2026-09-26"),
        },
        {
          event: "STATUS_CHANGED",
          status: "ADDITIONAL_INFO_REQUIRED",
          message:
            "Please upload your booking confirmation and hotel receipts.",
          actor: officerActor(officer2),
          at: day("2026-09-27"),
        },
      ],
    },
  ]);
  await User.updateOne(
    { _id: officer._id },
    { lastAssignedAt: day("2026-09-22") },
  );
  await User.updateOne(
    { _id: officer2._id },
    { lastAssignedAt: day("2026-09-25") },
  );

  console.log(
    `Seeded officers, ${manager.email}, ${customer.email} (password: ${PASSWORD}) and 3 demo claims.`,
  );
  await mongoose.disconnect();
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
