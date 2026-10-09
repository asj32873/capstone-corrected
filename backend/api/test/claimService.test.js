const assert = require("node:assert/strict");
const { test, after } = require("node:test");
const Claim = require("../src/models/Claim");
const User = require("../src/models/User");
const service = require("../src/services/claimService");
const originalCreate = Claim.create;
const originalAssign = User.findOneAndUpdate;
const user = {
  sub: "507f1f77bcf86cd799439011",
  name: "Test customer",
  role: "CUSTOMER",
};
const body = {
  claimType: "MOTOR",
  incidentDate: "2020-01-01",
  incidentDescription: "Vehicle damaged in an accident",
  claimedAmount: 1000,
};

after(() => {
  Claim.create = originalCreate;
  User.findOneAndUpdate = originalAssign;
});

User.findOneAndUpdate = async () => null;
Claim.create = async (data) => {
  const document = new Claim(data);
  await document.validate();
  document.populate = async () => document;
  return document;
};

test("creates a valid claim without a policy number", async () => {
  const result = await service.create(user, body);
  assert.equal(result.policyNumber, undefined);
  assert.equal(result.claimType, "MOTOR");
  assert.equal(result.status, "NEW");
});

test("preserves optional policy numbers on legacy API submissions", async () => {
  const result = await service.create(user, {
    ...body,
    policyNumber: " OLD-POLICY ",
  });
  assert.equal(result.policyNumber, "OLD-POLICY");
});

test("still rejects incomplete incident information", async () => {
  await assert.rejects(
    service.create(user, { ...body, incidentDescription: "" }),
    { status: 400 },
  );
});
