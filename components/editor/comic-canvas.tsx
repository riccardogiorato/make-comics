"use client";

import { useEffect, useMemo, useState } from "react";
import { Check, RefreshCw, Share, Info, Loader2, Trash2, ChevronLeft, ChevronRight } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";

interface PageData {
  id: number;
  title: string;
  image: string;
  prompt: string;
  characterUploads?: string[];
  imageVariations?: PageImageVariationData[];
  style: string;
  dbId?: string;
}

interface PageImageVariationData {
  id: string;
  imageUrl: string;
  isPrimary: boolean;
  model?: string | null;
  generationMs?: number | null;
  createdAt?: string | Date;
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
  onSelectVariation?: (variationId: string) => void;
  selectingVariationId?: string | null;
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
  onSelectVariation,
  selectingVariationId,
  onNextPage,
  onPrevPage,
}: ComicCanvasProps) {
  const { toast } = useToast();
  const imageVariations = page.imageVariations ?? [];
  const hasMultipleVariations = imageVariations.length > 1;
  const primaryVariation = useMemo(
    () => imageVariations.find((variation) => variation.isPrimary),
    [imageVariations],
  );
  const [previewVariationId, setPreviewVariationId] = useState<string | null>(
    primaryVariation?.id ?? null,
  );

  useEffect(() => {
    setPreviewVariationId(primaryVariation?.id ?? imageVariations[0]?.id ?? null);
  }, [page.dbId, primaryVariation?.id, imageVariations]);

  const previewVariation =
    imageVariations.find((variation) => variation.id === previewVariationId) ??
    primaryVariation ??
    imageVariations[0];
  const previewImage = previewVariation?.imageUrl || page.image || "/placeholder.svg";
  const previewIsPrimary = previewVariation?.isPrimary ?? true;
  const canSelectPreview =
    Boolean(previewVariation && onSelectVariation && !previewIsPrimary && !selectingVariationId);

  const versionRail = hasMultipleVariations ? (
    <div className="flex flex-col gap-2 md:w-24 md:pt-1">
      <div className="flex items-center justify-between px-0.5 md:block">
        <p className="text-[10px] font-medium uppercase tracking-[0.12em] text-muted-foreground">
          Versions
        </p>
        {previewVariation && (
          <p className="text-[10px] text-muted-foreground md:mt-1">
            {imageVariations.findIndex((variation) => variation.id === previewVariation.id) + 1}/
            {imageVariations.length}
          </p>
        )}
      </div>
      <div className="flex max-w-full gap-2 overflow-x-auto pb-1 md:max-h-[min(42rem,calc(100vh-16rem))] md:flex-col md:overflow-x-hidden md:overflow-y-auto md:pr-1">
        {imageVariations.map((variation, index) => {
          const isPreviewed = previewVariation?.id === variation.id;
          const isBusy = selectingVariationId === variation.id;

          return (
            <button
              key={variation.id}
              type="button"
              onClick={() => setPreviewVariationId(variation.id)}
              className={[
                "relative h-16 w-12 shrink-0 overflow-hidden rounded-md bg-neutral-900 shadow-[0_0_0_1px_rgba(255,255,255,0.12)] outline-none transition-opacity transition-transform active:scale-[0.96] md:h-24 md:w-[4.5rem]",
                isPreviewed
                  ? "opacity-100 shadow-[0_0_0_2px_rgba(255,255,255,0.9),0_12px_30px_rgba(0,0,0,0.3)]"
                  : "opacity-65 hover:opacity-100",
              ].join(" ")}
              title={variation.isPrimary ? "Primary version" : `Preview version ${index + 1}`}
              aria-label={variation.isPrimary ? "Primary version" : `Preview version ${index + 1}`}
            >
              <img
                src={variation.imageUrl}
                alt={`Version ${index + 1}`}
                className="h-full w-full object-cover"
              />
              <span className="absolute inset-x-0 bottom-0 flex min-h-5 items-center justify-center bg-black/75 px-1 text-[9px] font-medium text-white">
                {isBusy ? (
                  <Loader2 className="h-3 w-3 animate-spin" />
                ) : variation.isPrimary ? (
                  <Check className="h-3 w-3" />
                ) : (
                  index + 1
                )}
              </span>
            </button>
          );
        })}
      </div>
    </div>
  ) : null;

  return (
    <main className="flex-1 overflow-auto p-4 md:p-8 flex items-start justify-center relative">
      {/* Dot grid background */}
      <div className="absolute inset-0 dot-grid opacity-20" />

      <div className="relative z-10 w-full max-w-[46rem]">
        <div className="flex flex-col items-center gap-4 md:grid md:grid-cols-[6rem_minmax(0,32rem)] md:items-start md:justify-center md:gap-5">
          <div className="hidden md:block">{versionRail}</div>

          <div className="w-full max-w-lg">
            <div
              className="bg-white w-full rounded-sm mx-auto group shadow-xl shadow-indigo/20"
              style={{ maxWidth: "512px" }}
            >
              <div className="w-full overflow-hidden relative aspect-3/4">
                <div className="w-full h-full bg-neutral-900">
                  <img
                    src={previewImage}
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

                {hasMultipleVariations && (
                  <div className="absolute inset-x-3 bottom-3 flex items-center justify-between gap-3">
                    <div className="rounded-md bg-black/70 px-2 py-1 text-[10px] font-medium uppercase tracking-[0.12em] text-white shadow-[0_8px_28px_rgba(0,0,0,0.3)]">
                      {previewIsPrimary ? "Primary" : "Previewing"}
                    </div>
                    {!previewIsPrimary && (
                      <Button
                        type="button"
                        size="sm"
                        className="h-8 rounded-md bg-white px-3 text-xs font-medium text-black shadow-[0_10px_32px_rgba(0,0,0,0.35)] hover:bg-white/90 active:scale-[0.96]"
                        onClick={(event) => {
                          event.stopPropagation();
                          if (previewVariation) {
                            onSelectVariation?.(previewVariation.id);
                          }
                        }}
                        disabled={!canSelectPreview}
                      >
                        {selectingVariationId === previewVariation?.id ? (
                          <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />
                        ) : (
                          <Check className="mr-1.5 h-3.5 w-3.5" />
                        )}
                        Use this version
                      </Button>
                    )}
                  </div>
                )}
              </div>
            </div>

            <div className="mt-4 md:hidden">{versionRail}</div>

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
      </div>
      </div>
    </main>
  );
}
