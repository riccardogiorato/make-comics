ALTER TABLE "pages" ADD COLUMN "character_references" jsonb DEFAULT '[]'::jsonb NOT NULL;
