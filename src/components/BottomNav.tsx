import { Link } from "@tanstack/react-router";
import { Home, PackageOpen, Search, Ship, Users, User } from "lucide-react";

const items: Array<{ to: "/" | "/groupage" | "/sourcing" | "/cargo" | "/mlm" | "/profile"; label: string; icon: typeof Home; exact?: boolean }> = [
  { to: "/", label: "Accueil", icon: Home, exact: true },
  { to: "/groupage", label: "Groupage", icon: PackageOpen },
  { to: "/sourcing", label: "Sourcing", icon: Search },
  { to: "/cargo", label: "Cargo", icon: Ship },
  { to: "/mlm", label: "Réseau", icon: Users },
  { to: "/profile", label: "Profil", icon: User },
];

export function BottomNav() {
  return (
    <nav className="sticky bottom-0 z-40 border-t border-border bg-card/95 backdrop-blur supports-[backdrop-filter]:bg-card/80">
      <ul className="mx-auto flex max-w-md items-stretch">
        {items.map(({ to, label, icon: Icon, exact }) => (
          <li key={to} className="flex-1">
            <Link
              to={to}
              activeOptions={{ exact: !!exact }}
              activeProps={{ className: "text-primary" }}
              inactiveProps={{ className: "text-muted-foreground" }}
              className="flex flex-col items-center justify-center gap-0.5 py-2.5 text-[10px] font-medium transition-colors hover:text-primary"
            >
              <Icon className="h-5 w-5" />
              {label}
            </Link>
          </li>
        ))}
      </ul>
    </nav>
  );
}
