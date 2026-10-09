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
} from 'recharts';

const data = [
  { name: 'True', f1: 91.2 },
  { name: 'False', f1: 88.5 },
  { name: 'Misleading', f1: 82.1 },
  { name: 'Unverifiable', f1: 84.4 },
];

const colors = {
  True: 'hsl(142 71% 45%)',
  False: 'hsl(0 84% 60%)',
  Misleading: 'hsl(38 92% 50%)',
  Unverifiable: 'hsl(215 16% 47%)',
} as Record<string, string>;

export function MetricsChart() {
  return (
    <ResponsiveContainer width="100%" height={220}>
      <BarChart data={data} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
        <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
        <XAxis dataKey="name" tick={{ fontSize: 12 }} />
        <YAxis domain={[70, 100]} tick={{ fontSize: 12 }} />
        <Tooltip formatter={(v: number) => [`${v}%`, 'F1 Score']} />
        <Bar dataKey="f1" radius={[4, 4, 0, 0]}>
          {data.map((entry) => (
            <Cell key={entry.name} fill={colors[entry.name]} />
          ))}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  );
}
