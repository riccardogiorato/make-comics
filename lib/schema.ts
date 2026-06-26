import { pgTable, text, integer, timestamp, uuid, jsonb, boolean, serial, bigint } from 'drizzle-orm/pg-core';
import { relations } from 'drizzle-orm';
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
