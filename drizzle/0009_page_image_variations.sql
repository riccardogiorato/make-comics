CREATE TABLE IF NOT EXISTS "page_image_variations" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "page_id" uuid NOT NULL,
  "image_url" text NOT NULL,
  "is_primary" boolean DEFAULT false NOT NULL,
  "prompt" text,
  "final_prompt" text,
  "model" text,
  "generation_ms" integer,
  "created_at" timestamp DEFAULT now() NOT NULL
);

DO $$ BEGIN
  ALTER TABLE "page_image_variations"
    ADD CONSTRAINT "page_image_variations_page_id_pages_id_fk"
    FOREIGN KEY ("page_id") REFERENCES "pages"("id") ON DELETE cascade;
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

CREATE INDEX IF NOT EXISTS "page_image_variations_page_id_idx"
  ON "page_image_variations" ("page_id");

CREATE UNIQUE INDEX IF NOT EXISTS "page_image_variations_one_primary_idx"
ON "page_image_variations" ("page_id")
WHERE "is_primary" = true;

INSERT INTO "page_image_variations" (
  "page_id",
  "image_url",
  "is_primary",
  "prompt",
  "final_prompt",
  "model",
  "generation_ms",
  "created_at"
)
SELECT
  "pages"."id",
  "pages"."generated_image_url",
  true,
  "pages"."prompt",
  "pages"."final_prompt",
  "pages"."model",
  "pages"."generation_ms",
  "pages"."updated_at"
FROM "pages"
WHERE "pages"."generated_image_url" IS NOT NULL
  AND NOT EXISTS (
    SELECT 1
    FROM "page_image_variations"
    WHERE "page_image_variations"."page_id" = "pages"."id"
  );
