"use client";

import { useMemo, useState } from "react";
import {
  ArrowRight,
  Check,
  ImagePlus,
  Map,
  Pencil,
  Plus,
  Upload,
  Wand2,
  X,
} from "lucide-react";
import { Navbar } from "@/components/landing/navbar";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { FEATURED_STYLES } from "@/lib/constants";
import { cn } from "@/lib/utils";

type Preset = {
  id: string;
  name: string;
  description: string;
  prompt: string;
  image: string;
};

const SCENE_PRESETS: Preset[] = [
  {
    id: "cyberpunk-city",
    name: "Cyberpunk City",
    description: "Neon streets, rainy rooftops, holograms",
    prompt:
      "A bustling cyberpunk metropolis at night, neon lights reflecting off wet streets, holographic advertisements floating above crowded alleys, towering skyscrapers and flying vehicles overhead",
    image: "/style-pages/american-modern.jpg",
  },
  {
    id: "medieval-castle",
    name: "Medieval Castle",
    description: "Stone fortress, banners, mythical danger",
    prompt:
      "An ancient stone castle on a misty mountain peak, surrounded by dark forests, knights in shining armor, wind-torn banners, and a dragon circling through the clouds",
    image: "/style-pages/retro-noir.jpg",
  },
  {
    id: "space-station",
    name: "Space Station",
    description: "Zero gravity, starships, cosmic views",
    prompt:
      "A massive space station orbiting a distant planet, astronauts floating in zero gravity, starships docked at glowing airlocks, and nebulae visible through huge observation windows",
    image: "/style-pages/indie-vector.jpg",
  },
  {
    id: "fantasy-forest",
    name: "Fantasy Forest",
    description: "Ancient trees, glowing ruins, magic",
    prompt:
      "A mystical enchanted forest with massive ancient trees, glowing runes carved into bark, magical creatures peeking through mist, and floating lanterns winding along a hidden path",
    image: "/style-pages/manga.jpg",
  },
];

const STORY_PRESETS: Preset[] = [
  {
    id: "hero-journey",
    name: "Hero's Journey",
    description: "A reluctant hero discovers their calling",
    prompt:
      "A classic hero's journey where the protagonist discovers their destiny, faces escalating trials, protects others, and grows into a true hero",
    image: "/comic-book-superhero-action-scene-noir-style-dark-.jpg",
  },
  {
    id: "villain-origin",
    name: "Villain Origin",
    description: "The lead becomes the problem",
    prompt:
      "A dramatic villain-origin story where the protagonist makes one compromise too many, builds power through clever schemes, and becomes the threat everyone fears",
    image: "/noir.jpg",
  },
  {
    id: "underdog-rise",
    name: "Underdog Rise",
    description: "An ordinary person becomes extraordinary",
    prompt:
      "An underdog story where an overlooked person discovers strange abilities, learns through mistakes, and finds the courage to face overwhelming odds",
    image: "/comic-book-rooftop-confrontation-superhero-villain.jpg",
  },
  {
    id: "mystery-detective",
    name: "Mystery Detective",
    description: "Clues, twists, and a hidden conspiracy",
    prompt:
      "A detective mystery filled with clues, false leads, tense confrontations, and a surprising conspiracy that the protagonist slowly uncovers",
    image: "/comic-book-next-scene-continuation.jpg",
  },
];

const STYLE_GRADIENTS: Record<string, string> = {
  "american-modern": "from-blue-700 via-red-600 to-yellow-400",
  manga: "from-slate-950 via-slate-600 to-slate-100",
  "retro-noir": "from-stone-950 via-amber-900 to-stone-600",
  "indie-vector": "from-cyan-400 via-violet-500 to-pink-400",
};

export default function DesignPresetPage() {
  const [scene, setScene] = useState<Preset | null>(SCENE_PRESETS[0]);
  const [story, setStory] = useState<Preset | null>(null);
  const [customScene, setCustomScene] = useState("");
  const [customStory, setCustomStory] = useState("");
  const [customMode, setCustomMode] = useState<"scene" | "story" | null>(null);
  const [customText, setCustomText] = useState("");
  const [userIdea, setUserIdea] = useState(
    "A shy kid and their handmade robot have to win the city parade before a rival inventor sabotages the route.",
  );
  const [styleId, setStyleId] = useState(FEATURED_STYLES[0]?.id ?? "american-modern");
  const [referenceCount, setReferenceCount] = useState(1);
  const [submitted, setSubmitted] = useState(false);

  const customScenePreset = customScene
    ? {
        id: "custom-scene",
        name: "Custom",
        description: summarize(customScene),
        prompt: customScene,
        image: "",
      }
    : null;
  const customStoryPreset = customStory
    ? {
        id: "custom-story",
        name: "Custom",
        description: summarize(customStory),
        prompt: customStory,
        image: "",
      }
    : null;

  const selectedStyle = FEATURED_STYLES.find((style) => style.id === styleId) ?? FEATURED_STYLES[0];
  const composedPrompt = useMemo(() => {
    return [
      scene ? `Scene: ${scene.prompt}` : "",
      story ? `Story inspiration: ${story.prompt}` : "",
      userIdea.trim() ? `Main idea: ${userIdea.trim()}` : "",
    ]
      .filter(Boolean)
      .join("\n\n");
  }, [scene, story, userIdea]);

  const openCustom = (mode: "scene" | "story") => {
    setCustomMode(mode);
    setCustomText(mode === "scene" ? customScene : customStory);
  };

  const saveCustom = () => {
    const trimmed = customText.trim();
    if (!customMode || !trimmed) return;

    if (customMode === "scene") {
      const nextPreset = {
        id: "custom-scene",
        name: "Custom",
        description: summarize(trimmed),
        prompt: trimmed,
        image: "",
      };
      setCustomScene(trimmed);
      setScene(nextPreset);
    } else {
      const nextPreset = {
        id: "custom-story",
        name: "Custom",
        description: summarize(trimmed),
        prompt: trimmed,
        image: "",
      };
      setCustomStory(trimmed);
      setStory(nextPreset);
    }

    setCustomMode(null);
    setCustomText("");
  };

  return (
    <div className="min-h-screen bg-background text-foreground">
      <Navbar />
      <main className="mx-auto grid w-full max-w-7xl gap-6 px-4 py-8 sm:px-6 lg:grid-cols-[minmax(0,1fr)_25rem] lg:px-8">
        <section className="min-w-0 space-y-5">
          <header className="space-y-2">
            <p className="text-xs font-medium uppercase tracking-[0.14em] text-muted-foreground">
              Preset UX prototype
            </p>
            <h1 className="text-balance text-3xl font-semibold text-white">
              Compose a comic idea from presets
            </h1>
            <p className="max-w-3xl text-pretty text-sm leading-relaxed text-muted-foreground">
              This page mocks the preset-assisted creation form: pick a scene,
              optionally pick a story shape, add custom text, and inspect the
              final prompt before generation.
            </p>
          </header>

          <div className="glass-panel rounded-xl p-1">
            <div className="rounded-lg border border-border/50 bg-background/80 p-4 sm:p-5">
              <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <p className="text-xs font-medium uppercase tracking-[0.12em] text-muted-foreground">
                    Step 1
                  </p>
                  <h2 className="mt-1 text-balance text-xl font-semibold text-white">
                    Set the scene
                  </h2>
                </div>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => openCustom("scene")}
                  className="w-fit border-border/70 bg-secondary/40 active:scale-[0.96]"
                >
                  <Pencil className="h-4 w-4" />
                  Custom scene
                </Button>
              </div>

              <div className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
                {SCENE_PRESETS.map((preset) => (
                  <PresetCard
                    key={preset.id}
                    preset={preset}
                    selected={scene?.id === preset.id}
                    onClick={() => setScene(preset)}
                  />
                ))}
                <CustomPresetCard
                  label="Custom"
                  value={customScenePreset}
                  selected={scene?.id === "custom-scene"}
                  onClick={() => {
                    if (customScenePreset) setScene(customScenePreset);
                    openCustom("scene");
                  }}
                />
              </div>
            </div>
          </div>

          <div className="glass-panel rounded-xl p-1">
            <div className="rounded-lg border border-border/50 bg-background/80 p-4 sm:p-5">
              <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <div className="flex items-center gap-2">
                    <p className="text-xs font-medium uppercase tracking-[0.12em] text-muted-foreground">
                      Step 2
                    </p>
                    <span className="rounded-full border border-border/60 px-2 py-0.5 text-[10px] font-medium uppercase tracking-[0.08em] text-muted-foreground">
                      Optional
                    </span>
                  </div>
                  <h2 className="mt-1 text-balance text-xl font-semibold text-white">
                    Add story inspiration
                  </h2>
                </div>
                <div className="flex gap-2">
                  {story && (
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={() => setStory(null)}
                      className="text-muted-foreground hover:text-white active:scale-[0.96]"
                    >
                      <X className="h-4 w-4" />
                      Clear
                    </Button>
                  )}
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => openCustom("story")}
                    className="w-fit border-border/70 bg-secondary/40 active:scale-[0.96]"
                  >
                    <Pencil className="h-4 w-4" />
                    Custom story
                  </Button>
                </div>
              </div>

              <div className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
                {STORY_PRESETS.map((preset) => (
                  <PresetCard
                    key={preset.id}
                    preset={preset}
                    selected={story?.id === preset.id}
                    onClick={() => setStory(preset)}
                  />
                ))}
                <CustomPresetCard
                  label="Custom"
                  value={customStoryPreset}
                  selected={story?.id === "custom-story"}
                  onClick={() => {
                    if (customStoryPreset) setStory(customStoryPreset);
                    openCustom("story");
                  }}
                />
              </div>
            </div>
          </div>

          <div className="glass-panel rounded-xl p-1">
            <div className="rounded-lg border border-border/50 bg-background/80 p-4 sm:p-5">
              <div className="flex flex-col gap-4 lg:flex-row">
                <div className="min-w-0 flex-1">
                  <label className="text-xs font-medium uppercase tracking-[0.12em] text-muted-foreground">
                    Your idea
                  </label>
                  <Textarea
                    value={userIdea}
                    onChange={(event) => setUserIdea(event.target.value.slice(0, 1200))}
                    placeholder="Describe the main character, conflict, or moment you want in the comic..."
                    className="mt-2 min-h-28 resize-none border-border/50 bg-black/20 text-sm leading-relaxed text-white shadow-none"
                  />
                  <div className="mt-3 flex flex-wrap items-center gap-2">
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => setReferenceCount((count) => Math.min(count + 1, 2))}
                      disabled={referenceCount >= 2}
                      className="border-border/70 bg-secondary/40 active:scale-[0.96]"
                    >
                      <Upload className="h-4 w-4" />
                      Mock upload
                    </Button>
                    <div className="flex gap-2">
                      {Array.from({ length: referenceCount }).map((_, index) => (
                        <div
                          key={index}
                          className="relative h-10 w-10 overflow-hidden rounded-md bg-gradient-to-br from-cyan-400 via-violet-500 to-zinc-950 shadow-[inset_0_0_0_1px_rgba(255,255,255,0.16)]"
                        >
                          <ImagePlus className="absolute left-1/2 top-1/2 h-4 w-4 -translate-x-1/2 -translate-y-1/2 text-white/80" />
                        </div>
                      ))}
                    </div>
                    <span className="text-xs text-muted-foreground">
                      {referenceCount}/2 reference slots
                    </span>
                  </div>
                </div>

                <div className="w-full lg:w-56">
                  <label className="text-xs font-medium uppercase tracking-[0.12em] text-muted-foreground">
                    Style
                  </label>
                  <div className="mt-2 grid grid-cols-2 gap-2">
                    {FEATURED_STYLES.map((style) => (
                      <button
                        key={style.id}
                        type="button"
                        onClick={() => setStyleId(style.id)}
                        className={cn(
                          "relative aspect-square overflow-hidden rounded-lg border-2 text-left transition-[border-color,transform] active:scale-[0.96]",
                          style.id === styleId
                            ? "border-white"
                            : "border-transparent hover:border-white/30",
                        )}
                      >
                        {style.image ? (
                          <img
                            src={style.image}
                            alt={style.name}
                            className="absolute inset-0 h-full w-full object-cover"
                          />
                        ) : (
                          <div className={cn("absolute inset-0 bg-gradient-to-br", STYLE_GRADIENTS[style.id])} />
                        )}
                        <div className="absolute inset-0 bg-gradient-to-t from-black/75 to-transparent" />
                        <span className="absolute inset-x-2 bottom-2 text-[10px] font-medium leading-tight text-white">
                          {style.name}
                        </span>
                        {style.id === styleId && (
                          <span className="absolute right-2 top-2 flex h-5 w-5 items-center justify-center rounded-full bg-white">
                            <Check className="h-3 w-3 text-black" />
                          </span>
                        )}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>

        <aside className="lg:sticky lg:top-6 lg:self-start">
          <div className="glass-panel rounded-xl p-1">
            <div className="rounded-lg border border-border/50 bg-background/90 p-4">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-xs font-medium uppercase tracking-[0.12em] text-muted-foreground">
                    Live output
                  </p>
                  <h2 className="mt-1 text-lg font-semibold text-white">
                    Generation payload
                  </h2>
                </div>
                <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-white/8">
                  <Wand2 className="h-5 w-5 text-white" />
                </div>
              </div>

              <div className="mt-4 space-y-3">
                <SummaryRow icon={Map} label="Scene" value={scene?.name ?? "None"} />
                <SummaryRow label="Story" value={story?.name ?? "None"} />
                <SummaryRow label="Style" value={selectedStyle?.name ?? "American Modern"} />
                <SummaryRow label="Refs" value={`${referenceCount} selected`} />
              </div>

              <div className="mt-4 rounded-lg bg-black/30 p-3 shadow-[inset_0_0_0_1px_rgba(255,255,255,0.06)]">
                <div className="mb-2 flex items-center justify-between gap-2">
                  <p className="text-[10px] font-medium uppercase tracking-[0.12em] text-muted-foreground">
                    Composed prompt
                  </p>
                  <span className="text-[10px] tabular-nums text-muted-foreground">
                    {composedPrompt.length}
                  </span>
                </div>
                <pre className="max-h-[24rem] whitespace-pre-wrap text-pretty font-sans text-xs leading-relaxed text-white/82">
                  {composedPrompt || "Choose a scene or write an idea to build the prompt."}
                </pre>
              </div>

              <Button
                type="button"
                onClick={() => setSubmitted(true)}
                disabled={!scene || !userIdea.trim()}
                className="mt-4 w-full bg-white text-black hover:bg-neutral-200 active:scale-[0.96]"
              >
                Mock generate
                <ArrowRight className="h-4 w-4" />
              </Button>

              {submitted && (
                <div className="mt-3 rounded-lg bg-emerald/10 p-3 text-xs leading-relaxed text-emerald shadow-[inset_0_0_0_1px_rgba(52,211,153,0.18)]">
                  This feels ready to send as one prompt while still showing
                  users where each ingredient came from.
                </div>
              )}
            </div>
          </div>
        </aside>
      </main>

      <Dialog open={customMode !== null} onOpenChange={(open) => !open && setCustomMode(null)}>
        <DialogContent className="border-border/60 bg-background sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="text-white">
              {customMode === "scene" ? "Describe a custom scene" : "Describe a custom story"}
            </DialogTitle>
          </DialogHeader>
          <Textarea
            autoFocus
            value={customText}
            onChange={(event) => setCustomText(event.target.value.slice(0, customMode === "scene" ? 500 : 1000))}
            placeholder={
              customMode === "scene"
                ? "A moonlit train racing across glass bridges above a flooded city..."
                : "A friendship story where two rivals must cooperate after a public failure..."
            }
            className="min-h-32 resize-none border-border/60 bg-black/20 text-sm text-white"
          />
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setCustomMode(null)}>
              Cancel
            </Button>
            <Button type="button" onClick={saveCustom} disabled={!customText.trim()}>
              Save preset
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function PresetCard({
  preset,
  selected,
  onClick,
}: {
  preset: Preset;
  selected: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "group min-h-40 overflow-hidden rounded-lg border-2 bg-secondary/40 text-left transition-[border-color,transform,background-color] active:scale-[0.96]",
        selected ? "border-white" : "border-transparent hover:border-white/30",
      )}
    >
      <div className="relative h-24 overflow-hidden">
        <img
          src={preset.image}
          alt={preset.name}
          className="h-full w-full object-cover opacity-85 transition-transform duration-300 group-hover:scale-[1.03]"
        />
        <div className="absolute inset-0 bg-gradient-to-t from-background/90 to-transparent" />
        {selected && (
          <span className="absolute right-2 top-2 flex h-5 w-5 items-center justify-center rounded-full bg-white">
            <Check className="h-3 w-3 text-black" />
          </span>
        )}
      </div>
      <div className="p-3">
        <p className="text-sm font-medium leading-tight text-white">{preset.name}</p>
        <p className="mt-1 text-pretty text-xs leading-relaxed text-muted-foreground">
          {preset.description}
        </p>
      </div>
    </button>
  );
}

function CustomPresetCard({
  label,
  value,
  selected,
  onClick,
}: {
  label: string;
  value: Preset | null;
  selected: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "group min-h-40 rounded-lg border-2 bg-secondary/35 p-3 text-left transition-[border-color,transform,background-color] hover:bg-secondary/55 active:scale-[0.96]",
        selected ? "border-white" : "border-dashed border-border/70 hover:border-white/30",
      )}
    >
      <div className="flex h-24 items-center justify-center rounded-md bg-gradient-to-br from-zinc-800 via-zinc-700 to-zinc-950 shadow-[inset_0_0_0_1px_rgba(255,255,255,0.08)]">
        {value ? (
          <p className="line-clamp-4 px-3 text-center text-xs leading-relaxed text-white/88">
            {value.prompt}
          </p>
        ) : (
          <Plus className="h-7 w-7 text-white/80 transition-transform group-hover:scale-110" />
        )}
      </div>
      <div className="mt-3">
        <p className="text-sm font-medium leading-tight text-white">{label}</p>
        <p className="mt-1 text-pretty text-xs leading-relaxed text-muted-foreground">
          {value?.description ?? "Write your own prompt ingredient"}
        </p>
      </div>
    </button>
  );
}

function SummaryRow({
  icon: Icon,
  label,
  value,
}: {
  icon?: typeof Map;
  label: string;
  value: string;
}) {
  return (
    <div className="flex items-center justify-between gap-3 rounded-md bg-white/[0.03] px-3 py-2">
      <span className="flex min-w-0 items-center gap-2 text-xs text-muted-foreground">
        {Icon && <Icon className="h-3.5 w-3.5 shrink-0" />}
        {label}
      </span>
      <span className="truncate text-xs font-medium text-white">{value}</span>
    </div>
  );
}

function summarize(value: string) {
  const words = value.trim().split(/\s+/);
  return words.slice(0, 8).join(" ") + (words.length > 8 ? "..." : "");
}
