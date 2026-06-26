export type ReferenceKind =
  | "child"
  | "teen"
  | "adult"
  | "senior"
  | "dog"
  | "cat"
  | "animal"
  | "object"
  | "unknown";

export type ReferenceSeverity = "ok" | "warning" | "blocked";

export type ReferenceAnalysisSummary = {
  success: boolean;
  kind: ReferenceKind;
  isHuman: boolean;
  type: string;
  ageGroup?: "child" | "teen" | "adult" | "senior" | "unknown";
  estimatedAge?: number | null;
  isUnderFive?: boolean;
  description: string;
  severity: ReferenceSeverity;
  directReferenceAllowed: boolean;
  message?: string;
};

export type StoredCharacterReference = ReferenceAnalysisSummary & {
  url: string;
  analyzedAt: string;
};

export function shouldUseDirectReference(analysis: Pick<ReferenceAnalysisSummary, "kind" | "isUnderFive" | "severity">) {
  return analysis.severity !== "blocked" && analysis.kind !== "child" && analysis.isUnderFive !== true;
}

export function toStoredCharacterReference(
  url: string,
  analysis: ReferenceAnalysisSummary,
): StoredCharacterReference {
  return {
    ...analysis,
    url,
    directReferenceAllowed: shouldUseDirectReference(analysis),
    analyzedAt: new Date().toISOString(),
  };
}

export function getDirectReferenceUrls(
  imageUrls: string[],
  references: StoredCharacterReference[] | undefined,
) {
  if (!references || references.length === 0) {
    return imageUrls;
  }

  const byUrl = new Map(references.map((reference) => [reference.url, reference]));
  return imageUrls.filter((url) => {
    const reference = byUrl.get(url);
    return reference ? reference.directReferenceAllowed : true;
  });
}

export function getReferenceDescriptionLines(references: StoredCharacterReference[] | undefined) {
  if (!references || references.length === 0) {
    return [];
  }

  return references
    .filter((reference) => reference.severity !== "blocked" && !reference.directReferenceAllowed)
    .map((reference, index) => {
      const ageNote = reference.isUnderFive
        ? "very young child"
        : reference.kind === "child"
          ? "child"
          : reference.kind;
      return `Character reference ${index + 1}: use a broad, non-identifying ${ageNote} description only: ${reference.description}. Do not recreate the uploaded face directly.`;
    });
}
