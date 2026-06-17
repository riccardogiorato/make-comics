import { type NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { deleteStory, getStoryWithPagesBySlug, updateStory } from "@/lib/db-actions";
import { db } from "@/lib/db";
import { stories } from "@/lib/schema";
import { eq } from "drizzle-orm";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ storySlug: string }> }
) {
  try {
    const authResult = await auth();
    const { userId } = authResult;

    const { storySlug: slug } = await params;

    // Special case: if slug is "all", return user's stories for debugging
    if (slug === "all") {
      if (!userId) {
        return NextResponse.json(
          { error: "Authentication required for this endpoint" },
          { status: 401 }
        );
      }
      const userStories = await db
        .select()
        .from(stories)
        .where(eq(stories.userId, userId));
      return NextResponse.json({
        message: "User stories",
        stories: userStories.map((s) => ({
          id: s.id,
          slug: s.slug,
          title: s.title,
        })),
      });
    }

    if (!slug) {
      return NextResponse.json(
        { error: "Story slug is required" },
        { status: 400 }
      );
    }

    const result = await getStoryWithPagesBySlug(slug);

    if (!result) {
      return NextResponse.json({ error: "Story not found" }, { status: 404 });
    }

    // Check if the story belongs to the authenticated user
    const isOwner = userId ? result.story.userId === userId : false;

    // Return the story data with ownership information
    const responseData = {
      ...result,
      isOwner,
    };
    return NextResponse.json(responseData);
  } catch (error) {
    console.error("Error fetching story:", error);
    return NextResponse.json(
      { error: "Failed to fetch story" },
      { status: 500 }
    );
  }
}

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ storySlug: string }> }
) {
  try {
    const { userId } = await auth();

    if (!userId) {
      return NextResponse.json(
        { error: "Authentication required" },
        { status: 401 }
      );
    }

    const { storySlug: slug } = await params;

    if (!slug) {
      return NextResponse.json(
        { error: "Story slug is required" },
        { status: 400 }
      );
    }

    const result = await getStoryWithPagesBySlug(slug);

    if (!result) {
      return NextResponse.json({ error: "Story not found" }, { status: 404 });
    }

    // Check if the story belongs to the authenticated user
    if (result.story.userId !== userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
    }

    const { title } = await request.json();

    if (!title || typeof title !== "string" || title.trim().length === 0) {
      return NextResponse.json(
        { error: "Title is required and must be a non-empty string" },
        { status: 400 }
      );
    }

    await updateStory(result.story.id, { title: title.trim() });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Error updating story:", error);
    return NextResponse.json(
      { error: "Failed to update story" },
      { status: 500 }
    );
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ storySlug: string }> }
) {
  try {
    const { userId } = await auth();

    if (!userId) {
      return NextResponse.json(
        { error: "Authentication required" },
        { status: 401 }
      );
    }

    const { storySlug: slug } = await params;

    if (!slug) {
      return NextResponse.json(
        { error: "Story slug is required" },
        { status: 400 }
      );
    }

    const result = await getStoryWithPagesBySlug(slug);

    if (!result) {
      return NextResponse.json({ error: "Story not found" }, { status: 404 });
    }

    if (result.story.userId !== userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
    }

    await deleteStory(result.story.id);

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Error deleting story:", error);
    return NextResponse.json(
      { error: "Failed to delete story" },
      { status: 500 }
    );
  }
}
