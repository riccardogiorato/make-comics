"use client";

import { useState, useEffect, useMemo } from "react";
import { useRouter } from "next/navigation";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import {
  Plus,
  Loader2,
  Search,
  SlidersHorizontal,
  Pencil,
  Download,
  Trash2,
  BookOpen,
} from "lucide-react";
import { Navbar } from "@/components/landing/navbar";
import { StoryLoader } from "@/components/ui/story-loader";
import { COMIC_STYLES } from "@/lib/constants";

interface Story {
  id: string;
  title: string;
  slug: string;
  style: string;
  createdAt: string;
  pageCount: number;
  coverImage: string | null;
  lastUpdated?: string;
}

type SortBy = "updated" | "created" | "title";

type StyleFilter = "all" | string;

const SORT_OPTIONS: { value: SortBy; label: string }[] = [
  { value: "updated", label: "Last Updated" },
  { value: "created", label: "Newest Created" },
  { value: "title", label: "By Title" },
];

function getStyleFilterOptions(stories: Story[]) {
  const present = new Set(stories.map((s) => s.style));
  return [
    { value: "all", label: "All Styles" },
    ...Array.from(present)
      .sort()
      .map((styleId) => ({
        value: styleId,
        label: getStyleName(styleId),
      })),
  ];
}

function getStyleName(styleId: string) {
  return COMIC_STYLES.find((s) => s.id === styleId)?.name ?? styleId;
}

function timeAgo(date: string | Date) {
  const parsed = typeof date === "string" ? new Date(date) : date;
  const seconds = Math.floor(
    (new Date().getTime() - parsed.getTime()) / 1000
  );

  const intervals = [
    { label: "year", seconds: 31536000 },
    { label: "month", seconds: 2592000 },
    { label: "week", seconds: 604800 },
    { label: "day", seconds: 86400 },
    { label: "hour", seconds: 3600 },
    { label: "minute", seconds: 60 },
  ];

  for (const interval of intervals) {
    const count = Math.floor(seconds / interval.seconds);
    if (count >= 1) {
      return `${count} ${interval.label}${count > 1 ? "s" : ""} ago`;
    }
  }

  return "Just now";
}

function handleCardKeyDown(
  event: React.KeyboardEvent<HTMLDivElement>,
  slug: string,
  router: ReturnType<typeof useRouter>
) {
  if (event.key === "Enter" || event.key === " ") {
    event.preventDefault();
    router.push(`/story/${slug}`);
  }
}

export default function StoriesPage() {
  const router = useRouter();
  const { toast } = useToast();

  const [stories, setStories] = useState<Story[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [searchQuery, setSearchQuery] = useState("");
  const [styleFilter, setStyleFilter] = useState<StyleFilter>("all");
  const [sortBy, setSortBy] = useState<SortBy>("updated");

  useEffect(() => {
    fetchStories();
  }, []);

  const fetchStories = async () => {
    setError(null);
    setIsLoading(true);
    try {
      const response = await fetch("/api/stories");
      if (!response.ok) {
        throw new Error("Failed to fetch stories");
      }
      const data = await response.json();
      setStories(data.stories);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load stories");
    } finally {
      setIsLoading(false);
    }
  };

  const handleDelete = async (story: Story) => {
    if (!confirm(`Delete "${story.title}"? This cannot be undone.`)) return;

    try {
      const response = await fetch(`/api/stories/${story.slug}`, {
        method: "DELETE",
      });

      if (!response.ok) {
        throw new Error("Failed to delete story");
      }

      setStories((prev) => prev.filter((s) => s.id !== story.id));
      toast({
        title: "Story deleted",
        description: `"${story.title}" has been removed from your library.`,
      });
    } catch (err) {
      toast({
        title: "Error",
        description:
          err instanceof Error ? err.message : "Failed to delete story",
        variant: "destructive",
      });
    }
  };

  

  const styleOptions = useMemo(
    () => getStyleFilterOptions(stories),
    [stories]
  );

  const filteredAndSortedStories = useMemo(() => {
    let result = [...stories];

    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase();
      result = result.filter((story) =>
        story.title.toLowerCase().includes(query)
      );
    }

    if (styleFilter !== "all") {
      result = result.filter((story) => story.style === styleFilter);
    }

    result.sort((a, b) => {
      if (sortBy === "title") {
        return a.title.localeCompare(b.title);
      }

      const aTime =
        sortBy === "updated"
          ? new Date(a.lastUpdated ?? a.createdAt).getTime()
          : new Date(a.createdAt).getTime();
      const bTime =
        sortBy === "updated"
          ? new Date(b.lastUpdated ?? b.createdAt).getTime()
          : new Date(b.createdAt).getTime();
      return bTime - aTime;
    });

    return result;
  }, [stories, searchQuery, styleFilter, sortBy]);

  if (isLoading) {
    return (
      <div className="min-h-screen bg-background flex flex-col overflow-hidden relative">
        <div className="fixed inset-0 overflow-hidden pointer-events-none -z-10">
          <div className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] bg-indigo/10 rounded-full blur-[120px]" />
          <div className="absolute bottom-[-10%] right-[-10%] w-[40%] h-[40%] bg-blue-900/10 rounded-full blur-[120px]" />
        </div>

        <Navbar />

        <main className="flex-1 flex items-center justify-center">
          <StoryLoader text="Loading your comic library..." />
        </main>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-background flex flex-col overflow-hidden relative">
        <div className="fixed inset-0 overflow-hidden pointer-events-none -z-10">
          <div className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] bg-indigo/10 rounded-full blur-[120px]" />
          <div className="absolute bottom-[-10%] right-[-10%] w-[40%] h-[40%] bg-blue-900/10 rounded-full blur-[120px]" />
        </div>

        <Navbar />

        <main className="flex-1 flex items-center justify-center">
          <div className="text-center">
            <p className="text-destructive mb-4">{error}</p>
            <Button onClick={fetchStories}>Try Again</Button>
          </div>
        </main>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background flex flex-col overflow-hidden relative">
      <div className="fixed inset-0 overflow-hidden pointer-events-none -z-10">
        <div className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] bg-indigo/10 rounded-full blur-[120px]" />
        <div className="absolute bottom-[-10%] right-[-10%] w-[40%] h-[40%] bg-blue-900/10 rounded-full blur-[120px]" />
        <div className="absolute top-[20%] right-[20%] w-[30%] h-[30%] bg-emerald/5 rounded-full blur-[100px]" />
        <div className="absolute bottom-[30%] left-[15%] w-[25%] h-[25%] bg-purple-500/5 rounded-full blur-[80px]" />
      </div>

      <Navbar />

      <main className="flex-1 flex flex-col min-h-[calc(100vh-4rem)]">
        <div className="w-full px-4 sm:px-6 lg:px-12 xl:px-20 py-4 sm:py-6 relative">
          <div className="max-w-7xl mx-auto w-full z-10 py-8">
            <div className="opacity-0 animate-fade-in-up animation-delay-100 mb-10">
              <div className="mb-4">
                <h1 className="text-4xl sm:text-5xl lg:text-6xl font-heading font-semibold text-foreground mb-3 tracking-tight">
                  Your Comic Library
                </h1>
                <p className="text-foreground/80 text-base sm:text-lg max-w-3xl leading-relaxed">
                  Browse, manage, and continue your comic creations. Every story
                  is a unique visual narrative waiting to unfold.
                </p>
              </div>

              <div className="flex flex-col sm:flex-row gap-3 mt-6">
                <div className="relative flex-1 min-w-0">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground pointer-events-none" />
                  <Input
                    type="search"
                    placeholder="Search comics by title..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="pl-10 h-10 bg-input/30"
                  />
                </div>
                <div className="flex gap-3">
                  <Select
                    value={styleFilter}
                    onValueChange={(v) => setStyleFilter(v as StyleFilter)}
                  >
                    <SelectTrigger className="h-10 min-w-44 gap-2 bg-input/30">
                      <SlidersHorizontal className="w-4 h-4 text-muted-foreground" />
                      <SelectValue placeholder="Filter by style" />
                    </SelectTrigger>
                    <SelectContent>
                      {styleOptions.map((option) => (
                        <SelectItem key={option.value} value={option.value}>
                          {option.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>

                  <Select value={sortBy} onValueChange={(v) => setSortBy(v as SortBy)}>
                    <SelectTrigger className="h-10 min-w-40 gap-2 bg-input/30">
                      <BookOpen className="w-4 h-4 text-muted-foreground" />
                      <SelectValue placeholder="Sort by" />
                    </SelectTrigger>
                    <SelectContent>
                      {SORT_OPTIONS.map((option) => (
                        <SelectItem key={option.value} value={option.value}>
                          {option.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              {filteredAndSortedStories.length === 0 && (
                <div className="text-center py-14">
                  <p className="text-muted-foreground text-lg">
                    No comics match your search.
                  </p>
                  <Button
                    variant="ghost"
                    onClick={() => {
                      setSearchQuery("");
                      setStyleFilter("all");
                    }}
                    className="mt-2"
                  >
                    Clear filters
                  </Button>
                </div>
              )}
            </div>

            {filteredAndSortedStories.length > 0 && (
              <div className="opacity-0 animate-fade-in-up animation-delay-200 grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-4 sm:gap-6">
                <button
                  onClick={() => router.push("/")}
                  className="opacity-0 animate-fade-in-up group relative glass-panel p-3 rounded-lg hover:shadow-indigo/20 hover:shadow-2xl transition-all duration-300 border-2 border-dashed border-border/60 hover:border-indigo/40 focus-visible:ring-2 focus-visible:ring-indigo/50 focus-visible:outline-none"
                >
                  <div className="w-full bg-neutral-900/50 aspect-[3/4] flex flex-col items-center justify-center gap-4 transition-colors duration-300">
                    <div className="w-16 h-16 rounded-full glass-panel flex items-center justify-center group-hover:bg-indigo/20 transition-colors duration-300">
                      <Plus className="w-8 h-8 text-muted-foreground/60 group-hover:text-indigo transition-colors duration-300" />
                    </div>
                    <span className="text-sm text-muted-foreground group-hover:text-foreground transition-colors duration-300 font-medium text-center px-2">
                      Create a New Comic
                    </span>
                  </div>
                </button>

                {filteredAndSortedStories.map((story, index) => (
                  <div
                    key={story.id}
                    role="button"
                    tabIndex={0}
                    aria-label={`Open ${story.title}`}
                    onClick={() => router.push(`/story/${story.slug}`)}
                    onKeyDown={(e) => handleCardKeyDown(e, story.slug, router)}
                    className="opacity-0 animate-fade-in-up group relative glass-panel p-3 rounded-lg hover:shadow-indigo/20 hover:shadow-2xl transition-all duration-500 border border-border/50 backdrop-blur-sm focus-visible:ring-2 focus-visible:ring-indigo/50 focus-visible:outline-none cursor-pointer"
                    style={{ animationDelay: `${200 + index * 80}ms` }}
                  >
                    <div className="w-full aspect-[3/4] bg-neutral-900 border-4 border-black overflow-hidden relative transition-colors duration-300">
                      <CoverArea story={story} />

                      <div className="absolute top-2 right-2 px-1.5 py-0.5 bg-black/70 text-white text-[9px] font-mono uppercase tracking-widest border border-white/15 group-hover:bg-indigo/80 group-hover:border-indigo/40 transition-colors duration-300">
                        {getStyleName(story.style).toUpperCase()}
                      </div>

                      <div
                        className="absolute top-2 left-2 hidden md:flex gap-1.5 opacity-0 group-hover:opacity-100"
                        onClick={(e) => e.stopPropagation()}
                        role="toolbar"
                        aria-label={`Actions for ${story.title}`}
                      >
                        <a
                          href={`/api/download-pdf?storySlug=${story.slug}`}
                          download
                          target="_blank"
                          rel="noopener noreferrer"
                          aria-label="Download PDF"
                          className="glass-panel glass-panel-hover rounded-md p-1.5 text-white/80 hover:text-white hover:border-indigo/40 transition-all duration-200"
                        >
                          <Download className="w-3.5 h-3.5" />
                        </a>
                        
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          aria-label="Continue editing"
                          onClick={() => router.push(`/story/${story.slug}`)}
                          className="glass-panel glass-panel-hover h-7 w-7 text-white/80 hover:text-white hover:border-indigo/40 hover:bg-transparent"
                        >
                          <Pencil className="w-3.5 h-3.5" />
                        </Button>
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          aria-label="Delete"
                          onClick={() => handleDelete(story)}
                          className="glass-panel glass-panel-hover h-7 w-7 text-white/80 hover:text-destructive hover:border-destructive/40 hover:bg-transparent"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </Button>
                      </div>

                      <div className="absolute bottom-0 left-0 right-0 p-3 text-left">
                        <h3 className="font-heading text-sm text-white line-clamp-2 mb-1.5 group-hover:text-indigo-100 transition-colors duration-300 font-semibold leading-tight">
                          {story.title}
                        </h3>
                        <div className="flex items-center justify-between text-[10px] text-white/60 font-mono uppercase tracking-wider">
                          <span className="group-hover:text-white/80 transition-colors duration-300">
                            {timeAgo(story.lastUpdated ?? story.createdAt)}
                          </span>
                          <span className="group-hover:text-white/80 transition-colors duration-300">
                            {story.pageCount} page
                            {story.pageCount === 1 ? "" : "s"}
                          </span>
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </main>
    </div>
  );
}

function CoverArea({ story }: { story: Story }) {
  const [hasError, setHasError] = useState(false);
  const isGenerating =
    !story.coverImage || story.coverImage.startsWith("/placeholder");

  if (isGenerating) {
    return (
      <div className="absolute inset-0 bg-linear-to-br from-neutral-800 via-neutral-900 to-neutral-950 animate-pulse flex flex-col items-center justify-center gap-3">
        <Loader2 className="w-8 h-8 animate-spin text-indigo/50" />
        <p className="text-[10px] text-white/60 font-mono uppercase tracking-wider text-center px-4">
          {story.pageCount > 0 ? "Generating first page" : "Waiting for cover"}
        </p>
        <div className="absolute inset-0 bg-linear-to-b from-transparent via-white/[0.02] to-transparent opacity-50" />
      </div>
    );
  }

  return (
    <>
      <img
        src={story.coverImage!}
        alt={story.title}
        loading="lazy"
        decoding="async"
        onError={() => setHasError(true)}
        className={cn(
          "w-full h-full object-cover transition-all duration-500 group-hover:scale-105 group-hover:brightness-110",
          hasError && "hidden"
        )}
      />

      {hasError && (
        <div className="absolute inset-0 bg-linear-to-br from-neutral-800 to-neutral-900 flex flex-col items-center justify-center gap-2 px-4">
          <BookOpen className="w-10 h-10 text-white/30" />
          <p className="text-[10px] text-white/50 font-mono uppercase tracking-wider text-center">
            Cover unavailable
          </p>
        </div>
      )}

      <div className="absolute inset-0 bg-linear-to-t from-black/95 via-black/50 to-transparent" />
    </>
  );
}
