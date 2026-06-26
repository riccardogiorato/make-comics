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
import {
  toStoredCharacterReference,
  type ReferenceAnalysisSummary,
  type StoredCharacterReference,
} from "@/lib/reference-analysis";
import { getFriendlyGenerationErrorMessage, isContentPolicyViolation } from "@/lib/utils";

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
const VALIDATION_TIMEOUT_MS = 18000;
const isDevelopment = process.env.NODE_ENV === "development";

async function readJsonResponse<T extends Record<string, unknown>>(
  response: Response,
  fallbackMessage: string,
): Promise<T> {
  const text = await response.text();
  if (!text.trim()) {
    throw new Error(fallbackMessage);
  }

  try {
    return JSON.parse(text) as T;
  } catch {
    throw new Error(fallbackMessage);
  }
}

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

  const analyzeReference = async (reference: ReferenceItem) => {
    if (!reference.previewUrl) {
      return { status: "ready" as const, note: "ready" };
    }

    const response = await fetch("/api/analyze-reference", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        imageDataUrl: reference.previewUrl,
        ...(apiKey && { apiKey }),
      }),
    });

    const result = await readJsonResponse<{
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
    }>(response, "We could not analyze this reference. Please try another image.");
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

  const validatePrompt = async (prompt: string) => {
    if (isDevelopment) {
      console.info("[comic-form] validating prompt");
    }
    const controller = new AbortController();
    const timeout = window.setTimeout(() => controller.abort(), VALIDATION_TIMEOUT_MS);
    let response: Response;
    try {
      response = await fetch("/api/validate-prompt", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        signal: controller.signal,
        body: JSON.stringify({
          prompt,
          mode: "new-story",
          ...(apiKey && { apiKey }),
        }),
      });
    } catch (error) {
      if (error instanceof DOMException && error.name === "AbortError") {
        throw new Error("Prompt validation is taking too long. Please try again.");
      }
      throw error;
    } finally {
      window.clearTimeout(timeout);
    }

    const result = await readJsonResponse<{
      status?: "ok" | "suggested_fix" | "blocked";
      message?: string;
      suggestedPrompt?: string;
      error?: string;
    }>(response, "Could not validate prompt. Please try again.");
    if (isDevelopment) {
      console.info("[comic-form] prompt validation result", result);
    }
    if (!response.ok) {
      throw new Error(result.error || "Could not validate prompt.");
    }

    return {
      status: result.status ?? "blocked",
      message: result.message ?? "Please revise the prompt before generating.",
      suggestedPrompt: result.suggestedPrompt,
    };
  };

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
          const data = await readJsonResponse<{ creditsRemaining?: number }>(
            response,
            "Could not check credits.",
          );
          if (response.ok) {
            setCreditsRemaining(data.creditsRemaining ?? null);
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
    if (isDevelopment) {
      console.info("[comic-form] submit", {
        promptLength: prompt.length,
        referenceCount: references.length,
        isSignedIn,
      });
    }
    if (!isLoaded) return;
    if (!isSignedIn) {
      openSignIn();
      return;
    }

    setIsLoading(true);

    try {
      const blockedReference = references.find((reference) => reference.status === "blocked");
      if (blockedReference) {
        throw new Error("We could not use one of the uploaded references. Please remove it or upload another image.");
      }
      if (references.some((reference) => reference.status === "checking")) {
        throw new Error("Still analyzing the uploaded photo. Please try again in a moment.");
      }

      const promptValidation = await validatePrompt(prompt);
      if (promptValidation.status === "blocked") {
        throw new Error(promptValidation.message || "Please revise the prompt before generating.");
      }
      if (promptValidation.status === "suggested_fix") {
        if (promptValidation.suggestedPrompt) {
          setPrompt(promptValidation.suggestedPrompt);
        }
        throw new Error(
          promptValidation.suggestedPrompt
            ? "We made this prompt original and safer. Review the updated text, then press Generate again."
            : promptValidation.message || "Please revise the prompt before generating.",
        );
      }

      if (!hasApiKey) {
        const creditsResponse = await fetch("/api/check-credits", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ hasApiKey }),
        });
        const creditsData = await readJsonResponse<{ creditsRemaining?: number }>(
          creditsResponse,
          "Failed to check credits",
        );

        if (!creditsResponse.ok) {
          throw new Error("Failed to check credits");
        }

        if (creditsData.creditsRemaining === 0) {
          setShowApiModal(true);
          return;
        }
      }

      const uploadedReferences = await Promise.all(
        references.map(async (reference) => {
          if (reference.source === "uploaded" && reference.file) {
            const { url } = await uploadToS3(reference.file);
            return { ...reference, url };
          }
          return reference;
        }),
      );
      const characterUploads = uploadedReferences
        .map((reference) => reference.url || reference.previewUrl || "")
        .filter(Boolean);
      const characterReferences: StoredCharacterReference[] = uploadedReferences
        .filter((reference) => reference.analysis && (reference.url || reference.previewUrl))
        .map((reference) =>
          toStoredCharacterReference(
            reference.url || reference.previewUrl || "",
            reference.analysis!,
          ),
        );

      const response = await fetch("/api/generate-comic", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          prompt,
          ...(apiKey && { apiKey }),
          style,
          characterImages: characterUploads,
          characterReferences,
        }),
      });

      if (!response.ok) {
        const errorData = await readJsonResponse<{
          error?: string;
          isRateLimited?: boolean;
        }>(response, "Failed to create story");
        if (response.status === 429 && errorData.isRateLimited) {
          throw new Error(errorData.error);
        }
        throw new Error(getFriendlyGenerationErrorMessage(errorData.error || "Failed to create story"));
      }

      const result = await readJsonResponse<{
        storySlug?: string;
        promptAdjusted?: boolean;
      }>(response, "Failed to create story");
      localStorage.removeItem(PROMPT_STORAGE_KEY);

      if (result.promptAdjusted) {
        sessionStorage.setItem("promptAdjusted", "1");
      }

      if (!result.storySlug) {
        throw new Error("Failed to create story");
      }

      router.push(`/story/${result.storySlug}`);
    } catch (error) {
      console.error("Error creating comic:", error);
      const errorMessage =
        error instanceof Error
          ? getFriendlyGenerationErrorMessage(error.message)
          : "Failed to create comic. Please try again.";
      const isExpectedValidationPause =
        errorMessage.includes("Still analyzing") ||
        errorMessage.includes("We made this prompt") ||
        errorMessage.includes("Please revise the prompt") ||
        errorMessage.includes("Prompt validation is taking too long");

      if (!isExpectedValidationPause) {
        toast({
          title: isContentPolicyViolation(errorMessage) ? "Content policy violation" : "Creation failed",
          description: errorMessage,
          variant: "destructive",
          duration: 4000,
        });
      }
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
        onAnalyzeReference={analyzeReference}
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
