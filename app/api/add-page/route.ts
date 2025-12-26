import { type NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import Together from "together-ai";
import { db } from "@/lib/db";
import { pages } from "@/lib/schema";
import { eq } from "drizzle-orm";
import {
  updatePage,
  createPage,
  getNextPageNumber,
  getStoryWithPagesBySlug,
  getLastPageImage,
} from "@/lib/db-actions";
import { freeTierRateLimit } from "@/lib/rate-limit";
import { uploadImageToS3 } from "@/lib/s3-upload";
import { buildComicPrompt } from "@/lib/prompt";

const NEW_MODEL = false;

const IMAGE_MODEL = NEW_MODEL
  ? "google/gemini-3-pro-image"
  : "google/flash-image-2.5";

const FIXED_DIMENSIONS = NEW_MODEL
  ? { width: 896, height: 1200 }
  : { width: 864, height: 1184 };

export async function POST(request: NextRequest) {
  try {
    const { userId } = await auth();

    if (!userId) {
      return NextResponse.json(
        { error: "Authentication required" },
        { status: 401 }
      );
    }

    const { storyId, pageId, prompt, characterImages = [] } = await request.json();

    if (!storyId || !prompt) {
      return NextResponse.json(
        { error: "Missing required fields: storyId and prompt" },
        { status: 400 }
      );
    }

    // Get the story and all its pages
    const storyData = await getStoryWithPagesBySlug(storyId);
    if (!storyData) {
      return NextResponse.json({ error: "Story not found" }, { status: 404 });
    }

    const { story, pages } = storyData;

    // Check ownership
    if (story.userId !== userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
    }

    // Apply rate limiting for free tier
    const hasApiKey = request.headers.get('x-api-key');
    if (!hasApiKey) {
      const { success, reset } = await freeTierRateLimit.limit(userId);
      if (!success) {
        const resetDate = new Date(reset);
        const timeUntilReset = Math.ceil(
          (reset - Date.now()) / (1000 * 60 * 60 * 24)
        );
        return NextResponse.json(
          {
            error: `Free tier limit reached. You can generate 1 comic per week. Try again in ${timeUntilReset} day(s), or provide your own API key.`,
            resetDate: resetDate.toISOString(),
            isRateLimited: true,
          },
          { status: 429 }
        );
      }
    }

    let page;
    let pageNumber;
    let isRedraw = false;

    if (pageId) {
      // Redraw mode: update existing page
      isRedraw = true;
      const storyData = await getStoryWithPagesBySlug(storyId);
      if (!storyData) {
        return NextResponse.json({ error: "Story not found" }, { status: 404 });
      }

      const existingPage = storyData.pages.find(p => p.id === pageId);
      if (!existingPage) {
        return NextResponse.json({ error: "Page not found" }, { status: 404 });
      }

      page = existingPage;
      pageNumber = existingPage.pageNumber;
    } else {
      // Add new page mode
      pageNumber = await getNextPageNumber(story.id);
      page = await createPage({
        storyId: story.id,
        pageNumber,
        prompt,
        characterImageUrls: characterImages,
      });
    }

    const dimensions = FIXED_DIMENSIONS;

    // Collect reference images: previous page + story characters + current characters
    let referenceImages: string[] = [];

    // Get previous page image for style consistency (unless it's page 1)
    if (pageNumber > 1) {
      if (isRedraw) {
        // For redraw, get all pages and find the previous page's image
        const storyData = await getStoryWithPagesBySlug(storyId);
        if (storyData) {
          const previousPage = storyData.pages.find(p => p.pageNumber === pageNumber - 1);
          if (previousPage?.generatedImageUrl) {
            referenceImages.push(previousPage.generatedImageUrl);
          }
        }
      } else {
        // For new page, use the last page image
        const lastPageImage = await getLastPageImage(story.id);
        if (lastPageImage) {
          referenceImages.push(lastPageImage);
        }
      }
    }

    // Use only the character images sent from the frontend (user's selection)
    // These are already the most recent/relevant characters the user wants to use
    referenceImages.push(...characterImages);

    // Build the prompt with continuation context
    const previousPages = pages.map(p => ({
      prompt: p.prompt,
      characterImages: p.characterImageUrls,
    }));

    const fullPrompt = buildComicPrompt({
      prompt,
      style: story.style,
      characterImages,
      isAddPage: true,
      previousPages,
    });

    const client = new Together({ apiKey: process.env.TOGETHER_API_KEY_DEFAULT });

    let response;
    try {
      response = await client.images.generate({
        model: IMAGE_MODEL,
        prompt: fullPrompt,
        width: dimensions.width,
        height: dimensions.height,
        temperature: 0.1,
        reference_images: referenceImages.length > 0 ? referenceImages : undefined,
      });
    } catch (error) {
      console.error("Together AI API error:", error);

      if (error instanceof Error && "status" in error) {
        const status = (error as any).status;
        if (status === 402) {
          return NextResponse.json(
            {
              error: "Insufficient API credits.",
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
    const s3Key = `${story.id}/page-${page.pageNumber}-${Date.now()}.jpg`;
    const s3ImageUrl = await uploadImageToS3(imageUrl, s3Key);

    await updatePage(page.id, s3ImageUrl);

    return NextResponse.json({
      imageUrl: s3ImageUrl,
      pageId: page.id,
      pageNumber: page.pageNumber,
    });
  } catch (error) {
    console.error("Error in add-page API:", error);
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