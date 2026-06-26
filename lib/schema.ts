import { pgTable, text, integer, timestamp, uuid, jsonb, boolean, serial, index, uniqueIndex } from 'drizzle-orm/pg-core';
import { relations, sql } from 'drizzle-orm';
import type { StoredCharacterReference } from './reference-analysis';

// Stories table
export const stories = pgTable('stories', {
  id: uuid('id').primaryKey().defaultRandom(),
  title: text('title').notNull(),
  slug: text('slug').notNull().unique(),
  description: text('description'),
  style: text('style').default('noir').notNull(),
  userId: text('user_id').notNull(),
  usesOwnApiKey: boolean('uses_own_api_key').default(false),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});

// Pages table
export const pages = pgTable('pages', {
  id: uuid('id').primaryKey().defaultRandom(),
  storyId: uuid('story_id').references(() => stories.id, { onDelete: 'cascade' }).notNull(),
  pageNumber: integer('page_number').notNull(),
  prompt: text('prompt').notNull(),
  characterImageUrls: jsonb('character_image_urls').$type<string[]>().default([]).notNull(),
  // Legacy analysis payload kept to avoid dropping existing production data.
  characterAnalysis: jsonb('character_analysis').$type<StoredCharacterReference[]>().default([]).notNull(),
  characterReferences: jsonb('character_references').$type<StoredCharacterReference[]>().default([]).notNull(),
  generatedImageUrl: text('generated_image_url'),
  // #1 moderation rewrite: non-null when the original prompt was rewritten
  finalPrompt: text('final_prompt'),
  // #4 telemetry
  model: text('model'),
  generationMs: integer('generation_ms'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});

export const pageImageVariations = pgTable('page_image_variations', {
  id: uuid('id').primaryKey().defaultRandom(),
  pageId: uuid('page_id').references(() => pages.id, { onDelete: 'cascade' }).notNull(),
  imageUrl: text('image_url').notNull(),
  isPrimary: boolean('is_primary').default(false).notNull(),
  prompt: text('prompt'),
  finalPrompt: text('final_prompt'),
  model: text('model'),
  generationMs: integer('generation_ms'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
}, (table) => [
  index('page_image_variations_page_id_idx').on(table.pageId),
  uniqueIndex('page_image_variations_one_primary_idx')
    .on(table.pageId)
    .where(sql`${table.isPrimary} = true`),
]);

// Relations
export const storiesRelations = relations(stories, ({ many }) => ({
  pages: many(pages),
}));

export const pagesRelations = relations(pages, ({ one }) => ({
  story: one(stories, {
    fields: [pages.storyId],
    references: [stories.id],
  }),
}));

export const pageImageVariationsRelations = relations(pageImageVariations, ({ one }) => ({
  page: one(pages, {
    fields: [pageImageVariations.pageId],
    references: [pages.id],
  }),
}));

// Feedback table
export const feedback = pgTable('feedback', {
  id: serial('id').primaryKey(),
  message: text('message').notNull(),
  userId: text('user_id'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

// Types
export type Feedback = typeof feedback.$inferSelect;
export type NewFeedback = typeof feedback.$inferInsert;

export type Story = typeof stories.$inferSelect;
export type NewStory = typeof stories.$inferInsert;

export type Page = typeof pages.$inferSelect;
export type NewPage = typeof pages.$inferInsert;
export type PageImageVariation = typeof pageImageVariations.$inferSelect;
export type NewPageImageVariation = typeof pageImageVariations.$inferInsert;
export type PageWithVariations = Page & { imageVariations: PageImageVariation[] };
