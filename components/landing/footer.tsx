"use client";

import { useState } from "react";
import { IMAGE_PROVIDER_LINK, IMAGE_PROVIDER_NAME } from "@/lib/utils";
import { Github, MessageSquare } from "lucide-react";
import Link from "next/link";
import { FeedbackModal } from "@/components/feedback-modal";

function XIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" className={className}>
      <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
    </svg>
  );
}

export function Footer() {
  const [showFeedback, setShowFeedback] = useState(false);

  return (
    <>
      <footer className="h-8 border-t border-border/50 bg-background flex items-center justify-between px-6 text-[10px] text-muted-foreground select-none">
        <div className="flex items-center gap-4">
          <span>
            Image generation by{" "}
            <Link
              href={IMAGE_PROVIDER_LINK}
              target="_blank"
              rel="noopener noreferrer"
              className="hover:text-white transition-colors text-white"
            >
              {IMAGE_PROVIDER_NAME}
            </Link>
          </span>
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={() => setShowFeedback(true)}
            className="flex items-center gap-1.5 px-2 py-0.5 rounded-full border border-border/50 hover:border-border hover:text-white transition-colors cursor-pointer"
          >
            <MessageSquare className="w-3 h-3" />
            Got ideas? Tell us
          </button>
          <Link
            href="https://github.com/nutlope/make-comics"
            target="_blank"
            rel="noopener noreferrer"
            className="hover:text-white transition-colors"
          >
            <Github className="w-3.5 h-3.5" />
          </Link>
          <Link
            href="https://x.com/nutlope"
            target="_blank"
            rel="noopener noreferrer"
            className="hover:text-white transition-colors"
          >
            <XIcon className="w-3.5 h-3.5" />
          </Link>
        </div>
      </footer>

      <FeedbackModal isOpen={showFeedback} onClose={() => setShowFeedback(false)} />
    </>
  );
}
