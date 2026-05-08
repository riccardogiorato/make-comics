"use client";

import { useState, useRef, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Upload, X, Check, ArrowRight, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { useS3Upload } from "next-s3-upload";
import { useAuth, SignInButton, useClerk } from "@clerk/nextjs";
import { COMIC_STYLES } from "@/lib/constants";
import { useKeyboardShortcut } from "@/hooks/use-keyboard-shortcut";
import { useApiKey } from "@/hooks/use-api-key";
import { isContentPolicyViolation } from "@/lib/utils";
import { ApiKeyModal } from "@/components/api-key-modal";
import { MAX_SYSTEM_LENGTH, MAX_USER_PROMPT } from "@/lib/prompt";

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

const DEFAULT_STYLE = 'noir';
const STYLE_STORAGE_KEY = 'comic-style-preference';

export function ComicCreationForm({
  prompt,
  setPrompt,
  style: initialStyle,
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
  const personalApiKeysEnabled =
    process.env.NEXT_PUBLIC_IMAGE_PROVIDER === "together";
  const hasApiKey = personalApiKeysEnabled && !!apiKey;
  const [previews, setPreviews] = useState<string[]>([]);
  const [showPreview, setShowPreview] = useState<number | null>(null);
  const [showStyleDropdown, setShowStyleDropdown] = useState(false);
  const [creditsRemaining, setCreditsRemaining] = useState<number | null>(null);
  const [showApiModal, setShowApiModal] = useState(false);

  // Initialize style with initial value, load from localStorage after mount
  const [style, setStyle] = useState(initialStyle || DEFAULT_STYLE);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const PROMPT_STORAGE_KEY = 'comic-prompt-draft';


  useEffect(() => {
    if (isLoading) {
      setShowStyleDropdown(false);
    }
  }, [isLoading]);

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

  // Load style preference from localStorage on mount
  useEffect(() => {
    const saved = localStorage.getItem(STYLE_STORAGE_KEY);
    if (saved) {
      setStyle(saved);
    }
  }, []);

  // Save style to localStorage and sync with parent
  useEffect(() => {
    localStorage.setItem(STYLE_STORAGE_KEY, style);
    setParentStyle(style);
  }, [style, setParentStyle]);

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
          if (personalApiKeysEnabled) {
            setShowApiModal(true);
          } else {
            toast({
              title: "Weekly credits used",
              description: "Please try again after your credits reset.",
              variant: "destructive",
            });
          }
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
              <div className="relative dropdown-container z-60">
                <button
                  onClick={() => {
                    if (!isLoading) setShowStyleDropdown(!showStyleDropdown);
                  }}
                  disabled={isLoading}
                  className="flex items-center gap-2 px-2.5 py-1.5 rounded-md glass-panel glass-panel-hover transition-all text-xs text-muted-foreground hover:text-white disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:text-muted-foreground"
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
                  <div className="absolute left-0 sm:right-0 sm:left-auto bottom-full mb-2 w-40 bg-background rounded-lg p-1 z-70 shadow-2xl border border-border/50">
                    {COMIC_STYLES.map((styleOption) => (
                      <button
                        key={styleOption.id}
                        onClick={() => {
                          setStyle(styleOption.id);
                          setShowStyleDropdown(false);
                        }}
                        className={`w-full text-left px-3 py-2 rounded text-xs transition-colors flex items-center justify-between ${style === styleOption.id
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
                <>Using your image API key</>
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
