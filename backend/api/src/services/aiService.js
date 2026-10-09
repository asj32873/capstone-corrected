const axios = require("axios");
const http = require("http");
const env = require("../config/env");

// Fresh sockets per request avoid resets from keep-alive connections to a restarted AI service.
const client = axios.create({
  baseURL: env.aiServiceUrl,
  httpAgent: new http.Agent({ keepAlive: false }),
});
const TRANSIENT = new Set(["ECONNRESET", "ECONNREFUSED", "EPIPE", "ETIMEDOUT"]);

async function call(config, attempts = 4) {
  for (let i = 1; ; i++) {
    try {
      return (await client.request(config)).data;
    } catch (err) {
      const transient =
        TRANSIENT.has(err.code) || err.message === "socket hang up";
      if (!transient || i >= attempts) throw err;
      await new Promise((r) => setTimeout(r, 500 * i));
    }
  }
}

const health = () => call({ method: "GET", url: "/health", timeout: 5000 });
const searchPolicies = (query, k = 5) =>
  call({
    method: "POST",
    url: "/v1/retrieve",
    data: { query, k },
    timeout: 15000,
  });
const generateAssessment = (claim) =>
  call({
    method: "POST",
    url: "/v1/assess",
    data: { claim },
    timeout: env.aiAssessmentTimeoutMs,
  });
module.exports = { health, searchPolicies, generateAssessment };
