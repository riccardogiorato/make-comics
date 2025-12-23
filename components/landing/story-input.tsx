"use client";

import { useState } from "react";

import { useRef, useEffect } from "react";
import { Upload, X, Check } from "lucide-react";
import { Button } from "@/components/ui/button";

const COMIC_STYLES = [
  { id: "american-modern", name: "American Modern" },
  { id: "manga", name: "Manga" },
  { id: "noir", name: "Noir" },
  { id: "vintage", name: "Vintage" },
];

interface StoryInputProps {
  prompt: string;
  setPrompt: (prompt: string) => void;
  style: string;
  setStyle: (style: string) => void;
  characterFiles: File[];
  setCharacterFiles: (files: File[]) => void;
}

export function StoryInput({
  prompt,
  setPrompt,
  style,
  setStyle,
  characterFiles,
  setCharacterFiles,
}: StoryInputProps) {
  const [previews, setPreviews] = useState<string[]>([]);
  const [showPreview, setShowPreview] = useState<number | null>(null);
  const [showStyleDropdown, setShowStyleDropdown] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFiles = (newFiles: FileList | null) => {
    if (!newFiles) return;

    const validFiles = Array.from(newFiles).filter((file) =>
      file.type.startsWith("image/")
    );
    const totalFiles = [...characterFiles, ...validFiles].slice(0, 2); // Max 2 files

    setCharacterFiles(totalFiles);

    // Generate previews for all files
    const newPreviews: string[] = [];
    totalFiles.forEach((file, index) => {
      const reader = new FileReader();
      reader.onload = (e) => {
        newPreviews[index] = e.target?.result as string;
        if (newPreviews.filter(Boolean).length === totalFiles.length) {
          setPreviews([...newPreviews]);
        }
      };
      reader.readAsDataURL(file);
    });
  };

  const removeFile = (index: number) => {
    const newFiles = characterFiles.filter((_, i) => i !== index);
    const newPreviews = previews.filter((_, i) => i !== index);
    setCharacterFiles(newFiles);
    setPreviews(newPreviews);
    setShowPreview(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  };

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      const target = event.target as HTMLElement;
      if (!target.closest(".dropdown-container")) {
        setShowStyleDropdown(false);
      }
    };

    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  return (
    <>
      <div className="relative glass-panel p-0.5 sm:p-1 rounded-xl group focus-within:border-indigo/30 transition-colors">
        <div className="bg-background/80 rounded-lg p-3 sm:p-4 border border-border/50">
          <div className="flex justify-between items-center mb-2 sm:mb-3">
            <label className="text-[10px] uppercase text-muted-foreground tracking-[0.02em] font-medium">
              Prompt
            </label>
          </div>

          <textarea
            value={prompt}
            onChange={(e) => setPrompt(e.target.value)}
            placeholder="A cyberpunk detective standing in neon rain, holding a glowing datapad, moody lighting, noir style..."
            className="w-full bg-transparent border-none text-sm text-white placeholder-muted-foreground/50 focus:ring-0 focus:outline-none resize-none h-16 leading-relaxed"
          />

          <div className="mt-3 pt-3 border-t border-border/30 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 sm:gap-2">
            <div className="flex items-center gap-2 flex-1 min-w-0 w-full sm:w-auto">
              {characterFiles.length > 0 ? (
                <div className="flex items-center gap-2">
                  {previews.map((preview, index) => (
                    <div key={index} className="relative group/thumb">
                      <button
                        onClick={() => setShowPreview(index)}
                        className="w-8 h-8 rounded-md overflow-hidden border border-border/50 hover:border-indigo/50 transition-colors"
                      >
                        <img
                          src={preview || "/placeholder.svg"}
                          alt={`Character ${index + 1}`}
                          className="w-full h-full object-cover"
                        />
                      </button>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          removeFile(index);
                        }}
                        className="absolute -top-1.5 -right-1.5 w-4 h-4 bg-red-500 hover:bg-red-600 rounded-full flex items-center justify-center opacity-0 group-hover/thumb:opacity-100 transition-opacity"
                      >
                        <X className="w-2.5 h-2.5 text-white" />
                      </button>
                    </div>
                  ))}
                  {characterFiles.length < 2 && (
                    <button
                      onClick={() => fileInputRef.current?.click()}
                      className="w-8 h-8 rounded-md border border-dashed border-border/50 hover:border-indigo/50 flex items-center justify-center text-muted-foreground hover:text-white transition-colors"
                    >
                      <Upload className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>
              ) : (
                <button
                  onClick={() => fileInputRef.current?.click()}
                  className="flex items-center gap-2 text-xs text-muted-foreground hover:text-white transition-colors"
                >
                  <Upload className="w-3.5 h-3.5" />
                  <span>Upload Characters</span>
                  <span className="text-muted-foreground/50 hidden sm:inline">
                    (Max 2)
                  </span>
                </button>
              )}
            </div>

            <div className="flex items-center gap-2 shrink-0 w-full sm:w-auto justify-start sm:justify-end">
              <div className="relative dropdown-container z-60">
                <button
                  onClick={() => {
                    setShowStyleDropdown(!showStyleDropdown);
                  }}
                  className="flex items-center gap-2 px-2.5 py-1.5 rounded-md glass-panel glass-panel-hover transition-all text-xs text-muted-foreground hover:text-white"
                >
                  <svg
                    className="w-3 h-3"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M7 21a4 4 0 01-4-4V5a2 2 0 012-2h4a2 2 0 012 2v12a4 4 0 01-4 4zm0 0h12a2 2 0 002-2v-4a2 2 0 00-2-2h-2.343M11 7.343l1.657-1.657a2 2 0 012.828 0l2.829 2.829a2 2 0 010 2.828l-8.486 8.485M7 17h.01"
                    />
                  </svg>
                  <span>{COMIC_STYLES.find((s) => s.id === style)?.name}</span>
                </button>

                {showStyleDropdown && (
                  <div className="absolute left-0 sm:right-0 sm:left-auto bottom-full mb-2 w-40 glass-panel rounded-lg p-1 z-70 shadow-2xl border border-border/50">
                    {COMIC_STYLES.map((styleOption) => (
                      <button
                        key={styleOption.id}
                        onClick={() => {
                          setStyle(styleOption.id);
                          setShowStyleDropdown(false);
                        }}
                        className={`w-full text-left px-3 py-2 rounded text-xs transition-colors flex items-center justify-between ${
                          style === styleOption.id
                            ? "bg-indigo/10 text-indigo"
                            : "text-muted-foreground hover:bg-white/5 hover:text-white"
                        }`}
                      >
                        <span>{styleOption.name}</span>
                        {style === styleOption.id && (
                          <Check className="w-3 h-3" />
                        )}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>

          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            multiple
            className="hidden"
            onChange={(e) => handleFiles(e.target.files)}
          />
        </div>
      </div>

      {showPreview !== null && previews[showPreview] && (
        <div
          className="fixed inset-0 bg-black/80 backdrop-blur-sm z-100 flex items-center justify-center p-4"
          onClick={() => setShowPreview(null)}
        >
          <div className="relative max-w-2xl max-h-[80vh] glass-panel p-4 rounded-xl z-101">
            <Button
              variant="ghost"
              size="icon"
              className="absolute top-2 right-2 h-8 w-8 hover:bg-white/10 z-102"
              onClick={() => setShowPreview(null)}
            >
              <X className="w-4 h-4" />
            </Button>
            <img
              src={previews[showPreview] || "/placeholder.svg"}
              alt="Character preview"
              className="w-full h-full object-contain rounded-lg"
            />
          </div>
        </div>
      )}
    </>
  );
}
