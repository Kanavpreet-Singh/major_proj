import Link from 'next/link';
import { Button } from '@/components/ui/button';

export default function AboutPage() {
  return (
    <div className="mx-auto max-w-2xl px-4 py-14 sm:px-6">
      <h1 className="font-serif text-4xl font-medium tracking-tight sm:text-5xl">About</h1>
      <p className="mt-8 font-serif text-xl leading-relaxed">
        VeriLens is a BTech Computer Science major project on detecting misinformation in text, documents, images and
        news articles.
      </p>
      <p className="mt-6 text-muted-foreground">
        Its verdicts come from AI models and can be wrong. Use them as a starting point, not a final answer.
      </p>
      <div className="mt-10 flex gap-3">
        <Button asChild>
          <Link href="/analyze">Check a claim</Link>
        </Button>
        <Button asChild variant="outline">
          <Link href="/how-it-works">How it works</Link>
        </Button>
      </div>
    </div>
  );
}
