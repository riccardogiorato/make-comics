"use client";

import { useState } from "react";
import { Github, Key } from "lucide-react";
import Link from "next/link";
import { ApiKeyModal } from "@/components/api-key-modal";

export function Navbar() {
  const [showApiModal, setShowApiModal] = useState(false);

  const handleApiKeySubmit = (key: string) => {
    localStorage.setItem("together_api_key", key);
    setShowApiModal(false);
  };

  return (
    <>
      <nav className="w-full h-14 sm:h-16 border-b border-border/50 flex items-center justify-between px-4 sm:px-6 lg:px-8 z-50 bg-background/80 backdrop-blur-md">
        <div className="flex items-center gap-1">
          <div className="w-8 h-8 sm:w-10 sm:h-10 flex items-center justify-center">
            <img
              src="/images/makecomics-logo.png"
              alt="MakeComics Logo"
              className="w-full h-full object-contain"
            />
          </div>
          <span className="text-white font-heading tracking-[0.005em] text-lg sm:text-xl">
            MakeComics
          </span>
        </div>

        <div className="flex items-center gap-2 sm:gap-3">
          <button
            onClick={() => setShowApiModal(true)}
            className="flex items-center gap-1.5 sm:gap-2 px-2 sm:px-3 py-1.5 glass-panel glass-panel-hover transition-all text-xs rounded-md"
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
            <Github className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
            <span className="text-muted-foreground text-xs sm:text-sm hidden sm:inline">
              0
            </span>
          </Link>

          <Link
            href="/signup"
            className="flex items-center gap-2 px-2.5 sm:px-3 py-1.5 glass-panel glass-panel-hover transition-all text-xs rounded-md"
          >
            <span className="text-foreground text-xs sm:text-sm tracking-[-0.01em] font-normal">
              Sign up
            </span>
          </Link>
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
