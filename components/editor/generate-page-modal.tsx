"use client";

import { useState, useRef, useEffect } from "react";
import { Upload, X, Loader2, Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogClose,
} from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import { useKeyboardShortcut } from "@/hooks/use-keyboard-shortcut";
import { validateFileForUpload, generateFilePreview } from "@/lib/file-utils";
import { useS3Upload } from "next-s3-upload";

interface CharacterItem {
  url: string;
  isNew?: boolean;
  file?: File;
  preview?: string;
}

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
  existingCharacters?: string[]; // All characters from the story
  lastPageCharacters?: string[]; // Characters used on the last page
  previousPageCharacters?: string[]; // Characters used on the previous page (if last page had < 2)
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
  const [prompt, setPrompt] = useState("");
  const [characters, setCharacters] = useState<CharacterItem[]>([]);
  const [selectedCharacterIndices, setSelectedCharacterIndices] = useState<
    Set<number>
  >(new Set());
  const [showPreview, setShowPreview] = useState<string | null>(null);
  const [isGenerating, setIsGenerating] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { toast } = useToast();
  const { uploadToS3 } = useS3Upload();

  // Reset form and initialize characters when modal opens
  useEffect(() => {
    if (isOpen) {
      setPrompt(isRedrawMode ? existingPrompt : "");
      setShowPreview(null);
      setIsGenerating(false);

      // Initialize characters list with existing ones
      const existingItems: CharacterItem[] = existingCharacters.map((url) => ({
        url,
        isNew: false,
      }));
      setCharacters(existingItems);

      // Smart selection: Use last 2 characters from last page, or combine with previous page if needed
      const defaultSelected = new Set<number>();
      const charactersToSelect: string[] = [];

      // If last page has 2 characters, use those
      if (lastPageCharacters.length >= 2) {
        charactersToSelect.push(...lastPageCharacters.slice(0, 2));
      } else {
        // Start with last page characters (if any)
        charactersToSelect.push(...lastPageCharacters);

        // If we have less than 2, add from previous page (avoiding duplicates)
        if (
          charactersToSelect.length < 2 &&
          previousPageCharacters.length > 0
        ) {
          for (const charUrl of previousPageCharacters) {
            if (
              !charactersToSelect.includes(charUrl) &&
              charactersToSelect.length < 2
            ) {
              charactersToSelect.push(charUrl);
            }
          }
        }
      }

      // Find indices of characters to select (preserving order in existingItems)
      charactersToSelect.forEach((charUrl) => {
        const index = existingItems.findIndex((item) => item.url === charUrl);
        if (index !== -1) {
          defaultSelected.add(index);
        }
      });

      setSelectedCharacterIndices(defaultSelected);
    }
  }, [
    isOpen,
    isRedrawMode,
    existingPrompt,
    existingCharacters,
    lastPageCharacters,
    previousPageCharacters,
  ]);

  // Keyboard shortcut for form submission (disabled during generation)
  useKeyboardShortcut(
    () => {
      if (isOpen && !isGenerating && prompt.trim()) {
        handleGenerate();
      }
    },
    { disabled: !isOpen || isGenerating }
  );

  const handleFiles = async (newFiles: FileList | null) => {
    if (!newFiles) return;

    const filesArray = Array.from(newFiles);

    const validationResults = filesArray.map((file) => ({
      file,
      validation: validateFileForUpload(file, true),
    }));

    validationResults.forEach(({ validation }) => {
      if (!validation.valid && validation.error) {
        toast({
          title: "Invalid file",
          description: validation.error,
          variant: "destructive",
          duration: 4000,
        });
      }
    });

    const validFiles = validationResults
      .filter(({ validation }) => validation.valid)
      .map(({ file }) => file);

    if (validFiles.length === 0) return;

    // Create new character items for the uploaded files
    const newCharacterItems: CharacterItem[] = await Promise.all(
      validFiles.map(async (file) => {
        const preview = await generateFilePreview(file);
        return {
          url: "", // Will be set after S3 upload
          isNew: true,
          file,
          preview,
        };
      })
    );

    // Add new characters to the list
    setCharacters((prev) => {
      const updated = [...prev, ...newCharacterItems];
      const newSelected = new Set(selectedCharacterIndices);

      // Add new characters to selection
      newCharacterItems.forEach((_, idx) => {
        newSelected.add(prev.length + idx);
      });

      // If we have more than 2 selected, deselect the oldest ones (keep most recent 2)
      if (newSelected.size > 2) {
        const selectedArray = Array.from(newSelected).sort((a, b) => b - a);
        const toKeep = selectedArray.slice(0, 2);
        newSelected.clear();
        toKeep.forEach((idx) => newSelected.add(idx));
      }

      setSelectedCharacterIndices(newSelected);
      return updated;
    });

    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  };

  const toggleCharacterSelection = (index: number) => {
    setSelectedCharacterIndices((prev) => {
      const newSelected = new Set(prev);
      if (newSelected.has(index)) {
        // Allow deselection even if only 2 are selected
        newSelected.delete(index);
      } else {
        // If already at max (2), remove the oldest selected first
        if (newSelected.size >= 2) {
          const selectedArray = Array.from(newSelected).sort((a, b) => a - b);
          newSelected.delete(selectedArray[0]); // Remove oldest
        }
        newSelected.add(index);
      }
      return newSelected;
    });
  };

  const removeCharacter = (index: number) => {
    setCharacters((prev) => {
      const updated = prev.filter((_, i) => i !== index);

      // Adjust selected indices
      setSelectedCharacterIndices((prevSelected) => {
        const newSelected = new Set<number>();
        prevSelected.forEach((idx) => {
          if (idx < index) {
            newSelected.add(idx);
          } else if (idx > index) {
            newSelected.add(idx - 1);
          }
          // Skip the removed index
        });
        return newSelected;
      });

      return updated;
    });
    setShowPreview(null);
  };

  const handleGenerate = async () => {
    if (!prompt.trim()) return;
    setIsGenerating(true);

    try {
      // Get selected characters
      const selectedCharacters = Array.from(selectedCharacterIndices)
        .sort((a, b) => a - b)
        .map((idx) => characters[idx])
        .filter(Boolean);

      // Upload new files to S3 and get URLs, reuse existing URLs
      const characterUrls = await Promise.all(
        selectedCharacters.map(async (char) => {
          if (char.isNew && char.file) {
            // Upload new file to S3
            const { url } = await uploadToS3(char.file);
            return url;
          } else {
            // Reuse existing URL
            return char.url;
          }
        })
      );

      await onGenerate({
        prompt,
        characterUrls: characterUrls.length > 0 ? characterUrls : undefined,
      });
    } catch (error) {
      console.error("Error generating page:", error);
      toast({
        title: "Generation failed",
        description:
          error instanceof Error
            ? error.message
            : "Failed to generate page. Please try again.",
        variant: "destructive",
        duration: 4000,
      });
      setIsGenerating(false);
    }
  };

  const handleOpenChange = (open: boolean) => {
    // Prevent closing the modal if generation is running
    if (!open && isGenerating) {
      return;
    }
    onClose();
  };

  return (
    <>
      <Dialog open={isOpen} onOpenChange={handleOpenChange}>
        <DialogContent className="border border-border/50 rounded-lg bg-background max-w-lg">
          <DialogHeader>
            <DialogTitle className="text-xl text-white font-heading">
              {isRedrawMode
                ? `Redraw Page ${pageNumber}`
                : `Generate Page ${pageNumber}`}
            </DialogTitle>
            <DialogClose
              disabled={isGenerating}
              className="absolute right-4 top-4 rounded-sm opacity-70 ring-offset-background transition-opacity hover:opacity-100 focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 disabled:pointer-events-none data-[state=open]:bg-accent data-[state=open]:text-muted-foreground"
            >
              <X className="h-4 w-4" />
              <span className="sr-only">Close</span>
            </DialogClose>
          </DialogHeader>

          <div className="space-y-4 mt-4">
            {/* Prompt Input */}
            <div className="relative glass-panel p-1 rounded-xl group focus-within:border-indigo/30 transition-colors">
              <div className="bg-background/80 rounded-lg p-4 border border-border/50">
                <div className="flex justify-between items-center mb-3">
                  <label className="text-[10px] uppercase text-muted-foreground tracking-[0.02em] font-medium">
                    Prompt
                  </label>
                </div>

                <textarea
                  value={prompt}
                  onChange={(e) => setPrompt(e.target.value)}
                  placeholder={
                    isRedrawMode
                      ? "Tweak the prompt to improve this page..."
                      : "Continue the story... Describe what happens next."
                  }
                  disabled={isGenerating}
                  className="w-full bg-transparent border-none text-sm text-white placeholder-muted-foreground/50 focus:ring-0 focus:outline-none resize-none h-20 leading-relaxed tracking-tight"
                />

                <div className="mt-3 pt-3 border-t border-border/30 space-y-3">
                  {/* Character Selection */}
                  <div className="space-y-2">
                    <label className="text-[10px] uppercase text-muted-foreground tracking-[0.02em] font-medium">
                      Characters (select up to 2)
                    </label>

                    {/* Existing and new characters list */}
                    {characters.length > 0 && (
                      <div className="flex flex-wrap gap-2">
                        {characters.map((char, index) => {
                          const isSelected =
                            selectedCharacterIndices.has(index);
                          const imageUrl = char.preview || char.url;

                          return (
                            <div
                              key={index}
                              className={`relative group/thumb cursor-pointer ${
                                isSelected ? "ring-2 ring-indigo-500" : ""
                              }`}
                            >
                              <button
                                type="button"
                                onClick={() => toggleCharacterSelection(index)}
                                onDoubleClick={() => setShowPreview(imageUrl)}
                                disabled={isGenerating}
                                className="w-10 h-10 rounded-md overflow-hidden border-2 border-transparent hover:border-indigo/50 transition-all disabled:opacity-50 disabled:cursor-not-allowed relative"
                                title="Click to select/deselect, double-click to preview"
                              >
                                <img
                                  src={imageUrl || "/placeholder.svg"}
                                  alt={`Character ${index + 1}`}
                                  className="w-full h-full object-cover"
                                />
                                {/* Selection indicator */}
                                {isSelected && (
                                  <div className="absolute top-0 right-0 w-4 h-4 bg-indigo-500 rounded-full flex items-center justify-center pointer-events-none z-10 border-2 border-background">
                                    <Check className="w-2.5 h-2.5 text-white" />
                                  </div>
                                )}
                              </button>

                              {/* Remove button (only for new uploads) */}
                              {char.isNew && (
                                <button
                                  type="button"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    removeCharacter(index);
                                  }}
                                  disabled={isGenerating}
                                  className="absolute -top-1.5 -right-1.5 w-4 h-4 bg-red-500 hover:bg-red-600 rounded-full flex items-center justify-center opacity-0 group-hover/thumb:opacity-100 transition-opacity disabled:opacity-50 z-20"
                                >
                                  <X className="w-2.5 h-2.5 text-white" />
                                </button>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    )}

                    {/* Upload new character button */}
                    <button
                      type="button"
                      onClick={() =>
                        !isGenerating && fileInputRef.current?.click()
                      }
                      disabled={isGenerating}
                      className="flex items-center gap-2 text-xs text-muted-foreground hover:text-white transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      <Upload className="w-3.5 h-3.5" />
                      <span>
                        {characters.length === 0
                          ? "Add characters (optional, max 2)"
                          : "Upload new character"}
                      </span>
                    </button>
                  </div>

                  <input
                    ref={fileInputRef}
                    type="file"
                    accept="image/png,image/jpeg,image/jpg"
                    multiple
                    className="hidden"
                    onChange={(e) => handleFiles(e.target.files)}
                  />
                </div>
              </div>
            </div>

            <div className="text-xs text-muted-foreground/70">
              {isRedrawMode
                ? "This will replace the current page with a new version. Previous pages and characters are automatically referenced."
                : selectedCharacterIndices.size > 0
                ? `${selectedCharacterIndices.size} character(s) selected. Click to toggle selection.`
                : "No characters selected. Click on characters above to select them, or upload new ones."}
            </div>

            <Button
              onClick={handleGenerate}
              disabled={!prompt.trim() || isGenerating}
              className="w-full gap-2 bg-white hover:bg-neutral-200 text-black tracking-tight"
            >
              {isGenerating ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span>
                    {isRedrawMode ? "Redrawing page..." : "Generating page..."}
                  </span>
                </>
              ) : (
                `${isRedrawMode ? "Redraw" : "Generate"} Page ${pageNumber}`
              )}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Character Preview Modal */}
      {showPreview && (
        <div
          className="fixed inset-0 bg-black/80 backdrop-blur-sm z-100 flex items-center justify-center p-4"
          onClick={() => setShowPreview(null)}
        >
          <div className="relative max-w-sm max-h-[80vh] glass-panel p-4 rounded-xl z-101">
            <Button
              variant="ghost"
              size="icon"
              className="absolute top-2 right-2 h-8 w-8 hover:bg-white/10 z-102"
              onClick={() => setShowPreview(null)}
            >
              <X className="w-4 h-4" />
            </Button>
            <img
              src={showPreview || "/placeholder.svg"}
              alt="Character preview"
              className="w-full h-full object-contain rounded-lg"
            />
          </div>
        </div>
      )}
    </>
  );
}
