import { type NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { getStoryWithPagesBySlug, setPrimaryPageVariation } from "@/lib/db-actions";

export async function POST(request: NextRequest) {
  try {
    const { userId } = await auth();

    if (!userId) {
      return NextResponse.json({ error: "Authentication required" }, { status: 401 });
    }

    const { storySlug, pageId, variationId } = await request.json();

    if (!storySlug || !pageId || !variationId) {
      return NextResponse.json(
        { error: "Missing required fields: storySlug, pageId, and variationId" },
        { status: 400 },
      );
    }

    const storyData = await getStoryWithPagesBySlug(storySlug);
    if (!storyData) {
      return NextResponse.json({ error: "Story not found" }, { status: 404 });
    }

    if (storyData.story.userId !== userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
    }

    const page = storyData.pages.find((storyPage) => storyPage.id === pageId);
    if (!page) {
      return NextResponse.json({ error: "Page not found" }, { status: 404 });
    }

    const selectedVariation = await setPrimaryPageVariation(pageId, variationId);
    if (!selectedVariation) {
      return NextResponse.json({ error: "Variation not found" }, { status: 404 });
    }

    const refreshedStory = await getStoryWithPagesBySlug(storySlug);
    const refreshedPage = refreshedStory?.pages.find((storyPage) => storyPage.id === pageId);

    return NextResponse.json({
      imageUrl: selectedVariation.imageUrl,
      variation: selectedVariation,
      imageVariations: refreshedPage?.imageVariations ?? [selectedVariation],
    });
  } catch (error) {
    console.error("Error selecting page variation:", error);
    return NextResponse.json(
      { error: "Could not select this page version. Please try again." },
      { status: 500 },
    );
  }
}
