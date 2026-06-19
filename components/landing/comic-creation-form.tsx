"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { SignInButton, useAuth, useClerk } from "@clerk/nextjs";
import { useS3Upload } from "next-s3-upload";
import { ApiKeyModal } from "@/components/api-key-modal";
import {
  ComicGenerationForm,
  type ComicGenerationSubmitData,
  type ReferenceItem,
} from "@/components/comic-form/comic-generation-form";
import { Button } from "@/components/ui/button";
import { useApiKey } from "@/hooks/use-api-key";
import { useKeyboardShortcut } from "@/hooks/use-keyboard-shortcut";
import { useToast } from "@/hooks/use-toast";
import { FEATURED_STYLES } from "@/lib/constants";
import { isContentPolicyViolation } from "@/lib/utils";

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

const DEFAULT_STYLE = "american-modern";
const PROMPT_STORAGE_KEY = "comic-prompt-draft";
const STYLE_STORAGE_KEY = "comic-style-preference";

export function ComicCreationForm({
  prompt,
  setPrompt,
  style,
  setStyle,
  characterFiles,
  setCharacterFiles,
  isLoading,
  setIsLoading,
}: ComicCreationFormProps) {
  const router = useRouter();
  const { toast } = useToast();
  const { uploadToS3 } = useS3Upload();
  const { isSignedIn, isLoaded } = useAuth();
  const { openSignIn } = useClerk();
  const [apiKey, setApiKey] = useApiKey();
  const hasApiKey = !!apiKey;
  const [creditsRemaining, setCreditsRemaining] = useState<number | null>(null);
  const [showApiModal, setShowApiModal] = useState(false);
  const [references, setReferences] = useState<ReferenceItem[]>([]);

  useEffect(() => {
    const saved = localStorage.getItem(PROMPT_STORAGE_KEY);
    if (saved && !prompt) {
      setPrompt(saved);
    }
  }, []);

  useEffect(() => {
    if (prompt) {
      localStorage.setItem(PROMPT_STORAGE_KEY, prompt);
    }
  }, [prompt]);

  useEffect(() => {
    const saved = localStorage.getItem(STYLE_STORAGE_KEY);
    if (!saved) return;

    const resolved = FEATURED_STYLES.some((option) => option.id === saved)
      ? saved
      : DEFAULT_STYLE;
    if (resolved !== style) {
      setStyle(resolved);
    }
  }, []);

  useEffect(() => {
    localStorage.setItem(STYLE_STORAGE_KEY, style);
  }, [style]);

  useEffect(() => {
    setCharacterFiles(
      references
        .filter((reference) => reference.source === "uploaded" && reference.file)
        .map((reference) => reference.file!),
    );
  }, [references, setCharacterFiles]);

  useEffect(() => {
    if (isSignedIn && !hasApiKey) {
      const fetchCredits = async () => {
        try {
          const response = await fetch("/api/check-credits", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ hasApiKey: false }),
          });
          const data = await response.json();
          if (response.ok) {
            setCreditsRemaining(data.creditsRemaining);
          }
        } catch (error) {
          console.error("Error fetching credits:", error);
        }
      };
      fetchCredits();
    } else if (hasApiKey) {
      setCreditsRemaining(null);
    }
  }, [isSignedIn, hasApiKey]);

  const handleCreate = async ({ prompt, style, references }: ComicGenerationSubmitData) => {
    if (!isLoaded) return;
    if (!isSignedIn) {
      openSignIn();
      return;
    }

    setIsLoading(true);

    try {
      if (!hasApiKey) {
        const creditsResponse = await fetch("/api/check-credits", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ hasApiKey }),
        });
        const creditsData = await creditsResponse.json();

        if (!creditsResponse.ok) {
          throw new Error("Failed to check credits");
        }

        if (creditsData.creditsRemaining === 0) {
          setShowApiModal(true);
          return;
        }
      }

      const characterUploads = await Promise.all(
        references
          .filter((reference) => reference.source === "uploaded" && reference.file)
          .map((reference) => uploadToS3(reference.file!).then(({ url }) => url)),
      );

      const response = await fetch("/api/generate-comic", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
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
      localStorage.removeItem(PROMPT_STORAGE_KEY);

      if (result.promptAdjusted) {
        sessionStorage.setItem("promptAdjusted", "1");
      }

      router.push(`/story/${result.storySlug}`);
    } catch (error) {
      console.error("Error creating comic:", error);
      const errorMessage =
        error instanceof Error ? error.message : "Failed to create comic. Please try again.";
      toast({
        title: isContentPolicyViolation(errorMessage) ? "Content policy violation" : "Creation failed",
        description: errorMessage,
        variant: "destructive",
        duration: 4000,
      });
      throw error;
    } finally {
      setIsLoading(false);
    }
  };

  useKeyboardShortcut(() => {
    if (!isLoading && prompt.trim()) {
      void handleCreate({ prompt, style, references: references.filter((reference) => reference.selected) });
    }
  }, { disabled: isLoading || !isLoaded });

  return (
    <>
      <ComicGenerationForm
        mode="new-story"
        title=""
        prompt={prompt}
        onPromptChange={setPrompt}
        style={style}
        onStyleChange={setStyle}
        references={references}
        onReferencesChange={setReferences}
        maxReferences={2}
        submitLabel={isSignedIn ? "Generate" : "Login to create"}
        disabled={!isLoaded}
        isSubmitting={isLoading}
        onSubmit={handleCreate}
        footer={
          isSignedIn ? (
            <div className="text-xs text-muted-foreground">
              {hasApiKey
                ? "Using your API key (~$0.01 per comic)"
                : creditsRemaining !== null
                  ? `${creditsRemaining} credit${creditsRemaining === 1 ? "" : "s"} remaining`
                  : "Checking credits..."}
            </div>
          ) : (
            <SignInButton mode="modal">
              <Button
                type="button"
                variant="ghost"
                className="h-auto p-0 text-xs text-muted-foreground hover:bg-transparent hover:text-white"
              >
                Sign in before generating
              </Button>
            </SignInButton>
          )
        }
      />

      <ApiKeyModal
        isOpen={showApiModal}
        onClose={() => setShowApiModal(false)}
        onSubmit={(key) => {
          setApiKey(key);
          setShowApiModal(false);
        }}
      />
    </>
  );
}
