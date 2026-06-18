"use client";

import { useEffect, useMemo, useRef, useState } from "react";
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
  Sparkles,
  Wand2,
  X,
} from "lucide-react";
import { AnimatePresence, motion } from "motion/react";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { cn } from "@/lib/utils";
import { generateFilePreview, normalizeImageForUpload } from "@/lib/file-utils";

type FormMode = "new-story" | "new-page";
type RefKind = "adult" | "child" | "dog" | "cat" | "object" | "unknown";
type RefStatus = "ready" | "checking" | "warning" | "blocked" | "selected";
type WorkflowPhase =
  | "compose"
  | "validating-photos"
  | "photo-warning"
  | "prompt-issue"
  | "ready"
  | "generating-story"
  | "generating-image"
  | "complete";

type ReferenceItem = {
  id: string;
  name: string;
  kind: RefKind;
  status: RefStatus;
  selected: boolean;
  source: "existing" | "uploaded" | "mock";
  previewUrl?: string;
  gradient?: string;
  note?: string;
};

export type ComicGenerationFormProps = {
  mode: FormMode;
  title: string;
  description?: string;
  submitLabel?: string;
  existingReferences?: ReferenceItem[];
  pageNumber?: number;
  demo?: boolean;
};

const INITIAL_PROMPT =
  "A masked city acrobat chasing a clockwork thief across rainy rooftops, cinematic panels, expressive dialogue.";

const BAD_PROMPT =
  "Make Spider-Man fight Batman while a famous movie robot saves the city.";

const FIXED_PROMPT =
  "An original masked rooftop acrobat clashes with a shadowy detective and a handmade rescue automaton above a rain-lit city.";

const styles = [
  {
    name: "American Modern",
    gradient: "from-blue-700 via-red-600 to-yellow-400",
  },
  {
    name: "Manga",
    gradient: "from-slate-950 via-slate-600 to-slate-100",
  },
  {
    name: "Retro Noir",
    gradient: "from-stone-950 via-amber-900 to-stone-600",
  },
  {
    name: "Indie Vector",
    gradient: "from-cyan-400 via-violet-500 to-pink-400",
  },
];

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
    previewUrl,
    note: "JPEG normalized",
  };
}

export function ComicGenerationForm({
  mode,
  title,
  description,
  submitLabel,
  existingReferences = defaultReferences,
  pageNumber,
  demo = false,
}: ComicGenerationFormProps) {
  const [prompt, setPrompt] = useState(mode === "new-story" ? "" : INITIAL_PROMPT);
  const [phase, setPhase] = useState<WorkflowPhase>("compose");
  const [references, setReferences] = useState<ReferenceItem[]>(existingReferences);
  const [issue, setIssue] = useState<{ kind: "photo" | "prompt"; message: string } | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [selectedStyle, setSelectedStyle] = useState(styles[0]);
  const [isStyleOpen, setIsStyleOpen] = useState(false);
  const [previewReference, setPreviewReference] = useState<ReferenceItem | null>(null);
  const [resultTitle, setResultTitle] = useState("");
  const fileInputRef = useRef<HTMLInputElement>(null);
  const runIdRef = useRef(0);

  const selectedReferences = useMemo(
    () => references.filter((reference) => reference.selected),
    [references],
  );
  const currentPhase = phaseCopy[phase];
  const isGenerating = phase === "generating-story" || phase === "generating-image";

  useEffect(() => {
    setReferences(existingReferences);
    setPrompt(mode === "new-story" ? "" : INITIAL_PROMPT);
    setPhase("compose");
    setIssue(null);
    setResultTitle("");
  }, [existingReferences, mode]);

  const toggleReference = (id: string) => {
    setReferences((current) =>
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
      setReferences((current) => [...current, ...prepared].slice(-4));
    }
  };

  const resetDemo = () => {
    runIdRef.current += 1;
    setIsPlaying(false);
    setPrompt(mode === "new-story" ? "" : INITIAL_PROMPT);
    setReferences(existingReferences);
    setPhase("compose");
    setIssue(null);
    setResultTitle("");
  };

  const playDemo = async () => {
    const runId = runIdRef.current + 1;
    runIdRef.current = runId;
    setIsPlaying(true);
    setResultTitle("");
    setPrompt("");
    setReferences(existingReferences);
    setIssue(null);
    setPhase("compose");
    await wait(450);
    if (runIdRef.current !== runId) return;

    setPrompt(BAD_PROMPT);
    setReferences((current) => [...demoReferences, ...current].slice(0, 4));
    await wait(700);
    if (runIdRef.current !== runId) return;

    setPhase("validating-photos");
    await wait(900);
    if (runIdRef.current !== runId) return;

    setReferences((current) =>
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
    await wait(1300);
    if (runIdRef.current !== runId) return;

    setIssue({
      kind: "prompt",
      message: "The prompt uses protected character names. Replace them with original descriptions.",
    });
    setPhase("prompt-issue");
    await wait(1500);
    if (runIdRef.current !== runId) return;

    setPrompt(FIXED_PROMPT);
    setIssue(null);
    setPhase("ready");
    await wait(700);
    if (runIdRef.current !== runId) return;

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
    setIssue(null);
    setPhase("validating-photos");
    await wait(500);

    if (prompt.toLowerCase().includes("spider") || prompt.toLowerCase().includes("batman")) {
      setIssue({
        kind: "prompt",
        message: "Use original character descriptions before generating.",
      });
      setPhase("prompt-issue");
      return;
    }

    setPhase("ready");
    await wait(250);
    setPhase(mode === "new-story" ? "generating-story" : "generating-image");
  };

  return (
    <section className="w-full">
      <div className="mb-3 flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-xs font-medium uppercase tracking-[0.12em] text-muted-foreground">
            {mode === "new-story" ? "New story" : `Page ${pageNumber ?? "next"}`}
          </p>
          <h2 className="mt-1 text-balance text-xl font-semibold text-white">{title}</h2>
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

      <div className="glass-panel rounded-xl p-0.5 sm:p-1">
        <div className="rounded-lg border border-border/50 bg-background/80 p-3 sm:p-4">
          <div className="mb-2 flex items-center justify-between">
            <label className="text-[10px] font-medium uppercase tracking-[0.02em] text-muted-foreground">
              Prompt
            </label>
            <span className="text-[10px] tabular-nums text-muted-foreground/70">
              {prompt.length}/5000
            </span>
          </div>

          <textarea
            value={prompt}
            onChange={(event) => setPrompt(event.target.value.slice(0, 5000))}
            placeholder={
              mode === "new-story"
                ? "A cyberpunk detective standing in neon rain, holding a glowing datapad..."
                : "Continue the story... Describe what happens next."
            }
            className="h-16 w-full resize-none border-none bg-transparent text-sm leading-relaxed text-white outline-none placeholder:text-muted-foreground/50"
          />

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
                  {references.length < 4 && (
                    <UploadButton onClick={() => fileInputRef.current?.click()} />
                  )}
                </div>
              ) : (
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  className="flex min-h-8 items-center gap-2 text-xs text-muted-foreground transition-colors hover:text-white"
                >
                  <ImagePlus className="h-3.5 w-3.5" />
                  <span>Upload Characters</span>
                  <span className="hidden text-muted-foreground/50 sm:inline">(Max 4)</span>
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
              <button
                type="button"
                onClick={() => setIsStyleOpen((current) => !current)}
                className="flex min-h-8 items-center gap-2 rounded-md px-2.5 py-1.5 text-xs text-muted-foreground transition-colors hover:text-white"
              >
                <span className={cn("h-4 w-4 shrink-0 rounded bg-gradient-to-br", selectedStyle.gradient)} />
                <span>{selectedStyle.name}</span>
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
                      {styles.map((style) => {
                        const isSelected = selectedStyle.name === style.name;
                        return (
                          <button
                            key={style.name}
                            type="button"
                            onClick={() => {
                              setSelectedStyle(style);
                              setIsStyleOpen(false);
                            }}
                            className={cn(
                              "relative aspect-square overflow-hidden rounded-lg border-2 text-left transition-colors",
                              isSelected ? "border-white" : "border-transparent hover:border-white/30",
                            )}
                          >
                            <div className={cn("absolute inset-0 bg-gradient-to-br", style.gradient)} />
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
          </div>
        </div>
      </div>

      <div className="mt-3 rounded-lg border border-border/50 bg-background/45 p-3">
        <div className="flex items-center justify-between gap-3">
          <div className="min-w-0">
            <p className="truncate text-sm font-medium text-white">{currentPhase.label}</p>
            <p className="mt-0.5 truncate text-xs text-muted-foreground">{currentPhase.detail}</p>
          </div>
          <span className="shrink-0 text-xs tabular-nums text-muted-foreground">
            {currentPhase.progress}%
          </span>
        </div>
        <Progress value={currentPhase.progress} className="mt-3 h-1.5 bg-white/10" />
      </div>

      <AnimatePresence initial={false}>
        {issue && (
          <motion.div
            key={`${issue.kind}-${issue.message}`}
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -4 }}
            transition={{ type: "spring", duration: 0.3, bounce: 0 }}
            className={cn(
              "mt-3 flex items-start gap-3 rounded-lg p-3 text-sm",
              issue.kind === "prompt"
                ? "bg-red-500/10 text-red-100"
                : "bg-amber-500/10 text-amber-100",
            )}
          >
            <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
            <div>
              <p className="font-medium">
                {issue.kind === "prompt" ? "Prompt needs a fix" : "Reference note"}
              </p>
              <p className="mt-1 leading-relaxed text-current/75">{issue.message}</p>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <AnimatePresence initial={false}>
        {phase === "complete" && (
          <motion.div
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -6 }}
            transition={{ type: "spring", duration: 0.3, bounce: 0 }}
            className="mt-3 flex gap-3 rounded-lg bg-emerald/10 p-3"
          >
            <div className="relative h-20 w-14 shrink-0 overflow-hidden rounded bg-gradient-to-br from-cyan-300 via-indigo-500 to-rose-500" />
            <div className="flex min-w-0 flex-col justify-center">
              <p className="truncate text-sm font-medium text-white">{resultTitle}</p>
              <p className="mt-1 text-sm leading-relaxed text-muted-foreground">
                This is the shared post-generation result state.
              </p>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <div className="mt-4 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div className="text-xs text-muted-foreground">
          {selectedReferences.length} selected reference{selectedReferences.length === 1 ? "" : "s"}
        </div>
        <Button
          type="button"
          onClick={handleSubmit}
          disabled={!prompt.trim() || isGenerating}
          className="bg-white text-black transition-transform hover:bg-neutral-200 active:scale-[0.96]"
        >
          {isGenerating ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
          {submitLabel ?? (mode === "new-story" ? "Create story" : "Generate page")}
          <ArrowRight className="h-4 w-4" />
        </Button>
      </div>

      {previewReference && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4 backdrop-blur-sm"
          onClick={() => setPreviewReference(null)}
        >
          <div className="relative max-h-[80vh] max-w-sm rounded-xl bg-background p-4 shadow-2xl">
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="absolute right-2 top-2 h-8 w-8 hover:bg-white/10"
              onClick={() => setPreviewReference(null)}
            >
              <X className="h-4 w-4" />
            </Button>
            <div className="h-72 w-60 overflow-hidden rounded-lg">
              <ReferenceSwatch reference={previewReference} />
            </div>
          </div>
        </div>
      )}
    </section>
  );
}

function ReferenceSwatch({ reference }: { reference: ReferenceItem }) {
  if (reference.previewUrl) {
    return (
      <img
        src={reference.previewUrl}
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
