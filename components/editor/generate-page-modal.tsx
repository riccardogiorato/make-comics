"use client";

import { useEffect, useMemo, useState } from "react";
import { X } from "lucide-react";
import { useS3Upload } from "next-s3-upload";
import {
  ComicGenerationForm,
  type ComicGenerationSubmitData,
  type ReferenceItem,
} from "@/components/comic-form/comic-generation-form";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { useKeyboardShortcut } from "@/hooks/use-keyboard-shortcut";
import { useToast } from "@/hooks/use-toast";
import { isContentPolicyViolation } from "@/lib/utils";

interface GeneratePageModalProps {
  isOpen: boolean;
  onClose: () => void;
  onGenerate: (data: {
    prompt: string;
    characterUrls?: string[];
  }) => Promise<void>;
  pageNumber: number;
  isRedrawMode?: boolean;
  existingPrompt?: string;
  existingCharacters?: string[];
  lastPageCharacters?: string[];
  previousPageCharacters?: string[];
}

function filenameFromUrl(url: string, index: number) {
  try {
    const pathname = new URL(url).pathname;
    const filename = pathname.split("/").filter(Boolean).at(-1);
    return filename?.replace(/\.[^.]+$/, "") || `Reference ${index + 1}`;
  } catch {
    return `Reference ${index + 1}`;
  }
}

function makeExistingReferences(
  existingCharacters: string[],
  lastPageCharacters: string[],
  previousPageCharacters: string[],
): ReferenceItem[] {
  const defaultUrls: string[] = [];

  if (lastPageCharacters.length >= 2) {
    defaultUrls.push(...lastPageCharacters.slice(0, 2));
  } else {
    defaultUrls.push(...lastPageCharacters);
    for (const url of previousPageCharacters) {
      if (defaultUrls.length >= 2) break;
      if (!defaultUrls.includes(url)) {
        defaultUrls.push(url);
      }
    }
  }

  return existingCharacters.map((url, index) => ({
    id: `existing-${index}-${url}`,
    name: filenameFromUrl(url, index),
    kind: "unknown",
    status: defaultUrls.includes(url) ? "selected" : "ready",
    selected: defaultUrls.includes(url),
    source: "existing",
    url,
    previewUrl: url,
    note: "existing reference",
  }));
}

export function GeneratePageModal({
  isOpen,
  onClose,
  onGenerate,
  pageNumber,
  isRedrawMode = false,
  existingPrompt = "",
  existingCharacters = [],
  lastPageCharacters = [],
  previousPageCharacters = [],
}: GeneratePageModalProps) {
  const { toast } = useToast();
  const { uploadToS3 } = useS3Upload();
  const [prompt, setPrompt] = useState("");
  const [references, setReferences] = useState<ReferenceItem[]>([]);
  const [isGenerating, setIsGenerating] = useState(false);

  const initialReferences = useMemo(
    () => makeExistingReferences(existingCharacters, lastPageCharacters, previousPageCharacters),
    [existingCharacters, lastPageCharacters, previousPageCharacters],
  );

  useEffect(() => {
    if (!isOpen) return;

    setPrompt(isRedrawMode ? existingPrompt : "");
    setReferences(initialReferences);
    setIsGenerating(false);
  }, [existingPrompt, initialReferences, isOpen, isRedrawMode]);

  const handleGenerate = async ({ prompt, references }: ComicGenerationSubmitData) => {
    setIsGenerating(true);

    try {
      const selected = references.filter((reference) => reference.selected).slice(-2);
      const characterUrls = await Promise.all(
        selected.map(async (reference) => {
          if (reference.source === "uploaded" && reference.file) {
            const { url } = await uploadToS3(reference.file);
            return url;
          }
          return reference.url || reference.previewUrl || "";
        }),
      );

      await onGenerate({
        prompt,
        characterUrls: characterUrls.filter(Boolean).length > 0 ? characterUrls.filter(Boolean) : undefined,
      });
    } catch (error) {
      console.error("Error generating page:", error);
      const errorMessage =
        error instanceof Error ? error.message : "Failed to generate page. Please try again.";
      toast({
        title: isContentPolicyViolation(errorMessage) ? "Content policy violation" : "Generation failed",
        description: errorMessage,
        variant: "destructive",
        duration: 4000,
      });
      throw error;
    } finally {
      setIsGenerating(false);
    }
  };

  useKeyboardShortcut(
    () => {
      if (isOpen && !isGenerating && prompt.trim()) {
        void handleGenerate({
          prompt,
          style: "story-style",
          references: references.filter((reference) => reference.selected),
        });
      }
    },
    { disabled: !isOpen || isGenerating },
  );

  const handleOpenChange = (open: boolean) => {
    if (!open && isGenerating) return;
    onClose();
  };

  return (
    <Dialog open={isOpen} onOpenChange={handleOpenChange}>
      <DialogContent
        showCloseButton={false}
        className="max-w-xl rounded-xl border border-border/50 bg-background p-4 shadow-2xl sm:p-5"
      >
        <DialogHeader className="pr-10">
          <DialogTitle className="font-heading text-xl text-white">
            {isRedrawMode ? `Redraw Page ${pageNumber}` : `Generate Page ${pageNumber}`}
          </DialogTitle>
          <DialogClose
            disabled={isGenerating}
            className="absolute right-4 top-4 flex h-9 w-9 items-center justify-center rounded-full bg-white/8 text-white/80 shadow-[0_0_0_1px_rgba(255,255,255,0.08)] transition-colors hover:bg-white/12 hover:text-white disabled:pointer-events-none disabled:opacity-50"
          >
            <X className="h-4 w-4" />
            <span className="sr-only">Close</span>
          </DialogClose>
        </DialogHeader>

        <div className="mt-4">
          <ComicGenerationForm
            mode="new-page"
            title=""
            pageNumber={pageNumber}
            prompt={prompt}
            onPromptChange={setPrompt}
            references={references}
            onReferencesChange={setReferences}
            maxReferences={4}
            submitLabel={isRedrawMode ? "Redraw" : "Generate"}
            autoFocusPrompt
            disabled={isGenerating}
            isSubmitting={isGenerating}
            onSubmit={handleGenerate}
            footer={
              <p className="text-xs text-muted-foreground/70">
                {isRedrawMode
                  ? "Previous pages and selected references stay connected."
                  : `Previous page is referenced automatically. ${references.filter((reference) => reference.selected).length} selected references.`}
              </p>
            }
          />
        </div>
      </DialogContent>
    </Dialog>
  );
}
