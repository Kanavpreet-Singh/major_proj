'use client';

import { useEffect, useState, useCallback } from 'react';
import Link from 'next/link';
import { toast } from 'sonner';
import { VerdictBadge } from '@/components/verdict-badge';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import type { AnalysisRecord } from '@/lib/types';
import { formatDate } from '@/lib/format';
import { Search, Trash2, ScanSearch, Clock } from 'lucide-react';

export default function HistoryPage() {
  const [records, setRecords] = useState<AnalysisRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [label, setLabel] = useState('all');
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
      toast.error('Failed to load history');
    } finally {
      setLoading(false);
    }
  }, [search, label]);

  useEffect(() => {
    const t = setTimeout(() => fetchRecords(), 300);
    return () => clearTimeout(t);
  }, [fetchRecords]);

  async function handleDelete(id: string) {
    setDeleting(id);
    try {
      const res = await fetch(`/api/analyses/${id}`, { method: 'DELETE' });
      if (!res.ok) throw new Error('Delete failed');
      setRecords((prev) => prev.filter((r) => r.id !== id));
      toast.success('Analysis deleted');
    } catch {
      toast.error('Failed to delete analysis');
    } finally {
      setDeleting(null);
    }
  }

  return (
    <div className="mx-auto max-w-4xl px-4 py-12 sm:px-6 lg:px-8">
      <div className="mb-8 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Analysis History</h1>
          <p className="mt-1 text-muted-foreground">All analyses from this browser session</p>
        </div>
        <Button asChild size="sm" className="gap-2 shrink-0">
          <Link href="/analyze"><ScanSearch className="h-4 w-4" />New Analysis</Link>
        </Button>
      </div>

      {/* Filters */}
      <div className="mb-6 flex flex-col gap-3 sm:flex-row">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            className="pl-9"
            placeholder="Search claims..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        <Select value={label} onValueChange={setLabel}>
          <SelectTrigger className="w-full sm:w-44">
            <SelectValue placeholder="Filter by verdict" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Verdicts</SelectItem>
            <SelectItem value="True">True</SelectItem>
            <SelectItem value="False">False</SelectItem>
            <SelectItem value="Misleading">Misleading</SelectItem>
            <SelectItem value="Unverifiable">Unverifiable</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Content */}
      {loading ? (
        <div className="space-y-4">
          {[1,2,3].map((i) => <Skeleton key={i} className="h-24 w-full rounded-xl" />)}
        </div>
      ) : records.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-24 text-center">
          <ScanSearch className="mb-4 h-12 w-12 text-muted-foreground/40" />
          <p className="text-lg font-medium text-muted-foreground">No analyses yet</p>
          <p className="text-sm text-muted-foreground">Start by analyzing an image.</p>
          <Button asChild className="mt-6" size="sm">
            <Link href="/analyze">Analyze an Image</Link>
          </Button>
        </div>
      ) : (
        <div className="space-y-3">
          {records.map((record) => (
            <Card key={record.id} className="overflow-hidden transition-shadow hover:shadow-md">
              <CardContent className="flex items-center gap-4 p-4">
                <Link href={`/analysis/${record.id}`} className="h-14 w-14 shrink-0 overflow-hidden rounded-lg border border-border">
                  <img src={record.imageUrl} alt="" className="h-full w-full object-cover" />
                </Link>
                <div className="flex-1 min-w-0">
                  <Link href={`/analysis/${record.id}`} className="block">
                    <p className="truncate font-medium hover:underline">{record.claim}</p>
                    <p className="mt-0.5 flex items-center gap-1 text-xs text-muted-foreground">
                      <Clock className="h-3 w-3" />{formatDate(record.createdAt)}
                    </p>
                  </Link>
                </div>
                <VerdictBadge verdict={record.label} />
                <Button
                  variant="ghost"
                  size="icon"
                  className="shrink-0 text-muted-foreground hover:text-destructive"
                  onClick={() => handleDelete(record.id)}
                  disabled={deleting === record.id}
                  aria-label="Delete"
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
