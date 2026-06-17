export type ComicStyle = {
  id: string;
  name: string;
  prompt: string;
  image?: string;
  hidden?: boolean;
};

export const COMIC_STYLES: ComicStyle[] = [
  {
    id: "american-modern",
    name: "American Modern",
    prompt: "contemporary American superhero comic style, bold vibrant colors, dynamic heroic poses, detailed muscular anatomy, cinematic action scenes, modern digital art",
    image: "/style-previews/american-modern.jpg",
  },
  {
    id: "manga",
    name: "Manga",
    prompt: "Japanese manga style, clean precise black linework, screen tone shading, expressive eyes, dynamic speed lines, black and white with impact effects",
    image: "/style-previews/manga.jpg",
  },
  {
    id: "retro-noir",
    name: "Retro Noir",
    prompt: "1950s cinematic storybook style, soft-edged painterly rendering, dramatic Noir lighting, nostalgic mid-century atmosphere, elegant fashion, smooth gouache textures, sophisticated vintage aesthetic",
    image: "/style-previews/retro-noir.jpg",
  },
  {
    id: "indie-vector",
    name: "Indie Vector",
    prompt: "High-end modern 2D animation style, crisp variable-width black outlines, flat saturated color palette, clean geometric cel-shading, simplified character design with sharp silhouettes, professional digital vector art, modern studio animation aesthetic, matte finish",
    image: "/style-previews/indie-vector.jpg",
  },
  // Legacy styles — kept for backward compatibility with saved stories, hidden from UI
  {
    id: "noir",
    name: "Noir",
    prompt: "film noir style, high contrast black and white, deep dramatic shadows, 1940s detective aesthetic, heavy bold inking, moody atmospheric lighting",
    hidden: true,
  },
  {
    id: "vintage",
    name: "Vintage",
    prompt: "Golden Age 1950s comic style, visible halftone Ben-Day dots, limited retro color palette, nostalgic warm tones, classic adventure comics",
    hidden: true,
  },
];

export const FEATURED_STYLES = COMIC_STYLES.filter((s) => !s.hidden);
