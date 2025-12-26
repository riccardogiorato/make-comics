import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { db } from "@/lib/db";
import { stories, pages } from "@/lib/schema";
import { eq, desc, sql } from "drizzle-orm";

export async function GET() {
  try {
    const { userId } = await auth();

    if (!userId) {
      return NextResponse.json(
        { error: "Authentication required" },
        { status: 401 }
      );
    }

    // Get all stories for the user with their pages
    const userStories = await db
      .select({
        id: stories.id,
        title: stories.title,
        slug: stories.slug,
        style: stories.style,
        createdAt: stories.createdAt,
        pageCount: pages.pageNumber,
        coverImage: pages.generatedImageUrl,
        pageCreatedAt: pages.createdAt,
        pageUpdatedAt: pages.updatedAt,
      })
      .from(stories)
      .leftJoin(pages, eq(stories.id, pages.storyId))
      .where(eq(stories.userId, userId));

    // Group by story and find the max page number, first page image, and most recent update
    const storyMap = new Map();

    userStories.forEach((row) => {
      const storyId = row.id;
      if (!storyMap.has(storyId)) {
        storyMap.set(storyId, {
          id: row.id,
          title: row.title,
          slug: row.slug,
          style: row.style,
          createdAt: row.createdAt,
          pageCount: 0,
          coverImage: null,
          lastUpdated: row.createdAt, // Default to story creation date
        });
      }

      const story = storyMap.get(storyId);
      if (row.pageCount && row.pageCount > story.pageCount) {
        story.pageCount = row.pageCount;
      }
      if (row.pageCount === 1 && row.coverImage) {
        story.coverImage = row.coverImage;
      }
      // Track the most recent page update
      if (row.pageUpdatedAt && row.pageUpdatedAt > story.lastUpdated) {
        story.lastUpdated = row.pageUpdatedAt;
      } else if (row.pageCreatedAt && row.pageCreatedAt > story.lastUpdated) {
        story.lastUpdated = row.pageCreatedAt;
      }
    });

    const storiesWithCovers = Array.from(storyMap.values());

    // Sort by most recently updated (stories with newest pages first)
    storiesWithCovers.sort((a, b) => {
      const aTime = new Date(a.lastUpdated).getTime();
      const bTime = new Date(b.lastUpdated).getTime();
      return bTime - aTime; // Most recent first
    });

    return NextResponse.json({
      stories: storiesWithCovers
    });
  } catch (error) {
    console.error("Error fetching user stories:", error);
    return NextResponse.json(
      { error: "Failed to fetch stories" },
      { status: 500 }
    );
  }
}