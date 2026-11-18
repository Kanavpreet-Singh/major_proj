'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { XRayView } from '@/components/xray-view';
import { RunStatus } from '@/components/xray-header';
import { useXRayStream } from '@/lib/use-xray-stream';
import { formatDate } from '@/lib/format';
import type { XRaySummary } from '@/lib/validations';
import { ArrowRight, FileText, Gavel, Link as LinkIcon, RotateCcw, ScanLine, Search, Sparkles } from 'lucide-react';

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

function ScoreChip({ s }: { s: XRaySummary }) {
  const pct = s.truth_score == null ? '–' : `${Math.round(s.truth_score * 100)}%`;
  const segs: [number, string][] = [
    [s.supported, 'bg-emerald-500'],
    [s.not_supported, 'bg-rose-500'],
    [s.insufficient, 'bg-amber-500'],
  ];
  return (
    <span className="flex items-center gap-2 text-xs tabular-nums">
      <span className="font-bold">{pct}</span>
      <span className="flex h-1.5 w-20 overflow-hidden rounded-full bg-muted">
        {segs.map(([n, cls], i) =>
          n > 0 ? <span key={i} className={cls} style={{ width: `${(n / Math.max(1, s.total)) * 100}%` }} /> : null
        )}
      </span>
    </span>
  );
}

const STEPS = [
  { icon: Search, t: 'Find claims', d: 'An LLM picks out the specific, checkable facts and rewrites each so it stands on its own.' },
  { icon: Gavel, t: 'Debate each one', d: 'For every claim, a Defender and a Prosecutor argue from web evidence, and a Judge rules.' },
  { icon: ScanLine, t: 'Highlight the article', d: 'Sentences light up as verdicts arrive. Click any highlight to see its debate.' },
];

export default function XRayPage() {
  const scan = useXRayStream();
  const [mode, setMode] = useState<'url' | 'text'>('url');
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
    if (mode === 'url') {
      try {
        new URL(url.trim());
      } catch {
        toast.error('Please enter a full article link, starting with https://');
        return;
      }
      scan.start({ url: url.trim() });
    } else {
      if (text.trim().length < 80) {
        toast.error('Please paste a longer piece of text (a few sentences at least).');
        return;
      }
      scan.start({ text: text.trim() });
    }
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  const s = scan.state;
  if (s.status !== 'idle') {
    return (
      <div className="mx-auto max-w-7xl px-4 py-10 sm:px-6 lg:px-8">
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
                <Button variant="outline" size="sm" className="h-8" onClick={scan.cancel}>
                  Cancel
                </Button>
              ) : (
                <>
                  {s.done && (
                    <Button asChild size="sm" className="h-8 gap-1.5">
                      <Link href={`/xray/${s.done.id}`}>
                        Permalink <ArrowRight className="h-3.5 w-3.5" />
                      </Link>
                    </Button>
                  )}
                  <Button variant="outline" size="sm" className="h-8 gap-1.5" onClick={scan.reset}>
                    <RotateCcw className="h-3.5 w-3.5" /> New scan
                  </Button>
                </>
              )}
            </>
          }
        />
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-5xl px-4 py-12 sm:px-6 lg:px-8">
      <div className="mb-10 space-y-3">
        <div className="inline-flex items-center gap-2 rounded-full border bg-muted/40 px-3 py-1 text-xs font-semibold text-muted-foreground">
          <ScanLine className="h-3.5 w-3.5 text-primary" /> New · Article X-Ray
        </div>
        <h1 className="text-3xl font-bold tracking-tight sm:text-4xl">See which parts of an article hold up</h1>
        <p className="max-w-2xl text-muted-foreground">
          Give VeriLens a news article. It finds every check-worthy claim, fact-checks each one with a live agent debate,
          and highlights the article sentence by sentence: green holds up, red is false, amber could not be verified.
        </p>
      </div>

      <div className="grid gap-8 lg:grid-cols-5">
        <form onSubmit={submit} className="space-y-6 lg:col-span-3">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Article</CardTitle>
              <CardDescription>A link to a news article, or the text itself</CardDescription>
            </CardHeader>
            <CardContent>
              <Tabs value={mode} onValueChange={(v) => setMode(v as 'url' | 'text')}>
                <TabsList className="mb-4 w-full">
                  <TabsTrigger value="url" className="flex-1 gap-2">
                    <LinkIcon className="h-4 w-4" /> Link
                  </TabsTrigger>
                  <TabsTrigger value="text" className="flex-1 gap-2">
                    <FileText className="h-4 w-4" /> Paste text
                  </TabsTrigger>
                </TabsList>
                <TabsContent value="url" className="space-y-2">
                  <Input
                    type="url"
                    placeholder="https://www.example.com/news/article"
                    value={url}
                    onChange={(e) => setUrl(e.target.value)}
                  />
                  <p className="text-xs text-muted-foreground">Works with most news sites and Wikipedia. Paywalled pages may not load.</p>
                </TabsContent>
                <TabsContent value="text" className="space-y-2">
                  <Textarea
                    rows={10}
                    placeholder="Paste the article text here…"
                    value={text}
                    onChange={(e) => setText(e.target.value)}
                    maxLength={20000}
                  />
                  <div className="flex items-center justify-between">
                    <Button type="button" variant="ghost" size="sm" className="h-7 gap-1.5 px-2 text-xs" onClick={() => setText(SAMPLE)}>
                      <Sparkles className="h-3.5 w-3.5" /> Use a sample article
                    </Button>
                    <span className="text-xs text-muted-foreground">{text.length}/20000</span>
                  </div>
                </TabsContent>
              </Tabs>
            </CardContent>
          </Card>
          <Button type="submit" size="lg" className="w-full gap-2">
            <ScanLine className="h-5 w-5" /> Scan article
          </Button>
        </form>

        <div className="space-y-4 lg:col-span-2">
          <Card className="border-border/60">
            <CardContent className="space-y-4 pt-6 text-sm">
              <h3 className="font-semibold">How it works</h3>
              {STEPS.map(({ icon: Icon, t, d }) => (
                <div key={t} className="flex gap-3">
                  <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
                    <Icon className="h-4 w-4" />
                  </span>
                  <div>
                    <p className="font-medium">{t}</p>
                    <p className="text-xs text-muted-foreground">{d}</p>
                  </div>
                </div>
              ))}
              <p className="border-t pt-3 text-xs text-muted-foreground">A scan checks up to 4 claims and takes a few minutes.</p>
            </CardContent>
          </Card>

          {recent.length > 0 && (
            <Card className="border-border/60">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm">Your recent scans</CardTitle>
              </CardHeader>
              <CardContent className="space-y-1">
                {recent.map((r) => (
                  <Link key={r.id} href={`/xray/${r.id}`} className="block rounded-lg p-2 transition-colors hover:bg-muted/50">
                    <p className="truncate text-sm font-medium">{r.title}</p>
                    <div className="mt-1 flex items-center justify-between gap-2">
                      <ScoreChip s={r.summary} />
                      <span className="text-[11px] text-muted-foreground">{formatDate(r.createdAt)}</span>
                    </div>
                  </Link>
                ))}
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    </div>
  );
}
