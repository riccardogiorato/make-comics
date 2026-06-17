"use client";

import { useState, useEffect } from "react";
import { usePathname } from "next/navigation";
import { Key, BookOpen, User, Plus } from "lucide-react";

function GithubIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" className={className}>
      <path fillRule="evenodd" clipRule="evenodd" d="M12 2C6.477 2 2 6.484 2 12.017c0 4.425 2.865 8.18 6.839 9.504.5.092.682-.217.682-.483 0-.237-.008-.868-.013-1.703-2.782.605-3.369-1.343-3.369-1.343-.454-1.158-1.11-1.466-1.11-1.466-.908-.62.069-.608.069-.608 1.003.07 1.531 1.032 1.531 1.032.892 1.53 2.341 1.088 2.91.832.092-.647.35-1.088.636-1.338-2.22-.253-4.555-1.113-4.555-4.951 0-1.093.39-1.988 1.029-2.688-.103-.253-.446-1.272.098-2.65 0 0 .84-.27 2.75 1.026A9.564 9.564 0 0112 6.844c.85.004 1.705.115 2.504.337 1.909-1.296 2.747-1.027 2.747-1.027.546 1.379.202 2.398.1 2.651.64.7 1.028 1.595 1.028 2.688 0 3.848-2.339 4.695-4.566 4.942.359.31.678.921.678 1.856 0 1.338-.012 2.419-.012 2.747 0 .268.18.58.688.482A10.019 10.019 0 0022 12.017C22 6.484 17.522 2 12 2z" />
    </svg>
  );
}
import Link from "next/link";
import { ApiKeyModal } from "@/components/api-key-modal";
import { SignInButton, Show, useAuth } from "@clerk/nextjs";
import { useApiKey } from "@/hooks/use-api-key";

export function Navbar() {
  const [showApiModal, setShowApiModal] = useState(false);
  const [stars, setStars] = useState<string>("-");

  const { isLoaded } = useAuth();
  const pathname = usePathname();
  const [, setApiKey] = useApiKey();

  const handleApiKeySubmit = (key: string) => {
    setApiKey(key);
    setShowApiModal(false);
  };

  useEffect(() => {
    async function fetchStars() {
      try {
        const res = await fetch(
          "https://api.github.com/repos/nutlope/make-comics",
          {
            headers: {
              Accept: "application/vnd.github+json",
              "User-Agent": "make-comics-app",
            },
          }
        );
        if (!res.ok) return;
        const data = await res.json();
        setStars(
          typeof data.stargazers_count === "number"
            ? data.stargazers_count.toLocaleString()
            : "-"
        );
      } catch {
        setStars("-");
      }
    }
    fetchStars();
  }, []);

  const isOnStoriesPage = pathname === "/stories";

  if (!isLoaded)
    return <div className="h-14 sm:h-16 w-full  border-b border-border/50" />;

  return (
    <>
      <nav className={`w-full h-14 sm:h-16 border-b border-border/50 flex items-center justify-between px-4 sm:px-6 lg:px-8 z-50 bg-background/80 backdrop-blur-md ${pathname === "/stories" ? "sticky top-0" : ""}`}>
        <Link
          href="/"
          className="flex items-center gap-1 hover:opacity-80 transition-opacity"
        >
          <div className="w-8 h-8 sm:w-10 sm:h-10 flex items-center justify-center">
            <img
              src="/images/makecomics-logo.svg"
              alt="MakeComics Logo"
              className="w-full h-full object-contain"
            />
          </div>
          <span className="text-white font-heading tracking-[0.005em] text-lg sm:text-xl">
            MakeComics
          </span>
        </Link>

        <div className="flex items-center gap-2 sm:gap-3">
          <button
            onClick={() => setShowApiModal(true)}
            className="flex items-center gap-1.5 sm:gap-2 px-2 sm:px-3 py-1.5 glass-panel glass-panel-hover transition-all text-xs rounded-md cursor-pointer"
          >
            <Key className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
            <span className="text-muted-foreground text-xs sm:text-sm hidden sm:inline tracking-tight">
              API Key
            </span>
          </button>

          <Link
            href="https://github.com/nutlope/make-comics"
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-1.5 sm:gap-2 px-2 sm:px-3 py-1.5 glass-panel glass-panel-hover transition-all text-xs rounded-md"
          >
            <GithubIcon className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
            <span className="text-muted-foreground text-xs sm:text-sm hidden sm:inline">
              {stars}
            </span>
          </Link>

          <Show when="signed-out">
            <SignInButton mode="modal">
              <button className="flex items-center gap-1.5 sm:gap-2 px-2 sm:px-3 py-1.5 glass-panel glass-panel-hover transition-all text-xs rounded-md cursor-pointer">
                <span className="text-muted-foreground text-xs sm:text-sm hidden sm:inline tracking-tight">
                  Sign In
                </span>
              </button>
            </SignInButton>
          </Show>
          <Show when="signed-in">
            {isOnStoriesPage ? (
              <Link href="/">
                <button className="flex items-center gap-1.5 sm:gap-2 px-2 sm:px-3 py-1.5 bg-white hover:bg-neutral-200 text-black transition-all text-xs rounded-md cursor-pointer font-medium">
                  <Plus className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
                  <span className="text-black text-xs sm:text-sm hidden sm:inline tracking-tight">
                    Create New
                  </span>
                </button>
              </Link>
            ) : (
              <Link href="/stories">
                <button className="flex items-center gap-1.5 sm:gap-2 px-2 sm:px-3 py-1.5 glass-panel glass-panel-hover transition-all text-xs rounded-md cursor-pointer">
                  <User className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
                  <span className="text-muted-foreground text-xs sm:text-sm hidden sm:inline tracking-tight">
                    My Stories
                  </span>
                </button>
              </Link>
            )}
          </Show>
        </div>
      </nav>

      <ApiKeyModal
        isOpen={showApiModal}
        onClose={() => setShowApiModal(false)}
        onSubmit={handleApiKeySubmit}
      />
    </>
  );
}
