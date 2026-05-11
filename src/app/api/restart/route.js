import { NextResponse } from "next/server";

export async function POST() {
  const response = NextResponse.json({ success: true, message: "Restarting..." });

  setTimeout(() => {
    process.exit(1);
  }, 500);

  return response;
}
