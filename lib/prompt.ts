import { COMIC_STYLES } from "./constants";

// Together AI has a 45000 character limit for the prompt parameter
// We use 40k total to keep a larger safety margin
export const MAX_PROMPT_LENGTH = 40000;
export const MAX_SYSTEM_LENGTH = 35000; // Reserve 5,000 for user's prompt

export const MAX_USER_PROMPT = MAX_PROMPT_LENGTH - MAX_SYSTEM_LENGTH;

export function buildComicPrompt({
  prompt,
  style,
  characterImages = [],
  isContinuation = false,
  previousContext = "",
  isAddPage = false,
  previousPages = [],
}: {
  prompt: string;
  style?: string;
  characterImages?: string[];
  isContinuation?: boolean;
  previousContext?: string;
  isAddPage?: boolean;
  previousPages?: Array<{
    prompt: string;
  }>;
}): string {
  const styleInfo = COMIC_STYLES.find((s) => s.id === style);
  const styleDesc = styleInfo?.prompt || COMIC_STYLES[2].prompt;

  let continuationContext = "";
  if (isContinuation && previousContext) {
    continuationContext = `\nCONTINUATION CONTEXT:\nThis is a continuation of an existing story. The previous page showed: ${previousContext}\nMaintain visual consistency with the previous panels. Continue the narrative naturally.\n`;
  }

  if (isAddPage && previousPages.length > 0) {
    // Limit previous pages to fit within MAX_SYSTEM_LENGTH
    // Start with most recent pages and work backwards
    const header = `\nSTORY CONTINUATION CONTEXT:\nThis is page ${previousPages.length + 1} of an existing comic story. Here are the recent pages for context:\n`;
    const footer = `\n\nThe new page should naturally continue this story. Maintain the same characters, setting, and narrative style. Reference previous events and build upon them.\n`;
    
    // Calculate available space for previous pages (reserve space for rest of system prompt)
    const basePromptLength = 2500; // Approximate length of system prompt without previous pages
    const availableSpace = MAX_SYSTEM_LENGTH - basePromptLength - header.length - footer.length;
    
    const selectedPages: string[] = [];
    let currentLength = 0;
    
    // Add pages from most recent backwards until we run out of space
    for (let i = previousPages.length - 1; i >= 0; i--) {
      const pageEntry = `Page ${i + 1}: ${previousPages[i].prompt}`;
      const entryLength = pageEntry.length + (selectedPages.length > 0 ? 1 : 0); // +1 for newline
      
      if (currentLength + entryLength <= availableSpace) {
        selectedPages.unshift(pageEntry);
        currentLength += entryLength;
      } else {
        break;
      }
    }
    
    if (selectedPages.length > 0) {
      continuationContext = header + selectedPages.join("\n") + footer;
    } else {
      // Fallback if no pages fit
      continuationContext = `\nSTORY CONTINUATION CONTEXT:\nThis is page ${previousPages.length + 1} of an existing comic story with ${previousPages.length} previous pages. Continue the story maintaining consistency.\n`;
    }
  }

  let characterSection = "";
  if (characterImages.length > 0) {
    if (characterImages.length === 1) {
      characterSection = `
REFERENCE PHOTO — FACE ONLY:
- Use the uploaded reference photo ONLY for the hero's face and head
- DO NOT copy the reference for body, costume, species, or clothing — those come from the story description
- The hero's face must remain consistent across all panels they appear in
- STYLE APPLICATION: Apply ${style} comic art style to the body/pose/action while keeping the face true to the reference`;
    } else if (characterImages.length === 2) {
      characterSection = `
REFERENCE PHOTOS — FACE ONLY (TWO CHARACTERS):
- Use the FIRST uploaded photo ONLY for Character 1's face and head
- Use the SECOND uploaded photo ONLY for Character 2's face and head
- DO NOT copy either reference for body, costume, species, or clothing — those come from the story description
- Keep both characters' faces consistent across all panels; keep them visually distinct from each other
- STYLE APPLICATION: Apply ${style} comic art style to bodies/poses while keeping faces true to their references`;
    }
  }

  const systemPrompt = `Professional comic book page illustration.
${continuationContext}
${characterSection}

CHARACTER CONSISTENCY RULES:
- If reference images are provided, use them ONLY for the hero's face — body, costume, and species come from the story description
- The hero's face must remain consistent across all panels they appear in
- Apply comic style to body/pose/action while keeping the face true to the reference

TEXT AND LETTERING (CRITICAL):
- All text in speech bubbles must be PERFECTLY CLEAR, LEGIBLE, and correctly spelled
- Use bold clean comic book lettering, large and easy to read
- Speech bubbles: crisp white fill, solid black outline, pointed tail toward speaker
- Keep dialogue SHORT: maximum 1-2 sentences per bubble
- NO blurry, warped, or unreadable text

PAGE LAYOUT:
3–5 panel comic page with DYNAMIC, VARIED layouts — do NOT default to a fixed grid.
- Vary panel count: 3 panels for dramatic moments, 4–5 for fast-paced action sequences
- Vary panel shapes and sizes across the page:
  * Wide horizontal panels for establishing shots or action spreads
  * Tall vertical panels for dramatic character reveals
  * Small square panels for quick beats or close-ups
  * Large panels taking 1/2 or 2/3 of the page for key moments
  * Overlapping panels that break the grid for dynamic action
  * Diagonal or angled panel borders for intense sequences
  * Inset panels inside larger panels for simultaneous action
- Solid black panel borders with clean white gutters between panels
- NO title text on any page — only panels, speech bubbles, and caption boxes
- CAPTIONS: optional — use only where narration adds clear value; many panels work better without

ART STYLE:
${styleDesc}
${characterSection}

COMPOSITION:
- Vary camera angles across panels: close-up, medium shot, wide establishing shot
- Natural visual flow: left-to-right, top-to-bottom reading order
- Dynamic character poses with clear expressive acting
- Detailed backgrounds matching the scene and mood`;

  return `${systemPrompt}\n\nSTORY:\n${prompt}`;
}
