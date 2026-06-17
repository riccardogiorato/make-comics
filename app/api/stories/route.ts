import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { db } from "@/lib/db";
import { stories, pages } from "@/lib/schema";
import { eq, inArray, asc } from "drizzle-orm";

export async function GET() {
  try {
    const { userId } = await auth();

    if (!userId) {
      return NextResponse.json(
        { error: "Authentication required" },
        { status: 401 }
      );
    }

    // Fetch all stories for the user
    const userStories = await db
      .select({
        id: stories.id,
        title: stories.title,
        slug: stories.slug,
        style: stories.style,
        createdAt: stories.createdAt,
        updatedAt: stories.updatedAt,
      })
      .from(stories)
      .where(eq(stories.userId, userId));

    if (userStories.length === 0) {
      return NextResponse.json({ stories: [] });
    }

    const storyIds = userStories.map((s) => s.id);

    // Fetch all pages for these stories, ordered for stable cover selection
    const allPages = await db
      .select({
        storyId: pages.storyId,
        pageNumber: pages.pageNumber,
        generatedImageUrl: pages.generatedImageUrl,
        createdAt: pages.createdAt,
        updatedAt: pages.updatedAt,
      })
      .from(pages)
      .where(inArray(pages.storyId, storyIds))
      .orderBy(asc(pages.storyId), asc(pages.pageNumber));

    // Group pages by story
    const pagesByStory = new Map<string, typeof allPages>();
    for (const page of allPages) {
      const list = pagesByStory.get(page.storyId) ?? [];
      list.push(page);
      pagesByStory.set(page.storyId, list);
    }

    const storiesWithCovers = userStories.map((story) => {
      const storyPages = pagesByStory.get(story.id) ?? [];

      // Cover = first page (by pageNumber) that has a generated image
      const coverPage = storyPages.find((p) => p.generatedImageUrl);
      const coverImage = coverPage?.generatedImageUrl ?? null;

      // lastUpdated = max of story.updatedAt and any page.updatedAt/createdAt
      let lastUpdated: Date = story.updatedAt ?? story.createdAt;
      for (const page of storyPages) {
        if (page.updatedAt && page.updatedAt > lastUpdated) {
          lastUpdated = page.updatedAt;
        }
        if (page.createdAt && page.createdAt > lastUpdated) {
          lastUpdated = page.createdAt;
        }
      }

      return {
        id: story.id,
        title: story.title,
        slug: story.slug,
        style: story.style,
        createdAt: story.createdAt,
        pageCount: storyPages.length,
        coverImage,
        lastUpdated,
      };
    });

    // Sort by most recently updated first
    storiesWithCovers.sort((a, b) => {
      const aTime = new Date(a.lastUpdated).getTime();
      const bTime = new Date(b.lastUpdated).getTime();
      return bTime - aTime;
    });

    return NextResponse.json({ stories: storiesWithCovers });
  } catch (error) {
    console.error("Error fetching user stories:", error);
    return NextResponse.json(
      { error: "Failed to fetch stories" },
      { status: 500 }
    );
  }
}