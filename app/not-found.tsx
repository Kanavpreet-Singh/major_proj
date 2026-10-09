import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { ScanSearch, Home } from 'lucide-react';

export default function NotFound() {
  return (
    <div className="flex min-h-[60vh] flex-col items-center justify-center px-4 text-center">
      <h1 className="text-6xl font-black text-primary">404</h1>
      <h2 className="mt-4 text-2xl font-bold tracking-tight">Page Not Found</h2>
      <p className="mt-2 max-w-md text-sm text-muted-foreground">
        The analysis or page you are looking for does not exist, or the link has expired.
      </p>
      <div className="mt-6 flex gap-3">
        <Button asChild variant="outline">
          <Link href="/" className="gap-2">
            <Home className="h-4 w-4" /> Home
          </Link>
        </Button>
        <Button asChild>
          <Link href="/analyze" className="gap-2">
            <ScanSearch className="h-4 w-4" /> Start New Analysis
          </Link>
        </Button>
      </div>
    </div>
  );
}
