import { type NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import Together from "together-ai";
import { analyzeReferenceImage } from "@/lib/preflight";

function isSupportedImageInput(value: unknown): value is string {
  if (typeof value !== "string") return false;
  return value.startsWith("https://") || value.startsWith("http://") || value.startsWith("data:image/");
}

export async function POST(request: NextRequest) {
  try {
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json({ error: "Authentication required" }, { status: 401 });
    }

    const { imageUrl, imageDataUrl, apiKey } = await request.json();
    const imageInput = imageUrl || imageDataUrl;

    if (!isSupportedImageInput(imageInput)) {
      return NextResponse.json(
        { error: "Missing imageUrl or imageDataUrl." },
        { status: 400 },
      );
    }

    const finalApiKey = typeof apiKey === "string" && apiKey.trim()
      ? apiKey.trim()
      : process.env.TOGETHER_API_KEY;

    if (!finalApiKey) {
      return NextResponse.json(
        { error: "Server configuration error - Together API key not available" },
        { status: 500 },
      );
    }

    const client = new Together({ apiKey: finalApiKey });
    const result = await analyzeReferenceImage({ client, imageUrl: imageInput });

    return NextResponse.json(result);
  } catch (error) {
    console.error("Error in analyze-reference API:", error);
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : "Failed to analyze reference.",
      },
      { status: 500 },
    );
  }
}
