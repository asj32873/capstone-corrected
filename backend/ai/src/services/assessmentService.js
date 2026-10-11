const { runAssessmentWorkflow } = require("./assessmentWorkflow");
const env = require("../config/env");
const modelFailures = {
  LLM_MODEL_NOT_FOUND: {
    error: "The configured OpenRouter model is unavailable",
    action: `Verify OPENROUTER_MODEL (${env.openrouterModel}) and retry the assessment.`,
  },
  LLM_UNAVAILABLE: {
    error: "The OpenRouter service is unavailable",
    action:
      "Verify OPENROUTER_API_KEY and network access, then retry the assessment.",
  },
  LLM_TIMEOUT: {
    error: "The model timed out",
    action:
      "Retry the assessment, or increase LLM_TIMEOUT_MS and restart both backend services.",
  },
  INVALID_MODEL_RESPONSE: {
    error: "The local model returned an invalid assessment",
    action:
      "Retry the assessment or review policy documents manually. No invalid assessment was saved.",
  },
};
async function assess(claim) {
  try {
    const result = await runAssessmentWorkflow(claim);
    if (result?.error === "No relevant policy context") {
      return {
        degraded: true,
        error: result.error,
        assessment: {
          summary:
            "No relevant policy context was retrieved; an AI coverage assessment cannot be safely grounded.",
          relevantConditions: [],
          missingInformation: ["Relevant policy clauses"],
          recommendedNextAction:
            "Search for the applicable policy/product or provide the policy document before assessing coverage.",
          decisionAuthority: "Claims officer",
        },
        policyReferences: [],
      };
    }
    return { ...result, model: env.openrouterModel };
  } catch (err) {
    console.error(`[ai] assessment workflow failed: ${err.message}`);
    const failure = modelFailures[err.code];
    return {
      degraded: true,
      error: failure?.error || "AI or policy retrieval unavailable",
      errorCode: failure ? err.code : "ASSESSMENT_UNAVAILABLE",
      assessment: {
        summary: "The AI assessment could not be safely generated.",
        relevantConditions: [],
        missingInformation: [
          "Policy retrieval or model response was unavailable.",
        ],
        recommendedNextAction:
          failure?.action ||
          "Retry the assessment or review policy documents manually.",
        decisionAuthority: "Claims officer",
      },
      policyReferences: [],
    };
  }
}
module.exports = { assess };
