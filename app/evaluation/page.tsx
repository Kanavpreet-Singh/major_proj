import { MetricsChart } from './metrics-chart';
import { cn } from '@/lib/utils';

const METRICS = [
  { label: 'Accuracy', value: '86.0%', detail: '172 of 200' },
  { label: 'Precision', value: '82.7%', detail: '91 of 110' },
  { label: 'Recall', value: '91.0%', detail: '91 of 100' },
  { label: 'F1 score', value: '86.7%', detail: 'Validation 88.1%' },
];

const CONFUSION = [
  { actual: 'Real', cells: [81, 19] },
  { actual: 'Fake', cells: [9, 91] },
];

export default function EvaluationPage() {
  return (
    <div className="mx-auto max-w-4xl px-4 py-14 sm:px-6">
      <h1 className="font-serif text-4xl font-medium tracking-tight sm:text-5xl">Evaluation</h1>
      <p className="mt-3 text-muted-foreground">Image + text model on a held-out test set of 200 image–claim pairs.</p>

      <dl className="mt-12 grid grid-cols-2 gap-x-8 gap-y-10 sm:grid-cols-4">
        {METRICS.map((m) => (
          <div key={m.label}>
            <dt className="text-sm text-muted-foreground">{m.label}</dt>
            <dd className="mt-1 font-serif text-5xl tabular-nums tracking-tight">{m.value}</dd>
            <dd className="mt-1 text-xs text-muted-foreground">{m.detail}</dd>
          </div>
        ))}
      </dl>

      <div className="mt-16 grid gap-14 border-t pt-12 lg:grid-cols-[1.4fr_1fr]">
        <section>
          <h2 className="mb-8 font-serif text-2xl">By input</h2>
          <MetricsChart />
        </section>

        <section>
          <h2 className="mb-8 font-serif text-2xl">Confusion matrix</h2>
          <table className="w-full text-sm">
            <thead>
              <tr className="text-muted-foreground">
                <th className="pb-3 text-left font-normal">Actual</th>
                <th className="pb-3 text-center font-normal">Predicted real</th>
                <th className="pb-3 text-center font-normal">Predicted fake</th>
              </tr>
            </thead>
            <tbody>
              {CONFUSION.map((row, r) => (
                <tr key={row.actual}>
                  <td className="py-1.5 pr-3 text-muted-foreground">{row.actual}</td>
                  {row.cells.map((n, c) => (
                    <td key={c} className="p-1">
                      <div
                        className={cn(
                          'flex h-16 items-center justify-center rounded-lg font-serif text-2xl tabular-nums',
                          r === c ? 'bg-success/15 text-foreground' : 'bg-muted text-muted-foreground'
                        )}
                      >
                        {n}
                      </div>
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </section>
      </div>
    </div>
  );
}
