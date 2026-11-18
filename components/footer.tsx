import Link from 'next/link';

export function Footer() {
  return (
    <footer className="border-t border-border/70">
      <div className="mx-auto flex max-w-6xl flex-col gap-2 px-4 py-6 text-sm text-muted-foreground sm:flex-row sm:items-center sm:justify-between sm:px-6">
        <p>Verdicts are AI-generated. Check important claims with trusted sources.</p>
        <Link href="/about" className="hover:text-foreground">
          About
        </Link>
      </div>
    </footer>
  );
}
