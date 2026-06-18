const MAX_IMAGE_DIMENSION = 2048;
const JPEG_QUALITY = 0.9;

const SUPPORTED_INPUT_TYPES = new Set([
  "image/jpeg",
  "image/png",
  "image/webp",
]);

export function validateFileForUpload(file: File): { valid: boolean; error?: string } {
  const isSupportedType =
    SUPPORTED_INPUT_TYPES.has(file.type) ||
    /\.(jpe?g|png|webp)$/i.test(file.name);

  if (!isSupportedType) {
    return {
      valid: false,
      error: "Please upload a PNG, JPG, JPEG, or WebP image."
    }
  }

  if (!file.type.startsWith("image/")) {
    return {
      valid: false,
      error: "Only image files are supported."
    }
  }

  return { valid: true }
}

function loadImage(file: File): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const image = new Image()
    const objectUrl = URL.createObjectURL(file)

    image.onload = () => {
      URL.revokeObjectURL(objectUrl)
      resolve(image)
    }
    image.onerror = () => {
      URL.revokeObjectURL(objectUrl)
      reject(new Error("Could not read image file."))
    }
    image.src = objectUrl
  })
}

function getOutputSize(width: number, height: number) {
  const largestSide = Math.max(width, height)
  if (largestSide <= MAX_IMAGE_DIMENSION) {
    return { width, height }
  }

  const scale = MAX_IMAGE_DIMENSION / largestSide
  return {
    width: Math.round(width * scale),
    height: Math.round(height * scale),
  }
}

function canvasToJpegBlob(canvas: HTMLCanvasElement): Promise<Blob> {
  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (blob) => {
        if (blob) {
          resolve(blob)
        } else {
          reject(new Error("Could not convert image to JPEG."))
        }
      },
      "image/jpeg",
      JPEG_QUALITY
    )
  })
}

export async function normalizeImageForUpload(file: File): Promise<File> {
  const validation = validateFileForUpload(file)
  if (!validation.valid) {
    throw new Error(validation.error || "Invalid image file.")
  }

  const image = await loadImage(file)
  const { width, height } = getOutputSize(image.naturalWidth, image.naturalHeight)
  const canvas = document.createElement("canvas")
  canvas.width = width
  canvas.height = height

  const context = canvas.getContext("2d")
  if (!context) {
    throw new Error("Could not prepare image for upload.")
  }

  context.fillStyle = "#ffffff"
  context.fillRect(0, 0, width, height)
  context.drawImage(image, 0, 0, width, height)

  const blob = await canvasToJpegBlob(canvas)
  const normalizedName = file.name.replace(/\.[^.]+$/, "") || "character"

  return new File([blob], `${normalizedName}.jpg`, {
    type: "image/jpeg",
    lastModified: Date.now(),
  })
}

export function generateFilePreview(file: File): Promise<string> {
  return new Promise((resolve) => {
    const reader = new FileReader()
    reader.onload = (e) => {
      resolve(e.target?.result as string)
    }
    reader.readAsDataURL(file)
  })
}
