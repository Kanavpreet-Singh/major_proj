'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { toast } from 'sonner';
import { VerdictBadge, verdictMap } from '@/components/verdict-badge';
import { DebatePanel } from '@/components/debate-panel';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { faviconUrl, formatDate, inputKind } from '@/lib/format';
import { cn } from '@/lib/utils';
import type { AnalysisRecord } from '@/lib/types';
import { ArrowLeft, FileText } from 'lucide-react';

const STANCE_COLOR: Record<string, string> = {
  Supports: 'text-success',
  Refutes: 'text-destructive',
  Neutral: 'text-muted-foreground',
};

function Stat({ label, value }: { label: string; value: number }) {
  return (
    <div>
      <div className="font-serif text-3xl tabular-nums">{Math.round(value * 100)}%</div>
      <div className="text-sm text-muted-foreground">{label}</div>
    </div>
  );
}

export default function AnalysisPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const [analysis, setAnalysis] = useState<AnalysisRecord | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch(`/api/analyses/${id}`)
      .then((r) => r.json())
      .then((data) => {
        if (data.error) {
          toast.error('That check was not found.');
          router.push('/history');
        } else {
          setAnalysis(data);
        }
      })
      .catch(() => toast.error('Could not load this check.'))
      .finally(() => setLoading(false));
  }, [id, router]);

  if (loading) {
    return (
      <div className="mx-auto max-w-3xl space-y-6 px-4 py-14 sm:px-6">
        <Skeleton className="h-6 w-24" />
        <Skeleton className="h-28 w-full" />
        <Skeleton className="h-40 w-full" />
      </div>
    );
  }
  if (!analysis) return null;

  const kind = inputKind(analysis.imageUrl);
  const isPdf = kind === 'pdf';
  const isImage = kind === 'image';
  const mark = verdictMap[analysis.label]?.mark ?? 'mark-pending';

  return (
    <article className="mx-auto max-w-3xl space-y-12 px-4 py-12 sm:px-6">
      <div className="flex items-center justify-between">
        <Link href="/history" className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground">
          <ArrowLeft className="h-4 w-4" /> History
        </Link>
        <Button asChild size="sm" variant="outline">
          <Link href="/analyze">New check</Link>
        </Button>
      </div>

      <header className="space-y-6">
        <div className="flex gap-6">
          {isImage && <img src={analysis.imageUrl} alt="" className="h-28 w-28 shrink-0 rounded-xl border object-cover sm:h-36 sm:w-36" />}
          {isPdf && (
            <span className="flex h-20 w-16 shrink-0 items-center justify-center rounded-lg border bg-card">
              <FileText className="h-6 w-6 text-muted-foreground" />
            </span>
          )}
          <h1 className="font-serif text-3xl font-medium leading-snug tracking-tight sm:text-4xl">
            <span className={mark}>{analysis.claim}</span>
          </h1>
        </div>
        <div className="flex flex-wrap items-center gap-x-6 gap-y-2 text-sm text-muted-foreground">
          <VerdictBadge verdict={analysis.label} size="lg" className="text-foreground" />
          <span>{Math.round(analysis.confidence * 100)}% confidence</span>
          <span>{formatDate(analysis.createdAt)}</span>
        </div>
      </header>

      {isImage && (
        <div className="grid grid-cols-3 gap-6 border-y py-6">
          <Stat label="Image matches claim" value={analysis.clipScore} />
          <Stat label="Evidence support" value={analysis.evidenceScore} />
          <Stat label="Source credibility" value={analysis.credibilityScore} />
        </div>
      )}

      {analysis.explanation && <p className="max-w-[68ch] text-lg leading-relaxed text-foreground/85">{analysis.explanation}</p>}

      {analysis.debate && analysis.debate.length > 0 && <DebatePanel debate={analysis.debate} labelProbs={analysis.labelProbs} />}

      {analysis.evidence?.length > 0 && (
        <section className="space-y-4">
          <h2 className="font-serif text-2xl">Sources</h2>
          <ul className="divide-y border-y">
            {analysis.evidence.map((item, i) => (
              <li key={i} className="flex gap-4 py-4">
                <img
                  src={faviconUrl(item.domain)}
                  alt=""
                  className="mt-0.5 h-5 w-5 shrink-0 rounded"
                  onError={(e) => ((e.target as HTMLImageElement).style.visibility = 'hidden')}
                />
                <div className="min-w-0 flex-1 space-y-1">
                  <div className="flex items-baseline justify-between gap-4">
                    <a href={item.url} target="_blank" rel="noopener noreferrer" className="truncate font-medium hover:underline">
                      {item.title}
                    </a>
                    <span className={cn('shrink-0 text-sm', STANCE_COLOR[item.stance])}>{item.stance}</span>
                  </div>
                  <p className="line-clamp-2 text-sm text-muted-foreground">{item.snippet}</p>
                  <p className="text-xs text-muted-foreground">
                    {item.domain}, {item.credibility.toLowerCase()} credibility
                  </p>
                </div>
              </li>
            ))}
          </ul>
        </section>
      )}
    </article>
  );
}
