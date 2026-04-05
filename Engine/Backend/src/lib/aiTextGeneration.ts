import { runtimeConfig } from "./runtimeConfig.js";

export type SupportedAiProvider = "openai-compatible" | "google-genai";

export function extractJsonPayload(text: string): string | null {
  const trimmed = text.trim();
  if (!trimmed) {
    return null;
  }

  if (trimmed.startsWith("{")) {
    return trimmed;
  }

  const fenced = trimmed.match(/```json\s*([\s\S]+?)```/i);
  if (fenced?.[1]) {
    return fenced[1].trim();
  }

  const firstBrace = trimmed.indexOf("{");
  const lastBrace = trimmed.lastIndexOf("}");
  return firstBrace >= 0 && lastBrace > firstBrace ? trimmed.slice(firstBrace, lastBrace + 1) : null;
}

async function requestOpenAiCompatibleJson(prompt: string, model?: string, endpoint?: string): Promise<string | null> {
  const targetEndpoint = endpoint || runtimeConfig.aiBaseUrl;
  const apiKey = runtimeConfig.aiApiKey;
  const targetModel = model || runtimeConfig.aiModel;

  if (!targetEndpoint || !apiKey || !targetModel) {
    return null;
  }

  const response = await fetch(targetEndpoint, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: targetModel,
      messages: [
        {
          role: "system",
          content: "Return only valid JSON.",
        },
        {
          role: "user",
          content: prompt,
        },
      ],
      temperature: 0.7,
    }),
  });

  if (!response.ok) {
    throw new Error(`AI request failed (${response.status}).`);
  }

  const payload = await response.json() as {
    choices?: Array<{ message?: { content?: string } }>;
  };

  return payload.choices?.[0]?.message?.content ?? null;
}

async function requestGoogleGenAiJson(prompt: string, model?: string): Promise<string | null> {
  const apiKey = runtimeConfig.googleGenAiApiKey;
  const targetModel = model || runtimeConfig.googleGenAiModel;

  if (!apiKey || !targetModel) {
    return null;
  }

  const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(targetModel)}:generateContent?key=${encodeURIComponent(apiKey)}`;
  const response = await fetch(endpoint, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      contents: [
        {
          role: "user",
          parts: [{ text: `${prompt}\n\nReturn only valid JSON.` }],
        },
      ],
    }),
  });

  if (!response.ok) {
    throw new Error(`Google GenAI request failed (${response.status}).`);
  }

  const payload = await response.json() as {
    candidates?: Array<{
      content?: {
        parts?: Array<{ text?: string }>;
      };
    }>;
  };

  return payload.candidates?.[0]?.content?.parts?.map((part) => part.text ?? "").join("") ?? null;
}

export async function requestJsonFromProvider(options: {
  provider: SupportedAiProvider;
  prompt: string;
  model?: string;
  endpoint?: string;
}): Promise<string | null> {
  if (options.provider === "google-genai") {
    return requestGoogleGenAiJson(options.prompt, options.model);
  }

  return requestOpenAiCompatibleJson(options.prompt, options.model, options.endpoint);
}
