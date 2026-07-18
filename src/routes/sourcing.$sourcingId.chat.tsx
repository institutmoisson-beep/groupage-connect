import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useEffect } from "react";
import { ArrowLeft, Loader2 } from "lucide-react";

import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { SourcingChat } from "@/components/SourcingChat";

export const Route = createFileRoute("/sourcing/$sourcingId/chat")({
  head: () => ({
    meta: [{ title: "Discussion — Sourcing MSN" }, { name: "robots", content: "noindex" }],
  }),
  component: SourcingChatPage,
});

function SourcingChatPage() {
  const { sourcingId } = Route.useParams();
  const { user, loading } = useAuth();
  const navigate = useNavigate();

  const { data: order, isLoading } = useQuery({
    queryKey: ["sourcing-order-chat", sourcingId],
    enabled: !!user,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("custom_sourcing_orders")
        .select("id, product_name, main_image, user_id")
        .eq("id", sourcingId)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
  });

  // Ouvrir la discussion marque comme lues les notifications liées à cette demande.
  useEffect(() => {
    if (!user) return;
    supabase
      .from("user_notifications" as any)
      .update({ read_at: new Date().toISOString() })
      .eq("user_id", user.id)
      .eq("sourcing_order_id", sourcingId)
      .is("read_at", null)
      .then(() => {});
  }, [user, sourcingId]);

  if (loading || isLoading) {
    return (
      <div className="grid min-h-screen place-items-center">
        <Loader2 className="h-6 w-6 animate-spin text-primary" />
      </div>
    );
  }
  if (!user) {
    navigate({ to: "/auth", search: { redirect: `/sourcing/${sourcingId}/chat` } as never });
    return null;
  }
  if (!order) {
    return (
      <div className="mx-auto max-w-md p-6 text-center">
        <p className="text-muted-foreground">Demande introuvable.</p>
        <Link to="/sourcing" className="mt-3 inline-block text-sm font-semibold text-primary">
          ← Sourcing
        </Link>
      </div>
    );
  }

  return (
    <div className="mx-auto flex min-h-screen max-w-md flex-col bg-background">
      <header className="sticky top-0 z-40 flex items-center gap-2 border-b border-border bg-background/95 px-3 py-2.5 backdrop-blur">
        <button
          type="button"
          onClick={() => history.back()}
          className="grid h-9 w-9 place-items-center rounded-lg hover:bg-muted"
          aria-label="Retour"
        >
          <ArrowLeft className="h-5 w-5" />
        </button>
        <div className="flex-1 min-w-0">
          <h1 className="truncate text-sm font-semibold">{order.product_name}</h1>
          <p className="text-[10px] text-muted-foreground">Discussion avec MSN Courtier</p>
        </div>
        {order.main_image && (
          <img
            src={order.main_image}
            alt={order.product_name}
            className="h-9 w-9 shrink-0 rounded-lg object-cover"
          />
        )}
      </header>
      <main className="flex-1 p-3">
        <SourcingChat sourcingOrderId={sourcingId} currentUserId={user.id} viewAsAdmin={false} />
      </main>
    </div>
  );
}
