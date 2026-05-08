import type { ImageGenerateParams } from "together-ai/resources/images";

const DEFAULT_PROVIDER = "pollinations";
const DEFAULT_POLLINATIONS_BASE_URL = "https://image.pollinations.ai";
const DEFAULT_POLLINATIONS_MODEL = "flux";
const POLLINATIONS_MAX_PROMPT_LENGTH = 1800;

type ImageProviderName = "pollinations" | "together";

export interface ImageProviderConfig {
  provider: ImageProviderName;
  requiresApiKey: boolean;
}

export interface GenerateComicImageOptions {
  prompt: string;
  width: number;
  height: number;
  referenceImages?: string[];
  apiKey?: string;
  temperature?: number;
}

export interface GenerateComicImageResult {
  imageUrl: string;
}

export function getImageProviderConfig(
  env: Record<string, string | undefined> = process.env,
): ImageProviderConfig {
  const provider = (env.IMAGE_PROVIDER || DEFAULT_PROVIDER).toLowerCase();

  if (provider === "together") {
    return {
      provider: "together",
      requiresApiKey: true,
    };
  }

  return {
    provider: "pollinations",
    requiresApiKey: false,
  };
}

export function buildPollinationsImageUrl({
  prompt,
  width,
  height,
  seed,
  model = process.env.IMAGE_MODEL || DEFAULT_POLLINATIONS_MODEL,
  baseUrl = process.env.IMAGE_API_URL || DEFAULT_POLLINATIONS_BASE_URL,
}: {
  prompt: string;
  width: number;
  height: number;
  seed?: number;
  model?: string;
  baseUrl?: string;
}): string {
  const compactPrompt = compactPromptForUrl(prompt);
  const url = new URL(`/prompt/${encodeURIComponent(compactPrompt)}`, baseUrl);
  url.searchParams.set("width", String(width));
  url.searchParams.set("height", String(height));
  url.searchParams.set("nologo", "true");

  if (model) {
    url.searchParams.set("model", model);
  }

  if (seed !== undefined) {
    url.searchParams.set("seed", String(seed));
  }

  return url.toString();
}

export async function generateComicImage({
  prompt,
  width,
  height,
  referenceImages = [],
  apiKey,
  temperature,
}: GenerateComicImageOptions): Promise<GenerateComicImageResult> {
  const config = getImageProviderConfig();

  if (config.provider === "together") {
    return generateTogetherImage({
      prompt,
      width,
      height,
      referenceImages,
      apiKey: apiKey || process.env.TOGETHER_API_KEY,
      temperature,
    });
  }

  return {
    imageUrl: buildPollinationsImageUrl({
      prompt,
      width,
      height,
      seed: Math.floor(Math.random() * 1_000_000_000),
    }),
  };
}

function compactPromptForUrl(prompt: string): string {
  const compact = prompt.replace(/\s+/g, " ").trim();
  if (compact.length <= POLLINATIONS_MAX_PROMPT_LENGTH) {
    return compact;
  }

  return compact.slice(0, POLLINATIONS_MAX_PROMPT_LENGTH);
}

async function generateTogetherImage({
  prompt,
  width,
  height,
  referenceImages,
  apiKey,
  temperature,
}: GenerateComicImageOptions): Promise<GenerateComicImageResult> {
  if (!apiKey) {
    throw new Error("TOGETHER_API_KEY is required when IMAGE_PROVIDER=together");
  }

  const Together = (await import("together-ai")).default;
  const client = new Together({ apiKey });
  const model =
    process.env.IMAGE_MODEL ||
    process.env.TOGETHER_IMAGE_MODEL ||
    "google/flash-image-2.5";

  const params: ImageGenerateParams = {
    model,
    prompt,
    width,
    height,
    temperature,
  };

  if (referenceImages.length > 0) {
    params.reference_images = referenceImages;
  }

  const response = await client.images.generate(params);
  const imageUrl = response.data?.[0]?.url;

  if (!imageUrl) {
    throw new Error("No image URL in response");
  }

  return { imageUrl };
}
