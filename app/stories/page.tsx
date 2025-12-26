"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Plus, Loader2 } from "lucide-react";
import { Navbar } from "@/components/landing/navbar";

interface Story {
  id: string;
  title: string;
  slug: string;
  createdAt: string;
  pageCount: number;
  coverImage: string | null;
}

export default function StoriesPage() {
  const router = useRouter();
  const [stories, setStories] = useState<Story[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetchStories();
  }, []);

  const fetchStories = async () => {
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

  if (isLoading) {
    return (
      <div className="min-h-screen bg-background flex flex-col overflow-hidden relative">
        <div className="fixed inset-0 overflow-hidden pointer-events-none -z-10">
          <div className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] bg-indigo/10 rounded-full blur-[120px]" />
          <div className="absolute bottom-[-10%] right-[-10%] w-[40%] h-[40%] bg-blue-900/10 rounded-full blur-[120px]" />
        </div>

        <Navbar />

        <main className="flex-1 flex items-center justify-center">
          <div className="text-center">
            <Loader2 className="w-8 h-8 animate-spin mx-auto mb-4" />
            <p className="text-muted-foreground">Loading your comic library...</p>
          </div>
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
      </div>

      <Navbar />

      <main className="flex-1 flex flex-col min-h-[calc(100vh-4rem)]">
        <div className="w-full px-4 sm:px-6 lg:px-12 xl:px-20 py-4 sm:py-6 relative">
          <div className="max-w-7xl mx-auto w-full z-10 py-8">
            {stories.length === 0 ? (
              <div className="text-center py-20">
                <div className="inline-flex items-center justify-center w-32 h-40 mb-6 bg-white/5 border-2 border-dashed border-border rounded-sm">
                  <Plus className="w-16 h-16 text-muted-foreground/50" />
                </div>
                <h2 className="text-xl font-semibold mb-2">No comics yet</h2>
                <p className="text-muted-foreground mb-6">
                  Create your first comic story to build your library!
                </p>
              </div>
            ) : (
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-4">
                {stories.map((story) => (
                  <button
                    key={story.id}
                    onClick={() => router.push(`/editor/${story.slug}`)}
                    className="group relative bg-white aspect-[3/4] p-2 shadow-2xl rounded-sm hover:shadow-indigo/20 hover:shadow-3xl transition-all duration-300 hover:scale-[1.02] hover:-translate-y-1"
                  >
                    <div className="w-full h-full bg-neutral-900 border-4 border-black overflow-hidden relative">
                      {story.coverImage ? (
                        <>
                          <img
                            src={story.coverImage}
                            alt={story.title}
                            className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-105 opacity-80"
                          />

                          {story.pageCount > 1 && (
                            <div className="absolute inset-0 pointer-events-none">
                              <div className="absolute top-0 left-0 right-0 bottom-0 translate-x-1 translate-y-1 bg-black/20" />
                              {story.pageCount > 2 && (
                                <div className="absolute top-0 left-0 right-0 bottom-0 translate-x-2 translate-y-2 bg-black/10" />
                              )}
                            </div>
                          )}

                          <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/20 to-transparent" />

                          <div className="absolute top-2 right-2 px-1.5 py-0.5 bg-black/70 text-white text-[9px] font-mono uppercase tracking-widest border border-white/10">
                            {story.pageCount}p
                          </div>

                          <div className="absolute bottom-0 left-0 right-0 p-2 text-left">
                            <h3 className="font-display text-xs text-white leading-tight line-clamp-2 mb-0.5">
                              {story.title}
                            </h3>
                            <p className="text-[9px] text-white/50 font-mono uppercase tracking-wider">
                              {new Date(story.createdAt).toLocaleDateString()}
                            </p>
                          </div>
                        </>
                      ) : (
                        <div className="w-full h-full flex items-center justify-center">
                          <div className="text-center">
                            <Loader2 className="w-6 h-6 animate-spin text-white/40 mx-auto mb-2" />
                            <p className="text-[9px] text-white/50 font-mono uppercase tracking-wider">Generating...</p>
                          </div>
                        </div>
                      )}
                    </div>
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>
      </main>
    </div>
  );
}