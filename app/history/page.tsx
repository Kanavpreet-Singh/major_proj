'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { toast } from 'sonner';
import { VerdictBadge } from '@/components/verdict-badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';
import type { AnalysisRecord } from '@/lib/types';
import { formatDate, inputKind } from '@/lib/format';
import { cn } from '@/lib/utils';
import { FileText, Search, Trash2 } from 'lucide-react';

const FILTERS = ['all', 'True', 'False', 'Misleading', 'Unverifiable'] as const;

function Thumb({ url }: { url: string }) {
  const kind = inputKind(url);
  if (kind === 'text') return <span className="h-11 w-11 shrink-0" />;
  if (kind === 'pdf') {
    return (
      <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg border bg-card">
        <FileText className="h-4 w-4 text-muted-foreground" />
      </span>
    );
  }
  return <img src={url} alt="" className="h-11 w-11 shrink-0 rounded-lg border object-cover" />;
}

export default function HistoryPage() {
  const [records, setRecords] = useState<AnalysisRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [label, setLabel] = useState<(typeof FILTERS)[number]>('all');
  const [deleting, setDeleting] = useState<string | null>(null);

  const fetchRecords = useCallback(async () => {
    setLoading(true);
    const params = new URLSearchParams();
    if (search) params.set('search', search);
    if (label !== 'all') params.set('label', label);
    try {
      const res = await fetch(`/api/analyses?${params}`);
      const data = await res.json();
      setRecords(Array.isArray(data) ? data : []);
    } catch {
      toast.error('Could not load history.');
    } finally {
      setLoading(false);
    }
  }, [search, label]);

  useEffect(() => {
    const t = setTimeout(fetchRecords, 300);
    return () => clearTimeout(t);
  }, [fetchRecords]);

  async function remove(id: string) {
    setDeleting(id);
    try {
      const res = await fetch(`/api/analyses/${id}`, { method: 'DELETE' });
      if (!res.ok) throw new Error();
      setRecords((prev) => prev.filter((r) => r.id !== id));
      toast.success('Deleted');
    } catch {
      toast.error('Could not delete that check.');
    } finally {
      setDeleting(null);
    }
  }

  return (
    <div className="mx-auto max-w-3xl px-4 py-14 sm:px-6">
      <h1 className="font-serif text-4xl font-medium tracking-tight sm:text-5xl">History</h1>

      <div className="mt-10 space-y-4">
        <div className="relative">
          <Search className="absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input className="h-11 rounded-xl pl-10" placeholder="Search claims" value={search} onChange={(e) => setSearch(e.target.value)} />
        </div>
        <div className="flex flex-wrap gap-x-5 gap-y-2 text-sm" role="tablist" aria-label="Filter by verdict">
          {FILTERS.map((f) => (
            <button
              key={f}
              role="tab"
              aria-selected={label === f}
              onClick={() => setLabel(f)}
              className={cn('transition-colors', label === f ? 'text-foreground underline underline-offset-8' : 'text-muted-foreground hover:text-foreground')}
            >
              {f === 'all' ? 'All' : f}
            </button>
          ))}
        </div>
      </div>

      <div className="mt-8">
        {loading ? (
          <div className="space-y-3">
            {[1, 2, 3].map((i) => (
              <Skeleton key={i} className="h-16 w-full" />
            ))}
          </div>
        ) : records.length === 0 ? (
          <div className="py-20 text-center">
            <p className="font-serif text-2xl">{search || label !== 'all' ? 'No matching checks' : 'Nothing checked yet'}</p>
            {!search && label === 'all' && (
              <Button asChild className="mt-6">
                <Link href="/analyze">Check a claim</Link>
              </Button>
            )}
          </div>
        ) : (
          <ul className="divide-y border-y">
            {records.map((r) => (
              <li key={r.id} className="group flex items-center gap-4 py-4">
                <Thumb url={r.imageUrl} />
                <Link href={`/analysis/${r.id}`} className="min-w-0 flex-1">
                  <p className="truncate font-serif text-lg group-hover:underline">{r.claim}</p>
                  <p className="text-sm text-muted-foreground">{formatDate(r.createdAt)}</p>
                </Link>
                <VerdictBadge verdict={r.label} className="shrink-0" />
                <Button
                  variant="ghost"
                  size="icon"
                  className="shrink-0 text-muted-foreground opacity-0 transition-opacity hover:text-destructive focus-visible:opacity-100 group-hover:opacity-100"
                  onClick={() => remove(r.id)}
                  disabled={deleting === r.id}
                  aria-label="Delete check"
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
