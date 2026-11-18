import { NextResponse } from 'next/server';
import type { PipelineEvent } from '@/lib/ml-runner';

/**
 * Streams events to the browser as Server-Sent Events while `run` executes.
 * `run` receives a `send` function; if it throws, an `{event: "error"}` is sent.
 * A comment line every 15s keeps proxies from closing a quiet connection during long LLM calls.
 */
export function sseResponse(run: (send: (e: PipelineEvent) => void) => Promise<void>): NextResponse {
  const encoder = new TextEncoder();
  const stream = new ReadableStream({
    async start(controller) {
      let open = true;
      const write = (chunk: string) => {
        if (!open) return;
        try {
          controller.enqueue(encoder.encode(chunk));
        } catch {
          open = false; // client disconnected
        }
      };
      const send = (e: PipelineEvent) => write(`data: ${JSON.stringify(e)}\n\n`);
      const keepAlive = setInterval(() => write(': keep-alive\n\n'), 15_000);
      try {
        await run(send);
      } catch (err) {
        console.error('Streaming request failed:', err);
        send({ event: 'error', message: err instanceof Error ? err.message : String(err) });
      } finally {
        clearInterval(keepAlive);
        open = false;
        try {
          controller.close();
        } catch {
          // already closed
        }
      }
    },
  });

  return new NextResponse(stream, {
    headers: {
      'Content-Type': 'text/event-stream; charset=utf-8',
      'Cache-Control': 'no-cache, no-transform',
      Connection: 'keep-alive',
      'X-Accel-Buffering': 'no',
    },
  });
}
