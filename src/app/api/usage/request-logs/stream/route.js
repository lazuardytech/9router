import { getRecentLogsStructured } from "@/lib/usageDb";

export const dynamic = "force-dynamic";

/**
 * GET /api/usage/request-logs/stream
 * SSE stream that pushes new request log entries as they arrive.
 * Sends full snapshot on connect, then diffs every 2s.
 */
export async function GET() {
  let closed = false;
  let lastMaxId = 0;

  const encoder = new TextEncoder();

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
        if (logs.length > 0) lastMaxId = logs[0].id;
        send({ type: "init", logs });
      } catch {
        send({ type: "init", logs: [] });
      }

      // Poll for new entries every 2s
      const interval = setInterval(async () => {
        if (closed) {
          clearInterval(interval);
          return;
        }
        try {
          const logs = await getRecentLogsStructured(300);
          const newMaxId = logs.length > 0 ? logs[0].id : 0;
          if (newMaxId !== lastMaxId) {
            lastMaxId = newMaxId;
            send({ type: "update", logs });
          }
        } catch {}
      }, 2000);

      // Heartbeat every 30s to keep connection alive
      const heartbeat = setInterval(() => {
        if (closed) {
          clearInterval(heartbeat);
          return;
        }
        try {
          controller.enqueue(encoder.encode(": heartbeat\n\n"));
        } catch {}
      }, 30000);

      // Cleanup on close
      return () => {
        closed = true;
        clearInterval(interval);
        clearInterval(heartbeat);
      };
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
