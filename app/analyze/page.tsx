'use client';

import { useState } from 'react';
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
import { ScanSearch, Upload, Link as LinkIcon, Loader2, ImageIcon } from 'lucide-react';
import { UploadDropzone } from '@uploadthing/react';
import type { AppFileRouter } from '@/lib/uploadthing';

export default function AnalyzePage() {
  const router = useRouter();
  const [imageUrl, setImageUrl] = useState('');
  const [claim, setClaim] = useState('');
  const [language, setLanguage] = useState('auto');
  const [loading, setLoading] = useState(false);
  const [uploadedUrl, setUploadedUrl] = useState('');
  const [activeTab, setActiveTab] = useState('url');

  const effectiveImageUrl = activeTab === 'upload' ? uploadedUrl : imageUrl;

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!effectiveImageUrl) {
      toast.error('Please provide an image URL or upload an image.');
      return;
    }
    if (!claim.trim()) {
      toast.error('Please enter a claim to verify.');
      return;
    }
    setLoading(true);
    try {
      const res = await fetch('/api/analyze', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ imageUrl: effectiveImageUrl, claim: claim.trim(), language }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Analysis failed');
      if (data.isMock) toast.info('Running in demo mode — no ML backend connected.');
      router.push(`/analysis/${data.id}`);
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Something went wrong');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="mx-auto max-w-5xl px-4 py-12 sm:px-6 lg:px-8">
      <div className="mb-10">
        <h1 className="text-3xl font-bold tracking-tight">Analyze Image</h1>
        <p className="mt-2 text-muted-foreground">Provide an image and a claim to check its authenticity.</p>
      </div>

      <div className="grid gap-8 lg:grid-cols-5">
        {/* Form */}
        <form onSubmit={handleSubmit} className="lg:col-span-3 space-y-6">
          {/* Image source */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Image Source</CardTitle>
              <CardDescription>Upload an image or provide a URL</CardDescription>
            </CardHeader>
            <CardContent>
              <Tabs value={activeTab} onValueChange={setActiveTab}>
                <TabsList className="mb-4 w-full">
                  <TabsTrigger value="url" className="flex-1 gap-2">
                    <LinkIcon className="h-4 w-4" />URL
                  </TabsTrigger>
                  <TabsTrigger value="upload" className="flex-1 gap-2">
                    <Upload className="h-4 w-4" />Upload
                  </TabsTrigger>
                </TabsList>
                <TabsContent value="url">
                  <div className="space-y-2">
                    <Label htmlFor="imageUrl">Image URL</Label>
                    <Input
                      id="imageUrl"
                      type="url"
                      placeholder="https://example.com/image.jpg"
                      value={imageUrl}
                      onChange={(e) => setImageUrl(e.target.value)}
                    />
                    {imageUrl && (
                      <div className="mt-3 overflow-hidden rounded-lg border border-border">
                        <img src={imageUrl} alt="Preview" className="max-h-60 w-full object-contain" />
                      </div>
                    )}
                  </div>
                </TabsContent>
                <TabsContent value="upload">
                  {uploadedUrl ? (
                    <div className="space-y-3">
                      <div className="overflow-hidden rounded-lg border border-border">
                        <img src={uploadedUrl} alt="Uploaded" className="max-h-60 w-full object-contain" />
                      </div>
                      <Button variant="outline" size="sm" onClick={() => setUploadedUrl('')}>
                        Remove
                      </Button>
                    </div>
                  ) : (
                    <UploadDropzone<AppFileRouter, 'imageUploader'>
                      endpoint="imageUploader"
                      onClientUploadComplete={(res) => {
                        if (res?.[0]?.url) {
                          setUploadedUrl(res[0].url);
                          toast.success('Image uploaded!');
                        }
                      }}
                      onUploadError={(error) => {
                        toast.error(`Upload failed: ${error.message}`);
                      }}
                    />
                  )}
                </TabsContent>
              </Tabs>
            </CardContent>
          </Card>

          {/* Claim */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Claim to Verify</CardTitle>
              <CardDescription>The statement you want to fact-check against the image</CardDescription>
            </CardHeader>
            <CardContent className="space-y-2">
              <Textarea
                placeholder="e.g. This image shows flooding in New York City in 2024..."
                value={claim}
                onChange={(e) => setClaim(e.target.value)}
                maxLength={500}
                rows={4}
              />
              <p className="text-right text-xs text-muted-foreground">{claim.length}/500</p>
            </CardContent>
          </Card>

          {/* Language */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Language</CardTitle>
            </CardHeader>
            <CardContent>
              <Select value={language} onValueChange={setLanguage}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
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

          <Button type="submit" size="lg" className="w-full gap-2" disabled={loading}>
            {loading ? (
              <><Loader2 className="h-5 w-5 animate-spin" /> Analyzing...</>
            ) : (
              <><ScanSearch className="h-5 w-5" /> Analyze Now</>
            )}
          </Button>
        </form>

        {/* Instructions */}
        <div className="lg:col-span-2 space-y-4">
          <Card className="border-border/60">
            <CardContent className="pt-6">
              <h3 className="mb-4 font-semibold">Tips for best results</h3>
              <ul className="space-y-3 text-sm text-muted-foreground">
                <li className="flex gap-2"><span className="mt-0.5 h-5 w-5 shrink-0 rounded-full bg-primary/20 text-center text-xs leading-5 text-primary font-bold">1</span>Use a direct image URL (JPG, PNG, WebP)</li>
                <li className="flex gap-2"><span className="mt-0.5 h-5 w-5 shrink-0 rounded-full bg-primary/20 text-center text-xs leading-5 text-primary font-bold">2</span>Write the claim as it appears in the viral post</li>
                <li className="flex gap-2"><span className="mt-0.5 h-5 w-5 shrink-0 rounded-full bg-primary/20 text-center text-xs leading-5 text-primary font-bold">3</span>Include location and time if present in the claim</li>
                <li className="flex gap-2"><span className="mt-0.5 h-5 w-5 shrink-0 rounded-full bg-primary/20 text-center text-xs leading-5 text-primary font-bold">4</span>Select the correct language for better evidence retrieval</li>
              </ul>
            </CardContent>
          </Card>
          <Card className="border-border/60 bg-muted/40">
            <CardContent className="pt-6">
              <div className="flex items-center gap-2 mb-2">
                <ImageIcon className="h-4 w-4 text-muted-foreground" />
                <span className="text-sm font-medium">Demo Mode</span>
              </div>
              <p className="text-xs text-muted-foreground">If no ML backend is configured, VeriLens returns a realistic mock result so you can explore the full UI.</p>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
