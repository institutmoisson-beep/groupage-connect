export function ProgressBar({ current, target }: { current: number; target: number }) {
  const pct = Math.min(100, Math.round((current / target) * 100));
  const almost = pct >= 80;
  return (
    <div className="space-y-1">
      <div className="flex items-center justify-between text-xs">
        <span className="font-medium text-muted-foreground">
          {current}/{target} participants
        </span>
        <span className={`font-bold ${almost ? "text-primary" : "text-secondary"}`}>{pct}%</span>
      </div>
      <div className="h-2 w-full overflow-hidden rounded-full bg-muted">
        <div
          className={`h-full rounded-full transition-all duration-500 ${almost ? "bg-gradient-urgency animate-pulse-urgent" : "bg-gradient-brand"}`}
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
  );
}
