const axios = require("axios");
const env = require("../config/env");

const assessmentSchema = {
  type: "object",
  additionalProperties: false,
  required: [
    "summary",
    "relevantConditions",
    "missingInformation",
    "recommendedNextAction",
  ],
  properties: {
    summary: { type: "string", minLength: 1, maxLength: 400 },
    relevantConditions: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        required: ["reference", "condition", "relevance", "effect"],
        properties: {
          reference: { type: "string" },
          condition: { type: "string", minLength: 1 },
          relevance: { type: "string", minLength: 1 },
          effect: {
            type: "string",
            enum: ["SUPPORTS_ACCEPTANCE", "SUPPORTS_REJECTION", "NEEDS_REVIEW"],
          },
        },
      },
    },
    missingInformation: {
      type: "array",
      items: { type: "string", minLength: 1 },
    },
    recommendedNextAction: { type: "string", minLength: 1 },
  },
};

function failure(code, message) {
  const error = new Error(message);
  error.code = code;
  return error;
}

const nonemptyString = (value) =>
  typeof value === "string" && value.trim().length > 0;

const exactKeys = (value, keys) =>
  value !== null &&
  typeof value === "object" &&
  !Array.isArray(value) &&
  Object.keys(value).length === keys.length &&
  keys.every((key) => Object.hasOwn(value, key));

function parseAssessment(text, references) {
  let assessment;
  try {
    assessment = JSON.parse(text);
  } catch {
    throw failure(
      "INVALID_MODEL_RESPONSE",
      "The model did not return valid assessment JSON",
    );
  }
  if (
    !exactKeys(assessment, assessmentSchema.required) ||
    !nonemptyString(assessment.summary) ||
    Array.from(assessment.summary).length > 400 ||
    !nonemptyString(assessment.recommendedNextAction) ||
    !Array.isArray(assessment.missingInformation) ||
    !assessment.missingInformation.every(nonemptyString) ||
    !Array.isArray(assessment.relevantConditions) ||
    !assessment.relevantConditions.every(
      (condition) =>
        exactKeys(condition, [
          "reference",
          "condition",
          "relevance",
          "effect",
        ]) &&
        references.includes(condition.reference) &&
        assessmentSchema.properties.relevantConditions.items.properties.effect.enum.includes(
          condition.effect,
        ) &&
        nonemptyString(condition.condition) &&
        nonemptyString(condition.relevance),
    )
  ) {
    throw failure(
      "INVALID_MODEL_RESPONSE",
      "The model returned an incomplete assessment",
    );
  }
  return assessment;
}

async function generate(prompt, references) {
  if (!Array.isArray(references) || !references.length) {
    throw failure(
      "INVALID_MODEL_RESPONSE",
      "No policy references provided for generation",
    );
  }
  const conditionSchema = assessmentSchema.properties.relevantConditions.items;
  const schema = {
    ...assessmentSchema,
    properties: {
      ...assessmentSchema.properties,
      relevantConditions: {
        ...assessmentSchema.properties.relevantConditions,
        items: {
          ...conditionSchema,
          properties: {
            ...conditionSchema.properties,
            reference: { type: "string", enum: references },
          },
        },
      },
    },
  };
  if (!env.openrouterApiKey) {
    throw failure("LLM_UNAVAILABLE", "OPENROUTER_API_KEY is not configured");
  }
  let response;
  try {
    response = await axios.post(
      new URL(
        "chat/completions",
        env.openrouterUrl.endsWith("/")
          ? env.openrouterUrl
          : `${env.openrouterUrl}/`,
      ).href,
      {
        model: env.openrouterModel,
        messages: [
          {
            role: "system",
            content: `Respond only with a JSON object matching this JSON schema:\n${JSON.stringify(schema)}`,
          },
          { role: "user", content: prompt },
        ],
        response_format: { type: "json_object" },
        temperature: 0.1,
        max_tokens: Number(process.env.LLM_MAX_TOKENS) || 8000,
      },
      {
        timeout: env.llmTimeoutMs,
        headers: { Authorization: `Bearer ${env.openrouterApiKey}` },
      },
    );
  } catch (error) {
    if (error.response?.status === 404 || error.response?.status === 400) {
      throw failure(
        "LLM_MODEL_NOT_FOUND",
        "The configured OpenRouter model is unavailable",
      );
    }
    if (error.code === "ECONNABORTED" || error.code === "ETIMEDOUT") {
      throw failure(
        "LLM_TIMEOUT",
        "The model exceeded the assessment time limit",
      );
    }
    throw failure("LLM_UNAVAILABLE", "The OpenRouter service is unavailable");
  }
  const choice = response.data?.choices?.[0];
  const text = choice?.message?.content;
  if (
    !nonemptyString(text) ||
    response.data?.error ||
    choice?.finish_reason === "length"
  ) {
    throw failure(
      "INVALID_MODEL_RESPONSE",
      `The model returned an empty or incomplete response (finish_reason=${choice?.finish_reason ?? "none"}${response.data?.error ? `, error=${response.data.error.message ?? JSON.stringify(response.data.error)}` : ""})`,
    );
  }
  return { raw: text, json: parseAssessment(text, references) };
}

module.exports = { generate };
