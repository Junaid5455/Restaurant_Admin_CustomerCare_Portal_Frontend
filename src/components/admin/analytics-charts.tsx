'use client';

import { useEffect, useId, useRef, useState, type KeyboardEvent } from 'react';
import { niceScale } from '@/lib/analytics';

/** The width of an element, kept up to date as it resizes, so charts draw at real pixels. */
function useWidth<T extends HTMLElement>(): [React.RefObject<T | null>, number] {
  const ref = useRef<T | null>(null);
  const [w, setW] = useState(0);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    setW(el.clientWidth);
    const ro = new ResizeObserver(() => setW(el.clientWidth));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);
  return [ref, w];
}

export interface TrendPoint {
  /** Axis label, e.g. "Oct 24". */
  label: string;
  /** Tooltip heading, e.g. "Fri, Oct 24". */
  long: string;
  value: number;
  /** Same position in the previous period, when there is one. */
  prev?: number | null;
  prevLabel?: string;
}

/** A line with a soft area under it, an optional comparison line, and a crosshair tooltip. */
export function TrendChart({
  points, format, axisFormat, name, prevName = 'Previous period', height = 260, label,
}: {
  points: TrendPoint[];
  format: (v: number) => string;
  axisFormat: (v: number) => string;
  name: string;
  prevName?: string;
  height?: number;
  label: string;
}) {
  const [ref, width] = useWidth<HTMLDivElement>();
  const [active, setActive] = useState<number | null>(null);
  const id = useId();
  const hasPrev = points.some((p) => p.prev != null);

  const m = { l: 46, r: 16, t: 14, b: 28 };
  const W = Math.max(width, 240);
  const iw = W - m.l - m.r;
  const ih = height - m.t - m.b;
  const max = Math.max(...points.map((p) => Math.max(p.value, p.prev ?? 0)), 0);
  const { max: top, ticks } = niceScale(max, 4);
  const x = (i: number) => m.l + (points.length <= 1 ? iw / 2 : (i / (points.length - 1)) * iw);
  const y = (v: number) => m.t + ih - (v / top) * ih;
  const line = points.map((p, i) => `${i ? 'L' : 'M'}${x(i).toFixed(1)},${y(p.value).toFixed(1)}`).join(' ');
  const prevLine = hasPrev
    ? points.map((p, i) => (p.prev == null ? null : `${i && points[i - 1].prev != null ? 'L' : 'M'}${x(i).toFixed(1)},${y(p.prev).toFixed(1)}`)).filter(Boolean).join(' ')
    : '';
  const area = points.length > 1 ? `${line} L${x(points.length - 1).toFixed(1)},${y(0)} L${x(0).toFixed(1)},${y(0)} Z` : '';
  const every = Math.max(1, Math.ceil(points.length / Math.max(2, Math.floor(iw / 70))));
  const last = points.length - 1;

  function at(clientX: number, rect: DOMRect) {
    const rel = clientX - rect.left - m.l;
    const i = points.length <= 1 ? 0 : Math.round((rel / iw) * (points.length - 1));
    setActive(Math.min(last, Math.max(0, i)));
  }
  function onKey(e: KeyboardEvent) {
    if (e.key === 'ArrowRight') { e.preventDefault(); setActive((a) => Math.min(last, (a ?? -1) + 1)); }
    else if (e.key === 'ArrowLeft') { e.preventDefault(); setActive((a) => Math.max(0, (a ?? points.length) - 1)); }
    else if (e.key === 'Escape') setActive(null);
  }

  const a = active === null ? null : points[active];
  const tipLeft = active === null ? 0 : Math.min(Math.max(x(active), 90), W - 90);

  return (
    <div className="an-chart" ref={ref}>
      {hasPrev && (
        <ul className="an-legend" aria-label="Legend">
          <li><i className="an-key" style={{ background: 'var(--an-series)' }} />{name}</li>
          <li><i className="an-key" style={{ background: 'var(--an-prev)' }} />{prevName}</li>
        </ul>
      )}
      {width > 0 && (
        <svg
          width={W}
          height={height}
          role="img"
          aria-label={label}
          tabIndex={0}
          onKeyDown={onKey}
          onFocus={() => active === null && setActive(last)}
          onBlur={() => setActive(null)}
          onPointerMove={(e) => at(e.clientX, e.currentTarget.getBoundingClientRect())}
          onPointerDown={(e) => at(e.clientX, e.currentTarget.getBoundingClientRect())}
          onPointerLeave={() => setActive(null)}
        >
          <defs>
            <linearGradient id={`${id}-fill`} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0" stopColor="var(--an-series)" stopOpacity="0.16" />
              <stop offset="1" stopColor="var(--an-series)" stopOpacity="0.02" />
            </linearGradient>
          </defs>
          <g className="an-grid">
            {ticks.map((t) => (
              <g key={t}>
                <line x1={m.l} x2={W - m.r} y1={y(t)} y2={y(t)} />
                <text x={m.l - 8} y={y(t) + 4} textAnchor="end">{axisFormat(t)}</text>
              </g>
            ))}
          </g>
          <g className="an-axis">
            {points.map((p, i) => (i % every === 0 || i === last ? <text key={i} x={x(i)} y={height - 8} textAnchor={i === 0 ? 'start' : i === last ? 'end' : 'middle'}>{p.label}</text> : null))}
          </g>
          {area && <path d={area} fill={`url(#${id}-fill)`} />}
          {hasPrev && <path d={prevLine} fill="none" stroke="var(--an-prev)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />}
          <path d={line} fill="none" stroke="var(--an-series)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
          {points.length > 0 && <circle cx={x(last)} cy={y(points[last].value)} r="5" fill="var(--an-series)" stroke="var(--an-surface)" strokeWidth="2" />}
          {active !== null && a && (
            <g>
              <line className="an-cross" x1={x(active)} x2={x(active)} y1={m.t} y2={m.t + ih} />
              {a.prev != null && <circle cx={x(active)} cy={y(a.prev)} r="4" fill="var(--an-prev)" stroke="var(--an-surface)" strokeWidth="2" />}
              <circle cx={x(active)} cy={y(a.value)} r="5" fill="var(--an-series)" stroke="var(--an-surface)" strokeWidth="2" />
            </g>
          )}
        </svg>
      )}
      {a && (
        <div className="an-tip" style={{ left: tipLeft, top: 0 }} role="status">
          <div className="an-tip-h">{a.long}</div>
          <div><i className="an-key" style={{ background: 'var(--an-series)' }} /> {name}: <b>{format(a.value)}</b></div>
          {a.prev != null && <div><i className="an-key" style={{ background: 'var(--an-prev)' }} /> {prevName}{a.prevLabel ? ` (${a.prevLabel})` : ''}: <b>{format(a.prev)}</b></div>}
        </div>
      )}
    </div>
  );
}

export interface ColumnItem {
  label: string;
  value: number;
  /** Tooltip heading. */
  long?: string;
}

/** Vertical bars from a baseline. Thin, rounded at the top, with only the tallest value written on it. */
export function Columns({
  items, format, axisFormat, unit, height = 200, label, labelEvery,
}: {
  items: ColumnItem[];
  format: (v: number) => string;
  axisFormat: (v: number) => string;
  unit: string;
  height?: number;
  label: string;
  labelEvery?: number;
}) {
  const [ref, width] = useWidth<HTMLDivElement>();
  const [active, setActive] = useState<number | null>(null);
  const m = { l: 40, r: 8, t: 20, b: 26 };
  const W = Math.max(width, 240);
  const iw = W - m.l - m.r;
  const ih = height - m.t - m.b;
  const max = Math.max(...items.map((i) => i.value), 0);
  const { max: top, ticks } = niceScale(max, 3);
  const slot = iw / Math.max(1, items.length);
  const bw = Math.min(24, Math.max(4, slot - 6));
  const y = (v: number) => m.t + ih - (v / top) * ih;
  const every = labelEvery ?? Math.max(1, Math.ceil(items.length / Math.max(2, Math.floor(iw / 44))));
  const tallest = max > 0 ? items.findIndex((i) => i.value === max) : -1;
  const a = active === null ? null : items[active];

  function bar(i: number, v: number) {
    const x0 = m.l + slot * i + (slot - bw) / 2;
    const h = Math.max(v > 0 ? 2 : 0, ih - (y(v) - m.t));
    const r = Math.min(4, bw / 2, h);
    const yy = m.t + ih - h;
    return `M${x0},${m.t + ih} V${yy + r} Q${x0},${yy} ${x0 + r},${yy} H${x0 + bw - r} Q${x0 + bw},${yy} ${x0 + bw},${yy + r} V${m.t + ih} Z`;
  }

  return (
    <div className="an-chart" ref={ref}>
      {width > 0 && (
        <svg width={W} height={height} role="img" aria-label={label} onPointerLeave={() => setActive(null)}>
          <g className="an-grid">
            {ticks.map((t) => (
              <g key={t}>
                <line x1={m.l} x2={W - m.r} y1={y(t)} y2={y(t)} />
                <text x={m.l - 8} y={y(t) + 4} textAnchor="end">{axisFormat(t)}</text>
              </g>
            ))}
          </g>
          {items.map((it, i) => (
            <g key={i} onPointerEnter={() => setActive(i)} onPointerDown={() => setActive(i)}>
              <rect x={m.l + slot * i} y={m.t} width={slot} height={ih} fill="transparent" />
              <path d={bar(i, it.value)} fill="var(--an-series)" opacity={active === null || active === i ? 1 : 0.45} />
              {i === tallest && <text className="an-val" x={m.l + slot * i + slot / 2} y={y(it.value) - 6} textAnchor="middle">{format(it.value)}</text>}
              {(i % every === 0) && <text className="an-axis-t" x={m.l + slot * i + slot / 2} y={height - 8} textAnchor="middle">{it.label}</text>}
            </g>
          ))}
        </svg>
      )}
      {a && active !== null && (
        <div className="an-tip" style={{ left: Math.min(Math.max(m.l + slot * active + slot / 2, 80), W - 80), top: 0 }} role="status">
          <div className="an-tip-h">{a.long ?? a.label}</div>
          <div><b>{format(a.value)}</b> {unit}</div>
        </div>
      )}
    </div>
  );
}

export interface BarItem {
  label: string;
  value: number;
  /** The value as written at the bar's tip. */
  text: string;
  sub?: string;
}

/** Horizontal bars with the name on the left and the value at the tip. One colour: the label names each bar. */
export function BarList({ items, label }: { items: BarItem[]; label: string }) {
  const max = Math.max(...items.map((i) => i.value), 0);
  return (
    <ul className="an-bars" aria-label={label}>
      {items.map((it, i) => (
        <li key={`${it.label}-${i}`}>
          <div className="an-bar-head">
            <span className="an-bar-name" title={it.label}>{it.label}</span>
            <span className="an-bar-val">{it.text}</span>
          </div>
          <div className="an-bar-track" aria-hidden="true">
            <span style={{ width: `${max > 0 ? Math.max(it.value > 0 ? 1.5 : 0, (it.value / max) * 100) : 0}%` }} />
          </div>
          {it.sub && <div className="an-bar-sub">{it.sub}</div>}
        </li>
      ))}
    </ul>
  );
}
