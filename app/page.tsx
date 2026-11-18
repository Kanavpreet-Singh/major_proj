import Link from 'next/link';
import { Button } from '@/components/ui/button';

const MODES = [
  { href: '/analyze?mode=text', label: 'Text' },
  { href: '/analyze?mode=pdf', label: 'PDF' },
  { href: '/analyze?mode=image-text', label: 'Image' },
  { href: '/xray', label: 'Article' },
];

export default function HomePage() {
  return (
    <section className="mx-auto flex min-h-[calc(100vh-8.5rem)] max-w-6xl flex-col justify-center px-4 py-16 sm:px-6">
      {/* A real claim, proof-marked: the true part in green, the false part in red */}
      <h1 className="max-w-4xl font-serif text-[2.6rem] font-medium leading-[1.15] tracking-tight sm:text-6xl sm:leading-[1.1]">
        Einstein{' '}
        <span className="mark-true mark-sweep" style={{ animationDelay: '0.3s' }}>
          won the Nobel Prize
        </span>{' '}
        <span className="relative whitespace-nowrap sm:whitespace-normal">
          <span className="mark-false mark-sweep" style={{ animationDelay: '1.3s' }}>
            for his theory of relativity
          </span>
          <span
            className="fade-late ml-3 inline-block translate-y-[-0.35em] rounded-full bg-destructive px-2.5 py-0.5 align-middle font-sans text-sm font-semibold tracking-normal text-destructive-foreground"
            style={{ animationDelay: '2.3s' }}
          >
            False
          </span>
        </span>
        .
      </h1>

      <p className="fade-late mt-8 max-w-xl text-lg text-muted-foreground" style={{ animationDelay: '2.7s' }}>
        Check any claim, document or article against real evidence.
      </p>

      <div className="mt-10 flex flex-wrap items-center gap-3">
        <Button asChild size="lg" className="h-12 px-7 text-base">
          <Link href="/analyze">Check a claim</Link>
        </Button>
        <Button asChild size="lg" variant="outline" className="h-12 px-7 text-base">
          <Link href="/xray">Scan an article</Link>
        </Button>
      </div>

      <nav aria-label="Input types" className="mt-16 flex flex-wrap gap-x-8 gap-y-2 text-sm text-muted-foreground">
        {MODES.map((m) => (
          <Link key={m.label} href={m.href} className="hover:text-foreground">
            {m.label}
          </Link>
        ))}
      </nav>
    </section>
  );
}
