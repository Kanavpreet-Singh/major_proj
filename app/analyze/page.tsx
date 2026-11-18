'use client';

import { useEffect, useRef, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { LiveAnalysis } from '@/components/live-analysis';
import { useAnalysisStream } from '@/lib/use-analysis-stream';
import { cn } from '@/lib/utils';
import { FileText, ImageIcon, Loader2, X } from 'lucide-react';

type Mode = 'text' | 'pdf' | 'image-text';

const MODES: { value: Mode; label: string }[] = [
  { value: 'text', label: 'Text' },
  { value: 'pdf', label: 'PDF' },
  { value: 'image-text', label: 'Image' },
];

const LANGUAGES = [
  { value: 'auto', label: 'Auto language' },
  { value: 'en', label: 'English' },
  { value: 'hi', label: 'Hindi' },
  { value: 'ur', label: 'Urdu' },
  { value: 'zh', label: 'Chinese' },
];

/** File picker with drag and drop; shows the chosen file with a remove button. */
function Dropzone({
  accept,
  icon: Icon,
  label,
  file,
  preview,
  onFile,
  onClear,
}: {
  accept: string;
  icon: typeof FileText;
  label: string;
  file: string;
  preview?: string;
  onFile: (f: File) => void;
  onClear: () => void;
}) {
  const ref = useRef<HTMLInputElement>(null);
  if (file) {
    return (
      <div className="flex items-center gap-4 rounded-xl border bg-card p-3">
        {preview ? (
          <img src={preview} alt="" className="h-16 w-16 rounded-lg object-cover" />
        ) : (
          <span className="flex h-16 w-16 items-center justify-center rounded-lg bg-muted">
            <Icon className="h-6 w-6 text-muted-foreground" />
          </span>
        )}
        <span className="min-w-0 flex-1 truncate text-sm">{file}</span>
        <Button type="button" variant="ghost" size="icon" onClick={onClear} aria-label="Remove file">
          <X className="h-4 w-4" />
        </Button>
      </div>
    );
  }
  return (
    <>
      <input
        ref={ref}
        type="file"
        accept={accept}
        className="hidden"
        onChange={(e) => {
          const f = e.target.files?.[0];
          if (f) onFile(f);
          e.target.value = '';
        }}
      />
      <button
        type="button"
        onClick={() => ref.current?.click()}
        onDragOver={(e) => e.preventDefault()}
        onDrop={(e) => {
          e.preventDefault();
          const f = e.dataTransfer.files?.[0];
          if (f) onFile(f);
        }}
        className="flex w-full flex-col items-center justify-center gap-2 rounded-xl border-2 border-dashed border-input bg-card px-6 py-10 text-sm text-muted-foreground transition-colors hover:border-primary/60 hover:text-foreground"
      >
        <Icon className="h-6 w-6" />
        {label}
      </button>
    </>
  );
}

function readFile(file: File, done: (dataUrl: string) => void) {
  const reader = new FileReader();
  reader.onload = () => done(reader.result as string);
  reader.onerror = () => toast.error('Could not read that file.');
  reader.readAsDataURL(file);
}

export default function AnalyzePage() {
  const router = useRouter();
  const params = useSearchParams();
  const live = useAnalysisStream();

  const [mode, setMode] = useState<Mode>('text');
  const [language, setLanguage] = useState('auto');
  const [loading, setLoading] = useState(false);

  const [text, setText] = useState('');
  const [pdf, setPdf] = useState({ data: '', name: '', url: '', claim: '' });
  const [image, setImage] = useState({ data: '', name: '', url: '', claim: '' });
  const [useLink, setUseLink] = useState(false);

  useEffect(() => {
    const m = params.get('mode');
    if (m === 'text' || m === 'pdf' || m === 'image-text') setMode(m);
  }, [params]);

  const pdfSource = useLink ? pdf.url.trim() : pdf.data;
  const imageSource = useLink ? image.url.trim() : image.data;

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    let payload: { imageUrl: string; claim: string; language: string; type: Mode };
    if (mode === 'text') {
      if (!text.trim()) return toast.error('Enter a claim to check.');
      payload = { imageUrl: 'text-only', claim: text.trim(), language, type: 'text' };
    } else if (mode === 'pdf') {
      if (!pdfSource) return toast.error(useLink ? 'Enter a link to a PDF.' : 'Choose a PDF.');
      payload = {
        imageUrl: pdfSource,
        claim: pdf.claim.trim() || 'Analyze this document for misinformation.',
        language,
        type: 'pdf',
      };
    } else {
      if (!imageSource) return toast.error(useLink ? 'Enter a link to an image.' : 'Choose an image.');
      if (!image.claim.trim()) return toast.error('Enter the claim made about the image.');
      payload = { imageUrl: imageSource, claim: image.claim.trim(), language, type: 'image-text' };
    }

    // Text and PDF go through the agent debate, streamed live
    if (mode !== 'image-text') {
      window.scrollTo({ top: 0, behavior: 'smooth' });
      live.start(payload);
      return;
    }

    setLoading(true);
    try {
      const res = await fetch('/api/analyze', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'The check failed.');
      router.push(`/analysis/${data.id}`);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'The check failed.');
    } finally {
      setLoading(false);
    }
  }

  if (live.state.status !== 'idle') {
    return (
      <div className="mx-auto max-w-6xl px-4 py-10 sm:px-6">
        <LiveAnalysis state={live.state} onCancel={live.cancel} onReset={live.reset} />
      </div>
    );
  }

  const linkToggle = (
    <button type="button" className="text-sm text-muted-foreground underline-offset-4 hover:text-foreground hover:underline" onClick={() => setUseLink((v) => !v)}>
      {useLink ? 'Upload a file instead' : 'Use a link instead'}
    </button>
  );

  return (
    <div className="mx-auto max-w-2xl px-4 py-14 sm:px-6">
      <h1 className="font-serif text-4xl font-medium tracking-tight sm:text-5xl">Check a claim</h1>

      <div role="tablist" aria-label="Input type" className="mt-8 flex gap-6 border-b">
        {MODES.map((m) => (
          <button
            key={m.value}
            role="tab"
            aria-selected={mode === m.value}
            onClick={() => {
              setMode(m.value);
              setUseLink(false);
            }}
            className={cn(
              '-mb-px border-b-2 pb-3 text-sm transition-colors',
              mode === m.value ? 'border-foreground text-foreground' : 'border-transparent text-muted-foreground hover:text-foreground'
            )}
          >
            {m.label}
          </button>
        ))}
      </div>

      <form onSubmit={submit} className="mt-8 space-y-5">
        {mode === 'text' && (
          <textarea
            autoFocus
            value={text}
            onChange={(e) => setText(e.target.value)}
            maxLength={2000}
            rows={5}
            placeholder="Type or paste a claim"
            className="w-full resize-none rounded-xl border border-input bg-card px-5 py-4 font-serif text-xl leading-relaxed placeholder:text-muted-foreground/70 focus-visible:border-primary/60 focus-visible:outline-none focus-visible:ring-0 focus-visible:ring-offset-0"
          />
        )}

        {mode === 'pdf' && (
          <>
            {useLink ? (
              <Input type="url" placeholder="https://example.com/report.pdf" value={pdf.url} onChange={(e) => setPdf({ ...pdf, url: e.target.value })} />
            ) : (
              <Dropzone
                accept=".pdf,application/pdf"
                icon={FileText}
                label="Choose a PDF or drop it here"
                file={pdf.name}
                onClear={() => setPdf({ ...pdf, data: '', name: '' })}
                onFile={(f) => {
                  if (!f.name.toLowerCase().endsWith('.pdf')) return toast.error('Choose a PDF file.');
                  if (f.size > 15 * 1024 * 1024) return toast.error('PDFs must be under 15 MB.');
                  readFile(f, (data) => setPdf((p) => ({ ...p, data, name: f.name })));
                }}
              />
            )}
            {linkToggle}
            <Input
              placeholder="Claim to check in the document (optional)"
              value={pdf.claim}
              maxLength={500}
              onChange={(e) => setPdf({ ...pdf, claim: e.target.value })}
            />
          </>
        )}

        {mode === 'image-text' && (
          <>
            {useLink ? (
              <>
                <Input type="url" placeholder="https://example.com/photo.jpg" value={image.url} onChange={(e) => setImage({ ...image, url: e.target.value })} />
                {image.url && <img src={image.url} alt="" className="max-h-64 rounded-xl border object-contain" />}
              </>
            ) : (
              <Dropzone
                accept="image/*"
                icon={ImageIcon}
                label="Choose an image or drop it here"
                file={image.name}
                preview={image.data}
                onClear={() => setImage({ ...image, data: '', name: '' })}
                onFile={(f) => {
                  if (!f.type.startsWith('image/')) return toast.error('Choose an image file.');
                  if (f.size > 10 * 1024 * 1024) return toast.error('Images must be under 10 MB.');
                  readFile(f, (data) => setImage((p) => ({ ...p, data, name: f.name })));
                }}
              />
            )}
            {linkToggle}
            <textarea
              value={image.claim}
              onChange={(e) => setImage({ ...image, claim: e.target.value })}
              maxLength={500}
              rows={3}
              placeholder="What does the post claim this image shows?"
              className="w-full resize-none rounded-xl border border-input bg-card px-4 py-3 font-serif text-lg leading-relaxed placeholder:text-muted-foreground/70 focus-visible:border-primary/60 focus-visible:outline-none focus-visible:ring-0 focus-visible:ring-offset-0"
            />
          </>
        )}

        <div className="flex items-center justify-between gap-3 pt-2">
          <Select value={language} onValueChange={setLanguage}>
            <SelectTrigger className="h-10 w-40 border-transparent bg-transparent px-2 text-muted-foreground shadow-none hover:text-foreground" aria-label="Language">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {LANGUAGES.map((l) => (
                <SelectItem key={l.value} value={l.value}>
                  {l.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Button type="submit" size="lg" className="h-11 px-8" disabled={loading}>
            {loading ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Checking
              </>
            ) : (
              'Check'
            )}
          </Button>
        </div>
      </form>
    </div>
  );
}
