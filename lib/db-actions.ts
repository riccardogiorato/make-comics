import { db } from './db';
import { stories, pages, type Story, type Page } from './schema';
import { eq } from 'drizzle-orm';
import { generateComicSlug } from './slug-generator';

export async function createStory(data: { title: string; description?: string; userId: string }): Promise<Story> {
  // Generate a unique slug
  let slug = generateComicSlug();
  let attempts = 0;
  const maxAttempts = 10;

  // Ensure slug uniqueness
  while (attempts < maxAttempts) {
    const existing = await db.select().from(stories).where(eq(stories.slug, slug)).limit(1);
    if (existing.length === 0) break;
    slug = generateComicSlug();
    attempts++;
  }

  if (attempts >= maxAttempts) {
    // Fallback to a simple random slug if we can't generate a unique one
    slug = `story-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`;
  }

  const [story] = await db.insert(stories).values({ ...data, slug }).returning();
  return story;
}

export async function createPage(data: {
  storyId: string;
  pageNumber: number;
  prompt: string;
  characterImageUrls: string[];
  style: string;
}): Promise<Page> {
  const [page] = await db.insert(pages).values(data).returning();
  return page;
}

export async function updatePage(pageId: string, generatedImageUrl: string): Promise<void> {
  await db.update(pages)
    .set({ generatedImageUrl, updatedAt: new Date() })
    .where(eq(pages.id, pageId));
}

export async function getStoryWithPages(storyId: string): Promise<{ story: Story; pages: Page[] } | null> {
  const storyResult = await db.select().from(stories).where(eq(stories.id, storyId)).limit(1);

  if (storyResult.length === 0) {
    return null;
  }

  const storyPages = await db.select().from(pages)
    .where(eq(pages.storyId, storyId))
    .orderBy(pages.pageNumber);

  return {
    story: storyResult[0],
    pages: storyPages,
  };
}

export async function getStoryWithPagesBySlug(slug: string): Promise<{ story: Story; pages: Page[] } | null> {
  console.log("DB: Searching for slug:", slug);
  const storyResult = await db.select().from(stories).where(eq(stories.slug, slug)).limit(1);
  console.log("DB: Story result count:", storyResult.length);

  if (storyResult.length === 0) {
    console.log("DB: No story found with slug:", slug);
    return null;
  }

  console.log("DB: Found story:", storyResult[0].id, storyResult[0].slug);
  const storyPages = await db.select().from(pages)
    .where(eq(pages.storyId, storyResult[0].id))
    .orderBy(pages.pageNumber);

  console.log("DB: Found pages count:", storyPages.length);

  return {
    story: storyResult[0],
    pages: storyPages,
  };
}

export async function getStoryCharacterImages(storyId: string): Promise<string[]> {
  const storyPages = await db.select({ characterImageUrls: pages.characterImageUrls })
    .from(pages)
    .where(eq(pages.storyId, storyId));

  // Flatten all character URLs from all pages and remove duplicates
  const allUrls = storyPages.flatMap(page => page.characterImageUrls);
  return [...new Set(allUrls)]; // Remove duplicates
}

export async function getNextPageNumber(storyId: string): Promise<number> {
  const storyPages = await db.select({ pageNumber: pages.pageNumber })
    .from(pages)
    .where(eq(pages.storyId, storyId))
    .orderBy(pages.pageNumber);

  if (storyPages.length === 0) {
    return 1;
  }

  return Math.max(...storyPages.map(p => p.pageNumber)) + 1;
}