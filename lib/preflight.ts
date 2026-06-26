import Together from "together-ai";
import {
  type ReferenceAnalysisSummary,
  type ReferenceKind,
  shouldUseDirectReference,
} from "@/lib/reference-analysis";

const VISION_MODELS = ["Qwen/Qwen3.5-9B"] as const;
const PROMPT_VALIDATION_MODEL = "Qwen/Qwen3.5-9B";
const VISION_TIMEOUT_MS = 10000;
const PROMPT_VALIDATION_TIMEOUT_MS = 10000;

const PROTECTED_REFERENCE_PATTERNS = [
  /\bbarbie\b/i,
  /\bgodzilla\b/i,
  /\bdisney\b/i,
  /\bmarvel\b/i,
  /\bdc comics?\b/i,
  /\bbatman\b/i,
  /\bsuperman\b/i,
  /\bspider[-\s]?man\b/i,
  /\bpokemon\b/i,
  /\bpikachu\b/i,
  /\bmario\b/i,
  /\bsonic\b/i,
  /\bharry potter\b/i,
  /\bstar wars\b/i,
  /\bdarth vader\b/i,
  /\belsa\b/i,
  /\bmickey mouse\b/i,
] as const;

export type ReferenceAnalysis = ReferenceAnalysisSummary & {
  results: VisionModelResult[];
};

type AgeGroup = "child" | "teen" | "adult" | "senior" | "unknown";

type VisionModelData = {
  description: string;
  isHuman: boolean;
  type: string;
  ageGroup: AgeGroup;
  estimatedAge: number | null;
  isUnderFive: boolean;
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

function getProtectedPromptFallback(prompt: string): PromptValidationResult | null {
  if (!PROTECTED_REFERENCE_PATTERNS.some((pattern) => pattern.test(prompt))) {
    return null;
  }

  return {
    status: "suggested_fix",
    issue: "protected_reference",
    message: "This prompt mentions protected characters or brands, so it needs an original version before generation.",
    suggestedPrompt:
      "An original comic scene where a towering city creature and stylish toy-like adventurers are outsmarted by a clever young hero, rendered as dynamic cinematic panels with expressive action and playful stakes.",
  };
}

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

function normalizeAgeGroup(value: unknown): AgeGroup {
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

function normalizeEstimatedAge(value: unknown) {
  if (typeof value !== "number" || !Number.isFinite(value)) return null;
  if (value < 0 || value > 120) return null;
  return Math.round(value);
}

function kindFromAnalysis(isHuman: boolean, type: string, ageGroup: AgeGroup): ReferenceKind {
  if (isHuman) {
    if (ageGroup === "child" || ageGroup === "teen" || ageGroup === "senior") return ageGroup;
    return "adult";
  }

  if (type === "dog" || type === "cat" || type === "animal" || type === "object") return type;
  return "unknown";
}

async function withTimeout<T>(promise: Promise<T>, timeoutMs: number, timeoutMessage: string): Promise<T> {
  let timeout: ReturnType<typeof setTimeout> | undefined;

  try {
    return await Promise.race([
      promise,
      new Promise<T>((_, reject) => {
        timeout = setTimeout(() => reject(new Error(timeoutMessage)), timeoutMs);
      }),
    ]);
  } finally {
    if (timeout) clearTimeout(timeout);
  }
}

const VISION_PROMPT = `Analyze this reference image for a comic generation preflight check.
Return ONLY a JSON object with these exact keys:
- "description": string, a short non-identifying description such as "an adult person with short dark hair and glasses", "a young child with curly hair", "a dog", "a toy object"
- "is_human": boolean
- "type": string, one of "human", "dog", "cat", "animal", "object", or "unknown"
- "age_group": string, ONLY for humans: one of "child", "teen", "adult", "senior", or "unknown"; for non-humans use "unknown"
- "estimated_age": number or null, broad estimate only
- "is_under_five": boolean

Do not identify the person. Do not name real people. Do not infer race or ethnicity.`;

async function runVisionModel(
  client: Together,
  model: string,
  imageUrl: string,
): Promise<VisionModelResult> {
  const start = Date.now();

  try {
    const response = await withTimeout(
      client.chat.completions.create({
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
      }),
      VISION_TIMEOUT_MS,
      "Vision analysis timed out.",
    );
    const raw = response.choices[0]?.message?.content || "";
    const parsed = extractJson(raw);
    const isHuman = parsed.is_human === true;
    const type = normalizeType(parsed.type);
    const ageGroup = isHuman ? normalizeAgeGroup(parsed.age_group) : "unknown";
    const estimatedAge = isHuman ? normalizeEstimatedAge(parsed.estimated_age) : null;
    const isUnderFive = isHuman && (parsed.is_under_five === true || (estimatedAge !== null && estimatedAge < 5));
    const description =
      typeof parsed.description === "string" && parsed.description.trim()
        ? parsed.description.trim()
        : isHuman
          ? `a ${ageGroup} person`
          : `a ${type}`;

    return {
      model,
      success: true,
      timeMs: Date.now() - start,
      data: { description, isHuman, type, ageGroup, estimatedAge, isUnderFive },
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
      ageGroup: "unknown",
      estimatedAge: null,
      isUnderFive: false,
      description: "Could not analyze this reference.",
      severity: "blocked",
      directReferenceAllowed: false,
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
    ? mostCommon(successful.map((result) => result.data.ageGroup), "unknown")
    : "unknown";
  const estimatedAges = successful
    .map((result) => result.data.estimatedAge)
    .filter((age): age is number => age !== null);
  const estimatedAge = estimatedAges.length > 0
    ? Math.round(estimatedAges.reduce((sum, age) => sum + age, 0) / estimatedAges.length)
    : null;
  const isUnderFive = isHuman && (successful.some((result) => result.data.isUnderFive) || (estimatedAge !== null && estimatedAge < 5));
  const kind = kindFromAnalysis(isHuman, type, ageGroup);
  const description = successful[0]?.data.description || (isHuman ? "a person" : `a ${type}`);
  const isChild = kind === "child";
  const analysis = {
    success: true,
    kind,
    isHuman,
    type,
    ageGroup,
    estimatedAge,
    isUnderFive,
    description,
    severity: isChild ? "warning" as const : "ok" as const,
    directReferenceAllowed: true,
  };

  return {
    ...analysis,
    directReferenceAllowed: shouldUseDirectReference(analysis),
    message: isUnderFive
      ? "A very young child reference was detected. We will use only a broad description, not the face image."
      : isChild
        ? "A child reference was detected. We will use broad, non-identifying traits."
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
- Do not keep signature powers, costume elements, color schemes, species, symbols, catchphrases, or recognizable visual concepts from protected characters.
- If the prompt asks for sexual content involving minors, explicit sexual content, hateful abuse, graphic real-world violence, or identity deception, use "blocked" and do not provide a rewrite.
- For normal comic adventure/action prompts, use "ok".
- Suggested prompts must be original, concise, and usable directly for comic generation.`;

export async function validatePromptForGeneration(params: {
  client: Together;
  prompt: string;
  mode?: "new-story" | "new-page";
}): Promise<PromptValidationResult> {
  const protectedFallback = getProtectedPromptFallback(params.prompt);
  if (protectedFallback) {
    return protectedFallback;
  }

  let raw = "";
  let parsed: Record<string, unknown> | null = null;

  for (let attempt = 0; attempt < 2; attempt++) {
    let response;
    try {
      response = await clientWithValidation(params.client, params.prompt, params.mode || "new-story");
    } catch (error) {
      console.warn("Prompt validation request failed", {
        attempt,
        error: error instanceof Error ? error.message : String(error),
      });
      return fallbackPromptValidation(raw, params.prompt);
    }

    raw = response.choices[0]?.message?.content || "";
    try {
      parsed = extractJson(raw);
      break;
    } catch (error) {
      console.warn("Prompt validation returned invalid JSON", {
        attempt,
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }

  if (!parsed) {
    return fallbackPromptValidation(raw, params.prompt);
  }

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

function fallbackPromptValidation(raw: string, prompt: string): PromptValidationResult {
  const protectedFallback = getProtectedPromptFallback(prompt);
  if (protectedFallback) {
    return protectedFallback;
  }

  const normalized = raw.toLowerCase();

  if (normalized.includes('"status"') && normalized.includes("blocked")) {
    return {
      status: "blocked",
      message: "Please revise the prompt before generating.",
    };
  }

  if (normalized.includes('"status"') && normalized.includes("suggested_fix")) {
    return {
      status: "blocked",
      message: "The prompt may need a safer original version. Please adjust it and try again.",
    };
  }

  return {
    status: "ok",
    message: "Prompt check was inconclusive, generation will continue with server safeguards.",
  };
}

function clientWithValidation(client: Together, prompt: string, mode: "new-story" | "new-page") {
  return withTimeout(
    client.chat.completions.create({
      model: PROMPT_VALIDATION_MODEL,
      messages: [
        { role: "system", content: PROMPT_VALIDATION_SYSTEM },
        {
          role: "user",
          content: `Mode: ${mode}\nPrompt:\n${prompt}`,
        },
      ],
      response_format: { type: "json_object" },
      temperature: 0.2,
      max_tokens: 700,
    }),
    PROMPT_VALIDATION_TIMEOUT_MS,
    "Prompt validation timed out.",
  );
}
