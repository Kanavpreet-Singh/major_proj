import Link from 'next/link';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { ScanSearch, Database, Server, Layers, ShieldCheck, Users, Type, FileText, ImageIcon } from 'lucide-react';

const stack = [
  { icon: Layers, name: 'Next.js 13', desc: 'React framework with App Router, server components, and API routes.' },
  { icon: Database, name: 'Neon + Drizzle ORM', desc: 'Serverless Postgres with type-safe schema and migrations.' },
  { icon: Server, name: 'UploadThing', desc: 'Managed file uploads with CDN hosting for user images and documents.' },
  { icon: ShieldCheck, name: 'OpenAI CLIP', desc: 'ViT-B/32 multimodal model for image-text consistency scoring.' },
  { icon: Layers, name: 'Zod + React Hook Form', desc: 'End-to-end type-safe validation on client and server.' },
  { icon: Layers, name: 'shadcn/ui + Tailwind CSS', desc: 'Accessible, themeable UI components with a custom design system.' },
];

const modes = [
  {
    icon: Type,
    name: 'Text Analysis',
    desc: 'Paste any news article, social media post, or written claim. VeriLens extracts key assertions and cross-references them against trusted fact-checking databases.',
  },
  {
    icon: FileText,
    name: 'PDF Analysis',
    desc: 'Upload a PDF report or link to a document. The system parses the text, identifies potentially false claims, and returns evidence-backed verdicts for each.',
  },
  {
    icon: ImageIcon,
    name: 'Image + Text',
    desc: 'Provide an image alongside the claim made about it. Our multimodal AI (CLIP) measures image-text consistency, then retrieves corroborating or refuting evidence.',
  },
];

export default function AboutPage() {
  return (
    <div className="mx-auto max-w-4xl px-4 py-12 sm:px-6 lg:px-8">
      {/* Header */}
      <div className="mb-12 text-center">
        <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-primary">
          <ScanSearch className="h-8 w-8 text-primary-foreground" />
        </div>
        <h1 className="text-3xl font-bold tracking-tight sm:text-4xl">About VeriLens</h1>
        <p className="mt-4 text-muted-foreground">
          A BTech CSE Major Project on multimodal fake-news detection — supporting text, PDF, and image analysis.
        </p>
      </div>

      {/* Mission */}
      <Card className="mb-8">
        <CardContent className="pt-6">
          <h2 className="mb-3 text-xl font-semibold">Mission</h2>
          <p className="text-muted-foreground">
            Misinformation spreads across every format — viral images, misleading articles, and manipulated documents.
            VeriLens addresses this by combining vision-language AI (CLIP) with automated evidence retrieval to produce
            verifiable, confidence-backed fact-checks in under five seconds. Whether the content is plain text, a PDF
            report, or an image paired with a claim, VeriLens is accessible to anyone with a browser.
          </p>
        </CardContent>
      </Card>

      {/* Three Analysis Modes */}
      <div className="mb-8">
        <h2 className="mb-4 text-xl font-semibold">Three Analysis Modes</h2>
        <div className="grid gap-4 sm:grid-cols-3">
          {modes.map(({ icon: Icon, name, desc }) => (
            <Card key={name} className="border-border/60 transition-shadow hover:shadow-md">
              <CardContent className="pt-6">
                <div className="mb-3 flex h-12 w-12 items-center justify-center rounded-xl bg-primary/10">
                  <Icon className="h-6 w-6 text-primary" />
                </div>
                <h3 className="mb-2 font-semibold text-sm">{name}</h3>
                <p className="text-xs text-muted-foreground">{desc}</p>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>

      {/* Tech Stack */}
      <div className="mb-8">
        <h2 className="mb-4 text-xl font-semibold">Technology Stack</h2>
        <div className="grid gap-4 sm:grid-cols-2">
          {stack.map(({ icon: Icon, name, desc }) => (
            <Card key={name} className="flex gap-4 p-4">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-primary/10">
                <Icon className="h-5 w-5 text-primary" />
              </div>
              <div>
                <p className="font-semibold text-sm">{name}</p>
                <p className="text-xs text-muted-foreground">{desc}</p>
              </div>
            </Card>
          ))}
        </div>
      </div>

      {/* Team */}
      <Card className="mb-8">
        <CardHeader><CardTitle className="flex items-center gap-2"><Users className="h-5 w-5" />Team</CardTitle></CardHeader>
        <CardContent>
          <p className="text-muted-foreground">Built by BTech Computer Science &amp; Engineering students as a Major Project. The system integrates techniques from computer vision, natural language processing, and information retrieval to tackle misinformation across text, PDF, and image modalities.</p>
        </CardContent>
      </Card>

      {/* Disclaimer */}
      <div className="rounded-lg border border-warning/30 bg-warning/10 p-4 text-sm text-warning mb-8">
        <strong>Disclaimer:</strong> VeriLens uses AI to assist fact-checking. Results should not be considered definitive. Always cross-reference with authoritative human fact-checkers.
      </div>

      <div className="flex flex-wrap gap-3">
        <Button asChild><Link href="/analyze">Try VeriLens</Link></Button>
        <Button asChild variant="outline"><Link href="/how-it-works">How It Works</Link></Button>
      </div>
    </div>
  );
}
