const path = require("path");
require("dotenv").config({ path: path.resolve(process.cwd(), "../.env") });
const mongoose = require("mongoose");
const bcrypt = require("bcryptjs");
const User = require("../api/src/models/User");
const Claim = require("../api/src/models/Claim");
(async () => {
  if (!process.env.MONGODB_URI) throw new Error("MONGODB_URI is required");
  await mongoose.connect(process.env.MONGODB_URI);
  const passwordHash = await bcrypt.hash("Password123!", 12);
  const user = await User.findOneAndUpdate(
    { email: "officer@example.com" },
    {
      email: "officer@example.com",
      name: "Demo Officer",
      role: "CLAIMS_OFFICER",
      passwordHash,
    },
    { upsert: true, new: true, setDefaultsOnInsert: true },
  );
  await Claim.deleteMany({ claimNumber: /^DEMO-/ });
  await Claim.insertMany([
    {
      claimNumber: "DEMO-HEALTH-001",
      policyNumber: "POL-H-1001",
      customerName: "Demo Customer A",
      claimType: "HEALTH",
      status: "NEW",
      priority: "HIGH",
      incidentDate: new Date("2026-09-18"),
      incidentDescription:
        "Hospitalization following an acute medical event; hospital records are available for review.",
      claimedAmount: 42000,
    },
    {
      claimNumber: "DEMO-MOTOR-001",
      policyNumber: "POL-M-2001",
      customerName: "Demo Customer B",
      claimType: "MOTOR",
      status: "UNDER_REVIEW",
      priority: "MEDIUM",
      incidentDate: new Date("2026-09-22"),
      incidentDescription:
        "Vehicle collision with front-end damage. Repair estimate and photographs are available.",
      claimedAmount: 185000,
    },
    {
      claimNumber: "DEMO-TRAVEL-001",
      policyNumber: "POL-T-3001",
      customerName: "Demo Customer C",
      claimType: "TRAVEL",
      status: "ADDITIONAL_INFO_REQUIRED",
      priority: "LOW",
      incidentDate: new Date("2026-09-25"),
      incidentDescription:
        "Flight disruption caused additional accommodation and rebooking expenses.",
      claimedAmount: 18000,
    },
  ]);
  console.log(`Seeded user ${user.email} and 3 demo claims.`);
  await mongoose.disconnect();
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
