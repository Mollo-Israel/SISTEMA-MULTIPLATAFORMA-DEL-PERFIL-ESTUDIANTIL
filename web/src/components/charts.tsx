import {
  Bar,
  BarChart,
  Cell,
  Legend,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';

const LEVEL_COLOR: Record<string, string> = {
  high: '#1f7a4d',
  medium: '#b6791f',
  low: '#7b828c',
};
const BORDO = '#6b1220';
const ROSE = '#d24b60';

export function AffinityBars({ data }: { data: { area: string; score: number; level: string }[] }) {
  if (!data.length) return <p className="muted">Sin datos de afinidad.</p>;
  return (
    <ResponsiveContainer width="100%" height={Math.max(160, data.length * 46)}>
      <BarChart data={data} layout="vertical" margin={{ left: 10, right: 20, top: 4, bottom: 4 }}>
        <XAxis type="number" tick={{ fontSize: 12 }} />
        <YAxis type="category" dataKey="area" width={140} tick={{ fontSize: 12 }} />
        <Tooltip cursor={{ fill: 'rgba(107,18,32,0.05)' }} formatter={(v: number, _n, p: any) => [`${v} · ${p?.payload?.level}`, 'Puntaje']} />
        <Bar dataKey="score" radius={[0, 6, 6, 0]} barSize={20}>
          {data.map((d, i) => (
            <Cell key={i} fill={LEVEL_COLOR[d.level] ?? BORDO} />
          ))}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  );
}

export function CompletionDonut({ value }: { value: number }) {
  const data = [
    { name: 'Completo', value },
    { name: 'Restante', value: Math.max(0, 100 - value) },
  ];
  return (
    <div style={{ position: 'relative', height: 180 }}>
      <ResponsiveContainer width="100%" height="100%">
        <PieChart>
          <Pie data={data} dataKey="value" innerRadius={58} outerRadius={80} startAngle={90} endAngle={-270} stroke="none">
            <Cell fill={BORDO} />
            <Cell fill="#eceaec" />
          </Pie>
        </PieChart>
      </ResponsiveContainer>
      <div style={{ position: 'absolute', inset: 0, display: 'grid', placeItems: 'center', pointerEvents: 'none' }}>
        <div style={{ textAlign: 'center' }}>
          <div style={{ fontSize: '1.8rem', fontWeight: 800, color: BORDO }}>{value}%</div>
          <div style={{ fontSize: '0.72rem', color: '#7b828c' }}>perfil completo</div>
        </div>
      </div>
    </div>
  );
}

export function CountBars({ data, color = BORDO }: { data: { label: string; value: number }[]; color?: string }) {
  if (!data.length) return <p className="muted">Sin datos.</p>;
  return (
    <ResponsiveContainer width="100%" height={Math.max(160, data.length * 40)}>
      <BarChart data={data} layout="vertical" margin={{ left: 10, right: 20 }}>
        <XAxis type="number" allowDecimals={false} tick={{ fontSize: 12 }} />
        <YAxis type="category" dataKey="label" width={150} tick={{ fontSize: 12 }} />
        <Tooltip cursor={{ fill: 'rgba(107,18,32,0.05)' }} />
        <Bar dataKey="value" radius={[0, 6, 6, 0]} barSize={18} fill={color} />
      </BarChart>
    </ResponsiveContainer>
  );
}

export function LevelStackBars({ data }: { data: { area: string; low: number; medium: number; high: number }[] }) {
  if (!data.length) return <p className="muted">Sin datos.</p>;
  return (
    <ResponsiveContainer width="100%" height={Math.max(200, data.length * 48)}>
      <BarChart data={data} layout="vertical" margin={{ left: 10, right: 20 }}>
        <XAxis type="number" allowDecimals={false} tick={{ fontSize: 12 }} />
        <YAxis type="category" dataKey="area" width={140} tick={{ fontSize: 12 }} />
        <Tooltip cursor={{ fill: 'rgba(107,18,32,0.05)' }} />
        <Legend wrapperStyle={{ fontSize: 12 }} />
        <Bar dataKey="low" name="Bajo" stackId="a" fill="#7b828c" />
        <Bar dataKey="medium" name="Medio" stackId="a" fill="#b6791f" />
        <Bar dataKey="high" name="Alto" stackId="a" fill="#1f7a4d" radius={[0, 6, 6, 0]} />
      </BarChart>
    </ResponsiveContainer>
  );
}

export const chartColors = { BORDO, ROSE, LEVEL_COLOR };
