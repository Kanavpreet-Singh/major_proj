/**
 * POSTs JSON and reads the Server-Sent Events response, calling `onEvent` for each event.
 * Resolves when the stream ends; throws if it ends without a `done` or `error` event.
 */
export async function postSSE(
  url: string,
  body: unknown,
  onEvent: (e: Record<string, any>) => void, // eslint-disable-line @typescript-eslint/no-explicit-any
  signal?: AbortSignal
): Promise<void> {
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
    signal,
  });
  if (!res.ok || !res.body) {
    const data = await res.json().catch(() => ({}));
    throw new Error(data.error || `Request failed (${res.status})`);
  }
  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buf = '';
  let finished = false;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    buf += decoder.decode(value, { stream: true });
    const frames = buf.split('\n\n');
    buf = frames.pop() ?? '';
    for (const frame of frames) {
      const data = frame
        .split('\n')
        .filter((l) => l.startsWith('data: '))
        .map((l) => l.slice(6))
        .join('\n');
      if (!data) continue;
      const e = JSON.parse(data);
      if (e.event === 'done' || e.event === 'error') finished = true;
      onEvent(e);
    }
  }
  if (!finished) throw new Error('The connection closed before the analysis finished.');
}
