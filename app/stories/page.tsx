"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Plus, Loader2 } from "lucide-react";
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
             {stories.length === 0 ? (
               <div className="opacity-0 animate-fade-in-up animation-delay-100 text-center py-20">
                 <div className="relative mb-8">
                   <div className="inline-flex items-center justify-center w-40 h-52 glass-panel border-2 border-dashed border-border rounded-lg hover:border-indigo/30 hover:shadow-indigo/10 hover:shadow-lg transition-all duration-300 group">
                     <Plus className="w-20 h-20 text-muted-foreground/50 group-hover:text-indigo/40 transition-colors duration-300" />
                   </div>
                   <div className="absolute -inset-1 bg-gradient-to-r from-indigo/20 to-emerald/20 rounded-lg blur opacity-0 group-hover:opacity-100 transition-opacity duration-300 -z-10" />
                 </div>
                 <h2 className="text-4xl font-heading font-semibold mb-4 text-foreground tracking-tight">
                   Your Comic Library Awaits
                 </h2>
                 <p className="text-muted-foreground mb-10 max-w-lg mx-auto leading-relaxed text-lg">
                   Start crafting your first visual story. Every great comic begins with a single panel.
                 </p>
                 <Button
                   onClick={() => router.push('/')}
                   className="glass-panel glass-panel-hover px-8 py-4 text-base font-medium hover:scale-105 transition-all duration-300 hover:shadow-indigo/20 hover:shadow-lg"
                 >
                   <Plus className="w-5 h-5 mr-3" />
                   Create Your First Comic
                 </Button>
               </div>
             ) : (
               <>
                 <div className="opacity-0 animate-fade-in-up animation-delay-100 mb-12">
                   <h1 className="text-4xl sm:text-5xl lg:text-6xl font-heading font-semibold text-foreground mb-4 tracking-tight">
                     Your Comic Library
                   </h1>
                   <p className="text-muted-foreground text-base sm:text-lg max-w-3xl leading-relaxed">
                     Browse and continue your comic creations. Each story is a unique visual narrative waiting to unfold.
                   </p>
                 </div>

                 <div className="opacity-0 animate-fade-in-up animation-delay-200 grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-4 sm:gap-6">
                   {stories.map((story, index) => (
                     <button
                       key={story.id}
                       onClick={() => router.push(`/editor/${story.slug}`)}
                        className={`opacity-0 animate-fade-in-up group relative glass-panel p-3 rounded-lg hover:shadow-indigo/20 hover:shadow-2xl transition-all duration-500 hover:scale-[1.05] hover:-translate-y-2 border border-border/50 hover:border-indigo/30 hover:bg-white/[0.02] backdrop-blur-sm focus:outline-none`}
                       style={{ animationDelay: `${200 + index * 100}ms` }}
                     >
                       <div className="w-full h-full bg-neutral-900 border-4 border-black overflow-hidden relative group-hover:border-indigo/30 transition-colors duration-300">
                         {story.coverImage ? (
                           <>
                             <img
                               src={story.coverImage}
                               alt={story.title}
                               className="w-full h-full object-cover transition-all duration-500 group-hover:scale-105 group-hover:brightness-110 opacity-90"
                             />

                             {story.pageCount > 1 && (
                               <div className="absolute inset-0 pointer-events-none">
                                 <div className="absolute top-0 left-0 right-0 bottom-0 translate-x-1 translate-y-1 bg-black/20 group-hover:bg-indigo/10 transition-colors duration-300" />
                                 {story.pageCount > 2 && (
                                   <div className="absolute top-0 left-0 right-0 bottom-0 translate-x-2 translate-y-2 bg-black/10 group-hover:bg-indigo/5 transition-colors duration-300" />
                                 )}
                               </div>
                             )}

                             <div className="absolute inset-0 bg-gradient-to-t from-black/95 via-black/30 to-transparent group-hover:from-black/90 transition-all duration-300" />

                             {/* Subtle glow effect on hover */}
                             <div className="absolute inset-0 opacity-0 group-hover:opacity-20 bg-gradient-to-r from-indigo/20 via-transparent to-emerald/20 transition-opacity duration-500" />

                              <div className="absolute top-2 right-2 px-1.5 py-0.5 bg-black/80 text-white text-[9px] font-mono uppercase tracking-widest border border-white/20 group-hover:bg-indigo/80 group-hover:border-indigo/40 transition-colors duration-300">
                                {COMIC_STYLES.find(s => s.id === story.style)?.name.toUpperCase() || story.style.toUpperCase()}
                              </div>

                             <div className="absolute bottom-0 left-0 right-0 p-3 text-left">
                                <h3 className="font-display text-sm text-white leading-tight line-clamp-1 mb-1 group-hover:text-indigo-100 transition-colors duration-300">
                                  {story.title}
                                </h3>
                               <p className="text-[10px] text-white/60 font-mono uppercase tracking-wider group-hover:text-white/80 transition-colors duration-300">
                                 {new Date(story.createdAt).toLocaleDateString()}
                               </p>
                             </div>
                           </>
                         ) : (
                           <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-neutral-800 to-neutral-900">
                             <div className="text-center">
                               <Loader2 className="w-8 h-8 animate-spin text-indigo/60 mx-auto mb-3" />
                               <p className="text-xs text-white/70 font-mono uppercase tracking-wider">Generating...</p>
                             </div>
                           </div>
                         )}
                       </div>
                     </button>
                   ))}
                 </div>
               </>
             )}
           </div>
        </div>
      </main>
    </div>
  );
}