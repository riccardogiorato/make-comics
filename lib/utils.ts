import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export const TOGETHER_LINK =
  "https://togetherai.link/?utm_source=make-comics&utm_medium=referral&utm_campaign=example-app";

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

export function getFriendlyGenerationErrorMessage(errorMessage: string): string {
  if (isContentPolicyViolation(errorMessage)) {
    return "This prompt needs a safer original version before we can generate it.";
  }

  if (errorMessage.includes("400 {") || errorMessage.includes("Together AI API error")) {
    return "The image model could not use this request. Please adjust the prompt and try again.";
  }

  return errorMessage;
}
