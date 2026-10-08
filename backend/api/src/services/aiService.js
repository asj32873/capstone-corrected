const axios = require("axios");
const env = require("../config/env");
async function health() {
  const r = await axios.get(`${env.aiServiceUrl}/health`, { timeout: 5000 });
  return r.data;
}
async function searchPolicies(query, k = 5) {
  const r = await axios.post(
    `${env.aiServiceUrl}/v1/retrieve`,
    { query, k },
    { timeout: 15000 },
  );
  return r.data;
}
async function generateAssessment(claim) {
  const r = await axios.post(
    `${env.aiServiceUrl}/v1/assess`,
    { claim },
    { timeout: 90000 },
  );
  return r.data;
}
module.exports = { health, searchPolicies, generateAssessment };
