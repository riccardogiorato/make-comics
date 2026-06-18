"use client";

import { useState, useRef, useEffect } from "react";
import { createPortal } from "react-dom";
import { useRouter } from "next/navigation";
import { Upload, X, Check, ArrowRight, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { useS3Upload } from "next-s3-upload";
import { useAuth, SignInButton, useClerk } from "@clerk/nextjs";
import { FEATURED_STYLES } from "@/lib/constants";
import { useKeyboardShortcut } from "@/hooks/use-keyboard-shortcut";
import { useApiKey } from "@/hooks/use-api-key";
import { isContentPolicyViolation } from "@/lib/utils";
import { ApiKeyModal } from "@/components/api-key-modal";
import { MAX_USER_PROMPT } from "@/lib/prompt";
import { generateFilePreview, normalizeImageForUpload } from "@/lib/file-utils";

interface ComicCreationFormProps {
  prompt: string;
  setPrompt: (prompt: string) => void;
  style: string;
  setStyle: (style: string) => void;
  characterFiles: File[];
  setCharacterFiles: (files: File[]) => void;
  isLoading: boolean;
  setIsLoading: (loading: boolean) => void;
}

const DEFAULT_STYLE = 'american-modern';

const STYLE_GRADIENTS: Record<string, string> = {
  "american-modern": "bg-gradient-to-br from-blue-700 via-red-600 to-yellow-400",
  "manga":           "bg-gradient-to-br from-slate-950 via-slate-600 to-slate-100",
  "retro-noir":      "bg-gradient-to-br from-stone-950 via-amber-900 to-stone-600",
  "indie-vector":    "bg-gradient-to-br from-cyan-400 via-violet-500 to-pink-400",
};
const STYLE_STORAGE_KEY = 'comic-style-preference';

export function ComicCreationForm({
  prompt,
  setPrompt,
  style,
  setStyle: setParentStyle,
  characterFiles,
  setCharacterFiles,
  isLoading,
  setIsLoading,
}: ComicCreationFormProps) {
  const router = useRouter();
  const [loadingStep, setLoadingStep] = useState(0);
  const { toast } = useToast();
  const { uploadToS3 } = useS3Upload();
  const { isSignedIn, isLoaded } = useAuth();
  const { openSignIn } = useClerk();
  const [apiKey, setApiKey] = useApiKey();
  const hasApiKey = !!apiKey;
  const [previews, setPreviews] = useState<string[]>([]);
  const [showPreview, setShowPreview] = useState<number | null>(null);
  const [showStyleDropdown, setShowStyleDropdown] = useState(false);
  const [creditsRemaining, setCreditsRemaining] = useState<number | null>(null);
  const [showApiModal, setShowApiModal] = useState(false);

  const [isMounted, setIsMounted] = useState(false);
  const styleButtonRef = useRef<HTMLButtonElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const PROMPT_STORAGE_KEY = 'comic-prompt-draft';


  useEffect(() => {
    if (isLoading) {
      setShowStyleDropdown(false);
    }
  }, [isLoading]);

  useEffect(() => { setIsMounted(true); }, []);

  useEffect(() => {
    // Auto-focus the textarea when component mounts
    if (textareaRef.current) {
      textareaRef.current.focus();
    }
  }, []);

  // Persist prompt to localStorage
  useEffect(() => {
    if (prompt) {
      localStorage.setItem(PROMPT_STORAGE_KEY, prompt);
    }
  }, [prompt]);

  // Restore prompt from localStorage only once on mount
  useEffect(() => {
    const saved = localStorage.getItem(PROMPT_STORAGE_KEY);
    if (saved && !prompt) {
      setPrompt(saved);
    }
  }, []); // Run only on mount

  // On mount: restore saved style preference and notify parent
  useEffect(() => {
    const saved = localStorage.getItem(STYLE_STORAGE_KEY);
    if (saved) {
      const isFeatured = FEATURED_STYLES.some((s) => s.id === saved);
      const resolved = isFeatured ? saved : DEFAULT_STYLE;
      if (resolved !== style) setParentStyle(resolved);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Persist whenever parent-controlled style changes
  useEffect(() => {
    localStorage.setItem(STYLE_STORAGE_KEY, style);
  }, [style]);

  // Fetch credits on mount
  useEffect(() => {
    if (isSignedIn && !hasApiKey) {
      const fetchCredits = async () => {
        try {
          const response = await fetch('/api/check-credits', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({ hasApiKey: false }),
          });
          const data = await response.json();
          if (response.ok) {
            setCreditsRemaining(data.creditsRemaining);
          }
        } catch (error) {
          console.error('Error fetching credits:', error);
        }
      };
      fetchCredits();
    } else if (hasApiKey) {
      setCreditsRemaining(null); // Unlimited
    }
  }, [isSignedIn, hasApiKey]);

  // Keyboard shortcut for form submission
  useKeyboardShortcut(() => {
    if (!isLoading && prompt.trim()) {
      if (!isSignedIn) {
        openSignIn();
      } else {
        handleCreate();
      }
    }
  }, { disabled: isLoading || !isLoaded });

  const handleFiles = async (newFiles: FileList | null) => {
    if (!newFiles) return;

    const normalizedFiles: File[] = [];
    for (const file of Array.from(newFiles)) {
      try {
        normalizedFiles.push(await normalizeImageForUpload(file));
      } catch (error) {
        toast({
          title: "Invalid file",
          description:
            error instanceof Error ? error.message : "Could not prepare image.",
          variant: "destructive",
          duration: 4000,
        });
      }
    }

    if (normalizedFiles.length === 0) return;

    const totalFiles = [...characterFiles, ...normalizedFiles].slice(0, 2); // Max 2 files

    setCharacterFiles(totalFiles);

    // Generate previews for all files
    setPreviews(await Promise.all(totalFiles.map((file) => generateFilePreview(file))));
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


  const handleCreate = async () => {
    if (!prompt.trim()) {
      toast({
        title: "Prompt required",
        description: "Please enter a prompt to generate your comic",
        variant: "destructive",
        duration: 3000,
      });
      return;
    }

    setIsLoading(true);
    setLoadingStep(0);

    // Progress through loading steps
    const stepInterval = setInterval(() => {
      setLoadingStep((prev) => {
        if (prev < 3) return prev + 1;
        return prev;
      });
    }, 3500);

    try {
      // Check credits
      const hasApiKey = !!apiKey;
      if (!hasApiKey) {
        const creditsResponse = await fetch('/api/check-credits', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ hasApiKey }),
        });
        const creditsData = await creditsResponse.json();

        if (!creditsResponse.ok) {
          toast({
            title: "Error",
            description: "Failed to check credits",
            variant: "destructive",
          });
          clearInterval(stepInterval);
          setIsLoading(false);
          return;
        }

        if (creditsData.creditsRemaining === 0) {
          setShowApiModal(true);
          clearInterval(stepInterval);
          setIsLoading(false);
          return;
        }
      }

      const characterUploads = await Promise.all(
        characterFiles.map((file) => uploadToS3(file).then(({ url }) => url))
      );

      // Use API to create story and generate first page
      const response = await fetch("/api/generate-comic", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          prompt,
          ...(apiKey && { apiKey }),
          style,
          characterImages: characterUploads,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        if (response.status === 429 && errorData.isRateLimited) {
          throw new Error(errorData.error);
        }
        throw new Error(errorData.error || "Failed to create story");
      }

      const result = await response.json();

      // Clear the draft since submission was successful
      localStorage.removeItem(PROMPT_STORAGE_KEY);
      clearInterval(stepInterval);

      if (result.promptAdjusted) {
        // Carry the flag across the navigation — story editor picks it up on mount
        sessionStorage.setItem("promptAdjusted", "1");
      }

      // Redirect to the story editor using slug
      router.push(`/story/${result.storySlug}`);
    } catch (error) {
      console.error("Error creating comic:", error);
      const errorMessage =
        error instanceof Error
          ? error.message
          : "Failed to create comic. Please try again.";
      let title = "Creation failed";
      if (isContentPolicyViolation(errorMessage)) {
        title = "Content policy violation";
      }
      toast({
        title,
        description: errorMessage,
        variant: "destructive",
        duration: 4000,
      });
      clearInterval(stepInterval);
      setIsLoading(false);
    }
  };

  const handleApiKeySubmit = (key: string) => {
    setApiKey(key);
    setShowApiModal(false);
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    const isEnter = e.key === "Enter" || e.key === "\n" || e.keyCode === 13;
    const isModifierPressed = e.shiftKey || e.ctrlKey || e.metaKey; // metaKey for Cmd on Mac

    if (isEnter && isModifierPressed) {
      e.preventDefault();
      handleCreate();
    }
  };

  const getPopoverStyle = (): React.CSSProperties => {
    if (!styleButtonRef.current) return {};
    const r = styleButtonRef.current.getBoundingClientRect();
    return {
      bottom: window.innerHeight - r.top + 8,
      right: window.innerWidth - r.right,
    };
  };

  const loadingSteps = [
    "Enhancing prompt...",
    "Generating scenes...",
    "Creating your comic...",
    "Finishing up...",
  ];

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
            ref={textareaRef}
            value={prompt}
            onChange={(e) => setPrompt(e.target.value.slice(
              0, MAX_USER_PROMPT))
            }
            placeholder="A cyberpunk detective standing in neon rain, holding a glowing datapad, moody lighting, noir style..."
            disabled={isLoading}
            maxLength={MAX_USER_PROMPT}
            className="w-full bg-transparent border-none text-sm text-white placeholder-muted-foreground/50 focus:ring-0 focus:outline-none resize-none h-16 leading-relaxed disabled:opacity-50 disabled:cursor-not-allowed"
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
                          if (!isLoading) removeFile(index);
                        }}
                        disabled={isLoading}
                        className="absolute -top-1.5 -right-1.5 w-4 h-4 bg-red-500 hover:bg-red-600 rounded-full flex items-center justify-center opacity-0 group-hover/thumb:opacity-100 transition-opacity disabled:opacity-50 disabled:cursor-not-allowed"
                      >
                        <X className="w-2.5 h-2.5 text-white" />
                      </button>
                    </div>
                  ))}
                  {characterFiles.length < 2 && (
                    <button
                      onClick={() =>
                        !isLoading && fileInputRef.current?.click()
                      }
                      disabled={isLoading}
                      className="w-8 h-8 rounded-md border border-dashed border-border/50 hover:border-indigo/50 flex items-center justify-center text-muted-foreground hover:text-white transition-colors disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:border-border/50 disabled:hover:text-muted-foreground"
                    >
                      <Upload className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>
              ) : (
                <button
                  onClick={() => !isLoading && fileInputRef.current?.click()}
                  disabled={isLoading}
                  className="flex items-center gap-2 text-xs text-muted-foreground hover:text-white transition-colors disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:text-muted-foreground"
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
              <button
                ref={styleButtonRef}
                onClick={() => { if (!isLoading) setShowStyleDropdown((v) => !v); }}
                disabled={isLoading}
                className="flex items-center gap-2 px-2.5 py-1.5 rounded-md glass-panel glass-panel-hover transition-all text-xs text-muted-foreground hover:text-white disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:text-muted-foreground"
              >
                {(() => {
                  const current = FEATURED_STYLES.find((s) => s.id === style) ?? FEATURED_STYLES[0];
                  return current.image
                    ? <img src={current.image} alt={current.name} className="w-4 h-4 rounded object-cover shrink-0" />
                    : <span className={`w-4 h-4 rounded shrink-0 ${STYLE_GRADIENTS[style] ?? STYLE_GRADIENTS["american-modern"]}`} />;
                })()}
                <span>{FEATURED_STYLES.find((s) => s.id === style)?.name ?? FEATURED_STYLES[0].name}</span>
              </button>
            </div>
          </div>

          <input
            ref={fileInputRef}
            type="file"
            accept="image/png,image/jpeg,image/jpg,image/webp"
            multiple
            className="hidden"
            onChange={(e) => handleFiles(e.target.files)}
          />
        </div>
      </div>

      {isMounted && showStyleDropdown && createPortal(
        <>
          <div className="fixed inset-0 z-[999]" onClick={() => setShowStyleDropdown(false)} />
          <div
            className="fixed z-[1000] bg-background border border-border/50 rounded-xl p-3 shadow-2xl w-52"
            style={getPopoverStyle()}
          >
            <p className="text-[10px] uppercase tracking-widest text-muted-foreground mb-2 font-medium">Style</p>
            <div className="grid grid-cols-2 gap-1.5">
              {FEATURED_STYLES.map((styleOption) => {
                const isSelected = style === styleOption.id;
                return (
                  <button
                    key={styleOption.id}
                    onClick={() => { setParentStyle(styleOption.id); setShowStyleDropdown(false); }}
                    className={`relative rounded-lg overflow-hidden aspect-square border-2 transition-all ${
                      isSelected ? "border-white" : "border-transparent hover:border-white/30"
                    }`}
                  >
                    {styleOption.image ? (
                      <img
                        src={styleOption.image}
                        alt={styleOption.name}
                        className="absolute inset-0 w-full h-full object-cover"
                      />
                    ) : (
                      <div className={`absolute inset-0 ${STYLE_GRADIENTS[styleOption.id] ?? ""}`} />
                    )}
                    <div className="absolute inset-0 bg-gradient-to-t from-black/70 to-transparent" />
                    <span className="absolute bottom-1.5 left-1.5 right-1.5 text-white text-[10px] font-medium leading-tight text-left">
                      {styleOption.name}
                    </span>
                    {isSelected && (
                      <span className="absolute top-1.5 right-1.5 w-4 h-4 bg-white rounded-full flex items-center justify-center">
                        <Check className="w-2.5 h-2.5 text-black" />
                      </span>
                    )}
                  </button>
                );
              })}
            </div>
          </div>
        </>,
        document.body
      )}

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

      <div className="pt-4">
        {!isLoaded ? (
          <div className="h-10" />
        ) : isSignedIn ? (
          <div className="flex items-center justify-between gap-3 w-full">
            <Button
              onClick={handleCreate}
              disabled={isLoading || !prompt.trim()}
              className="bg-white hover:bg-neutral-200 text-black px-8 py-2 rounded-md text-sm font-medium transition-colors flex items-center justify-center gap-3 tracking-tight"
            >
              {isLoading ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span className="text-sm font-medium tracking-tight">
                    {loadingSteps[loadingStep]}
                  </span>
                </>
              ) : (
                <>
                  Generate
                  <ArrowRight className="w-4 h-4" />
                </>
              )}
            </Button>
            <div className="text-xs text-muted-foreground whitespace-nowrap">
              {hasApiKey ? (
                <>Using your API key (~$0.01 per comic)</>
              ) : (
                <>{creditsRemaining !== null ? `${creditsRemaining} credit${creditsRemaining === 1 ? '' : 's'} remaining` : 'Checking credits...'}</>
              )}
            </div>
          </div>
        ) : (
          <SignInButton mode="modal">
            <Button className="w-full sm:w-auto sm:min-w-40 bg-white hover:bg-neutral-200 text-black px-8 py-2 rounded-md text-sm font-medium transition-colors flex items-center justify-center gap-3 tracking-tight">
              Login to create your comic
              <ArrowRight className="w-4 h-4" />
            </Button>
          </SignInButton>
        )}
      </div>

      <ApiKeyModal
        isOpen={showApiModal}
        onClose={() => setShowApiModal(false)}
        onSubmit={handleApiKeySubmit}
      />
    </>
  );
}
