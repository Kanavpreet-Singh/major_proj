import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { MetricsChart } from './metrics-chart';
import { Badge } from '@/components/ui/badge';
import {
  BarChart3,
  Cpu,
  CheckCircle2,
  Trophy,
  FileCode,
  Server,
  Layers,
  Sparkles,
  ArrowUpRight,
} from 'lucide-react';

export default function EvaluationPage() {
  const primaryMetrics = [
    {
      label: 'Test Accuracy',
      value: '86.00%',
      sublabel: 'Validation: 87.75%',
      color: 'text-foreground',
      border: 'border-border',
    },
    {
      label: 'Test Precision',
      value: '82.73%',
      sublabel: 'Positive Predictive Value',
      color: 'text-primary',
      border: 'border-primary/20',
    },
    {
      label: 'Test Recall',
      value: '91.00%',
      sublabel: 'True Positive Sensitivity',
      color: 'text-emerald-600 dark:text-emerald-400',
      border: 'border-emerald-500/20',
    },
    {
      label: 'Test F1-Score',
      value: '86.67%',
      sublabel: 'Harmonic Mean',
      color: 'text-success',
      border: 'border-success/30',
    },
    {
      label: 'Best Val F1-Score',
      value: '88.05%',
      sublabel: 'Multimodal Configuration',
      color: 'text-emerald-700 dark:text-emerald-300',
      border: 'border-emerald-500/30',
      highlight: true,
    },
  ];

  const confusionData = [
    { actual: 'Real (Class 0)', predictedReal: 81, predictedFake: 19, total: 100 },
    { actual: 'Fake (Class 1)', predictedReal: 9, predictedFake: 91, total: 100 },
  ];

  return (
    <div className="mx-auto max-w-5xl px-4 py-12 sm:px-6 lg:px-8 space-y-8">
      {/* Header */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <div className="flex items-center gap-2.5">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10 text-primary">
              <BarChart3 className="h-5 w-5" />
            </div>
            <div>
              <h1 className="text-3xl font-bold tracking-tight">Model Evaluation & Export</h1>
              <p className="text-sm text-muted-foreground mt-0.5">
                Benchmark evaluation results of the Multimodal CLIP verification pipeline
              </p>
            </div>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Badge variant="outline" className="gap-1.5 border-success/40 bg-success/10 text-success text-xs font-semibold py-1 px-3">
            <CheckCircle2 className="h-3.5 w-3.5" />
            Trained Model Results
          </Badge>
        </div>
      </div>

      {/* Best Configuration Callout Banner */}
      <Card className="overflow-hidden border-2 border-emerald-500/30 bg-gradient-to-r from-emerald-500/10 via-emerald-500/5 to-transparent">
        <CardContent className="p-6">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="flex items-start gap-3.5">
              <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-emerald-500/20 text-emerald-600 dark:text-emerald-400 border border-emerald-500/30 shrink-0">
                <Trophy className="h-5 w-5" />
              </div>
              <div className="space-y-1">
                <div className="flex items-center gap-2">
                  <span className="text-xs font-bold uppercase tracking-wider text-emerald-600 dark:text-emerald-400">
                    Ablation Study Champion
                  </span>
                  <Badge variant="outline" className="border-emerald-500/40 text-[10px] text-emerald-700 dark:text-emerald-300">
                    Best Configuration
                  </Badge>
                </div>
                <h2 className="text-xl font-bold text-foreground">
                  Multimodal CLIP achieved the top validation F1-score (88.05%)
                </h2>
                <p className="text-sm text-muted-foreground leading-relaxed">
                  Combining visual embeddings from Vision Transformer (ViT-B/32) with claim text embeddings consistently outperformed unimodal text-only and image-only configurations across all evaluation splits.
                </p>
              </div>
            </div>
            <div className="sm:text-right shrink-0">
              <div className="text-3xl font-black text-emerald-600 dark:text-emerald-400 tabular-nums">
                88.05%
              </div>
              <div className="text-xs text-muted-foreground">Validation F1-score</div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Primary Metrics Grid */}
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-5">
        {primaryMetrics.map((m) => (
          <Card key={m.label} className={`border ${m.border} transition-all hover:shadow-sm`}>
            <CardContent className="pt-6 pb-5 text-center">
              <p className={`text-2xl sm:text-3xl font-black tracking-tight tabular-nums ${m.color}`}>
                {m.value}
              </p>
              <p className="mt-1 text-xs font-semibold text-foreground">{m.label}</p>
              <p className="mt-0.5 text-[11px] text-muted-foreground truncate">{m.sublabel}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Two-Column Comparison & Model Architecture */}
      <div className="grid gap-6 lg:grid-cols-12">
        {/* Ablation Study Chart (col-span-7) */}
        <Card className="lg:col-span-7">
          <CardHeader className="pb-3">
            <CardTitle className="text-base font-semibold flex items-center gap-2">
              <BarChart3 className="h-4 w-4 text-primary" />
              Comparison of 3 Tested Configurations
            </CardTitle>
            <CardDescription>
              Ablation performance comparing Text-Only, Image-Only, and Multimodal CLIP
            </CardDescription>
          </CardHeader>
          <CardContent>
            <MetricsChart />
          </CardContent>
        </Card>

        {/* Confusion Matrix (col-span-5) */}
        <Card className="lg:col-span-5">
          <CardHeader className="pb-3">
            <CardTitle className="text-base font-semibold flex items-center gap-2">
              <Cpu className="h-4 w-4 text-primary" />
              Test Confusion Matrix
            </CardTitle>
            <CardDescription>
              Test set evaluation (Accuracy: 86.00% • Recall: 91.00%)
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border/60">
                    <th className="py-2.5 pr-2 text-left text-xs font-semibold text-muted-foreground">
                      Actual \ Predicted
                    </th>
                    <th className="py-2.5 px-3 text-center text-xs font-bold text-foreground">
                      Pred Real
                    </th>
                    <th className="py-2.5 px-3 text-center text-xs font-bold text-foreground">
                      Pred Fake
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border/40">
                  {confusionData.map((row) => (
                    <tr key={row.actual}>
                      <td className="py-3 pr-2 text-xs font-semibold text-muted-foreground">
                        {row.actual}
                      </td>
                      <td
                        className={`py-3 px-3 text-center tabular-nums text-sm ${
                          row.actual.includes('Real')
                            ? 'bg-success/15 font-bold text-success rounded-lg'
                            : 'text-muted-foreground'
                        }`}
                      >
                        {row.predictedReal}
                      </td>
                      <td
                        className={`py-3 px-3 text-center tabular-nums text-sm ${
                          row.actual.includes('Fake')
                            ? 'bg-success/15 font-bold text-success rounded-lg'
                            : 'text-muted-foreground'
                        }`}
                      >
                        {row.predictedFake}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="space-y-1.5 rounded-xl bg-muted/40 p-3 text-xs border border-border/50">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Test Precision:</span>
                <span className="font-semibold text-foreground">82.73% (91 / 110)</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Test Recall:</span>
                <span className="font-semibold text-foreground">91.00% (91 / 100)</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Test Accuracy:</span>
                <span className="font-semibold text-foreground">86.00% (172 / 200)</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Test F1-score:</span>
                <span className="font-semibold text-success">86.67%</span>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Model Export & Deployment Pipeline */}
      <Card className="rounded-2xl border">
        <CardHeader className="pb-3">
          <CardTitle className="text-base font-semibold flex items-center gap-2">
            <Sparkles className="h-4 w-4 text-primary" />
            Model Export & Deployment Preparation
          </CardTitle>
          <CardDescription>
            Artifacts exported for integration between the Python ML service and Next.js frontend
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4 sm:grid-cols-3">
            {/* Artifact 1: classifier.joblib */}
            <div className="rounded-xl border border-border/70 p-4 space-y-2 bg-muted/20">
              <div className="flex items-center gap-2 text-primary font-semibold text-sm">
                <FileCode className="h-4 w-4" />
                <span>classifier.joblib</span>
              </div>
              <p className="text-xs text-muted-foreground leading-relaxed">
                Trained supervised classification head exported using Joblib. Takes the concatenated 1024-dimensional multimodal embedding vector to output Real vs. Fake probabilities.
              </p>
              <div className="pt-1 flex items-center text-[11px] text-muted-foreground">
                <span className="rounded bg-muted px-1.5 py-0.5 font-mono">clip_artifacts/classifier.joblib</span>
              </div>
            </div>

            {/* Artifact 2: config.json */}
            <div className="rounded-xl border border-border/70 p-4 space-y-2 bg-muted/20">
              <div className="flex items-center gap-2 text-primary font-semibold text-sm">
                <Layers className="h-4 w-4" />
                <span>config.json</span>
              </div>
              <p className="text-xs text-muted-foreground leading-relaxed">
                Metadata configuration specifying the base model (<span className="font-mono">openai/clip-vit-base-patch32</span>), 512D embeddings, 1024D feature fusion order, and class labels.
              </p>
              <div className="pt-1 flex items-center text-[11px] text-muted-foreground">
                <span className="rounded bg-muted px-1.5 py-0.5 font-mono">clip_artifacts/config.json</span>
              </div>
            </div>

            {/* Artifact 3: Full-stack Deployment */}
            <div className="rounded-xl border border-border/70 p-4 space-y-2 bg-muted/20">
              <div className="flex items-center gap-2 text-primary font-semibold text-sm">
                <Server className="h-4 w-4" />
                <span>Full-Stack API Pipeline</span>
              </div>
              <p className="text-xs text-muted-foreground leading-relaxed">
                Prepared deployment with FastAPI (<span className="font-mono">server.py</span>) on port 8000 connected to Next.js API routes (<span className="font-mono">/api/analyze</span>) for sub-second live multimodal verification.
              </p>
              <div className="pt-1 flex items-center text-[11px] text-success font-medium">
                <CheckCircle2 className="h-3.5 w-3.5 mr-1" />
                Production Ready
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
