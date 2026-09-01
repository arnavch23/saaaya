import { useMemo, useState } from "react";
import type { HeatTrendDay } from "../types/heat";
import { HEAT_TREND_SCORE_MAX, heatTrendBands } from "../data/mockHeatTrend";

const WIDTH = 920;
const HEIGHT = 420;
const PAD = { top: 28, right: 28, bottom: 56, left: 96 };

const plotW = WIDTH - PAD.left - PAD.right;
const plotH = HEIGHT - PAD.top - PAD.bottom;

const xAt = (i: number, n: number) =>
  PAD.left + (n <= 1 ? plotW / 2 : (i / (n - 1)) * plotW);
const yAt = (score: number) =>
  PAD.top + (1 - score / HEAT_TREND_SCORE_MAX) * plotH;

function smoothLine(points: { x: number; y: number }[]) {
  if (!points.length) return "";
  if (points.length === 1) return `M ${points[0].x} ${points[0].y}`;
  let d = `M ${points[0].x} ${points[0].y}`;
  for (let i = 0; i < points.length - 1; i++) {
    const p0 = points[i - 1] ?? points[i];
    const p1 = points[i];
    const p2 = points[i + 1];
    const p3 = points[i + 2] ?? p2;
    d += ` C ${p1.x + (p2.x - p0.x) / 6} ${p1.y + (p2.y - p0.y) / 6}, ${p2.x - (p3.x - p1.x) / 6} ${p2.y - (p3.y - p1.y) / 6}, ${p2.x} ${p2.y}`;
  }
  return d;
}

const colorForScore = (score: number) =>
  heatTrendBands.find((b) => score >= b.from && score <= b.to)?.color ??
  heatTrendBands[heatTrendBands.length - 1].color;

type Props = { days: HeatTrendDay[] };

export function HeatTrendChart({ days }: Props) {
  const [active, setActive] = useState<number | null>(null);
  const peakIndex = useMemo(() => {
    let max = 0;
    days.forEach((d, i) => {
      if (d.score > days[max].score) max = i;
    });
    return max;
  }, [days]);

  const points = days.map((d, i) => ({
    x: xAt(i, days.length),
    y: yAt(d.score),
    ...d,
  }));
  const line = smoothLine(points);
  const area = `${line} L ${points[points.length - 1].x} ${PAD.top + plotH} L ${points[0].x} ${PAD.top + plotH} Z`;
  const hovered = active !== null ? points[active] : null;

  return (
    <div className="relative w-full">
      <svg
        viewBox={`0 0 ${WIDTH} ${HEIGHT}`}
        className="h-auto w-full min-h-[320px]"
        role="img"
        aria-label="Seven-day city-level human thermal risk line chart"
      >
        <defs>
          <linearGradient id="heat-trend-line" x1="0" y1="1" x2="0" y2="0">
            {heatTrendBands.map((band) => (
              <stop
                key={band.risk}
                offset={`${band.to}%`}
                stopColor={band.color}
              />
            ))}
          </linearGradient>
          <linearGradient id="heat-trend-fill" x1="0" y1="1" x2="0" y2="0">
            {heatTrendBands.map((band) => (
              <stop
                key={band.risk}
                offset={`${band.to}%`}
                stopColor={band.color}
                stopOpacity="0.22"
              />
            ))}
          </linearGradient>
        </defs>

        {heatTrendBands.map((band) => {
          const y1 = yAt(band.to);
          const y2 = yAt(band.from);
          return (
            <rect
              key={band.risk}
              x={PAD.left}
              y={y1}
              width={plotW}
              height={Math.max(0, y2 - y1)}
              fill={band.color}
              opacity="0.07"
            />
          );
        })}

        {heatTrendBands.map((band) => {
          const yTop = yAt(band.to);
          const yMid = yAt((band.from + band.to) / 2);
          return (
            <g key={`grid-${band.risk}`}>
              <line
                x1={PAD.left}
                x2={PAD.left + plotW}
                y1={yTop}
                y2={yTop}
                stroke="#e2e8f0"
                strokeWidth="1"
              />
              <text
                x={PAD.left - 12}
                y={yMid + 4}
                textAnchor="end"
                fill="#475569"
                fontSize="11"
                fontWeight="600"
              >
                {band.risk}
              </text>
              <text
                x={PAD.left - 12}
                y={yMid + 17}
                textAnchor="end"
                fill="#94a3b8"
                fontSize="9"
              >
                {band.from}–{band.to}
              </text>
            </g>
          );
        })}
        <line
          x1={PAD.left}
          x2={PAD.left + plotW}
          y1={PAD.top + plotH}
          y2={PAD.top + plotH}
          stroke="#cbd5e1"
          strokeWidth="1.25"
        />

        <path d={area} fill="url(#heat-trend-fill)" />
        <path
          d={line}
          fill="none"
          stroke="url(#heat-trend-line)"
          strokeWidth="4.5"
          strokeLinecap="round"
          strokeLinejoin="round"
        />

        {points.map((p, i) => {
          const isPeak = i === peakIndex;
          const isActive = i === active;
          const r = isPeak || isActive ? 8.5 : 6.5;
          return (
            <g key={p.date}>
              {isPeak && (
                <>
                  <text
                    x={p.x}
                    y={p.y - 18}
                    textAnchor="middle"
                    fill="#9f2734"
                    fontSize="10"
                    fontWeight="700"
                  >
                    Peak
                  </text>
                </>
              )}
              <circle
                cx={p.x}
                cy={p.y}
                r={r + 3}
                fill="#fff"
                stroke={colorForScore(p.score)}
                strokeWidth={isPeak || isActive ? 3.2 : 2.4}
              />
              <circle
                cx={p.x}
                cy={p.y}
                r={r}
                fill={colorForScore(p.score)}
              />
              <text
                x={p.x}
                y={PAD.top + plotH + 20}
                textAnchor="middle"
                fill="#334155"
                fontSize="11"
                fontWeight="600"
              >
                {p.label}
              </text>
              <text
                x={p.x}
                y={PAD.top + plotH + 36}
                textAnchor="middle"
                fill="#94a3b8"
                fontSize="10"
              >
                {p.weekday}
              </text>
              <rect
                x={p.x - plotW / days.length / 2}
                y={PAD.top}
                width={plotW / days.length}
                height={plotH}
                fill="transparent"
                className="cursor-pointer"
                onMouseEnter={() => setActive(i)}
                onMouseLeave={() => setActive(null)}
                onFocus={() => setActive(i)}
                onBlur={() => setActive(null)}
                tabIndex={0}
                aria-label={`${p.label}: ${p.risk} thermal risk, score ${p.score}`}
              />
            </g>
          );
        })}
      </svg>

      {hovered && (
        <div
          className="pointer-events-none absolute rounded-lg border border-slate-200 bg-white px-3 py-2 shadow-sm shadow-slate-200/50"
          style={{
            left: `clamp(8px, calc(${((hovered.x / WIDTH) * 100).toFixed(2)}% - 72px), calc(100% - 160px))`,
            top: `clamp(8px, calc(${((hovered.y / HEIGHT) * 100).toFixed(2)}% - 72px), 40%)`,
          }}
        >
          <p className="text-[10px] font-semibold uppercase tracking-[.1em] text-slate-400">
            {hovered.weekday} · {hovered.label}
          </p>
          <p
            className="mt-1 text-sm font-semibold"
            style={{ color: colorForScore(hovered.score) }}
          >
            {hovered.risk}
          </p>
          <p className="text-[11px] text-slate-500">
            Heat indication {hovered.score} / {HEAT_TREND_SCORE_MAX}
          </p>
        </div>
      )}
    </div>
  );
}
