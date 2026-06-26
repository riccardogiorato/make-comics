"use client";

import { ComicGenerationForm } from "@/components/comic-form/comic-generation-form";
import { Navbar } from "@/components/landing/navbar";

const pageReferences = [
  {
    id: "story-hero",
    name: "Hero face",
    kind: "adult" as const,
    status: "selected" as const,
    selected: true,
    source: "existing" as const,
    gradient: "from-violet-400 via-blue-500 to-slate-950",
    note: "from page 1",
  },
  {
    id: "story-cat",
    name: "Cat pilot",
    kind: "cat" as const,
    status: "ready" as const,
    selected: false,
    source: "existing" as const,
    gradient: "from-yellow-200 via-orange-400 to-zinc-900",
    note: "optional",
  },
];

export default function DesignPage() {
  return (
    <div className="min-h-screen bg-background text-foreground">
      <Navbar />
      <main className="mx-auto flex w-full max-w-7xl flex-col gap-8 px-4 py-8 sm:px-6 lg:px-8">
        <header className="flex flex-col gap-2">
          <p className="text-xs font-medium uppercase tracking-[0.14em] text-muted-foreground">
            Design system
          </p>
          <h1 className="text-balance text-3xl font-semibold text-white">
            Comic generation form
          </h1>
          <p className="max-w-3xl text-pretty text-sm leading-relaxed text-muted-foreground">
            Shared UX surface for homepage story creation, library story creation,
            and continuing an existing comic page.
          </p>
        </header>

        <section className="grid gap-6 xl:grid-cols-2">
          <ComicGenerationForm
            mode="new-story"
            title="Create a new story"
            description="The homepage and /stories modal should use this same component with an empty prompt and optional uploaded references."
            submitLabel="Create story"
          />
          <ComicGenerationForm
            mode="new-page"
            title="Continue this comic"
            description="The story editor should reuse the same component with existing selectable references and a page-specific title."
            submitLabel="Generate page"
            pageNumber={3}
            existingReferences={pageReferences}
          />
        </section>
      </main>
    </div>
  );
}
