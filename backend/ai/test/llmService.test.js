const assert = require("node:assert/strict");
const http = require("node:http");
const { test, before, after } = require("node:test");
const env = require("../src/config/env");
const { generate: generateModel } = require("../src/services/llmService");
const generate = (prompt, references = ["POLICY-1"]) =>
  generateModel(prompt, references);

const assessment = {
  summary: "Verify the repair documents against the policy.",
  relevantConditions: [
    {
      reference: "POLICY-1",
      condition: "Repair estimate required",
      relevance: "Vehicle damage claim",
      effect: "NEEDS_REVIEW",
    },
  ],
  missingInformation: ["Repair documents"],
  recommendedNextAction: "Request supporting documents.",
};
let status = 200;
let body;
let requestBody;
const reply = (content, finish_reason = "stop") => ({
  choices: [{ message: { content }, finish_reason }],
});
const originalUrl = env.openrouterUrl;
const originalKey = env.openrouterApiKey;
const server = http.createServer(async (request, response) => {
  const chunks = [];
  for await (const chunk of request) chunks.push(chunk);
  requestBody = JSON.parse(Buffer.concat(chunks).toString());
  response.writeHead(status, { "Content-Type": "application/json" });
  response.end(JSON.stringify(body));
});

before(async () => {
  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  env.openrouterUrl = `http://127.0.0.1:${server.address().port}/`;
  env.openrouterApiKey = "test-key";
});
after(async () => {
  env.openrouterUrl = originalUrl;
  env.openrouterApiKey = originalKey;
  await new Promise((resolve) => server.close(resolve));
});

test("requests a structured nonstreaming assessment using the configured local model", async () => {
  body = reply(JSON.stringify(assessment));
  const result = await generate("Assess this synthetic claim.");
  assert.deepEqual(result.json, assessment);
  assert.equal(requestBody.model, env.openrouterModel);
  assert.equal(requestBody.response_format.type, "json_object");
  assert.match(requestBody.messages[0].content, /"enum":\["POLICY-1"\]/);
});

test("rejects malformed, incomplete and nonadvisory JSON responses", async () => {
  for (const text of [
    "not json",
    "{}",
    JSON.stringify({ ...assessment, decisionAuthority: "AI model" }),
  ]) {
    body = reply(text);
    await assert.rejects(generate("Synthetic claim"), {
      code: "INVALID_MODEL_RESPONSE",
    });
  }
});

test("rejects responses truncated at the token limit", async () => {
  body = reply(JSON.stringify(assessment), "length");
  await assert.rejects(generate("Synthetic claim"), {
    code: "INVALID_MODEL_RESPONSE",
  });
});

test("rejects extra sections, long summaries and unrelated policy references", async () => {
  for (const invalid of [
    { ...assessment, extraSection: "Unrequested finding" },
    { ...assessment, summary: "a".repeat(401) },
    {
      ...assessment,
      relevantConditions: [
        { ...assessment.relevantConditions[0], reference: "POLICY-2" },
      ],
    },
    {
      ...assessment,
      relevantConditions: [
        { ...assessment.relevantConditions[0], extra: "Unrequested field" },
      ],
    },
    {
      ...assessment,
      relevantConditions: [
        { ...assessment.relevantConditions[0], condition: " " },
      ],
    },
    { ...assessment, missingInformation: [null] },
  ]) {
    body = reply(JSON.stringify(invalid));
    await assert.rejects(generate("Synthetic claim"), {
      code: "INVALID_MODEL_RESPONSE",
    });
  }
});

test("allows empty findings when no conditions or information gaps apply", async () => {
  const emptyFindings = {
    ...assessment,
    relevantConditions: [],
    missingInformation: [],
  };
  body = reply(JSON.stringify(emptyFindings));
  assert.deepEqual((await generate("Synthetic claim")).json, emptyFindings);
});

test("accepts multiple retrieved policy citations and constrains the request schema", async () => {
  const multiple = {
    ...assessment,
    relevantConditions: [
      { ...assessment.relevantConditions[0], effect: "SUPPORTS_ACCEPTANCE" },
      {
        ...assessment.relevantConditions[0],
        reference: "POLICY-2",
        effect: "SUPPORTS_REJECTION",
      },
    ],
  };
  body = reply(JSON.stringify(multiple));
  assert.deepEqual(
    (await generate("Synthetic claim", ["POLICY-1", "POLICY-2"])).json,
    multiple,
  );
  assert.match(
    requestBody.messages[0].content,
    /"enum":\["POLICY-1","POLICY-2"\]/,
  );
});

test("rejects unsupported condition effects", async () => {
  body = reply(
    JSON.stringify({
      ...assessment,
      relevantConditions: [
        { ...assessment.relevantConditions[0], effect: "APPROVED" },
      ],
    }),
  );
  await assert.rejects(generate("Synthetic claim"), {
    code: "INVALID_MODEL_RESPONSE",
  });
});

test("reports a missing local model explicitly", async () => {
  status = 404;
  body = { error: "model not found" };
  await assert.rejects(generate("Synthetic claim"), {
    code: "LLM_MODEL_NOT_FOUND",
  });
  status = 200;
});
