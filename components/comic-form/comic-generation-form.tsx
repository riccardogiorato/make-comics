"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import {
  AlertTriangle,
  ArrowRight,
  Check,
  ChevronDown,
  ImagePlus,
  Loader2,
  Pause,
  Play,
  RefreshCcw,
  Wand2,
  X,
} from "lucide-react";
import { AnimatePresence, motion } from "motion/react";
import { Button } from "@/components/ui/button";
import { FEATURED_STYLES } from "@/lib/constants";
import { MAX_USER_PROMPT } from "@/lib/prompt";
import { cn } from "@/lib/utils";
import { generateFilePreview, normalizeImageForUpload } from "@/lib/file-utils";

type FormMode = "new-story" | "new-page";
export type RefKind = "adult" | "child" | "dog" | "cat" | "object" | "unknown";
export type RefStatus = "ready" | "checking" | "warning" | "blocked" | "selected";
type WorkflowPhase =
  | "compose"
  | "validating-photos"
  | "photo-warning"
  | "prompt-issue"
  | "ready"
  | "generating-story"
  | "generating-image"
  | "complete";

export type ReferenceItem = {
  id: string;
  name: string;
  kind: RefKind;
  status: RefStatus;
  selected: boolean;
  source: "existing" | "uploaded" | "mock";
  file?: File;
  url?: string;
  previewUrl?: string;
  gradient?: string;
  note?: string;
};

export type ComicGenerationSubmitData = {
  prompt: string;
  style: string;
  references: ReferenceItem[];
};

export type ComicGenerationFormProps = {
  mode: FormMode;
  title: string;
  description?: string;
  submitLabel?: string;
  prompt?: string;
  onPromptChange?: (prompt: string) => void;
  style?: string;
  onStyleChange?: (style: string) => void;
  existingReferences?: ReferenceItem[];
  references?: ReferenceItem[];
  onReferencesChange?: (references: ReferenceItem[]) => void;
  maxReferences?: number;
  disabled?: boolean;
  isSubmitting?: boolean;
  autoFocusPrompt?: boolean;
  onSubmit?: (data: ComicGenerationSubmitData) => void | Promise<void>;
  pageNumber?: number;
  demo?: boolean;
  footer?: ReactNode;
};

const INITIAL_PROMPT =
  "A masked city acrobat chasing a clockwork thief across rainy rooftops, cinematic panels, expressive dialogue.";

const BAD_PROMPT =
  "Make Spider-Man fight Batman while a famous movie robot saves the city.";

const FIXED_PROMPT =
  "An original masked rooftop acrobat clashes with a shadowy detective and a handmade rescue automaton above a rain-lit city.";

const STYLE_GRADIENTS: Record<string, string> = {
  "american-modern": "from-blue-700 via-red-600 to-yellow-400",
  manga: "from-slate-950 via-slate-600 to-slate-100",
  "retro-noir": "from-stone-950 via-amber-900 to-stone-600",
  "indie-vector": "from-cyan-400 via-violet-500 to-pink-400",
};

const defaultReferences: ReferenceItem[] = [];

const demoReferences: ReferenceItem[] = [
  {
    id: "demo-child",
    name: "Uploaded WebP",
    kind: "child",
    status: "checking",
    selected: true,
    source: "mock",
    gradient: "from-pink-300 via-rose-400 to-purple-900",
    note: "checking",
  },
  {
    id: "demo-object",
    name: "Toy prop",
    kind: "object",
    status: "checking",
    selected: true,
    source: "mock",
    gradient: "from-lime-300 via-emerald-500 to-cyan-900",
    note: "checking",
  },
];

const phaseCopy: Record<WorkflowPhase, { label: string; detail: string; progress: number }> = {
  compose: {
    label: "Ready to compose",
    detail: "Write a prompt, pick a style, and add optional references.",
    progress: 8,
  },
  "validating-photos": {
    label: "Analyzing references",
    detail: "Checking who or what appears in selected images.",
    progress: 30,
  },
  "photo-warning": {
    label: "Reference note",
    detail: "This is non-blocking; the flow can continue after the note.",
    progress: 42,
  },
  "prompt-issue": {
    label: "Prompt needs changes",
    detail: "Generation is paused until the prompt is fixed.",
    progress: 50,
  },
  ready: {
    label: "Checks passed",
    detail: "References and prompt are ready for generation.",
    progress: 64,
  },
  "generating-story": {
    label: "Planning story",
    detail: "Creating title, page idea, and panel beats.",
    progress: 78,
  },
  "generating-image": {
    label: "Drawing image",
    detail: "Rendering the comic page with selected references.",
    progress: 92,
  },
  complete: {
    label: "Complete",
    detail: "The generated result is ready for review.",
    progress: 100,
  },
};

const wait = (ms: number) => new Promise((resolve) => window.setTimeout(resolve, ms));

function createReferenceFromFile(file: File, previewUrl: string): ReferenceItem {
  return {
    id: `${file.name}-${file.lastModified}`,
    name: file.name.replace(/\.[^.]+$/, "") || "Reference",
    kind: "unknown",
    status: "ready",
    selected: true,
    source: "uploaded",
    file,
    previewUrl,
    note: "JPEG normalized",
  };
}

export function ComicGenerationForm({
  mode,
  title,
  description,
  submitLabel,
  prompt: controlledPrompt,
  onPromptChange,
  style: controlledStyle,
  onStyleChange,
  existingReferences = defaultReferences,
  references: controlledReferences,
  onReferencesChange,
  maxReferences = 4,
  disabled = false,
  isSubmitting = false,
  autoFocusPrompt = false,
  onSubmit,
  pageNumber,
  demo = false,
  footer,
}: ComicGenerationFormProps) {
  const [internalPrompt, setInternalPrompt] = useState(mode === "new-story" ? "" : INITIAL_PROMPT);
  const [phase, setPhase] = useState<WorkflowPhase>("compose");
  const [internalReferences, setInternalReferences] = useState<ReferenceItem[]>(existingReferences);
  const [issue, setIssue] = useState<{ kind: "photo" | "prompt"; message: string } | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [internalStyle, setInternalStyle] = useState(FEATURED_STYLES[0]?.id ?? "american-modern");
  const [isStyleOpen, setIsStyleOpen] = useState(false);
  const [previewReference, setPreviewReference] = useState<ReferenceItem | null>(null);
  const [resultTitle, setResultTitle] = useState("");
  const promptRef = useRef<HTMLTextAreaElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const runIdRef = useRef(0);
  const hasHeader = Boolean(title || description || demo);

  const prompt = controlledPrompt ?? internalPrompt;
  const references = controlledReferences ?? internalReferences;
  const selectedStyleId = controlledStyle ?? internalStyle;
  const selectedStyle = FEATURED_STYLES.find((style) => style.id === selectedStyleId) ?? FEATURED_STYLES[0];
  const currentPhase = phaseCopy[phase];
  const isGenerating = phase === "generating-story" || phase === "generating-image";
  const isWorking = phase === "validating-photos" || isGenerating || isSubmitting;
  const issueOverlay = issue
    ? {
        key: `${issue.kind}-${issue.message}`,
        tone: issue.kind,
        title: issue.kind === "prompt" ? "Prompt needs a fix" : "Reference note",
        detail: issue.message,
      }
    : null;
  const busyOverlay = !issue && (isGenerating || phase === "complete")
    ? {
        key: "workflow-overlay",
        tone: phase === "complete" ? "success" as const : "checking" as const,
        title: phase === "complete" ? resultTitle : currentPhase.label,
        detail: phase === "complete" ? "Ready for review." : currentPhase.detail,
        progress: currentPhase.progress,
      }
    : null;

  useEffect(() => {
    if (!controlledReferences) {
      setInternalReferences(existingReferences);
    }
    if (controlledPrompt === undefined) {
      setInternalPrompt(mode === "new-story" ? "" : INITIAL_PROMPT);
    }
    setPhase("compose");
    setIssue(null);
    setResultTitle("");
  }, [controlledPrompt, controlledReferences, existingReferences, mode]);

  useEffect(() => {
    if (!autoFocusPrompt || disabled || isWorking) return;

    const frame = window.requestAnimationFrame(() => {
      promptRef.current?.focus();
    });

    return () => window.cancelAnimationFrame(frame);
  }, [autoFocusPrompt, disabled, isWorking]);

  const updatePrompt = (nextPrompt: string) => {
    if (controlledPrompt === undefined) {
      setInternalPrompt(nextPrompt);
    }
    onPromptChange?.(nextPrompt);
  };

  const updateReferences = (nextReferences: ReferenceItem[] | ((current: ReferenceItem[]) => ReferenceItem[])) => {
    const resolved = typeof nextReferences === "function" ? nextReferences(references) : nextReferences;
    if (!controlledReferences) {
      setInternalReferences(resolved);
    }
    onReferencesChange?.(resolved);
  };

  const updateStyle = (nextStyle: string) => {
    if (controlledStyle === undefined) {
      setInternalStyle(nextStyle);
    }
    onStyleChange?.(nextStyle);
  };

  const toggleReference = (id: string) => {
    if (disabled || isWorking) return;
    updateReferences((current) =>
      current.map((reference) =>
        reference.id === id
          ? { ...reference, selected: !reference.selected, status: !reference.selected ? "selected" : "ready" }
          : reference,
      ),
    );
  };

  const handleUpload = async (files: FileList | null) => {
    if (!files) return;

    const prepared: ReferenceItem[] = [];
    for (const file of Array.from(files)) {
      try {
        const normalized = await normalizeImageForUpload(file);
        const previewUrl = await generateFilePreview(normalized);
        prepared.push(createReferenceFromFile(normalized, previewUrl));
      } catch (error) {
        setIssue({
          kind: "photo",
          message: error instanceof Error ? error.message : "Could not prepare image.",
        });
        setPhase("photo-warning");
        window.setTimeout(() => {
          setIssue(null);
          setPhase("compose");
        }, 5000);
      }
    }

    if (prepared.length > 0) {
      updateReferences((current) => [...current, ...prepared].slice(-maxReferences));
    }
  };

  const resetDemo = () => {
    runIdRef.current += 1;
    setIsPlaying(false);
    updatePrompt(mode === "new-story" ? "" : INITIAL_PROMPT);
    updateReferences(existingReferences);
    setPhase("compose");
    setIssue(null);
    setResultTitle("");
  };

  const playDemo = async () => {
    const runId = runIdRef.current + 1;
    runIdRef.current = runId;
    setIsPlaying(true);
    setResultTitle("");
    updatePrompt("");
    updateReferences(existingReferences);
    setIssue(null);
    setPhase("compose");
    await wait(450);
    if (runIdRef.current !== runId) return;

    updatePrompt(BAD_PROMPT);
    updateReferences((current) => [...demoReferences, ...current].slice(0, 4));
    await wait(700);
    if (runIdRef.current !== runId) return;

    setPhase("validating-photos");
    await wait(900);
    if (runIdRef.current !== runId) return;

    updateReferences((current) =>
      current.map((reference) =>
        reference.id === "demo-child"
          ? { ...reference, status: "warning", note: "child; broad traits only" }
          : reference.id === "demo-object"
            ? { ...reference, status: "ready", note: "object prop" }
            : reference,
      ),
    );
    setIssue({
      kind: "photo",
      message: "A child reference was detected. We will use broad, non-identifying traits and continue.",
    });
    setPhase("photo-warning");
    await wait(2800);
    if (runIdRef.current !== runId) return;

    setIssue({
      kind: "prompt",
      message: "The prompt uses protected character names. Replace them with original descriptions.",
    });
    setPhase("prompt-issue");
    await wait(3400);
    if (runIdRef.current !== runId) return;

    updatePrompt(FIXED_PROMPT);
    setIssue(null);
    setPhase("generating-story");
    await wait(1000);
    if (runIdRef.current !== runId) return;

    setPhase("generating-image");
    await wait(1300);
    if (runIdRef.current !== runId) return;

    setResultTitle(mode === "new-story" ? "Rainline Acrobat" : `Page ${pageNumber ?? 3} generated`);
    setPhase("complete");
    setIsPlaying(false);
  };

  const handleSubmit = async () => {
    if (disabled || isWorking || !prompt.trim()) return;
    setIssue(null);
    setPhase("validating-photos");

    if (onSubmit) {
      try {
        await onSubmit({
          prompt,
          style: selectedStyleId,
          references: references.filter((reference) => reference.selected),
        });
        setIssue(null);
        setPhase("compose");
      } catch (error) {
        setIssue({
          kind: "prompt",
          message: error instanceof Error ? error.message : "Could not start generation.",
        });
        setPhase("prompt-issue");
      }
      return;
    }

    await wait(500);
    setPhase("ready");
    await wait(250);
    setPhase(mode === "new-story" ? "generating-story" : "generating-image");
  };

  return (
    <section className="w-full">
      {hasHeader && (
        <div className="mb-3 flex items-start justify-between gap-3">
          <div className="min-w-0">
            {(title || description) && (
              <p className="text-xs font-medium uppercase tracking-[0.12em] text-muted-foreground">
                {mode === "new-story" ? "New story" : `Page ${pageNumber ?? "next"}`}
              </p>
            )}
            {title && <h2 className="mt-1 text-balance text-xl font-semibold text-white">{title}</h2>}
            {description && (
              <p className="mt-1 max-w-xl text-pretty text-sm leading-relaxed text-muted-foreground">
                {description}
              </p>
            )}
          </div>

          {demo && (
            <div className="flex shrink-0 items-center gap-2">
              <Button
                type="button"
                size="sm"
                onClick={playDemo}
                disabled={isPlaying}
                className="bg-white text-black transition-transform hover:bg-neutral-200 active:scale-[0.96]"
              >
                {isPlaying ? <Pause className="h-4 w-4" /> : <Play className="h-4 w-4" />}
                Play
              </Button>
              <Button
                type="button"
                size="icon-sm"
                variant="outline"
                onClick={resetDemo}
                className="border-border/70 transition-transform hover:bg-secondary active:scale-[0.96]"
              >
                <RefreshCcw className="h-4 w-4" />
              </Button>
            </div>
          )}
        </div>
      )}

      <div className="glass-panel rounded-xl p-0.5 sm:p-1">
        <div className="relative overflow-visible rounded-lg border border-border/50 bg-background/80 p-3 sm:p-4">
          <div className="mb-2 flex items-center justify-between">
            <label className="text-[10px] font-medium uppercase tracking-[0.02em] text-muted-foreground">
              Prompt
            </label>
            <span className="text-[10px] tabular-nums text-muted-foreground/70">
              {prompt.length}/{MAX_USER_PROMPT}
            </span>
          </div>

          <textarea
            ref={promptRef}
            value={prompt}
            onChange={(event) => updatePrompt(event.target.value.slice(0, MAX_USER_PROMPT))}
            disabled={disabled || isWorking}
            maxLength={MAX_USER_PROMPT}
            placeholder={
              mode === "new-story"
                ? "A cyberpunk detective standing in neon rain, holding a glowing datapad..."
                : "Continue the story... Describe what happens next."
            }
            className="h-16 w-full resize-none border-none bg-transparent text-sm leading-relaxed text-white outline-none placeholder:text-muted-foreground/50 disabled:cursor-not-allowed disabled:opacity-50"
          />

          <div className="pointer-events-none absolute inset-x-3 top-3 z-30 sm:inset-x-4">
            <AnimatePresence mode="popLayout" initial={false}>
              {issueOverlay && (
                <motion.div
                  key={issueOverlay.key}
                  initial={{ opacity: 0, y: -8, scale: 0.98, filter: "blur(4px)" }}
                  animate={{ opacity: 1, y: 0, scale: 1, filter: "blur(0px)" }}
                  exit={{ opacity: 0, y: -8, scale: 0.98, filter: "blur(4px)" }}
                  transition={{ type: "spring", duration: 0.3, bounce: 0 }}
                  className={cn(
                    "mx-auto flex w-fit max-w-[min(28rem,calc(100%-0.5rem))] items-start gap-2 rounded-md px-3 py-2.5 text-xs leading-relaxed shadow-[0_12px_36px_rgba(0,0,0,0.32),0_0_0_1px_rgba(255,255,255,0.08)] backdrop-blur-md sm:ml-auto sm:mr-0",
                    issueOverlay.tone === "prompt" && "bg-red-950/92 text-red-100",
                    issueOverlay.tone === "photo" && "bg-amber-950/92 text-amber-100",
                  )}
                >
                  <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                  <span className="min-w-0">
                    <span className="block font-medium text-white">{issueOverlay.title}</span>
                    <span className="mt-0.5 block text-pretty text-current/80">{issueOverlay.detail}</span>
                  </span>
                </motion.div>
              )}
            </AnimatePresence>
          </div>

          <AnimatePresence initial={false}>
            {busyOverlay && (
              <motion.div
                key={busyOverlay.key}
                initial={{ opacity: 0, scale: 0.985, filter: "blur(4px)" }}
                animate={{ opacity: 1, scale: 1, filter: "blur(0px)" }}
                exit={{ opacity: 0, scale: 0.985, filter: "blur(4px)" }}
                transition={{ type: "spring", duration: 0.3, bounce: 0 }}
                className="absolute inset-0 z-20 flex flex-col items-center justify-center rounded-lg bg-background/92 px-6 text-center backdrop-blur-md"
              >
                <motion.div
                  key={`${busyOverlay.key}-icon`}
                  initial={{ opacity: 0, scale: 0.25, filter: "blur(4px)" }}
                  animate={{ opacity: 1, scale: 1, filter: "blur(0px)" }}
                  exit={{ opacity: 0, scale: 0.25, filter: "blur(4px)" }}
                  transition={{ type: "spring", duration: 0.3, bounce: 0 }}
                  className={cn(
                    "mb-4 flex h-12 w-12 items-center justify-center rounded-full shadow-[0_0_0_1px_rgba(255,255,255,0.08)]",
                    busyOverlay.tone === "success" ? "bg-emerald/15 text-emerald" : "bg-white/8 text-white",
                  )}
                >
                  {busyOverlay.tone === "success" ? (
                    <Check className="h-5 w-5" />
                  ) : (
                    <Loader2 className="h-5 w-5 animate-spin" />
                  )}
                </motion.div>
                <motion.p
                  key={`${busyOverlay.key}-title`}
                  initial={{ opacity: 0, y: 6 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -4 }}
                  transition={{ type: "spring", duration: 0.3, bounce: 0, delay: 0.03 }}
                  className="text-sm font-medium text-white"
                >
                  {busyOverlay.title}
                </motion.p>
                <motion.p
                  initial={{ opacity: 0, y: 6 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -4 }}
                  transition={{ type: "spring", duration: 0.3, bounce: 0, delay: 0.06 }}
                  className="mt-1 max-w-sm text-pretty text-xs leading-relaxed text-muted-foreground"
                >
                  {busyOverlay.detail}
                </motion.p>
                <div className="mt-5 h-1.5 w-full max-w-xs overflow-hidden rounded-full bg-white/10">
                  <motion.div
                    className={cn(
                      "h-full rounded-full",
                      busyOverlay.tone === "success" ? "bg-emerald" : "bg-white",
                    )}
                    initial={false}
                    animate={{ width: `${busyOverlay.progress}%` }}
                    transition={{ type: "spring", duration: 0.5, bounce: 0 }}
                  />
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          <div className="mt-3 flex flex-col gap-3 border-t border-border/30 pt-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex min-w-0 flex-1 items-center gap-2">
              {references.length > 0 ? (
                <div className="flex min-w-0 items-center gap-2">
                  {references.map((reference) => (
                    <div key={reference.id} className="group/thumb relative">
                      <button
                        type="button"
                        onClick={() => toggleReference(reference.id)}
                        onDoubleClick={() => setPreviewReference(reference)}
                        className={cn(
                          "relative h-8 w-8 overflow-hidden rounded-md border transition-colors active:scale-[0.96]",
                          reference.selected
                            ? "border-white"
                            : "border-border/50 hover:border-indigo/50",
                        )}
                        title="Click to select, double-click to preview"
                      >
                        <ReferenceSwatch reference={reference} />
                        <ReferenceStatusIcon status={reference.status} selected={reference.selected} />
                      </button>
                      <button
                        type="button"
                        onClick={() => setPreviewReference(reference)}
                        className="absolute inset-0 rounded-md opacity-0"
                        tabIndex={-1}
                        aria-hidden="true"
                      />
                    </div>
                  ))}
                  {references.length < maxReferences && (
                    <UploadButton onClick={() => fileInputRef.current?.click()} />
                  )}
                </div>
              ) : (
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  disabled={disabled || isWorking}
                  className="flex min-h-8 items-center gap-2 text-xs text-muted-foreground transition-colors hover:text-white"
                >
                  <ImagePlus className="h-3.5 w-3.5" />
                  <span>Upload Characters</span>
                  <span className="hidden text-muted-foreground/50 sm:inline">(Max {maxReferences})</span>
                </button>
              )}
              <input
                ref={fileInputRef}
                type="file"
                accept="image/png,image/jpeg,image/jpg,image/webp"
                multiple
                className="hidden"
                onChange={(event) => handleUpload(event.target.files)}
              />
            </div>

            <div className="relative shrink-0">
              <div className="flex items-center gap-2">
                <div className="relative">
                  <button
                    type="button"
                    onClick={() => !disabled && !isWorking && setIsStyleOpen((current) => !current)}
                    disabled={disabled || isWorking}
                    className="flex min-h-8 items-center gap-2 rounded-md px-2.5 py-1.5 text-xs text-muted-foreground transition-colors hover:text-white"
                  >
                    {selectedStyle?.image ? (
                      <img src={selectedStyle.image} alt={selectedStyle.name} className="h-4 w-4 shrink-0 rounded object-cover" />
                    ) : (
                      <span className={cn("h-4 w-4 shrink-0 rounded bg-gradient-to-br", STYLE_GRADIENTS[selectedStyleId])} />
                    )}
                    <span>{selectedStyle?.name ?? "Style"}</span>
                    <ChevronDown className="h-3.5 w-3.5" />
                  </button>

                  <AnimatePresence initial={false}>
                    {isStyleOpen && (
                      <motion.div
                        initial={{ opacity: 0, y: 4 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: 4 }}
                        transition={{ type: "spring", duration: 0.3, bounce: 0 }}
                        className="absolute right-0 top-full z-20 mt-2 w-52 rounded-xl border border-border/50 bg-background p-3 shadow-2xl"
                      >
                        <p className="mb-2 text-[10px] font-medium uppercase tracking-[0.08em] text-muted-foreground">
                          Style
                        </p>
                        <div className="grid grid-cols-2 gap-1.5">
                          {FEATURED_STYLES.map((style) => {
                            const isSelected = selectedStyleId === style.id;
                            return (
                              <button
                                key={style.id}
                                type="button"
                                onClick={() => {
                                  updateStyle(style.id);
                                  setIsStyleOpen(false);
                                }}
                                className={cn(
                                  "relative aspect-square overflow-hidden rounded-lg border-2 text-left transition-colors",
                                  isSelected ? "border-white" : "border-transparent hover:border-white/30",
                                )}
                              >
                                {style.image ? (
                                  <img src={style.image} alt={style.name} className="absolute inset-0 h-full w-full object-cover" />
                                ) : (
                                  <div className={cn("absolute inset-0 bg-gradient-to-br", STYLE_GRADIENTS[style.id])} />
                                )}
                                <div className="absolute inset-0 bg-gradient-to-t from-black/70 to-transparent" />
                                <span className="absolute bottom-1.5 left-1.5 right-1.5 text-[10px] font-medium leading-tight text-white">
                                  {style.name}
                                </span>
                                {isSelected && (
                                  <span className="absolute right-1.5 top-1.5 flex h-4 w-4 items-center justify-center rounded-full bg-white">
                                    <Check className="h-2.5 w-2.5 text-black" />
                                  </span>
                                )}
                              </button>
                            );
                          })}
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>

                <Button
                  type="button"
                  size="sm"
                  onClick={handleSubmit}
                  disabled={!prompt.trim() || isWorking}
                  className="h-8 bg-white text-black transition-transform hover:bg-neutral-200 active:scale-[0.96]"
                >
                  {isWorking && <Loader2 className="h-4 w-4 animate-spin" />}
                  {submitLabel ?? (mode === "new-story" ? "Create story" : "Generate page")}
                  <ArrowRight className="h-4 w-4" />
                </Button>
              </div>
            </div>
          </div>
        </div>
      </div>
      {footer && <div className="pt-3">{footer}</div>}

      <AnimatePresence initial={false}>
        {previewReference && (
          <motion.div
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/45 p-4 backdrop-blur-[2px]"
            onClick={() => setPreviewReference(null)}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.18 }}
          >
            <motion.div
              className="relative rounded-[18px] bg-background/95 p-2 shadow-[0_22px_70px_rgba(0,0,0,0.45),0_0_0_1px_rgba(255,255,255,0.08)]"
              onClick={(event) => event.stopPropagation()}
              initial={{ opacity: 0, y: 8, scale: 0.96, filter: "blur(4px)" }}
              animate={{ opacity: 1, y: 0, scale: 1, filter: "blur(0px)" }}
              exit={{ opacity: 0, y: 6, scale: 0.98, filter: "blur(4px)" }}
              transition={{ type: "spring", duration: 0.3, bounce: 0 }}
            >
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="absolute -right-3 -top-3 z-10 h-10 w-10 rounded-full bg-neutral-950/90 text-white shadow-[0_8px_24px_rgba(0,0,0,0.35),0_0_0_1px_rgba(255,255,255,0.12)] backdrop-blur-md transition-transform hover:bg-neutral-900 active:scale-[0.96]"
                onClick={() => setPreviewReference(null)}
                aria-label="Close preview"
              >
                <X className="h-4 w-4" />
              </Button>
              <div className="h-56 w-44 overflow-hidden rounded-xl shadow-[0_0_0_1px_rgba(255,255,255,0.08)] sm:h-64 sm:w-52">
                <ReferenceSwatch reference={previewReference} />
              </div>
              <p className="max-w-44 truncate px-1 pb-1 pt-2 text-center text-xs text-muted-foreground sm:max-w-52">
                {previewReference.name}
              </p>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </section>
  );
}

function ReferenceSwatch({ reference }: { reference: ReferenceItem }) {
  if (reference.previewUrl || reference.url) {
    return (
      <img
        src={reference.previewUrl || reference.url}
        alt={reference.name}
        className="h-full w-full object-cover"
      />
    );
  }

  return <div className={cn("h-full w-full bg-gradient-to-br", reference.gradient)} />;
}


function UploadButton({ onClick }: { onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="flex h-8 w-8 items-center justify-center rounded-md border border-dashed border-border/50 text-muted-foreground transition-colors hover:border-indigo/50 hover:text-white"
    >
      <ImagePlus className="h-3.5 w-3.5" />
    </button>
  );
}

function ReferenceStatusIcon({
  status,
  selected,
}: {
  status: RefStatus;
  selected: boolean;
}) {
  return (
    <span
      className={cn(
        "absolute right-0.5 top-0.5 flex h-3.5 w-3.5 items-center justify-center rounded-full",
        selected ? "bg-white text-black" : "bg-black/55 text-white/80",
      )}
    >
      {status === "checking" ? (
        <Loader2 className="h-2.5 w-2.5 animate-spin" />
      ) : status === "warning" ? (
        <AlertTriangle className="h-2.5 w-2.5 text-amber-700" />
      ) : status === "blocked" ? (
        <X className="h-2.5 w-2.5 text-red-500" />
      ) : selected ? (
        <Check className="h-2.5 w-2.5" />
      ) : (
        <Wand2 className="h-2.5 w-2.5" />
      )}
    </span>
  );
}
