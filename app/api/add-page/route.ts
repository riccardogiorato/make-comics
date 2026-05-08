import { type NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import {
  updatePage,
  createPage,
  getNextPageNumber,
  getStoryWithPagesBySlug,
  deletePage,
} from "@/lib/db-actions";
import { freeTierRateLimit } from "@/lib/rate-limit";
import { uploadImageToS3 } from "@/lib/s3-upload";
import { buildComicPrompt } from "@/lib/prompt";
import { generateComicImage } from "@/lib/image-provider";
import {
  isContentPolicyViolation,
  getContentPolicyErrorMessage,
} from "@/lib/utils";

const FIXED_DIMENSIONS = { width: 864, height: 1184 };

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
      pageId,
      prompt,
      characterImages = [],
    } = await request.json();

    if (!storyId || !prompt) {
      return NextResponse.json(
        { error: "Missing required fields: storyId and prompt" },
        { status: 400 },
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

      const existingPage = storyData.pages.find((p) => p.id === pageId);
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
      // Always use the previous page's image, regardless of new page or redraw
      const storyData = await getStoryWithPagesBySlug(storyId);
      if (storyData) {
        const previousPage = storyData.pages.find(
          (p) => p.pageNumber === pageNumber - 1,
        );
        if (previousPage?.generatedImageUrl) {
          referenceImages.push(previousPage.generatedImageUrl);
        }
      }
    }

    // Use only the character images sent from the frontend (user's selection)
    // These are already the most recent/relevant characters the user wants to use
    referenceImages.push(...characterImages);

    // Build the prompt with continuation context
    // For redraw, only include pages up to the current page being redrawn
    // For new page, include all existing pages
    const relevantPages = isRedraw
      ? pages.filter((p) => p.pageNumber < pageNumber)
      : pages;

    const previousPages = relevantPages.map((p) => ({
      prompt: p.prompt,
    }));

    const fullPrompt = buildComicPrompt({
      prompt,
      style: story.style,
      characterImages,
      isAddPage: true,
      previousPages,
    });

    let generatedImageUrl: string;
    try {
      console.log("Starting image generation for ...");
      console.dir({
        fullPrompt,
        referenceImages,
      });
      const startTime = Date.now();
      const result = await generateComicImage({
        prompt: fullPrompt,
        width: dimensions.width,
        height: dimensions.height,
        referenceImages,
      });
      generatedImageUrl = result.imageUrl;
      const endTime = Date.now();
      const durationMs = endTime - startTime;
      const durationSeconds = (durationMs / 1000).toFixed(2);
      console.log(`Image generation completed in ${durationSeconds} seconds`);
    } catch (error) {
      console.error("Image generation API error:", error);

      // Clean up DB records if generation failed due to content policy
      try {
        if (
          error instanceof Error &&
          error.message &&
          error.message.includes("NO_IMAGE")
        ) {
          if (isRedraw) {
            // For redraw, we don't delete the page, just don't update it
          } else {
            // For new page, delete the page that was created
            await deletePage(page.id);
          }
        }
      } catch (cleanupError) {
        console.error(
          "Error cleaning up DB on image generation failure:",
          cleanupError,
        );
      }

      if (
        error instanceof Error &&
        error.message &&
        isContentPolicyViolation(error.message)
      ) {
        return NextResponse.json(
          {
            error: getContentPolicyErrorMessage(),
            errorType: "content_policy",
          },
          { status: 400 },
        );
      }

      if (error instanceof Error && "status" in error) {
        const status = (error as any).status;
        if (status === 402) {
          return NextResponse.json(
            {
              error: "Insufficient API credits.",
              errorType: "credit_limit",
            },
            { status: 402 },
          );
        }
        return NextResponse.json(
          {
            error: error.message || `Failed to generate image: ${status}`,
            errorType: "api_error",
          },
          { status: status || 500 },
        );
      }

      return NextResponse.json(
        {
          error: `Internal server error: ${
            error instanceof Error ? error.message : "Unknown error"
          }`,
        },
        { status: 500 },
      );
    }

    const s3Key = `${story.id}/page-${page.pageNumber}-${Date.now()}.jpg`;
    const s3ImageUrl = await uploadImageToS3(generatedImageUrl, s3Key);

    await updatePage(page.id, s3ImageUrl);

    // Apply rate limiting for free tier after successful generation
    const hasApiKey = request.headers.get("x-api-key");
    if (!hasApiKey) {
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
      { status: 500 },
    );
  }
}
