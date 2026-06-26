import { type NextRequest, NextResponse } from "next/server";
import Together from "together-ai";
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
import { generateComicImage } from "@/lib/generate-image";
import { isContentPolicyViolation, getContentPolicyErrorMessage } from "@/lib/utils";
import {
  getDirectReferenceUrls,
  getReferenceDescriptionLines,
  type StoredCharacterReference,
} from "@/lib/reference-analysis";
import { auth } from "@clerk/nextjs/server";

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
      characterReferences = [],
    } = await request.json();
    const storedCharacterReferences = Array.isArray(characterReferences)
      ? characterReferences as StoredCharacterReference[]
      : [];
    const directCharacterImages = getDirectReferenceUrls(characterImages, storedCharacterReferences);
    const characterReferenceDescriptions = getReferenceDescriptionLines(storedCharacterReferences);

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
        characterReferences: storedCharacterReferences,
      });
    }

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

    // Use only references whose analysis says direct image guidance is appropriate.
    referenceImages.push(...directCharacterImages);

    // Build the prompt with continuation context
    // For redraw, only include pages up to the current page being redrawn
    // For new page, include all existing pages
    const relevantPages = isRedraw
      ? pages.filter((p) => p.pageNumber < pageNumber)
      : pages;

    const previousPages = relevantPages.map((p) => ({
      prompt: p.prompt,
    }));

    const apiKey = request.headers.get("x-api-key")?.trim();
    const finalApiKey = apiKey || process.env.TOGETHER_API_KEY;
    if (!finalApiKey) {
      return NextResponse.json(
        { error: "Generation is not configured. Please add an API key and try again." },
        { status: 500 },
      );
    }

    const fullPrompt = buildComicPrompt({
      prompt,
      style: story.style,
      characterImages: directCharacterImages,
      characterReferenceDescriptions,
      isAddPage: true,
      previousPages,
    });

    const client = new Together({
      apiKey: finalApiKey,
    });

    let genResult;
    try {
      console.log("Starting image generation...", { promptLength: fullPrompt.length, refs: referenceImages.length });
      genResult = await generateComicImage({ client, prompt: fullPrompt, referenceImages });
    } catch (error) {
      console.error("Together AI API error:", error);

      if (!isRedraw) {
        try { await deletePage(page.id); } catch (e) { console.error("Cleanup error:", e); }
      }

      if (
        error instanceof Error &&
        error.message &&
        isContentPolicyViolation(error.message)
      ) {
        return NextResponse.json(
          { error: getContentPolicyErrorMessage(), errorType: "content_policy" },
          { status: 400 },
        );
      }

      if (error instanceof Error && "status" in error) {
        const status = (error as any).status;
        if (status === 402) {
          return NextResponse.json(
            { error: "Insufficient API credits.", errorType: "credit_limit" },
            { status: 402 },
          );
        }
        return NextResponse.json(
          { error: error.message || `Failed to generate image: ${status}`, errorType: "api_error" },
          { status: status || 500 },
        );
      }

      return NextResponse.json(
        { error: "Failed to generate image. Please try again." },
        { status: 500 },
      );
    }

    const s3Key = `${story.id}/page-${page.pageNumber}-${Date.now()}.jpg`;
    const s3ImageUrl = await uploadImageToS3(genResult.imageUrl, s3Key);

    let updatedImageVariations;
    try {
      const variation = await updatePage(page.id, s3ImageUrl, {
        model: genResult.model,
        generationMs: genResult.generationMs,
        finalPrompt: genResult.finalPrompt,
      });
      const refreshedStory = await getStoryWithPagesBySlug(storyId);
      updatedImageVariations =
        refreshedStory?.pages.find((storyPage) => storyPage.id === page.id)?.imageVariations ??
        [variation];
    } catch (dbError) {
      console.error("Error saving generated page:", dbError);
      if (!isRedraw) {
        try {
          await deletePage(page.id);
        } catch (cleanupError) {
          console.error("Cleanup error after page save failure:", cleanupError);
        }
      }
      return NextResponse.json(
        { error: "Generated image could not be saved. Please try again." },
        { status: 503 },
      );
    }

    // Apply rate limiting for free tier after successful generation
    if (!apiKey) {
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
      imageVariations: updatedImageVariations,
      promptAdjusted: genResult.promptAdjusted,
    });
  } catch (error) {
    console.error("Error in add-page API:", error);
    return NextResponse.json(
      { error: "Could not update this comic page. Please try again." },
      { status: 500 },
    );
  }
}
