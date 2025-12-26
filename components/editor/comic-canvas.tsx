"use client";

import { RefreshCw, Download } from "lucide-react";
import { Button } from "@/components/ui/button";

interface PageData {
  id: number;
  title: string;
  image: string;
  prompt: string;
  characterUpload?: string;
  style: string;
}

interface ComicCanvasProps {
  page: PageData;
}

export function ComicCanvas({ page }: ComicCanvasProps) {
  return (
    <main className="flex-1 overflow-auto p-4 md:p-8 flex items-start justify-center relative">
      {/* Dot grid background */}
      <div className="absolute inset-0 dot-grid opacity-20" />

      <div className="relative z-10 w-full max-w-xl">
        <div
          className="bg-white w-full p-3 shadow-2xl rounded-sm mx-auto group"
          style={{ maxWidth: "512px" }}
        >
          <div className="w-full border-4 border-black overflow-hidden relative aspect-3/4">
            <div className="w-full h-full bg-neutral-900">
              <img
                src={page.image || "/placeholder.svg"}
                alt={`Page ${page.id}`}
                className="w-full h-full object-cover opacity-90 grayscale-10 contrast-110"
              />
            </div>
            <div className="scan-line opacity-30" />

            {/* Page label */}
            <div className="absolute top-2 left-2 px-1.5 py-0.5 bg-black/70 text-[9px] text-white font-mono uppercase tracking-widest border border-white/10 opacity-0 group-hover:opacity-100 transition-opacity duration-200">
              Page {page.id}
            </div>
          </div>
        </div>

        <div className="flex flex-col items-center gap-3 mt-4">
          {/* <div className="text-xs text-muted-foreground">Page {page.id}</div> */}

          {/* Mobile action buttons */}
          <div className="flex items-center gap-2 md:hidden">
            <Button
              variant="ghost"
              className="hover:bg-secondary text-muted-foreground hover:text-white gap-2 text-xs h-9 px-3 flex-1"
            >
              <RefreshCw className="w-4 h-4" />
              <span>Redraw</span>
            </Button>

            <Button
              variant="ghost"
              className="hover:bg-secondary text-muted-foreground hover:text-white gap-2 text-xs h-9 px-3 flex-1"
            >
              <Download className="w-4 h-4" />
              <span>Download</span>
            </Button>
          </div>
        </div>
      </div>
    </main>
  );
}
