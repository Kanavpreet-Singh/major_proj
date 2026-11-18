'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { XRayView } from '@/components/xray-view';
import { RunStatus } from '@/components/xray-header';
import { useXRayStream } from '@/lib/use-xray-stream';
import { formatDate } from '@/lib/format';
import type { XRaySummary } from '@/lib/validations';

// Demo article: ordinary prose around exactly 4 checkable claims (2 true, 2 false),
// so a scan stays within the free Gemini quota.
//   true:  completed in 1889 for the World's Fair
//   false: located in Berlin
//   true:  tallest man-made structure until the Chrysler Building (1930)
//   false: repainted every 50 years (it is about every 7 years)
const SAMPLE = `Eiffel Tower Draws Autumn Crowds as Paris Tourism Rebounds

On a crisp October morning, long queues once again wound around the base of the Eiffel Tower as visitors waited for their turn to ride to the top. Completed in 1889 as the entrance to the World's Fair, the iron lattice tower has become the most recognisable symbol of the French capital, and few people leave without a photograph of it glowing against the evening sky. Café owners along the nearby avenues say business has rarely been better, and many describe the mood around the Champ de Mars as electric.

The tower, which is located in Berlin, was the tallest man-made structure in the world until the Chrysler Building in New York was completed in 1930. Keeping the monument in shape is no small task: maintenance crews repaint the entire structure roughly every 50 years, a job that takes months of careful work at dizzying heights. For many Parisians, though, the tower is simply part of everyday life, a familiar silhouette on the walk to work.`;

interface Recent {
  id: string;
  title: string;
  url: string;
  summary: XRaySummary;
  createdAt: string;
}

export default function XRayPage() {
  const scan = useXRayStream();
  const [useText, setUseText] = useState(false);
  const [url, setUrl] = useState('');
  const [text, setText] = useState('');
  const [recent, setRecent] = useState<Recent[]>([]);

  useEffect(() => {
    if (scan.state.status !== 'idle') return;
    fetch('/api/xray')
      .then((r) => (r.ok ? r.json() : []))
      .then(setRecent)
      .catch(() => setRecent([]));
  }, [scan.state.status]);

  function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!useText) {
      try {
        new URL(url.trim());
      } catch {
        toast.error('Enter a full link, starting with https://');
        return;
      }
      scan.start({ url: url.trim() });
    } else {
      if (text.trim().length < 80) {
        toast.error('Paste at least a few sentences.');
        return;
      }
      scan.start({ text: text.trim() });
    }
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  const s = scan.state;
  if (s.status !== 'idle') {
    return (
      <div className="mx-auto max-w-6xl px-4 py-10 sm:px-6">
        <XRayView
          article={s.article}
          claims={s.claims}
          summary={s.summary}
          running={s.status === 'running'}
          stages={s.stages}
          notices={s.notices}
          error={s.error}
          headerExtra={
            <>
              <RunStatus status={s.status} startedAt={s.startedAt} elapsedMs={s.done?.elapsedMs} />
              {s.status === 'running' ? (
                <Button variant="ghost" size="sm" onClick={scan.cancel}>
                  Cancel
                </Button>
              ) : (
                <span className="flex items-center gap-2">
                  {s.done && (
                    <Button asChild variant="ghost" size="sm">
                      <Link href={`/xray/${s.done.id}`}>Permalink</Link>
                    </Button>
                  )}
                  <Button variant="outline" size="sm" onClick={scan.reset}>
                    New scan
                  </Button>
                </span>
              )}
            </>
          }
        />
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-2xl px-4 py-14 sm:px-6">
      <h1 className="font-serif text-4xl font-medium tracking-tight sm:text-5xl">Article X-Ray</h1>

      <form onSubmit={submit} className="mt-10 space-y-4">
        {useText ? (
          <textarea
            autoFocus
            rows={10}
            placeholder="Paste the article"
            value={text}
            onChange={(e) => setText(e.target.value)}
            maxLength={20000}
            className="w-full resize-y rounded-xl border border-input bg-card px-5 py-4 font-serif text-lg leading-relaxed placeholder:text-muted-foreground/70 focus-visible:border-primary/60 focus-visible:outline-none focus-visible:ring-0 focus-visible:ring-offset-0"
          />
        ) : (
          <Input
            autoFocus
            type="url"
            placeholder="Paste a link to an article"
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            className="h-14 rounded-xl px-5 text-base"
          />
        )}
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex gap-5 text-sm text-muted-foreground">
            <button type="button" className="underline-offset-4 hover:text-foreground hover:underline" onClick={() => setUseText((v) => !v)}>
              {useText ? 'Use a link instead' : 'Paste text instead'}
            </button>
            <button
              type="button"
              className="underline-offset-4 hover:text-foreground hover:underline"
              onClick={() => {
                setUseText(true);
                setText(SAMPLE);
              }}
            >
              Try a sample
            </button>
          </div>
          <Button type="submit" size="lg" className="h-11 px-8">
            Scan
          </Button>
        </div>
      </form>

      {recent.length > 0 && (
        <section className="mt-16">
          <h2 className="mb-2 text-sm text-muted-foreground">Recent scans</h2>
          <ul className="divide-y border-y">
            {recent.map((r) => (
              <li key={r.id}>
                <Link href={`/xray/${r.id}`} className="flex items-center justify-between gap-4 py-3 hover:text-foreground">
                  <span className="truncate font-serif text-lg">{r.title}</span>
                  <span className="shrink-0 text-sm tabular-nums text-muted-foreground">
                    {r.summary.truth_score == null ? formatDate(r.createdAt) : `${Math.round(r.summary.truth_score * 100)}% hold up`}
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}
