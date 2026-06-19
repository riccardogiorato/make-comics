import { type NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import Together from "together-ai";
import { MAX_USER_PROMPT } from "@/lib/prompt";
import { validatePromptForGeneration } from "@/lib/preflight";

export async function POST(request: NextRequest) {
  try {
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json({ error: "Authentication required" }, { status: 401 });
    }

    const { prompt, mode, apiKey } = await request.json();

    if (typeof prompt !== "string" || !prompt.trim()) {
      return NextResponse.json({ error: "Prompt is required." }, { status: 400 });
    }

    if (prompt.length > MAX_USER_PROMPT) {
      return NextResponse.json(
        { error: `Prompt must be ${MAX_USER_PROMPT} characters or fewer.` },
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
    const result = await validatePromptForGeneration({
      client,
      prompt,
      mode: mode === "new-page" ? "new-page" : "new-story",
    });

    return NextResponse.json(result);
  } catch (error) {
    console.error("Error in validate-prompt API:", error);
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : "Failed to validate prompt.",
      },
      { status: 500 },
    );
  }
}
