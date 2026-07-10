import { useEffect, useState } from "react";
import { Clock } from "lucide-react";

function diff(target: Date): { d: number; h: number; m: number; s: number; done: boolean } {
  const now = Date.now();
  const t = target.getTime() - now;
  if (t <= 0) return { d: 0, h: 0, m: 0, s: 0, done: true };
  const d = Math.floor(t / 86400000);
  const h = Math.floor((t % 86400000) / 3600000);
  const m = Math.floor((t % 3600000) / 60000);
  const s = Math.floor((t % 60000) / 1000);
  return { d, h, m, s, done: false };
}

export function CountdownTimer({ endDate, compact = false }: { endDate: string; compact?: boolean }) {
  const target = new Date(endDate);
  const [t, setT] = useState(() => diff(target));
  useEffect(() => {
    const id = setInterval(() => setT(diff(target)), 1000);
    return () => clearInterval(id);
  }, [endDate]);

  if (t.done) return <span className="text-xs font-medium text-muted-foreground">Terminé</span>;

  const urgent = t.d === 0 && t.h < 24;

  if (compact) {
    return (
      <span
        className={`inline-flex items-center gap-1 text-xs font-semibold ${urgent ? "text-primary" : "text-foreground"}`}
      >
        <Clock className="h-3 w-3" />
        {t.d > 0 ? `${t.d}j ${t.h}h` : `${String(t.h).padStart(2, "0")}:${String(t.m).padStart(2, "0")}:${String(t.s).padStart(2, "0")}`}
      </span>
    );
  }

  return (
    <div className={`inline-flex items-center gap-2 rounded-md px-3 py-1.5 text-sm font-bold ${urgent ? "bg-primary text-primary-foreground animate-pulse-urgent" : "bg-muted text-foreground"}`}>
      <Clock className="h-4 w-4" />
      {t.d > 0 && <span>{t.d}j</span>}
      <span>
        {String(t.h).padStart(2, "0")}:{String(t.m).padStart(2, "0")}:{String(t.s).padStart(2, "0")}
      </span>
    </div>
  );
}
