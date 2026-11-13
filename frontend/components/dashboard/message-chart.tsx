'use client';

import { useState } from 'react';
import { BarChart3, Table2 } from 'lucide-react';
import { cn } from '@/lib/utils';

type Day = { date: string; incoming: number; outgoing: number };

const SERIES = [
  { key: 'incoming', label: 'Incoming', color: 'var(--dash-in)' },
  { key: 'outgoing', label: 'Outgoing', color: 'var(--dash-out)' },
] as const;

function shortDay(date: string) {
  const d = new Date(date);
  return Number.isNaN(d.getTime()) ? date : `${d.toLocaleDateString(undefined, { weekday: 'short' })} ${d.getDate()}`;
}

/** Grouped bars: incoming vs outgoing messages per day, with a hover tooltip and a table view. */
export function MessageChart({ days }: { days: Day[] }) {
  const [view, setView] = useState<'chart' | 'table'>('chart');
  const [hover, setHover] = useState<number | null>(null);
  const max = Math.max(1, ...days.flatMap((d) => [d.incoming, d.outgoing]));
  const totals = days.reduce((a, d) => ({ in: a.in + d.incoming, out: a.out + d.outgoing }), { in: 0, out: 0 });

  return (
    <div>
      <div className="flex flex-wrap items-center justify-between gap-3">
        {/* Legend with totals: identity is never colour alone */}
        <ul className="flex items-center gap-5 text-sm">
          {SERIES.map((s) => (
            <li key={s.key} className="flex items-center gap-2">
              <span className="h-2.5 w-2.5 rounded-[3px]" style={{ background: s.color }} aria-hidden="true" />
              <span className="text-muted-foreground">{s.label}</span>
              <span className="font-semibold tabular-nums text-foreground">
                {(s.key === 'incoming' ? totals.in : totals.out).toLocaleString()}
              </span>
            </li>
          ))}
        </ul>
        <div className="inline-flex rounded-full border bg-muted/40 p-0.5" role="group" aria-label="Chart or table">
          {(['chart', 'table'] as const).map((v) => (
            <button
              key={v}
              type="button"
              onClick={() => setView(v)}
              aria-pressed={view === v}
              className={cn(
                'inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-medium transition-colors',
                view === v ? 'bg-background text-foreground shadow-xs' : 'text-muted-foreground hover:text-foreground',
              )}
            >
              {v === 'chart' ? <BarChart3 className="h-3.5 w-3.5" /> : <Table2 className="h-3.5 w-3.5" />}
              {v === 'chart' ? 'Chart' : 'Table'}
            </button>
          ))}
        </div>
      </div>

      {view === 'chart' ? (
        <div className="relative mt-6">
          {/* Recessive gridlines */}
          <div className="pointer-events-none absolute inset-x-0 top-0 h-64" aria-hidden="true">
            {[0, 0.5, 1].map((f) => (
              <div key={f} className="absolute inset-x-0 border-t border-dashed border-border/70" style={{ top: `${f * 100}%` }} />
            ))}
            <span className="absolute -top-2 right-0 bg-card pl-1 text-xs tabular-nums text-muted-foreground">{max}</span>
          </div>

          <div className="relative flex h-64 items-end gap-2 sm:gap-4" role="img" aria-label="Messages per day for the last 7 days; switch to Table for exact values">
            {days.map((d, i) => (
              <div
                key={d.date}
                className="relative flex h-full flex-1 items-end justify-center gap-[2px] rounded-lg"
                onMouseEnter={() => setHover(i)}
                onMouseLeave={() => setHover(null)}
              >
                {hover === i && <div className="absolute inset-0 -mx-1 rounded-lg bg-muted/60" aria-hidden="true" />}
                {SERIES.map((s) => {
                  const v = d[s.key];
                  return (
                    <div
                      key={s.key}
                      className="relative w-full max-w-5 rounded-t-[4px] transition-[height] duration-500"
                      style={{ height: `${v ? Math.max(2, (v / max) * 100) : 0}%`, background: s.color }}
                    />
                  );
                })}
                {hover === i && (
                  <div className="absolute bottom-full left-1/2 z-10 mb-2 w-max -translate-x-1/2 rounded-lg border bg-popover px-3 py-2 text-xs shadow-md">
                    <p className="font-semibold text-foreground">{shortDay(d.date)}</p>
                    {SERIES.map((s) => (
                      <p key={s.key} className="mt-1 flex items-center gap-2 text-muted-foreground">
                        <span className="h-2 w-2 rounded-[2px]" style={{ background: s.color }} />
                        {s.label}
                        <span className="ml-auto pl-3 font-semibold tabular-nums text-foreground">{d[s.key]}</span>
                      </p>
                    ))}
                  </div>
                )}
              </div>
            ))}
          </div>
          <div className="mt-2 flex gap-2 sm:gap-4" aria-hidden="true">
            {days.map((d) => (
              <span key={d.date} className="flex-1 text-center text-xs text-muted-foreground">
                {shortDay(d.date)}
              </span>
            ))}
          </div>
        </div>
      ) : (
        <div className="mt-5 overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="border-b text-xs text-muted-foreground">
              <tr>
                <th className="px-3 py-2 font-medium">Date</th>
                <th className="px-3 py-2 text-right font-medium">Incoming</th>
                <th className="px-3 py-2 text-right font-medium">Outgoing</th>
                <th className="px-3 py-2 text-right font-medium">Total</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {days.map((d) => (
                <tr key={d.date} className="hover:bg-muted/40">
                  <td className="px-3 py-2 font-medium">{shortDay(d.date)}</td>
                  <td className="px-3 py-2 text-right tabular-nums text-muted-foreground">{d.incoming}</td>
                  <td className="px-3 py-2 text-right tabular-nums text-muted-foreground">{d.outgoing}</td>
                  <td className="px-3 py-2 text-right font-semibold tabular-nums">{d.incoming + d.outgoing}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
