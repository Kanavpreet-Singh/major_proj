'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { XRayView } from '@/components/xray-view';
import { formatDate } from '@/lib/format';
import type { XRayRecord } from '@/lib/validations';
import type { LiveClaim } from '@/lib/use-xray-stream';
import { ArrowLeft, ScanLine } from 'lucide-react';

export default function XRayReportPage() {
  const { id } = useParams<{ id: string }>();
  const [record, setRecord] = useState<XRayRecord | null>(null);
  const [missing, setMissing] = useState(false);

  useEffect(() => {
    fetch(`/api/xray/${id}`)
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error('not found'))))
      .then(setRecord)
      .catch(() => setMissing(true));
  }, [id]);

  if (missing) {
    return (
      <div className="mx-auto max-w-xl px-4 py-24 text-center">
        <p className="mb-4 text-muted-foreground">This scan could not be found.</p>
        <Button asChild>
          <Link href="/xray">Scan an article</Link>
        </Button>
      </div>
    );
  }
  if (!record) {
    return (
      <div className="mx-auto max-w-7xl space-y-6 px-4 py-10 sm:px-6 lg:px-8">
        <Skeleton className="h-32 w-full rounded-2xl" />
        <Skeleton className="h-24 w-full rounded-2xl" />
        <Skeleton className="h-96 w-full rounded-2xl" />
      </div>
    );
  }

  const claims: LiveClaim[] = record.claims.map((c) => ({ ...c, status: 'done' }));
  return (
    <div className="mx-auto max-w-7xl space-y-4 px-4 py-10 sm:px-6 lg:px-8">
      <div className="flex items-center justify-between">
        <Button asChild variant="ghost" size="sm" className="gap-2">
          <Link href="/xray">
            <ArrowLeft className="h-4 w-4" /> Article X-Ray
          </Link>
        </Button>
        <Button asChild size="sm" className="gap-2">
          <Link href="/xray">
            <ScanLine className="h-4 w-4" /> New scan
          </Link>
        </Button>
      </div>
      <XRayView
        article={{ title: record.title, url: record.url, text: record.text, truncated: record.truncated }}
        claims={claims}
        summary={record.summary}
        running={false}
        stages={{ fetch: 'done', extract: 'done', check: 'done' }}
        headerExtra={
          <span className="text-xs text-muted-foreground">
            Scanned {formatDate(record.createdAt)} · {Math.round(record.latencyMs / 1000)}s
          </span>
        }
      />
    </div>
  );
}
