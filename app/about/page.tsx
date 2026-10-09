import Link from 'next/link';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { ScanSearch, Database, Server, Layers, ShieldCheck, Users } from 'lucide-react';

const stack = [
  { icon: Layers, name: 'Next.js 13', desc: 'React framework with App Router, server components, and API routes.' },
  { icon: Database, name: 'Neon + Drizzle ORM', desc: 'Serverless Postgres with type-safe schema and migrations.' },
  { icon: Server, name: 'UploadThing', desc: 'Managed file uploads with CDN hosting for user images.' },
  { icon: ShieldCheck, name: 'OpenAI CLIP', desc: 'ViT-B/32 multimodal model for image-text consistency scoring.' },
  { icon: Layers, name: 'Zod + React Hook Form', desc: 'End-to-end type-safe validation on client and server.' },
  { icon: Layers, name: 'shadcn/ui + Tailwind CSS', desc: 'Accessible, themeable UI components with a custom design system.' },
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
          A BTech CSE Major Project on multimodal fake-news detection.
        </p>
      </div>

      {/* Mission */}
      <Card className="mb-8">
        <CardContent className="pt-6">
          <h2 className="mb-3 text-xl font-semibold">Mission</h2>
          <p className="text-muted-foreground">
            Misinformation spread through images is one of the defining challenges of the digital age. VeriLens
            addresses this by combining vision-language AI (CLIP) with automated evidence retrieval to produce
            verifiable, confidence-backed fact-checks in under five seconds — accessible to anyone with a browser.
          </p>
        </CardContent>
      </Card>

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
          <p className="text-muted-foreground">Built by BTech Computer Science &amp; Engineering students as a Major Project. The system integrates techniques from computer vision, natural language processing, and information retrieval.</p>
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
