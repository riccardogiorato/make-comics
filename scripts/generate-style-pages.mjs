/**
 * Generates full comic page preview images for each of the 4 featured styles.
 * Portrait ratio (864x1184) to match the comic page aspect ratio shown on the landing page.
 *
 * Usage: node scripts/generate-style-pages.mjs
 */

import Together from "together-ai";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const envPath = path.join(__dirname, "..", ".env");
const envVars = fs.existsSync(envPath)
  ? Object.fromEntries(
      fs.readFileSync(envPath, "utf8")
        .split("\n")
        .filter((l) => l.includes("=") && !l.startsWith("#"))
        .map((l) => l.split("=").map((s) => s.trim()))
        .map(([k, ...v]) => [k, v.join("=")])
    )
  : {};

const apiKey = process.env.TOGETHER_API_KEY || envVars.TOGETHER_API_KEY;
if (!apiKey) { console.error("TOGETHER_API_KEY not found"); process.exit(1); }

const client = new Together({ apiKey });
const OUTPUT_DIR = path.join(__dirname, "..", "public", "style-pages");
fs.mkdirSync(OUTPUT_DIR, { recursive: true });

const MODEL = "google/flash-image-2.5";
// Portrait comic page ratio — closest supported: 864x1184
const W = 864, H = 1184;

const PAGES = [
  {
    id: "american-modern",
    label: "American Modern",
    quote: '"And a hero shall rise!"',
    prompt: `Professional American superhero comic book page. Contemporary Marvel/DC style but fully original characters. Bold vibrant colors, cinematic lighting, dynamic heroic action. 5-panel layout: wide establishing shot of a glowing city skyline at dusk, close-up of a determined hero in a red and gold armored suit launching into the sky, wide action shot of the hero fighting a giant mechanical villain mid-air, dramatic low-angle of the hero punching through steel, final triumphant panel hero standing victorious above the clouds. Solid black panel borders, clean white gutters, speech bubbles with bold comic lettering. Modern digital art, high contrast, detailed backgrounds.`,
  },
  {
    id: "manga",
    label: "Manga",
    quote: '"Time to save the world!"',
    prompt: `Professional Japanese shonen manga comic page. Clean precise black linework, screen tone halftone shading, expressive oversized eyes, explosive speed lines. 5-panel layout: wide shot of a teenage hero on a rooftop at night with wind in their hair, extreme close-up of determined eyes, dynamic full-body action pose leaping off a building, intense clash of energy beams with radial speed lines, final wide panel of the hero landing heroically before cheering crowd. Bold black panel borders, clean white gutters, manga-style speech bubbles. Black and white with selective ink washes, high impact compositions.`,
  },
  {
    id: "retro-noir",
    label: "Retro Noir",
    quote: '"The city never sleeps..."',
    prompt: `Professional 1950s noir comic book page. Cinematic storybook style, soft-edged painterly gouache rendering, dramatic chiaroscuro Noir lighting. 5-panel layout: wide rainy city street at night with silhouetted detective under a streetlamp, medium shot of a suited detective in a fedora examining a clue, close-up of a mysterious woman in elegant 1940s fashion in a doorway, dramatic low-angle of detective confronting a shadowy villain, final noir wide shot of the detective walking away into the foggy night. Deep warm shadows, cream highlights, solid black panel borders. Nostalgic mid-century atmosphere, sophisticated painterly finish.`,
  },
  {
    id: "indie-vector",
    label: "Indie Vector",
    quote: '"Adventure awaits!"',
    prompt: `Professional indie vector 2D animation style comic book page. Crisp variable-width black ink outlines, flat bold color palette, clean geometric cel-shading, sharp graphic silhouettes. 5-panel layout: wide colorful city establishing shot with clean geometric architecture, medium shot of a stylized hero with bold simplified design striking a pose, dynamic action panel of hero dashing through obstacles with motion blur lines, close-up with expressive simplified face showing determination, final wide triumphant panel hero standing on a rooftop against a graphic sunset. Solid black panel borders, clean white gutters, graphic speech bubbles. Modern studio 2D animation aesthetic, matte finish.`,
  },
];

for (const { id, label, prompt } of PAGES) {
  process.stdout.write(`Generating ${label}... `);
  try {
    const response = await client.images.generate({
      model: MODEL,
      prompt,
      width: W,
      height: H,
    });

    const imageUrl = response.data?.[0]?.url;
    if (!imageUrl) throw new Error("No URL in response");

    const res = await fetch(imageUrl);
    if (!res.ok) throw new Error(`Fetch failed: ${res.status}`);
    const buffer = Buffer.from(await res.arrayBuffer());

    const outPath = path.join(OUTPUT_DIR, `${id}.jpg`);
    fs.writeFileSync(outPath, buffer);
    console.log(`✓ saved public/style-pages/${id}.jpg`);
  } catch (err) {
    console.error(`✗ ${err.message}`);
  }
}
