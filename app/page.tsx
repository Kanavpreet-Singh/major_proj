import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { VerdictBadge } from '@/components/verdict-badge';
import { ScanSearch, Search, BarChart3, FileText, CheckSquare, Zap, ShieldCheck, Type, ImageIcon } from 'lucide-react';

export default function HomePage() {
  return (
    <div className="flex flex-col">
      {/* Hero */}
      <section className="relative overflow-hidden bg-gradient-to-br from-background via-accent/20 to-background py-20 md:py-32">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="mx-auto max-w-3xl text-center">
            <div className="mb-6 inline-flex items-center gap-2 rounded-full border border-primary/30 bg-primary/10 px-4 py-1.5 text-sm font-medium text-primary">
              <Zap className="h-3.5 w-3.5" />
              Multimodal AI · Evidence Retrieval · Instant Verdict
            </div>
            <h1 className="mb-6 text-4xl font-extrabold tracking-tight sm:text-6xl">
              Detect Image{' '}
              <span className="bg-gradient-to-r from-primary to-cyan-400 bg-clip-text text-transparent">
                Misinformation
              </span>{' '}
              with AI
            </h1>
            <p className="mb-8 text-lg text-muted-foreground sm:text-xl">
              Analyze plain text, PDF documents, or images with claims — VeriLens cross-references your content against
              real-world evidence using multimodal AI and returns a confidence-backed verdict in seconds.
            </p>
            <div className="flex flex-col items-center gap-3 sm:flex-row sm:justify-center">
              <Button asChild size="lg" className="gap-2 text-base">
                <Link href="/analyze">
                  <ScanSearch className="h-5 w-5" />
                  Start Analyzing
                </Link>
              </Button>
              <Button asChild variant="outline" size="lg" className="gap-2 text-base">
                <Link href="/how-it-works">How It Works</Link>
              </Button>
            </div>
          </div>
        </div>
      </section>

      {/* Stats */}
      <section className="border-y border-border/60 bg-muted/30 py-8">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-3 divide-x divide-border/60 text-center">
            {[
              { value: '< 5s', label: 'Analysis Time' },
              { value: '4', label: 'Verdict Classes' },
              { value: '5', label: 'Languages' },
            ].map((stat) => (
              <div key={stat.label} className="px-6 py-4">
                <p className="text-2xl font-bold text-primary sm:text-3xl">{stat.value}</p>
                <p className="text-sm text-muted-foreground">{stat.label}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Features */}
      <section className="py-20">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="mb-12 text-center">
            <h2 className="text-3xl font-bold tracking-tight">Powered by Advanced AI</h2>
            <p className="mt-3 text-muted-foreground">Multiple AI signals combined for reliable verdicts</p>
          </div>
          <div className="grid gap-6 sm:grid-cols-3">
            {[
              {
                icon: ScanSearch,
                title: 'Multimodal AI Analysis',
                desc: 'CLIP model computes image-text consistency score to detect whether the image actually matches the accompanying claim.',
              },
              {
                icon: Search,
                title: 'Evidence Retrieval',
                desc: 'Queries trusted fact-checking sources like Reuters, AP, Snopes, and BBC to surface corroborating or refuting evidence.',
              },
              {
                icon: BarChart3,
                title: 'Confidence Scoring',
                desc: 'Aggregates CLIP score, evidence stance, and source credibility into a transparent, calibrated confidence percentage.',
              },
            ].map(({ icon: Icon, title, desc }) => (
              <Card key={title} className="border-border/60 transition-shadow hover:shadow-md">
                <CardContent className="pt-6">
                  <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-xl bg-primary/10">
                    <Icon className="h-6 w-6 text-primary" />
                  </div>
                  <h3 className="mb-2 text-lg font-semibold">{title}</h3>
                  <p className="text-sm text-muted-foreground">{desc}</p>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </section>

      {/* How it works steps */}
      <section className="bg-muted/30 py-20">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="mb-12 text-center">
            <h2 className="text-3xl font-bold tracking-tight">Three Ways to Detect Misinformation</h2>
            <p className="mt-3 text-muted-foreground">Pick the mode that matches your content — VeriLens handles the rest</p>
          </div>
          <div className="grid gap-8 md:grid-cols-3">
            {[
              { step: '01', icon: Type, title: 'Text Analysis', desc: 'Paste any news article, tweet, or social media post. VeriLens scans for false claims and cross-references evidence sources automatically.' },
              { step: '02', icon: FileText, title: 'PDF Analysis', desc: 'Upload a PDF report or link to a document online. The system extracts text, identifies key claims, and checks them against trusted sources.' },
              { step: '03', icon: ImageIcon, title: 'Image + Text', desc: 'Provide an image and the claim made about it. The multimodal AI checks consistency between the image and the claim, then retrieves supporting evidence.' },
            ].map(({ step, icon: Icon, title, desc }) => (
              <div key={step} className="flex flex-col items-center text-center">
                <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-primary text-primary-foreground">
                  <Icon className="h-8 w-8" />
                </div>
                <h3 className="mb-2 text-xl font-semibold">{title}</h3>
                <p className="text-muted-foreground">{desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Verdict preview */}
      <section className="py-20">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="mb-12 text-center">
            <h2 className="text-3xl font-bold tracking-tight">Four Verdict Classes</h2>
            <p className="mt-3 text-muted-foreground">Every analysis returns one of four evidence-backed labels</p>
          </div>
          <div className="flex flex-wrap items-center justify-center gap-4">
            <VerdictBadge verdict="True" />
            <VerdictBadge verdict="False" />
            <VerdictBadge verdict="Misleading" />
            <VerdictBadge verdict="Unverifiable" />
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="bg-primary/5 py-16">
        <div className="mx-auto max-w-2xl px-4 text-center">
          <ShieldCheck className="mx-auto mb-4 h-12 w-12 text-primary" />
          <h2 className="mb-4 text-3xl font-bold">Ready to Verify?</h2>
          <p className="mb-6 text-muted-foreground">Fight misinformation with AI. Analyze text, PDFs, or images — every analysis is stored in your history for later reference.</p>
          <Button asChild size="lg" className="gap-2">
            <Link href="/analyze">
              <ScanSearch className="h-5 w-5" />
              Start Analyzing
            </Link>
          </Button>
        </div>
      </section>
    </div>
  );
}
