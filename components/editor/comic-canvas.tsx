"use client";

import { RefreshCw, Share, Info, Loader2, Trash2, ChevronLeft, ChevronRight } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";

interface PageData {
  id: number;
  title: string;
  image: string;
  prompt: string;
  characterUploads?: string[];
  style: string;
  dbId?: string;
}

interface ComicCanvasProps {
  page: PageData;
  pageIndex: number;
  totalPages?: number;
  isLoading?: boolean;
  isOwner?: boolean;
  onInfoClick?: () => void;
  onRedrawClick?: () => void;
  onDeletePage?: () => void;
  onNextPage?: () => void;
  onPrevPage?: () => void;
}

export function ComicCanvas({
  page,
  pageIndex,
  totalPages = 1,
  isLoading = false,
  isOwner = true,
  onInfoClick,
  onRedrawClick,
  onDeletePage,
  onNextPage,
  onPrevPage,
}: ComicCanvasProps) {
  const { toast } = useToast();

  return (
    <main className="flex-1 overflow-auto p-4 md:p-8 flex items-start justify-center relative">
      {/* Dot grid background */}
      <div className="absolute inset-0 dot-grid opacity-20" />

       <div className="relative z-10 w-full max-w-xl">
         <div
           className="bg-white w-full rounded-sm mx-auto group shadow-xl shadow-indigo/20"
           style={{ maxWidth: "512px" }}
         >
          <div className="w-full overflow-hidden relative aspect-3/4">
            <div className="w-full h-full bg-neutral-900">
              <img
                src={page.image || "/placeholder.svg"}
                alt={`Page ${page.id}`}
                className="w-full h-full object-cover opacity-90 grayscale-10 contrast-110 cursor-pointer"
                onClick={(e) => {
                  const rect = e.currentTarget.getBoundingClientRect();
                  const clickX = e.clientX - rect.left;
                  const imageWidth = rect.width;

                  if (clickX > imageWidth / 2) {
                    // Right half - next page
                    onNextPage?.();
                  } else {
                    // Left half - previous page
                    onPrevPage?.();
                  }
                }}
              />
            </div>
            <div className="scan-line opacity-30" />

            {/* Page label */}
            <div className="absolute top-2 left-2 px-1.5 py-0.5 bg-black/70 text-[9px] text-white font-mono uppercase tracking-widest border border-white/10 opacity-0 group-hover:opacity-100 transition-opacity duration-200">
              Page {page.id}
            </div>
           </div>
         </div>

          {/* Action buttons below the page image */}
         <div className="hidden md:flex items-center justify-center gap-2 mt-4">
           {onInfoClick && (
             <Button
               variant="ghost"
               className="hover:bg-secondary text-muted-foreground hover:text-white gap-2 text-xs h-9 px-3"
               onClick={onInfoClick}
             >
               <Info className="w-4 h-4" />
               <span>Info (i)</span>
             </Button>
           )}

          {isOwner && (
            <Button
              variant="ghost"
              className="hover:bg-secondary text-muted-foreground hover:text-white gap-2 text-xs h-9 px-3"
              onClick={onRedrawClick}
              disabled={isLoading}
            >
              {isLoading ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <RefreshCw className="w-4 h-4" />
              )}
              <span>{isLoading ? "Redrawing..." : "Redraw"}</span>
            </Button>
          )}

          {isOwner && totalPages > 1 && onDeletePage && (
            <Button
              variant="ghost"
              className="hover:bg-red-600/20 text-muted-foreground hover:text-red-400 gap-2 text-xs h-9 px-3"
              onClick={onDeletePage}
            >
              <Trash2 className="w-4 h-4" />
              <span>Delete</span>
            </Button>
          )}
        </div>

         <div className="flex flex-col items-center gap-3 mt-4">
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
             <Button
               variant="ghost"
               size="icon"
               className="h-6 w-6 hover:bg-secondary text-muted-foreground hover:text-white"
               onClick={onPrevPage}
               disabled={pageIndex === 0}
             >
               <ChevronLeft className="w-3 h-3" />
             </Button>
             <span>Page {pageIndex + 1} of {totalPages}</span>
             <Button
               variant="ghost"
               size="icon"
               className="h-6 w-6 hover:bg-secondary text-muted-foreground hover:text-white"
               onClick={onNextPage}
               disabled={pageIndex === totalPages - 1}
             >
               <ChevronRight className="w-3 h-3" />
             </Button>
           </div>

           {/* Mobile action buttons */}
           <div className="flex items-center gap-2 md:hidden">
             {onInfoClick && (
               <Button
                 variant="ghost"
                 className="hover:bg-secondary text-muted-foreground hover:text-white gap-2 text-xs h-9 px-3"
                 onClick={onInfoClick}
               >
                 <Info className="w-4 h-4" />
                 <span>Info (i)</span>
               </Button>
             )}

            {isOwner && (
              <Button
                variant="ghost"
                className="hover:bg-secondary text-muted-foreground hover:text-white gap-2 text-xs h-9 px-3 flex-1"
                onClick={onRedrawClick}
                disabled={isLoading}
              >
                {isLoading ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <RefreshCw className="w-4 h-4" />
                )}
                <span>{isLoading ? "Redrawing..." : "Redraw"}</span>
              </Button>
            )}

             <Button
               variant="ghost"
               className="hover:bg-secondary text-muted-foreground hover:text-white gap-2 text-xs h-9 px-3 flex-1"
               onClick={async () => {
                 const url = window.location.href;
                 if (navigator.share) {
                   try {
                     await navigator.share({
                       title: page.title || "Comic Page",
                       url: url,
                     });
                   } catch (err) {
                     // User cancelled or error, fallback to clipboard
                     try {
                       await navigator.clipboard.writeText(url);
                       toast({
                         title: "Link copied!",
                         description: "Story URL has been copied to your clipboard.",
                         duration: 2000,
                       });
                     } catch (clipboardErr) {
                       console.error("Failed to share or copy URL:", clipboardErr);
                       toast({
                         title: "Failed to share",
                         description: "Could not share or copy the URL.",
                         variant: "destructive",
                         duration: 3000,
                       });
                     }
                   }
                 } else {
                   // Fallback to clipboard for non-mobile browsers
                   try {
                     await navigator.clipboard.writeText(url);
                     toast({
                       title: "Link copied!",
                       description: "Story URL has been copied to your clipboard.",
                       duration: 2000,
                     });
                   } catch (err) {
                     console.error("Failed to copy URL:", err);
                     toast({
                       title: "Failed to copy",
                       description: "Could not copy the URL to clipboard.",
                       variant: "destructive",
                       duration: 3000,
                     });
                   }
                 }
               }}
             >
              <Share className="w-4 h-4" />
              <span>Share</span>
            </Button>
          </div>
        </div>
      </div>
    </main>
  );
}
