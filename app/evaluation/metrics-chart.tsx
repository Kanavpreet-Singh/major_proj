'use client';

import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
  Cell,
  Legend,
} from 'recharts';

const configurationData = [
  {
    name: 'Text-Only Baseline',
    valF1: 76.2,
    testAcc: 74.5,
  },
  {
    name: 'Image-Only Baseline',
    valF1: 72.4,
    testAcc: 70.8,
  },
  {
    name: 'Multimodal CLIP (Ours)',
    valF1: 88.05,
    testAcc: 86.0,
  },
];

export function MetricsChart() {
  return (
    <div className="space-y-3">
      <ResponsiveContainer width="100%" height={260}>
        <BarChart
          data={configurationData}
          margin={{ top: 15, right: 15, left: -15, bottom: 5 }}
        >
          <CartesianGrid strokeDasharray="3 3" className="stroke-border/60" vertical={false} />
          <XAxis
            dataKey="name"
            tick={{ fontSize: 12 }}
            tickLine={false}
            className="text-muted-foreground"
          />
          <YAxis
            domain={[60, 100]}
            tick={{ fontSize: 12 }}
            tickLine={false}
            tickFormatter={(v) => `${v}%`}
            className="text-muted-foreground"
          />
          <Tooltip
            formatter={(value: number) => [`${value.toFixed(2)}%`]}
            contentStyle={{
              backgroundColor: 'hsl(var(--card))',
              borderColor: 'hsl(var(--border))',
              borderRadius: '0.75rem',
              fontSize: '12px',
            }}
          />
          <Legend
            wrapperStyle={{ fontSize: '12px', paddingTop: '10px' }}
          />
          <Bar
            name="Validation F1-score"
            dataKey="valF1"
            radius={[6, 6, 0, 0]}
            fill="hsl(var(--primary))"
          >
            {configurationData.map((entry, index) => (
              <Cell
                key={`cell-val-${index}`}
                fill={index === 2 ? 'hsl(var(--success))' : 'hsl(var(--muted-foreground) / 0.5)'}
              />
            ))}
          </Bar>
          <Bar
            name="Test Accuracy"
            dataKey="testAcc"
            radius={[6, 6, 0, 0]}
            fill="hsl(var(--primary) / 0.7)"
          >
            {configurationData.map((entry, index) => (
              <Cell
                key={`cell-test-${index}`}
                fill={index === 2 ? 'hsl(var(--primary))' : 'hsl(var(--muted-foreground) / 0.3)'}
              />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
      <div className="flex items-center justify-between text-xs text-muted-foreground px-2">
        <span>* Multimodal CLIP achieved highest validation F1 (88.05%)</span>
        <span className="font-semibold text-success">+11.85% over text-only</span>
      </div>
    </div>
  );
}
