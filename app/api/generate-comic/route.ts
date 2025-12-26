import { type NextRequest, NextResponse } from "next/server";
import Together from "together-ai";
import { auth } from "@clerk/nextjs/server";
import {
  updatePage,
  updateStory,
  createStory,
  createPage,
  getNextPageNumber,
  getStoryById,
  getLastPageImage,
  getStoryCharacterImages,
} from "@/lib/db-actions";
import { freeTierRateLimit } from "@/lib/rate-limit";
import { COMIC_STYLES } from "@/lib/constants";
import { uploadImageToS3 } from "@/lib/s3-upload";
import { buildComicPrompt } from "@/lib/prompt";

const NEW_MODEL = false;

const IMAGE_MODEL = NEW_MODEL
  ? "google/gemini-3-pro-image"
  : "google/flash-image-2.5";

const FIXED_DIMENSIONS = NEW_MODEL
  ? { width: 896, height: 1200 }
  : { width: 864, height: 1184 };

const TEXT_MODEL = "meta-llama/Meta-Llama-3.1-8B-Instruct-Turbo";

export async function POST(request: NextRequest) {
  try {
    const { userId } = await auth();

    if (!userId) {
      return NextResponse.json(
        { error: "Authentication required" },
        { status: 401 }
      );
    }

    const {
      storyId,
      prompt,
      apiKey,
      style = "noir",
      characterImages = [],
      isContinuation = false,
      previousContext = "",
    } = await request.json();

    if (!prompt) {
      return NextResponse.json(
        { error: "Missing required fields" },
        { status: 400 }
      );
    }

    // Determine which API key to use
    let finalApiKey = apiKey;
    const isUsingFreeTier = !apiKey;

    if (isUsingFreeTier) {
      // Using free tier - apply rate limiting
      const { success, reset } = await freeTierRateLimit.limit(userId);

      if (!success) {
        const resetDate = new Date(reset);
        const timeUntilReset = Math.ceil(
          (reset - Date.now()) / (1000 * 60 * 60 * 24)
        ); // days

        return NextResponse.json(
          {
            error: `Free tier limit reached. You can generate 1 comic per week. Try again in ${timeUntilReset} day(s), or provide your own API key for unlimited access.`,
            resetDate: resetDate.toISOString(),
            isRateLimited: true,
          },
          { status: 429 }
        );
      }

      // Use default API key for free tier
      finalApiKey = process.env.TOGETHER_API_KEY_DEFAULT;
      if (!finalApiKey) {
        return NextResponse.json(
          {
            error: "Server configuration error - default API key not available",
          },
          { status: 500 }
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
      });

      page = await createPage({
        storyId: story.id,
        pageNumber: 1,
        prompt,
        characterImageUrls: characterImages,
      });
    }

    // Use only the character images sent from the frontend
    referenceImages.push(...characterImages);

    const dimensions = FIXED_DIMENSIONS;

    const fullPrompt = buildComicPrompt({
      prompt,
      style,
      characterImages,
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

    let response;
    try {
      response = await client.images.generate({
        model: IMAGE_MODEL,
        prompt: fullPrompt,
        width: dimensions.width,
        height: dimensions.height,
        temperature: 0.1, // Lower temperature for more consistent face matching
        reference_images:
          referenceImages.length > 0 ? referenceImages : undefined,
      });
    } catch (error) {
      console.error("Together AI API error:", error);

      if (error instanceof Error && "status" in error) {
        const status = (error as any).status;
        if (status === 402) {
          return NextResponse.json(
            {
              error:
                "Insufficient API credits. Please add credits to your Together.ai account at https://api.together.ai/settings/billing or update your API key.",
              errorType: "credit_limit",
            },
            { status: 402 }
          );
        }
        return NextResponse.json(
          {
            error: error.message || `Failed to generate image: ${status}`,
            errorType: "api_error",
          },
          { status: status || 500 }
        );
      }

      return NextResponse.json(
        {
          error: `Internal server error: ${
            error instanceof Error ? error.message : "Unknown error"
          }`,
        },
        { status: 500 }
      );
    }

    if (!response.data || !response.data[0] || !response.data[0].url) {
      return NextResponse.json(
        { error: "No image URL in response" },
        { status: 500 }
      );
    }

    const imageUrl = response.data[0].url;

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

    // Update page in database with S3 URL
    try {
      await updatePage(page.id, s3ImageUrl);
    } catch (dbError) {
      console.error("Error updating page in database:", dbError);
      return NextResponse.json(
        { error: "Failed to save generated image" },
        { status: 500 }
      );
    }

    const responseData = storyId
      ? { imageUrl: s3ImageUrl, pageId: page.id, pageNumber: page.pageNumber }
      : {
          imageUrl: s3ImageUrl,
          storyId: story!.id,
          storySlug: story!.slug,
          pageId: page.id,
          pageNumber: page.pageNumber,
          title: generatedTitle || story!.title,
          description: generatedDescription || story!.description,
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
      { status: 500 }
    );
  }
}
