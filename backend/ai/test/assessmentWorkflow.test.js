const assert = require("node:assert/strict");
const { test, after } = require("node:test");
const chroma = require("../src/services/chromaService");
const ollama = require("../src/services/ollamaService");
const { runAssessmentWorkflow } = require("../src/services/assessmentWorkflow");
const { assess } = require("../src/services/assessmentService");
const originalQuery = chroma.query;
const originalGenerate = ollama.generate;
const claim = {
  claimType: "MOTOR",
  policyNumber: "TEST",
  incidentDescription: "Vehicle damage",
};
const context = {
  document: "Repair estimate required.",
  metadata: { claimType: "MOTOR" },
  distance: 0.1,
};

after(() => {
  chroma.query = originalQuery;
  ollama.generate = originalGenerate;
});

test("does not call Ollama without retrieved policy context", async () => {
  chroma.query = async () => [];
  ollama.generate = async () =>
    assert.fail("Model must not run without policies");
  const result = await runAssessmentWorkflow(claim);
  assert.equal(result.degraded, true);
  assert.equal(result.error, "No relevant policy context");
});

test("returns the assessment with the retrieved policy references", async () => {
  chroma.query = async () => [context];
  ollama.generate = async (prompt) => {
    assert.ok(prompt.includes("[POLICY-1] Repair estimate required."));
    return {
      json: {
        relevantConditions: [
          {
            reference: "POLICY-1",
            condition: context.document,
            relevance: "Repair evidence needed",
            effect: "NEEDS_REVIEW",
          },
        ],
      },
    };
  };
  const result = await runAssessmentWorkflow(claim);
  assert.equal(result.degraded, false);
  assert.equal(result.policyReferences[0].reference, "POLICY-1");
  assert.equal(result.policyReferences[0].excerpt, context.document);
});

test("drops policy references not present in retrieval", async () => {
  chroma.query = async () => [context];
  ollama.generate = async () => ({
    json: { relevantConditions: [{ reference: "POLICY-99" }] },
  });
  const result = await runAssessmentWorkflow(claim);
  assert.equal(result.degraded, false);
  assert.deepEqual(result.assessment.relevantConditions, []);
  assert.equal(result.policyReferences.length, 1);
});

test("semantically retrieves multiple matching policies without a policy number", async () => {
  const motorPolicy = {
    ...context,
    document: "Collision damage is covered.",
    distance: 0.5,
  };
  chroma.query = async (query) => {
    assert.ok(query.includes("MOTOR insurance claim: Vehicle damage"));
    assert.ok(!query.includes("undefined"));
    return [
      {
        document: "Health conditions",
        metadata: { claimType: "HEALTH" },
        distance: 0.01,
      },
      motorPolicy,
      context,
    ];
  };
  ollama.generate = async (prompt, references) => {
    assert.ok(prompt.includes("Repair estimate required."));
    assert.ok(!prompt.includes("Health conditions"));
    assert.ok(prompt.includes("Collision damage is covered."));
    assert.deepEqual(references, ["POLICY-1", "POLICY-2"]);
    assert.ok(prompt.includes("exactly these three sections"));
    return {
      json: {
        relevantConditions: [
          {
            reference: "POLICY-1",
            condition: context.document,
            relevance: "Evidence needed",
            effect: "NEEDS_REVIEW",
          },
          {
            reference: "POLICY-2",
            condition: motorPolicy.document,
            relevance: "Collision claim",
            effect: "SUPPORTS_ACCEPTANCE",
          },
        ],
      },
    };
  };
  const { policyNumber, ...unnumberedClaim } = claim;
  const result = await runAssessmentWorkflow(unnumberedClaim);
  assert.equal(result.policyReferences.length, 2);
});

test("returns only cited policies without prioritizing a legacy policy number", async () => {
  const exact = {
    ...context,
    document: "Exact policy",
    metadata: { claimType: "MOTOR", policyNumber: "TEST" },
    distance: 0.8,
  };
  chroma.query = async () => [context, exact];
  ollama.generate = async () => ({
    json: {
      relevantConditions: [
        {
          reference: "POLICY-2",
          condition: "Exact policy",
          relevance: "Relevant clause",
          effect: "NEEDS_REVIEW",
        },
      ],
    },
  });
  const result = await runAssessmentWorkflow(claim);
  assert.equal(result.policyReferences.length, 1);
  assert.equal(result.policyReferences[0].excerpt, "Exact policy");
});

test("retries once, then drops invented policy quotations", async () => {
  chroma.query = async () => [context];
  let calls = 0;
  ollama.generate = async () => {
    calls += 1;
    return {
      json: {
        relevantConditions: [
          {
            reference: "POLICY-1",
            condition: "All claims are rejected without a police report",
            relevance: "Unsupported exclusion",
            effect: "SUPPORTS_REJECTION",
          },
        ],
      },
    };
  };
  const result = await runAssessmentWorkflow(claim);
  assert.equal(calls, 2);
  assert.deepEqual(result.assessment.relevantConditions, []);
});

test("accepts quotations differing in case, quotes and punctuation", async () => {
  chroma.query = async () => [context];
  ollama.generate = async () => ({
    json: {
      relevantConditions: [
        {
          reference: "POLICY-1",
          condition: '"repair ESTIMATE required"',
          relevance: "Evidence needed",
          effect: "NEEDS_REVIEW",
        },
      ],
    },
  });
  const result = await runAssessmentWorkflow(claim);
  assert.equal(result.policyReferences.length, 1);
});

test("accepts direct quotations differing only in whitespace", async () => {
  chroma.query = async () => [
    { ...context, document: "Repair\nestimate required." },
  ];
  ollama.generate = async () => ({
    json: {
      relevantConditions: [
        {
          reference: "POLICY-1",
          condition: "Repair estimate required.",
          relevance: "Evidence needed",
          effect: "NEEDS_REVIEW",
        },
      ],
    },
  });
  assert.equal((await runAssessmentWorkflow(claim)).degraded, false);
});

test("does not generate when only unrelated policies are retrieved", async () => {
  chroma.query = async () => [
    { ...context, metadata: { claimType: "HEALTH" } },
  ];
  ollama.generate = async () =>
    assert.fail("Unrelated policies must not reach the model");
  const result = await runAssessmentWorkflow(claim);
  assert.equal(result.degraded, true);
});

test("model failures provide actionable degraded responses", async () => {
  chroma.query = async () => [context];
  for (const code of [
    "OLLAMA_MODEL_NOT_FOUND",
    "OLLAMA_UNAVAILABLE",
    "OLLAMA_TIMEOUT",
    "INVALID_MODEL_RESPONSE",
  ]) {
    ollama.generate = async () => {
      throw Object.assign(new Error("Synthetic provider failure"), { code });
    };
    const result = await assess(claim);
    assert.equal(result.degraded, true);
    assert.equal(result.errorCode, code);
    assert.equal(result.assessment.decisionAuthority, "Claims officer");
    assert.ok(result.assessment.recommendedNextAction);
    assert.deepEqual(result.policyReferences, []);
  }
});

test("retrieval errors do not expose upstream details", async () => {
  chroma.query = async () => {
    throw new Error("Synthetic retrieval failure");
  };
  const result = await assess(claim);
  assert.equal(result.errorCode, "ASSESSMENT_UNAVAILABLE");
  assert.equal(result.error, "AI or policy retrieval unavailable");
});

test("retries empty health citations and grounds the fallback without rejecting the claim", async () => {
  const clause =
    "Emergency hospitalization claims should include the emergency department assessment, initial diagnosis, treatment records, admission notes, investigation results and discharge summary.";
  chroma.query = async () => [
    {
      document: `Health Standard Emergency Hospitalization Claims\nProduct: Health Standard\nClaim type: HEALTH\n${clause}`,
      metadata: { claimType: "HEALTH" },
      distance: 0.1,
    },
  ];
  let calls = 0;
  ollama.generate = async () => {
    calls += 1;
    return {
      json: {
        summary:
          "The incident occurred within the policy period, but the claim is ineligible.",
        relevantConditions: [],
        missingInformation: ["pre-existing conditions documentation"],
        recommendedNextAction: "Reject the claim.",
      },
    };
  };
  const result = await runAssessmentWorkflow({
    claimType: "HEALTH",
    incidentDescription:
      "Emergency treatment and hospitalization; discharge summary and medical records available.",
  });
  assert.equal(calls, 2);
  assert.equal(result.assessment.relevantConditions[0].condition, clause);
  assert.equal(result.assessment.relevantConditions[0].effect, "NEEDS_REVIEW");
  assert.equal(result.policyReferences.length, 1);
  assert.equal(
    result.assessment.summary,
    "The incident occurred within the policy period, but the claim is ineligible.",
  );
  assert.equal(result.assessment.recommendedNextAction, "Reject the claim.");
});

test("an uncited assessment keeps the model's own recommendation", async () => {
  chroma.query = async () => [context];
  ollama.generate = async () => ({
    json: {
      summary: "The claim is ineligible.",
      relevantConditions: [],
      missingInformation: ["pre-existing conditions documentation"],
      recommendedNextAction: "Reject the claim.",
    },
  });
  const result = await runAssessmentWorkflow(claim);
  assert.deepEqual(result.assessment.relevantConditions, []);
  assert.equal(result.assessment.summary, "The claim is ineligible.");
  assert.equal(result.assessment.recommendedNextAction, "Reject the claim.");
  assert.deepEqual(result.assessment.missingInformation, [
    "pre-existing conditions documentation",
  ]);
  assert.equal(result.policyReferences.length, 1);
});

test("repaired summaries describe the incident and identify absent uploads", async () => {
  chroma.query = async () => [context];
  ollama.generate = async (prompt) => {
    assert.match(prompt, /ATTACHED DOCUMENT INVENTORY/);
    assert.match(prompt, /EXACT CLAUSES AVAILABLE FOR CITATION/);
    return { json: { relevantConditions: [] } };
  };
  const result = await runAssessmentWorkflow({
    ...claim,
    incidentDescription:
      "Vehicle damage; the claimant says repair records were submitted.",
    supportingDocuments: [],
  });
  assert.match(result.assessment.summary, /Claimant reports: Vehicle damage/);
  assert.ok(result.assessment.summary.length <= 400);
  assert.ok(
    result.assessment.missingInformation.some((item) =>
      item.includes("not been uploaded"),
    ),
  );
});

test("preserves acceptance recommendations grounded in explicit coverage", async () => {
  const clause =
    "Emergency appendicitis surgery is covered during the active policy period subject to the benefit limit.";
  chroma.query = async () => [
    { document: clause, metadata: { claimType: "HEALTH" } },
  ];
  ollama.generate = async () => ({
    json: {
      summary:
        "Reported appendicitis surgery supports acceptance under POLICY-1, subject to officer verification.",
      relevantConditions: [
        {
          reference: "POLICY-1",
          condition: clause,
          relevance:
            "The claimant reports emergency appendicitis surgery during active coverage within the benefit limit.",
          effect: "SUPPORTS_ACCEPTANCE",
        },
      ],
      missingInformation: [
        "Verification of policy validity and supporting medical records",
      ],
      recommendedNextAction:
        "Recommend acceptance for officer review under POLICY-1 subject to verification of coverage and evidence.",
    },
  });
  const result = await runAssessmentWorkflow({
    claimType: "HEALTH",
    incidentDescription:
      "Emergency appendicitis surgery during active coverage within the benefit limit.",
  });
  assert.equal(
    result.assessment.relevantConditions[0].effect,
    "SUPPORTS_ACCEPTANCE",
  );
  assert.match(result.assessment.recommendedNextAction, /Recommend acceptance/);
});

test("empty uploads cannot be overridden by a model claiming verified coverage", async () => {
  chroma.query = async () => [context];
  ollama.generate = async () => ({
    json: {
      summary: "The incident occurred within the policy period.",
      relevantConditions: [
        {
          reference: "POLICY-1",
          condition: context.document,
          relevance: "Records verified",
          effect: "SUPPORTS_ACCEPTANCE",
        },
      ],
      missingInformation: [],
      recommendedNextAction: "Recommend acceptance.",
    },
  });
  const result = await runAssessmentWorkflow({
    ...claim,
    supportingDocuments: [],
  });
  assert.equal(
    result.assessment.recommendedNextAction,
    "Recommend acceptance.",
  );
  assert.ok(
    result.assessment.missingInformation.some((item) =>
      item.includes("not been uploaded"),
    ),
  );
});

test("long incident narratives do not dilute matching policy requirements", async () => {
  const clause =
    "Emergency hospitalization claims should include the emergency department assessment, initial diagnosis, treatment records, admission notes, investigation results and discharge summary.";
  chroma.query = async () => [
    {
      document: `Health Standard Emergency Hospitalization Claims\nProduct: Health Standard\nClaim type: HEALTH\n${clause}`,
      metadata: { claimType: "HEALTH", source: "scripts/products.json" },
      distance: 0.1,
    },
  ];
  ollama.generate = async () => ({ json: { relevantConditions: [] } });
  const result = await runAssessmentWorkflow({
    claimType: "HEALTH",
    incidentDescription:
      "Emergency hospitalization required treatment records. Yesterday while returning home suddenly severe abdominal pain developed accompanied by dizziness nausea weakness sweating breathlessness. Family members contacted transport services immediately travelled nearby hospital doctors recommended observation overnight intravenous medication extensive testing specialist consultation ongoing monitoring following unexpected deterioration. Expenses total substantial amounts including nursing pharmacy laboratory radiology accommodation meals transportation additional charges incurred throughout several days recovering slowly awaiting further advice regarding future appointments returning normal activities employment responsibilities household commitments.",
  });
  assert.equal(result.assessment.relevantConditions[0].condition, clause);
  assert.deepEqual(result.assessment.missingInformation, [
    "Applicable policy wording",
  ]);
  assert.equal(result.policyReferences[0].reference, "POLICY-1");
});

test("document titles are not used as fallback policy clauses", async () => {
  chroma.query = async () => [
    {
      document:
        "Emergency hospitalization treatment records\nProduct: Health Standard\nClaim type: HEALTH\nRepair estimate required.",
      metadata: { claimType: "HEALTH" },
    },
  ];
  ollama.generate = async () => ({ json: { relevantConditions: [] } });
  const result = await runAssessmentWorkflow({
    claimType: "HEALTH",
    incidentDescription: "Emergency hospitalization treatment records",
  });
  assert.deepEqual(result.assessment.relevantConditions, []);
  assert.equal(result.policyReferences.length, 1);
});
