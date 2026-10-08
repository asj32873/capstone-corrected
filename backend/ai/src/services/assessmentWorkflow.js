const { Annotation, StateGraph, START, END } = require('@langchain/langgraph');
const chroma = require('./chromaService');
const hf = require('./hfService');

const State = Annotation.Root({
  claim: Annotation(),
  contexts: Annotation({ reducer: (_old, next) => next, default: () => [] }),
  result: Annotation()
});

function promptFor(claim, contexts) {
  const policyText = contexts.map((c,i)=>`[POLICY-${i+1}] ${c.document}\nReference: ${JSON.stringify(c.metadata)}`).join('\n\n');
  return `You are an insurance claims assessment assistant. Your assessment is advisory only and a human claims officer makes every final approval/rejection decision.\n\nCLAIM:\n${JSON.stringify({claimNumber:claim.claimNumber,policyNumber:claim.policyNumber,claimType:claim.claimType,status:claim.status,priority:claim.priority,incidentDate:claim.incidentDate,incidentDescription:claim.incidentDescription,claimedAmount:claim.claimedAmount},null,2)}\n\nRETRIEVED POLICY CONTEXT:\n${policyText}\n\nPrepare a concise grounded assessment. Identify relevant policy conditions, missing information, and a recommended next action. Use only the retrieved policy text. Never invent clauses, exclusions, limits, coverage, or legal/financial conclusions. Do not approve or reject. Return ONLY valid JSON:\n{"summary":"string","relevantConditions":[{"reference":"POLICY-1","condition":"string","relevance":"string"}],"missingInformation":["string"],"recommendedNextAction":"string","decisionAuthority":"Claims officer"}`;
}

const retrieveNode = async state => {
  const claim = state.claim;
  const query = `${claim.claimType} policy ${claim.policyNumber} incident ${claim.incidentDescription}`;
  return { contexts: await chroma.query(query, 5) };
};
const generateNode = async state => {
  if (!state.contexts.length) return { result: { degraded:true, error:'No relevant policy context' } };
  const model = await hf.generate(promptFor(state.claim, state.contexts));
  return { result: { degraded:false, assessment:model.json, policyReferences:state.contexts.map((c,i)=>({reference:`POLICY-${i+1}`,metadata:c.metadata,distance:c.distance,excerpt:c.document.slice(0,1000)})) } };
};

let graph;
function getGraph() {
  if (!graph) graph = new StateGraph(State).addNode('retrieve', retrieveNode).addNode('generate', generateNode).addEdge(START,'retrieve').addEdge('retrieve','generate').addEdge('generate',END).compile();
  return graph;
}
async function runAssessmentWorkflow(claim) { return (await getGraph().invoke({ claim })).result; }
module.exports = { runAssessmentWorkflow };
