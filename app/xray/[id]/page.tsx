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
import { ArrowLeft } from 'lucide-react';

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
        <p className="mb-6 font-serif text-2xl">This scan no longer exists.</p>
        <Button asChild>
          <Link href="/xray">Scan an article</Link>
        </Button>
      </div>
    );
  }
  if (!record) {
    return (
      <div className="mx-auto max-w-6xl space-y-6 px-4 py-10 sm:px-6">
        <Skeleton className="h-12 w-2/3" />
        <Skeleton className="h-16 w-48" />
        <Skeleton className="h-96 w-full" />
      </div>
    );
  }

  const claims: LiveClaim[] = record.claims.map((c) => ({ ...c, status: 'done' }));
  return (
    <div className="mx-auto max-w-6xl px-4 py-10 sm:px-6">
      <XRayView
        article={{ title: record.title, url: record.url, text: record.text, truncated: record.truncated }}
        claims={claims}
        summary={record.summary}
        running={false}
        stages={{ fetch: 'done', extract: 'done', check: 'done' }}
        headerExtra={
          <>
            <Link href="/xray" className="inline-flex items-center gap-1.5 text-muted-foreground hover:text-foreground">
              <ArrowLeft className="h-4 w-4" /> Article X-Ray
            </Link>
            <span className="text-muted-foreground">{formatDate(record.createdAt)}</span>
          </>
        }
      />
    </div>
  );
}
