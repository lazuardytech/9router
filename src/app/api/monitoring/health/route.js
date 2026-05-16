import { NextResponse } from "next/server";
import { buildHealthPayload } from "./_health.js";

export const dynamic = "force-dynamic";

// GET /api/monitoring/health — one-shot JSON (used by error retry button)
export async function GET() {
  try {
    const payload = await buildHealthPayload();
    return NextResponse.json(payload);
  } catch (err) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
