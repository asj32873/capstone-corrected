const assert = require("node:assert/strict");
const http = require("node:http");
const { test, before, after } = require("node:test");
const env = require("../src/config/env");
const { generate: generateModel } = require("../src/services/ollamaService");
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
const originalUrl = env.ollamaUrl;
const server = http.createServer(async (request, response) => {
  const chunks = [];
  for await (const chunk of request) chunks.push(chunk);
  requestBody = JSON.parse(Buffer.concat(chunks).toString());
  response.writeHead(status, { "Content-Type": "application/json" });
  response.end(JSON.stringify(body));
});

before(async () => {
  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  env.ollamaUrl = `http://127.0.0.1:${server.address().port}/`;
});
after(async () => {
  env.ollamaUrl = originalUrl;
  await new Promise((resolve) => server.close(resolve));
});

test("requests a structured nonstreaming assessment using the configured local model", async () => {
  body = { response: JSON.stringify(assessment), done: true };
  const result = await generate("Assess this synthetic claim.");
  assert.deepEqual(result.json, assessment);
  assert.equal(requestBody.model, env.ollamaModel);
  assert.equal(requestBody.stream, false);
  assert.equal(requestBody.format.type, "object");
  assert.deepEqual(requestBody.format.required, [
    "summary",
    "relevantConditions",
    "missingInformation",
    "recommendedNextAction",
  ]);
  assert.equal(requestBody.format.additionalProperties, false);
  assert.equal(requestBody.format.properties.summary.maxLength, 400);
  assert.deepEqual(
    requestBody.format.properties.relevantConditions.items.properties.reference
      .enum,
    ["POLICY-1"],
  );
});

test("rejects malformed, incomplete and nonadvisory JSON responses", async () => {
  for (const text of [
    "not json",
    "{}",
    JSON.stringify({ ...assessment, decisionAuthority: "AI model" }),
  ]) {
    body = { response: text, done: true };
    await assert.rejects(generate("Synthetic claim"), {
      code: "INVALID_MODEL_RESPONSE",
    });
  }
});

test("rejects responses truncated at the token limit", async () => {
  body = {
    response: JSON.stringify(assessment),
    done: true,
    done_reason: "length",
  };
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
    body = { response: JSON.stringify(invalid), done: true };
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
  body = { response: JSON.stringify(emptyFindings), done: true };
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
  body = { response: JSON.stringify(multiple), done: true };
  assert.deepEqual(
    (await generate("Synthetic claim", ["POLICY-1", "POLICY-2"])).json,
    multiple,
  );
  assert.deepEqual(
    requestBody.format.properties.relevantConditions.items.properties.reference
      .enum,
    ["POLICY-1", "POLICY-2"],
  );
});

test("rejects unsupported condition effects", async () => {
  body = {
    response: JSON.stringify({
      ...assessment,
      relevantConditions: [
        { ...assessment.relevantConditions[0], effect: "APPROVED" },
      ],
    }),
    done: true,
  };
  await assert.rejects(generate("Synthetic claim"), {
    code: "INVALID_MODEL_RESPONSE",
  });
});

test("reports a missing local model explicitly", async () => {
  status = 404;
  body = { error: "model not found" };
  await assert.rejects(generate("Synthetic claim"), {
    code: "OLLAMA_MODEL_NOT_FOUND",
  });
  status = 200;
});
