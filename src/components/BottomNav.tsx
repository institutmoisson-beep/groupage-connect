import { Link } from "@tanstack/react-router";
import {
  Home,
  Hotel,
  PackageCheck,
  PackageOpen,
  Search,
  Ship,
  ShoppingBag,
  Users,
  User,
} from "lucide-react";

const items: Array<{
  to: "/" | "/groupage" | "/sourcing" | "/cargo" | "/hotels" | "/stock" | "/onfaisimple" | "/mlm" | "/profile";
  label: string;
  icon: typeof Home;
  exact?: boolean;
  badge?: boolean;
}> = [
  { to: "/", label: "Accueil", icon: Home, exact: true },
  { to: "/groupage", label: "Groupage", icon: PackageOpen },
  { to: "/sourcing", label: "Sourcing", icon: Search },
  { to: "/cargo", label: "Cargo", icon: Ship },
  { to: "/hotels", label: "Hôtels", icon: Hotel },
  { to: "/stock", label: "Stock", icon: ShoppingBag },
  { to: "/onfaisimple", label: "OnFaiSimple", icon: PackageCheck, badge: true },
  { to: "/mlm", label: "Réseau", icon: Users },
  { to: "/profile", label: "Profil", icon: User },
];

export function BottomNav() {
  return (
    <nav className="sticky bottom-0 z-40 border-t border-border bg-card/95 backdrop-blur supports-[backdrop-filter]:bg-card/80">
      <ul className="mx-auto flex max-w-md items-stretch">
        {items.map(({ to, label, icon: Icon, exact, badge }) => (
          <li key={to} className="flex-1">
            <Link
              to={to}
              activeOptions={{ exact: !!exact }}
              activeProps={{ className: "text-primary" }}
              inactiveProps={{ className: "text-muted-foreground" }}
              className="flex flex-col items-center justify-center gap-0.5 px-0.5 py-2.5 text-[9px] font-medium transition-colors hover:text-primary"
            >
              <span className="relative">
                <Icon className="h-[18px] w-[18px]" />
                {badge && (
                  <span className="absolute -right-1 -top-0.5 h-1.5 w-1.5 rounded-full bg-ofs-gold shadow-ofs" />
                )}
              </span>
              {label}
            </Link>
          </li>
        ))}
      </ul>
    </nav>
  );
}
