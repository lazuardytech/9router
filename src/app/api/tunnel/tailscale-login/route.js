import { NextResponse } from "next/server";
import { generateShortId, loadState } from "@/lib/tunnel/state.js";
import { startLogin } from "@/lib/tunnel/tailscale";

export async function POST() {
  try {
    const shortId = loadState()?.shortId || generateShortId();
    const result = await startLogin(shortId);
    return NextResponse.json(result);
  } catch (error) {
    console.error("Tailscale login error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
