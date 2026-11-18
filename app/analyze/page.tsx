'use client';

import { useState, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { LiveAnalysis } from '@/components/live-analysis';
import { useAnalysisStream } from '@/lib/use-analysis-stream';
import { ScanSearch, Upload, Link as LinkIcon, Loader2, ImageIcon, FileText, Type, X, FileCheck } from 'lucide-react';

export default function AnalyzePage() {
  const router = useRouter();

  // --- Shared ---
  const [language, setLanguage] = useState('auto');
  const [loading, setLoading] = useState(false);
  const [analysisType, setAnalysisType] = useState<'text' | 'pdf' | 'image-text'>('image-text');
  const live = useAnalysisStream();

  // --- Text tab ---
  const [textContent, setTextContent] = useState('');

  // --- PDF tab ---
  const [pdfUrl, setPdfUrl] = useState('');
  const [uploadedPdfUrl, setUploadedPdfUrl] = useState('');
  const [uploadedPdfName, setUploadedPdfName] = useState('');
  const [pdfClaim, setPdfClaim] = useState('');
  const [pdfSubTab, setPdfSubTab] = useState('upload');
  const pdfInputRef = useRef<HTMLInputElement>(null);

  // --- Image+Text tab ---
  const [imageUrl, setImageUrl] = useState('');
  const [uploadedImageUrl, setUploadedImageUrl] = useState('');
  const [uploadedImageName, setUploadedImageName] = useState('');
  const [imageClaim, setImageClaim] = useState('');
  const [imageSubTab, setImageSubTab] = useState('upload');
  const imageInputRef = useRef<HTMLInputElement>(null);

  const effectiveImageUrl = imageSubTab === 'upload' ? uploadedImageUrl : imageUrl;
  const effectivePdfUrl = pdfSubTab === 'upload' ? uploadedPdfUrl : pdfUrl;

  // Handle local image file upload with instant base64 preview
  function handleImageFile(file: File) {
    if (!file.type.startsWith('image/')) {
      toast.error('Please select an image file (PNG, JPG, WebP).');
      return;
    }
    if (file.size > 10 * 1024 * 1024) {
      toast.error('File size must be under 10MB.');
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      const result = reader.result as string;
      setUploadedImageUrl(result);
      setUploadedImageName(file.name);
      toast.success(`Image "${file.name}" loaded successfully!`);
    };
    reader.onerror = () => {
      toast.error('Failed to read image file.');
    };
    reader.readAsDataURL(file);
  }

  // Handle local PDF file upload
  function handlePdfFile(file: File) {
    if (file.type !== 'application/pdf' && !file.name.toLowerCase().endsWith('.pdf')) {
      toast.error('Please select a valid PDF file.');
      return;
    }
    if (file.size > 15 * 1024 * 1024) {
      toast.error('PDF file size must be under 15MB.');
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      const result = reader.result as string;
      setUploadedPdfUrl(result);
      setUploadedPdfName(file.name);
      toast.success(`PDF "${file.name}" loaded successfully!`);
    };
    reader.onerror = () => {
      toast.error('Failed to read PDF file.');
    };
    reader.readAsDataURL(file);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();

    if (analysisType === 'text') {
      if (!textContent.trim()) { toast.error('Please enter text to analyze.'); return; }
    } else if (analysisType === 'pdf') {
      if (!effectivePdfUrl) { toast.error('Please provide a PDF URL or upload a PDF document.'); return; }
    } else {
      if (!effectiveImageUrl) { toast.error('Please provide an image URL or upload an image.'); return; }
      if (!imageClaim.trim()) { toast.error('Please enter a claim to verify.'); return; }
    }

    const payload =
      analysisType === 'text'
        ? { imageUrl: 'text-only', claim: textContent.trim(), language, type: 'text' }
        : analysisType === 'pdf'
        ? { imageUrl: effectivePdfUrl, claim: pdfClaim.trim() || 'Analyze this document for misinformation.', language, type: 'pdf' }
        : { imageUrl: effectiveImageUrl, claim: imageClaim.trim(), language, type: 'image-text' };

    // Text and PDF go through the multi-agent debate: stream it live
    if (analysisType !== 'image-text') {
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
      if (!res.ok) throw new Error(data.error || 'Analysis failed');
      router.push(`/analysis/${data.id}`);
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Something went wrong');
    } finally {
      setLoading(false);
    }
  }

  const LanguageCard = () => (
    <Card>
      <CardHeader><CardTitle className="text-base">Language</CardTitle></CardHeader>
      <CardContent>
        <Select value={language} onValueChange={setLanguage}>
          <SelectTrigger><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="auto">Auto-detect</SelectItem>
            <SelectItem value="en">English</SelectItem>
            <SelectItem value="hi">Hindi</SelectItem>
            <SelectItem value="ur">Urdu</SelectItem>
            <SelectItem value="zh">Chinese</SelectItem>
          </SelectContent>
        </Select>
      </CardContent>
    </Card>
  );

  if (live.state.status !== 'idle') {
    return (
      <div className="mx-auto max-w-6xl px-4 py-10 sm:px-6 lg:px-8">
        <LiveAnalysis state={live.state} onCancel={live.cancel} onReset={live.reset} />
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-5xl px-4 py-12 sm:px-6 lg:px-8">
      <div className="mb-10">
        <h1 className="text-3xl font-bold tracking-tight">Analyze Content</h1>
        <p className="mt-2 text-muted-foreground">
          Choose an input type — plain text, a PDF document, or an image with a claim — and let VeriLens detect misinformation.
        </p>
      </div>

      {/* Top-level analysis type tabs */}
      <Tabs value={analysisType} onValueChange={(v) => setAnalysisType(v as typeof analysisType)} className="mb-8">
        <TabsList className="w-full grid grid-cols-3 h-12 mb-6">
          <TabsTrigger value="image-text" className="gap-2 text-sm">
            <ImageIcon className="h-4 w-4" />
            Image + Text
          </TabsTrigger>
          <TabsTrigger value="text" className="gap-2 text-sm">
            <Type className="h-4 w-4" />
            Text
          </TabsTrigger>
          <TabsTrigger value="pdf" className="gap-2 text-sm">
            <FileText className="h-4 w-4" />
            PDF
          </TabsTrigger>
        </TabsList>

        {/* ── IMAGE + TEXT ── */}
        <TabsContent value="image-text">
          <form onSubmit={handleSubmit}>
            <div className="grid gap-8 lg:grid-cols-5">
              <div className="lg:col-span-3 space-y-6">
                <Card>
                  <CardHeader>
                    <CardTitle className="text-base">Image Source</CardTitle>
                    <CardDescription>Upload an image or provide a URL</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <Tabs value={imageSubTab} onValueChange={setImageSubTab}>
                      <TabsList className="mb-4 w-full">
                        <TabsTrigger value="upload" className="flex-1 gap-2"><Upload className="h-4 w-4" />Upload</TabsTrigger>
                        <TabsTrigger value="url" className="flex-1 gap-2"><LinkIcon className="h-4 w-4" />URL</TabsTrigger>
                      </TabsList>

                      <TabsContent value="upload">
                        {uploadedImageUrl ? (
                          <div className="space-y-3">
                            <div className="relative overflow-hidden rounded-lg border border-border bg-muted/20 flex flex-col items-center p-3">
                              <img src={uploadedImageUrl} alt="Uploaded preview" className="max-h-72 w-full object-contain rounded-md" />
                              <div className="mt-2 flex w-full items-center justify-between px-1">
                                <span className="text-xs text-muted-foreground truncate max-w-[220px]">{uploadedImageName || 'Uploaded image'}</span>
                                <Button
                                  type="button"
                                  variant="destructive"
                                  size="sm"
                                  className="h-8 gap-1 text-xs"
                                  onClick={() => { setUploadedImageUrl(''); setUploadedImageName(''); }}
                                >
                                  <X className="h-3.5 w-3.5" /> Remove
                                </Button>
                              </div>
                            </div>
                          </div>
                        ) : (
                          <div>
                            <input
                              type="file"
                              ref={imageInputRef}
                              accept="image/*"
                              className="hidden"
                              onChange={(e) => {
                                const f = e.target.files?.[0];
                                if (f) handleImageFile(f);
                              }}
                            />
                            <div
                              onClick={() => imageInputRef.current?.click()}
                              onDragOver={(e) => e.preventDefault()}
                              onDrop={(e) => {
                                e.preventDefault();
                                const f = e.dataTransfer.files?.[0];
                                if (f) handleImageFile(f);
                              }}
                              className="flex flex-col items-center justify-center border-2 border-dashed border-border/80 hover:border-primary/60 rounded-xl p-8 cursor-pointer transition-colors bg-muted/20 hover:bg-muted/40 text-center"
                            >
                              <div className="mb-3 flex h-14 w-14 items-center justify-center rounded-full bg-primary/10 text-primary">
                                <Upload className="h-7 w-7" />
                              </div>
                              <p className="font-medium text-sm">Click to choose an image or drag & drop</p>
                              <p className="text-xs text-muted-foreground mt-1">PNG, JPG, WebP up to 10MB</p>
                            </div>
                          </div>
                        )}
                      </TabsContent>

                      <TabsContent value="url">
                        <div className="space-y-2">
                          <Label htmlFor="imageUrl">Image URL</Label>
                          <Input id="imageUrl" type="url" placeholder="https://example.com/image.jpg" value={imageUrl} onChange={(e) => setImageUrl(e.target.value)} />
                          {imageUrl && (
                            <div className="mt-3 overflow-hidden rounded-lg border border-border">
                              <img src={imageUrl} alt="Preview" className="max-h-60 w-full object-contain" />
                            </div>
                          )}
                        </div>
                      </TabsContent>
                    </Tabs>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader>
                    <CardTitle className="text-base">Claim to Verify</CardTitle>
                    <CardDescription>The statement you want to fact-check against the image</CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-2">
                    <Textarea placeholder="e.g. This image shows flooding in New York City in 2024…" value={imageClaim} onChange={(e) => setImageClaim(e.target.value)} maxLength={500} rows={4} />
                    <p className="text-right text-xs text-muted-foreground">{imageClaim.length}/500</p>
                  </CardContent>
                </Card>
                <LanguageCard />
                <Button type="submit" size="lg" className="w-full gap-2" disabled={loading}>
                  {loading ? <><Loader2 className="h-5 w-5 animate-spin" /> Analyzing with CLIP…</> : <><ScanSearch className="h-5 w-5" /> Analyze Now</>}
                </Button>
              </div>

              <div className="lg:col-span-2 space-y-4">
                <Card className="border-border/60">
                  <CardContent className="pt-6">
                    <h3 className="mb-4 font-semibold">Tips for best results</h3>
                    <ul className="space-y-3 text-sm text-muted-foreground">
                      <li className="flex gap-2"><span className="mt-0.5 h-5 w-5 shrink-0 rounded-full bg-primary/20 text-center text-xs leading-5 text-primary font-bold">1</span>Upload or paste an image (JPG, PNG, WebP)</li>
                      <li className="flex gap-2"><span className="mt-0.5 h-5 w-5 shrink-0 rounded-full bg-primary/20 text-center text-xs leading-5 text-primary font-bold">2</span>Write the claim as it appears in the viral post</li>
                      <li className="flex gap-2"><span className="mt-0.5 h-5 w-5 shrink-0 rounded-full bg-primary/20 text-center text-xs leading-5 text-primary font-bold">3</span>Include location and time if present in the claim</li>
                      <li className="flex gap-2"><span className="mt-0.5 h-5 w-5 shrink-0 rounded-full bg-primary/20 text-center text-xs leading-5 text-primary font-bold">4</span>Trained CLIP classifier will compute multimodal consistency</li>
                    </ul>
                  </CardContent>
                </Card>
                <Card className="border-border/60 bg-muted/40">
                  <CardContent className="pt-6">
                    <div className="flex items-center gap-2 mb-2">
                      <ImageIcon className="h-4 w-4 text-primary" />
                      <span className="text-sm font-medium">Trained Model Active</span>
                    </div>
                    <p className="text-xs text-muted-foreground">Using your trained CLIP (ViT-B/32) classifier from clip_artifacts to verify image-text consistency.</p>
                  </CardContent>
                </Card>
              </div>
            </div>
          </form>
        </TabsContent>

        {/* ── TEXT ── */}
        <TabsContent value="text">
          <form onSubmit={handleSubmit}>
            <div className="grid gap-8 lg:grid-cols-5">
              <div className="lg:col-span-3 space-y-6">
                <Card>
                  <CardHeader>
                    <CardTitle className="text-base">Text to Analyze</CardTitle>
                    <CardDescription>Paste a news article, social media post, or any textual claim you want fact-checked.</CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-2">
                    <Textarea
                      placeholder="e.g. A new study proves that 5G towers cause respiratory illness…"
                      value={textContent}
                      onChange={(e) => setTextContent(e.target.value)}
                      maxLength={2000}
                      rows={8}
                    />
                    <p className="text-right text-xs text-muted-foreground">{textContent.length}/2000</p>
                  </CardContent>
                </Card>
                <LanguageCard />
                <Button type="submit" size="lg" className="w-full gap-2" disabled={loading}>
                  {loading ? <><Loader2 className="h-5 w-5 animate-spin" /> Analyzing…</> : <><ScanSearch className="h-5 w-5" /> Analyze Text</>}
                </Button>
              </div>
              <div className="lg:col-span-2 space-y-4">
                <Card className="border-border/60">
                  <CardContent className="pt-6">
                    <h3 className="mb-4 font-semibold">Tips for best results</h3>
                    <ul className="space-y-3 text-sm text-muted-foreground">
                      <li className="flex gap-2"><span className="mt-0.5 h-5 w-5 shrink-0 rounded-full bg-primary/20 text-center text-xs leading-5 text-primary font-bold">1</span>Paste the full article or post for context</li>
                      <li className="flex gap-2"><span className="mt-0.5 h-5 w-5 shrink-0 rounded-full bg-primary/20 text-center text-xs leading-5 text-primary font-bold">2</span>Include headlines and subheadings</li>
                      <li className="flex gap-2"><span className="mt-0.5 h-5 w-5 shrink-0 rounded-full bg-primary/20 text-center text-xs leading-5 text-primary font-bold">3</span>Select the correct language for better evidence retrieval</li>
                    </ul>
                  </CardContent>
                </Card>
              </div>
            </div>
          </form>
        </TabsContent>

        {/* ── PDF ── */}
        <TabsContent value="pdf">
          <form onSubmit={handleSubmit}>
            <div className="grid gap-8 lg:grid-cols-5">
              <div className="lg:col-span-3 space-y-6">
                <Card>
                  <CardHeader>
                    <CardTitle className="text-base">PDF Source</CardTitle>
                    <CardDescription>Upload a PDF document or provide a link</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <Tabs value={pdfSubTab} onValueChange={setPdfSubTab}>
                      <TabsList className="mb-4 w-full">
                        <TabsTrigger value="upload" className="flex-1 gap-2"><Upload className="h-4 w-4" />Upload PDF</TabsTrigger>
                        <TabsTrigger value="url" className="flex-1 gap-2"><LinkIcon className="h-4 w-4" />PDF URL</TabsTrigger>
                      </TabsList>
                      <TabsContent value="upload">
                        {uploadedPdfUrl ? (
                          <div className="space-y-3">
                            <div className="flex items-center justify-between rounded-lg border border-border p-4 bg-muted/30">
                              <div className="flex items-center gap-3 min-w-0">
                                <FileCheck className="h-8 w-8 text-primary shrink-0" />
                                <div className="min-w-0">
                                  <p className="text-sm font-medium truncate">{uploadedPdfName || 'document.pdf'}</p>
                                  <p className="text-xs text-muted-foreground">PDF Document Ready</p>
                                </div>
                              </div>
                              <Button
                                type="button"
                                variant="destructive"
                                size="sm"
                                className="gap-1 text-xs"
                                onClick={() => { setUploadedPdfUrl(''); setUploadedPdfName(''); }}
                              >
                                <X className="h-3.5 w-3.5" /> Remove
                              </Button>
                            </div>
                          </div>
                        ) : (
                          <div>
                            <input
                              type="file"
                              ref={pdfInputRef}
                              accept=".pdf,application/pdf"
                              className="hidden"
                              onChange={(e) => {
                                const f = e.target.files?.[0];
                                if (f) handlePdfFile(f);
                              }}
                            />
                            <div
                              onClick={() => pdfInputRef.current?.click()}
                              onDragOver={(e) => e.preventDefault()}
                              onDrop={(e) => {
                                e.preventDefault();
                                const f = e.dataTransfer.files?.[0];
                                if (f) handlePdfFile(f);
                              }}
                              className="flex flex-col items-center justify-center border-2 border-dashed border-border/80 hover:border-primary/60 rounded-xl p-8 cursor-pointer transition-colors bg-muted/20 hover:bg-muted/40 text-center"
                            >
                              <div className="mb-3 flex h-14 w-14 items-center justify-center rounded-full bg-primary/10 text-primary">
                                <FileText className="h-7 w-7" />
                              </div>
                              <p className="font-medium text-sm">Click to choose a PDF or drag & drop</p>
                              <p className="text-xs text-muted-foreground mt-1">PDF documents up to 15MB</p>
                            </div>
                          </div>
                        )}
                      </TabsContent>
                      <TabsContent value="url">
                        <div className="space-y-2">
                          <Label htmlFor="pdfUrl">PDF URL</Label>
                          <Input id="pdfUrl" type="url" placeholder="https://example.com/document.pdf" value={pdfUrl} onChange={(e) => setPdfUrl(e.target.value)} />
                        </div>
                      </TabsContent>
                    </Tabs>
                  </CardContent>
                </Card>
                <Card>
                  <CardHeader>
                    <CardTitle className="text-base">Claim to Verify (optional)</CardTitle>
                    <CardDescription>Optionally specify a claim to check within the document.</CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-2">
                    <Textarea placeholder="e.g. This report claims vaccines cause autism…" value={pdfClaim} onChange={(e) => setPdfClaim(e.target.value)} maxLength={500} rows={3} />
                    <p className="text-right text-xs text-muted-foreground">{pdfClaim.length}/500</p>
                  </CardContent>
                </Card>
                <LanguageCard />
                <Button type="submit" size="lg" className="w-full gap-2" disabled={loading}>
                  {loading ? <><Loader2 className="h-5 w-5 animate-spin" /> Analyzing…</> : <><ScanSearch className="h-5 w-5" /> Analyze PDF</>}
                </Button>
              </div>
              <div className="lg:col-span-2 space-y-4">
                <Card className="border-border/60">
                  <CardContent className="pt-6">
                    <h3 className="mb-4 font-semibold">Tips for best results</h3>
                    <ul className="space-y-3 text-sm text-muted-foreground">
                      <li className="flex gap-2"><span className="mt-0.5 h-5 w-5 shrink-0 rounded-full bg-primary/20 text-center text-xs leading-5 text-primary font-bold">1</span>Upload a text-based PDF report</li>
                      <li className="flex gap-2"><span className="mt-0.5 h-5 w-5 shrink-0 rounded-full bg-primary/20 text-center text-xs leading-5 text-primary font-bold">2</span>Add a specific claim to check against the document</li>
                    </ul>
                  </CardContent>
                </Card>
              </div>
            </div>
          </form>
        </TabsContent>
      </Tabs>
    </div>
  );
}
