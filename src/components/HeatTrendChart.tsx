import { useMemo, useState } from "react";
import type { HeatTrendDay } from "../types/heat";
import { HEAT_TREND_SCORE_MAX, heatTrendBands } from "../data/mockHeatTrend";

const WIDTH = 1040;
const HEIGHT = 390;
const PAD = { top: 24, right: 24, bottom: 54, left: 62 };
const plotW = WIDTH - PAD.left - PAD.right;
const plotH = HEIGHT - PAD.top - PAD.bottom;
const xAt = (index: number, count: number) => PAD.left + (count <= 1 ? plotW / 2 : (index / (count - 1)) * plotW);
const yAt = (score: number) => PAD.top + (1 - score / HEAT_TREND_SCORE_MAX) * plotH;
const colorForScore = (score: number) => heatTrendBands.find((band) => score >= band.from && score <= band.to)?.color ?? "#6e2949";
const linePath = (points: Array<{ x: number; y: number }>) => points.map((point, index) => `${index === 0 ? "M" : "L"} ${point.x} ${point.y}`).join(" ");

type Props = { days: HeatTrendDay[]; selectedDate: string; onSelect: (day: HeatTrendDay) => void };

export function HeatTrendChart({ days, selectedDate, onSelect }: Props) {
  const [hoveredIndex, setHoveredIndex] = useState<number | null>(null);
  const points = useMemo(() => days.map((day, index) => ({ ...day, x: xAt(index, days.length), y: yAt(day.score) })), [days]);
  const todayIndex = days.findIndex((day) => day.period === "Today");
  const hovered = hoveredIndex === null ? null : points[hoveredIndex];

  return (
    <div className="relative min-w-[660px] w-full overflow-hidden">
      <svg viewBox={`0 0 ${WIDTH} ${HEIGHT}`} className="block h-auto min-h-[300px] w-full" role="img" aria-label="Pune human thermal risk score timeline with seven historical days, today, and seven simulated forecast days">
        <text x={PAD.left} y="13" fill="#64748b" fontSize="10" fontWeight="700" letterSpacing=".08em">HEAT RISK SCORE</text>
        {heatTrendBands.map((band) => {
          const y = yAt(band.to);
          return <g key={band.risk}><rect x={PAD.left} y={y} width={plotW} height={yAt(band.from) - y} fill={band.color} opacity="0.035" /><line x1={PAD.left} x2={PAD.left + plotW} y1={y} y2={y} stroke="#e2e8f0" strokeWidth="1" /><text x={PAD.left - 10} y={y + 4} textAnchor="end" fill="#64748b" fontSize="10">{band.to}</text></g>;
        })}
        <line x1={PAD.left} x2={PAD.left + plotW} y1={PAD.top + plotH} y2={PAD.top + plotH} stroke="#cbd5e1" />
        {todayIndex >= 0 && <g><line x1={points[todayIndex].x} x2={points[todayIndex].x} y1={PAD.top} y2={PAD.top + plotH} stroke="#334155" strokeWidth="1" strokeDasharray="3 4" /><text x={points[todayIndex].x} y={PAD.top + 14} textAnchor="middle" fill="#334155" fontSize="10" fontWeight="700">TODAY</text></g>}
        <path d={linePath(todayIndex < 0 ? points : points.slice(0, todayIndex + 1))} fill="none" stroke="#1e293b" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
        {todayIndex >= 0 && <path d={linePath(points.slice(todayIndex))} fill="none" stroke="#64748b" strokeWidth="2.25" strokeLinecap="round" strokeLinejoin="round" strokeDasharray="6 5" />}
        {points.map((point, index) => {
          const selected = point.date === selectedDate;
          const prominent = selected || point.period === "Today" || hoveredIndex === index;
          return <g key={point.date} aria-hidden="true">
            <circle cx={point.x} cy={point.y} r={prominent ? 7 : 5.25} fill="#fff" stroke={selected ? "#0f1c2e" : colorForScore(point.score)} strokeWidth={selected ? 2.5 : 1.8} />
            <circle cx={point.x} cy={point.y} r={prominent ? 3.2 : 2.4} fill={colorForScore(point.score)} />
            {(points.length <= 32 || index % 30 === 0 || index === points.length - 1) && <text x={point.x} y={PAD.top + plotH + 20} textAnchor="middle" fill={point.period === "Today" ? "#0f1c2e" : "#475569"} fontSize="10" fontWeight={point.period === "Today" ? "700" : "500"}>{point.label}</text>}
          </g>;
        })}
        <text x={PAD.left} y={HEIGHT - 10} fill="#64748b" fontSize="10" fontWeight="600">HISTORICAL</text>
        {todayIndex >= 0 && <text x={points[todayIndex].x + 10} y={HEIGHT - 10} fill="#64748b" fontSize="10" fontWeight="600">SIMULATED OUTLOOK</text>}
      </svg>
      {points.map((point, index) => <button key={`select-${point.date}`} type="button" className="heat-chart-point-button" aria-label={`${point.label}, ${point.period}: ${point.risk} heat risk, score ${point.score}. Select daily intelligence.`} aria-pressed={point.date === selectedDate} onClick={() => onSelect(point)} onMouseEnter={() => setHoveredIndex(index)} onMouseLeave={() => setHoveredIndex(null)} onFocus={() => setHoveredIndex(index)} onBlur={() => setHoveredIndex(null)} style={{ left: `${(point.x / WIDTH) * 100}%`, top: `${(point.y / HEIGHT) * 100}%` }} />)}
      {hovered && <div className="pointer-events-none absolute z-10 min-w-36 border border-slate-200 bg-white px-2.5 py-2 shadow-sm" style={{ borderRadius: "6px", left: `clamp(8px, calc(${((hovered.x / WIDTH) * 100).toFixed(2)}% - 58px), calc(100% - 152px))`, top: `clamp(8px, calc(${((hovered.y / HEIGHT) * 100).toFixed(2)}% - 58px), calc(100% - 76px))` }}><p className="text-[10px] font-semibold uppercase tracking-[.08em] text-slate-500">{hovered.period}</p><p className="mt-0.5 text-[12px] font-semibold text-slate-800">{hovered.weekday} · {hovered.label}</p><p className="mt-1 text-[11px] text-slate-600"><span style={{ color: colorForScore(hovered.score) }} className="font-semibold">{hovered.risk}</span> · Score {hovered.score}</p></div>}
    </div>
  );
}
