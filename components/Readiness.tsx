import { readinessLabel } from "@/lib/progress/readiness";

export function ReadinessBar({ value, compact = false }: { value: number | null; compact?: boolean }) {
  const pct = value ?? 0;
  return (
    <div>
      {!compact && (
        <div className="mb-2 flex items-end justify-between gap-3">
          <div>
            <div className="text-sm text-muted">Готовность к экзамену</div>
            <div className="text-4xl font-bold tabular-nums leading-none">{value === null ? "—" : `${pct}%`}</div>
          </div>
          <div className="text-right text-sm font-medium">{value === null ? "" : readinessLabel(pct)}</div>
        </div>
      )}
      <div
        className={`${compact ? "h-1.5" : "h-2.5"} overflow-hidden rounded-full bg-surface-2`}
        role="progressbar"
        aria-label="Готовность к экзамену"
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={pct}
      >
        <div className="h-full rounded-full bg-brand transition-[width] duration-500" style={{ width: `${pct}%` }} />
      </div>
    </div>
  );
}
