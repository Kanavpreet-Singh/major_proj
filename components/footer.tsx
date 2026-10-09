import Link from 'next/link';
import { ScanSearch, Github } from 'lucide-react';

export function Footer() {
  return (
    <footer className="border-t border-border/60 bg-muted/30">
      <div className="mx-auto max-w-7xl px-4 py-10 sm:px-6 lg:px-8">
        <div className="flex flex-col items-center justify-between gap-6 sm:flex-row">
          <div className="flex items-center gap-2">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary">
              <ScanSearch className="h-4 w-4 text-primary-foreground" />
            </div>
            <div>
              <p className="text-sm font-bold">VeriLens</p>
              <p className="text-xs text-muted-foreground">BTech CSE Major Project</p>
            </div>
          </div>

          <nav className="flex flex-wrap items-center justify-center gap-4 text-sm">
            <Link href="/analyze" className="text-muted-foreground transition-colors hover:text-foreground">Analyze</Link>
            <Link href="/history" className="text-muted-foreground transition-colors hover:text-foreground">History</Link>
            <Link href="/evaluation" className="text-muted-foreground transition-colors hover:text-foreground">Evaluation</Link>
            <Link href="/how-it-works" className="text-muted-foreground transition-colors hover:text-foreground">How It Works</Link>
            <Link href="/about" className="text-muted-foreground transition-colors hover:text-foreground">About</Link>
          </nav>
        </div>

        <div className="mt-6 border-t border-border/40 pt-6 text-center">
          <p className="text-xs text-muted-foreground">
            AI-assisted verdicts; always verify with trusted sources.
          </p>
        </div>
      </div>
    </footer>
  );
}
