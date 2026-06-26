import { db } from './db';
import {
  stories,
  pages,
  pageImageVariations,
  feedback,
  type Story,
  type Page,
  type Feedback,
  type PageImageVariation,
  type PageWithVariations,
} from './schema';
import type { StoredCharacterReference } from './reference-analysis';
import { and, asc, eq, gte, inArray, isNotNull, sql } from 'drizzle-orm';
import { generateComicSlug } from './slug-generator';

async function withDbRetry<T>(label: string, operation: () => Promise<T>): Promise<T> {
  let lastError: unknown;

  for (let attempt = 1; attempt <= 3; attempt++) {
    try {
      return await operation();
    } catch (error) {
      lastError = error;
      const message = error instanceof Error ? error.message : String(error);
      console.warn(`[db-retry] ${label} failed`, { attempt, message });
      if (attempt < 3) {
        await new Promise((resolve) => setTimeout(resolve, attempt * 500));
      }
    }
  }

  throw lastError;
}

export async function createStory(data: { title: string; description?: string; userId: string; style?: string; usesOwnApiKey?: boolean }): Promise<Story> {
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
  characterReferences?: StoredCharacterReference[];
}): Promise<Page> {
  const [page] = await db.insert(pages).values(data).returning();
  return page;
}

export async function updatePage(
  pageId: string,
  generatedImageUrl: string,
  extras?: { finalPrompt?: string; model?: string; generationMs?: number },
): Promise<PageImageVariation> {
  return withDbRetry("updatePage", async () => {
    const [existingPage] = await db.select().from(pages).where(eq(pages.id, pageId)).limit(1);
    const existingVariations = await db
      .select({ id: pageImageVariations.id })
      .from(pageImageVariations)
      .where(eq(pageImageVariations.pageId, pageId))
      .limit(1);

    if (existingPage?.generatedImageUrl && existingPage.generatedImageUrl !== generatedImageUrl && existingVariations.length === 0) {
      await db.insert(pageImageVariations).values({
        pageId,
        imageUrl: existingPage.generatedImageUrl,
        isPrimary: false,
        prompt: existingPage.prompt,
        finalPrompt: existingPage.finalPrompt,
        model: existingPage.model,
        generationMs: existingPage.generationMs,
        createdAt: existingPage.updatedAt,
      });
    }

    await db
      .update(pageImageVariations)
      .set({ isPrimary: false })
      .where(eq(pageImageVariations.pageId, pageId));

    const [variation] = await db
      .insert(pageImageVariations)
      .values({
        pageId,
        imageUrl: generatedImageUrl,
        isPrimary: true,
        prompt: existingPage?.prompt,
        finalPrompt: extras?.finalPrompt,
        model: extras?.model,
        generationMs: extras?.generationMs,
      })
      .returning();

    await db.update(pages)
      .set({
        generatedImageUrl,
        updatedAt: new Date(),
        ...(extras?.finalPrompt !== undefined && { finalPrompt: extras.finalPrompt }),
        ...(extras?.model !== undefined && { model: extras.model }),
        ...(extras?.generationMs !== undefined && { generationMs: extras.generationMs }),
      })
      .where(eq(pages.id, pageId));

    return variation;
  });
}

export async function updateStory(storyId: string, data: { title?: string; description?: string }): Promise<void> {
  await withDbRetry("updateStory", () =>
    db.update(stories)
      .set({ ...data, updatedAt: new Date() })
      .where(eq(stories.id, storyId)),
  );
}

async function attachImageVariations(storyPages: Page[]): Promise<PageWithVariations[]> {
  if (storyPages.length === 0) return [];

  const variations = await withDbRetry("attachImageVariations", () =>
    db
      .select()
      .from(pageImageVariations)
      .where(inArray(pageImageVariations.pageId, storyPages.map((page) => page.id)))
      .orderBy(asc(pageImageVariations.createdAt)),
  );
  const variationsByPage = new Map<string, PageImageVariation[]>();
  for (const variation of variations) {
    const list = variationsByPage.get(variation.pageId) ?? [];
    list.push(variation);
    variationsByPage.set(variation.pageId, list);
  }

  return storyPages.map((page) => ({
    ...page,
    imageVariations: variationsByPage.get(page.id) ?? [],
  }));
}

export async function getStoryWithPages(storyId: string): Promise<{ story: Story; pages: PageWithVariations[] } | null> {
  const storyResult = await withDbRetry("getStoryWithPages.story", () =>
    db.select().from(stories).where(eq(stories.id, storyId)).limit(1),
  );

  if (storyResult.length === 0) {
    return null;
  }

  const storyPages = await withDbRetry("getStoryWithPages.pages", () =>
    db.select().from(pages)
      .where(eq(pages.storyId, storyId))
      .orderBy(pages.pageNumber),
  );

  return {
    story: storyResult[0],
    pages: await attachImageVariations(storyPages),
  };
}

export async function getStoryById(storyId: string): Promise<Story | null> {
  const result = await withDbRetry("getStoryById", () =>
    db.select().from(stories).where(eq(stories.id, storyId)).limit(1),
  );
  return result.length > 0 ? result[0] : null;
}

export async function getStoryWithPagesBySlug(slug: string): Promise<{ story: Story; pages: PageWithVariations[] } | null> {
  const storyResult = await withDbRetry("getStoryWithPagesBySlug.story", () =>
    db.select().from(stories).where(eq(stories.slug, slug)).limit(1),
  );

  if (storyResult.length === 0) {
    return null;
  }

  const storyPages = await withDbRetry("getStoryWithPagesBySlug.pages", () =>
    db.select().from(pages)
      .where(eq(pages.storyId, storyResult[0].id))
      .orderBy(pages.pageNumber),
  );

  return {
    story: storyResult[0],
    pages: await attachImageVariations(storyPages),
  };
}

export async function setPrimaryPageVariation(pageId: string, variationId: string): Promise<PageImageVariation | null> {
  return withDbRetry("setPrimaryPageVariation", async () => {
    const [variation] = await db
      .select()
      .from(pageImageVariations)
      .where(and(eq(pageImageVariations.id, variationId), eq(pageImageVariations.pageId, pageId)))
      .limit(1);

    if (!variation) return null;

    await db
      .update(pageImageVariations)
      .set({ isPrimary: false })
      .where(eq(pageImageVariations.pageId, pageId));
    const [updatedVariation] = await db
      .update(pageImageVariations)
      .set({ isPrimary: true })
      .where(eq(pageImageVariations.id, variationId))
      .returning();
    await db
      .update(pages)
      .set({
        generatedImageUrl: variation.imageUrl,
        updatedAt: new Date(),
        ...(variation.finalPrompt !== undefined && { finalPrompt: variation.finalPrompt }),
        ...(variation.model !== undefined && { model: variation.model }),
        ...(variation.generationMs !== undefined && { generationMs: variation.generationMs }),
      })
      .where(eq(pages.id, pageId));

    return updatedVariation;
  });
}

export async function getStoryCharacterImages(storyId: string): Promise<string[]> {
  const storyPages = await withDbRetry("getStoryCharacterImages", () =>
    db.select({
      characterImageUrls: pages.characterImageUrls,
      pageNumber: pages.pageNumber
    })
      .from(pages)
      .where(eq(pages.storyId, storyId))
      .orderBy(pages.pageNumber),
  );

  // Flatten all character URLs from all pages, keeping order by page number
  const allUrls: string[] = [];
  const seenUrls = new Set<string>();

  for (const page of storyPages) {
    for (const url of page.characterImageUrls) {
      if (!seenUrls.has(url)) {
        seenUrls.add(url);
        allUrls.push(url);
      }
    }
  }

  return allUrls;
}

export async function getLastPageImage(storyId: string): Promise<string | null> {
  const allPages = await withDbRetry("getLastPageImage", () =>
    db.select({ generatedImageUrl: pages.generatedImageUrl, pageNumber: pages.pageNumber })
      .from(pages)
      .where(eq(pages.storyId, storyId))
      .orderBy(pages.pageNumber),
  );

  if (allPages.length === 0) return null;

  // Find the last page that has a generated image
  for (let i = allPages.length - 1; i >= 0; i--) {
    if (allPages[i].generatedImageUrl) {
      return allPages[i].generatedImageUrl;
    }
  }

  return null;
}

export async function getNextPageNumber(storyId: string): Promise<number> {
  const storyPages = await withDbRetry("getNextPageNumber", () =>
    db.select({ pageNumber: pages.pageNumber })
      .from(pages)
      .where(eq(pages.storyId, storyId))
      .orderBy(pages.pageNumber),
  );

  if (storyPages.length === 0) {
    return 1;
  }

  return Math.max(...storyPages.map(p => p.pageNumber)) + 1;
}

export async function deletePage(pageId: string): Promise<void> {
  await withDbRetry("deletePage", () => db.delete(pages).where(eq(pages.id, pageId)));
}

export async function deleteStory(storyId: string): Promise<void> {
  await withDbRetry("deleteStory", () => db.delete(stories).where(eq(stories.id, storyId)));
}

export async function createFeedback(data: { message: string; userId?: string }): Promise<Feedback> {
  const [entry] = await db.insert(feedback).values(data).returning();
  return entry;
}

export async function getPagesGeneratedLast24Hours(): Promise<number> {
  const since = new Date(Date.now() - 24 * 60 * 60 * 1000);
  const [row] = await withDbRetry("getPagesGeneratedLast24Hours", () =>
    db
      .select({ count: sql<number>`count(*)::int` })
      .from(pages)
      .where(and(isNotNull(pages.generatedImageUrl), gte(pages.createdAt, since))),
  );
  return row?.count ?? 0;
}
