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
import {
  toStoredCharacterReference,
  type ReferenceAnalysisSummary,
  type StoredCharacterReference,
} from "@/lib/reference-analysis";
import { isContentPolicyViolation } from "@/lib/utils";

type ExistingCharacterReference = Partial<StoredCharacterReference> & { url: string };

interface GeneratePageModalProps {
  isOpen: boolean;
  onClose: () => void;
  onGenerate: (data: {
    prompt: string;
    characterUrls?: string[];
    characterReferences?: StoredCharacterReference[];
  }) => Promise<void>;
  pageNumber: number;
  isRedrawMode?: boolean;
  existingPrompt?: string;
  existingCharacters?: ExistingCharacterReference[];
  lastPageCharacters?: ExistingCharacterReference[];
  previousPageCharacters?: ExistingCharacterReference[];
  apiKey?: string;
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
  existingCharacters: ExistingCharacterReference[],
  lastPageCharacters: ExistingCharacterReference[],
  previousPageCharacters: ExistingCharacterReference[],
): ReferenceItem[] {
  const defaultUrls: string[] = [];

  if (lastPageCharacters.length >= 2) {
    defaultUrls.push(...lastPageCharacters.slice(0, 2).map((reference) => reference.url));
  } else {
    defaultUrls.push(...lastPageCharacters.map((reference) => reference.url));
    for (const reference of previousPageCharacters) {
      if (defaultUrls.length >= 2) break;
      if (!defaultUrls.includes(reference.url)) {
        defaultUrls.push(reference.url);
      }
    }
  }

  return existingCharacters.map((reference, index) => ({
    id: `existing-${index}-${reference.url}`,
    name: filenameFromUrl(reference.url, index),
    kind: reference.kind || "unknown",
    status: defaultUrls.includes(reference.url) ? "selected" : reference.severity === "warning" ? "warning" : "ready",
    selected: defaultUrls.includes(reference.url),
    source: "existing",
    url: reference.url,
    previewUrl: reference.url,
    note: reference.severity === "warning" ? "broad traits only" : reference.description || "existing reference",
    analysis: reference.success ? reference as StoredCharacterReference : undefined,
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
  apiKey,
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

  const analyzeReference = async (reference: ReferenceItem) => {
    const imageUrl = reference.url || reference.previewUrl;
    if (!imageUrl) {
      return { status: "ready" as const, note: "ready" };
    }

    const response = await fetch("/api/analyze-reference", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        imageUrl,
        ...(apiKey && { apiKey }),
      }),
    });
    const result = await response.json() as {
      success?: boolean;
      error?: string;
      message?: string;
      kind?: ReferenceItem["kind"];
      severity?: "ok" | "warning" | "blocked";
      description?: string;
      isHuman?: boolean;
      type?: string;
      ageGroup?: ReferenceAnalysisSummary["ageGroup"];
      estimatedAge?: number | null;
      isUnderFive?: boolean;
      directReferenceAllowed?: boolean;
    };
    if (!response.ok || !result.success) {
      throw new Error(result.error || result.message || "We could not analyze this reference.");
    }

    const analysis: ReferenceAnalysisSummary = {
      success: true,
      kind: result.kind || "unknown",
      isHuman: result.isHuman ?? false,
      type: result.type || "unknown",
      ageGroup: result.ageGroup || "unknown",
      estimatedAge: result.estimatedAge ?? null,
      isUnderFive: result.isUnderFive ?? false,
      description: result.description || "Reference analyzed.",
      severity: result.severity || "ok",
      directReferenceAllowed: result.directReferenceAllowed ?? (result.severity !== "warning" && result.severity !== "blocked"),
      message: result.message,
    };

    return {
      kind: analysis.kind,
      status: analysis.severity === "blocked" ? "blocked" as const : analysis.severity === "warning" ? "warning" as const : "ready" as const,
      note: analysis.severity === "warning" ? "broad traits only" : analysis.description,
      analysis,
      message: result.message,
    };
  };

  const handleGenerate = async ({ prompt, references }: ComicGenerationSubmitData) => {
    if (references.some((reference) => reference.status === "checking")) {
      throw new Error("Still analyzing the uploaded photo. Please try again in a moment.");
    }

    setIsGenerating(true);

    try {
      const selected = references.filter((reference) => reference.selected).slice(-2);
      const resolvedReferences = await Promise.all(
        selected.map(async (reference) => {
          if (reference.source === "uploaded" && reference.file) {
            const { url } = await uploadToS3(reference.file);
            return { ...reference, url };
          }
          return reference;
        }),
      );
      const characterUrls = resolvedReferences
        .map((reference) => reference.url || reference.previewUrl || "")
        .filter(Boolean);
      const characterReferences = resolvedReferences
        .filter((reference) => reference.analysis && (reference.url || reference.previewUrl))
        .map((reference) =>
          toStoredCharacterReference(
            reference.url || reference.previewUrl || "",
            reference.analysis!,
          ),
        );

      await onGenerate({
        prompt,
        characterUrls: characterUrls.length > 0 ? characterUrls : undefined,
        characterReferences: characterReferences.length > 0 ? characterReferences : undefined,
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
      if (isOpen && !isGenerating && prompt.trim() && !references.some((reference) => reference.status === "checking")) {
        void handleGenerate({
          prompt,
          style: "story-style",
          references: references.filter((reference) => reference.selected),
        });
      }
    },
    { disabled: !isOpen || isGenerating || references.some((reference) => reference.status === "checking") },
  );

  const handleOpenChange = (open: boolean) => {
    if (!open && isGenerating) return;
    onClose();
  };

  return (
    <Dialog open={isOpen} onOpenChange={handleOpenChange}>
      <DialogContent
        showCloseButton={false}
        className="max-h-[calc(100dvh-1.5rem)] max-w-[min(44rem,calc(100vw-1.5rem))] overflow-visible rounded-xl border border-border/50 bg-background p-4 shadow-2xl sm:p-5"
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

        <div className="mt-4 min-w-0">
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
            onAnalyzeReference={analyzeReference}
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
