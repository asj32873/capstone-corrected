const { runAssessmentWorkflow } = require('./assessmentWorkflow');
async function assess(claim) {
  try {
    const result = await runAssessmentWorkflow(claim);
    if (result?.error === 'No relevant policy context') {
      return { degraded: true, error: result.error, assessment: { summary: 'No relevant policy context was retrieved; an AI coverage assessment cannot be safely grounded.', relevantConditions: [], missingInformation: ['Relevant policy clauses'], recommendedNextAction: 'Search for the applicable policy/product or provide the policy document before assessing coverage.', decisionAuthority: 'Claims officer' }, policyReferences: [] };
    }
    return { ...result, model: process.env.HF_MODEL || 'Qwen/Qwen2.5-Coder-3B-Instruct:nscale' };
  } catch (err) {
    console.error(`[ai] assessment workflow failed: ${err.message}`);
    return { degraded:true, error:'AI or policy retrieval unavailable', assessment:{ summary:'The AI assessment could not be safely generated.', relevantConditions:[], missingInformation:['Policy retrieval or model response was unavailable.'], recommendedNextAction:'Retry the assessment or review policy documents manually.', decisionAuthority:'Claims officer' }, policyReferences:[] };
  }
}
module.exports = { assess };
