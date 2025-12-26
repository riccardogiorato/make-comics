import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { db } from "@/lib/db";
import { stories, pages } from "@/lib/schema";
import { eq } from "drizzle-orm";

export async function GET() {
  try {
    const { userId } = await auth();

    if (!userId) {
      return NextResponse.json(
        { error: "Authentication required" },
        { status: 401 }
      );
    }

    // Get all stories for the user with their first page
    const userStories = await db
      .select({
        id: stories.id,
        title: stories.title,
        slug: stories.slug,
        createdAt: stories.createdAt,
        pageCount: pages.pageNumber,
        coverImage: pages.generatedImageUrl,
      })
      .from(stories)
      .leftJoin(pages, eq(stories.id, pages.storyId))
      .where(eq(stories.userId, userId))
      .orderBy(stories.createdAt);

    // Group by story and find the max page number and first page image
    const storyMap = new Map();

    userStories.forEach((row) => {
      const storyId = row.id;
      if (!storyMap.has(storyId)) {
        storyMap.set(storyId, {
          id: row.id,
          title: row.title,
          slug: row.slug,
          createdAt: row.createdAt,
          pageCount: 0,
          coverImage: null,
        });
      }

      const story = storyMap.get(storyId);
      if (row.pageCount && row.pageCount > story.pageCount) {
        story.pageCount = row.pageCount;
      }
      if (row.pageCount === 1 && row.coverImage) {
        story.coverImage = row.coverImage;
      }
    });

    const storiesWithCovers = Array.from(storyMap.values());

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