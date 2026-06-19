import Together from "together-ai";

const VISION_MODELS = ["Qwen/Qwen3.5-397B-A17B", "Qwen/Qwen3.5-9B"] as const;
const PROMPT_VALIDATION_MODEL = "Qwen/Qwen3.5-9B";
const DEFAULT_TIMEOUT_MS = 10000;

export type ReferenceKind =
  | "child"
  | "teen"
  | "adult"
  | "senior"
  | "dog"
  | "cat"
  | "animal"
  | "object"
  | "unknown";

export type ReferenceAnalysis = {
  success: boolean;
  kind: ReferenceKind;
  isHuman: boolean;
  type: string;
  ageGroup?: "child" | "teen" | "adult" | "senior" | "unknown";
  description: string;
  severity: "ok" | "warning" | "blocked";
  message?: string;
  results: VisionModelResult[];
};

type VisionModelData = {
  description: string;
  isHuman: boolean;
  type: string;
  ageGroup?: "child" | "teen" | "adult" | "senior" | "unknown";
};

export type VisionModelResult = {
  model: string;
  success: boolean;
  timeMs: number;
  data?: VisionModelData;
  error?: string;
};

export type PromptValidationResult = {
  status: "ok" | "suggested_fix" | "blocked";
  issue?: string;
  message: string;
  suggestedPrompt?: string;
};

function extractJson(raw: string): Record<string, unknown> {
  let content = raw.replace(/<think>[\s\S]*?<\/think>/g, "").trim();
  content = content.replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/i, "").trim();

  const start = content.indexOf("{");
  const end = content.lastIndexOf("}");
  if (start !== -1 && end !== -1 && end > start) {
    content = content.slice(start, end + 1);
  }

  return JSON.parse(content);
}

function normalizeAgeGroup(value: unknown): VisionModelData["ageGroup"] {
  if (typeof value !== "string") return "unknown";
  const normalized = value.toLowerCase();
  if (normalized === "child" || normalized === "teen" || normalized === "adult" || normalized === "senior") {
    return normalized;
  }
  return "unknown";
}

function normalizeType(value: unknown): string {
  if (typeof value !== "string" || !value.trim()) return "unknown";
  const normalized = value.trim().toLowerCase();
  if (normalized.includes("dog")) return "dog";
  if (normalized.includes("cat")) return "cat";
  if (normalized.includes("human") || normalized.includes("person")) return "human";
  if (normalized.includes("animal")) return "animal";
  if (normalized.includes("object") || normalized.includes("toy") || normalized.includes("prop")) return "object";
  return normalized;
}

function kindFromAnalysis(isHuman: boolean, type: string, ageGroup?: VisionModelData["ageGroup"]): ReferenceKind {
  if (isHuman) {
    if (ageGroup === "child" || ageGroup === "teen" || ageGroup === "senior") return ageGroup;
    return "adult";
  }

  if (type === "dog" || type === "cat" || type === "animal" || type === "object") return type;
  return "unknown";
}

async function withTimeout<T>(promise: Promise<T>, timeoutMs: number): Promise<T> {
  const controller = new AbortController();
  const timeout = windowlessSetTimeout(() => controller.abort(), timeoutMs);

  try {
    return await Promise.race([
      promise,
      new Promise<T>((_, reject) => {
        controller.signal.addEventListener("abort", () => reject(new Error("Vision analysis timed out.")));
      }),
    ]);
  } finally {
    clearTimeout(timeout);
  }
}

function windowlessSetTimeout(callback: () => void, ms: number): ReturnType<typeof setTimeout> {
  return setTimeout(callback, ms);
}

const VISION_PROMPT = `Analyze this reference image for a comic generation preflight check.
Return ONLY a JSON object with these exact keys:
- "description": string, a short non-identifying description such as "an adult person", "a child", "a dog", "a toy object"
- "is_human": boolean
- "type": string, one of "human", "dog", "cat", "animal", "object", or "unknown"
- "age_group": string, ONLY for humans: one of "child", "teen", "adult", "senior", or "unknown"; for non-humans use "unknown"

Do not identify the person. Do not name real people. Do not infer race or ethnicity.`;

async function runVisionModel(
  client: Together,
  model: string,
  imageUrl: string,
): Promise<VisionModelResult> {
  const start = Date.now();

  try {
    const responsePromise = client.chat.completions.create({
      model,
      messages: [
        {
          role: "user",
          content: [
            { type: "text", text: VISION_PROMPT },
            { type: "image_url", image_url: { url: imageUrl } },
          ],
        },
      ],
      response_format: { type: "json_object" },
      max_tokens: 500,
    });

    const response = await withTimeout(responsePromise, DEFAULT_TIMEOUT_MS);
    const raw = response.choices[0]?.message?.content || "";
    const parsed = extractJson(raw);
    const isHuman = parsed.is_human === true;
    const type = normalizeType(parsed.type);
    const ageGroup = isHuman ? normalizeAgeGroup(parsed.age_group) : "unknown";
    const description =
      typeof parsed.description === "string" && parsed.description.trim()
        ? parsed.description.trim()
        : isHuman
          ? `a ${ageGroup || "unknown"} person`
          : `a ${type}`;

    return {
      model,
      success: true,
      timeMs: Date.now() - start,
      data: { description, isHuman, type, ageGroup },
    };
  } catch (error) {
    return {
      model,
      success: false,
      timeMs: Date.now() - start,
      error: error instanceof Error ? error.message : "Unknown error",
    };
  }
}

function mostCommon<T extends string>(values: T[], fallback: T): T {
  const counts = new Map<T, number>();
  values.forEach((value) => counts.set(value, (counts.get(value) || 0) + 1));
  return [...counts.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] || fallback;
}

export async function analyzeReferenceImage(params: {
  client: Together;
  imageUrl: string;
}): Promise<ReferenceAnalysis> {
  const results = await Promise.all(
    VISION_MODELS.map((model) => runVisionModel(params.client, model, params.imageUrl)),
  );
  const successful = results.filter((result): result is VisionModelResult & { data: VisionModelData } =>
    result.success && Boolean(result.data),
  );

  if (successful.length === 0) {
    return {
      success: false,
      kind: "unknown",
      isHuman: false,
      type: "unknown",
      description: "Could not analyze this reference.",
      severity: "blocked",
      message: "We could not inspect this image. Please try another photo.",
      results,
    };
  }

  const humanVotes = successful.filter((result) => result.data.isHuman).length;
  const isHuman = humanVotes > successful.length / 2;
  const type = isHuman
    ? "human"
    : mostCommon(successful.map((result) => result.data.type), "unknown");
  const ageGroup = isHuman
    ? mostCommon(successful.map((result) => result.data.ageGroup || "unknown"), "unknown")
    : "unknown";
  const kind = kindFromAnalysis(isHuman, type, ageGroup);
  const description = successful[0]?.data.description || (isHuman ? "a person" : `a ${type}`);
  const isChild = kind === "child";

  return {
    success: true,
    kind,
    isHuman,
    type,
    ageGroup,
    description,
    severity: isChild ? "warning" : "ok",
    message: isChild
      ? "A child reference was detected. We can continue using broad, non-identifying traits."
      : undefined,
    results,
  };
}

const PROMPT_VALIDATION_SYSTEM = `You validate comic generation prompts before image generation.
Return ONLY JSON with these exact keys:
- "status": "ok", "suggested_fix", or "blocked"
- "issue": short string or empty string
- "message": user-facing explanation, one sentence
- "suggested_prompt": rewritten prompt string or empty string

Rules:
- If the prompt references copyrighted or trademarked characters, franchises, celebrities, brands, or protected character names, use "suggested_fix" and rewrite it into fully original characters while preserving broad mood/action.
- If the prompt asks for sexual content involving minors, explicit sexual content, hateful abuse, graphic real-world violence, or identity deception, use "blocked" and do not provide a rewrite.
- For normal comic adventure/action prompts, use "ok".
- Suggested prompts must be original, concise, and usable directly for comic generation.`;

export async function validatePromptForGeneration(params: {
  client: Together;
  prompt: string;
  mode?: "new-story" | "new-page";
}): Promise<PromptValidationResult> {
  const response = await params.client.chat.completions.create({
    model: PROMPT_VALIDATION_MODEL,
    messages: [
      { role: "system", content: PROMPT_VALIDATION_SYSTEM },
      {
        role: "user",
        content: `Mode: ${params.mode || "new-story"}\nPrompt:\n${params.prompt}`,
      },
    ],
    response_format: { type: "json_object" },
    temperature: 0.2,
    max_tokens: 700,
  });

  const raw = response.choices[0]?.message?.content || "";
  const parsed = extractJson(raw);
  const status = parsed.status === "blocked" || parsed.status === "suggested_fix" ? parsed.status : "ok";
  const suggestedPrompt =
    typeof parsed.suggested_prompt === "string" && parsed.suggested_prompt.trim()
      ? parsed.suggested_prompt.trim()
      : undefined;

  return {
    status,
    issue: typeof parsed.issue === "string" && parsed.issue.trim() ? parsed.issue.trim() : undefined,
    message:
      typeof parsed.message === "string" && parsed.message.trim()
        ? parsed.message.trim()
        : status === "ok"
          ? "Prompt looks ready."
          : "Please revise the prompt before generating.",
    suggestedPrompt: status === "suggested_fix" ? suggestedPrompt : undefined,
  };
}
