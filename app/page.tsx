"use client";

import { Navbar } from "@/components/landing/navbar";
import { Footer } from "@/components/landing/footer";
import { LandingHero } from "@/components/landing/hero-section";
import { ComicCreationForm } from "@/components/landing/comic-creation-form";
import { ComicPreview } from "@/components/landing/comic-preview";
import { useState, useEffect } from "react";

// Must match the order in STYLE_PAGES inside comic-preview.tsx
const PREVIEW_STYLE_IDS = ["american-modern", "manga", "retro-noir", "indie-vector"] as const;

export default function Home() {
  const [currentPage, setCurrentPage] = useState(1);
  const [autoPlay, setAutoPlay] = useState(true);
  const [style, setSelectedStyle] = useState<string>(PREVIEW_STYLE_IDS[0]);
  const [prompt, setPrompt] = useState("");
  const [characterFiles, setCharacterFiles] = useState<File[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  // When the user picks a style in the form, keep generation stable and jump the preview to that style.
  const setStyle = (s: string) => {
    const idx = PREVIEW_STYLE_IDS.indexOf(s as typeof PREVIEW_STYLE_IDS[number]);
    setSelectedStyle(s);
    if (idx !== -1) {
      setCurrentPage(idx + 1);
      setAutoPlay(false); // user took control — pause auto-play
    }
  };

  // Dot-nav in the preview also pauses auto-play
  const goToPage = (page: number) => {
    setCurrentPage(page);
    setAutoPlay(false);
  };

  // Auto-loop — only when user hasn't manually selected
  useEffect(() => {
    if (!autoPlay) return;
    const interval = setInterval(() => {
      setCurrentPage((prev) => (prev === PREVIEW_STYLE_IDS.length ? 1 : prev + 1));
    }, 6000);
    return () => clearInterval(interval);
  }, [autoPlay]);

  return (
    <div className="min-h-screen bg-background flex flex-col overflow-hidden relative">
      {/* Background gradient blurs */}
      <div className="fixed inset-0 overflow-hidden pointer-events-none -z-10">
        <div className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] bg-indigo/10 rounded-full blur-[120px]" />
        <div className="absolute bottom-[-10%] right-[-10%] w-[40%] h-[40%] bg-blue-900/10 rounded-full blur-[120px]" />
      </div>

      <Navbar />

      <main className="flex-1 flex flex-col lg:flex-row min-h-[calc(100vh-6rem)]">
        {/* Left: Controls & Input */}
        <div className="w-full lg:w-1/2 flex flex-col justify-center px-4 sm:px-6 lg:px-12 xl:px-20 py-4 sm:py-6 relative">
          <div className="max-w-xl mx-auto lg:mx-0 w-full z-10">
            <LandingHero />

            <div className="space-y-4 sm:space-y-5 mt-4 sm:mt-5">
              <div className="opacity-0 animate-fade-in-up animation-delay-100">
                <ComicCreationForm
                  prompt={prompt}
                  setPrompt={setPrompt}
                  style={style}
                  setStyle={setStyle}
                  characterFiles={characterFiles}
                  setCharacterFiles={setCharacterFiles}
                  isLoading={isLoading}
                  setIsLoading={setIsLoading}
                />
              </div>
            </div>
          </div>
        </div>

        {/* Right: Visual Preview / Canvas */}
        <ComicPreview currentPage={currentPage} goToPage={goToPage} />
      </main>

      <Footer />
    </div>
  );
}
