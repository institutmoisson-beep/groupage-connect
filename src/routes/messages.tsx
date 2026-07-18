import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { ArrowLeft, Loader2 } from "lucide-react";

import { useAuth } from "@/hooks/use-auth";
import { DirectChat } from "@/components/DirectChat";

export const Route = createFileRoute("/messages")({
  head: () => ({
    meta: [{ title: "Messages — MSN Courtier" }, { name: "robots", content: "noindex" }],
  }),
  component: MessagesPage,
});

function MessagesPage() {
  const { user, loading } = useAuth();
  const navigate = useNavigate();

  if (loading) {
    return (
      <div className="grid min-h-screen place-items-center">
        <Loader2 className="h-6 w-6 animate-spin text-primary" />
      </div>
    );
  }
  if (!user) {
    navigate({ to: "/auth", search: { redirect: "/messages" } as never });
    return null;
  }

  return (
    <div className="mx-auto flex min-h-screen max-w-md flex-col bg-background">
      <header className="sticky top-0 z-40 flex items-center gap-3 bg-gradient-brand px-3 py-3 text-primary-foreground shadow-brand">
        <Link
          to="/profile"
          className="grid h-9 w-9 shrink-0 place-items-center rounded-full text-primary-foreground hover:bg-white/10"
          aria-label="Retour"
        >
          <ArrowLeft className="h-5 w-5" />
        </Link>
        <div className="relative grid h-10 w-10 shrink-0 place-items-center rounded-full bg-white/20 text-sm font-black backdrop-blur">
          M
          <span className="absolute -bottom-0.5 -right-0.5 h-3 w-3 rounded-full border-2 border-primary bg-emerald-400" />
        </div>
        <div className="min-w-0 flex-1">
          <h1 className="truncate text-sm font-bold">MSN Courtier</h1>
          <p className="text-[10px] opacity-90">Assistance en ligne · Réponse rapide</p>
        </div>
      </header>
      <main className="flex-1 p-3">
        <DirectChat channelUserId={user.id} currentUserId={user.id} viewAsAdmin={false} />
      </main>
    </div>
  );
}
