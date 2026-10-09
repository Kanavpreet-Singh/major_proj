'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { toast } from 'sonner';
import { VerdictBadge } from '@/components/verdict-badge';
import { ConfidenceGauge } from '@/components/confidence-gauge';
import { SignalBar } from '@/components/signal-bar';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { faviconUrl, formatDate, languageLabel } from '@/lib/format';
import type { AnalysisRecord } from '@/lib/types';
import { ArrowLeft, ScanSearch, Clock, Globe, AlertTriangle, ExternalLink } from 'lucide-react';

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
          toast.error('Analysis not found');
          router.push('/history');
        } else {
          setAnalysis(data);
        }
      })
      .catch(() => toast.error('Failed to load analysis'))
      .finally(() => setLoading(false));
  }, [id, router]);

  if (loading) {
    return (
      <div className="mx-auto max-w-4xl px-4 py-12 sm:px-6 lg:px-8 space-y-6">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-64 w-full" />
        <Skeleton className="h-48 w-full" />
      </div>
    );
  }

  if (!analysis) return null;

  const stanceColor: Record<string, string> = {
    Supports: 'bg-success/10 text-success border-success/30',
    Refutes: 'bg-destructive/10 text-destructive border-destructive/30',
    Neutral: 'bg-muted text-muted-foreground',
  };

  const credColor: Record<string, string> = {
    High: 'bg-success/10 text-success border-success/30',
    Medium: 'bg-warning/10 text-warning border-warning/30',
    Low: 'bg-destructive/10 text-destructive border-destructive/30',
  };

  return (
    <div className="mx-auto max-w-4xl px-4 py-12 sm:px-6 lg:px-8">
      {/* Back */}
      <div className="mb-6 flex items-center justify-between">
        <Button asChild variant="ghost" size="sm" className="gap-2">
          <Link href="/history"><ArrowLeft className="h-4 w-4" />History</Link>
        </Button>
        <Button asChild size="sm" className="gap-2">
          <Link href="/analyze"><ScanSearch className="h-4 w-4" />New Analysis</Link>
        </Button>
      </div>

      {analysis.isMock && (
        <div className="mb-4 flex items-center gap-2 rounded-lg border border-warning/30 bg-warning/10 px-4 py-3 text-sm text-warning">
          <AlertTriangle className="h-4 w-4 shrink-0" />
          Demo mode — this is a mock result. Connect an ML backend for real analysis.
        </div>
      )}

      {/* Verdict hero */}
      <Card className="mb-6">
        <CardContent className="pt-6">
          <div className="flex flex-col items-center gap-6 sm:flex-row">
            <div className="h-32 w-32 shrink-0 overflow-hidden rounded-xl border border-border">
              <img src={analysis.imageUrl} alt="Analyzed" className="h-full w-full object-cover" />
            </div>
            <div className="flex-1 space-y-3">
              <VerdictBadge verdict={analysis.label} />
              <p className="text-lg font-medium">&ldquo;{analysis.claim}&rdquo;</p>
              <div className="flex flex-wrap gap-3 text-xs text-muted-foreground">
                <span className="flex items-center gap-1"><Clock className="h-3.5 w-3.5" />{formatDate(analysis.createdAt)}</span>
                <span className="flex items-center gap-1"><Globe className="h-3.5 w-3.5" />{languageLabel(analysis.language)}</span>
                <span>{analysis.latencyMs}ms</span>
              </div>
            </div>
            <ConfidenceGauge value={analysis.confidence} label="Confidence" size="lg" />
          </div>
        </CardContent>
      </Card>

      <div className="grid gap-6 md:grid-cols-2">
        {/* Scores */}
        <Card>
          <CardHeader><CardTitle className="text-base">Signal Scores</CardTitle></CardHeader>
          <CardContent className="space-y-4">
            <SignalBar label="CLIP Score" value={analysis.clipScore} description="Image–text visual consistency" />
            <SignalBar label="Evidence Score" value={analysis.evidenceScore} description="Strength of retrieved evidence" />
            <SignalBar label="Credibility Score" value={analysis.credibilityScore} description="Source credibility rating" />
          </CardContent>
        </Card>

        {/* Explanation */}
        <Card>
          <CardHeader><CardTitle className="text-base">Explanation</CardTitle></CardHeader>
          <CardContent>
            <p className="text-sm leading-relaxed text-muted-foreground">{analysis.explanation}</p>
          </CardContent>
        </Card>
      </div>

      {/* Evidence */}
      {analysis.evidence?.length > 0 && (
        <Card className="mt-6">
          <CardHeader><CardTitle className="text-base">Evidence Sources ({analysis.evidence.length})</CardTitle></CardHeader>
          <CardContent className="space-y-4">
            {analysis.evidence.map((item, i) => (
              <div key={i} className="flex gap-4 rounded-lg border border-border/60 p-4">
                <img
                  src={faviconUrl(item.domain)}
                  alt={item.domain}
                  className="h-8 w-8 shrink-0 rounded"
                  onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }}
                />
                <div className="flex-1 min-w-0">
                  <div className="mb-1 flex flex-wrap items-center gap-2">
                    <a href={item.url} target="_blank" rel="noopener noreferrer"
                      className="font-medium hover:underline text-sm flex items-center gap-1">
                      {item.title}<ExternalLink className="h-3 w-3" />
                    </a>
                  </div>
                  <p className="text-xs text-muted-foreground mb-2">{item.snippet}</p>
                  <div className="flex gap-2">
                    <Badge variant="outline" className={`text-xs ${stanceColor[item.stance]}`}>{item.stance}</Badge>
                    <Badge variant="outline" className={`text-xs ${credColor[item.credibility]}`}>{item.credibility} Credibility</Badge>
                  </div>
                </div>
              </div>
            ))}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
