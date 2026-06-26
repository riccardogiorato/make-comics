import { type NextRequest, NextResponse } from "next/server";
import Together from "together-ai";
import {
  updatePage,
  updateStory,
  createStory,
  createPage,
  getNextPageNumber,
  getStoryById,
  getLastPageImage,
  deletePage,
  deleteStory,
} from "@/lib/db-actions";
import { freeTierRateLimit } from "@/lib/rate-limit";
import { COMIC_STYLES } from "@/lib/constants";
import { uploadImageToS3 } from "@/lib/s3-upload";
import { buildComicPrompt } from "@/lib/prompt";
import { generateComicImage } from "@/lib/generate-image";
import {
  getDirectReferenceUrls,
  getReferenceDescriptionLines,
  type StoredCharacterReference,
} from "@/lib/reference-analysis";
import { auth } from "@clerk/nextjs/server";

const TEXT_MODEL = "Qwen/Qwen3.5-9B";

export async function POST(request: NextRequest) {
  try {
    const { userId } = await auth();

    if (!userId) {
      return NextResponse.json(
        { error: "Authentication required" },
        { status: 401 },
      );
    }

    const {
      storyId,
      prompt,
      apiKey,
      style = "noir",
      characterImages = [],
      characterReferences = [],
      isContinuation = false,
      previousContext = "",
    } = await request.json();
    const storedCharacterReferences = Array.isArray(characterReferences)
      ? characterReferences as StoredCharacterReference[]
      : [];
    const directCharacterImages = getDirectReferenceUrls(characterImages, storedCharacterReferences);
    const characterReferenceDescriptions = getReferenceDescriptionLines(storedCharacterReferences);

    if (!prompt) {
      return NextResponse.json(
        { error: "Missing required fields" },
        { status: 400 },
      );
    }

    // Determine which API key to use
    let finalApiKey = apiKey;
    const isUsingFreeTier = !apiKey;
    const usesOwnApiKey = !!apiKey;

    if (isUsingFreeTier) {
      // Use default API key for free tier
      finalApiKey = process.env.TOGETHER_API_KEY;
      if (!finalApiKey) {
        return NextResponse.json(
          {
            error: "Server configuration error - default API key not available",
          },
          { status: 500 },
        );
      }
    }

    let page;
    let story;
    let referenceImages: string[] = [];

    if (storyId) {
      // Continuation: get previous page image and story character images
      story = await getStoryById(storyId);
      if (!story) {
        return NextResponse.json({ error: "Story not found" }, { status: 404 });
      }

      const nextPageNumber = await getNextPageNumber(storyId);
      page = await createPage({
        storyId,
        pageNumber: nextPageNumber,
        prompt,
        characterImageUrls: characterImages,
        characterReferences: storedCharacterReferences,
      });

      // Get previous page image for style consistency (unless it's page 1)
      if (nextPageNumber > 1) {
        const lastPageImage = await getLastPageImage(storyId);
        if (lastPageImage) {
          referenceImages.push(lastPageImage);
        }
      }

      // For continuation pages, character images are sent from frontend
      // No need to fetch separately - frontend handles selection
    } else {
      // New story: no previous page reference
      // Create story with temporary title, will update with generated title
      story = await createStory({
        title: prompt.length > 50 ? prompt.substring(0, 50) + "..." : prompt,
        description: undefined,
        userId: userId,
        style,
        usesOwnApiKey,
      });

      page = await createPage({
        storyId: story.id,
        pageNumber: 1,
        prompt,
        characterImageUrls: characterImages,
        characterReferences: storedCharacterReferences,
      });
    }

    // Use direct references only when analysis allows it. Child references stay stored
    // for continuity but become written descriptions in the prompt.
    referenceImages.push(...directCharacterImages);

    const fullPrompt = buildComicPrompt({
      prompt,
      style,
      characterImages: directCharacterImages,
      characterReferenceDescriptions,
      isContinuation,
      previousContext,
    });

    const client = new Together({ apiKey: finalApiKey });

    // Generate title and description in parallel with image generation (only for new stories)
    let titleGenerationPromise: Promise<{
      title: string;
      description: string;
    }> | null = null;
    if (!storyId) {
      titleGenerationPromise = (async () => {
        try {
          const titlePrompt = `Based on this comic book prompt, generate a compelling title and description for the comic book.

Prompt: "${prompt}"
Style: ${COMIC_STYLES.find((s) => s.id === style)?.name || style}

Generate:
1. A catchy, engaging title (maximum 60 characters)
2. A brief description (2-3 sentences, maximum 200 characters)

Format your response as JSON:
{
  "title": "Title here",
  "description": "Description here"
}

Only return the JSON, no other text.`;

          const textResponse = await client.chat.completions.create({
            model: TEXT_MODEL,
            messages: [
              {
                role: "system",
                content:
                  "You are a creative assistant that generates compelling comic book titles and descriptions. Always respond with valid JSON only.",
              },
              {
                role: "user",
                content: titlePrompt,
              },
            ],
            temperature: 0.8,
            max_tokens: 300,
          });

          const content = textResponse.choices[0]?.message?.content?.trim();
          if (!content) {
            throw new Error("No response from text generation");
          }

          // Extract JSON from response (in case there's extra text)
          const jsonMatch = content.match(/\{[\s\S]*\}/);
          if (!jsonMatch) {
            throw new Error("No JSON found in response");
          }

          const parsed = JSON.parse(jsonMatch[0]);
          const rawTitle =
            parsed.title?.trim() ||
            (prompt.length > 50 ? prompt.substring(0, 50) + "..." : prompt);
          const rawDescription = parsed.description?.trim();

          // Enforce character limits
          const title =
            rawTitle.length > 60 ? rawTitle.substring(0, 57) + "..." : rawTitle;
          const description =
            rawDescription && rawDescription.length > 200
              ? rawDescription.substring(0, 197) + "..."
              : rawDescription;

          return {
            title,
            description: description || undefined,
          };
        } catch (error) {
          console.error("Error generating title and description:", error);
          // Fallback to prompt-based title
          return {
            title:
              prompt.length > 50 ? prompt.substring(0, 50) + "..." : prompt,
            description: undefined,
          };
        }
      })();
    }

    let genResult;
    try {
      console.log("Starting image generation...", { promptLength: fullPrompt.length, refs: referenceImages.length });
      genResult = await generateComicImage({
        client,
        prompt: fullPrompt,
        referenceImages,
        temperature: 0.1,
      });
    } catch (error) {
      console.error("Together AI API error:", error);

      // Clean up DB records if generation failed
      try {
        if (!storyId) {
          await deleteStory(story!.id);
        } else {
          await deletePage(page.id);
        }
      } catch (cleanupError) {
        console.error("Error cleaning up DB on image generation failure:", cleanupError);
      }

      if (error instanceof Error && "status" in error) {
        const status = (error as any).status;
        if (status === 402) {
          return NextResponse.json(
            {
              error:
                "Insufficient API credits. Please add credits to your Together.ai account at https://api.together.ai/settings/billing or update your API key.",
              errorType: "credit_limit",
            },
            { status: 402 },
          );
        }
        return NextResponse.json(
          { error: error.message || `Failed to generate image: ${status}`, errorType: "api_error" },
          { status: status || 500 },
        );
      }

      return NextResponse.json(
        { error: `Internal server error: ${error instanceof Error ? error.message : "Unknown error"}` },
        { status: 500 },
      );
    }

    const imageUrl = genResult.imageUrl;

    // Upload image to S3 for permanent storage
    const s3Key = `${storyId || story!.id}/page-${
      page.pageNumber
    }-${Date.now()}.jpg`;
    const s3ImageUrl = await uploadImageToS3(imageUrl, s3Key);

    // Wait for title/description generation if it's a new story
    let generatedTitle: string | undefined;
    let generatedDescription: string | undefined;
    if (titleGenerationPromise) {
      const titleData = await titleGenerationPromise;
      generatedTitle = titleData.title;
      generatedDescription = titleData.description;

      // Update story with generated title and description
      try {
        await updateStory(story!.id, {
          title: generatedTitle,
          description: generatedDescription,
        });
        // Update story object for response
        story = {
          ...story,
          title: generatedTitle,
          description: generatedDescription,
        };
      } catch (dbError) {
        console.error("Error updating story title/description:", dbError);
        // Continue even if update fails
      }
    }

    // Update page in database with S3 URL + telemetry
    try {
      await updatePage(page.id, s3ImageUrl, {
        model: genResult.model,
        generationMs: genResult.generationMs,
        finalPrompt: genResult.finalPrompt,
      });
    } catch (dbError) {
      console.error("Error updating page in database:", dbError);
      return NextResponse.json(
        { error: "Failed to save generated image" },
        { status: 500 },
      );
    }

    // Apply rate limiting for free tier after successful generation
    if (isUsingFreeTier) {
      try {
        await freeTierRateLimit.limit(userId);
      } catch (rateLimitError) {
        console.error(
          "Error applying rate limit after successful generation:",
          rateLimitError,
        );
        // Don't fail the request if rate limiting fails, just log it
      }
    }

    const responseData = storyId
      ? { imageUrl: s3ImageUrl, pageId: page.id, pageNumber: page.pageNumber, promptAdjusted: genResult.promptAdjusted }
      : {
          imageUrl: s3ImageUrl,
          storyId: story!.id,
          storySlug: story!.slug,
          pageId: page.id,
          pageNumber: page.pageNumber,
          title: generatedTitle || story!.title,
          description: generatedDescription || story!.description,
          promptAdjusted: genResult.promptAdjusted,
        };

    return NextResponse.json(responseData);
  } catch (error) {
    console.error("Error in generate-comic API:", error);
    return NextResponse.json(
      {
        error: `Internal server error: ${
          error instanceof Error ? error.message : "Unknown error"
        }`,
      },
      { status: 500 },
    );
  }
}
