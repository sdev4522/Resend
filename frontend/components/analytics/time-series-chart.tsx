'use client';

import React, { useState } from 'react';

export interface TimeSeriesPoint {
  date: string;
  [key: string]: any;
}

export interface MetricSeries {
  key: string;
  label: string;
  color: string;
}

interface TimeSeriesChartProps {
  data: TimeSeriesPoint[];
  series: MetricSeries[];
  height?: number;
  valueFormatter?: (val: number) => string;
  emptyMessage?: string;
}

export function TimeSeriesChart({
  data,
  series,
  height = 240,
  valueFormatter = (v) => v.toLocaleString(),
  emptyMessage = 'No activity recorded for this period',
}: TimeSeriesChartProps) {
  const [hoverIndex, setHoverIndex] = useState<number | null>(null);

  if (!data || data.length === 0) {
    return (
      <div
        className="flex items-center justify-center rounded-xl border border-dashed border-border bg-muted/10 text-xs text-muted-foreground p-8"
        style={{ height }}
      >
        <span>{emptyMessage}</span>
      </div>
    );
  }

  // Calculate scales
  let maxValue = 0;
  data.forEach((d) => {
    series.forEach((s) => {
      const val = Number(d[s.key]) || 0;
      if (val > maxValue) maxValue = val;
    });
  });

  // Ensure minimum top margin
  if (maxValue === 0) maxValue = 10;
  const paddingX = 40;
  const paddingY = 24;
  const chartWidth = 600;
  const chartHeight = height;
  const innerWidth = chartWidth - paddingX * 2;
  const innerHeight = chartHeight - paddingY * 2;

  const pointsCount = data.length;
  const stepX = pointsCount > 1 ? innerWidth / (pointsCount - 1) : innerWidth / 2;

  // Format date labels
  const formatDateLabel = (dStr: string) => {
    try {
      const parts = dStr.split('-');
      if (parts.length === 3) {
        return `${parts[1]}/${parts[2]}`;
      }
      return dStr;
    } catch {
      return dStr;
    }
  };

  return (
    <div className="w-full relative flex flex-col">
      <svg
        viewBox={`0 0 ${chartWidth} ${chartHeight}`}
        className="w-full h-auto overflow-visible select-none"
        style={{ maxHeight: height }}
      >
        <defs>
          {series.map((s) => (
            <linearGradient
              key={`grad-${s.key}`}
              id={`grad-${s.key}`}
              x1="0"
              y1="0"
              x2="0"
              y2="1"
            >
              <stop offset="0%" stopColor={s.color} stopOpacity="0.25" />
              <stop offset="100%" stopColor={s.color} stopOpacity="0.0" />
            </linearGradient>
          ))}
        </defs>

        {/* Horizontal grid lines */}
        {[0, 0.25, 0.5, 0.75, 1].map((pct, i) => {
          const y = paddingY + innerHeight * (1 - pct);
          const gridVal = Math.round(maxValue * pct);
          return (
            <g key={i}>
              <line
                x1={paddingX}
                y1={y}
                x2={chartWidth - paddingX}
                y2={y}
                stroke="var(--border)"
                strokeDasharray="3 3"
                strokeOpacity="0.6"
              />
              <text
                x={paddingX - 8}
                y={y + 3}
                textAnchor="end"
                className="text-[10px] fill-muted-foreground font-mono"
              >
                {valueFormatter(gridVal)}
              </text>
            </g>
          );
        })}

        {/* Series Areas and Lines */}
        {series.map((s) => {
          const pts = data.map((d, idx) => {
            const x = pointsCount > 1 ? paddingX + idx * stepX : paddingX + innerWidth / 2;
            const val = Number(d[s.key]) || 0;
            const y = paddingY + innerHeight * (1 - val / maxValue);
            return { x, y, val };
          });

          if (pts.length === 0) return null;

          const lineD = pts.reduce(
            (acc, p, idx) => `${acc} ${idx === 0 ? 'M' : 'L'} ${p.x.toFixed(1)} ${p.y.toFixed(1)}`,
            ''
          );

          const firstX = pts[0].x.toFixed(1);
          const lastX = pts[pts.length - 1].x.toFixed(1);
          const bottomY = (paddingY + innerHeight).toFixed(1);
          const areaD = `${lineD} L ${lastX} ${bottomY} L ${firstX} ${bottomY} Z`;

          return (
            <g key={s.key}>
              {/* Area gradient */}
              <path d={areaD} fill={`url(#grad-${s.key})`} />
              {/* Stroke line */}
              <path
                d={lineD}
                fill="none"
                stroke={s.color}
                strokeWidth="2.2"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
              {/* Data points */}
              {pts.map((p, idx) => (
                <circle
                  key={idx}
                  cx={p.x}
                  cy={p.y}
                  r={hoverIndex === idx ? 4.5 : 2.5}
                  fill="var(--card)"
                  stroke={s.color}
                  strokeWidth="2"
                  className="transition-all duration-150 cursor-pointer"
                />
              ))}
            </g>
          );
        })}

        {/* Hover vertical crosshair & trigger regions */}
        {data.map((_, idx) => {
          const x = pointsCount > 1 ? paddingX + idx * stepX : paddingX + innerWidth / 2;
          const isHovered = hoverIndex === idx;
          const hitWidth = pointsCount > 1 ? stepX : innerWidth;

          return (
            <g key={`hit-${idx}`}>
              {isHovered && (
                <line
                  x1={x}
                  y1={paddingY}
                  x2={x}
                  y2={paddingY + innerHeight}
                  stroke="var(--foreground)"
                  strokeOpacity="0.2"
                  strokeWidth="1.5"
                  strokeDasharray="2 2"
                />
              )}
              {/* Transparent hit area */}
              <rect
                x={x - hitWidth / 2}
                y={paddingY}
                width={hitWidth}
                height={innerHeight}
                fill="transparent"
                onMouseEnter={() => setHoverIndex(idx)}
                onMouseLeave={() => setHoverIndex(null)}
                className="cursor-pointer"
              />
            </g>
          );
        })}

        {/* X-axis date labels */}
        {data.map((d, idx) => {
          // Display skip for dense charts
          const showLabel =
            pointsCount <= 10 ||
            idx === 0 ||
            idx === pointsCount - 1 ||
            idx % Math.ceil(pointsCount / 6) === 0;

          if (!showLabel) return null;
          const x = pointsCount > 1 ? paddingX + idx * stepX : paddingX + innerWidth / 2;
          return (
            <text
              key={`label-${idx}`}
              x={x}
              y={chartHeight - 4}
              textAnchor="middle"
              className="text-[10px] fill-muted-foreground font-mono"
            >
              {formatDateLabel(d.date)}
            </text>
          );
        })}
      </svg>

      {/* Hover tooltip card */}
      {hoverIndex !== null && data[hoverIndex] && (
        <div
          className="absolute z-20 top-2 left-1/2 -translate-x-1/2 pointer-events-none rounded-lg border border-border bg-popover/95 px-3 py-2 text-xs shadow-md backdrop-blur-xs flex flex-col gap-1 min-w-[140px]"
        >
          <span className="font-semibold text-foreground border-b pb-1 text-[11px]">
            {data[hoverIndex].date}
          </span>
          {series.map((s) => {
            const val = Number(data[hoverIndex][s.key]) || 0;
            return (
              <div key={s.key} className="flex items-center justify-between gap-3 text-[11px]">
                <span className="flex items-center gap-1.5 text-muted-foreground">
                  <span className="h-2 w-2 rounded-full" style={{ backgroundColor: s.color }} />
                  <span>{s.label}:</span>
                </span>
                <span className="font-semibold font-mono text-foreground">
                  {valueFormatter(val)}
                </span>
              </div>
            );
          })}
        </div>
      )}

      {/* Series legend */}
      <div className="flex items-center justify-center gap-4 mt-3 pt-2 border-t border-border/50">
        {series.map((s) => (
          <div key={s.key} className="flex items-center gap-1.5 text-xs text-muted-foreground">
            <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: s.color }} />
            <span>{s.label}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
