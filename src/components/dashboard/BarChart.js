"use client";

import { formatNaira } from "@/lib/money";

function compact(n) {
  const abs = Math.abs(n);
  const sign = n < 0 ? "-" : "";
  if (abs >= 1_000_000) return `${sign}₦${+(abs / 1_000_000).toFixed(1)}M`;
  if (abs >= 1_000) return `${sign}₦${+(abs / 1_000).toFixed(abs >= 10_000 ? 0 : 1)}K`;
  return `${sign}₦${Math.round(abs)}`;
}

// Simple responsive bar chart. Bars start from the zero line (losses go down).
export default function BarChart({ points, valueKey, barClass, negativeClass = "bg-red-400" }) {
  const values = points.map((p) => p[valueKey]);
  const max = Math.max(0, ...values);
  const min = Math.min(0, ...values);
  const span = max - min || 1;
  const every = Math.max(1, Math.ceil(points.length / 7));
  const gridLines = [0, 1, 2, 3, 4].map((i) => max - (span * i) / 4);

  return (
    <div>
      <div className="flex gap-2">
        <div className="relative h-48 w-12 shrink-0 text-right text-[10px] text-gray-400">
          {gridLines.map((v, i) => (
            <span key={i} className="absolute right-0 -translate-y-1/2" style={{ top: `${(i / 4) * 100}%` }}>
              {compact(v)}
            </span>
          ))}
        </div>

        <div className="relative h-48 flex-1">
          {gridLines.map((_, i) => (
            <div key={i} className="absolute inset-x-0 border-t border-gray-100" style={{ top: `${(i / 4) * 100}%` }} />
          ))}
          {min < 0 && <div className="absolute inset-x-0 border-t border-gray-300" style={{ top: `${(max / span) * 100}%` }} />}

          <div className="absolute inset-0 flex items-stretch gap-[3px]">
            {points.map((p) => {
              const v = p[valueKey];
              const top = v >= 0 ? ((max - v) / span) * 100 : (max / span) * 100;
              const height = (Math.abs(v) / span) * 100;
              return (
                <div key={p.key} className="group relative flex-1">
                  <div
                    className={`absolute inset-x-[8%] rounded-t-sm transition-opacity group-hover:opacity-80 ${v < 0 ? negativeClass : barClass}`}
                    style={{ top: `${top}%`, height: `${Math.max(height, v !== 0 ? 1 : 0)}%` }}
                  />
                  <div className="pointer-events-none absolute left-1/2 top-0 z-10 hidden -translate-x-1/2 -translate-y-full whitespace-nowrap rounded-lg bg-gray-900 px-2.5 py-1.5 text-xs text-white shadow-lg group-hover:block">
                    <span className="block text-gray-300">{p.title}</span>
                    <span className="font-semibold">{formatNaira(v)}</span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      <div className="mt-2 flex gap-2">
        <div className="w-12 shrink-0" />
        <div className="flex flex-1 gap-[3px]">
          {points.map((p, i) => (
            <div key={p.key} className="flex-1 text-center text-[10px] text-gray-400">
              {i % every === 0 ? <span className="whitespace-nowrap">{p.label}</span> : null}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
