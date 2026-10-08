const axios = require("axios");
const env = require("../config/env");

function extractJson(text) {
  const fenced = text.match(/```json\s*([\s\S]*?)```/i);
  const candidate = fenced ? fenced[1] : text.match(/\{[\s\S]*\}/)?.[0];

  if (!candidate) {
    throw new Error("Model did not return JSON");
  }

  return JSON.parse(candidate);
}

async function generate(prompt) {
  if (!env.hfToken) {
    throw new Error("HF_TOKEN or HUGGINGFACEHUB_API_KEY is required");
  }

  const url = `https://router.huggingface.co/v1/chat/completions`;

  try {
    const response = await axios.post(
      url,
      {
        model: env.hfModel,
        messages: [
          {
            role: "user",
            content: prompt,
          },
        ],
        max_tokens: 700,
        temperature: 0.1,
      },
      {
        headers: {
          Authorization: `Bearer ${env.hfToken}`,
          "Content-Type": "application/json",
        },
        timeout: 80000,
      },
    );

    console.log("[HF] status:", response.status);
    console.log("[HF] response:", JSON.stringify(response.data, null, 2));

    if (response.data?.error) {
      throw new Error(response.data.error);
    }

    const text = response.data?.choices?.[0]?.message?.content;

    if (!text) {
      throw new Error("Empty Hugging Face model response");
    }
    return {
      raw: text,
      json: extractJson(text),
    };
  } catch (error) {
    console.error("[HF] status:", error.response?.status);
    console.error(
      "[HF] response:",
      JSON.stringify(error.response?.data, null, 2),
    );
    console.error("[HF] message:", error.message);

    throw error;
  }
}
module.exports = { generate };
