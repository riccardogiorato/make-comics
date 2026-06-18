import Together from "together-ai";
import { isContentPolicyViolation } from "@/lib/utils";

export const IMAGE_MODEL = "google/flash-image-2.5";
export const IMAGE_DIMENSIONS = { width: 864, height: 1184 };

const TEXT_MODEL = "Qwen/Qwen3.5-9B";

export type GenerateImageResult = {
  imageUrl: string;
  model: string;
  generationMs: number;
  /** Set only when the original prompt was rewritten due to a content policy block. */
  finalPrompt?: string;
  promptAdjusted: boolean;
};

async function rewritePrompt(client: Together, prompt: string): Promise<string> {
  const res = await client.chat.completions.create({
    model: TEXT_MODEL,
    messages: [
      {
        role: "system",
        content:
          "You are a creative writing assistant. Rewrite the following comic book prompt to use fully original fictional characters and settings, removing any copyrighted names, brands, or real people. Preserve the visual style, action, and mood. Return only the rewritten prompt as one non-empty paragraph, no commentary.",
      },
      { role: "user", content: prompt },
    ],
    temperature: 0.7,
    max_tokens: 500,
  });
  return res.choices[0]?.message?.content?.trim() ?? prompt;
}

export async function generateComicImage(params: {
  client: Together;
  prompt: string;
  referenceImages?: string[];
  temperature?: number;
}): Promise<GenerateImageResult> {
  const {
    client,
    prompt,
    referenceImages = [],
    temperature = 0.1,
  } = params;

  const callApi = async (p: string) => {
    const start = Date.now();
    const response = await client.images.generate({
      model: IMAGE_MODEL,
      prompt: p,
      width: IMAGE_DIMENSIONS.width,
      height: IMAGE_DIMENSIONS.height,
      temperature,
      reference_images: referenceImages.length > 0 ? referenceImages : undefined,
    });
    const ms = Date.now() - start;
    const url = response.data?.[0]?.url;
    if (!url) throw new Error("No image URL in response");
    return { url, ms };
  };

  // First attempt
  try {
    const { url, ms } = await callApi(prompt);
    console.log(`[generate-image] ${IMAGE_MODEL} done in ${(ms / 1000).toFixed(2)}s`);
    return { imageUrl: url, model: IMAGE_MODEL, generationMs: ms, promptAdjusted: false };
  } catch (firstError) {
    if (
      !(firstError instanceof Error) ||
      !isContentPolicyViolation(firstError.message)
    ) {
      throw firstError;
    }

    // Content policy hit — rewrite and retry once
    console.log("[generate-image] Content policy block — rewriting prompt...");
    let rewritten: string;
    try {
      rewritten = await rewritePrompt(client, prompt);
      console.log("[generate-image] Rewritten prompt:", rewritten.slice(0, 120));
      if (!rewritten.trim()) {
        console.error("[generate-image] Prompt rewrite returned empty text");
        throw firstError;
      }
    } catch (rewriteError) {
      console.error("[generate-image] Prompt rewrite failed:", rewriteError);
      throw firstError;
    }

    const { url, ms } = await callApi(rewritten);
    console.log(`[generate-image] Retry succeeded in ${(ms / 1000).toFixed(2)}s`);
    return {
      imageUrl: url,
      model: IMAGE_MODEL,
      generationMs: ms,
      finalPrompt: rewritten,
      promptAdjusted: true,
    };
  }
}
