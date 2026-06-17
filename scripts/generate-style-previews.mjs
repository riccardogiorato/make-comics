/**
 * Generates 1:1 square character portrait preview images for each comic style.
 * Prompts are adapted from the conference repo's STYLE_PROMPTS approach:
 * single hero character, square composition, no comic page panels.
 *
 * Usage: node scripts/generate-style-previews.mjs
 */

import Together from "together-ai";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// Load TOGETHER_API_KEY from .env manually (no dotenv dep needed)
const envPath = path.join(__dirname, "..", ".env");
const envVars = fs.existsSync(envPath)
  ? Object.fromEntries(
      fs
        .readFileSync(envPath, "utf8")
        .split("\n")
        .filter((l) => l.includes("=") && !l.startsWith("#"))
        .map((l) => l.split("=").map((s) => s.trim()))
        .map(([k, ...v]) => [k, v.join("=")])
    )
  : {};

const apiKey = process.env.TOGETHER_API_KEY || envVars.TOGETHER_API_KEY;
if (!apiKey) {
  console.error("TOGETHER_API_KEY not found in environment or .env");
  process.exit(1);
}

const client = new Together({ apiKey });
const OUTPUT_DIR = path.join(__dirname, "..", "public", "style-previews");
fs.mkdirSync(OUTPUT_DIR, { recursive: true });

const MODEL = "google/flash-image-2.5";
const SIZE = 1024; // square (only supported square dimension for this model)

// Each prompt: single hero character, style-matched, no panels, no speech bubbles
const STYLE_PREVIEWS = [
  {
    id: "american-modern",
    prompt:
      "Single superhero character, contemporary American superhero comic art style, bold vibrant colors, dynamic heroic standing pose, detailed costume, cinematic lighting, modern digital illustration. Square portrait, full body visible, clean background with subtle color wash. No panels, no speech bubbles, no text.",
  },
  {
    id: "manga",
    prompt:
      "Single anime hero character, vibrant high-energy shonen manga style, saturated primary colors, clean bold linework, expressive large eyes, dynamic action pose, speed lines radiating behind character. Square portrait, full body, clean white background. No panels, no speech bubbles, no text.",
  },
  {
    id: "retro-noir",
    prompt:
      "Single detective character in 1940s fashion, 1950s cinematic storybook style, soft-edged painterly gouache rendering, dramatic noir chiaroscuro lighting, deep warm shadows, elegant mid-century atmosphere, smooth brushwork. Square portrait, full body, moody dark background. No panels, no speech bubbles, no text.",
  },
  {
    id: "indie-vector",
    prompt:
      "Single cartoon hero character, high-end modern 2D animation style, crisp variable-width black ink outlines, flat saturated color palette, clean geometric cel-shading, simplified bold silhouette, professional studio vector aesthetic. Square portrait, full body, solid color background. No panels, no speech bubbles, no text.",
  },
];

for (const { id, prompt } of STYLE_PREVIEWS) {
  process.stdout.write(`Generating ${id}... `);
  try {
    const response = await client.images.generate({
      model: MODEL,
      prompt,
      width: SIZE,
      height: SIZE,
    });

    const imageUrl = response.data?.[0]?.url;
    if (!imageUrl) throw new Error("No URL in response");

    const res = await fetch(imageUrl);
    if (!res.ok) throw new Error(`Fetch failed: ${res.status}`);
    const buffer = Buffer.from(await res.arrayBuffer());

    const outPath = path.join(OUTPUT_DIR, `${id}.jpg`);
    fs.writeFileSync(outPath, buffer);
    console.log(`✓ saved public/style-previews/${id}.jpg`);
  } catch (err) {
    console.error(`✗ ${err.message}`);
  }
}
