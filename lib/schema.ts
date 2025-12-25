import { pgTable, text, integer, timestamp, uuid, jsonb } from 'drizzle-orm/pg-core';
import { relations } from 'drizzle-orm';

// Stories table
export const stories = pgTable('stories', {
  id: uuid('id').primaryKey().defaultRandom(),
  title: text('title').notNull(),
  slug: text('slug').notNull().unique(),
  description: text('description'),
  userId: uuid('user_id').notNull(), // Required Clerk user ID
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
  generatedImageUrl: text('generated_image_url'),
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

// Types
export type Story = typeof stories.$inferSelect;
export type NewStory = typeof stories.$inferInsert;

export type Page = typeof pages.$inferSelect;
export type NewPage = typeof pages.$inferInsert;