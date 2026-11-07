import React from 'react';

/** Small inline SVG charts in the app's own colors. Values are compared only with your own earlier values. */
export function Spark({ values, labels, height = 110 }: { values: number[]; labels?: string[]; height?: number }) {
  if (values.length === 0) return null;
  const w = 320;
  const padL = 28;
  const padR = 10;
  const padT = 10;
  const padB = labels ? 22 : 10;
  const max = Math.max(...values, 1);
  const min = Math.min(...values, 0);
  const span = max - min || 1;
  const x = (i: number) => (values.length === 1 ? w / 2 : padL + (i * (w - padL - padR)) / (values.length - 1));
  const y = (v: number) => padT + (height - padT - padB) * (1 - (v - min) / span);
  const d = values.map((v, i) => `${i === 0 ? 'M' : 'L'}${x(i).toFixed(1)} ${y(v).toFixed(1)}`).join(' ');
  const ticks = [min, (min + max) / 2, max];
  const step = Math.max(1, Math.ceil(values.length / 5));
  return (
    <svg className="chart" viewBox={`0 0 ${w} ${height}`} role="img" aria-label="Progress chart">
      {ticks.map((t, i) => <g key={i}><line className="grid" x1={padL} x2={w - padR} y1={y(t)} y2={y(t)} /><text x={padL - 4} y={y(t) + 3} textAnchor="end">{Math.round(t)}</text></g>)}
      <path className="line" d={d} />
      {values.map((v, i) => <circle key={i} className="dot" cx={x(i)} cy={y(v)} r={values.length > 30 ? 1.5 : 3} />)}
      {labels && values.map((_, i) => (i % step === 0 || i === values.length - 1) && <text key={'l' + i} x={x(i)} y={height - 6} textAnchor={i === 0 ? 'start' : i === values.length - 1 ? 'end' : 'middle'}>{labels[i]}</text>)}
    </svg>
  );
}

export function Bars({ values, labels, max: maxIn, height = 110, soft }: { values: number[]; labels: string[]; max?: number; height?: number; soft?: boolean[] }) {
  const w = 320;
  const padL = 24;
  const padB = 20;
  const padT = 8;
  const max = Math.max(maxIn ?? 0, ...values, 1);
  const bw = (w - padL - 8) / values.length;
  const y = (v: number) => padT + (height - padT - padB) * (1 - v / max);
  return (
    <svg className="chart" viewBox={`0 0 ${w} ${height}`} role="img" aria-label="Bar chart">
      <line className="grid" x1={padL} x2={w - 4} y1={y(0)} y2={y(0)} />
      <text x={padL - 4} y={padT + 4} textAnchor="end">{max}</text>
      {values.map((v, i) => <rect key={i} className={`bar ${soft?.[i] ? 'soft' : ''}`} x={padL + i * bw + bw * 0.15} y={y(v)} width={bw * 0.7} height={Math.max(0, y(0) - y(v))} rx="3" />)}
      {labels.map((l, i) => <text key={'l' + i} x={padL + i * bw + bw / 2} y={height - 6} textAnchor="middle">{l}</text>)}
    </svg>
  );
}
