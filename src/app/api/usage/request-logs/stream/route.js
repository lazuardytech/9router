import { getRecentLogsStructured } from "@/lib/usageDb";

export const dynamic = "force-dynamic";

/**
 * GET /api/usage/request-logs/stream
 * SSE stream that pushes request log updates as they arrive.
 * Detects: new entries (maxId change) AND status changes (PENDING → SUCCESS/FAILED).
 */
export async function GET(request) {
  let closed = false;
  let lastSig = "";

  const encoder = new TextEncoder();

  // Signature includes maxId + all PENDING row IDs + status hash
  // so any status change (PENDING→SUCCESS/FAILED) triggers an update
  function buildSig(logs) {
    const maxId = logs.length > 0 ? logs[0].id : 0;
    const pendingIds = logs
      .filter((l) => l.status?.includes("PENDING"))
      .map((l) => l.id)
      .join(",");
    // Hash recent statuses to catch any status change
    const statusHash = logs
      .slice(0, 50)
      .map((l) => `${l.id}:${l.status}`)
      .join("|");
    return `${maxId}|${pendingIds}|${statusHash}`;
  }

  const stream = new ReadableStream({
    async start(controller) {
      const send = (data) => {
        if (closed) return;
        try {
          controller.enqueue(encoder.encode(`data: ${JSON.stringify(data)}\n\n`));
        } catch {}
      };

      // Initial snapshot
      try {
        const logs = await getRecentLogsStructured(300);
        lastSig = buildSig(logs);
        send({ type: "init", logs });
      } catch {
        send({ type: "init", logs: [] });
      }

      // Poll every 1s when there are pending entries, 2s otherwise
      let pollInterval = 2000;
      const poll = async () => {
        if (closed) return;
        try {
          const logs = await getRecentLogsStructured(300);
          const sig = buildSig(logs);
          if (sig !== lastSig) {
            lastSig = sig;
            send({ type: "update", logs });
          }
          // Poll faster if there are pending entries
          const hasPending = logs.some((l) => l.status?.includes("PENDING"));
          pollInterval = hasPending ? 1000 : 2000;
        } catch {}
        if (!closed) setTimeout(poll, pollInterval);
      };

      setTimeout(poll, pollInterval);

      // Heartbeat every 30s
      const heartbeat = setInterval(() => {
        if (closed) {
          clearInterval(heartbeat);
          return;
        }
        try {
          controller.enqueue(encoder.encode(": heartbeat\n\n"));
        } catch {}
      }, 30000);

      const cleanup = () => {
        closed = true;
        clearInterval(heartbeat);
      };

      // Fires reliably on client disconnect in Next.js standalone + Bun
      request.signal.addEventListener("abort", cleanup, { once: true });

      return cleanup;
    },
    cancel() {
      closed = true;
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
      "X-Accel-Buffering": "no",
    },
  });
}
