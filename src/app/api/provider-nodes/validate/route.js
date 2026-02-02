import { NextResponse } from "next/server";

// POST /api/provider-nodes/validate - Validate API key against base URL /models
export async function POST(request) {
  try {
    const body = await request.json();
    const { baseUrl, apiKey } = body;

    if (!baseUrl || !apiKey) {
      return NextResponse.json({ error: "Base URL and API key required" }, { status: 400 });
    }

    const modelsUrl = `${baseUrl.replace(/\/$/, "")}/models`;
    const res = await fetch(modelsUrl, {
      headers: { "Authorization": `Bearer ${apiKey}` },
    });

    return NextResponse.json({ valid: res.ok, error: res.ok ? null : "Invalid API key" });
  } catch (error) {
    console.log("Error validating OpenAI compatible base URL:", error);
    return NextResponse.json({ error: "Validation failed" }, { status: 500 });
  }
}
