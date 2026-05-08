import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export const IMAGE_PROVIDER_LINK = "https://pollinations.ai/";
export const IMAGE_PROVIDER_NAME = "Pollinations";

export function isContentPolicyViolation(errorMessage: string): boolean {
  return (
    errorMessage.includes("content policy") ||
    errorMessage.includes("Invalid content detected") ||
    errorMessage.includes("content moderation") ||
    errorMessage.includes("flagged and rejected") ||
    errorMessage.includes("NO_IMAGE")
  );
}

export function getContentPolicyErrorMessage(): string {
  return "Unable to generate image due to content policy. Please try a different prompt.";
}
