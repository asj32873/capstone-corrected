const assert = require("node:assert/strict");
const { test, after } = require("node:test");

const workflowPath = require.resolve("../src/services/assessmentWorkflow");
const previousWorkflow = require.cache[workflowPath];
let workflowResult;
require.cache[workflowPath] = {
  id: workflowPath,
  filename: workflowPath,
  loaded: true,
  exports: { runAssessmentWorkflow: async () => workflowResult },
};
const { assess } = require("../src/services/assessmentService");
const env = require("../src/config/env");

after(() => {
  if (previousWorkflow) require.cache[workflowPath] = previousWorkflow;
  else delete require.cache[workflowPath];
});

test("successful assessment identifies the configured Ollama model", async () => {
  workflowResult = {
    degraded: false,
    assessment: { summary: "Grounded assessment" },
    policyReferences: [],
  };
  const result = await assess({ claimType: "motor" });
  assert.equal(result.model, env.ollamaModel);
  assert.equal(result.degraded, false);
  assert.equal(result.assessment.summary, "Grounded assessment");
});

test("missing policy context remains an advisory degraded response", async () => {
  workflowResult = { degraded: true, error: "No relevant policy context" };
  const result = await assess({ claimType: "motor" });
  assert.equal(result.degraded, true);
  assert.equal(result.assessment.decisionAuthority, "Claims officer");
  assert.deepEqual(result.policyReferences, []);
});
