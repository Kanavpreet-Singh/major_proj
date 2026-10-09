import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { MetricsChart } from './metrics-chart';
import { Badge } from '@/components/ui/badge';
import { BarChart3, Database, Cpu, Info } from 'lucide-react';

const metrics = [
  { label: 'Accuracy', value: '87.4%', color: 'text-success' },
  { label: 'Precision', value: '84.2%', color: 'text-primary' },
  { label: 'Recall', value: '89.1%', color: 'text-warning' },
  { label: 'F1 Score', value: '86.6%', color: 'text-success' },
];

const confusion = [
  { actual: 'True', True: 218, False: 8, Misleading: 12, Unverifiable: 6 },
  { actual: 'False', True: 9, False: 231, Misleading: 14, Unverifiable: 4 },
  { actual: 'Misleading', True: 15, False: 18, Misleading: 193, Unverifiable: 22 },
  { actual: 'Unverifiable', True: 7, False: 6, Misleading: 19, Unverifiable: 198 },
];

export default function EvaluationPage() {
  return (
    <div className="mx-auto max-w-5xl px-4 py-12 sm:px-6 lg:px-8">
      <div className="mb-10">
        <div className="mb-2 flex items-center gap-2">
          <BarChart3 className="h-6 w-6 text-primary" />
          <h1 className="text-3xl font-bold tracking-tight">Model Evaluation</h1>
        </div>
        <p className="text-muted-foreground">Benchmark performance on our labeled test set of 2,400 samples.</p>
        <Badge variant="outline" className="mt-2 gap-1"><Info className="h-3 w-3" />Mock evaluation data — for demonstration</Badge>
      </div>

      {/* Metric cards */}
      <div className="mb-8 grid grid-cols-2 gap-4 sm:grid-cols-4">
        {metrics.map((m) => (
          <Card key={m.label}>
            <CardContent className="pt-6 text-center">
              <p className={`text-3xl font-extrabold ${m.color}`}>{m.value}</p>
              <p className="mt-1 text-sm text-muted-foreground">{m.label}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="grid gap-6 md:grid-cols-2">
        {/* Chart */}
        <Card>
          <CardHeader><CardTitle className="text-base">Per-class F1 Score</CardTitle></CardHeader>
          <CardContent>
            <MetricsChart />
          </CardContent>
        </Card>

        {/* Dataset info */}
        <Card>
          <CardHeader><CardTitle className="text-base flex items-center gap-2"><Database className="h-4 w-4" />Dataset</CardTitle></CardHeader>
          <CardContent className="space-y-3 text-sm">
            <div className="flex justify-between"><span className="text-muted-foreground">Total Samples</span><span className="font-medium">2,400</span></div>
            <div className="flex justify-between"><span className="text-muted-foreground">Train / Val / Test</span><span className="font-medium">70 / 15 / 15 %</span></div>
            <div className="flex justify-between"><span className="text-muted-foreground">Classes</span><span className="font-medium">4</span></div>
            <div className="flex justify-between"><span className="text-muted-foreground">Languages</span><span className="font-medium">5 (en, hi, ur, zh, auto)</span></div>
            <div className="flex justify-between"><span className="text-muted-foreground">CLIP Model</span><span className="font-medium">ViT-B/32</span></div>
            <div className="flex justify-between"><span className="text-muted-foreground">LLM</span><span className="font-medium">GPT-4o (evidence)</span></div>
          </CardContent>
        </Card>
      </div>

      {/* Confusion matrix */}
      <Card className="mt-6">
        <CardHeader><CardTitle className="text-base flex items-center gap-2"><Cpu className="h-4 w-4" />Confusion Matrix (test set)</CardTitle></CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr>
                  <th className="py-2 pr-4 text-left text-muted-foreground font-normal">Actual \ Predicted</th>
                  {['True','False','Misleading','Unverifiable'].map(h => (
                    <th key={h} className="py-2 px-3 text-center font-semibold">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {confusion.map((row) => (
                  <tr key={row.actual} className="border-t border-border/40">
                    <td className="py-2 pr-4 font-semibold">{row.actual}</td>
                    {(['True','False','Misleading','Unverifiable'] as const).map(col => (
                      <td key={col} className={`py-2 px-3 text-center tabular-nums rounded ${
                        row.actual === col ? 'bg-primary/10 font-bold text-primary' : ''
                      }`}>{row[col as keyof typeof row]}</td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
