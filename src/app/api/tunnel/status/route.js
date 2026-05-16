import { NextResponse } from "next/server";
import { getDownloadStatus } from "@/lib/tunnel/cloudflared";
import { getTailscaleStatus, getTunnelStatus } from "@/lib/tunnel/tunnelManager";

export async function GET() {
  try {
    const [tunnel, tailscale] = await Promise.all([getTunnelStatus(), getTailscaleStatus()]);
    const download = getDownloadStatus();
    return NextResponse.json({ tunnel, tailscale, download });
  } catch (error) {
    console.error("Tunnel status error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
