import { Link } from "@tanstack/react-router";
import { Search, Bell } from "lucide-react";
import { useState } from "react";

export function Header({ onSearch }: { onSearch?: (q: string) => void }) {
  const [q, setQ] = useState("");
  return (
    <header className="sticky top-0 z-40 border-b border-border bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/70">
      <div className="mx-auto flex max-w-md items-center gap-2 px-3 py-2.5">
        <Link to="/" className="flex items-center gap-2">
          <div className="grid h-9 w-9 place-items-center rounded-lg bg-gradient-brand text-primary-foreground shadow-brand">
            <span className="font-display text-sm font-black">M</span>
          </div>
          <span className="font-display text-base font-bold tracking-tight">MSN Courtier</span>
        </Link>
        <div className="relative ml-auto flex-1 max-w-[180px]">
          <Search className="absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
          <input
            type="search"
            value={q}
            onChange={(e) => {
              setQ(e.target.value);
              onSearch?.(e.target.value);
            }}
            placeholder="Rechercher…"
            className="w-full rounded-full border border-input bg-muted/50 py-1.5 pl-8 pr-3 text-xs outline-none transition-colors focus:border-primary focus:bg-background"
          />
        </div>
        <button
          type="button"
          className="grid h-9 w-9 place-items-center rounded-lg text-muted-foreground hover:bg-muted"
          aria-label="Notifications"
        >
          <Bell className="h-4 w-4" />
        </button>
      </div>
    </header>
  );
}
